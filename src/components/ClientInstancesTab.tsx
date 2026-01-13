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
      console.error('Erro ao copiar token:', error);
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
        console.error('Error loading selected user chat config:', error);
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
      console.error('Error loading sub-users:', error);
      return Promise.resolve();
    }
  }

  // Verificação periódica do status de todas as instâncias conectadas
  // Helper function para determinar o status de conexão baseado na resposta da API
  // Retorna: true (conectado), false (desconectado), null (indeterminado - não mudar status)
  // POLÍTICA: Ser MUITO CONSERVADOR - só retorna false se tiver ABSOLUTA CERTEZA
  function getConnectionStatus(statusResponse: any, instanceName: string): boolean | null {
    const statusData = statusResponse?.status;
    const instanceData = statusResponse?.instance;

    // Verificar se a resposta é válida
    if (!statusResponse || (typeof statusResponse !== 'object')) {
      console.log(`[STATUS_CHECK:${instanceName}] ⚠️ Resposta inválida - mantendo status atual`);
      return null;
    }

    // INDICADORES DE CONEXÃO - Qualquer um desses indica que está conectado
    // Prioridade: verificar indicadores mais confiáveis primeiro
    const hasLoggedInTrue = statusData?.loggedIn === true;
    const hasConnectedTrue = statusData?.connected === true;
    const hasJid = statusData?.jid && typeof statusData.jid === 'string' && statusData.jid.includes('@');
    const hasOwner = instanceData?.owner && typeof instanceData.owner === 'string' && instanceData.owner.length > 0;
    const hasPhoneNumber = (instanceData?.phone_number && instanceData.phone_number.length > 0) || 
                          (statusData?.phone_number && statusData.phone_number.length > 0);
    const hasProfileName = instanceData?.profileName && typeof instanceData.profileName === 'string' && instanceData.profileName.length > 0;
    // Verificação adicional: status como string "connected" no instanceData
    const hasStatusConnected = instanceData?.status === 'connected' || instanceData?.status === 'Connected';
    
    // Se tem QUALQUER indicador positivo de conexão, está conectado
    // PRIORIDADE: loggedIn e connected são os mais confiáveis
    if (hasLoggedInTrue || hasConnectedTrue) {
      console.log(`[STATUS_CHECK:${instanceName}] ✅ CONECTADO - loggedIn/connected = true`);
      return true;
    }
    
    // Se tem JID válido, está conectado (JID só existe quando conectado)
    if (hasJid) {
      console.log(`[STATUS_CHECK:${instanceName}] ✅ CONECTADO - JID presente`);
      return true;
    }
    
    // Verificar se há QR code ou pairing code ativo - se houver, NÃO está conectado ainda
    const hasQrCode = (instanceData?.qrcode && instanceData.qrcode.length > 0) || 
                     (statusResponse?.qrCode && statusResponse.qrCode.length > 0);
    const hasPairingCode = (instanceData?.paircode && instanceData.paircode.length > 0) || 
                          (statusResponse?.pairingCode && statusResponse.pairingCode.length > 0);
    
    // Se tem QR code ou pairing code, está em processo de conexão, não conectado
    if (hasQrCode || hasPairingCode) {
      console.log(`[STATUS_CHECK:${instanceName}] ⚠️ EM CONEXÃO - QR/Pairing code presente, não marcar como conectado`);
      return null; // Manter status atual (provavelmente "connecting" ou "disconnected")
    }
    
    // Se tem owner, phone_number, profileName ou status="connected", provavelmente está conectado
    // MAS só se NÃO tiver QR code ativo (verificado acima)
    if (hasOwner || hasPhoneNumber || hasProfileName || hasStatusConnected) {
      console.log(`[STATUS_CHECK:${instanceName}] ✅ CONECTADO - Indicadores secundários:`, {
        hasOwner: !!hasOwner,
        hasPhoneNumber: !!hasPhoneNumber,
        hasProfileName: !!hasProfileName,
        hasStatusConnected: !!hasStatusConnected
      });
      return true;
    }

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
      
      console.log(`[STATUS_CHECK:${instanceName}] ❌ DESCONECTADO - Confirmação absoluta (todos indicadores negativos)`);
      return false;
    }
    
    // IMPORTANTE: Se não temos certeza absoluta, retornamos null
    // Isso faz com que o status atual seja mantido (especialmente se estiver como "connected")
    // POLÍTICA: Em caso de dúvida, manter como conectado
    console.log(`[STATUS_CHECK:${instanceName}] ⚠️ INDETERMINADO - Mantendo status atual (política conservadora)`);
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
        for (const instance of allInstances) {
          if (!instance.instance_token) continue;

          try {
            const status = await whatsappApi.getInstanceStatus(instance.instance_token);
            const connectionStatus = getConnectionStatus(status, instance.name);
            const statusData = (status as any).status;
            const phoneNumber = extractPhoneNumber(status);

            // PROTEÇÃO CRÍTICA: Se está conectado no banco e status é null/indeterminado, 
            // NUNCA marcar como desconectado - manter como conectado
            // ADICIONAL: Se a resposta da API tem QUALQUER indicador positivo, considerar conectado
            if (instance.status === 'connected') {
              if (connectionStatus === null) {
                // Status indeterminado mas está conectado no banco - verificar indicadores na resposta
                const statusData = (status as any).status;
                const instanceData = (status as any).instance;
                
                // Verificar se há QUALQUER indicador positivo na resposta (mesmo que não detectado pela função)
                const hasAnyPositiveIndicator = 
                  statusData?.loggedIn === true ||
                  statusData?.connected === true ||
                  (statusData?.jid && typeof statusData.jid === 'string' && statusData.jid.includes('@')) ||
                  (instanceData?.owner && typeof instanceData.owner === 'string' && instanceData.owner.length > 0) ||
                  (instanceData?.phone_number && instanceData.phone_number.length > 0) ||
                  (statusData?.phone_number && statusData.phone_number.length > 0) ||
                  (instanceData?.profileName && typeof instanceData.profileName === 'string' && instanceData.profileName.length > 0) ||
                  instanceData?.status === 'connected';
                
                if (hasAnyPositiveIndicator) {
                  console.log(`[SYNC] Instância ${instance.name}: Status indeterminado mas tem indicadores positivos na API - MANTENDO como conectada`);
                  // Atualizar dados se necessário (número, etc) mas manter como conectado
                  const updates: any = {};
                  if (phoneNumber && phoneNumber !== instance.phone_number) {
                    updates.phone_number = phoneNumber;
                  }
                  if (Object.keys(updates).length > 0) {
                    await supabase
                      .from('whatsapp_instances')
                      .update(updates)
                      .eq('id', instance.id);
                  }
                  continue;
                }
                
                // Se não tem indicadores positivos mas está conectado no banco, manter como conectado
                console.log(`[SYNC] Instância ${instance.name}: Status indeterminado mas está conectada no banco - MANTENDO como conectada`);
                continue;
              }
              
              // Se connectionStatus === true, já será tratado abaixo
              // Se connectionStatus === false, será tratado com verificação dupla abaixo
            }

            const isConnectedInApi = connectionStatus === true;

            // Se está conectado na API mas desconectado no banco, atualizar para conectado
            if (isConnectedInApi && instance.status !== 'connected') {
              await supabase
                .from('whatsapp_instances')
                .update({
                  status: 'connected',
                  phone_number: phoneNumber || instance.phone_number || null,
                  qr_code: null,
                  pairing_code: null,
                  last_disconnect_reason: null,
                  last_disconnect_at: null,
                })
                .eq('id', instance.id);

              console.log(`[SYNC] Instância ${instance.name} está conectada na API - sincronizando banco`);
              
              // Recarregar lista apenas se mudou de desconectado para conectado
              if (instance.status === 'disconnected') {
                loadInstances();
                showToast(`Instância "${instance.name}" reconectou automaticamente.`, 'success');
                
                // Configurar Chatwoot se necessário (após recarregar para ter dados atualizados)
                const { data: updatedInstance } = await supabase
                  .from('whatsapp_instances')
                  .select('*')
                  .eq('id', instance.id)
                  .single();
                
                if (updatedInstance) {
                  await configureChatwootIfNeeded(updatedInstance as WhatsAppInstance);
                }
              }
              continue;
            }

            // NOVA LÓGICA: Se está desconectada no banco e status é null, verificar indicadores parciais
            // Isso corrige casos onde a API está conectada mas retorna resposta incompleta
            if (connectionStatus === null && instance.status === 'disconnected') {
              const statusData = (status as any).status;
              const instanceData = (status as any).instance;
              
              // Verificar indicadores parciais que podem indicar conexão
              const hasPartialIndicators = 
                (statusData?.jid && typeof statusData.jid === 'string' && statusData.jid.includes('@')) ||
                (instanceData?.owner && typeof instanceData.owner === 'string') ||
                (instanceData?.phone_number || statusData?.phone_number) ||
                (instanceData?.profileName) ||
                phoneNumber; // Já extraído acima
              
              // Se tem indicadores parciais, dar o benefício da dúvida e marcar como conectada
              // (já que está desconectada no banco mas pode estar conectada na API)
              if (hasPartialIndicators) {
                console.log(`[SYNC] Instância ${instance.name}: Status indeterminado mas tem indicadores parciais de conexão - ATUALIZANDO para conectada`);
                await supabase
                  .from('whatsapp_instances')
                  .update({
                    status: 'connected',
                    phone_number: phoneNumber || instance.phone_number || null,
                    qr_code: null,
                    pairing_code: null,
                    last_disconnect_reason: null,
                    last_disconnect_at: null,
                  })
                  .eq('id', instance.id);

                loadInstances();
                showToast(`Instância "${instance.name}" reconectou automaticamente.`, 'success');
                
                // Configurar Chatwoot se necessário
                const { data: updatedInstance } = await supabase
                  .from('whatsapp_instances')
                  .select('*')
                  .eq('id', instance.id)
                  .single();
                
                if (updatedInstance) {
                  await configureChatwootIfNeeded(updatedInstance as WhatsAppInstance);
                }
              }
              continue;
            }

            // Se connectionStatus é null e instância já está conectada, não alterar (já tratado acima)
            if (connectionStatus === null) {
              continue;
            }

            // Se está conectado na API mas desconectado no banco, atualizar para conectado (já tratado acima)
            if (isConnectedInApi && instance.status !== 'connected') {
              await supabase
                .from('whatsapp_instances')
                .update({
                  status: 'connected',
                  phone_number: phoneNumber || instance.phone_number || null,
                  qr_code: null,
                  pairing_code: null,
                  last_disconnect_reason: null,
                  last_disconnect_at: null,
                })
                .eq('id', instance.id);

              console.log(`[SYNC] Instância ${instance.name} está conectada na API - sincronizando banco`);
              
              // Recarregar lista apenas se mudou de desconectado para conectado
              if (instance.status === 'disconnected') {
                loadInstances();
                showToast(`Instância "${instance.name}" reconectou automaticamente.`, 'success');
              }
            }
            // PROTEÇÃO CRÍTICA: Só marcar como desconectado se:
            // 1. API diz explicitamente que está desconectado (connectionStatus === false, não null)
            // 2. E instância está conectada no banco
            // 3. E verificação dupla confirma desconexão
            // IMPORTANTE: Se connectionStatus for null (indeterminado), já foi tratado acima e mantém como conectado
            else if (connectionStatus === false && instance.status === 'connected') {
              // Verificação adicional: garantir que realmente está desconectado
              // Se há QR code ou pairing code, pode estar em processo de conexão, não marcar como desconectado
              const hasQrCode = statusData?.qrcode || (status as any).instance?.qrcode || (status as any).qrCode;
              const hasPairingCode = statusData?.paircode || (status as any).instance?.paircode || (status as any).pairingCode;
              
              if (hasQrCode || hasPairingCode) {
                console.log(`[SYNC] Instância ${instance.name}: Tem QR/Pairing code, mantendo como conectada`);
                continue;
              }

              // VERIFICAÇÃO DUPLA: Antes de marcar como desconectado, verificar novamente na API
              console.log(`[SYNC] ⚠️ API diz desconectado para ${instance.name} mas está conectada no banco - verificando novamente...`);
              try {
                await new Promise(resolve => setTimeout(resolve, 1000));
                const secondStatus = await whatsappApi.getInstanceStatus(instance.instance_token!);
                const secondConnectionStatus = getConnectionStatus(secondStatus, instance.name);
                
                // Só marcar como desconectado se a segunda verificação também confirmar
                if (secondConnectionStatus === false) {
                  await supabase
                    .from('whatsapp_instances')
                    .update({
                      status: 'disconnected',
                      last_disconnect_reason: statusData?.disconnectReason || 'Desconexão confirmada na API (verificação dupla)',
                      last_disconnect_at: new Date().toISOString(),
                      qr_code: null,
                      pairing_code: null,
                    })
                    .eq('id', instance.id);

                  console.log(`[SYNC] ⚠️ Instância ${instance.name} desconectou na API (confirmado em verificação dupla) - sincronizando banco`);
                  loadInstances();
                  showToast(`Instância "${instance.name}" desconectou.`, 'warning');
                } else {
                  // Segunda verificação não confirma desconexão - manter como conectado
                  console.log(`[SYNC] ✅ Segunda verificação para ${instance.name} não confirma desconexão - mantendo como conectada`);
                  if (secondConnectionStatus === true) {
                    // Se na segunda verificação está conectado, atualizar dados
                    const secondPhoneNumber = extractPhoneNumber(secondStatus);
                    await supabase
                      .from('whatsapp_instances')
                      .update({
                        phone_number: secondPhoneNumber || instance.phone_number || null,
                      })
                      .eq('id', instance.id);
                  }
                }
              } catch (secondError) {
                // Se segunda verificação falhar, manter como conectado
                console.warn(`[SYNC] Segunda verificação falhou para ${instance.name} - mantendo como conectado:`, secondError);
              }
            }
            // Se ambos estão conectados, atualizar dados (número, etc) se necessário
            else if (isConnectedInApi && instance.status === 'connected') {
              const updates: any = {};
              
              if (phoneNumber && phoneNumber !== instance.phone_number) {
                updates.phone_number = phoneNumber;
              }

              if (Object.keys(updates).length > 0) {
                await supabase
                  .from('whatsapp_instances')
                  .update(updates)
                  .eq('id', instance.id);
              }
            }
          } catch (error: any) {
            // Se houver erro ao consultar a API, NÃO alteramos o status no banco
            // Isso evita marcar como desconectado quando a API está temporariamente indisponível
            console.warn(`[SYNC] Erro ao verificar instância ${instance.name} na API (mantendo status atual):`, error?.message || error);
            
            // Apenas logar o erro, mas não alterar o status
            // O status atual no banco será mantido até a próxima verificação bem-sucedida
          }
        }
      } catch (error) {
        console.error('[SYNC] Erro geral na sincronização:', error);
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
                console.log(`[LOAD] ⚠️ API diz desconectado mas instância ${inst.name} está conectada no banco - verificando novamente...`);
                
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
                    console.log(`[LOAD] ✅ Segunda verificação confirma que ${inst.name} está conectada`);
                    // Não adicionar à lista de atualizações - manter como conectado
                  }
                  // Se secondConnectionStatus === null, manter status atual (conectado)
                } catch (secondError) {
                  // Se segunda verificação falhar, manter status atual (conectado)
                  console.warn(`[LOAD] Segunda verificação falhou para ${inst.name} - mantendo como conectado`);
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
            console.warn(`[LOAD] Erro ao verificar status da instância ${inst.name} na API (mantendo status atual):`, error);
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
      console.error('Error loading instances:', error);
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
      console.log(`[CHATWOOT] Integração já está sendo configurada para instância ${instance.name} (lock local)`);
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
        console.log(`[CHATWOOT] Integração já configurada para instância ${instance.name} (verificado no banco)`);
        return;
      }
      
      if (currentInstance?.admin_field_02 === 'chatwoot_configuring') {
        console.log(`[CHATWOOT] Integração já está sendo configurada para instância ${instance.name} (verificado no banco)`);
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
          console.log(`[CHATWOOT] Integração já está sendo configurada/configurada por outra requisição`);
          return;
        }
        
        // Se não está configurando/configurado, pode ser erro de rede - tentar continuar
        console.warn(`[CHATWOOT] Erro ao marcar como "configurando" no banco, mas continuando:`, updateError);
      }
      
      // Marca no lock local APÓS confirmar no banco
      chatwootConfiguring.current.add(instance.id);
    } catch (error) {
      console.warn(`[CHATWOOT] Erro ao verificar/marcar no banco:`, error);
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
        console.log(`[CHATWOOT] Configurações do Chat não encontradas para usuário`);
        return;
      }

      const inboxId = parseInt(instance.admin_field_01, 10);
      if (isNaN(inboxId)) {
        console.error(`[CHATWOOT] Inbox ID inválido: ${instance.admin_field_01}`);
        return;
      }

      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.evasend.com.br/whatsapp';
      
      console.log(`[CHATWOOT] Configurando integração completa via /chatwoot/config para instância ${instance.name}...`);
      
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
        console.log(`[CHATWOOT] ✅ Integração configurada com sucesso para instância ${instance.name}:`, configData);
        
        // Marcar como configurado no banco
        await supabase
          .from('whatsapp_instances')
          .update({ admin_field_02: 'chatwoot_configured' })
          .eq('id', instance.id);
        
        // Remover do lock
        chatwootConfiguring.current.delete(instance.id);
        
        // Verifica se o webhook foi configurado
        if (configData.webhook_url || configData.channel_webhook_updated || configData.webhook_updated_in_chatwoot) {
          console.log(`[CHATWOOT] ✅ Webhook configurado automaticamente via /chatwoot/config`);
          
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
            console.warn(`[CHATWOOT] Não foi possível buscar o nome da inbox, usando nome da instância:`, error);
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
        console.error(`[CHATWOOT] Erro ao configurar integração para instância ${instance.name}:`, configErrorData);
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
      console.error(`[CHATWOOT] Erro ao chamar /chatwoot/config para instância ${instance.name}:`, error);
      
      // Remover do lock mesmo em caso de erro
      chatwootConfiguring.current.delete(instance.id);
      
      // Remover flag de "configurando" do banco para permitir nova tentativa
      try {
        await supabase
          .from('whatsapp_instances')
          .update({ admin_field_02: null })
          .eq('id', instance.id);
      } catch (dbError) {
        console.warn(`[CHATWOOT] Erro ao remover flag de "configurando":`, dbError);
      }
    }
  }

  async function handleCreateInstance() {
    console.log('[CREATE_INSTANCE] Iniciando criação de instância...', {
      instanceName,
      chatEnabled,
      hasSelectedConfig: !!selectedUserChatConfig,
      hasManualConfig: !!(manualChatConfig.url && manualChatConfig.apiKey && manualChatConfig.accountId)
    });

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

      console.log('[CREATE_INSTANCE] Validação do chat:', {
        chatEnabled,
        hasSelectedConfig: !!selectedUserChatConfig,
        hasManualConfig: !!(manualChatConfig.url && manualChatConfig.apiKey && manualChatConfig.accountId),
        chatConfigToValidate: chatConfigToValidate ? {
          hasUrl: !!chatConfigToValidate.url?.trim(),
          hasApiKey: !!chatConfigToValidate.apiKey?.trim(),
          hasAccountId: !!chatConfigToValidate.accountId?.trim()
        } : null
      });

      if (!chatConfigToValidate) {
        console.warn('[CREATE_INSTANCE] Chat ativado mas sem configurações');
        showToast('Preencha todas as configurações do Chat (URL, API Key e Account ID) ou desative a integração', 'warning');
        return;
      }

      // Converter accountId para string antes de validar (pode ser número)
      const accountIdStr = String(chatConfigToValidate.accountId || '').trim();
      
      if (!chatConfigToValidate.url?.trim() || !chatConfigToValidate.apiKey?.trim() || !accountIdStr) {
        console.warn('[CREATE_INSTANCE] Chat ativado mas configurações incompletas');
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
          console.warn('Erro ao verificar status inicial da instância:', error);
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
                console.log('[CHATWOOT] Inbox criada com sucesso:', inboxData);
                
                // Atualizar a instância com o inbox_id
                // A configuração completa via /chatwoot/config será feita após a conexão
                await supabase
                  .from('whatsapp_instances')
                  .update({ admin_field_01: inboxId.toString() })
                  .eq('id', newInstanceData.id);
                
                console.log('[CHATWOOT] Inbox criada. A integração será configurada automaticamente após a conexão da instância.');
              } else {
                let errorData;
                try {
                  errorData = await inboxResponse.json();
                } catch {
                  const errorText = await inboxResponse.text();
                  errorData = { error: errorText, status: inboxResponse.status };
                }
                console.error('[CHATWOOT] Erro ao criar inbox:', errorData);
                console.error('[CHATWOOT] Status:', inboxResponse.status);
                console.error('[CHATWOOT] Response headers:', Object.fromEntries(inboxResponse.headers.entries()));
                // Não falhar a criação da instância se a inbox falhar
                const errorMessage = errorData.details?.message || errorData.error || 'Erro desconhecido';
                showToast(`Instância criada, mas não foi possível criar a inbox no Chat: ${errorMessage}`, 'warning');
              }
            } catch (chatError: any) {
              console.error('[CHATWOOT] Erro ao criar inbox:', chatError);
              // Não falhar a criação da instância se a inbox falhar
              showToast('Instância criada, mas não foi possível criar a inbox no Chat. Verifique as configurações.', 'warning');
            }
          } else {
            // Já tem inbox_id, usar o existente
            inboxId = parseInt(newInstanceData.admin_field_01, 10);
            console.log(`[CHATWOOT] Instância já tem inbox_id: ${inboxId}, não criando duplicado.`);
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
              
              console.log('[CHAT_CONFIG] Configurações salvas no perfil do usuário');
              // Atualizar o estado para refletir as configurações salvas
              setSelectedUserChatConfig(manualChatConfig);
            }
          } catch (error) {
            console.error('[CHAT_CONFIG] Erro ao salvar configurações no perfil:', error);
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
      console.error('[CREATE_INSTANCE] Erro ao criar instância:', error);
      console.error('[CREATE_INSTANCE] Detalhes do erro:', {
        message: error?.message,
        stack: error?.stack,
        response: error?.response,
        data: error?.data
      });
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
        console.error('Error transferring instance:', error);
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

      console.log('[CONNECT] Resposta da API connectInstance:', response);

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

      console.log('[CONNECT] QR code encontrado na resposta inicial:', qr ? 'Sim' : 'Não');
      console.log('[CONNECT] Pairing code encontrado na resposta inicial:', code ? 'Sim' : 'Não');

      if (qr) {
        setQrCode(qr);
        setPairingCode('');
        setIsConnecting(false);
        await supabase
          .from('whatsapp_instances')
          .update({ qr_code: qr })
          .eq('id', selectedInstance.id);
        console.log('[CONNECT] QR code definido do estado');
      } else if (code) {
        setPairingCode(code);
        setQrCode('');
        setIsConnecting(false);
        await supabase
          .from('whatsapp_instances')
          .update({ pairing_code: code })
          .eq('id', selectedInstance.id);
        console.log('[CONNECT] Pairing code definido do estado');
      } else {
        // Se não veio na resposta inicial, buscar imediatamente no status
        console.log('[CONNECT] QR code não veio na resposta inicial, buscando no status...');
        try {
          const status = await whatsappApi.getInstanceStatus(selectedInstance.instance_token);
          console.log('[CONNECT] Resposta do getInstanceStatus:', status);
          
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

          console.log('[CONNECT] QR code do status:', qrFromStatus ? 'Sim' : 'Não');
          console.log('[CONNECT] Pairing code do status:', codeFromStatus ? 'Sim' : 'Não');

          if (qrFromStatus && qrFromStatus.trim() !== '') {
            setQrCode(qrFromStatus);
            setPairingCode('');
            setIsConnecting(false);
            await supabase
              .from('whatsapp_instances')
              .update({ qr_code: qrFromStatus })
              .eq('id', selectedInstance.id);
            console.log('[CONNECT] QR code definido do status');
          } else if (codeFromStatus && codeFromStatus.trim() !== '') {
            setPairingCode(codeFromStatus);
            setQrCode('');
            setIsConnecting(false);
            await supabase
              .from('whatsapp_instances')
              .update({ pairing_code: codeFromStatus })
              .eq('id', selectedInstance.id);
            console.log('[CONNECT] Pairing code definido do status');
          } else {
            console.log('[CONNECT] QR code ainda não disponível, iniciando polling...');
          }
        } catch (statusError) {
          console.error('[CONNECT] Erro ao buscar status inicial:', statusError);
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
    let timeoutId: NodeJS.Timeout | null = null;

    const interval = setInterval(async () => {
      if (!instance.instance_token) return;
      pollCount++;

      try {
        const status = await whatsappApi.getInstanceStatus(instance.instance_token);

        const instanceData = (status as any).instance;
        const statusData = (status as any).status;
        
        // Usar a mesma lógica robusta para detectar conexão
        const connectionStatus = getConnectionStatus(status, instance.name);
        const isConnected = connectionStatus === true;
        
        // Verificar QR code em TODOS os formatos possíveis
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
        
        const phoneNumber = extractPhoneNumber(status);
        
        // Log para debug
        if (pollCount <= 3 || qrCodeFromApi || pairingCodeFromApi) {
          console.log(`[POLLING:${instance.name}] Tentativa ${pollCount}:`, {
            isConnected,
            hasQrCode: !!qrCodeFromApi,
            hasPairingCode: !!pairingCodeFromApi,
            instanceData: !!instanceData,
            statusData: !!statusData
          });
        }

        // IMPORTANTE: Não marcar como conectado se ainda houver QR code ou pairing code ativo
        // Isso evita falsos positivos quando o QR code ainda não foi lido
        if (isConnected && !qrCodeFromApi && !pairingCodeFromApi) {
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
          console.log(`[POLLING] Instância ${instance.name} já está conectada no banco - mantendo como conectada após timeout`);
          setIsConnecting(false);
          setQrCode('');
          setPairingCode('');
          return;
        }

        // Se status é null (indeterminado), não marcar como desconectado - manter status atual
        if (connectionStatus === null) {
          console.log(`[POLLING] Instância ${instance.name}: Status indeterminado na API após timeout - mantendo status atual`);
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
        console.log(`[POLLING] Instância ${instance.name}: Não foi possível determinar status após timeout - mantendo status atual`);
        setIsConnecting(false);
        setQrCode('');
        setPairingCode('');
      } catch (error) {
        console.error('Erro ao verificar status antes do timeout:', error);
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
      setConnectToUserId('');
      setChatConfigExpanded(false);
      setChatConfig(null);
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
        console.log('[CHAT_CONFIG] Buscando configurações do chat para instância:', {
          instanceId: instance.id,
          userId: instance.user_id,
          chatEnabled: instance.chat_enabled,
          inboxId: instance.admin_field_01
        });
        
        // Buscar configurações do perfil do usuário dono da instância
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('chat_url, chat_api_key, chat_account_id')
          .eq('id', instance.user_id)
          .single();
        
        if (profileError) {
          console.error('[CHAT_CONFIG] Erro ao buscar perfil:', profileError);
          setChatConfig(null);
          return;
        }
        
        console.log('[CHAT_CONFIG] Dados do perfil encontrados:', {
          hasUrl: !!profileData?.chat_url,
          hasApiKey: !!profileData?.chat_api_key,
          hasAccountId: !!profileData?.chat_account_id
        });
        
        if (profileData?.chat_url && profileData?.chat_api_key && profileData?.chat_account_id) {
          setChatConfig({
            url: profileData.chat_url,
            apiKey: profileData.chat_api_key,
            accountId: profileData.chat_account_id,
            inboxId: instance.admin_field_01,
          });
          console.log('[CHAT_CONFIG] Configurações do chat carregadas com sucesso');
        } else {
          console.warn('[CHAT_CONFIG] Configurações do chat incompletas no perfil');
          setChatConfig(null);
        }
      } catch (error) {
        console.error('[CHAT_CONFIG] Erro ao carregar configurações do chat:', error);
        setChatConfig(null);
      }
    } else {
      console.log('[CHAT_CONFIG] Instância não tem chat habilitado ou inbox_id:', {
        chatEnabled: instance.chat_enabled,
        hasInboxId: !!instance.admin_field_01
      });
      setChatConfig(null);
    }
    
    setShowConnectModal(true);

    console.log('[MODAL] Abrindo modal de conexão:', {
      instanceName: instance.name,
      status: instance.status,
      hasQrCode: !!savedQrCode,
      hasPairingCode: !!savedPairingCode,
      chatEnabled: instance.chat_enabled,
      hasInboxId: !!instance.admin_field_01
    });

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
                  console.log('[BUTTON] Botão Criar clicado');
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

