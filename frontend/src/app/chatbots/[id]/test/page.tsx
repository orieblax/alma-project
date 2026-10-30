'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Send,
  Bot,
  User,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Clock,
  Zap,
  FileText,
  UploadCloud,
  ArrowLeft,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Layers,
  Info,
  Sliders,
  PanelRightClose,
  PanelRightOpen,
  Target,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Chatbot, ChatMessage, Document, SourceCitation } from '@/types';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { RatingStars } from '@/components/ui/RatingStars';
import { Modal } from '@/components/ui/Modal';

export default function ChatbotPlaygroundPage() {
  const params = useParams();
  const router = useRouter();
  const chatbotId = params.id as string;

  const [chatbot, setChatbot] = useState<Chatbot | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loadingBot, setLoadingBot] = useState(true);

  // Chat conversation
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Document upload modal in playground
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending]);

  // Load chatbot and documents
  useEffect(() => {
    if (!chatbotId) return;

    const loadData = async () => {
      setLoadingBot(true);
      try {
        const [botRes, docsRes] = await Promise.allSettled([
          api.chatbots.get(chatbotId),
          api.documents.list(chatbotId),
        ]);

        if (botRes.status === 'fulfilled') {
          setChatbot(botRes.value.chatbot);
          // Set welcome message
          setMessages([
            {
              id: 'welcome',
              sender: 'bot',
              text: `¡Hola! Soy "${botRes.value.chatbot.name}". He sido entrenado con la documentación de tu empresa y estoy listo para responder tus preguntas con citas exactas y verificación semántica. ¿En qué te puedo ayudar hoy?`,
              created_at: new Date().toISOString(),
            },
          ]);
        }

        if (docsRes.status === 'fulfilled') {
          setDocuments(docsRes.value.documents || []);
        }
      } catch (err) {
        console.error('Error al cargar datos del chatbot:', err);
      } finally {
        setLoadingBot(false);
      }
    };

    loadData();
  }, [chatbotId]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = inputText.trim();
    if (!query || isSending || !chatbot) return;

    const userMessageId = 'user_' + Date.now();
    const newUserMsg: ChatMessage = {
      id: userMessageId,
      sender: 'user',
      text: query,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, newUserMsg]);
    setInputText('');
    setIsSending(true);

    try {
      const res = await api.rag.sendMessage(chatbotId, query, sessionId);

      if (res.session_id) {
        setSessionId(res.session_id);
      }

      const newBotMsg: ChatMessage = {
        id: res.message_id || 'bot_' + Date.now(),
        sender: 'bot',
        text: res.response,
        sources: res.sources || [],
        precision_at_k: res.precision_at_k,
        response_time_ms: res.response_time_ms,
        tokens_used: res.tokens_used,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, newBotMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: 'error_' + Date.now(),
        sender: 'bot',
        text:
          'Lo siento, ocurrió un error al consultar el motor RAG: ' +
          (err?.message || 'Error de conexión.'),
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsSending(false);
    }
  };

  const toggleSource = (msgId: string) => {
    setExpandedSources((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  };

  const handleResetChat = () => {
    setSessionId(undefined);
    setMessages([
      {
        id: 'welcome_' + Date.now(),
        sender: 'bot',
        text: `Conversación reiniciada. ¿Qué nueva consulta deseas realizar sobre "${chatbot?.name}"?`,
        created_at: new Date().toISOString(),
      },
    ]);
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !chatbot) return;

    setIsUploading(true);
    setUploadSuccess(null);
    try {
      const res = await api.documents.upload(chatbot.id, selectedFile);
      setUploadSuccess(`¡Documento procesado! Se generaron ${res.chunks_indexed} fragmentos.`);
      setSelectedFile(null);
      // Reload documents
      const docsRes = await api.documents.list(chatbot.id);
      setDocuments(docsRes.documents || []);
    } catch (err: any) {
      alert('Error al procesar el archivo: ' + (err?.message || 'Error desconocido'));
    } finally {
      setIsUploading(false);
    }
  };

  if (loadingBot) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500">Cargando Playground RAG...</p>
        </div>
      </div>
    );
  }

  if (!chatbot) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-4 max-w-sm">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Chatbot no encontrado
          </h2>
          <p className="text-xs text-slate-500">
            El chatbot solicitado no existe o no tienes permisos para acceder a él.
          </p>
          <Link href="/dashboard">
            <Button variant="primary" size="sm">
              Volver al Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex h-[calc(100vh-4rem)] overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Chat Header */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Volver al dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {chatbot.name}
                  </h2>
                  <Badge variant={chatbot.is_active ? 'success' : 'default'} dot={chatbot.is_active} size="sm">
                    {chatbot.is_active ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-400">
                  Playground RAG con Supabase pgvector y citas en tiempo real
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetChat}
              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              title="Reiniciar conversación"
            >
              <span className="hidden sm:inline">Nueva Sesión</span>
            </Button>

            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={sidebarOpen ? 'Ocultar panel lateral' : 'Mostrar panel lateral'}
            >
              {sidebarOpen ? (
                <PanelRightClose className="w-4 h-4" />
              ) : (
                <PanelRightOpen className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3.5 max-w-3xl ${
                msg.sender === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
              } animate-fade-in`}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                  msg.sender === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 border border-indigo-500/30'
                }`}
              >
                {msg.sender === 'user' ? (
                  <User className="w-4 h-4" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
              </div>

              {/* Message Box */}
              <div
                className={`flex-1 space-y-2 rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
                }`}
              >
                {/* Body Text */}
                <p className="whitespace-pre-wrap">{msg.text}</p>

                {/* Bot Metadata: Latency, Tokens, Sources, Feedback */}
                {msg.sender === 'bot' && (msg.response_time_ms !== undefined || (msg.sources && msg.sources.length > 0)) && (
                  <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
                    {/* Performance Chips */}
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                      {msg.response_time_ms !== undefined && (
                        <span className="flex items-center gap-1 font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                          <Clock className="w-3 h-3 text-amber-500" />
                          {Math.round(msg.response_time_ms)} ms
                        </span>
                      )}
                      {msg.tokens_used !== undefined && (
                        <span className="flex items-center gap-1 font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                          <Zap className="w-3 h-3 text-indigo-500" />
                          {msg.tokens_used} tokens
                        </span>
                      )}
                      {msg.precision_at_k && msg.precision_at_k.total_evaluated > 0 && (
                        <span
                          className={`flex items-center gap-1 font-medium px-2 py-0.5 rounded-md border ${
                            msg.precision_at_k.precision >= 0.75
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                              : msg.precision_at_k.precision >= 0.5
                              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                              : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30'
                          }`}
                          title={`Precision@${msg.precision_at_k.k}: ${msg.precision_at_k.relevant_count} fragmentos superaron el umbral de relevancia sobre ${msg.precision_at_k.total_evaluated} evaluados.`}
                        >
                          <Target className="w-3 h-3" />
                          P@{msg.precision_at_k.k}: {Math.round(msg.precision_at_k.precision * 100)}% ({msg.precision_at_k.relevant_count}/{msg.precision_at_k.total_evaluated} rel)
                        </span>
                      )}
                    </div>

                    {/* Sources Accordion */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => toggleSource(msg.id)}
                          className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline focus:outline-none"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>
                            {msg.sources.length} fuente{msg.sources.length === 1 ? '' : 's'} citada
                            {msg.sources.length === 1 ? '' : 's'} (re-ranked)
                          </span>
                          {expandedSources[msg.id] ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {expandedSources[msg.id] && (
                          <div className="mt-2 space-y-2 animate-fade-in">
                            {msg.sources.map((src, idx) => (
                              <div
                                key={idx}
                                className="p-3 rounded-xl bg-slate-100/90 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-xs shadow-sm"
                              >
                                <div className="flex items-center justify-between text-[11px] font-medium text-slate-800 dark:text-slate-200 mb-1.5 gap-2">
                                  <div className="flex items-center gap-1.5 overflow-hidden">
                                    <span className="w-4 h-4 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] flex items-center justify-center shrink-0">
                                      #{src.rank || idx + 1}
                                    </span>
                                    <span className="truncate max-w-[180px] sm:max-w-xs font-mono font-semibold" title={src.source_file || src.document_name}>
                                      📄 {src.source_file || src.document_name}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {src.initial_score !== undefined && (
                                      <span className="text-[10px] text-slate-500 dark:text-slate-400" title="Similitud inicial del vector en Supabase">
                                        base: {(src.initial_score * 100).toFixed(0)}%
                                      </span>
                                    )}
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold text-[10px] border border-emerald-500/20" title="Score combinado tras re-ranking léxico-semántico">
                                      {(src.score * 100).toFixed(1)}% re-ranked
                                    </span>
                                  </div>
                                </div>
                                <blockquote className="italic text-slate-700 dark:text-slate-300 text-[11px] pl-2.5 border-l-2 border-indigo-500/80 leading-relaxed bg-white/50 dark:bg-slate-900/50 p-1.5 rounded-r">
                                  &ldquo;{src.text || src.snippet}&rdquo;
                                </blockquote>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Feedback Rating Widget */}
                    {msg.id !== 'welcome' && (
                      <RatingStars messageId={msg.id} />
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Typing / Processing Indicator */}
          {isSending && (
            <div className="flex gap-3.5 max-w-xl mr-auto animate-fade-in">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 border border-indigo-500/30 flex items-center justify-center text-xs font-bold shrink-0">
                <Sparkles className="w-4 h-4 animate-spin" />
              </div>
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:0.15s]" />
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:0.3s]" />
                <span className="ml-2 font-medium">Buscando vectores y sintetizando respuesta...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex items-center gap-2">
            <input
              type="text"
              placeholder={`Pregúntale algo a ${chatbot.name}...`}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isSending}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={!inputText.trim() || isSending}
              isLoading={isSending}
              className="h-11 px-5"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
          <p className="text-[11px] text-center text-slate-400 mt-2">
            Respuestas generadas con Retrieval-Augmented Generation basándose en la documentación indexada.
          </p>
        </div>
      </div>

      {/* Sidebar: Chatbot Details & Documents */}
      {sidebarOpen && (
        <aside className="w-80 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 overflow-y-auto space-y-6 hidden md:block animate-fade-in">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Información del Asistente
              </h3>
            </div>
            <div className="mt-3 space-y-2">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {chatbot.name}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {chatbot.description || 'Sin descripción.'}
              </p>
            </div>
          </div>

          {/* System Prompt Box */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              System Prompt
            </h4>
            <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-slate-100 leading-relaxed max-h-44 overflow-y-auto shadow-inner">
              {chatbot.system_prompt}
            </div>
          </div>

          {/* Documents Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-indigo-500" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Documentos ({documents.length})
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setUploadModalOpen(true)}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                + Subir
              </button>
            </div>

            {documents.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400">
                No hay documentos subidos aún.
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 text-xs flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                        {doc.file_type}
                      </span>
                      <span className="truncate font-medium text-slate-900 dark:text-slate-100" title={doc.file_name}>
                        {doc.file_name}
                      </span>
                    </div>
                    <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 shrink-0">
                      {doc.chunks_count} chunks
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      )}

      {/* Upload Document Modal */}
      <Modal
        isOpen={uploadModalOpen}
        onClose={() => {
          setUploadModalOpen(false);
          setUploadSuccess(null);
          setSelectedFile(null);
        }}
        title="Subir Documento al Chatbot"
        description={`Los fragmentos vectoriales se indexarán automáticamente en ${chatbot.name}.`}
      >
        <form onSubmit={handleUploadDocument} className="space-y-4">
          {uploadSuccess ? (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              <span>{uploadSuccess}</span>
            </div>
          ) : (
            <div className="space-y-3">
              <input
                type="file"
                accept=".pdf,.docx,.txt,.md"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-950 dark:file:text-indigo-300"
              />
              <p className="text-[11px] text-slate-400">
                Soporta PDF, DOCX, TXT y Markdown. Máximo 10 MB.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setUploadModalOpen(false);
                setUploadSuccess(null);
              }}
            >
              Cerrar
            </Button>
            {!uploadSuccess && (
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={!selectedFile || isUploading}
                isLoading={isUploading}
              >
                Subir y Vectorizar
              </Button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
