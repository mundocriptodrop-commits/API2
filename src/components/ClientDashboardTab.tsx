import { useState, useEffect, useMemo } from 'react';
import type { MouseEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { whatsappApi } from '../services/whatsapp';
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

  // Sincronização periódica do status com a API
  useEffect(() => {
    if (!user) return;

    // Verificar TODAS as instâncias para sincronizar status com a API
    const checkInterval = setInterval(async () => {
      try {
        // Buscar todas as instâncias com token
        const { data: allInstances, error } = await supabase
          .from('whatsapp_instances')
          .select('*')
          .eq('user_id', user.id)
          .not('instance_token', 'is', null);

        if (error || !allInstances || allInstances.length === 0) {
          return;
        }

        // Verificar cada instância e sincronizar status
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
              await loadInstances();
              continue;
            }

            // NOVA LÓGICA: Se está desconectada no banco e status é null, verificar indicadores parciais
            if (connectionStatus === null && instance.status === 'disconnected') {
              const statusData = (status as any).status;
              const instanceData = (status as any).instance;
              
              // Verificar indicadores parciais que podem indicar conexão
              const hasPartialIndicators = 
                (statusData?.jid && typeof statusData.jid === 'string' && statusData.jid.includes('@')) ||
                (instanceData?.owner && typeof instanceData.owner === 'string') ||
                (instanceData?.phone_number || statusData?.phone_number) ||
                (instanceData?.profileName) ||
                phoneNumber;
              
              // Se tem indicadores parciais, dar o benefício da dúvida e marcar como conectada
              if (hasPartialIndicators) {
                console.log(`[SYNC] Instância ${instance.name}: Status indeterminado mas tem indicadores parciais - ATUALIZANDO para conectada`);
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

                await loadInstances();
              }
              continue;
            }

            // Se connectionStatus é null e instância já está conectada, não alterar
            if (connectionStatus === null) {
              continue;
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
                  await loadInstances();
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
            // Se ambos estão conectados, atualizar dados se necessário
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
            // Se houver erro, NÃO alteramos o status (API pode estar temporariamente indisponível)
            console.warn(`[SYNC] Erro ao verificar instância ${instance.name} (mantendo status atual):`, error?.message || error);
          }
        }
      } catch (error) {
        console.error('[SYNC] Erro geral na sincronização:', error);
      }
    }, 30000); // Verificar a cada 30 segundos

    return () => clearInterval(checkInterval);
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
          }
        } else {
          // Se não houve atualizações, apenas definir as instâncias
          setInstances(data || []);
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
