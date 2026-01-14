/**
 * Serviço para invalidar cache do Cloudflare Worker
 * 
 * Quando uma instância é desconectada, podemos chamar este serviço
 * para limpar o cache do Worker imediatamente
 */

const CLOUDFLARE_WORKER_URL = 'https://api.evasend.com.br';

/**
 * Invalida cache de um token específico no Cloudflare Worker
 * 
 * Nota: Isso requer uma API endpoint no Worker para limpar cache
 * Por enquanto, apenas documenta a necessidade
 */
export async function invalidateTokenCache(token: string): Promise<void> {
  try {
    // Opção 1: Se o Worker tiver endpoint de cache invalidation
    // await fetch(`${CLOUDFLARE_WORKER_URL}/cache/invalidate`, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${process.env.CLOUDFLARE_CACHE_KEY}`,
    //   },
    //   body: JSON.stringify({ token }),
    // });

    // Opção 2: Cache expira automaticamente em 5 minutos
    // Não é necessário fazer nada - o cache expirará naturalmente
  } catch (error) {
    // Não falha a operação se cache invalidation falhar
  }
}

/**
 * Função auxiliar para chamar quando instância é desconectada
 * 
 * Uso:
 * await supabase.from('whatsapp_instances').update({ status: 'disconnected' });
 * await invalidateTokenCache(instance.instance_token);
 */
export const cacheService = {
  invalidateToken: invalidateTokenCache,
};

