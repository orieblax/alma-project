import Link from 'next/link';
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
  FileText,
  Database,
  BarChart3,
  Bot,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function HomePage() {
  return (
    <div className="relative overflow-hidden bg-grid-pattern min-h-[calc(100vh-4rem)] flex flex-col justify-center">
      {/* Glow Effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 blur-[100px] pointer-events-none rounded-full" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-indigo-200/60 dark:border-indigo-800/60 bg-indigo-50/50 dark:bg-indigo-950/40 text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-8 animate-fade-in">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          <span>Motor RAG de Nueva Generación</span>
          <span className="w-1 h-1 rounded-full bg-indigo-500" />
          <span className="font-normal text-slate-500 dark:text-slate-400">
            pgvector 384-dim & Citas Verificables
          </span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white max-w-4xl mx-auto leading-[1.15]">
          Convierte tus documentos en{' '}
          <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-400 bg-clip-text text-transparent">
            asistentes inteligentes
          </span>{' '}
          con respuestas precisas
        </h1>

        {/* Hero Description */}
        <p className="mt-6 text-lg sm:text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
          Carga PDFs, archivos Word, Markdown o texto plano. Alma Project procesa,
          vectoriza y responde con citas textuales directas, latencia optimizada y
          trazabilidad completa.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/register">
            <Button
              size="lg"
              variant="primary"
              rightIcon={<ArrowRight className="w-4 h-4" />}
              className="w-full sm:w-auto px-8"
            >
              Comenzar Gratis
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button
              size="lg"
              variant="outline"
              leftIcon={<Bot className="w-4 h-4" />}
              className="w-full sm:w-auto px-6"
            >
              Explorar Dashboard
            </Button>
          </Link>
        </div>

        {/* Architecture Badges */}
        <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
          <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-3">
              <FileText className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Pipeline ETL Multi-formato
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Lectura y fragmentación semántica de PDF, DOCX, TXT y MD con chunks solapados.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-3">
              <Database className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Vectores 384 Dimensiones
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Búsqueda por similitud de coseno precisa respaldada por Supabase pgvector.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-3">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Citas Verificables
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Visualiza el documento de origen, porcentaje de similitud y fragmento citado.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-3">
              <BarChart3 className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Métricas & Feedback
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Control de milisegundos de latencia, tokens consumidos y calificación 1-5 estrellas.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
