import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Search,
  Download,
  CalendarDays,
} from 'lucide-react';
import type { Database } from '../lib/database.types';

type WhatsAppInstance = Database['public']['Tables']['whatsapp_instances']['Row'];

interface ActivityLog {
  id: string;
  instanceName: string;
  action: string;
  status: 'success' | 'error' | 'warning';
  timestamp: string;
  details?: string;
}

function formatRelativeGroupLabel(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00`);
  const today = new Date();
  const utcDate = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const utcToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays = Math.round((utcToday - utcDate) / 86400000);

  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Ontem';

  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
}

function formatDateLabel(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Agora mesmo';
  if (diffMins < 60) return `${diffMins} min atrás`;
  if (diffHours < 24) return `${diffHours}h atrás`;
  if (diffDays < 7) return `${diffDays}d atrás`;

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ClientActivityTab() {
  const { user } = useAuth();
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'warning' | 'error'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showLast7Days, setShowLast7Days] = useState(false);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  async function loadData() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('user_id', user?.id || '')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInstances(data || []);

      const logs: ActivityLog[] = (data || []).map((instance) => ({
        id: instance.id,
        instanceName: instance.name,
        action:
          instance.status === 'connected'
            ? 'Instância conectada'
            : instance.status === 'connecting'
            ? 'Conectando instância'
            : 'Instância desconectada',
        status:
          instance.status === 'connected'
            ? 'success'
            : instance.status === 'connecting'
            ? 'warning'
            : 'error',
        timestamp: instance.updated_at || instance.created_at,
        details: instance.phone_number || undefined,
      }));

      setActivities(logs);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  const summary = useMemo(() => {
    const successCount = activities.filter((activity) => activity.status === 'success').length;
    const warningCount = activities.filter((activity) => activity.status === 'warning').length;
    const errorCount = activities.filter((activity) => activity.status === 'error').length;

    return {
      total: activities.length,
      success: successCount,
      warning: warningCount,
      error: errorCount,
    };
  }, [activities]);

  const filteredActivities = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const now = new Date();

    return activities.filter((activity) => {
      if (filterStatus !== 'all' && activity.status !== filterStatus) {
        return false;
      }

      if (showLast7Days) {
        const activityDate = new Date(activity.timestamp);
        const diffDays = (now.getTime() - activityDate.getTime()) / 86400000;
        if (diffDays > 7) {
          return false;
        }
      }

      if (term) {
        const haystack = `${activity.instanceName} ${activity.action} ${activity.details ?? ''}`.toLowerCase();
        if (!haystack.includes(term)) {
          return false;
        }
      }

      return true;
    });
  }, [activities, filterStatus, searchTerm, showLast7Days]);

  const groupedActivities = useMemo(() => {
    const groups = filteredActivities.reduce<Record<string, ActivityLog[]>>((acc, activity) => {
      const date = new Date(activity.timestamp);
      const dayKey = date.toISOString().split('T')[0];
      if (!acc[dayKey]) {
        acc[dayKey] = [];
      }
      acc[dayKey].push(activity);
      return acc;
    }, {});

    return Object.keys(groups)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
      .map((key) => ({
        key,
        label: formatRelativeGroupLabel(key),
        items: groups[key].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        ),
      }));
  }, [filteredActivities]);

  const getActivityIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-emerald-600" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-rose-600" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-amber-600" />;
      default:
        return <Activity className="w-5 h-5 text-slate-600" />;
    }
  };

  const getActivityColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-emerald-50 border-emerald-200';
      case 'error':
        return 'bg-rose-50 border-rose-200';
      case 'warning':
        return 'bg-amber-50 border-amber-200';
      default:
        return 'bg-slate-50 border-slate-200';
    }
  };

  const handleRefresh = async () => {
    await loadData();
  };

  const handleExport = () => {
    if (filteredActivities.length === 0) {
      return;
    }

    const headers = ['Instância', 'Ação', 'Status', 'Data', 'Detalhes'];
    const rows = filteredActivities.map((activity) => [
      activity.instanceName,
      activity.action,
      activity.status,
      new Date(activity.timestamp).toLocaleString('pt-BR'),
      activity.details ?? '',
    ]);

    const csvContent = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => {
            const value = String(cell ?? '');
            if (value.includes('"') || value.includes(';') || value.includes('\n')) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          })
          .join(';')
      )
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `atividades-evasend-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-lg text-slate-500">Carregando atividades...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Atividades</h2>
          <p className="text-slate-500 mt-1">Histórico de ações das suas instâncias</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow shadow-blue-500/25 hover:shadow-md transition"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-400">Eventos registrados</p>
          <div className="mt-2 flex items-end justify-between">
            <span className="text-3xl font-semibold text-slate-800">{summary.total}</span>
            <Activity className="w-5 h-5 text-blue-500" />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Considera todas as ações registradas pelo sistema.
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-emerald-500">Eventos concluídos</p>
          <div className="mt-2 flex items-end justify-between">
            <span className="text-3xl font-semibold text-emerald-600">{summary.success}</span>
            <CheckCircle className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="mt-2 text-xs text-emerald-600">
            Instâncias conectadas ou com ações finalizadas.
          </p>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-amber-600">Em andamento</p>
          <div className="mt-2 flex items-end justify-between">
            <span className="text-3xl font-semibold text-amber-600">{summary.warning}</span>
            <AlertCircle className="w-5 h-5 text-amber-500" />
          </div>
          <p className="mt-2 text-xs text-amber-600">
            Ações que ainda estão se estabilizando ou aguardam confirmação.
          </p>
        </div>
        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-rose-600">Necessita atenção</p>
          <div className="mt-2 flex items-end justify-between">
            <span className="text-3xl font-semibold text-rose-600">{summary.error}</span>
            <XCircle className="w-5 h-5 text-rose-500" />
          </div>
          <p className="mt-2 text-xs text-rose-600">
            Instâncias desconectadas, expiradas ou com falhas identificadas.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'all', label: 'Todas', color: 'bg-slate-200 text-slate-700' },
              { id: 'success', label: 'Sucesso', color: 'bg-emerald-100 text-emerald-700' },
              { id: 'warning', label: 'Atenção', color: 'bg-amber-100 text-amber-700' },
              { id: 'error', label: 'Erro', color: 'bg-rose-100 text-rose-700' },
            ].map((option) => (
              <button
                key={option.id}
                onClick={() => setFilterStatus(option.id as typeof filterStatus)}
                className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition ${
                  filterStatus === option.id
                    ? 'border-transparent bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow shadow-blue-500/20'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {option.label}
                <span
                  className={`inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-2 text-xs font-semibold ${
                    filterStatus === option.id ? 'bg-white/25 text-white' : option.color
                  }`}
                >
                  {option.id === 'all'
                    ? summary.total
                    : option.id === 'success'
                    ? summary.success
                    : option.id === 'warning'
                    ? summary.warning
                    : summary.error}
                </span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por instância, ação ou número"
                className="h-10 rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-600 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <button
              onClick={() => setShowLast7Days((prev) => !prev)}
              className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition ${
                showLast7Days
                  ? 'border-blue-500 bg-blue-50 text-blue-600'
                  : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'
              }`}
            >
              <CalendarDays className="w-4 h-4" />
              Últimos 7 dias
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
          {filteredActivities.length === activities.length && !showLast7Days && !searchTerm
            ? 'Exibindo todas as atividades registradas para as suas instâncias.'
            : `Exibindo ${filteredActivities.length} de ${activities.length} eventos com os filtros selecionados.`}
        </div>
      </div>

      {activities.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <Activity className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-800 mb-2">Nenhuma atividade registrada</h3>
          <p className="text-slate-500 text-sm">
            As atividades das suas instâncias aparecerão aqui assim que forem registradas.
          </p>
        </div>
      ) : filteredActivities.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <Search className="w-14 h-14 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-800 mb-2">Nenhum resultado com os filtros atuais</h3>
          <p className="text-slate-500 text-sm">
            Ajuste os filtros ou remova a busca para visualizar outras atividades.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedActivities.map((group) => (
            <div key={group.key} className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
                {group.label}
              </div>
              <div className="space-y-3">
                {group.items.map((activity) => (
                  <div
                    key={`${group.key}-${activity.id}-${activity.timestamp}`}
                    className={`bg-white rounded-xl shadow-sm border p-4 ${getActivityColor(activity.status)}`}
                  >
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0 mt-1">
                        {getActivityIcon(activity.status)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{activity.action}</p>
                            <p className="text-sm text-slate-600 mt-1">
                              Instância:{' '}
                              <span className="font-medium text-slate-900">{activity.instanceName}</span>
                            </p>
                            {activity.details && (
                              <p className="text-xs text-slate-500 mt-1">{activity.details}</p>
                            )}
                          </div>
                          <div className="flex items-center rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs text-slate-500">
                            <Clock className="w-3.5 h-3.5 mr-1.5" />
                            <span>{formatDateLabel(activity.timestamp)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
