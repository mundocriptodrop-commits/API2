import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { whatsappApi } from '../services/whatsapp';
import { MessageCircle, Plus, Trash2, Power, PowerOff, QrCode, RefreshCw } from 'lucide-react';
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

  useEffect(() => {
    if (user) {
      loadInstances();
    }
  }, [user]);

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

        if (isConnected) {
          await supabase
            .from('whatsapp_instances')
            .update({
              status: 'connected',
              qr_code: null,
              pairing_code: null,
              profile_data: status.profile || null,
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
    const styles = {
      connected: 'bg-green-100 text-green-700',
      connecting: 'bg-yellow-100 text-yellow-700',
      disconnected: 'bg-gray-100 text-gray-700',
    };

    const labels = {
      connected: 'Conectado',
      connecting: 'Conectando',
      disconnected: 'Desconectado',
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Minhas Instâncias</h2>
          <p className="text-gray-500 mt-1">
            {instances.length} de {profile?.max_instances || 0} instâncias utilizadas
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          disabled={instances.length >= (profile?.max_instances || 0)}
          className="flex items-center space-x-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-5 h-5" />
          <span>Nova Instância</span>
        </button>
      </div>

      {instances.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <MessageCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma instância criada</h3>
          <p className="text-gray-500 mb-6">
            Crie sua primeira instância para começar a usar o WhatsApp
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center space-x-2 bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg transition-colors shadow-md hover:shadow-lg"
          >
            <Plus className="w-5 h-5" />
            <span>Criar Instância</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {instances.map((instance) => (
            <div key={instance.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{instance.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">{instance.phone_number || 'Sem número'}</p>
                  </div>
                  {getStatusBadge(instance.status)}
                </div>

                <div className="flex flex-wrap gap-2">
                  {instance.status === 'disconnected' && (
                    <button
                      onClick={() => openConnectModal(instance)}
                      className="flex items-center space-x-1 px-3 py-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg transition-colors text-sm"
                    >
                      <Power className="w-4 h-4" />
                      <span>Conectar</span>
                    </button>
                  )}

                  {instance.status === 'connecting' && (
                    <>
                      <button
                        onClick={() => openConnectModal(instance)}
                        className="flex items-center space-x-1 px-3 py-2 bg-yellow-50 text-yellow-600 hover:bg-yellow-100 rounded-lg transition-colors text-sm"
                      >
                        <QrCode className="w-4 h-4" />
                        <span>Ver QR Code</span>
                      </button>
                      <button
                        onClick={() => handleCancelConnection(instance)}
                        className="flex items-center space-x-1 px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors text-sm"
                      >
                        <PowerOff className="w-4 h-4" />
                        <span>Cancelar</span>
                      </button>
                    </>
                  )}

                  {instance.status === 'connected' && (
                    <button
                      onClick={() => handleDisconnectInstance(instance)}
                      className="flex items-center space-x-1 px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors text-sm"
                    >
                      <PowerOff className="w-4 h-4" />
                      <span>Desconectar</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleDeleteInstance(instance)}
                    className="flex items-center space-x-1 px-3 py-2 bg-gray-50 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Excluir</span>
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
