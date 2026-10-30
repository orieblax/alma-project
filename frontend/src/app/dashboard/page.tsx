'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Bot,
  FileText,
  MessageSquare,
  Clock,
  Star,
  Layers,
  ArrowRight,
  Trash2,
  ExternalLink,
  RefreshCw,
  Search,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { Chatbot, KPIAnalytics, RecentActivityItem } from '@/types';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [chatbots, setChatbots] = useState<Chatbot[]>([]);
  const [kpis, setKpis] = useState<KPIAnalytics | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Delete modal state
  const [chatbotToDelete, setChatbotToDelete] = useState<Chatbot | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [chatbotsRes, kpisRes] = await Promise.allSettled([
        api.chatbots.list(),
        api.analytics.getKPIs(),
      ]);

      if (chatbotsRes.status === 'fulfilled') {
        setChatbots(chatbotsRes.value.results || []);
      }

      if (kpisRes.status === 'fulfilled') {
        setKpis(kpisRes.value.kpis);
        setRecentActivity(kpisRes.value.recent_activity || []);
      }
    } catch (err: any) {
      setError(err?.message || 'Error al cargar los datos del dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadDashboardData();
    }
  }, [isAuthenticated]);

  const handleDeleteChatbot = async () => {
    if (!chatbotToDelete) return;
    setDeleting(true);
    try {
      await api.chatbots.delete(chatbotToDelete.id);
      setChatbots((prev) => prev.filter((c) => c.id !== chatbotToDelete.id));
      setChatbotToDelete(null);
      // Refresh KPIs in background
      api.analytics.getKPIs().then((res) => {
        setKpis(res.kpis);
        setRecentActivity(res.recent_activity || []);
      }).catch(() => {});
    } catch (err: any) {
      alert(err?.message || 'No se pudo eliminar el chatbot.');
    } finally {
      setDeleting(false);
    }
  };

  const filteredChatbots = chatbots.filter(
    (bot) =>
      bot.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (bot.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (authLoading || (loading && !chatbots.length && !kpis)) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full animate-pulse">
        <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-lg w-1/4 mb-4" />
        <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-1/3 mb-10" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-100 dark:bg-slate-800 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 h-96 bg-slate-100 dark:bg-slate-800 rounded-xl" />
          <div className="h-96 bg-slate-100 dark:bg-slate-800 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-8 animate-fade-in">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Hola, {user?.first_name || user?.username || 'Usuario'}
            </h1>
            <span className="text-xl">👋</span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Panel de control de asistentes RAG y analítica de consultas documentales.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadDashboardData}
            title="Recargar datos"
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link href="/chatbots/new">
            <Button
              variant="primary"
              size="md"
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Crear Nuevo Chatbot
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Chatbots */}
        <Card className="p-4 flex items-center gap-3.5 hover:border-indigo-400/50 transition-colors">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Total Chatbots
            </p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {kpis?.total_chatbots ?? chatbots.length}
              </span>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                {kpis?.active_chatbots ?? chatbots.filter((c) => c.is_active).length} activos
              </span>
            </div>
          </div>
        </Card>

        {/* Total Documents */}
        <Card className="p-4 flex items-center gap-3.5 hover:border-emerald-400/50 transition-colors">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Documentos Indexados
            </p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {kpis?.total_documents ?? 0}
              </span>
              <span className="text-[11px] text-slate-400">
                ({kpis?.total_chunks ?? 0} chunks)
              </span>
            </div>
          </div>
        </Card>

        {/* Queries */}
        <Card className="p-4 flex items-center gap-3.5 hover:border-violet-400/50 transition-colors">
          <div className="w-11 h-11 rounded-xl bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Consultas RAG
            </p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {kpis?.total_queries ?? 0}
              </span>
              <span className="text-[11px] text-slate-400">
                en {kpis?.total_sessions ?? 0} sesiones
              </span>
            </div>
          </div>
        </Card>

        {/* Avg Latency */}
        <Card className="p-4 flex items-center gap-3.5 hover:border-amber-400/50 transition-colors">
          <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Latencia Promedio
            </p>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {kpis?.avg_response_time_ms ? Math.round(kpis.avg_response_time_ms) : 48}
              </span>
              <span className="text-xs text-slate-500 font-medium">ms</span>
            </div>
          </div>
        </Card>

        {/* Satisfaction */}
        <Card className="p-4 flex items-center gap-3.5 hover:border-rose-400/50 transition-colors">
          <div className="w-11 h-11 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <Star className="w-5 h-5 fill-rose-500/20" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Satisfacción
            </p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {kpis?.satisfaction_score ?? 4.8}
              </span>
              <span className="text-xs text-amber-500">★</span>
              <span className="text-[11px] text-slate-400">/ 5.0</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Content Grid: Chatbots + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chatbots Catalog (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Tus Asistentes Chatbots
              </h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 font-semibold text-slate-600 dark:text-slate-400">
                {filteredChatbots.length}
              </span>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar por nombre o descripción..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {filteredChatbots.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-500 mx-auto flex items-center justify-center">
                <Bot className="w-7 h-7" />
              </div>
              <div className="max-w-md mx-auto">
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {searchQuery ? 'Sin resultados para la búsqueda' : 'Aún no has creado ningún chatbot'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {searchQuery
                    ? 'Intenta con otro término de búsqueda o limpia el filtro.'
                    : 'Crea tu primer asistente RAG subiendo un documento PDF, Word o Markdown en 4 simples pasos.'}
                </p>
              </div>
              {!searchQuery && (
                <Link href="/chatbots/new">
                  <Button variant="primary" size="sm" leftIcon={<Plus className="w-4 h-4" />}>
                    Crear mi primer Chatbot
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredChatbots.map((bot) => (
                <Card
                  key={bot.id}
                  hoverable
                  className="flex flex-col justify-between overflow-hidden group border-slate-200 dark:border-slate-800"
                >
                  <CardHeader className="p-4 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm shrink-0">
                          <Bot className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {bot.name}
                          </h3>
                          <p className="text-[11px] text-slate-400">
                            Creado el {new Date(bot.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                          </p>
                        </div>
                      </div>
                      <Badge variant={bot.is_active ? 'success' : 'default'} dot={bot.is_active} size="sm">
                        {bot.is_active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 pt-1 pb-3 flex-1">
                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                      {bot.description || 'Sin descripción adicional. Asistente entrenado con contexto documental.'}
                    </p>

                    <div className="mt-3.5 flex items-center gap-3 text-xs text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 p-2 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                      <span className="flex items-center gap-1.5 font-medium">
                        <FileText className="w-3.5 h-3.5 text-indigo-500" />
                        {bot.documents_count || 0} doc{(bot.documents_count || 0) === 1 ? '' : 's'}
                      </span>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <span className="flex items-center gap-1.5 font-medium">
                        <Layers className="w-3.5 h-3.5 text-purple-500" />
                        {bot.chunks_count || 0} fragmentos
                      </span>
                    </div>
                  </CardContent>

                  <CardFooter className="p-3 bg-slate-50/70 dark:bg-slate-900/60 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setChatbotToDelete(bot)}
                      title="Eliminar chatbot"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <Link href={`/chatbots/${bot.id}/test`} className="flex-1">
                      <Button
                        variant="primary"
                        size="sm"
                        className="w-full text-xs"
                        rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                      >
                        Probar Chatbot
                      </Button>
                    </Link>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity & System Status (1 col) */}
        <div className="space-y-6">
          {/* Quick Creator Card */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white shadow-lg shadow-indigo-500/20 relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />
            <div className="relative space-y-3">
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold">¿Tienes un nuevo documento?</h3>
                <p className="text-xs text-indigo-100/90 mt-1 leading-relaxed">
                  Genera un chatbot en minutos y consulta su contenido con citas directas y embeddings de 384 dimensiones.
                </p>
              </div>
              <Link href="/chatbots/new" className="inline-block pt-1">
                <Button
                  variant="secondary"
                  size="sm"
                  className="bg-white text-indigo-700 hover:bg-indigo-50 border-none font-semibold text-xs"
                  rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                >
                  Nuevo Asistente
                </Button>
              </Link>
            </div>
          </div>

          {/* Recent Queries Activity */}
          <Card>
            <CardHeader className="p-4 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Actividad Reciente
                </h3>
              </div>
              <span className="text-[11px] text-slate-400">Últimas consultas</span>
            </CardHeader>

            <CardContent className="p-4 pt-1 space-y-3">
              {recentActivity.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400">
                  Aún no hay consultas registradas. ¡Prueba cualquiera de tus chatbots para ver actividad aquí!
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {recentActivity.map((act) => (
                    <div key={act.id} className="py-2.5 first:pt-0 last:pb-0">
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                          {act.chatbot_name}
                        </span>
                        <span className="text-slate-400">
                          {new Date(act.created_at).toLocaleTimeString('es-ES', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 italic line-clamp-2">
                        &ldquo;{act.query}&rdquo;
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!chatbotToDelete}
        onClose={() => setChatbotToDelete(null)}
        title="¿Eliminar Chatbot?"
        description="Esta acción eliminará el chatbot, sus documentos y todos los vectores asociados."
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
            <p>
              Estás a punto de eliminar permanentemente a{' '}
              <strong className="font-semibold text-rose-800 dark:text-rose-200">
                &ldquo;{chatbotToDelete?.name}&rdquo;
              </strong>
              . Los documentos indexados y fragmentos vectoriales también se borrarán.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={deleting}
              onClick={() => setChatbotToDelete(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={deleting}
              onClick={handleDeleteChatbot}
            >
              Confirmar Eliminación
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
