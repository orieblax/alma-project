'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  UploadCloud,
  FileText,
  Trash2,
  CheckCircle2,
  Loader2,
  Layers,
  Database,
  Bot,
  AlertCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Chatbot } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

const PROMPT_TEMPLATES = [
  {
    title: 'Atención al Cliente Corporativo',
    prompt:
      'Eres un asistente de atención al cliente corporativo y resolutivo. Responde preguntas con amabilidad, claridad y precisión basándote únicamente en el contexto documental proporcionado. Si no sabes la respuesta o no está en los documentos, indícalo cortésmente.',
  },
  {
    title: 'Tutor Técnico y Programación',
    prompt:
      'Eres un tutor técnico de ingeniería y arquitectura de software. Explica conceptos con código limpio, mejores prácticas y referencias a la documentación técnica cargada.',
  },
  {
    title: 'Asistente Legal y Normativo',
    prompt:
      'Eres un asistente especializado en análisis normativo y contractual. Analiza minuciosamente los documentos proporcionados, citando las cláusulas pertinentes con la mayor exactitud posible.',
  },
  {
    title: 'Políticas y Recursos Humanos',
    prompt:
      'Eres un facilitador de Recursos Humanos. Guía a los colaboradores sobre políticas internas, beneficios, reglamentos y procedimientos descritos en los manuales de la empresa.',
  },
];

export default function NewChatbotWizard() {
  const router = useRouter();

  // Wizard Steps: 1 -> 2 -> 3 -> 4
  const [step, setStep] = useState<number>(1);

  // Step 1: Basic info
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState(
    'Eres un asistente inteligente cordial, preciso y profesional. Responde utilizando el contexto suministrado.'
  );
  const [step1Error, setStep1Error] = useState<string | null>(null);

  // Step 2: Documents
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [step2Error, setStep2Error] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 3: Processing ETL
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStepText, setProcessingStepText] = useState('');
  const [etlChecklist, setEtlChecklist] = useState({
    creatingChatbot: false,
    extractingText: false,
    chunking: false,
    vectorizing: false,
  });

  // Step 4: Result
  const [createdChatbot, setCreatedChatbot] = useState<Chatbot | null>(null);
  const [totalChunksIndexed, setTotalChunksIndexed] = useState(0);

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(Array.from(e.dataTransfer.files));
    }
  };

  const handleFilesSelected = (newFiles: File[]) => {
    const validExtensions = ['pdf', 'docx', 'txt', 'md'];
    const validFiles: File[] = [];
    let hasInvalid = false;

    newFiles.forEach((f) => {
      const ext = f.name.split('.').pop()?.toLowerCase();
      if (ext && validExtensions.includes(ext)) {
        // avoid duplicates by name
        if (!files.some((existing) => existing.name === f.name)) {
          validFiles.push(f);
        }
      } else {
        hasInvalid = true;
      }
    });

    if (hasInvalid) {
      setStep2Error('Solo se permiten archivos en formato .pdf, .docx, .txt o .md');
    } else {
      setStep2Error(null);
    }

    setFiles((prev) => [...prev, ...validFiles]);
  };

  const removeFile = (fileName: string) => {
    setFiles((prev) => prev.filter((f) => f.name !== fileName));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  };

  // Step 1 validation
  const handleNextStep1 = () => {
    if (!name.trim()) {
      setStep1Error('El nombre del chatbot es obligatorio (mínimo 2 caracteres).');
      return;
    }
    if (name.trim().length < 2) {
      setStep1Error('El nombre debe tener al menos 2 caracteres.');
      return;
    }
    setStep1Error(null);
    setStep(2);
  };

  // Step 2 validation & trigger ETL (Step 3)
  const handleStartProcessing = async () => {
    setStep(3);
    setIsProcessing(true);
    setProcessingProgress(15);
    setProcessingStepText('Inicializando chatbot en el sistema...');

    try {
      // 1. Create Chatbot
      const botRes = await api.chatbots.create({
        name: name.trim(),
        description: description.trim(),
        system_prompt: systemPrompt.trim(),
        is_active: true,
      });

      const newBot = botRes.chatbot;
      setCreatedChatbot(newBot);
      setEtlChecklist((prev) => ({ ...prev, creatingChatbot: true }));
      setProcessingProgress(35);

      let accumulatedChunks = 0;

      // 2. Upload files if any
      if (files.length > 0) {
        setProcessingStepText(`Procesando pipeline ETL para ${files.length} documento(s)...`);
        setEtlChecklist((prev) => ({ ...prev, extractingText: true }));
        setProcessingProgress(50);

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          setProcessingStepText(`Extrayendo texto y chunking para "${file.name}"...`);
          setEtlChecklist((prev) => ({ ...prev, chunking: true }));

          const uploadRes = await api.documents.upload(newBot.id, file);
          accumulatedChunks += uploadRes.chunks_indexed || 0;

          setProcessingStepText(`Calculando embeddings vectoriales (384-dim) en pgvector...`);
          setEtlChecklist((prev) => ({ ...prev, vectorizing: true }));
          setProcessingProgress(50 + Math.round(((i + 1) / files.length) * 45));
        }
      } else {
        setProcessingProgress(85);
      }

      setTotalChunksIndexed(accumulatedChunks);
      setProcessingProgress(100);
      setProcessingStepText('¡Chatbot y base de conocimiento listos!');

      setTimeout(() => {
        setIsProcessing(false);
        setStep(4);
      }, 700);
    } catch (err: any) {
      setIsProcessing(false);
      alert('Error durante la creación: ' + (err?.message || 'Error desconocido'));
      setStep(2);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full animate-fade-in">
      {/* Wizard Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Crear Nuevo Asistente Chatbot
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xl mx-auto">
          Configura la personalidad de tu chatbot, carga tus archivos documentales y
          crea la base de vectores en pocos segundos.
        </p>
      </div>

      {/* Stepper Progress Bar */}
      <div className="mb-10">
        <div className="flex items-center justify-between max-w-2xl mx-auto relative">
          {/* Progress bar background line */}
          <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-1 bg-slate-200 dark:bg-slate-800 -z-10" />
          <div
            className="absolute left-6 top-1/2 -translate-y-1/2 h-1 bg-indigo-600 transition-all duration-300 -z-10"
            style={{
              width:
                step === 1
                  ? '0%'
                  : step === 2
                  ? '33%'
                  : step === 3
                  ? '66%'
                  : '100%',
            }}
          />

          {[
            { num: 1, label: 'Información Básica' },
            { num: 2, label: 'Documentos' },
            { num: 3, label: 'Pipeline ETL' },
            { num: 4, label: '¡Listo!' },
          ].map((st) => (
            <div key={st.num} className="flex flex-col items-center">
              <div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-200
                  ${
                    step === st.num
                      ? 'bg-indigo-600 text-white ring-4 ring-indigo-500/20'
                      : step > st.num
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  }
                `}
              >
                {step > st.num ? <CheckCircle2 className="w-5 h-5" /> : st.num}
              </div>
              <span
                className={`text-[11px] font-medium mt-1.5 hidden sm:inline ${
                  step >= st.num
                    ? 'text-slate-900 dark:text-slate-100 font-semibold'
                    : 'text-slate-400'
                }`}
              >
                {st.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Basic Info */}
      {step === 1 && (
        <Card className="p-6 sm:p-8 animate-fade-in space-y-6">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Bot className="w-5 h-5 text-indigo-500" />
              Paso 1: Configuración de Identidad y Prompt
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Define el nombre y el comportamiento del agente cuando interactúe con los usuarios.
            </p>
          </div>

          {step1Error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{step1Error}</span>
            </div>
          )}

          <div className="space-y-4">
            <Input
              label="Nombre del Asistente *"
              placeholder="Ej: Asistente de Operaciones, Soporte Legal..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Descripción (opcional)
              </label>
              <textarea
                rows={2}
                placeholder="Breve resumen de para qué fue diseñado este chatbot..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  System Prompt (Instrucción Base)
                </label>
                <span className="text-[11px] text-slate-400">Personaliza o elige una plantilla</span>
              </div>

              {/* Template chips */}
              <div className="flex flex-wrap gap-2 mb-3">
                {PROMPT_TEMPLATES.map((tmpl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSystemPrompt(tmpl.prompt)}
                    className="text-[11px] px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-100 hover:bg-indigo-50 hover:border-indigo-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors"
                  >
                    + {tmpl.title}
                  </button>
                ))}
              </div>

              <textarea
                rows={4}
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="w-full text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="primary"
              size="md"
              onClick={handleNextStep1}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Continuar a Carga de Documentos
            </Button>
          </div>
        </Card>
      )}

      {/* Step 2: Document Upload */}
      {step === 2 && (
        <Card className="p-6 sm:p-8 animate-fade-in space-y-6">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-indigo-500" />
              Paso 2: Carga de Documentos de Conocimiento
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Sube los documentos (.pdf, .docx, .txt, .md) sobre los que este chatbot responderá preguntas.
            </p>
          </div>

          {step2Error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{step2Error}</span>
            </div>
          )}

          {/* Drag & Drop Area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              p-8 text-center rounded-2xl border-2 border-dashed transition-all cursor-pointer
              ${
                isDragging
                  ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30'
                  : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400 bg-slate-50/50 dark:bg-slate-900/40'
              }
            `}
          >
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept=".pdf,.docx,.txt,.md"
              onChange={(e) => {
                if (e.target.files) {
                  handleFilesSelected(Array.from(e.target.files));
                }
              }}
              className="hidden"
            />
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center mb-3">
              <UploadCloud className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Arrastra y suelta tus archivos aquí, o haz clic para explorar
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Formatos soportados: PDF, Word (.docx), Markdown (.md) y Texto (.txt). Máx 10 MB por archivo.
            </p>
          </div>

          {/* Selected Files List */}
          {files.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span>Archivos seleccionados ({files.length})</span>
                <button
                  type="button"
                  onClick={() => setFiles([])}
                  className="text-rose-500 hover:underline"
                >
                  Quitar todos
                </button>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                {files.map((f, idx) => (
                  <div
                    key={idx}
                    className="p-3 flex items-center justify-between bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold uppercase">
                        {f.name.split('.').pop() || 'FILE'}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate max-w-xs sm:max-w-md">
                          {f.name}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {formatFileSize(f.size)}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(f.name)}
                      className="p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="outline"
              size="md"
              onClick={() => setStep(1)}
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              Atrás
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleStartProcessing}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              {files.length > 0
                ? `Crear e Indexar (${files.length} archivo${files.length === 1 ? '' : 's'})`
                : 'Crear Chatbot sin Archivos por ahora'}
            </Button>
          </div>
        </Card>
      )}

      {/* Step 3: Processing & ETL Checklist */}
      {step === 3 && (
        <Card className="p-8 sm:p-12 animate-fade-in text-center space-y-8">
          <div className="max-w-md mx-auto space-y-3">
            <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center relative">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Vectorizando Conocimiento
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {processingStepText}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="max-w-md mx-auto space-y-1.5">
            <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-300"
                style={{ width: `${processingProgress}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Pipeline ETL en ejecución</span>
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                {processingProgress}%
              </span>
            </div>
          </div>

          {/* Live Checklist */}
          <div className="max-w-md mx-auto text-left bg-slate-100 dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
            <div className="flex items-center gap-3">
              {etlChecklist.creatingChatbot ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              ) : (
                <Loader2 className="w-4 h-4 animate-spin text-slate-400 shrink-0" />
              )}
              <span className={etlChecklist.creatingChatbot ? 'font-medium text-slate-900 dark:text-slate-100' : 'text-slate-500'}>
                Configuración del modelo y system prompt
              </span>
            </div>

            <div className="flex items-center gap-3">
              {etlChecklist.extractingText ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              ) : (
                <Loader2 className="w-4 h-4 animate-spin text-slate-400 shrink-0" />
              )}
              <span className={etlChecklist.extractingText ? 'font-medium text-slate-900 dark:text-slate-100' : 'text-slate-500'}>
                Extracción limpia de texto por documento
              </span>
            </div>

            <div className="flex items-center gap-3">
              {etlChecklist.chunking ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              ) : (
                <Loader2 className="w-4 h-4 animate-spin text-slate-400 shrink-0" />
              )}
              <span className={etlChecklist.chunking ? 'font-medium text-slate-900 dark:text-slate-100' : 'text-slate-500'}>
                Generación de fragmentos con solapamiento semántico (500 chars)
              </span>
            </div>

            <div className="flex items-center gap-3">
              {etlChecklist.vectorizing ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              ) : (
                <Loader2 className="w-4 h-4 animate-spin text-slate-400 shrink-0" />
              )}
              <span className={etlChecklist.vectorizing ? 'font-medium text-slate-900 dark:text-slate-100' : 'text-slate-500'}>
                Cálculo de embeddings vectoriales de 384 dim en Supabase pgvector
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* Step 4: Success & Confirmation */}
      {step === 4 && createdChatbot && (
        <Card className="p-8 sm:p-10 animate-fade-in text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="max-w-md mx-auto space-y-1">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              ¡Chatbot Creado Exitosamente!
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tu asistente <strong className="text-slate-800 dark:text-slate-200">{createdChatbot.name}</strong> está listo para responder consultas fundamentadas en tus documentos.
            </p>
          </div>

          {/* Summary Box */}
          <div className="max-w-md mx-auto grid grid-cols-2 gap-3 p-4 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-left">
            <div>
              <span className="text-[11px] text-slate-400">Documentos indexados</span>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                {files.length}
              </p>
            </div>
            <div>
              <span className="text-[11px] text-slate-400">Fragmentos vectorizados</span>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                {totalChunksIndexed} chunks
              </p>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <Link href={`/chatbots/${createdChatbot.id}/test`} className="w-full sm:w-auto">
              <Button
                variant="primary"
                size="lg"
                rightIcon={<ArrowRight className="w-4 h-4" />}
                className="w-full sm:w-auto px-8"
              >
                Probar en el Playground RAG
              </Button>
            </Link>
            <Link href="/dashboard" className="w-full sm:w-auto">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                Volver al Dashboard
              </Button>
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}
