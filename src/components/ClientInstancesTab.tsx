import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { whatsappApi } from '../services/whatsapp';
import {
  MessageCircle,
  Plus,
  Trash2,
  Power,
  PowerOff,
  QrCode,
  RefreshCw,
  ShieldCheck,
  WifiOff,
  Search,
  Link,
} from 'lucide-react';
import type { Database } from '../lib/database.types';
import ToastContainer, { type ToastMessage } from './ToastContainer';
import ConfirmDialog from './ConfirmDialog';

type WhatsAppInstance = Database['public']['Tables']['whatsapp_instances']['Row'];

interface ConfirmState {
  show: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  type?: 'danger' | 'warning';
}

interface ClientInstancesTabProps {
  openCreate?: boolean;
  onCloseCreate?: () => void;
}

export default function ClientInstancesTab({ openCreate = false, onCloseCreate }: ClientInstancesTabProps) {
  const { user, profile } = useAuth();
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<WhatsAppInstance | null>(null);
  const [instanceName, setInstanceName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [showDisconnectOption, setShowDisconnectOption] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmState>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });
  const [filterStatus, setFilterStatus] = useState<'all' | 'connected' | 'connecting' | 'disconnected'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const summary = useMemo(() => {
    const connected = instances.filter((instance) => instance.status === 'connected').length;
    const connecting = instances.filter((instance) => instance.status === 'connecting').length;
    const disconnected = instances.filter((instance) => instance.status === 'disconnected').length;
    const limit = profile?.max_instances ?? 0;
    const usagePercent = limit > 0 ? Math.min(100, Math.round((instances.length / limit) * 100)) : null;
    const available = limit > 0 ? Math.max(0, limit - instances.length) : null;

    return {
      total: instances.length,
      connected,
      connecting,
      disconnected,
      limit,
      available,
      usagePercent,
    };
  }, [instances, profile]);

  const filteredInstances = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return instances.filter((instance) => {
      if (filterStatus !== 'all' && instance.status !== filterStatus) {
        return false;
      }

      if (term) {
        const haystack = `${instance.name ?? ''} ${instance.phone_number ?? ''}`.toLowerCase();
        if (!haystack.includes(term)) {
          return false;
        }
      }

      return true;
    });
  }, [instances, filterStatus, searchTerm]);

  useEffect(() => {
    if (openCreate) {
      setShowCreateModal(true);
    }
  }, [openCreate]);

  const showToast = (message: string, type: 'success' | 'error' | 'warning') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setInstanceName('');
    onCloseCreate?.();
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void, type: 'danger' | 'warning' = 'danger') => {
    setConfirmDialog({ show: true, title, message, onConfirm, type });
  };

  const hideConfirm = () => {
    setConfirmDialog({ show: false, title: '', message: '', onConfirm: () => {} });
  };

  const handleCopyToken = async (token?: string | null) => {
    if (!token) {
      showToast('Token indisponível para esta instância', 'warning');
      return;
    }

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(token);
        showToast('Token copiado para a área de transferência', 'success');
      } else {
        throw new Error('Clipboard API não suportada');
      }
    } catch (error) {
      console.error('Erro ao copiar token:', error);
      showToast('Não foi possível copiar o token', 'error');
    }
  };

  useEffect(() => {
    if (user) {
      loadInstances();
    }
  }, [user]);

  function extractPhoneNumber(status: any): string | null {
    // Tenta extrair do jid primeiro (formato: "554799967404:70@s.whatsapp.net")
    const jid = status?.status?.jid;
    if (jid && typeof jid === 'string') {
      const match = jid.match(/^(\d+):/);
      if (match && match[1]) {
        return match[1];
      }
    }

    // Tenta usar o owner (número sem código do país)
    const owner = status?.instance?.owner;
    if (owner && typeof owner === 'string') {
      return owner;
    }

    return null;
  }

  async function loadInstances() {
    try {
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('user_id', user?.id || '')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInstances(data || []);

      if (selectedInstance) {
        const updatedInstance = data?.find(inst => inst.id === selectedInstance.id);
        if (updatedInstance) {
          setSelectedInstance(updatedInstance);
        }
      }

      // Atualizar números de telefone para instâncias conectadas sem número
      if (data) {
        const instancesToUpdate = data.filter(
          (inst) => inst.status === 'connected' && !inst.phone_number && inst.instance_token
        );

        for (const inst of instancesToUpdate) {
          try {
            const status = await whatsappApi.getInstanceStatus(inst.instance_token!);
            const phoneNumber = extractPhoneNumber(status);

            if (phoneNumber) {
              await supabase
                .from('whatsapp_instances')
                .update({ phone_number: phoneNumber })
                .eq('id', inst.id);
            }
          } catch (error) {
            console.error(`Erro ao buscar número da instância ${inst.id}:`, error);
          }
        }

        // Recarregar instâncias após atualizar números
        if (instancesToUpdate.length > 0) {
          const { data: updatedData } = await supabase
            .from('whatsapp_instances')
            .select('*')
            .eq('user_id', user?.id || '')
            .order('created_at', { ascending: false });

          if (updatedData) {
            setInstances(updatedData);
          }
        }
      }
    } catch (error) {
      console.error('Error loading instances:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateInstance() {
    if (!instanceName.trim()) {
      showToast('Por favor, insira um nome para a instância', 'warning');
      return;
    }

    if (instances.length >= (profile?.max_instances || 0)) {
      showToast(`Você atingiu o limite de ${profile?.max_instances} instâncias`, 'warning');
      return;
    }

    setCreating(true);
    try {
      const response = await whatsappApi.createInstance(instanceName);

      if (response.token) {
        const { error } = await supabase
          .from('whatsapp_instances')
          .insert({
            user_id: user?.id || '',
            name: instanceName,
            instance_token: response.token,
            system_name: 'apilocal',
            status: response.connected ? 'connected' : 'disconnected',
          });

        if (error) throw error;

        showToast('Instância criada com sucesso!', 'success');
        closeCreateModal();
        await loadInstances();
      } else {
        throw new Error('API não retornou token de instância');
      }
    } catch (error: any) {
      console.error('Error creating instance:', error);
      showToast(error.message || 'Erro ao criar instância', 'error');
    } finally {
      setCreating(false);
    }
  }

  async function handleConnectInstance() {
    if (!selectedInstance?.instance_token) return;

    if (selectedInstance.status !== 'disconnected') {
      showToast('A instância precisa estar desconectada para conectar novamente', 'error');
      return;
    }

    setShowDisconnectOption(false);
    setIsConnecting(true);

    try {
      const response = await whatsappApi.connectInstance(
        selectedInstance.instance_token,
        phoneNumber || undefined
      );

      await supabase
        .from('whatsapp_instances')
        .update({
          status: 'connecting',
          phone_number: phoneNumber || null,
        })
        .eq('id', selectedInstance.id);

      await loadInstances();

      if (response.qrCode || response.pairingCode || response.code) {
        const qr = response.qrCode || response.qr || null;
        const code = response.pairingCode || response.code || null;

        if (qr) {
          setQrCode(qr);
          setPairingCode('');
          await supabase
            .from('whatsapp_instances')
            .update({ qr_code: qr })
            .eq('id', selectedInstance.id);
        } else if (code) {
          setPairingCode(code);
          setQrCode('');
          await supabase
            .from('whatsapp_instances')
            .update({ pairing_code: code })
            .eq('id', selectedInstance.id);
        }
      }

      startStatusPolling(selectedInstance);

    } catch (error: any) {
      setIsConnecting(false);

      if (error.message && error.message.includes('já está conectada')) {
        setShowDisconnectOption(true);
      }

      showToast(error.message || 'Erro ao conectar instância', 'error');
    }
  }

  async function handleForceDisconnect() {
    if (!selectedInstance?.instance_token) return;

    try {
      await whatsappApi.logoutInstance(selectedInstance.instance_token);

      await supabase
        .from('whatsapp_instances')
        .update({
          status: 'disconnected',
          qr_code: null,
          pairing_code: null,
        })
        .eq('id', selectedInstance.id);

      setShowDisconnectOption(false);
      setQrCode('');
      setPairingCode('');
      showToast('Instância desconectada! Agora você pode tentar conectar novamente.', 'success');
      loadInstances();
    } catch (error: any) {
      console.error('Error force disconnecting:', error);
      showToast(error.message || 'Erro ao desconectar instância', 'error');
    }
  }

  function startStatusPolling(instance: WhatsAppInstance) {
    let pollCount = 0;

    const interval = setInterval(async () => {
      if (!instance.instance_token) return;
      pollCount++;

      try {
        const status = await whatsappApi.getInstanceStatus(instance.instance_token);

        const instanceData = (status as any).instance;
        const statusData = (status as any).status;
        const isConnected = statusData?.loggedIn === true;
        const qrCodeFromApi = instanceData?.qrcode || status.qrCode;
        const pairingCodeFromApi = instanceData?.paircode || status.pairingCode;
        const phoneNumber = extractPhoneNumber(status);

        if (isConnected) {
          await supabase
            .from('whatsapp_instances')
            .update({
              status: 'connected',
              qr_code: null,
              pairing_code: null,
              phone_number: phoneNumber || instance.phone_number || null,
              profile_data: status.profile || instanceData || null,
            })
            .eq('id', instance.id);

          clearInterval(interval);
          setShowConnectModal(false);
          setQrCode('');
          setPairingCode('');
          setIsConnecting(false);
          loadInstances();
          showToast('Instância conectada com sucesso!', 'success');
        } else if (qrCodeFromApi && qrCodeFromApi.trim() !== '') {
          setQrCode(qrCodeFromApi);
          setIsConnecting(false);
          await supabase
            .from('whatsapp_instances')
            .update({ qr_code: qrCodeFromApi })
            .eq('id', instance.id);
        } else if (pairingCodeFromApi && pairingCodeFromApi.trim() !== '') {
          setPairingCode(pairingCodeFromApi);
          setIsConnecting(false);
          await supabase
            .from('whatsapp_instances')
            .update({ pairing_code: pairingCodeFromApi })
            .eq('id', instance.id);
        }
      } catch (error) {
        console.error('Erro no polling:', error);
      }
    }, 3000);

    setTimeout(async () => {
      clearInterval(interval);
      setIsConnecting(false);
      setQrCode('');
      setPairingCode('');

      await supabase
        .from('whatsapp_instances')
        .update({
          status: 'disconnected',
          qr_code: null,
          pairing_code: null,
        })
        .eq('id', instance.id);

      await loadInstances();
      showToast('Tempo de conexão expirado. Tente conectar novamente.', 'warning');
    }, 300000);
  }

  function handleDisconnectInstance(instance: WhatsAppInstance) {
    if (!instance.instance_token) return;

    showConfirm(
      'Desconectar Instância',
      'Tem certeza que deseja desconectar esta instância?',
      async () => {
        hideConfirm();
        try {
          await whatsappApi.disconnectInstance(instance.instance_token!);

          await supabase
            .from('whatsapp_instances')
            .update({
              status: 'disconnected',
              qr_code: null,
              pairing_code: null,
            })
            .eq('id', instance.id);

          loadInstances();
          showToast('Instância desconectada com sucesso!', 'success');
        } catch (error) {
          console.error('Error disconnecting instance:', error);
          showToast('Erro ao desconectar instância', 'error');
        }
      },
      'warning'
    );
  }

  async function handleCancelConnection(instance: WhatsAppInstance) {
    if (!instance.instance_token) return;

    try {
      await whatsappApi.disconnectInstance(instance.instance_token);

      await supabase
        .from('whatsapp_instances')
        .update({
          status: 'disconnected',
          qr_code: null,
          pairing_code: null,
        })
        .eq('id', instance.id);

      setShowConnectModal(false);
      setSelectedInstance(null);
      setQrCode('');
      setPairingCode('');
      setPhoneNumber('');
      setShowDisconnectOption(false);
      setIsConnecting(false);

      await loadInstances();
      showToast('Conexão cancelada com sucesso!', 'success');
    } catch (error) {
      console.error('Error canceling connection:', error);
      showToast('Erro ao cancelar conexão', 'error');
    }
  }

  function handleDeleteInstance(instance: WhatsAppInstance) {
    showConfirm(
      'Excluir Instância',
      'Tem certeza que deseja excluir esta instância? Esta ação não pode ser desfeita.',
      async () => {
        hideConfirm();
        try {
          if (instance.instance_token && instance.status !== 'disconnected') {
            await whatsappApi.disconnectInstance(instance.instance_token);
          }

          if (instance.instance_token) {
            await whatsappApi.deleteInstance(instance.instance_token);
          }

          const { error } = await supabase
            .from('whatsapp_instances')
            .delete()
            .eq('id', instance.id);

          if (error) throw error;

          loadInstances();
          showToast('Instância excluída com sucesso!', 'success');
        } catch (error) {
          console.error('Error deleting instance:', error);
          showToast('Erro ao excluir instância', 'error');
        }
      },
      'danger'
    );
  }

  function openConnectModal(instance: WhatsAppInstance) {
    setSelectedInstance(instance);
    setPhoneNumber('');
    setQrCode(instance.qr_code || '');
    setPairingCode(instance.pairing_code || '');
    setShowConnectModal(true);

    if (instance.status === 'connecting') {
      setIsConnecting(true);
      if (instance.instance_token) {
        startStatusPolling(instance);
      }
    } else {
      setIsConnecting(false);
    }
  }

  const getStatusBadge = (status: string) => {
    const config = {
      connected: {
        label: 'Conectado',
        classes: 'border border-emerald-200 bg-emerald-50 text-emerald-600',
        icon: ShieldCheck,
      },
      connecting: {
        label: 'Conectando',
        classes: 'border border-amber-200 bg-amber-50 text-amber-600',
        icon: RefreshCw,
      },
      disconnected: {
        label: 'Desconectado',
        classes: 'border border-slate-200 bg-slate-100 text-slate-500',
        icon: WifiOff,
      },
    } as const;

    const badge = config[status as keyof typeof config] ?? config.disconnected;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${badge.classes}`}>
        <Icon className="h-3.5 w-3.5" />
        {badge.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-lg text-gray-600">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-slate-200 bg-white px-6 py-8 shadow-sm">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl space-y-3">
            <p className="text-sm uppercase tracking-[0.35em] text-slate-400">Minhas Instâncias</p>
            <h1 className="text-3xl font-semibold leading-tight text-slate-900">Gerencie suas conexões WhatsApp</h1>
            <p className="text-sm text-slate-500">
              Conecte, desconecte e monitore cada instância em tempo real. As métricas completas continuam disponíveis no Dashboard.
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={summary.limit !== null && summary.limit !== undefined && summary.limit > 0 && summary.total >= summary.limit}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow shadow-emerald-400/25 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            Nova Instância
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Todas', value: 'all' },
            { label: 'Conectadas', value: 'connected' },
            { label: 'Conectando', value: 'connecting' },
            { label: 'Desconectadas', value: 'disconnected' },
          ].map((filter) => (
            <button
              key={filter.value}
              onClick={() => setFilterStatus(filter.value as typeof filterStatus)}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
                filterStatus === filter.value
                  ? 'border-slate-800 bg-slate-900 text-white shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar por nome ou número"
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
          />
        </div>
      </div>

      {filteredInstances.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white/60 py-16 text-center shadow-inner">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900/90 text-white shadow-lg shadow-slate-900/20">
            <MessageCircle className="h-7 w-7" />
          </div>
          <h3 className="mt-6 text-xl font-semibold text-slate-900">Nenhuma instância encontrada</h3>
          <p className="mt-2 text-sm text-slate-500">
            {instances.length === 0
              ? 'Crie sua primeira instância para começar a enviar mensagens.'
              : 'Ajuste os filtros ou busque por outro termo.'}
          </p>
          <button
            onClick={() => {
              if (instances.length === 0) {
                setShowCreateModal(true);
              } else {
                setFilterStatus('all');
                setSearchTerm('');
              }
            }}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow shadow-slate-800/30 transition hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            {instances.length === 0 ? 'Criar instância agora' : 'Limpar filtros'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredInstances.map((instance) => (
            <div
              key={instance.id}
              className="group flex h-full flex-col justify-between rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Instância
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">{instance.name}</h3>
                  <div className="text-sm text-slate-500">
                    {instance.phone_number ? (
                      <span className="inline-flex items-center gap-2">
                        {instance.phone_number}
                        <button
                          onClick={() => handleCopyToken(instance.instance_token)}
                          className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                          type="button"
                        >
                          Copiar token
                        </button>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-slate-500">
                        <Link className="h-4 w-4" />
                        Sem número vinculado
                      </span>
                    )}
                  </div>
                </div>
                {getStatusBadge(instance.status)}
              </div>

              <div className="mt-6 space-y-3 text-sm text-slate-600">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Token da instância</p>
                  <p className="mt-2 truncate font-mono text-xs text-slate-600">
                    {instance.instance_token ?? '—'}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {instance.status === 'disconnected' && (
                    <button
                      onClick={() => openConnectModal(instance)}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-600 transition hover:bg-emerald-100"
                    >
                      <Power className="h-4 w-4" />
                      Conectar
                    </button>
                  )}

                  {instance.status === 'connecting' && (
                    <>
                      <button
                        onClick={() => openConnectModal(instance)}
                        className="inline-flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-600 transition hover:bg-amber-100"
                      >
                        <QrCode className="h-4 w-4" />
                        Ver QR/Pareamento
                      </button>
                      <button
                        onClick={() => handleCancelConnection(instance)}
                        className="inline-flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-100"
                      >
                        <PowerOff className="h-4 w-4" />
                        Cancelar
                      </button>
                    </>
                  )}

                  {instance.status === 'connected' && (
                    <button
                      onClick={() => handleDisconnectInstance(instance)}
                      className="inline-flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-100"
                    >
                      <PowerOff className="h-4 w-4" />
                      Desconectar
                    </button>
                  )}

                  <button
                    onClick={() => handleDeleteInstance(instance)}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-200"
                  >
                    <Trash2 className="h-4 w-4" />
                    Excluir
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">Nova Instância</h3>
            </div>

            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nome da Instância
              </label>
              <input
                type="text"
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Ex: WhatsApp Vendas"
              />
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={closeCreateModal}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateInstance}
                disabled={creating}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Criando...' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showConnectModal && selectedInstance && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">
                Conectar: {selectedInstance.name}
              </h3>
            </div>

            <div className="p-6 space-y-4">
              {isConnecting && !qrCode && !pairingCode && (
                <div className="text-center py-8">
                  <RefreshCw className="w-12 h-12 text-green-500 animate-spin mx-auto mb-4" />
                  <p className="text-lg font-semibold text-gray-900 mb-2">Aguardando QR Code...</p>
                  <p className="text-sm text-gray-600">A API está gerando o código de conexão</p>
                </div>
              )}

              {!isConnecting && !qrCode && !pairingCode && (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <h4 className="font-semibold text-blue-900 mb-2">Escolha o método de conexão:</h4>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• <strong>QR Code:</strong> Deixe o campo em branco e clique em "Conectar"</li>
                      <li>• <strong>Código de Pareamento:</strong> Digite seu número de telefone completo</li>
                    </ul>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Número de Telefone (opcional)
                    </label>
                    <input
                      type="text"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="5511999999999"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      Formato: código do país + DDD + número (sem espaços ou caracteres especiais)
                    </p>
                  </div>
                </>
              )}

              {qrCode && (
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-4">
                    Escaneie o QR Code no WhatsApp do seu celular
                  </p>
                  <img src={qrCode} alt="QR Code" className="mx-auto border rounded-lg" />
                  <p className="text-xs text-gray-500 mt-4">
                    O QR Code será atualizado automaticamente
                  </p>
                </div>
              )}

              {pairingCode && (
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-4">
                    Código de pareamento
                  </p>
                  <div className="bg-gray-100 rounded-lg p-6">
                    <p className="text-3xl font-bold text-gray-900 tracking-widest">
                      {pairingCode}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 mt-4">
                    Insira este código no WhatsApp do seu celular
                  </p>
                </div>
              )}

              {showDisconnectOption && !qrCode && !pairingCode && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800 mb-3">
                    A instância já está em uso. Desconecte primeiro para conectar novamente.
                  </p>
                  <button
                    onClick={handleForceDisconnect}
                    className="w-full px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors"
                  >
                    Desconectar Instância
                  </button>
                </div>
              )}

            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowConnectModal(false);
                  setSelectedInstance(null);
                  setQrCode('');
                  setPairingCode('');
                  setPhoneNumber('');
                  setShowDisconnectOption(false);
                  setIsConnecting(false);
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Fechar
              </button>
              {!qrCode && !pairingCode && !showDisconnectOption && (
                <button
                  onClick={handleConnectInstance}
                  disabled={isConnecting}
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isConnecting ? 'Conectando...' : 'Conectar'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {confirmDialog.show && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={hideConfirm}
          type={confirmDialog.type}
        />
      )}
    </div>
  );
}
