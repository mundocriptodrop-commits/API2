import { useState, useEffect, useMemo } from 'react';
import type { MouseEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Smartphone,
  Activity as ActivityIcon,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Search,
  Plus,
  Power,
  Copy,
  Check,
} from 'lucide-react';
import type { Database } from '../lib/database.types';

type WhatsAppInstance = Database['public']['Tables']['whatsapp_instances']['Row'];

interface ClientDashboardTabProps {
  onRequestCreateInstance?: () => void;
}

export default function ClientDashboardTab({ onRequestCreateInstance }: ClientDashboardTabProps) {
  const { user, profile } = useAuth();
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'connected' | 'connecting' | 'disconnected'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadInstances();
    }
  }, [user]);

  async function loadInstances() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('user_id', user?.id || '')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInstances(data || []);
    } catch (error) {
      console.error('Error loading instances:', error);
    } finally {
      setLoading(false);
    }
  }

  const summary = useMemo(() => {
    const connected = instances.filter((i) => i.status === 'connected').length;
    const connecting = instances.filter((i) => i.status === 'connecting').length;
    const disconnected = instances.filter((i) => i.status === 'disconnected').length;
    const limit = profile?.max_instances ?? 0;
    const usage = limit > 0 ? Math.round((instances.length / limit) * 100) : 0;

    return {
      total: instances.length,
      connected,
      connecting,
      disconnected,
      limit,
      usage: Number.isFinite(usage) ? usage : 0,
    };
  }, [instances, profile]);

  const filteredInstances = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return instances.filter((instance) => {
      if (filterStatus !== 'all' && instance.status !== filterStatus) {
        return false;
      }

      if (term) {
        const haystack = `${instance.name} ${instance.phone_number ?? ''}`.toLowerCase();
        if (!haystack.includes(term)) {
          return false;
        }
      }

      return true;
    });
  }, [instances, filterStatus, searchTerm]);

  useEffect(() => {
    if (!openActionsId) return;

    const close = () => setOpenActionsId(null);
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenActionsId(null);
      }
    };

    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [openActionsId]);

  const handleRefresh = async () => {
    setOpenActionsId(null);
    await loadInstances();
  };

  const handleToggleActions = (event: MouseEvent<HTMLButtonElement>, id: string) => {
    event.stopPropagation();
    setOpenActionsId((prev) => (prev === id ? null : id));
  };

  const handleCopy = async (value: string | null | undefined, id: string, type: 'token' | 'id') => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(`${id}-${type}`);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (error) {
      console.error('Erro ao copiar valor:', error);
    }
  };

  const getStatusBadge = (status: WhatsAppInstance['status']) => {
    switch (status) {
      case 'connected':
        return 'bg-emerald-100 text-emerald-700';
      case 'connecting':
        return 'bg-amber-100 text-amber-700';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  };

  const getStatusLabel = (status: WhatsAppInstance['status']) => {
    switch (status) {
      case 'connected':
        return 'Conectada';
      case 'connecting':
        return 'Conectando';
      default:
        return 'Desconectada';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-lg text-slate-500">Carregando suas instâncias...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Dashboard</h2>
          <p className="text-slate-500 mt-1">Visão geral e status das suas instâncias conectadas.</p>
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
            onClick={() => {
              setOpenActionsId(null);
              onRequestCreateInstance?.();
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow shadow-blue-500/25 hover:shadow-md transition"
          >
            <Plus className="w-4 h-4" />
            Nova Instância
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-400">Total de instâncias</p>
          <div className="mt-2 flex items-end justify-between">
            <span className="text-3xl font-semibold text-slate-800">{summary.total}</span>
            <Smartphone className="w-5 h-5 text-blue-500" />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Limite contratado: {summary.limit || '—'} instâncias
          </p>
          <div className="mt-3">
            <div className="h-2 w-full rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all"
                style={{ width: `${Math.min(summary.usage, 100)}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] uppercase tracking-[0.3em] text-slate-400">
              {summary.usage}% do limite utilizado
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-emerald-500">Instâncias conectadas</p>
          <div className="mt-2 flex items-end justify-between">
            <span className="text-3xl font-semibold text-emerald-600">{summary.connected}</span>
            <CheckCircle className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="mt-2 text-xs text-emerald-600">
            Sessões aprovadas e respondendo normalmente.
          </p>
        </div>

        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-amber-600">Conectando agora</p>
          <div className="mt-2 flex items-end justify-between">
            <span className="text-3xl font-semibold text-amber-600">{summary.connecting}</span>
            <ActivityIcon className="w-5 h-5 text-amber-500" />
          </div>
          <p className="mt-2 text-xs text-amber-600">
            Instâncias aguardando confirmação de pareamento.
          </p>
        </div>

        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-rose-600">Necessitam ação</p>
          <div className="mt-2 flex items-end justify-between">
            <span className="text-3xl font-semibold text-rose-600">{summary.disconnected}</span>
            <XCircle className="w-5 h-5 text-rose-500" />
          </div>
          <p className="mt-2 text-xs text-rose-600">
            Refaça o login ou verifique a sessão no dispositivo.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'all', label: 'Todas', color: 'bg-slate-200 text-slate-700' },
              { id: 'connected', label: 'Conectadas', color: 'bg-emerald-100 text-emerald-700' },
              { id: 'connecting', label: 'Conectando', color: 'bg-amber-100 text-amber-700' },
              { id: 'disconnected', label: 'Desconectadas', color: 'bg-rose-100 text-rose-700' },
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
                    : option.id === 'connected'
                    ? summary.connected
                    : option.id === 'connecting'
                    ? summary.connecting
                    : summary.disconnected}
                </span>
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome ou número da instância"
              className="h-10 rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-600 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
          {filteredInstances.length === instances.length && !searchTerm
            ? 'Exibindo todas as instâncias cadastradas.'
            : `Exibindo ${filteredInstances.length} de ${instances.length} instâncias com os filtros aplicados.`}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Instâncias recentes</h3>
            <p className="text-sm text-slate-500">
              Sessões criadas ou atualizadas nos últimos acessos.
            </p>
          </div>
          <span className="text-xs uppercase tracking-[0.3em] text-slate-400">
            {filteredInstances.length} instâncias listadas
          </span>
        </div>

        {instances.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 py-12 text-center">
            <Smartphone className="w-12 h-12 text-slate-300 mb-3" />
            <h4 className="text-base font-semibold text-slate-700 mb-1">
              Nenhuma instância encontrada
            </h4>
            <p className="text-sm text-slate-500 max-w-sm">
              Crie uma instância para começar a enviar mensagens e acompanhar o status por aqui.
            </p>
          </div>
        ) : filteredInstances.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 py-12 text-center">
            <Search className="w-12 h-12 text-slate-300 mb-3" />
            <h4 className="text-base font-semibold text-slate-700 mb-1">
              Nenhum resultado com os filtros atuais
            </h4>
            <p className="text-sm text-slate-500 max-w-sm">
              Ajuste os filtros ou limpe a busca para ver outras instâncias.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredInstances.slice(0, 8).map((instance) => {
              const updatedAt = instance.updated_at ?? instance.created_at ?? '';
              return (
                <div
                  key={instance.id}
                  className="relative flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 shadow-sm transition hover:bg-slate-50 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/20">
                      <Smartphone className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{instance.name}</p>
                      <p className="text-sm text-slate-500">
                        {instance.phone_number ?? 'Sem número configurado'}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Atualizada em {updatedAt ? new Date(updatedAt).toLocaleString('pt-BR') : '—'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col-reverse gap-3 md:flex-row md:items-center md:gap-4">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadge(instance.status)}`}
                    >
                      {getStatusLabel(instance.status)}
                    </span>
                    <div className="relative">
                      <button
                        onMouseDown={(event) => event.stopPropagation()}
                        onClick={(event) => handleToggleActions(event, instance.id)}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition"
                      >
                        <Power className="w-3.5 h-3.5" />
                        Ações rápidas
                      </button>
                      {openActionsId === instance.id && (
                        <div
                          onMouseDown={(event) => event.stopPropagation()}
                          onClick={(event) => event.stopPropagation()}
                          className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-500/10"
                        >
                          <p className="px-2 pb-2 text-[11px] uppercase tracking-[0.32em] text-slate-400">
                            Atalhos
                          </p>
                          <div className="space-y-1">
                            <button
                              type="button"
                              onClick={() => handleCopy(instance.instance_token, instance.id, 'token')}
                              disabled={!instance.instance_token}
                              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <span>Copiar token</span>
                              {copiedKey === `${instance.id}-token` ? (
                                <Check className="w-4 h-4 text-emerald-500" />
                              ) : (
                                <Copy className="w-4 h-4 text-slate-400" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopy(instance.id, instance.id, 'id')}
                              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-100"
                            >
                              <span>Copiar ID da instância</span>
                              {copiedKey === `${instance.id}-id` ? (
                                <Check className="w-4 h-4 text-emerald-500" />
                              ) : (
                                <Copy className="w-4 h-4 text-slate-400" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setOpenActionsId(null);
                                window.open(
                                  'mailto:suporte@evasend.com.br?subject=Ajuda com instância&body=Olá, preciso de suporte para a instância ' +
                                    encodeURIComponent(instance.name),
                                  '_blank'
                                );
                              }}
                              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-100"
                            >
                              <span>Solicitar suporte</span>
                              <AlertCircle className="w-4 h-4 text-amber-500" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
