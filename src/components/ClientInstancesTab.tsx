import { useState, useEffect, useMemo, useRef } from 'react';
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
  ChevronDown,
  ChevronUp,
  CheckCircle2,
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
  const { user, profile, isSubUser } = useAuth();
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Lock para evitar configuração duplicada do Chatwoot
  const chatwootConfiguring = useRef<Set<string>>(new Set());
  // Track instâncias sendo excluídas para evitar mostrar erros de polling
  const deletingInstances = useRef<Set<string>>(new Set());
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
  const [chatEnabled, setChatEnabled] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmState>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });
  const [filterStatus, setFilterStatus] = useState<'all' | 'connected' | 'connecting' | 'disconnected'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'all' | 'mine' | 'sub-users'>('all');
  const [subUsers, setSubUsers] = useState<Array<{id: string, email: string}>>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [connectToUserId, setConnectToUserId] = useState<string>('');
  const [chatConfigExpanded, setChatConfigExpanded] = useState(false);
  const [chatConfig, setChatConfig] = useState<{
    url: string;
    apiKey: string;
    accountId: string;
    inboxId: string | null;
  } | null>(null);
  const [selectedUserChatConfig, setSelectedUserChatConfig] = useState<{
    url: string;
    apiKey: string;
    accountId: string;
  } | null>(null);
  const [manualChatConfig, setManualChatConfig] = useState<{
    url: string;
    apiKey: string;
    accountId: string;
  }>({
    url: '',
    apiKey: '',
    accountId: '',
  });
  const [showManualChatConfig, setShowManualChatConfig] = useState(false);

  const summary = useMemo(() => {
    const allInstances = instances; // Já inclui próprias + sub-usuários
    const myInstances = allInstances.filter(i => i.user_id === user?.id);
    const subUserInstances = allInstances.filter(i => i.user_id !== user?.id);
    
    const connected = allInstances.filter((instance) => instance.status === 'connected').length;
    const connecting = allInstances.filter((instance) => instance.status === 'connecting').length;
    const disconnected = allInstances.filter((instance) => instance.status === 'disconnected').length;
    
    const limit = profile?.max_instances ?? 0;
    const totalUsed = allInstances.length; // Total de todas as instâncias
    const usagePercent = limit > 0 ? Math.min(100, Math.round((totalUsed / limit) * 100)) : null;
    const available = limit > 0 ? Math.max(0, limit - totalUsed) : null;

    return {
      total: allInstances.length,
      myInstances: myInstances.length,
      subUserInstances: subUserInstances.length,
      connected,
      connecting,
      disconnected,
      limit,
      available,
      usagePercent,
    };
  }, [instances, profile, user]);

  const filteredInstances = useMemo(() => {
    let filtered = instances;
    
    // Filtrar por viewMode
    if (viewMode === 'mine') {
      filtered = filtered.filter(inst => inst.user_id === user?.id);
    } else if (viewMode === 'sub-users') {
      filtered = filtered.filter(inst => inst.user_id !== user?.id);
    }
    // 'all' mostra todas
    
    // Filtrar por status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(inst => inst.status === filterStatus);
    }
    
    // Filtrar por termo de busca
    const term = searchTerm.trim().toLowerCase();
    if (term) {
      filtered = filtered.filter((instance) => {
        const haystack = `${instance.name ?? ''} ${instance.phone_number ?? ''}`.toLowerCase();
        return haystack.includes(term);
      });
    }

    return filtered;
  }, [instances, filterStatus, searchTerm, viewMode, user]);

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
    setChatEnabled(false);
    setSelectedUserId('');
    setSelectedUserChatConfig(null);
    setChatConfigExpanded(false);
    setShowManualChatConfig(false);
    setManualChatConfig({
      url: '',
      apiKey: '',
      accountId: '',
    });
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
      showToast('Não foi possível copiar o token', 'error');
    }
  };

  useEffect(() => {
    if (user) {
      setSelectedUserId(user.id);
      loadSubUsers().then(() => {
        loadInstances();
      });
    }
  }, [user]);

  // Buscar configurações de chat do usuário selecionado quando o modal de criação abrir
  useEffect(() => {
    async function loadSelectedUserChatConfig() {
      if (!showCreateModal) return;

      const userIdToCheck = selectedUserId || user?.id;
      
      if (!userIdToCheck) {
        setSelectedUserChatConfig(null);
        return;
      }

      try {
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('chat_url, chat_api_key, chat_account_id')
          .eq('id', userIdToCheck)
          .single();

        if (userProfile?.chat_url && userProfile?.chat_api_key && userProfile?.chat_account_id) {
          setSelectedUserChatConfig({
            url: String(userProfile.chat_url || ''),
            apiKey: String(userProfile.chat_api_key || ''),
            accountId: String(userProfile.chat_account_id || ''),
          });
          // Se já tem configurações, ativar o chat automaticamente
          setChatEnabled(true);
        } else {
          setSelectedUserChatConfig(null);
          // Se não tem configurações, desativar o chat
          setChatEnabled(false);
        }
      } catch (error) {
        setSelectedUserChatConfig(null);
        setChatEnabled(false);
      }
    }

    loadSelectedUserChatConfig();
  }, [selectedUserId, showCreateModal, user?.id]);

  async function loadSubUsers() {
    if (!user) return Promise.resolve();
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('parent_user_id', user.id);
      
      if (!error && data) {
        setSubUsers(data);
      }
      return Promise.resolve();
    } catch (error) {
      return Promise.resolve();
    }
  }

  // Verificação periódica do status de todas as instâncias conectadas
  // Helper function para determinar o status de conexão baseado na resposta da API
  // Retorna: true (conectado), false (desconectado), null (indeterminado - não mudar status)
  // POLÍTICA: Ser MUITO CONSERVADOR - só retorna false se tiver ABSOLUTA CERTEZA
  // Função auxiliar para extrair o status da API
  // Retorna: 'connected' | 'connecting' | 'disconnected' | null (se não conseguir determinar)
  function getStatusFromApi(statusResponse: any, instanceName: string): 'connected' | 'connecting' | 'disconnected' | null {
    const statusData = statusResponse?.status;
    const instanceData = statusResponse?.instance;

    // Verificar se a resposta é válida
    if (!statusResponse || (typeof statusResponse !== 'object')) {
      return null;
    }

    // PRIORIDADE 1: Usar o campo status diretamente da API se disponível
    // A API retorna: "disconnected", "connecting", "connected"
    const apiStatus = instanceData?.status;
    if (apiStatus && typeof apiStatus === 'string') {
      const normalizedStatus = apiStatus.toLowerCase();
      if (normalizedStatus === 'connected' || normalizedStatus === 'connecting' || normalizedStatus === 'disconnected') {
        return normalizedStatus as 'connected' | 'connecting' | 'disconnected';
      }
    }

    // PRIORIDADE 2: Verificar QR code ou pairing code - se houver, está "connecting"
    const hasQrCode = (instanceData?.qrcode && String(instanceData.qrcode).trim().length > 0) ||
                     (statusResponse?.qrCode && String(statusResponse.qrCode).trim().length > 0) ||
                     (statusData?.qrcode && String(statusData.qrcode).trim().length > 0) ||
                     (statusData?.qrCode && String(statusData.qrCode).trim().length > 0);
    const hasPairingCode = (instanceData?.paircode && String(instanceData.paircode).trim().length > 0) ||
                          (statusResponse?.pairingCode && String(statusResponse.pairingCode).trim().length > 0) ||
                          (statusData?.paircode && String(statusData.paircode).trim().length > 0) ||
                          (statusData?.pairingCode && String(statusData.pairingCode).trim().length > 0);

    if (hasQrCode || hasPairingCode) {
      return 'connecting';
    }

    // PRIORIDADE 3: Verificar indicadores de conexão (APENAS se não tiver status direto)
    // IMPORTANTE: Só usar indicadores se NÃO tiver o campo status direto da API
    const hasLoggedInTrue = statusData?.loggedIn === true;
    const hasConnectedTrue = statusData?.connected === true;
    const hasJid = statusData?.jid && typeof statusData.jid === 'string' && statusData.jid.includes('@');

    // CRÍTICO: Só marcar como "connected" se TODOS os indicadores estiverem presentes
    // Não assumir "connected" apenas com um indicador parcial
    if (hasLoggedInTrue && hasConnectedTrue && hasJid) {
      return 'connected';
    }

    // PRIORIDADE 4: Verificar indicadores de desconexão
    const hasLoggedInFalse = statusData?.loggedIn === false;
    const hasConnectedFalse = statusData?.connected === false;

    if (hasLoggedInFalse && hasConnectedFalse) {
      return 'disconnected';
    }

    // Se não conseguir determinar, retornar null para manter status atual
    // NÃO assumir "connected" por padrão
    return null;
  }

  // Função legada mantida para compatibilidade (retorna boolean | null)
  function getConnectionStatus(statusResponse: any, instanceName: string): boolean | null {
    const apiStatus = getStatusFromApi(statusResponse, instanceName);
    
    if (apiStatus === 'connected') return true;
    if (apiStatus === 'disconnected') return false;
    return null; // connecting ou null (indeterminado)

    // INDICADORES DE DESCONEXÃO - Ser MUITO CONSERVADOR
    // Só retornamos false se tivermos ABSOLUTA CERTEZA
    const hasLoggedInFalse = statusData?.loggedIn === false;
    const hasConnectedFalse = statusData?.connected === false;
    
    // Para marcar como DESCONECTADO, precisamos de:
    // 1. Ambos campos explicitamente false (loggedIn E connected)
    // 2. E não ter nenhum indicador positivo de conexão (verificado acima)
    // 3. E não ter QR code ou pairing code (pode estar conectando) - já verificado acima
    // 4. E ter estrutura de resposta válida (statusData e instanceData existem)
    
    // Só retornar false se TODAS as condições forem verdadeiras
    if (hasLoggedInFalse &&
        hasConnectedFalse &&
        !hasQrCode &&
        !hasPairingCode &&
        statusData !== undefined && // Garantir que statusData existe
        instanceData !== undefined && // Garantir que instanceData existe
        !hasJid && // Garantir que não tem JID
        !hasOwner && // Garantir que não tem owner
        !hasPhoneNumber && // Garantir que não tem phone_number
        !hasProfileName) { // Garantir que não tem profileName

      return false;
    }

    // IMPORTANTE: Se não temos certeza absoluta, retornamos null
    // Isso faz com que o status atual seja mantido (especialmente se estiver como "connected")
    // POLÍTICA: Em caso de dúvida, manter como conectado
    return null;
  }

  useEffect(() => {
    if (!user) return;

    // Verificar TODAS as instâncias (não apenas as marcadas como conectadas) para sincronizar status
    const checkInterval = setInterval(async () => {
      try {
        // Buscar todas as instâncias com token (próprias + sub-usuários)
        const subUserIds = subUsers.map(u => u.id);
        const userIds = [user.id, ...subUserIds];
        
        const { data: allInstances, error } = await supabase
          .from('whatsapp_instances')
          .select('*')
          .in('user_id', userIds)
          .not('instance_token', 'is', null);

        if (error || !allInstances || allInstances.length === 0) {
          return;
        }

        // Verificar cada instância e sincronizar status com a API
        // Adicionar delay entre requisições para evitar rate limiting
        for (let i = 0; i < allInstances.length; i++) {
          const instance = allInstances[i];
          if (!instance.instance_token) continue;

          // Delay entre requisições (exceto a primeira)
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 200)); // 200ms entre requisições
          }

          try {
            const status = await whatsappApi.getInstanceStatus(instance.instance_token);
            const apiStatus = getStatusFromApi(status, instance.name);
            const statusData = (status as any).status;
            const phoneNumber = extractPhoneNumber(status);
            // PRIORIDADE: Usar o status diretamente da API se disponível
            // IMPORTANTE: Só atualizar se apiStatus não for null (se for null, manter status atual)
            if (apiStatus && apiStatus !== null) {
              // Se o status da API é diferente do status no banco, atualizar
              if (apiStatus !== instance.status) {
                const updates: any = {
                  status: apiStatus,
                };
                
                // Se está como connecting, atualizar QR/pairing code
                if (apiStatus === 'connecting') {
                  const hasQrCodeInResponse = (status as any).instance?.qrcode || 
                                             (status as any).instance?.qrCode || 
                                             (status as any).status?.qrcode || 
                                             (status as any).status?.qrCode || 
                                             (status as any).qrCode || 
                                             (status as any).qrcode || 
                                             null;
                  const hasPairingCodeInResponse = (status as any).instance?.paircode || 
                                                   (status as any).instance?.pairingCode || 
                                                   (status as any).status?.paircode || 
                                                   (status as any).status?.pairingCode || 
                                                   (status as any).pairingCode || 
                                                   (status as any).paircode || 
                                                   null;
                  
                  if (hasQrCodeInResponse && String(hasQrCodeInResponse).trim() !== '') {
                    updates.qr_code = hasQrCodeInResponse;
                    updates.pairing_code = null;
                  } else if (hasPairingCodeInResponse && String(hasPairingCodeInResponse).trim() !== '') {
                    updates.pairing_code = hasPairingCodeInResponse;
                    updates.qr_code = null;
                  }
                } else if (apiStatus === 'connected') {
                  // Se está conectado, limpar QR/pairing code
                  updates.qr_code = null;
                  updates.pairing_code = null;
                  updates.phone_number = phoneNumber || instance.phone_number || null;
                  updates.last_disconnect_reason = null;
                  updates.last_disconnect_at = null;
                } else if (apiStatus === 'disconnected') {
                  // Se está desconectado, limpar QR/pairing code
                  updates.qr_code = null;
                  updates.pairing_code = null;
                }
                
                await supabase
                  .from('whatsapp_instances')
                  .update(updates)
                  .eq('id', instance.id);
                
                // Se mudou de disconnected para connected, recarregar e configurar Chatwoot
                if (instance.status === 'disconnected' && apiStatus === 'connected') {
                  loadInstances();
                  showToast(`Instância "${instance.name}" reconectou automaticamente.`, 'success');
                  
                  const { data: updatedInstance } = await supabase
                    .from('whatsapp_instances')
                    .select('*')
                    .eq('id', instance.id)
                    .single();
                  
                  if (updatedInstance) {
                    await configureChatwootIfNeeded(updatedInstance as WhatsAppInstance);
                  }
                }
              } else {
                // Status já está correto, apenas atualizar QR/pairing code se necessário
                if (apiStatus === 'connecting') {
                  const hasQrCodeInResponse = (status as any).instance?.qrcode || 
                                             (status as any).instance?.qrCode || 
                                             (status as any).status?.qrcode || 
                                             (status as any).status?.qrCode || 
                                             (status as any).qrCode || 
                                             (status as any).qrcode || 
                                             null;
                  const hasPairingCodeInResponse = (status as any).instance?.paircode || 
                                                  (status as any).instance?.pairingCode || 
                                                  (status as any).status?.paircode || 
                                                  (status as any).status?.pairingCode || 
                                                  (status as any).pairingCode || 
                                                  (status as any).paircode || 
                                                  null;
                  
                  const updates: any = {};
                  if (hasQrCodeInResponse && hasQrCodeInResponse !== instance.qr_code) {
                    updates.qr_code = hasQrCodeInResponse;
                    updates.pairing_code = null;
                  } else if (hasPairingCodeInResponse && hasPairingCodeInResponse !== instance.pairing_code) {
                    updates.pairing_code = hasPairingCodeInResponse;
                    updates.qr_code = null;
                  }
                  
                  if (Object.keys(updates).length > 0) {
                    await supabase
                      .from('whatsapp_instances')
                      .update(updates)
                      .eq('id', instance.id);
                  }
                }
              }
              continue; // Status já foi atualizado usando a API
            }

            // Fallback: Se não conseguiu determinar status da API (apiStatus === null)
            // NÃO fazer nada - manter status atual do banco
            // Isso evita marcar como "connected" incorretamente
            // Se o status atual no banco é "connected" mas a API não confirma, 
            // verificar se realmente está desconectado antes de mudar
            if (instance.status === 'connected') {
              // Verificar se a API diz explicitamente que está desconectado
              const statusData = (status as any).status;
              const instanceData = (status as any).instance;
              
              // Só marcar como desconectado se TODOS os indicadores negativos estiverem presentes
              const hasLoggedInFalse = statusData?.loggedIn === false;
              const hasConnectedFalse = statusData?.connected === false;
              const hasNoJid = !statusData?.jid || !statusData.jid.includes('@');
              
              if (hasLoggedInFalse && hasConnectedFalse && hasNoJid) {
                await supabase
                  .from('whatsapp_instances')
                  .update({
                    status: 'disconnected',
                    qr_code: null,
                    pairing_code: null,
                  })
                  .eq('id', instance.id);
                loadInstances();
              } else {
              }
            }
            
            // Se não está conectado no banco e não conseguimos determinar na API, não fazer nada
            continue;
          } catch (error: any) {
            // Tratar erros específicos da API
            if (error?.status === 401) {
              // Marcar como desconectado se o token é inválido
              if (instance.status === 'connected' || instance.status === 'connecting') {
                await supabase
                  .from('whatsapp_instances')
                  .update({
                    status: 'disconnected',
                    qr_code: null,
                    pairing_code: null,
                  })
                  .eq('id', instance.id);
              }
              continue; // Pular esta instância
            } else if (error?.status === 404) {
              continue; // Pular esta instância
            } else if (error?.status === 500) {
              // Não atualizar status em caso de erro 500 - pode ser temporário
              continue; // Pular esta instância
            } else {
              // Outros erros - não alterar status
              continue; // Pular esta instância
            }
          }
        }
      } catch (error) {
      }
    }, 30000); // Verificar a cada 30 segundos

    return () => clearInterval(checkInterval);
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
    if (!user) return;
    
    try {
      // Buscar sub-usuários primeiro se ainda não foram carregados
      let currentSubUsers = subUsers;
      if (currentSubUsers.length === 0) {
        const { data: subUsersData } = await supabase
          .from('profiles')
          .select('id, email')
          .eq('parent_user_id', user.id);
        currentSubUsers = subUsersData || [];
        setSubUsers(currentSubUsers);
      }
      
      // Buscar instâncias próprias E dos sub-usuários
      const subUserIds = currentSubUsers.map(u => u.id);
      const userIds = [user.id, ...subUserIds];
      
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select(`
          *,
          user:profiles!whatsapp_instances_user_id_fkey(id, email, parent_user_id)
        `)
        .in('user_id', userIds.length > 0 ? userIds : [user.id])
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // PRIMEIRO: Verificar status na API para todas as instâncias com token
      // Isso garante que o status exibido sempre reflita o estado real da API
      if (data && data.length > 0) {
        const instancesWithToken = data.filter(inst => inst.instance_token);
        const statusUpdates: Array<{ id: string; status: string; phone_number?: string | null }> = [];

        // Verificar status de cada instância na API
        for (const inst of instancesWithToken) {
          try {
            const status = await whatsappApi.getInstanceStatus(inst.instance_token!);
            const connectionStatus = getConnectionStatus(status, inst.name);
            const phoneNumber = extractPhoneNumber(status);

            // PROTEÇÃO CRÍTICA: Só atualizar se tivermos uma resposta definitiva da API
            if (connectionStatus === true) {
              // API diz que está conectado - atualizar para conectado
              // IMPORTANTE: Se já está conectado no banco, não precisa atualizar (evita race conditions)
              if (inst.status !== 'connected') {
                statusUpdates.push({
                  id: inst.id,
                  status: 'connected',
                  phone_number: phoneNumber || inst.phone_number || null,
                });
                
                // Configurar Chatwoot se necessário (será chamado após os updates serem aplicados)
                if (inst.chat_enabled && inst.admin_field_01) {
                  // Usar setTimeout para garantir que o update foi processado
                  setTimeout(async () => {
                    const { data: updatedInstance } = await supabase
                      .from('whatsapp_instances')
                      .select('*')
                      .eq('id', inst.id)
                      .single();
                    
                    if (updatedInstance) {
                      await configureChatwootIfNeeded(updatedInstance as WhatsAppInstance);
                    }
                  }, 1500);
                }
              }
            } else if (connectionStatus === false) {
              // PROTEÇÃO EXTRA: Antes de marcar como desconectado, verificar novamente
              // Se a instância está conectada no banco, fazer uma segunda verificação
              if (inst.status === 'connected') {
                // Segunda verificação após pequeno delay
                await new Promise(resolve => setTimeout(resolve, 1000));
                try {
                  const secondStatus = await whatsappApi.getInstanceStatus(inst.instance_token!);
                  const secondConnectionStatus = getConnectionStatus(secondStatus, inst.name);
                  
                  // Se na segunda verificação ainda diz desconectado, então realmente está desconectado
                  if (secondConnectionStatus === false) {
                    statusUpdates.push({
                      id: inst.id,
                      status: 'disconnected',
                      phone_number: inst.phone_number || null,
                    });
                  } else if (secondConnectionStatus === true) {
                    // Na segunda verificação está conectado - manter como conectado
                    // Não adicionar à lista de atualizações - manter como conectado
                  }
                  // Se secondConnectionStatus === null, manter status atual (conectado)
                } catch (secondError) {
                  // Se segunda verificação falhar, manter status atual (conectado)
                }
              } else {
                // Se já está desconectado no banco e API confirma, pode atualizar
                statusUpdates.push({
                  id: inst.id,
                  status: 'disconnected',
                  phone_number: inst.phone_number || null,
                });
              }
            }
            // Se connectionStatus === null, mantemos o status atual do banco (NUNCA mudar para desconectado)
          } catch (error) {
            // Se houver erro ao consultar a API, manter status atual do banco
            // NUNCA marcar como desconectado por erro na API
          }
        }

        // Aplicar todas as atualizações de status de uma vez
        if (statusUpdates.length > 0) {
          for (const update of statusUpdates) {
            await supabase
              .from('whatsapp_instances')
              .update({
                status: update.status as 'connected' | 'disconnected' | 'connecting',
                phone_number: update.phone_number,
                qr_code: null,
                pairing_code: null,
                last_disconnect_reason: update.status === 'disconnected' ? 'Desconexão confirmada na API' : null,
                last_disconnect_at: update.status === 'disconnected' ? new Date().toISOString() : null,
              })
              .eq('id', update.id);
          }

          // Recarregar do banco após atualizar status (incluindo sub-usuários)
          const { data: updatedData } = await supabase
            .from('whatsapp_instances')
            .select(`
              *,
              user:profiles!whatsapp_instances_user_id_fkey(id, email, parent_user_id)
            `)
            .in('user_id', userIds.length > 0 ? userIds : [user.id])
            .order('created_at', { ascending: false });

          if (updatedData) {
            setInstances(updatedData);
            
            if (selectedInstance) {
              const updatedInstance = updatedData.find(inst => inst.id === selectedInstance.id);
              if (updatedInstance) {
                setSelectedInstance(updatedInstance);
              }
            }
          }
        } else {
          // Se não houve atualizações, apenas definir as instâncias
          setInstances(data);
          
          if (selectedInstance) {
            const updatedInstance = data.find(inst => inst.id === selectedInstance.id);
            if (updatedInstance) {
              setSelectedInstance(updatedInstance);
            }
          }
        }
      } else {
        setInstances(data || []);
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  }

  // Função auxiliar para configurar Chatwoot quando a instância for conectada
  async function configureChatwootIfNeeded(instance: WhatsAppInstance) {
    // Verifica se a instância tem chat habilitado e inbox_id
    if (!instance.chat_enabled || !instance.admin_field_01) {
      return; // Não precisa configurar
    }

    // Verifica se já está sendo configurado no lock local (primeira verificação rápida)
    if (chatwootConfiguring.current.has(instance.id)) {
      return;
    }
    
    // Verifica no banco ANTES de processar (evita race conditions entre múltiplas chamadas)
    // Isso garante que mesmo se duas chamadas chegarem simultaneamente, apenas uma processará
    try {
      const { data: currentInstance } = await supabase
        .from('whatsapp_instances')
        .select('admin_field_02')
        .eq('id', instance.id)
        .single();
      
      if (currentInstance?.admin_field_02 === 'chatwoot_configured') {
        return;
      }
      
      if (currentInstance?.admin_field_02 === 'chatwoot_configuring') {
        return;
      }
      
      // Tenta marcar como "configurando" no banco (usando update condicional)
      // Se outra requisição já marcou, esta falhará silenciosamente
      const { error: updateError } = await supabase
        .from('whatsapp_instances')
        .update({ admin_field_02: 'chatwoot_configuring' })
        .eq('id', instance.id)
        .eq('admin_field_02', instance.admin_field_02); // Só atualiza se o valor ainda for o mesmo
      
      if (updateError) {
        // Se falhou, pode ser que outra requisição já marcou - verificar novamente
        const { data: recheckInstance } = await supabase
          .from('whatsapp_instances')
          .select('admin_field_02')
          .eq('id', instance.id)
          .single();
        
        if (recheckInstance?.admin_field_02 === 'chatwoot_configuring' || 
            recheckInstance?.admin_field_02 === 'chatwoot_configured') {
          return;
        }
        
        // Se não está configurando/configurado, pode ser erro de rede - tentar continuar
      }
      
      // Marca no lock local APÓS confirmar no banco
      chatwootConfiguring.current.add(instance.id);
    } catch (error) {
      // Se falhar a verificação no banco, verifica o lock local
      if (chatwootConfiguring.current.has(instance.id)) {
        return;
      }
      chatwootConfiguring.current.add(instance.id);
    }

    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('chat_url, chat_api_key, chat_account_id')
        .eq('id', user?.id)
        .maybeSingle();

      if (!profileData?.chat_url || !profileData?.chat_api_key || !profileData?.chat_account_id) {
        return;
      }

      const inboxId = parseInt(instance.admin_field_01, 10);
      if (isNaN(inboxId)) {
        return;
      }

      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.evasend.com.br/whatsapp';
      const configResponse = await fetch(`${API_BASE_URL}/chatwoot/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'token': instance.instance_token || '',
        },
        body: JSON.stringify({
          enabled: true,
          url: profileData.chat_url,
          access_token: profileData.chat_api_key,
          account_id: profileData.chat_account_id,
          inbox_id: inboxId,
          ignore_groups: false,
          sign_messages: true,
          create_new_conversation: false,
        }),
      });

      if (configResponse.ok) {
        const configData = await configResponse.json();
        // Marcar como configurado no banco
        await supabase
          .from('whatsapp_instances')
          .update({ admin_field_02: 'chatwoot_configured' })
          .eq('id', instance.id);
        
        // Remover do lock
        chatwootConfiguring.current.delete(instance.id);
        
        // Verifica se o webhook foi configurado
        if (configData.webhook_url || configData.channel_webhook_updated || configData.webhook_updated_in_chatwoot) {
          // Buscar o nome da inbox do Chatwoot
          // A inbox é criada com o nome da instância, mas vamos buscar da resposta para garantir
          let inboxName = instance.name; // Fallback para o nome da instância
          
          try {
            // Tentar obter o nome da inbox da resposta do config
            if (configData.chatwoot_response?.name) {
              inboxName = configData.chatwoot_response.name;
            } else if (configData.inbox?.name) {
              inboxName = configData.inbox.name;
            } else if (configData.channel_update_response?.name) {
              inboxName = configData.channel_update_response.name;
            } else {
              // Se não estiver na resposta, fazer uma chamada para buscar o nome da inbox
              const chatwootBaseUrl = profileData.chat_url.endsWith('/') 
                ? profileData.chat_url.slice(0, -1) 
                : profileData.chat_url;
              
              const inboxResponse = await fetch(
                `${chatwootBaseUrl}/api/v1/accounts/${profileData.chat_account_id}/inboxes/${inboxId}`,
                {
                  method: 'GET',
                  headers: {
                    'api_access_token': profileData.chat_api_key,
                  },
                }
              );
              
              if (inboxResponse.ok) {
                const inboxData = await inboxResponse.json();
                inboxName = inboxData.name || instance.name;
              }
            }
          } catch (error) {
            // Usa o nome da instância como fallback (que é o mesmo usado para criar a inbox)
          }
          
          showToast(`Integração com Chat configurada com sucesso para caixa de entrada "${inboxName}"!`, 'success');
        }
      } else {
        const configErrorText = await configResponse.text();
        let configErrorData;
        try {
          configErrorData = JSON.parse(configErrorText);
        } catch {
          configErrorData = { error: configErrorText, status: configResponse.status };
        }
        // Não mostrar toast de erro aqui para não incomodar o usuário
        
        // Remover do lock mesmo em caso de erro para permitir nova tentativa
        chatwootConfiguring.current.delete(instance.id);
        
        // Remover flag de "configurando" do banco para permitir nova tentativa
        await supabase
          .from('whatsapp_instances')
          .update({ admin_field_02: null })
          .eq('id', instance.id);
      }
    } catch (error: any) {
      // Remover do lock mesmo em caso de erro
      chatwootConfiguring.current.delete(instance.id);
      
      // Remover flag de "configurando" do banco para permitir nova tentativa
      try {
        await supabase
          .from('whatsapp_instances')
          .update({ admin_field_02: null })
          .eq('id', instance.id);
      } catch (dbError) {
      }
    }
  }

  async function handleCreateInstance() {
    if (!instanceName.trim()) {
      showToast('Por favor, insira um nome para a instância', 'warning');
      return;
    }

    // Validar configurações do chat se estiver ativado
    if (chatEnabled) {
      const chatConfigToValidate = selectedUserChatConfig || (
        manualChatConfig.url && manualChatConfig.apiKey && manualChatConfig.accountId
          ? manualChatConfig
          : null
      );
      if (!chatConfigToValidate) {
        showToast('Preencha todas as configurações do Chat (URL, API Key e Account ID) ou desative a integração', 'warning');
        return;
      }

      // Converter accountId para string antes de validar (pode ser número)
      const accountIdStr = String(chatConfigToValidate.accountId || '').trim();
      
      if (!chatConfigToValidate.url?.trim() || !chatConfigToValidate.apiKey?.trim() || !accountIdStr) {
        showToast('Preencha todas as configurações do Chat corretamente', 'warning');
        return;
      }
    }

    // Verificar limite considerando todas as instâncias (próprias + sub-usuários)
    const totalInstances = instances.length;
    const limit = profile?.max_instances ?? 0;
    
    if (limit > 0 && totalInstances >= limit) {
      showToast(`Você atingiu o limite de ${limit} instâncias (incluindo sub-usuários)`, 'warning');
      return;
    }

    setCreating(true);
    try {
      const response = await whatsappApi.createInstance(instanceName);

      if (response.token) {
        // Verificar status real na API usando getConnectionStatus
        let initialStatus: 'connected' | 'disconnected' | 'connecting' = 'disconnected';
        try {
          const statusCheck = await whatsappApi.getInstanceStatus(response.token);
          const connectionStatus = getConnectionStatus(statusCheck, instanceName);
          if (connectionStatus === true) {
            initialStatus = 'connected';
          } else if (connectionStatus === null) {
            // Se indeterminado, usar o valor da resposta da criação
            initialStatus = response.connected ? 'connected' : 'disconnected';
          }
        } catch (error) {
          // Se falhar, usar o valor da resposta da criação
          initialStatus = response.connected ? 'connected' : 'disconnected';
        }

        // Primeiro, salvar a instância no banco para obter o instance_id
        // Usar selectedUserId (pode ser o próprio usuário ou um sub-usuário)
        const { data: newInstanceData, error } = await supabase
          .from('whatsapp_instances')
          .insert({
            user_id: selectedUserId || user?.id || '',
            name: instanceName,
            instance_token: response.token,
            system_name: 'apilocal',
            status: initialStatus,
            chat_enabled: chatEnabled,
          })
          .select()
          .single();

        if (error) throw error;

        let inboxId: number | null = null;

        // Se chat_enabled for true, criar inbox no Chatwoot via backend (evita CORS)
        // Usar as configurações do usuário selecionado (pode ser sub-usuário) ou configuração manual
        const chatConfigToUse = selectedUserChatConfig || (
          manualChatConfig.url && manualChatConfig.apiKey && manualChatConfig.accountId
            ? manualChatConfig
            : null
        );

        if (chatEnabled && chatConfigToUse && newInstanceData?.id) {
          // Verifica se já tem inbox_id (pode ter sido criado em uma tentativa anterior)
          if (!newInstanceData.admin_field_01) {
            try {
              const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.evasend.com.br/whatsapp';
              
              const inboxResponse = await fetch(`${API_BASE_URL}/chatwoot/create-inbox`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  chat_url: chatConfigToUse.url,
                  chat_api_key: chatConfigToUse.apiKey,
                  chat_account_id: chatConfigToUse.accountId,
                  instance_name: instanceName,
                  instance_id: newInstanceData.id, // Passar instance_id para configurar webhook
                }),
              });

              if (inboxResponse.ok) {
                const inboxData = await inboxResponse.json();
                inboxId = inboxData.inbox_id;
                // Atualizar a instância com o inbox_id
                // A configuração completa via /chatwoot/config será feita após a conexão
                await supabase
                  .from('whatsapp_instances')
                  .update({ admin_field_01: inboxId.toString() })
                  .eq('id', newInstanceData.id);
              } else {
                let errorData;
                try {
                  errorData = await inboxResponse.json();
                } catch {
                  const errorText = await inboxResponse.text();
                  errorData = { error: errorText, status: inboxResponse.status };
                }
                // Não falhar a criação da instância se a inbox falhar
                const errorMessage = errorData.details?.message || errorData.error || 'Erro desconhecido';
                showToast(`Instância criada, mas não foi possível criar a inbox no Chat: ${errorMessage}`, 'warning');
              }
            } catch (chatError: any) {
              // Não falhar a criação da instância se a inbox falhar
              showToast('Instância criada, mas não foi possível criar a inbox no Chat. Verifique as configurações.', 'warning');
            }
          } else {
            // Já tem inbox_id, usar o existente
            inboxId = parseInt(newInstanceData.admin_field_01, 10);
          }
        } else if (chatEnabled && !chatConfigToUse) {
          showToast('Instância criada, mas não foi possível criar a inbox. Preencha todas as configurações do Chat.', 'warning');
        }

        // Se foi configurado manualmente e não tinha configuração no perfil, salvar no perfil
        if (chatEnabled && chatConfigToUse && !selectedUserChatConfig && manualChatConfig.url && manualChatConfig.apiKey && manualChatConfig.accountId) {
          try {
            const userIdToSave = selectedUserId || user?.id;
            if (userIdToSave) {
              await supabase
                .from('profiles')
                .update({
                  chat_url: manualChatConfig.url,
                  chat_api_key: manualChatConfig.apiKey,
                  chat_account_id: manualChatConfig.accountId,
                })
                .eq('id', userIdToSave);
              // Atualizar o estado para refletir as configurações salvas
              setSelectedUserChatConfig(manualChatConfig);
            }
          } catch (error) {
            // Não falhar a criação se não conseguir salvar no perfil
          }
        }

        if (chatEnabled && inboxId) {
          showToast('Instância e inbox do Chat criadas com sucesso! Webhook configurado automaticamente.', 'success');
        } else {
          showToast('Instância criada com sucesso!', 'success');
        }
        closeCreateModal();
        await loadInstances();

        // Buscar a instância recém-criada e abrir modal de conexão automaticamente
        // Usar selectedUserId (pode ser o próprio usuário ou um sub-usuário)
        const { data: newInstance } = await supabase
          .from('whatsapp_instances')
          .select('*')
          .eq('instance_token', response.token)
          .eq('user_id', selectedUserId || user?.id || '')
          .single();

        if (newInstance && newInstance.status === 'disconnected') {
          // Aguardar um pouco para garantir que a instância foi criada
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Abrir modal de conexão - usuário escolhe como conectar (QR code ou número)
          setSelectedInstance(newInstance);
          setPhoneNumber('');
          setConnectToUserId(newInstance.user_id); // Inicializar com o dono atual
          setQrCode('');
          setPairingCode('');
          setShowConnectModal(true);
          setIsConnecting(false); // Não iniciar conexão automaticamente
        }
      } else {
        throw new Error('API não retornou token de instância');
      }
    } catch (error: any) {
      showToast(error?.message || 'Erro ao criar instância', 'error');
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

    // Se o usuário selecionou uma conta diferente, transferir a instância
    if (connectToUserId && connectToUserId !== selectedInstance.user_id && !isSubUser) {
      try {
        await supabase
          .from('whatsapp_instances')
          .update({ user_id: connectToUserId })
          .eq('id', selectedInstance.id);
        
        // Atualizar selectedInstance para refletir a mudança
        selectedInstance.user_id = connectToUserId;
        showToast(`Instância transferida para ${subUsers.find(u => u.id === connectToUserId)?.email || 'subconta'}`, 'success');
      } catch (error) {
        showToast('Erro ao transferir instância', 'error');
        return;
      }
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

      // Verificar QR code na resposta inicial - múltiplos formatos possíveis
      const qr = response.qrCode || response.qr || (response as any).qrcode || (response as any).instance?.qrcode || null;
      const code = response.pairingCode || response.code || (response as any).paircode || (response as any).instance?.paircode || null;
      if (qr) {
        setQrCode(qr);
        setPairingCode('');
        setIsConnecting(false);
        await supabase
          .from('whatsapp_instances')
          .update({ qr_code: qr })
          .eq('id', selectedInstance.id);
      } else if (code) {
        setPairingCode(code);
        setQrCode('');
        setIsConnecting(false);
        await supabase
          .from('whatsapp_instances')
          .update({ pairing_code: code })
          .eq('id', selectedInstance.id);
      } else {
        // Se não veio na resposta inicial, buscar imediatamente no status
        try {
          const status = await whatsappApi.getInstanceStatus(selectedInstance.instance_token);
          const instanceData = (status as any).instance;
          const statusData = (status as any).status;
          
          // Verificar todos os formatos possíveis
          const qrFromStatus = instanceData?.qrcode || 
                              instanceData?.qrCode || 
                              statusData?.qrcode || 
                              statusData?.qrCode || 
                              (status as any).qrCode || 
                              (status as any).qrcode || 
                              null;
          
          const codeFromStatus = instanceData?.paircode || 
                                instanceData?.pairingCode || 
                                statusData?.paircode || 
                                statusData?.pairingCode || 
                                (status as any).pairingCode || 
                                (status as any).paircode || 
                                null;
          if (qrFromStatus && qrFromStatus.trim() !== '') {
            setQrCode(qrFromStatus);
            setPairingCode('');
            setIsConnecting(false);
            await supabase
              .from('whatsapp_instances')
              .update({ qr_code: qrFromStatus })
              .eq('id', selectedInstance.id);
          } else if (codeFromStatus && codeFromStatus.trim() !== '') {
            setPairingCode(codeFromStatus);
            setQrCode('');
            setIsConnecting(false);
            await supabase
              .from('whatsapp_instances')
              .update({ pairing_code: codeFromStatus })
              .eq('id', selectedInstance.id);
          } else {
          }
        } catch (statusError) {
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
      showToast(error.message || 'Erro ao desconectar instância', 'error');
    }
  }

  function startStatusPolling(instance: WhatsAppInstance) {
    let pollCount = 0;
    let timeoutId: NodeJS.Timeout | null = null;

    const interval = setInterval(async () => {
      if (!instance.instance_token) return;
      pollCount++;

      try {
        const status = await whatsappApi.getInstanceStatus(instance.instance_token);

        const instanceData = (status as any).instance;
        const statusData = (status as any).status;
        
        // Verificar QR code em TODOS os formatos possíveis PRIMEIRO
        const qrCodeFromApi = instanceData?.qrcode || 
                             instanceData?.qrCode || 
                             statusData?.qrcode || 
                             statusData?.qrCode || 
                             status.qrCode || 
                             (status as any).qrcode || 
                             null;
        
        // Verificar pairing code em TODOS os formatos possíveis
        const pairingCodeFromApi = instanceData?.paircode || 
                                  instanceData?.pairingCode || 
                                  statusData?.paircode || 
                                  statusData?.pairingCode || 
                                  status.pairingCode || 
                                  (status as any).paircode || 
                                  null;
        
        // Se tem QR code ou pairing code, NÃO está conectado ainda - FORÇAR como connecting
        if (qrCodeFromApi && qrCodeFromApi.trim() !== '') {
          // SEMPRE atualizar para "connecting" se tem QR code, independente do status atual
          await supabase
            .from('whatsapp_instances')
            .update({ 
              qr_code: qrCodeFromApi,
              pairing_code: null,
              status: 'connecting' // FORÇAR como connecting
            })
            .eq('id', instance.id);
          setQrCode(qrCodeFromApi);
          setPairingCode('');
          return; // Não verificar conexão se tem QR code
        }
        
        if (pairingCodeFromApi && pairingCodeFromApi.trim() !== '') {
          // SEMPRE atualizar para "connecting" se tem pairing code, independente do status atual
          await supabase
            .from('whatsapp_instances')
            .update({ 
              pairing_code: pairingCodeFromApi,
              qr_code: null,
              status: 'connecting' // FORÇAR como connecting
            })
            .eq('id', instance.id);
          setPairingCode(pairingCodeFromApi);
          setQrCode('');
          return; // Não verificar conexão se tem pairing code
        }
        
        // Só verificar conexão se NÃO tiver QR code ou pairing code
        // Usar o status diretamente da API (mais confiável)
        const apiStatus = getStatusFromApi(status, instance.name);
        const phoneNumber = extractPhoneNumber(status);
        
        // Log para debug
        if (pollCount <= 3 || qrCodeFromApi || pairingCodeFromApi) {
        }

        // Usar o status diretamente da API
        if (apiStatus === 'connected') {
          // Cancelar o timeout já que detectamos conexão
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }

          await supabase
            .from('whatsapp_instances')
            .update({
              status: 'connected',
              qr_code: null,
              pairing_code: null,
              phone_number: phoneNumber || instance.phone_number || null,
              profile_data: status.profile || instanceData || null,
              last_disconnect_reason: null,
              last_disconnect_at: null,
            })
            .eq('id', instance.id);

          clearInterval(interval);
          setShowConnectModal(false);
          setQrCode('');
          setPairingCode('');
          setConnectToUserId('');
          setChatConfigExpanded(false);
          setChatConfig(null);
          setIsConnecting(false);
          loadInstances();
          showToast('Instância conectada com sucesso!', 'success');
          
          // Configurar Chatwoot se necessário (após atualizar status)
          const { data: updatedInstance } = await supabase
            .from('whatsapp_instances')
            .select('*')
            .eq('id', instance.id)
            .single();
          
          if (updatedInstance) {
            await configureChatwootIfNeeded(updatedInstance as WhatsAppInstance);
          }
        } else if (apiStatus === 'disconnected') {
          // Se a API diz explicitamente que está desconectado, atualizar para disconnected
          if (instance.status !== 'disconnected') {
            await supabase
              .from('whatsapp_instances')
              .update({
                status: 'disconnected',
                qr_code: null,
                pairing_code: null,
              })
              .eq('id', instance.id);
          }
        }
        // Se apiStatus === null ou 'connecting', manter status atual (não atualizar)
      } catch (error: any) {
        // Verificar se a instância está sendo excluída (não mostrar erro se estiver)
        const isBeingDeleted = deletingInstances.current.has(instance.id);

        // Tratar erros específicos da API
        if (error?.status === 401) {
          clearInterval(interval);
          if (timeoutId) clearTimeout(timeoutId);

          if (!isBeingDeleted) {
            // Marcar como desconectado se o token é inválido
            if (instance.status === 'connected' || instance.status === 'connecting') {
              await supabase
                .from('whatsapp_instances')
                .update({
                  status: 'disconnected',
                  qr_code: null,
                  pairing_code: null,
                })
                .eq('id', instance.id);
            }
            setShowConnectModal(false);
            setIsConnecting(false);
            showToast('Token da instância inválido ou expirado. Por favor, reconecte a instância.', 'error');
            loadInstances();
          }
          return;
        } else if (error?.status === 404) {
          clearInterval(interval);
          if (timeoutId) clearTimeout(timeoutId);

          if (!isBeingDeleted) {
            setShowConnectModal(false);
            setIsConnecting(false);
            showToast('Instância não encontrada na API.', 'error');
            loadInstances();
          }
          return;
        } else if (error?.status === 500) {
          // Continuar tentando em caso de erro 500 (pode ser temporário)
        } else {
          // Continuar tentando em caso de outros erros
        }
      }
    }, 3000);

    // Timeout de segurança - mas antes de marcar como desconectado, verificar na API
    timeoutId = setTimeout(async () => {
      clearInterval(interval);
      
      // ANTES de marcar como desconectado, verificar uma última vez na API
      try {
        const status = await whatsappApi.getInstanceStatus(instance.instance_token);
        const connectionStatus = getConnectionStatus(status, instance.name);
        
        // Verificar se há QR code ou pairing code ativo
        const instanceData = (status as any).instance;
        const statusData = (status as any).status;
        const hasQrCode = (instanceData?.qrcode && instanceData.qrcode.length > 0) || 
                         (statusData?.qrcode && statusData.qrcode.length > 0) ||
                         (status as any).qrCode || 
                         (status as any).qrcode;
        const hasPairingCode = (instanceData?.paircode && instanceData.paircode.length > 0) || 
                              (statusData?.paircode && statusData.paircode.length > 0) ||
                              (status as any).pairingCode || 
                              (status as any).paircode;
        
        // Se está conectado na API E não tem QR/pairing code, atualizar para conectado
        if (connectionStatus === true && !hasQrCode && !hasPairingCode) {
          const phoneNumber = extractPhoneNumber(status);
          
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

          setIsConnecting(false);
          setQrCode('');
          setPairingCode('');
          loadInstances();
          showToast('Instância conectada com sucesso!', 'success');
          return; // Não mostrar erro de timeout
        }
        
        // Verificar status atual no banco
        const { data: currentInstance } = await supabase
          .from('whatsapp_instances')
          .select('status')
          .eq('id', instance.id)
          .single();

        // PROTEÇÃO CRÍTICA: Se já está conectada no banco, NUNCA marcar como desconectado
        if (currentInstance?.status === 'connected') {
          setIsConnecting(false);
          setQrCode('');
          setPairingCode('');
          return;
        }

        // Se status é null (indeterminado), não marcar como desconectado - manter status atual
        if (connectionStatus === null) {
          setIsConnecting(false);
          setQrCode('');
          setPairingCode('');
          return;
        }

        // Só marca como desconectado se connectionStatus for EXPLICITAMENTE false
        // E não estiver conectada no banco
        if (connectionStatus === false && currentInstance?.status !== 'connected') {
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
          return;
        }

        // Se chegou aqui, não temos certeza - não alterar status
        setIsConnecting(false);
        setQrCode('');
        setPairingCode('');
      } catch (error) {
        // Se der erro, manter como está (não marcar como desconectado)
        setIsConnecting(false);
        setQrCode('');
        setPairingCode('');
      }
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
      setConnectToUserId('');
      setChatConfigExpanded(false);
      setChatConfig(null);
      setShowDisconnectOption(false);
      setIsConnecting(false);

      await loadInstances();
      showToast('Conexão cancelada com sucesso!', 'success');
    } catch (error) {
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
          // Marcar instância como sendo excluída para evitar erros de polling
          deletingInstances.current.add(instance.id);

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

          // Remover do Set após um pequeno delay para garantir que polling parou
          setTimeout(() => {
            deletingInstances.current.delete(instance.id);
          }, 5000);
        } catch (error) {
          deletingInstances.current.delete(instance.id);
          showToast('Erro ao excluir instância', 'error');
        }
      },
      'danger'
    );
  }

  async function openConnectModal(instance: WhatsAppInstance) {
    setSelectedInstance(instance);
    setPhoneNumber('');
    setConnectToUserId(instance.user_id); // Inicializar com o dono atual
    setChatConfigExpanded(false);
    
    // Carregar QR code e pairing code do banco se existirem
    const savedQrCode = instance.qr_code || '';
    const savedPairingCode = instance.pairing_code || '';
    
    setQrCode(savedQrCode);
    setPairingCode(savedPairingCode);
    
    // Buscar configurações do chat se a instância tiver chat habilitado
    if (instance.chat_enabled && instance.admin_field_01) {
      try {
        // Buscar configurações do perfil do usuário dono da instância
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('chat_url, chat_api_key, chat_account_id')
          .eq('id', instance.user_id)
          .single();
        
        if (profileError) {
          setChatConfig(null);
          return;
        }
        if (profileData?.chat_url && profileData?.chat_api_key && profileData?.chat_account_id) {
          setChatConfig({
            url: profileData.chat_url,
            apiKey: profileData.chat_api_key,
            accountId: profileData.chat_account_id,
            inboxId: instance.admin_field_01,
          });
        } else {
          setChatConfig(null);
        }
      } catch (error) {
        setChatConfig(null);
      }
    } else {
      setChatConfig(null);
    }
    
    setShowConnectModal(true);
    if (instance.status === 'connecting') {
      setIsConnecting(!savedQrCode && !savedPairingCode); // Só mostrar loading se não tiver QR/pairing code
      if (instance.instance_token) {
        // Se já tem QR code salvo, não precisa fazer polling imediatamente
        // Mas vamos verificar se ainda é válido
        if (!savedQrCode && !savedPairingCode) {
          startStatusPolling(instance);
        } else {
          // Mesmo tendo QR code, vamos fazer polling para verificar se conectou
          startStatusPolling(instance);
        }
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
            <p className="text-sm uppercase tracking-[0.35em] text-slate-400">{isSubUser ? 'Minhas Instâncias' : 'Instâncias'}</p>
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
          {/* Filtros de visualização (Todas, Minhas, Sub-usuários) */}
          {subUsers.length > 0 && (
            <>
              {[
                { label: 'Todas', value: 'all' as const, count: summary.total },
                { label: 'Minhas', value: 'mine' as const, count: summary.myInstances },
                { label: 'Sub-usuários', value: 'sub-users' as const, count: summary.subUserInstances },
              ].map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setViewMode(filter.value)}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
                    viewMode === filter.value
                      ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                  }`}
                >
                  {filter.label}
                  {filter.count !== undefined && (
                    <span className={`rounded-full px-2 py-0.5 text-xs ${
                      viewMode === filter.value
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {filter.count}
                    </span>
                  )}
                </button>
              ))}
              <div className="w-px h-6 bg-slate-200 mx-1" />
            </>
          )}
          
          {/* Filtros de status */}
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Instância
                    </div>
                    {instance.user_id !== user?.id && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700">
                        {(instance as any).user?.email || 'Sub-usuário'}
                      </span>
                    )}
                    {instance.user_id === user?.id && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                        Minha
                      </span>
                    )}
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
                    <>
                      <button
                        onClick={() => openConnectModal(instance)}
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-600 transition hover:bg-emerald-100"
                      >
                        <Power className="h-4 w-4" />
                        Conectar
                      </button>
                    </>
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

            <div className="p-6 space-y-4">
              {subUsers.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Criar para
                  </label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value={user?.id}>Minha conta ({profile?.email})</option>
                    {subUsers.map(subUser => (
                      <option key={subUser.id} value={subUser.id}>
                        {subUser.email}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              <div>
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

              <div className="space-y-3">
                <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                  <div>
                    <p className="font-medium text-gray-900">Conectar ao Chat</p>
                    <p className="text-sm text-gray-500">
                      {selectedUserChatConfig 
                        ? 'Integração configurada e pronta para uso'
                        : 'Ativar integração com sistema de Chat'}
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={chatEnabled}
                      onChange={(e) => {
                        setChatEnabled(e.target.checked);
                        if (!e.target.checked) {
                          setShowManualChatConfig(false);
                        } else if (!selectedUserChatConfig) {
                          setShowManualChatConfig(true);
                        }
                      }}
                      className="sr-only peer"
                    />
                    <div className={`w-11 h-6 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${
                      chatEnabled 
                        ? 'bg-green-500' 
                        : 'bg-gray-200'
                    }`}></div>
                  </label>
                </div>

                {chatEnabled && selectedUserChatConfig && (
                  <div className="border border-green-200 rounded-lg bg-green-50/50">
                    <button
                      type="button"
                      onClick={() => setChatConfigExpanded(!chatConfigExpanded)}
                      className="w-full flex items-center justify-between p-3 text-left hover:bg-green-50 transition-colors rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <div>
                          <p className="text-xs font-semibold text-green-900">Chat Configurado</p>
                          <p className="text-xs text-green-700">Clique para ver configurações</p>
                        </div>
                      </div>
                      {chatConfigExpanded ? (
                        <ChevronUp className="h-4 w-4 text-green-600" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-green-600" />
                      )}
                    </button>
                    
                    {chatConfigExpanded && (
                      <div className="px-3 pb-3 space-y-2 border-t border-green-200 pt-3">
                        <div>
                          <label className="text-xs font-medium text-green-800 mb-1 block">URL do Chat</label>
                          <p className="text-xs text-green-900 bg-white px-2 py-1.5 rounded border border-green-200 break-all">
                            {selectedUserChatConfig.url}
                          </p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-green-800 mb-1 block">API Key</label>
                          <p className="text-xs text-green-900 bg-white px-2 py-1.5 rounded border border-green-200 font-mono">
                            {selectedUserChatConfig.apiKey.length > 20 
                              ? `${selectedUserChatConfig.apiKey.substring(0, 10)}...${selectedUserChatConfig.apiKey.substring(selectedUserChatConfig.apiKey.length - 10)}`
                              : selectedUserChatConfig.apiKey}
                          </p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-green-800 mb-1 block">Account ID</label>
                          <p className="text-xs text-green-900 bg-white px-2 py-1.5 rounded border border-green-200">
                            {selectedUserChatConfig.accountId}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {chatEnabled && !selectedUserChatConfig && (
                  <div className="border border-blue-200 rounded-lg bg-blue-50/50 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="h-4 w-4 text-blue-600" />
                      <p className="text-sm font-semibold text-blue-900">Configurar Chat</p>
                    </div>
                    <p className="text-xs text-blue-700">
                      Preencha as informações abaixo para configurar a integração com o Chat
                    </p>
                    
                    <div>
                      <label className="block text-xs font-medium text-blue-800 mb-1">
                        URL do Chat
                      </label>
                      <input
                        type="text"
                        value={manualChatConfig.url}
                        onChange={(e) => setManualChatConfig({ ...manualChatConfig, url: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="https://chat.exemplo.com.br"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-blue-800 mb-1">
                        API Key
                      </label>
                      <input
                        type="text"
                        value={manualChatConfig.apiKey}
                        onChange={(e) => setManualChatConfig({ ...manualChatConfig, apiKey: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                        placeholder="Sua API Key do Chat"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-blue-800 mb-1">
                        Account ID
                      </label>
                      <input
                        type="text"
                        value={manualChatConfig.accountId}
                        onChange={(e) => setManualChatConfig({ ...manualChatConfig, accountId: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="ID da conta"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={closeCreateModal}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleCreateInstance();
                }}
                disabled={creating}
                type="button"
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

                  {!isSubUser && subUsers.length > 0 && selectedInstance.user_id === user?.id && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Conectar para
                      </label>
                      <select
                        value={connectToUserId}
                        onChange={(e) => setConnectToUserId(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      >
                        <option value={user?.id}>Minha conta ({profile?.email})</option>
                        {subUsers.map(subUser => (
                          <option key={subUser.id} value={subUser.id}>
                            {subUser.email}
                          </option>
                        ))}
                      </select>
                      {connectToUserId !== user?.id && (
                        <p className="mt-1 text-xs text-blue-600">
                          Esta instância será transferida para {subUsers.find(u => u.id === connectToUserId)?.email} após a conexão
                        </p>
                      )}
                    </div>
                  )}

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

              {/* Seção de configurações do chat - aparece sempre que houver configuração */}
              {chatConfig && (
                <div className="border border-green-200 rounded-lg bg-green-50/50">
                  <button
                    type="button"
                    onClick={() => setChatConfigExpanded(!chatConfigExpanded)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-green-50 transition-colors rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="text-sm font-semibold text-green-900">Chat Configurado</p>
                        <p className="text-xs text-green-700">Integração ativa e pronta para uso</p>
                      </div>
                    </div>
                    {chatConfigExpanded ? (
                      <ChevronUp className="h-5 w-5 text-green-600" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-green-600" />
                    )}
                  </button>
                  
                  {chatConfigExpanded && (
                    <div className="px-4 pb-4 space-y-3 border-t border-green-200 pt-4">
                      <div>
                        <label className="text-xs font-medium text-green-800 mb-1 block">URL do Chat</label>
                        <p className="text-sm text-green-900 bg-white px-3 py-2 rounded border border-green-200 break-all">
                          {chatConfig.url}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-green-800 mb-1 block">API Key</label>
                        <p className="text-sm text-green-900 bg-white px-3 py-2 rounded border border-green-200 font-mono">
                          {chatConfig.apiKey.length > 20 
                            ? `${chatConfig.apiKey.substring(0, 10)}...${chatConfig.apiKey.substring(chatConfig.apiKey.length - 10)}`
                            : chatConfig.apiKey}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-green-800 mb-1 block">Account ID</label>
                        <p className="text-sm text-green-900 bg-white px-3 py-2 rounded border border-green-200">
                          {chatConfig.accountId}
                        </p>
                      </div>
                      {chatConfig.inboxId && (
                        <div>
                          <label className="text-xs font-medium text-green-800 mb-1 block">Inbox ID</label>
                          <p className="text-sm text-green-900 bg-white px-3 py-2 rounded border border-green-200">
                            {chatConfig.inboxId}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
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
                  setConnectToUserId('');
                  setChatConfigExpanded(false);
                  setChatConfig(null);
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

