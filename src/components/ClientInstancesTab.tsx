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
    
    // Se tem owner, phone_number, profileName ou status="connected", provavelmente está conectado
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
    // 3. E não ter QR code ou pairing code (pode estar conectando)
    // 4. E ter estrutura de resposta válida (statusData e instanceData existem)
    const hasQrCode = (instanceData?.qrcode && instanceData.qrcode.length > 0) || 
                     (statusResponse?.qrCode && statusResponse.qrCode.length > 0);
    const hasPairingCode = (instanceData?.paircode && instanceData.paircode.length > 0) || 
                          (statusResponse?.pairingCode && statusResponse.pairingCode.length > 0);
    
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
        // Buscar todas as instâncias com token (conectadas ou desconectadas no banco)
        const { data: allInstances, error } = await supabase
          .from('whatsapp_instances')
          .select('*')
          .eq('user_id', user.id)
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
    try {
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('user_id', user?.id || '')
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

          // Recarregar do banco após atualizar status
          const { data: updatedData } = await supabase
            .from('whatsapp_instances')
            .select('*')
            .eq('user_id', user?.id || '')
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

        const { error } = await supabase
          .from('whatsapp_instances')
          .insert({
            user_id: user?.id || '',
            name: instanceName,
            instance_token: response.token,
            system_name: 'apilocal',
            status: initialStatus,
          });

        if (error) throw error;

        showToast('Instância criada com sucesso!', 'success');
        closeCreateModal();
        await loadInstances();

        // Buscar a instância recém-criada e abrir modal de conexão automaticamente
        const { data: newInstance } = await supabase
          .from('whatsapp_instances')
          .select('*')
          .eq('instance_token', response.token)
          .eq('user_id', user?.id || '')
          .single();

        if (newInstance && newInstance.status === 'disconnected') {
          // Aguardar um pouco para garantir que a instância foi criada
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Abrir modal de conexão automaticamente
          setSelectedInstance(newInstance);
          setPhoneNumber('');
          setQrCode('');
          setPairingCode('');
          setShowConnectModal(true);
          setIsConnecting(true);

          // Iniciar conexão automaticamente para gerar QR Code
          try {
            const connectResponse = await whatsappApi.connectInstance(
              newInstance.instance_token,
              undefined // Sem telefone = gera QR Code
            );

            await supabase
              .from('whatsapp_instances')
              .update({
                status: 'connecting',
                phone_number: null,
              })
              .eq('id', newInstance.id);

            if (connectResponse.qrCode || connectResponse.pairingCode || connectResponse.code) {
              const qr = connectResponse.qrCode || connectResponse.qr || null;
              const code = connectResponse.pairingCode || connectResponse.code || null;

              if (qr) {
                setQrCode(qr);
                setPairingCode('');
                await supabase
                  .from('whatsapp_instances')
                  .update({ qr_code: qr })
                  .eq('id', newInstance.id);
              } else if (code) {
                setPairingCode(code);
                setQrCode('');
                await supabase
                  .from('whatsapp_instances')
                  .update({ pairing_code: code })
                  .eq('id', newInstance.id);
              }
            }

            // Iniciar polling de status
            startStatusPolling(newInstance);
          } catch (connectError: any) {
            console.error('Erro ao conectar automaticamente:', connectError);
            setIsConnecting(false);
            // Não mostrar erro aqui, apenas logar - o usuário pode tentar conectar manualmente depois
          }
        }
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
        
        const qrCodeFromApi = instanceData?.qrcode || status.qrCode;
        const pairingCodeFromApi = instanceData?.paircode || status.pairingCode;
        const phoneNumber = extractPhoneNumber(status);

        if (isConnected) {
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

    // Timeout de segurança - mas antes de marcar como desconectado, verificar na API
    timeoutId = setTimeout(async () => {
      clearInterval(interval);
      
      // ANTES de marcar como desconectado, verificar uma última vez na API
      try {
        const status = await whatsappApi.getInstanceStatus(instance.instance_token);
        const connectionStatus = getConnectionStatus(status, instance.name);
        
        // Se está conectado na API, atualizar para conectado em vez de desconectado
        if (connectionStatus === true) {
          const phoneNumber = extractPhoneNumber(status);
          const instanceData = (status as any).instance;
          
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

