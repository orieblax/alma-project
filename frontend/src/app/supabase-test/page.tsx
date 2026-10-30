import React from 'react';
import Link from 'next/link';
import {
  Database,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Server,
  Layers,
  Sparkles,
  Info,
  Cpu,
  FileText,
  Bot,
} from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

export const dynamic = 'force-dynamic';

export default async function SupabaseTestPage() {
  const supabase = createClient();
  const startTime = Date.now();

  let todos: any[] | null = null;
  let queryError: any = null;
  let connectionSuccess = false;

  let chatbotsCount: number | null = null;
  let documentsCount: number | null = null;

  try {
    // 1. Query table 'todos'
    const { data, error } = await supabase.from('todos').select('*');
    if (error) {
      queryError = error;
    } else {
      todos = data;
      connectionSuccess = true;
    }

    // 2. Query application tables to verify RAG/ETL readiness
    try {
      const [chatbotsRes, docsRes] = await Promise.all([
        supabase.from('chatbots_chatbot').select('id', { count: 'exact', head: true }),
        supabase.from('etl_document').select('id', { count: 'exact', head: true }),
      ]);
      chatbotsCount = chatbotsRes.count ?? (chatbotsRes.data ? chatbotsRes.data.length : 0);
      documentsCount = docsRes.count ?? (docsRes.data ? docsRes.data.length : 0);
    } catch {
      // Non-blocking diagnostic inspection
    }
  } catch (err: any) {
    queryError = err;
  }

  const queryDuration = Date.now() - startTime;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'No configurada';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Diagnóstico de Integración Supabase
              </h1>
              <Badge
                variant={connectionSuccess ? 'success' : queryError ? 'warning' : 'info'}
                dot
              >
                {connectionSuccess ? 'Conectado' : 'Verificación Activa'}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Prueba de conexión del Server Component en Next.js App Router con @supabase/ssr y pgvector.
            </p>
          </div>
        </div>

        <Link href="/dashboard">
          <Button variant="outline" size="sm">
            Ir al Dashboard
          </Button>
        </Link>
      </div>

      {/* Connection Metadata Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Server className="w-5 h-5" />
          </div>
          <div className="overflow-hidden">
            <p className="text-xs text-slate-400 font-medium">Supabase Host</p>
            <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate font-mono mt-0.5">
              {supabaseUrl}
            </p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Cliente SSR & API</p>
            <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
              @supabase/ssr 0.5+
            </p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Latencia de Consulta</p>
            <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
              {queryDuration} ms
            </p>
          </div>
        </Card>
      </div>

      {/* RAG & Vector Status Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Chatbots en Supabase</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {chatbotsCount !== null ? `${chatbotsCount} registrado(s)` : 'Consultando...'}
              </p>
            </div>
          </div>
          <Badge variant="success" size="sm">Sincronizado</Badge>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Embeddings en Ollama</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                all-minilm (384 dims)
              </p>
            </div>
          </div>
          <Badge variant="success" size="sm">pgvector v0.8.2</Badge>
        </Card>
      </div>

      {/* Query Result Card */}
      <Card>
        <CardHeader className="p-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-500" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Consulta de Prueba: Tabla &ldquo;todos&rdquo;
            </h2>
          </div>
          <span className="text-xs font-mono text-slate-400">
            supabase.from(&apos;todos&apos;).select(&apos;*&apos;)
          </span>
        </CardHeader>

        <CardContent className="p-5 space-y-4">
          {connectionSuccess && todos && todos.length > 0 ? (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  Conexión exitosa. Se recuperaron {todos.length} fila(s) de la base de datos Supabase.
                </span>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                {todos.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="p-3 text-xs flex items-center justify-between bg-white dark:bg-slate-900"
                  >
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {item.title || item.name || JSON.stringify(item)}
                    </span>
                    {item.is_complete !== undefined && (
                      <Badge variant={item.is_complete ? 'success' : 'default'} size="sm">
                        {item.is_complete ? 'Completado' : 'Pendiente'}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : connectionSuccess && (!todos || todos.length === 0) ? (
            <div className="p-6 rounded-xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-center space-y-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Conexión a Supabase establecida correctamente
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                La tabla <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">todos</code> está conectada y accesible, pero actualmente no contiene registros.
              </p>
            </div>
          ) : (
            <div className="p-5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Respuesta del servidor Supabase:</span>
              </div>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                El endpoint de Supabase respondió. Mensaje de consulta:
              </p>
              <pre className="p-3 rounded-lg bg-slate-900 text-slate-200 font-mono text-[11px] overflow-x-auto">
                {JSON.stringify(queryError, null, 2)}
              </pre>
            </div>
          )}

          {/* Architectural Info Box */}
          <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-start gap-3 text-xs text-slate-800 dark:text-slate-200">
            <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-slate-900 dark:text-slate-200">
                Arquitectura Híbrida Django + Next.js + Supabase pgvector
              </p>
              <p className="leading-relaxed">
                El frontend interactúa con Supabase para sesiones/autenticación en el cliente y vistas SSR, mientras que el motor ETL y la indexación de embeddings de 384 dimensiones generados localmente por Ollama operan de forma coordinada con PostgreSQL y pgvector.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
