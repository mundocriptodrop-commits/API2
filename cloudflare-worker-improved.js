// Cloudflare Worker para api.evasend.com.br
// Suporta múltiplas instâncias - cada cliente tem seu próprio token
// Deploy: https://dash.cloudflare.com/workers

// Configurações via Environment Variables (Cloudflare Dashboard → Workers → Settings → Variables)
// Variáveis disponíveis:
// - SUPABASE_URL: URL do projeto Supabase
// - SUPABASE_ANON_KEY: Chave anon do Supabase
// - SUPABASE_SERVICE_KEY: Chave service_role do Supabase (usada para registrar métricas)
// - DEBUG: 'true' para logs detalhados, 'false' para produção
// - RATE_LIMIT: Limite de requisições por minuto (padrão: 1000)

// Valores padrão (usados se variáveis de ambiente não estiverem configuradas)
const DEFAULT_SUPABASE_URL = 'https://ctshqbxxlauulzsbapjb.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0c2hxYnh4bGF1dWx6c2JhcGpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzODgzMzUsImV4cCI6MjA3Nzk2NDMzNX0.NUcOBwoVOC4eE8BukporxYVzDyh0RAc8iQ1dM9qbalY';
const DEFAULT_DEBUG_MODE = false;
const DEFAULT_RATE_LIMIT = 1000;

// Cache simples para validações (opcional - reduz chamadas ao banco)
// Cache expira em 5 minutos
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Cache para controle de duplicação de webhooks do Chatwoot
// Usa Cache API do Cloudflare para cache compartilhado entre instâncias
const CHATWOOT_CACHE_TTL = 10 * 60; // 10 minutos em segundos (aumentado para prevenir duplicação)

/**
 * Gera uma chave única para identificar webhooks duplicados do Chatwoot
 * Usa event_id, message_id ou hash do conteúdo
 * Prioriza campos que identificam unicamente a mensagem
 */
function generateChatwootWebhookKey(webhookBody, instanceId) {
  try {
    const body = typeof webhookBody === 'string' ? JSON.parse(webhookBody) : webhookBody;
    
    // Prioridade 1: event_id do Chatwoot (mais confiável - único por evento)
    if (body.event_id) {
      const key = `chatwoot:${instanceId}:event:${body.event_id}`;
      console.log(`[CACHE_KEY] Usando event_id: ${body.event_id}`);
      return key;
    }
    
    // Prioridade 2: message.id + conversation.id (identifica mensagem única)
    if (body.message && body.message.id && body.conversation && body.conversation.id) {
      const key = `chatwoot:${instanceId}:conv:${body.conversation.id}:msg:${body.message.id}`;
      console.log(`[CACHE_KEY] Usando conversation.id + message.id: conv:${body.conversation.id}, msg:${body.message.id}`);
      return key;
    }
    
    // Prioridade 3: message_id direto
    if (body.message_id) {
      const key = `chatwoot:${instanceId}:msg:${body.message_id}`;
      console.log(`[CACHE_KEY] Usando message_id: ${body.message_id}`);
      return key;
    }
    
    // Prioridade 4: conversation.id + content + timestamp (para mensagens sem ID)
    if (body.conversation && body.conversation.id && body.message && body.message.content) {
      const contentPreview = body.message.content.substring(0, 50);
      const timestamp = body.timestamp || body.created_at || body.message.created_at;
      const key = `chatwoot:${instanceId}:conv:${body.conversation.id}:content:${contentPreview}:ts:${timestamp}`;
      console.log(`[CACHE_KEY] Usando conversation.id + content + timestamp`);
      return key;
    }
    
    // Fallback: hash do conteúdo completo (menos confiável, mas melhor que nada)
    const contentHash = JSON.stringify({
      event: body.event,
      conversation_id: body.conversation?.id,
      message_id: body.message?.id,
      content: body.message?.content?.substring(0, 100),
      timestamp: body.timestamp || body.created_at || body.message?.created_at,
    });
    // Usa um hash simples baseado no conteúdo
    let hash = 0;
    for (let i = 0; i < contentHash.length; i++) {
      const char = contentHash.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    const key = `chatwoot:${instanceId}:hash:${Math.abs(hash)}`;
    console.log(`[CACHE_KEY] Usando hash do conteúdo: ${Math.abs(hash)}`);
    return key;
  } catch (error) {
    // Se não conseguir parsear, usa hash do body inteiro
    const bodyStr = typeof webhookBody === 'string' ? webhookBody : JSON.stringify(webhookBody);
    let hash = 0;
    for (let i = 0; i < Math.min(bodyStr.length, 500); i++) {
      const char = bodyStr.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    const key = `chatwoot:${instanceId}:raw:${Math.abs(hash)}`;
    console.log(`[CACHE_KEY] Erro ao parsear, usando hash do body: ${Math.abs(hash)}`);
    return key;
  }
}

/**
 * Verifica se webhook já foi processado usando Cache API do Cloudflare
 * Retorna null se não encontrado, ou o objeto cacheado se encontrado
 */
async function getCachedWebhook(cacheKey, cache) {
  try {
    const cacheRequest = new Request(`https://chatwoot-cache/${cacheKey}`);
    const cachedResponse = await cache.match(cacheRequest);
    
    if (cachedResponse) {
      const cachedData = await cachedResponse.json();
      return cachedData;
    }
    return null;
  } catch (error) {
    console.warn(`[CACHE] Erro ao buscar webhook no cache: ${error.message}`);
    return null;
  }
}

/**
 * Armazena webhook no cache usando Cache API do Cloudflare
 */
async function setCachedWebhook(cacheKey, responseData, cache) {
  try {
    const cacheRequest = new Request(`https://chatwoot-cache/${cacheKey}`);
    const cacheResponse = new Response(JSON.stringify({
      timestamp: Date.now(),
      response: responseData,
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `public, max-age=${CHATWOOT_CACHE_TTL}`,
      },
    });
    
    // Armazena no cache com TTL
    await cache.put(cacheRequest, cacheResponse);
    return true;
  } catch (error) {
    console.warn(`[CACHE] Erro ao armazenar webhook no cache: ${error.message}`);
    return false;
  }
}

// Rate Limiting Configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // Janela de 1 minuto
const RATE_LIMIT_STRICT = 100; // Limite mais restritivo para casos suspeitos

/**
 * Valida token de instância no banco de dados
 * Suporta múltiplos tokens - cada instância tem seu próprio token único
 * @param {string} token - Token da instância
 * @param {string} supabaseUrl - URL do Supabase
 * @param {string} supabaseAnonKey - Chave anon do Supabase
 * @param {boolean} debugMode - Modo debug para logs
 * @param {Map} tokenCache - Cache de tokens
 */
async function validateToken(token, supabaseUrl, supabaseAnonKey, debugMode, tokenCache) {
  // Validação básica do token
  if (!token || token.trim() === '') {
    console.warn(`[WARN] Token validation failed - Empty token`);
    return { valid: false, error: 'Token is empty' };
  }

  // Verifica cache primeiro (opcional - pode remover se preferir sempre validar)
  const cached = tokenCache.get(token);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    if (debugMode) {
      console.log(`[DEBUG] Token found in cache - Valid: ${cached.result.valid}`);
    }
    return cached.result;
  }

  try {
    // Query no Supabase para validar o token
    // A política RLS permite busca por instance_token sem autenticação
    // IMPORTANTE: Usa eq (equals) para busca exata do token
    const queryUrl = `${supabaseUrl}/rest/v1/whatsapp_instances?instance_token=eq.${encodeURIComponent(token)}&select=id,status,user_id,name`;
    
    // Adicionar timeout para evitar que a requisição trave
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 10000); // 10 segundos de timeout
    
    console.log(`[INFO] Validating token: ${token.substring(0, 20)}...`);
    
    const response = await fetch(queryUrl, {
      method: 'GET',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    // Log para debugging (apenas se debugMode estiver habilitado)
    if (debugMode) {
      console.log(`[DEBUG] Token validation - Status: ${response.status}, URL: ${queryUrl.substring(0, 100)}...`);
    }

    console.log(`[INFO] Token validation response - Status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      // Logs de erro sempre são exibidos (mas sem informações sensíveis em produção)
      console.error(`[ERROR] Database query failed - Status: ${response.status}, Token: ${token.substring(0, 20)}...`);
      if (debugMode) {
        console.error(`[ERROR] Database query response: ${errorText}`);
      }
      
      // Se for 401 ou 403, pode ser problema de política RLS
      if (response.status === 401 || response.status === 403) {
        return { 
          valid: false, 
          error: 'RLS policy error - check if public token validation policy exists',
          details: debugMode ? errorText : undefined
        };
      }
      
      return { 
        valid: false, 
        error: 'Database error', 
        statusCode: response.status,
        details: debugMode ? errorText : undefined
      };
    }

    const data = await response.json();

    // Log para debugging (apenas se debugMode estiver habilitado)
    if (debugMode) {
      console.log(`[DEBUG] Query result - Found ${data ? data.length : 0} instance(s)`);
    }

    // Verifica se encontrou a instância e se está conectada
    if (data && Array.isArray(data) && data.length > 0) {
      const instance = data[0];
      
      // Log para debugging (apenas se debugMode estiver habilitado)
      if (debugMode) {
        console.log(`[DEBUG] Instance found - ID: ${instance.id}, Status: ${instance.status}`);
      }
      
      if (instance.status === 'connected') {
        const result = {
          valid: true,
          instance: {
            id: instance.id,
            user_id: instance.user_id,
            name: instance.name,
            status: instance.status,
          },
        };
        
        // Salva no cache
        tokenCache.set(token, {
          result,
          timestamp: Date.now(),
        });
        
        return result;
      } else {
        // Log quando instância não está conectada
        console.warn(`[WARN] Instance not connected - ID: ${instance.id}, Status: ${instance.status}, Token: ${token.substring(0, 20)}...`);
        return {
          valid: false,
          error: 'Instance not connected',
          status: instance.status,
          instanceId: instance.id,
        };
      }
    }

    // Token não encontrado - pode ser:
    // 1. Token não existe no banco
    // 2. Token está NULL no banco
    // 3. Política RLS está bloqueando
    // 4. Token tem espaços ou caracteres especiais diferentes
    console.warn(`[WARN] Invalid token - Token not found in database: ${token.substring(0, 20)}...`);
    
    return { 
      valid: false, 
      error: 'Token not found',
      details: 'Token does not exist in database or RLS policy is blocking access'
    };
  } catch (error) {
    // Logs de erro críticos sempre são exibidos
    if (error.name === 'AbortError') {
      console.error(`[ERROR] Token validation timeout - Token: ${token.substring(0, 20)}... (Request took more than 10 seconds)`);
      return {
        valid: false,
        error: 'Validation timeout',
        message: 'Token validation request timed out after 10 seconds'
      };
    }
    
    console.error(`[ERROR] Token validation exception - Token: ${token.substring(0, 20)}..., Error: ${error.message}`);
    if (debugMode) {
      console.error('[ERROR] Full error:', error);
    }
    return { 
      valid: false, 
      error: 'Validation error', 
      message: error.message || 'Token validation failed'
    };
  }
}

/**
 * Limpa cache antigo (opcional - para evitar memory leak)
 * @param {Map} tokenCache - Cache de tokens
 */
function cleanCache(tokenCache) {
  const now = Date.now();
  for (const [token, cached] of tokenCache.entries()) {
    if (now - cached.timestamp > CACHE_TTL) {
      tokenCache.delete(token);
    }
  }
}

/**
 * Rate Limiting por IP e Token
 * Usa Cache API do Cloudflare para persistir contadores entre requisições
 * @param {Request} request - Requisição recebida
 * @param {string} token - Token da instância
 * @param {number} rateLimitRequestsPerMinute - Limite de requisições por minuto
 * @param {boolean} debugMode - Modo debug para logs
 */
async function checkRateLimit(request, token, rateLimitRequestsPerMinute, debugMode) {
  const clientIP = request.headers.get('CF-Connecting-IP') || 
                   request.headers.get('X-Forwarded-For') || 
                   'unknown';
  
  // Criar chaves de rate limit
  const ipKey = `rate_limit:ip:${clientIP}`;
  const tokenKey = `rate_limit:token:${token}`;
  
  // Timestamp atual em segundos (para janela de 1 minuto)
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % 60); // Arredonda para o início do minuto
  
  // Chaves com timestamp para janela deslizante
  const ipWindowKey = `${ipKey}:${windowStart}`;
  const tokenWindowKey = `${tokenKey}:${windowStart}`;
  
  try {
    // Buscar contadores do cache
    const cache = caches.default;
    
    // Buscar contador por IP
    const ipCacheKey = new Request(`https://rate-limit/${ipWindowKey}`, request);
    const ipCacheResponse = await cache.match(ipCacheKey);
    let ipCount = 0;
    
    if (ipCacheResponse) {
      ipCount = parseInt(await ipCacheResponse.text()) || 0;
    }
    
    // Buscar contador por Token
    const tokenCacheKey = new Request(`https://rate-limit/${tokenWindowKey}`, request);
    const tokenCacheResponse = await cache.match(tokenCacheKey);
    let tokenCount = 0;
    
    if (tokenCacheResponse) {
      tokenCount = parseInt(await tokenCacheResponse.text()) || 0;
    }
    
    // Verificar limites
    // Limite padrão: configurável via env var
    const ipLimit = rateLimitRequestsPerMinute;
    const tokenLimit = rateLimitRequestsPerMinute;
    
    // Verificar se IP excedeu o limite
    if (ipCount >= ipLimit) {
      return {
        allowed: false,
        limit: ipLimit,
        remaining: 0,
        reset: (windowStart + 60) * 1000,
        type: 'ip',
        reason: `Rate limit exceeded for IP. Limit: ${ipLimit} req/min`
      };
    }
    
    // Verificar se Token excedeu o limite
    if (tokenCount >= tokenLimit) {
      return {
        allowed: false,
        limit: tokenLimit,
        remaining: 0,
        reset: (windowStart + 60) * 1000,
        type: 'token',
        reason: `Rate limit exceeded for token. Limit: ${tokenLimit} req/min`
      };
    }
    
    // Incrementar contadores
    ipCount++;
    tokenCount++;
    
    // Salvar no cache (expira em 2 minutos para garantir limpeza)
    const cacheOptions = {
      headers: {
        'Cache-Control': `public, max-age=120`
      }
    };
    
    await cache.put(
      ipCacheKey,
      new Response(ipCount.toString(), cacheOptions)
    );
    
    await cache.put(
      tokenCacheKey,
      new Response(tokenCount.toString(), cacheOptions)
    );
    
    // Calcular remaining baseado no limite mais restritivo alcançado
    const remaining = Math.max(0, Math.min(
      ipLimit - ipCount, 
      tokenLimit - tokenCount
    ));
    
    return {
      allowed: true,
      limit: rateLimitRequestsPerMinute,
      remaining: remaining,
      reset: (windowStart + 60) * 1000,
      ipCount,
      tokenCount
    };
    
  } catch (error) {
    // Em caso de erro no rate limiting, permitir requisição mas logar erro
    // Logs de erro sempre são exibidos
    if (debugMode) {
      console.error('[ERROR] Rate limit check failed:', error);
    } else {
      console.error('[ERROR] Rate limit check failed:', error.message);
    }
    return {
      allowed: true,
      limit: rateLimitRequestsPerMinute,
      remaining: rateLimitRequestsPerMinute,
      reset: Date.now() + RATE_LIMIT_WINDOW_MS,
      error: 'Rate limit check failed, allowing request'
    };
  }
}

async function logApiRequest({
  supabaseUrl,
  serviceKey,
  payload,
  debugMode,
}) {
  if (!serviceKey) {
    if (debugMode) {
      console.warn('[WARN] SUPABASE_SERVICE_KEY not configured; skipping API request logging');
    }
    return;
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/api_request_logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok && debugMode) {
      console.error('[ERROR] Failed to log API request', response.status, await response.text());
    }
  } catch (error) {
    if (debugMode) {
      console.error('[ERROR] Exception while logging API request:', error);
    }
  }
}

/**
 * Handler principal das requisições
 * @param {Request} request - Requisição recebida
 * @param {Object} env - Variáveis de ambiente do Cloudflare
 * @param {ExecutionContext} [ctx] - Contexto para executar tarefas assíncronas (waitUntil)
 */
async function handleRequest(request, env = {}, ctx) {
  // Carregar configurações de variáveis de ambiente ou usar padrões
  const SUPABASE_URL = env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
  const SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_KEY;
  const DEBUG_MODE = env.DEBUG !== undefined ? env.DEBUG === 'true' : DEFAULT_DEBUG_MODE;
  const RATE_LIMIT_REQUESTS_PER_MINUTE = parseInt(env.RATE_LIMIT || DEFAULT_RATE_LIMIT.toString());
  
  // Cache de tokens (por worker instance)
  const TOKEN_CACHE = new Map();
  
  // Limpa cache periodicamente
  if (Math.random() < 0.1) { // 10% das requisições
    cleanCache(TOKEN_CACHE);
  }

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, token, X-Client-Info',
  };

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  // Aceita GET, POST, PUT, DELETE
  const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE'];
  if (!allowedMethods.includes(request.method)) {
    return new Response(
      JSON.stringify({ error: `Method not allowed. Use ${allowedMethods.join(', ')}.` }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Normaliza o path primeiro para verificar endpoints especiais
  const url = new URL(request.url);
  let normalizedPath = url.pathname;
  
  // Remove /whatsapp/ se existir
  if (normalizedPath.startsWith('/whatsapp/')) {
    normalizedPath = normalizedPath.replace('/whatsapp/', '/');
  }
  
  // Remove /functions/v1/ se existir
  if (normalizedPath.startsWith('/functions/v1/')) {
    normalizedPath = normalizedPath.replace('/functions/v1/', '/');
  }
  
  // Remove trailing slash
  if (normalizedPath.endsWith('/') && normalizedPath.length > 1) {
    normalizedPath = normalizedPath.slice(0, -1);
  }
  
  // Verifica se é webhook do Chatwoot ou endpoint de criação de inbox (não requer token no header)
  const isChatwootWebhook = normalizedPath.startsWith('/chatwoot/webhook/');
  const isChatwootCreateInbox = normalizedPath === '/chatwoot/create-inbox' && request.method === 'POST';
  
  if (isChatwootWebhook) {
    console.log(`[INFO] Detected Chatwoot webhook - path: ${normalizedPath}, original: ${url.pathname}`);
  }
  
  if (isChatwootCreateInbox) {
    console.log(`[INFO] Detected Chatwoot create-inbox endpoint - path: ${normalizedPath}, original: ${url.pathname}`);
  }

  // Extrai token do header (webhooks do Chatwoot e create-inbox não enviam token)
  const token = request.headers.get('token');

  if (!token && !isChatwootWebhook && !isChatwootCreateInbox) {
    console.log(`[WARN] Token missing and not a Chatwoot webhook/create-inbox - path: ${normalizedPath}`);
    return new Response(
      JSON.stringify({ error: 'Token is required in header' }),
      {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
  
  if (isChatwootWebhook) {
    console.log(`[INFO] Chatwoot webhook detected - skipping token validation`);
  }
  
  if (isChatwootCreateInbox) {
    console.log(`[INFO] Chatwoot create-inbox detected - skipping token validation`);
  }

  // Rate Limiting - Verificar antes de processar (após validar que token existe)
  // Isso protege contra abuso mesmo com tokens inválidos
  // Para create-inbox, usa um token fictício para rate limiting (baseado em IP)
  const rateLimitToken = isChatwootCreateInbox ? 'create-inbox' : token;
  const rateLimit = await checkRateLimit(request, rateLimitToken, RATE_LIMIT_REQUESTS_PER_MINUTE, DEBUG_MODE);
  
  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({
        error: rateLimit.reason,
        code: 'RATE_LIMIT_EXCEEDED',
        limit: rateLimit.limit,
        remaining: rateLimit.remaining,
        reset: new Date(rateLimit.reset).toISOString(),
      }),
      {
        status: 429,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': rateLimit.limit.toString(),
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': rateLimit.reset.toString(),
          'Retry-After': Math.ceil((rateLimit.reset - Date.now()) / 1000).toString(),
        },
      }
    );
  }

  // Valida token no banco de dados
  // Esta função suporta QUALQUER token de QUALQUER instância
  // Webhooks do Chatwoot e create-inbox não requerem validação de token aqui
  if (!isChatwootWebhook && !isChatwootCreateInbox && token) {
  console.log(`[INFO] Starting token validation for token: ${token.substring(0, 20)}...`);
  }
  const validationStartTime = Date.now();
  
  let validation;
  try {
    if (isChatwootWebhook) {
      // Para webhooks, vamos validar depois quando extrairmos o instance_id
      validation = { valid: true, skip: true };
      console.log(`[INFO] Skipping token validation for Chatwoot webhook`);
    } else if (isChatwootCreateInbox) {
      // Para create-inbox, não precisa validar token (usa credenciais do Chatwoot no body)
      validation = { valid: true, skip: true };
      console.log(`[INFO] Skipping token validation for Chatwoot create-inbox`);
    } else {
    validation = await validateToken(token, SUPABASE_URL, SUPABASE_ANON_KEY, DEBUG_MODE, TOKEN_CACHE);
    const validationDuration = Date.now() - validationStartTime;
    console.log(`[INFO] Token validation completed in ${validationDuration}ms - Valid: ${validation.valid}`);
    }
  } catch (error) {
    console.error(`[ERROR] Token validation threw exception: ${error.message}`);
    return new Response(
      JSON.stringify({
        error: 'Token validation failed',
        code: 'VALIDATION_ERROR',
        message: 'An error occurred while validating the token',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  if (!validation.valid && !validation.skip) {
    // Log detalhado do erro de validação
    const tokenPreview = token ? `${token.substring(0, 20)}...` : 'N/A (webhook)';
    if (validation.error === 'Instance not connected') {
      console.warn(`[WARN] Request rejected - Instance not connected: ID=${validation.instanceId}, Status=${validation.status}, Token=${tokenPreview}`);
    } else if (validation.error === 'Token not found') {
      console.warn(`[WARN] Request rejected - Invalid token: Token=${tokenPreview}`);
    } else if (validation.error === 'Validation timeout') {
      console.warn(`[WARN] Request rejected - Token validation timeout: Token=${tokenPreview}`);
    } else {
      console.warn(`[WARN] Request rejected - Token validation failed: Error=${validation.error}, Token=${tokenPreview}`);
    }

    const errorMessage = validation.error === 'Instance not connected'
      ? `Instance is ${validation.status}. Only connected instances can send messages.`
      : validation.error === 'Token not found'
      ? 'Invalid token. Token does not exist in database.'
      : validation.error === 'Validation timeout'
      ? 'Token validation timed out. Please try again.'
      : validation.message || 'Invalid or inactive instance token';

    return new Response(
      JSON.stringify({
        error: errorMessage,
        code: validation.error || 'VALIDATION_ERROR',
      }),
      {
        status: validation.error === 'Validation timeout' ? 504 : 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
  
  if (!isChatwootWebhook && validation.instance) {
  console.log(`[INFO] Token validated successfully - Instance ID: ${validation.instance.id}, Status: ${validation.instance.status}`);
  }

  // Token válido ou webhook! Processa a requisição
  try {
    // Usa o path já normalizado do início
    let path = normalizedPath;
    
    // Se não começar com /, adiciona
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    
    // Log do path processado
    console.log(`[INFO] Processing endpoint - Original: ${url.pathname}, Processed: ${path}`);
    
    // Define flags de tipo de endpoint antes de processar o body
    const isInstanceOrProfileEndpoint = path.startsWith('/instance/') || path.startsWith('/profile/');
    const isIntegrationEndpoint = path.startsWith('/chatwoot/');
    
    // Nota: isChatwootWebhook e isChatwootCreateInbox já foram definidos no início usando normalizedPath
    const supportedEndpoints = [
      // Envio de mensagens
      '/send-text', '/send-media', '/send-menu', '/send-carousel', '/send-pix-button', '/send-status',
      // Perfil
      '/profile/name', '/profile/image',
      // Instância
      '/instance/connect', '/instance/disconnect', '/instance/status', '/instance/updateInstanceName', 
      '/instance', '/instance/privacy', '/instance/presence',
      // Integrações
      '/chatwoot/config', '/chatwoot/create-inbox'
    ];
    
    // Se for webhook do Chatwoot, trata antes de verificar endpoints suportados
    // Webhooks têm path dinâmico: /chatwoot/webhook/{instance_id}
    if (isChatwootWebhook) {
      const instanceIdMatch = path.match(/^\/chatwoot\/webhook\/([^\/]+)$/);
      if (instanceIdMatch) {
        const instanceId = instanceIdMatch[1];
        console.log(`[INFO] ========================================`);
        console.log(`[INFO] 📨 CHATWOOT WEBHOOK RECEBIDO`);
        console.log(`[INFO] Instance ID: ${instanceId}`);
        console.log(`[INFO] Path: ${path}`);
        console.log(`[INFO] Method: ${request.method}`);
        console.log(`[INFO] ========================================`);
        
        // Busca o token da instância no banco de dados
        try {
          const instanceResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/whatsapp_instances?id=eq.${instanceId}&select=instance_token,status`,
            {
              headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
              },
            }
          );
          
          if (instanceResponse.ok) {
            const instances = await instanceResponse.json();
            if (instances && instances.length > 0 && instances[0].instance_token) {
              const instanceToken = instances[0].instance_token;
              const instanceStatus = instances[0].status;
              console.log(`[INFO] Found instance token for webhook, instance status: ${instanceStatus}`);
              console.log(`[INFO] Instance token preview: ${instanceToken ? instanceToken.substring(0, 20) + '...' : 'NULL'}`);
              
              // Verifica se a instância está conectada
              if (instanceStatus !== 'connected') {
                console.warn(`[WARN] Instance is not connected (status: ${instanceStatus}), but proceeding with webhook`);
              }
              
              // Roteia para a API externa com o token correto
              // A UAZAPI espera o instance_token na URL do webhook, não o instance_id
              // Quando configuramos o webhook, usamos instance_id na URL do nosso domínio,
              // mas ao fazer proxy para UAZAPI, precisamos usar o instance_token
              const webhookPathWithToken = `/chatwoot/webhook/${instanceToken}`;
              const targetUrl = `https://sender.uazapi.com${webhookPathWithToken}`;
              console.log(`[INFO] Using instance_token in webhook URL for UAZAPI (instead of instance_id)`);
              console.log(`[INFO] Original path had instance_id: ${instanceId}, now using token in URL`);
              
              // Lê o body da requisição do Chatwoot ANTES de processar
              // Isso permite verificar duplicação antes de enviar para UAZAPI
              const webhookBody = await request.text();
              
              // Parse do body para extrair informações
              let webhookData;
              try {
                webhookData = JSON.parse(webhookBody);
              } catch (e) {
                console.error(`[ERROR] Erro ao parsear webhook body: ${e.message}`);
                return new Response(
                  JSON.stringify({ error: 'Invalid webhook body' }),
                  { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
              }
              
              // Verifica duplicação de webhook ANTES de processar usando Cache API
              const webhookKey = generateChatwootWebhookKey(webhookBody, instanceId);
              
              // VERIFICAÇÃO CRÍTICA: Verifica no banco de dados ANTES de processar
              // Usa webhook_key (hash) como identificador principal, já que message.id pode não existir
              let messageAlreadyProcessed = false;
              let duplicateCheckKey = null;
              
              // Tenta múltiplas formas de identificar a mensagem
              if (webhookData.message && webhookData.message.id) {
                duplicateCheckKey = webhookData.message.id.toString();
              } else if (webhookData.message_id) {
                duplicateCheckKey = webhookData.message_id.toString();
              } else {
                // SEMPRE usa webhook_key como fallback (já foi gerado acima)
                duplicateCheckKey = webhookKey; // Usa a chave do cache que já foi gerada
                console.log(`[DB_CHECK] Usando webhook_key como identificador: ${webhookKey.substring(0, 80)}...`);
              }
              
              // OTIMIZAÇÃO: Verifica cache PRIMEIRO (mais rápido que banco)
              const cache = caches.default;
              const cachedWebhook = await getCachedWebhook(webhookKey, cache);
              
              if (cachedWebhook) {
                const age = Date.now() - cachedWebhook.timestamp;
                if (age < (CHATWOOT_CACHE_TTL * 1000)) {
                  console.log(`[CACHE] ✅ Webhook encontrado no cache (${age}ms) - retornando imediatamente`);
                  return new Response(
                    JSON.stringify({
                      ...(cachedWebhook.response),
                      duplicate: true,
                      cached: true,
                      message: 'Webhook já processado anteriormente',
                    }),
                    {
                      status: 200,
                      headers: {
                        ...corsHeaders,
                        'Content-Type': 'application/json',
                        'X-Duplicate-Detected': 'true',
                        'X-Cached-Response': 'true',
                      },
                    }
                  );
                }
              }
              
              // OTIMIZAÇÃO: Verificações no banco em PARALELO (mais rápido)
              try {
                const checkPromises = [];
                
                // Verificação principal por webhook_key (sempre existe)
                const mainCheckUrl = `${SUPABASE_URL}/rest/v1/chatwoot_processed_messages?webhook_key=eq.${encodeURIComponent(webhookKey)}&select=id,processed_at,message_id,instance_id,conversation_id&limit=1`;
                checkPromises.push(
                  fetch(mainCheckUrl, {
                    headers: {
                      'apikey': SUPABASE_ANON_KEY,
                      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    },
                  }).then(r => r.ok ? r.json() : [])
                );
                
                // Se tiver conversation_id, também verifica em paralelo
                if (webhookData.conversation && webhookData.conversation.id) {
                  const conversationId = webhookData.conversation.id.toString();
                  const conversationCheckUrl = `${SUPABASE_URL}/rest/v1/chatwoot_processed_messages?conversation_id=eq.${encodeURIComponent(conversationId)}&webhook_key=eq.${encodeURIComponent(webhookKey)}&select=id,processed_at,message_id,instance_id&limit=1`;
                  checkPromises.push(
                    fetch(conversationCheckUrl, {
                      headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                      },
                    }).then(r => r.ok ? r.json() : [])
                  );
                }
                
                // Executa todas as verificações em paralelo
                console.log(`[DB_CHECK] Verificando no banco (paralelo): ${checkPromises.length} consulta(s)...`);
                const results = await Promise.all(checkPromises);
                
                // Verifica se encontrou duplicado em qualquer resultado
                for (const existing of results) {
                  if (existing && existing.length > 0) {
                    const record = existing[0];
                    // Verifica se é duplicado (mesmo webhook_key = mesma mensagem)
                    if (record.webhook_key === webhookKey) {
                      messageAlreadyProcessed = true;
                      console.log(`[DUPLICATE] ⚠️⚠️⚠️ MENSAGEM JÁ PROCESSADA NO BANCO! ⚠️⚠️⚠️`);
                      console.log(`[DUPLICATE] Webhook Key: ${webhookKey.substring(0, 80)}...`);
                      console.log(`[DUPLICATE] Processado em: ${record.processed_at}`);
                      break;
                    }
                  }
                }
                
                if (!messageAlreadyProcessed) {
                  console.log(`[DB_CHECK] ✅ Mensagem NÃO encontrada no banco - pode processar`);
                }
              } catch (dbError) {
                console.error(`[ERROR] Erro ao verificar no banco: ${dbError.message}`);
                // Continua processamento se falhar verificação no banco
              }
              
              if (messageAlreadyProcessed) {
                return new Response(
                  JSON.stringify({
                    status: 'accepted',
                    message: 'Message already processed in database',
                    duplicate: true,
                    webhook_key: webhookKey.substring(0, 50),
                    message_id: webhookData.message?.id || 'N/A',
                    instance_id: instanceId,
                    source: 'database_check',
                  }),
                  {
                    status: 200,
                    headers: {
                      ...corsHeaders,
                      'Content-Type': 'application/json',
                      'X-Duplicate-Detected': 'true',
                      'X-DB-Check': 'true',
                    },
                  }
                );
              }
              
              // CRÍTICO: Registra no banco ANTES de processar (marca como "processando")
              // Isso previne que outra requisição simultânea processe a mesma mensagem
              // SEMPRE registra, mesmo sem message.id (usa webhook_key)
              try {
                const insertUrl = `${SUPABASE_URL}/rest/v1/chatwoot_processed_messages`;
                
                const insertPayload = {
                  message_id: webhookData.message?.id?.toString() || `hash_${webhookKey.split(':').pop()}`, // Usa hash se não tiver message.id
                  instance_id: instanceId,
                  conversation_id: webhookData.conversation?.id?.toString() || null,
                  event_type: webhookData.event || 'message_created',
                  webhook_key: webhookKey, // SEMPRE inclui webhook_key (identificador mais confiável)
                  processed_at: new Date().toISOString(),
                };
                
                console.log(`[DB_INSERT] Registrando mensagem no banco ANTES de processar...`);
                console.log(`[DB_INSERT] Payload: message_id=${insertPayload.message_id}, webhook_key=${webhookKey.substring(0, 50)}...`);
                
                const insertResponse = await fetch(insertUrl, {
                  method: 'POST',
                  headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json',
                    // NÃO usa 'Prefer': 'resolution=merge-duplicates' - queremos o erro 409 se duplicado
                  },
                  body: JSON.stringify(insertPayload),
                });
                
                if (insertResponse.ok) {
                  console.log(`[DB_INSERT] ✅ Mensagem registrada no banco ANTES de processar`);
                } else {
                  const errorText = await insertResponse.text();
                  console.log(`[DB_INSERT] Response status: ${insertResponse.status}`);
                  console.log(`[DB_INSERT] Response: ${errorText.substring(0, 300)}`);
                  
                  // Se erro for "duplicate key" ou "unique constraint violation", significa que outra requisição já registrou
                  if (insertResponse.status === 409 || 
                      insertResponse.status === 23505 || 
                      errorText.includes('duplicate') || 
                      errorText.includes('unique') ||
                      errorText.includes('violates unique constraint')) {
                    console.log(`[DUPLICATE] ⚠️⚠️⚠️ CONFLITO! Mensagem já registrada por outra requisição! ⚠️⚠️⚠️`);
                    console.log(`[DUPLICATE] Webhook Key: ${webhookKey.substring(0, 80)}...`);
                    console.log(`[DUPLICATE] Instance: ${instanceId}`);
                    
                    return new Response(
                      JSON.stringify({
                        status: 'accepted',
                        message: 'Message already being processed by another request',
                        duplicate: true,
                        webhook_key: webhookKey.substring(0, 50),
                        instance_id: instanceId,
                        source: 'database_conflict',
                      }),
                      {
                        status: 200,
                        headers: {
                          ...corsHeaders,
                          'Content-Type': 'application/json',
                          'X-Duplicate-Detected': 'true',
                          'X-DB-Conflict': 'true',
                        },
                      }
                    );
                  } else {
                    console.warn(`[WARN] Erro ao registrar no banco (${insertResponse.status}): ${errorText.substring(0, 200)}`);
                  }
                }
              } catch (insertError) {
                console.error(`[ERROR] Erro ao registrar mensagem no banco: ${insertError.message}`);
                console.error(`[ERROR] Stack: ${insertError.stack}`);
                // Não bloqueia processamento se falhar
              }
              
              // OTIMIZAÇÃO: Sistema de lock simplificado e mais rápido
              // PASSO 1: Tenta adquirir lock com timestamp único
              const processingKey = `processing:${webhookKey}`;
              const lockRequest = new Request(`https://chatwoot-lock/${processingKey}`);
              const lockTimestamp = Date.now();
              const lockOwner = `${lockTimestamp}-${Math.random().toString(36).substring(7)}`; // ID único para este lock
              
              const lockResponse = new Response(JSON.stringify({ 
                processing: true, 
                timestamp: lockTimestamp,
                owner: lockOwner,
                instanceId: instanceId 
              }), {
                headers: {
                  'Content-Type': 'application/json',
                  'Cache-Control': `public, max-age=8`, // Lock expira em 8 segundos (balanceado)
                },
              });
              
              // Tenta adquirir o lock (versão balanceada - segurança primeiro)
              let lockAcquired = false;
              try {
                // Verifica se já existe lock ANTES de tentar adquirir
                const existingLock = await cache.match(lockRequest);
                if (existingLock) {
                  const lockData = await existingLock.json();
                  const lockAge = Date.now() - lockData.timestamp;
                  if (lockAge < 8000) { // Lock ainda válido (8 segundos)
                    console.log(`[DUPLICATE] ⚠️ Webhook já está sendo processado! Lock age: ${lockAge}ms`);
                    lockAcquired = false;
                  } else {
                    // Lock expirado, podemos tentar adquirir
                    console.log(`[INFO] Lock expirado (${lockAge}ms), tentando adquirir novo lock`);
                  }
                }
                
                // Se não há lock válido, tenta adquirir
                if (!existingLock || (existingLock && (Date.now() - (await existingLock.json()).timestamp) >= 8000)) {
                  await cache.put(lockRequest, lockResponse);
                  
                  // DOUBLE-CHECK: delay otimizado para garantir propagação do cache
                  await new Promise(resolve => setTimeout(resolve, 20)); // 20ms (otimizado)
                  const verifyLock = await cache.match(lockRequest);
                  if (verifyLock) {
                    const verifyData = await verifyLock.json();
                    if (verifyData.owner === lockOwner) {
                      lockAcquired = true;
                      console.log(`[INFO] Lock adquirido com sucesso (owner: ${lockOwner.substring(0, 15)}...)`);
                    } else {
                      console.log(`[WARN] Lock foi adquirido por outra requisição (owner: ${verifyData.owner?.substring(0, 15)}...), aguardando...`);
                      lockAcquired = false;
                    }
                  } else {
                    // Lock não persistiu - não processa sem confirmação (segurança)
                    console.log(`[WARN] Lock não persistiu, tentando novamente...`);
                    lockAcquired = false;
                  }
                }
              } catch (lockError) {
                console.warn(`[WARN] Erro ao adquirir lock: ${lockError.message}`);
                // Em caso de erro, NÃO processa (segurança primeiro)
                lockAcquired = false;
              }
              
              // PASSO 2: Se não conseguiu o lock, aguarda e verifica cache (OTIMIZADO)
              if (!lockAcquired) {
                console.log(`[DUPLICATE] ⚠️ Não foi possível adquirir lock, aguardando processamento de outra requisição...`);
                
                // Aguarda e verifica o cache de resultado (otimizado - menos tentativas, delays menores)
                for (let attempt = 0; attempt < 6; attempt++) { // 6 tentativas (otimizado)
                  const delay = Math.min(50 + (attempt * 30), 150); // Backoff: 50ms → 80ms → 110ms... até 150ms
                  await new Promise(resolve => setTimeout(resolve, delay));
                  
                  // Verifica cache primeiro (mais rápido)
                  const retryCached = await getCachedWebhook(webhookKey, cache);
                  if (retryCached && (Date.now() - retryCached.timestamp) < (CHATWOOT_CACHE_TTL * 1000)) {
                    console.log(`[DUPLICATE] ✅ Webhook foi processado enquanto aguardava (tentativa ${attempt + 1}), retornando cache`);
                    return new Response(
                      JSON.stringify({
                        ...(retryCached.response),
                        duplicate: true,
                        cached: true,
                        message: 'Webhook processado por outra requisição simultânea',
                      }),
                      {
                        status: 200,
                        headers: {
                          ...corsHeaders,
                          'Content-Type': 'application/json',
                          'X-Duplicate-Detected': 'true',
                          'X-Cached-Response': 'true',
                        },
                      }
                    );
                  }
                  
                  // Verifica se o lock ainda existe (a cada tentativa para garantir)
                  const stillLocked = await cache.match(lockRequest);
                  if (!stillLocked) {
                    // Lock foi liberado, verifica cache uma última vez
                    const finalCheck = await getCachedWebhook(webhookKey, cache);
                    if (finalCheck && (Date.now() - finalCheck.timestamp) < (CHATWOOT_CACHE_TTL * 1000)) {
                      console.log(`[DUPLICATE] ✅ Webhook encontrado no cache após lock ser liberado`);
                      return new Response(
                        JSON.stringify({
                          ...(finalCheck.response),
                          duplicate: true,
                          cached: true,
                          message: 'Webhook processado por outra requisição',
                        }),
                        {
                          status: 200,
                          headers: {
                            ...corsHeaders,
                            'Content-Type': 'application/json',
                            'X-Duplicate-Detected': 'true',
                            'X-Cached-Response': 'true',
                          },
                        }
                      );
                    }
                    // Lock liberado mas sem cache - pode ter falhado, vamos processar
                    console.log(`[INFO] Lock foi liberado mas resultado não encontrado, tentando processar...`);
                    break;
                  }
                }
                
                // Se chegou aqui, aguardou mas não encontrou resultado
                // Tenta adquirir lock novamente (pode ter sido liberado)
                if (!lockAcquired) {
                  try {
                    await cache.put(lockRequest, lockResponse);
                    await new Promise(resolve => setTimeout(resolve, 20)); // Double-check (otimizado)
                    const verifyLock = await cache.match(lockRequest);
                    if (verifyLock) {
                      const verifyData = await verifyLock.json();
                      if (verifyData.owner === lockOwner) {
                        lockAcquired = true;
                        console.log(`[INFO] Lock adquirido após aguardar (owner: ${lockOwner.substring(0, 15)}...)`);
                      } else {
                        console.log(`[WARN] Lock ainda pertence a outra requisição, não processando`);
                        lockAcquired = false;
                      }
                    } else {
                      console.log(`[WARN] Lock não persistiu após aguardar, não processando`);
                      lockAcquired = false;
                    }
                  } catch (e) {
                    console.warn(`[WARN] Erro ao tentar adquirir lock novamente: ${e.message}`);
                    lockAcquired = false;
                  }
                }
              }
              
              // PASSO 4: Só processa se tiver lock confirmado (SEGURANÇA PRIMEIRO)
              if (!lockAcquired) {
                console.log(`[ERROR] Não foi possível adquirir lock após todas as tentativas. Retornando erro para evitar duplicação.`);
                return new Response(
                  JSON.stringify({
                    error: 'Webhook processing conflict',
                    message: 'Another request is processing this webhook. Please retry.',
                    retry_after: 1,
                  }),
                  {
                    status: 409, // Conflict
                    headers: {
                      ...corsHeaders,
                      'Content-Type': 'application/json',
                      'Retry-After': '1',
                    },
                  }
                );
              }
              
              // OTIMIZAÇÃO: Responde ao Chatwoot IMEDIATAMENTE após adquirir lock
              // O processamento será feito de forma assíncrona
              console.log(`[INFO] ✅ Respondendo IMEDIATAMENTE ao Chatwoot (200 OK)`);
              console.log(`[INFO] Processando webhook com lock confirmado (async)...`);
              
              const immediateResponse = new Response(JSON.stringify({ 
                status: 'accepted',
                message: 'Webhook received and queued for processing',
                instance_id: instanceId,
                processed_async: true
              }), {
                status: 200,
                headers: {
                  ...corsHeaders,
                  'Content-Type': 'application/json',
                  'X-Webhook-Status': 'accepted',
                  'X-Processing-Async': 'true',
                },
              });
              
              // Log do conteúdo do webhook para diagnóstico
              try {
                const webhookBodyParsed = JSON.parse(webhookBody);
                console.log(`[INFO] Webhook event type: ${webhookBodyParsed.event || 'unknown'}`);
                console.log(`[INFO] Webhook conversation ID: ${webhookBodyParsed.conversation?.id || 'N/A'}`);
                console.log(`[INFO] Webhook message ID: ${webhookBodyParsed.message?.id || webhookBodyParsed.message_id || 'N/A'}`);
                if (webhookBodyParsed.message?.content) {
                  console.log(`[INFO] Webhook message content preview: ${webhookBodyParsed.message.content.substring(0, 100)}...`);
                }
              } catch (e) {
                console.log(`[WARN] Não foi possível parsear webhook body para log: ${e.message}`);
              }
              
              if (DEBUG_MODE) {
                console.log(`[DEBUG] Webhook body preview: ${webhookBody.substring(0, 300)}...`);
                console.log(`[DEBUG] Webhook cache key: ${webhookKey.substring(0, 100)}...`);
              }
              
              // CRÍTICO: Marca como processando ANTES de processar (evita duplicação)
              // Armazena um marcador "processando" no cache imediatamente
              const processingMarker = {
                timestamp: Date.now(),
                response: { status: 'processing', message: 'Webhook está sendo processado' },
                processing: true
              };
              await setCachedWebhook(webhookKey, processingMarker, cache);
              console.log(`[INFO] ✅ Marcador de processamento armazenado no cache ANTES de processar`);
              
              // CRÍTICO: Responde IMEDIATAMENTE ao Chatwoot (200 OK) para evitar retry
              // Processa o webhook de forma assíncrona usando ctx.waitUntil
              const responsePromise = (async () => {
                try {
                  console.log(`[INFO] Proxying webhook to UAZAPI (async): ${targetUrl}`);
                  console.log(`[INFO] Webhook body length: ${webhookBody.length} bytes`);
                  console.log(`[INFO] Instance ID: ${instanceId}, Token preview: ${instanceToken ? instanceToken.substring(0, 20) + '...' : 'NULL'}`);
                  
                  const webhookResponse = await fetch(targetUrl, {
                    method: request.method,
                    headers: {
                      'Content-Type': 'application/json',
                      'token': instanceToken,
                    },
                    body: webhookBody,
                  });
                  
                  console.log(`[INFO] UAZAPI webhook response status: ${webhookResponse.status}`);
                  
                  const webhookResponseData = await webhookResponse.text();
                  
                  console.log(`[INFO] UAZAPI webhook response length: ${webhookResponseData.length} bytes`);
                  console.log(`[INFO] UAZAPI webhook response: ${webhookResponseData}`);
                  
                  if (webhookResponse.status === 401) {
                    console.error(`[ERROR] UAZAPI returned 401 Unauthorized. Token may be invalid or expired.`);
                    console.error(`[ERROR] Instance ID: ${instanceId}, Token preview: ${instanceToken ? instanceToken.substring(0, 20) + '...' : 'NULL'}`);
                    console.error(`[ERROR] Target URL: ${targetUrl}`);
                    console.error(`[ERROR] Request method: ${request.method}`);
                    console.error(`[ERROR] This may indicate that the UAZAPI does not accept Chatwoot webhooks directly, or the token is invalid.`);
                  } else if (!webhookResponse.ok) {
                    console.error(`[ERROR] UAZAPI returned error status: ${webhookResponse.status}`);
                    console.error(`[ERROR] Response: ${webhookResponseData.substring(0, 500)}`);
                  } else {
                    console.log(`[INFO] ✅ Webhook processado com sucesso pela UAZAPI (status: ${webhookResponse.status})`);
                  }
                  
                  // Armazena resposta no cache para prevenir duplicação (apenas se sucesso)
                  // CRÍTICO: Atualiza o cache com a resposta final
                  if (webhookResponse.status >= 200 && webhookResponse.status < 300) {
                    try {
                      const responseData = JSON.parse(webhookResponseData);
                      // Armazena cache com resposta final (substitui o marcador de processamento)
                      await setCachedWebhook(webhookKey, responseData, cache);
                      console.log(`[INFO] ✅ Webhook armazenado no cache com resposta final`);
                      // Nota: O registro no banco já foi feito ANTES de processar, então não precisa fazer novamente aqui
                    } catch (parseError) {
                      console.warn(`[WARN] Erro ao armazenar cache: ${parseError.message}`);
                    }
                  } else {
                    // Se falhou, remove o marcador de processamento após um tempo
                    // Mas mantém por um tempo curto para evitar reprocessamento imediato
                    setTimeout(async () => {
                      try {
                        await cache.delete(new Request(`https://chatwoot-cache/${webhookKey}`));
                        console.log(`[INFO] Marcador de processamento removido após falha`);
                      } catch (e) {
                        // Ignora erro
                      }
                    }, 30000); // Remove após 30 segundos se falhou
                  }
                  
                  console.log(`[INFO] ========================================`);
                  console.log(`[INFO] ✅ WEBHOOK PROCESSADO COM SUCESSO (async)`);
                  console.log(`[INFO] Status UAZAPI: ${webhookResponse.status}`);
                  console.log(`[INFO] Instance ID: ${instanceId}`);
                  console.log(`[INFO] ========================================`);
                } catch (asyncError) {
                  console.error(`[ERROR] Erro ao processar webhook de forma assíncrona: ${asyncError.message}`);
                  console.error(`[ERROR] Stack: ${asyncError.stack}`);
                  // Remove marcador de processamento em caso de erro após um tempo
                  setTimeout(async () => {
                    try {
                      await cache.delete(new Request(`https://chatwoot-cache/${webhookKey}`));
                      console.log(`[INFO] Marcador de processamento removido após erro`);
                    } catch (e) {
                      // Ignora erro
                    }
                  }, 30000);
                } finally {
                  // Remove o lock após processar (libera imediatamente para outras requisições)
                  if (lockAcquired) {
                    cache.delete(lockRequest).catch(() => {
                      // Ignora erro (lock vai expirar sozinho)
                    });
                    console.log(`[INFO] Lock liberado`);
                  }
                }
              })();
              
              // Processa de forma assíncrona usando ctx.waitUntil se disponível
              if (ctx && typeof ctx.waitUntil === 'function') {
                ctx.waitUntil(responsePromise);
              } else {
                // Fallback: processa em background sem bloquear resposta
                responsePromise.catch(err => {
                  console.error(`[ERROR] Erro no processamento assíncrono: ${err.message}`);
                });
              }
              
              // Retorna resposta imediata (já criada acima)
              return immediateResponse;
            } else {
              console.error(`[ERROR] ❌ Instância não encontrada ou sem token`);
              console.error(`[ERROR] Instance ID: ${instanceId}`);
              console.error(`[ERROR] Response: ${JSON.stringify(instances)}`);
              return new Response(
                JSON.stringify({ 
                  error: 'Instance not found or inactive',
                  instance_id: instanceId 
                }),
                {
                  status: 404,
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                }
              );
            }
          } else {
            console.error(`[ERROR] ❌ Falha ao buscar instância no banco`);
            console.error(`[ERROR] Status: ${instanceResponse.status}`);
            const errorText = await instanceResponse.text().catch(() => 'N/A');
            console.error(`[ERROR] Response: ${errorText.substring(0, 500)}`);
            return new Response(
              JSON.stringify({ 
                error: 'Failed to validate instance',
                status: instanceResponse.status 
              }),
              {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              }
            );
          }
        } catch (error) {
          console.error(`[ERROR] ❌ Erro ao processar webhook do Chatwoot`);
          console.error(`[ERROR] Instance ID: ${instanceId}`);
          console.error(`[ERROR] Error: ${error.message}`);
          console.error(`[ERROR] Stack: ${error.stack}`);
          return new Response(
            JSON.stringify({ 
              error: 'Internal server error', 
              details: error.message,
              instance_id: instanceId
            }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
      } else {
        console.error(`[ERROR] Invalid Chatwoot webhook path: ${path}`);
        return new Response(
          JSON.stringify({ error: 'Invalid webhook path' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }
    
    if (!supportedEndpoints.includes(path) && !isChatwootWebhook) {
      console.warn(`[WARN] Unsupported endpoint requested: ${path} (Original: ${url.pathname})`);
      return new Response(
        JSON.stringify({
          error: 'Endpoint not supported',
          code: 'ENDPOINT_NOT_FOUND',
          message: `The endpoint '${path}' is not supported. Supported endpoints: ${supportedEndpoints.join(', ')}`,
          requestedPath: path,
          originalPath: url.pathname,
          supportedEndpoints: supportedEndpoints
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Lê o body da requisição apenas para métodos que podem ter body
    let body = '';
    let bodyData = {};
    
    if (request.method === 'POST' || request.method === 'PUT') {
      body = await request.text();
      
      // Valida body JSON básico apenas se houver body
      if (body && body.trim()) {
        try {
          bodyData = JSON.parse(body);
        } catch (e) {
          return new Response(
            JSON.stringify({ error: 'Invalid JSON in request body' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
      }
    }
    
    // Endpoint especial para criar inbox no Chatwoot (não precisa de token de instância)
    if (path === '/chatwoot/create-inbox' && request.method === 'POST') {
      let createInboxUrl = '';
      try {
        // Valida campos obrigatórios
        if (!bodyData.chat_url || !bodyData.chat_api_key || !bodyData.chat_account_id || !bodyData.instance_name) {
          return new Response(
            JSON.stringify({
              error: 'Missing required fields',
              required: ['chat_url', 'chat_api_key', 'chat_account_id', 'instance_name'],
              received: Object.keys(bodyData)
            }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        // instance_id não é mais necessário aqui - a configuração do webhook será feita via /chatwoot/config após a conexão

        const chatwootBaseUrl = bodyData.chat_url.endsWith('/') 
          ? bodyData.chat_url.slice(0, -1) 
          : bodyData.chat_url;
        
        createInboxUrl = `${chatwootBaseUrl}/api/v1/accounts/${bodyData.chat_account_id}/inboxes`;
        
        console.log(`[INFO] Creating Chatwoot inbox: ${createInboxUrl}`);
        console.log(`[INFO] Account ID: ${bodyData.chat_account_id}`);
        console.log(`[INFO] Instance name: ${bodyData.instance_name}`);
        console.log(`[INFO] API Key preview: ${bodyData.chat_api_key ? bodyData.chat_api_key.substring(0, 10) + '...' : 'MISSING'}`);
        
        // Payload para criar inbox no Chatwoot
        // Para inboxes de API (WhatsApp), precisamos especificar o channel type
        // Baseado na documentação do Chatwoot, o mínimo necessário é name e channel.type
        const inboxPayload = {
          name: bodyData.instance_name,
          channel: {
            type: 'api' // Tipo de channel para integração via API (WhatsApp)
          }
        };
        
        console.log(`[INFO] Request payload:`, JSON.stringify(inboxPayload, null, 2));
        
        const inboxResponse = await fetch(createInboxUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api_access_token': bodyData.chat_api_key,
          },
          body: JSON.stringify(inboxPayload),
        });

        console.log(`[INFO] Chatwoot response status: ${inboxResponse.status}`);
        console.log(`[INFO] Chatwoot response headers:`, Object.fromEntries(inboxResponse.headers.entries()));

        if (inboxResponse.ok) {
          const inboxData = await inboxResponse.json();
          console.log(`[INFO] Chatwoot inbox created successfully: ${inboxData.id}`);
          
          // A configuração completa do webhook será feita via /chatwoot/config após a instância ser conectada
          // Isso evita tentar configurar webhook quando a instância ainda não está conectada
          console.log(`[INFO] Inbox criada. Webhook será configurado automaticamente via /chatwoot/config após a conexão da instância.`);
          
          return new Response(
            JSON.stringify({
              success: true,
              inbox_id: inboxData.id,
              inbox: inboxData,
              note: 'Inbox created. Webhook will be configured automatically via /chatwoot/config after instance connection.'
            }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        } else {
          const errorText = await inboxResponse.text();
          let errorDetails;
          try {
            errorDetails = JSON.parse(errorText);
          } catch {
            errorDetails = { message: errorText.substring(0, 500), raw: errorText };
          }
          console.error(`[ERROR] Failed to create Chatwoot inbox: ${inboxResponse.status}`);
          console.error(`[ERROR] Error details:`, JSON.stringify(errorDetails, null, 2));
          console.error(`[ERROR] Request URL: ${createInboxUrl}`);
          console.error(`[ERROR] Account ID: ${bodyData.chat_account_id}`);
          console.error(`[ERROR] API Key preview: ${bodyData.chat_api_key ? bodyData.chat_api_key.substring(0, 10) + '...' : 'MISSING'}`);
          
          return new Response(
            JSON.stringify({
              error: 'Failed to create Chatwoot inbox',
              status: inboxResponse.status,
              details: errorDetails,
              request_url: createInboxUrl,
              account_id: bodyData.chat_account_id
            }),
            {
              status: inboxResponse.status,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
      } catch (error) {
        console.error(`[ERROR] Error creating Chatwoot inbox:`, error);
        console.error(`[ERROR] Error stack:`, error.stack);
        console.error(`[ERROR] Request URL: ${createInboxUrl || 'N/A'}`);
        return new Response(
          JSON.stringify({
            error: 'Internal server error while creating Chatwoot inbox',
            message: error.message,
            stack: DEBUG_MODE ? error.stack : undefined
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Para endpoints de integração Chatwoot, adiciona webhook_url customizado no body antes de enviar para UAZAPI
    // Isso garante que quando a UAZAPI configurar o webhook no Chatwoot, use a URL correta do nosso domínio
    if (isIntegrationEndpoint && path === '/chatwoot/config' && bodyData && Object.keys(bodyData).length > 0 && validation && validation.instance) {
      console.log(`[INFO] Processing Chatwoot config request - adding custom webhook_url to body`);
      
      // Constrói a URL do webhook usando nosso domínio customizado
      const customWebhookUrl = `https://api.evasend.com.br/whatsapp/chatwoot/webhook/${validation.instance.id}`;
      
      // Adiciona ou substitui o webhook_url no body
      // A UAZAPI deve usar este campo ao configurar o webhook no Chatwoot
      // Tentamos múltiplos campos possíveis que a UAZAPI pode aceitar
      bodyData.webhook_url = customWebhookUrl;
      bodyData.webhookUrl = customWebhookUrl; // camelCase alternativo
      bodyData.webhook = customWebhookUrl; // Nome curto alternativo
      bodyData.callback_url = customWebhookUrl; // Nome alternativo comum
      bodyData.callbackUrl = customWebhookUrl; // camelCase do callback
      
      console.log(`[INFO] Added webhook_url to request body: ${customWebhookUrl}`);
      console.log(`[INFO] Added multiple webhook URL fields (webhook_url, webhookUrl, webhook, callback_url, callbackUrl) to ensure UAZAPI uses custom domain`);
      
      // Log completo do body modificado para debug
      console.log(`[INFO] Modified request body keys: ${Object.keys(bodyData).join(', ')}`);
      if (DEBUG_MODE) {
        console.log(`[DEBUG] Full modified body for Chatwoot config: ${JSON.stringify(bodyData, null, 2)}`);
      } else {
        console.log(`[INFO] Modified body preview: ${JSON.stringify(bodyData).substring(0, 500)}...`);
      }
      
      // Também substitui qualquer URL que contenha sender.uazapi.com no body (caso o usuário tenha enviado)
      const replaceUrlsInBody = (obj) => {
        if (typeof obj === 'string') {
          if (obj.includes('sender.uazapi.com')) {
            const replaced = obj.replace(/https?:\/\/sender\.uazapi\.com(\/.*)?/g, (match) => {
              const path = match.includes('/') ? match.replace('https://sender.uazapi.com', '') : '';
              return `https://api.evasend.com.br/whatsapp${path}`;
            });
            if (replaced !== obj) {
              console.log(`[INFO] Replaced URL in body: ${obj.substring(0, 80)}... -> ${replaced.substring(0, 80)}...`);
            }
            return replaced;
          }
          return obj;
        } else if (Array.isArray(obj)) {
          return obj.map(item => replaceUrlsInBody(item));
        } else if (obj !== null && typeof obj === 'object') {
          const replaced = {};
          for (const key in obj) {
            // Não substitui webhook_url que acabamos de adicionar
            if (key === 'webhook_url') {
              replaced[key] = obj[key];
            } else {
              replaced[key] = replaceUrlsInBody(obj[key]);
            }
          }
          return replaced;
        }
        return obj;
      };
      
      bodyData = replaceUrlsInBody(bodyData);
    }

    // Valida campos obrigatórios apenas para métodos POST/PUT
    if (request.method === 'POST' || request.method === 'PUT') {
      // Valida campos obrigatórios para send-text
      if (path === '/send-text' || path === '/functions/v1/send-text') {
        if (!bodyData.number || !bodyData.text) {
          return new Response(
            JSON.stringify({
              error: "Fields 'number' and 'text' are required",
            }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
      }

      // Valida campos obrigatórios para send-media
      // Suporta múltiplos formatos de path: /send-media, /functions/v1/send-media, /whatsapp/send-media
      if (path === '/send-media' || path.endsWith('/send-media')) {
        if (!bodyData.number) {
          return new Response(
          JSON.stringify({
            error: "Field 'number' is required",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      if (!bodyData.type) {
        return new Response(
          JSON.stringify({
            error: "Field 'type' is required (image, video, document, audio, myaudio, ptt, sticker)",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
        if (!bodyData.file) {
          return new Response(
          JSON.stringify({
            error: "Field 'file' is required (URL or base64)",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      // Validação de tipos suportados
      const supportedTypes = ['image', 'video', 'document', 'audio', 'myaudio', 'ptt', 'sticker'];
      if (!supportedTypes.includes(bodyData.type)) {
        return new Response(
          JSON.stringify({
            error: `Media type '${bodyData.type}' not supported. Supported types: ${supportedTypes.join(', ')}`,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

      // Valida campos obrigatórios para send-menu
      if (path === '/send-menu' || path.endsWith('/send-menu')) {
        if (!bodyData.number) {
          return new Response(
          JSON.stringify({
            error: "Field 'number' is required",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      if (!bodyData.type) {
        return new Response(
          JSON.stringify({
            error: "Field 'type' is required (button, list, poll, carousel)",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
        if (!bodyData.text) {
          return new Response(
          JSON.stringify({
            error: "Field 'text' is required",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      if (!bodyData.choices || !Array.isArray(bodyData.choices) || bodyData.choices.length === 0) {
        return new Response(
          JSON.stringify({
            error: "Field 'choices' is required and must be a non-empty array",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

      // Valida campos obrigatórios para send-carousel
      if (path === '/send-carousel' || path.endsWith('/send-carousel')) {
        if (!bodyData.number) {
          return new Response(
          JSON.stringify({
            error: "Field 'number' is required",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
        if (!bodyData.text) {
          return new Response(
          JSON.stringify({
            error: "Field 'text' is required",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      if (!bodyData.carousel || !Array.isArray(bodyData.carousel) || bodyData.carousel.length === 0) {
        return new Response(
          JSON.stringify({
            error: "Field 'carousel' is required and must be a non-empty array",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

      // Valida campos obrigatórios para send-pix-button
      if (path === '/send-pix-button' || path.endsWith('/send-pix-button')) {
        if (!bodyData.number) {
          return new Response(
          JSON.stringify({
            error: "Field 'number' is required",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      if (!bodyData.pixType) {
        return new Response(
          JSON.stringify({
            error: "Field 'pixType' is required (CPF, CNPJ, PHONE, EMAIL, EVP)",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      if (!bodyData.pixKey) {
        return new Response(
          JSON.stringify({
            error: "Field 'pixKey' is required",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

      // Valida campos obrigatórios para send-status
      if (path === '/send-status' || path.endsWith('/send-status')) {
        if (!bodyData.type) {
          return new Response(
          JSON.stringify({
            error: "Field 'type' is required (text, image, video, audio)",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      if (bodyData.type === 'text' && !bodyData.text) {
        return new Response(
          JSON.stringify({
            error: "Field 'text' is required for type='text'",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      if (bodyData.type !== 'text' && !bodyData.file) {
        return new Response(
          JSON.stringify({
            error: `Field 'file' is required for type='${bodyData.type}'`,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }
    }

    // Determina o destino do proxy baseado no tipo de endpoint
    // Endpoints de instância, perfil e integrações vão para API externa
    // Endpoints de envio (send-*) vão para Supabase Edge Functions
    const EXTERNAL_API_URL = 'https://sender.uazapi.com';
    
    if (isIntegrationEndpoint) {
      console.log(`[INFO] Integration endpoint detected: ${path}`);
    }
    
    let targetUrl;
    const fetchHeaders = {
      'token': token, // Passa o token para a API
    };
    
    if (isInstanceOrProfileEndpoint || isIntegrationEndpoint) {
      // Proxy para API externa (sender.uazapi.com)
      targetUrl = `${EXTERNAL_API_URL}${path}`;
      
      // Headers para API externa
      fetchHeaders['Accept'] = 'application/json';
      
      // Adiciona Content-Type apenas para métodos que podem ter body
      if (request.method === 'POST' || request.method === 'PUT') {
        fetchHeaders['Content-Type'] = 'application/json';
      }
      
      if (DEBUG_MODE) {
        console.log(`[DEBUG] Proxying to External API: ${targetUrl}`);
      }
    } else {
      // Proxy para Supabase Edge Functions
      let functionPath = path;
      if (functionPath.startsWith('/functions/v1/')) {
        // Já tem o prefixo correto
      } else if (functionPath.startsWith('/')) {
        // Adiciona o prefixo se não tiver
        functionPath = `/functions/v1${functionPath}`;
      } else {
        functionPath = `/functions/v1/${functionPath}`;
      }
      
      targetUrl = `${SUPABASE_URL}${functionPath}`;
      
      // Headers específicos para Edge Functions
      fetchHeaders['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`;
      if (validation.instance) {
      fetchHeaders['X-Instance-ID'] = validation.instance.id;
      fetchHeaders['X-User-ID'] = validation.instance.user_id;
      }
      
      // Adiciona Content-Type apenas para métodos que podem ter body
      if (request.method === 'POST' || request.method === 'PUT') {
        fetchHeaders['Content-Type'] = 'application/json';
      }
      
      if (DEBUG_MODE) {
        console.log(`[DEBUG] Proxying to Edge Function: ${targetUrl}`);
      }
    }
    
    const requestOrigin = request.headers.get('origin') || request.headers.get('referer') || url.origin;
    const ipAddress = request.headers.get('CF-Connecting-IP') || request.headers.get('x-forwarded-for') || null;
    const requestStartTimestamp = Date.now();
    
    // Prepara body apenas para métodos que podem ter body
    const fetchOptions = {
      method: request.method, // Passa o método HTTP original (GET, POST, PUT, DELETE)
      headers: fetchHeaders,
    };
    
    // Adiciona body apenas se houver dados e o método permitir
    if ((request.method === 'POST' || request.method === 'PUT') && Object.keys(bodyData).length > 0) {
      fetchOptions.body = JSON.stringify(bodyData);
    }
    
    const response = await fetch(targetUrl, fetchOptions);
    
    const latencyMs = Date.now() - requestStartTimestamp;
    
    // Log do status da resposta
    if (DEBUG_MODE || !response.ok) {
      console.log(`[INFO] API response - Status: ${response.status}, URL: ${targetUrl}`);
    }
    
    // Para endpoints de integração, verifica headers também
    if (isIntegrationEndpoint) {
      console.log(`[INFO] Checking response headers for webhook URL`);
      const headers = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
        if (key.toLowerCase().includes('webhook') || value.includes('sender.uazapi.com')) {
          console.log(`[INFO] Found webhook-related header: ${key} = ${value.substring(0, 100)}`);
        }
      });
      if (DEBUG_MODE) {
        console.log(`[DEBUG] All response headers:`, JSON.stringify(headers));
      }
    }
    
    // Lê a resposta (só pode ler uma vez!)
    // Usa 'let' para permitir modificação posterior (ex: adicionar webhook_url)
    let responseData = await response.text();
    
    const baseLogPayload = {
      endpoint: path,
      method: request.method,
      status_code: response.status,
      latency_ms: latencyMs,
      success: response.ok,
      user_id: validation.instance ? validation.instance.user_id : null,
      instance_id: validation.instance ? validation.instance.id : null,
      error_message: null,
      request_origin: requestOrigin,
      ip_address: ipAddress,
    };
    
    // Se a API retornou erro, loga detalhes
    if (!response.ok) {
      TOKEN_CACHE.delete(token);
      baseLogPayload.error_message = responseData.substring(0, 500);
      
      // Se for 404, pode ser que o endpoint não existe ou a URL está errada
      if (response.status === 404) {
        const endpointName = path.replace('/', '').replace('functions/v1/', '') || 'unknown';
        console.error(`[ERROR] Endpoint not found - URL: ${targetUrl}, Path: ${path}, Original Path: ${url.pathname}`);
        
        // Retorna erro mais descritivo para 404
        try {
          const errorJson = JSON.parse(responseData);
          baseLogPayload.error_message = errorJson.message || baseLogPayload.error_message;
          const logPromise = logApiRequest({
            supabaseUrl: SUPABASE_URL,
            serviceKey: SUPABASE_SERVICE_KEY,
            payload: baseLogPayload,
            debugMode: DEBUG_MODE,
          });
          if (ctx && typeof ctx.waitUntil === 'function') {
            ctx.waitUntil(logPromise);
          } else {
            await logPromise;
          }
          return new Response(
            JSON.stringify({
              error: errorJson.message || 'Endpoint not found',
              code: errorJson.code || 'ENDPOINT_NOT_FOUND',
              message: isInstanceOrProfileEndpoint 
                ? `The endpoint '${endpointName}' was not found in the external API.`
                : `The function '${endpointName}' was not found. Please check if the function is deployed in Supabase.`,
              requestedUrl: targetUrl,
              requestedPath: path,
              endpointName: endpointName,
            }),
            {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        } catch (e) {
          const logPromise = logApiRequest({
            supabaseUrl: SUPABASE_URL,
            serviceKey: SUPABASE_SERVICE_KEY,
            payload: baseLogPayload,
            debugMode: DEBUG_MODE,
          });
          if (ctx && typeof ctx.waitUntil === 'function') {
            ctx.waitUntil(logPromise);
          } else {
            await logPromise;
          }
          return new Response(
            JSON.stringify({
              error: 'Endpoint not found',
              code: 'ENDPOINT_NOT_FOUND',
              message: isInstanceOrProfileEndpoint
                ? `The endpoint '${endpointName}' was not found in the external API.`
                : `The function '${endpointName}' was not found. Please check if the function is deployed in Supabase.`,
              requestedUrl: targetUrl,
              requestedPath: path,
              endpointName: endpointName,
            }),
            {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
      }
      
      // Loga a resposta de erro para debugging (já temos responseData)
      if (DEBUG_MODE) {
        console.error(`[ERROR] API error response: ${responseData.substring(0, 500)}`);
      }
    }
    
    let responseJson;
    try {
      responseJson = JSON.parse(responseData);
      
      // Substitui URLs do webhook para usar o domínio customizado
      // Aplica apenas para endpoints de integração (Chatwoot)
      if (isIntegrationEndpoint && responseJson) {
        console.log(`[INFO] Chatwoot endpoint detected, checking for webhook URLs in response`);
        console.log(`[INFO] Response keys: ${Object.keys(responseJson).join(', ')}`);
        console.log(`[INFO] Response preview: ${JSON.stringify(responseJson).substring(0, 300)}`);
        
        // Log completo da resposta para debug
        if (DEBUG_MODE) {
          console.log(`[DEBUG] Full response JSON: ${JSON.stringify(responseJson, null, 2)}`);
        }
        
        // Verifica se a resposta tem webhook_url ou webhookUrl
        // Se não tiver, pode ser que a API não retorne, mas vamos adicionar na resposta
        // baseado no ID da instância
        const hasWebhookUrl = responseJson.webhook_url || responseJson.webhookUrl || responseJson.webhook;
        let webhookWasAdded = false;
        
        if (!hasWebhookUrl && response.ok && validation && validation.instance) {
          try {
            // Constrói a URL do webhook usando o domínio customizado e o ID da instância
            const webhookUrl = `https://api.evasend.com.br/whatsapp/chatwoot/webhook/${validation.instance.id}`;
            responseJson.webhook_url = webhookUrl;
            webhookWasAdded = true;
            console.log(`[INFO] Added webhook_url to response: ${webhookUrl}`);
          } catch (error) {
            console.error(`[ERROR] Failed to add webhook_url: ${error.message}`);
          }
        } else if (hasWebhookUrl) {
          console.log(`[INFO] Found existing webhook URL in response: ${responseJson.webhook_url || responseJson.webhookUrl || responseJson.webhook}`);
        } else {
          console.log(`[WARN] Cannot add webhook_url: validation=${!!validation}, instance=${!!(validation && validation.instance)}, response.ok=${response.ok}`);
        }
        
        // Função recursiva para substituir URLs em qualquer nível do objeto
        // Definida fora do try para ser acessível em todo o escopo
        let urlReplaced = false;
        const replaceWebhookUrls = (obj) => {
          if (typeof obj !== 'object' || obj === null) {
            return obj;
          }
          
          if (Array.isArray(obj)) {
            return obj.map(item => replaceWebhookUrls(item));
          }
          
          const result = {};
          for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
              const value = obj[key];
              if (typeof value === 'string' && value.includes('sender.uazapi.com')) {
                // Substitui qualquer URL que contenha sender.uazapi.com
                const originalUrl = value;
                const newUrl = value
                  .replace('https://sender.uazapi.com/chatwoot/', 'https://api.evasend.com.br/whatsapp/chatwoot/')
                  .replace('https://sender.uazapi.com', 'https://api.evasend.com.br/whatsapp');
                result[key] = newUrl;
                urlReplaced = true;
                console.log(`[INFO] Replaced webhook URL in field '${key}': ${originalUrl.substring(0, 80)}... -> ${newUrl.substring(0, 80)}...`);
              } else if (typeof value === 'object' && value !== null) {
                result[key] = replaceWebhookUrls(value);
              } else {
                result[key] = value;
              }
            }
          }
          return result;
        };
        
        try {
          console.log(`[INFO] About to apply recursive URL replacement. responseJson keys: ${Object.keys(responseJson).join(', ')}`);
          
          // Aplica a substituição recursivamente usando a função definida acima
          responseJson = replaceWebhookUrls(responseJson);
          console.log(`[INFO] After recursive replacement. responseJson keys: ${Object.keys(responseJson).join(', ')}, has webhook_url: ${!!responseJson.webhook_url}`);
          
          // Sempre atualiza responseData se modificamos o responseJson (adicionamos webhook_url ou substituímos URLs)
          // Verifica se o webhook_url foi adicionado ou se houve substituição de URLs
          const hasWebhookInResponse = !!(responseJson.webhook_url || responseJson.webhookUrl);
          const wasModified = urlReplaced || hasWebhookInResponse || webhookWasAdded;
          
          console.log(`[INFO] Response modification check - urlReplaced: ${urlReplaced}, hasWebhookInResponse: ${hasWebhookInResponse}, webhookWasAdded: ${webhookWasAdded}, wasModified: ${wasModified}`);
          
          if (wasModified) {
            if (urlReplaced) {
              console.log(`[INFO] Webhook URL replacement completed successfully`);
            }
            // Atualiza responseData com o JSON modificado
            responseData = JSON.stringify(responseJson);
            console.log(`[INFO] Final response updated. Contains webhook_url: ${hasWebhookInResponse}`);
            console.log(`[INFO] Final response preview: ${responseData.substring(0, 200)}`);
          } else {
            console.log(`[WARN] No webhook URLs found to replace in response. Response keys: ${Object.keys(responseJson).join(', ')}`);
            if (DEBUG_MODE) {
              console.log(`[DEBUG] Full response: ${JSON.stringify(responseJson).substring(0, 500)}`);
            }
          }
          
          // Tenta atualizar o webhook automaticamente no Chatwoot se tiver webhook_url e os dados necessários
          if (response.ok && responseJson.webhook_url && bodyData && bodyData.url && bodyData.access_token && bodyData.account_id && bodyData.inbox_id) {
            try {
              console.log(`[INFO] Attempting to update webhook in Chatwoot automatically`);
              const chatwootBaseUrl = bodyData.url.endsWith('/') ? bodyData.url.slice(0, -1) : bodyData.url;
              const updateWebhookUrl = `${chatwootBaseUrl}/api/v1/accounts/${bodyData.account_id}/inboxes/${bodyData.inbox_id}`;
              
              const chatwootResponse = await fetch(updateWebhookUrl, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  'api_access_token': bodyData.access_token,
                },
                body: JSON.stringify({
                  webhook_url: responseJson.webhook_url
                }),
              });
              
              if (chatwootResponse.ok) {
                const chatwootData = await chatwootResponse.json();
                // Verifica se o webhook_url foi realmente atualizado na resposta
                const webhookWasUpdated = chatwootData.webhook_url === responseJson.webhook_url;
                
                if (webhookWasUpdated) {
                  responseJson.webhook_updated_in_chatwoot = true;
                  responseJson.chatwoot_response = chatwootData;
                  console.log(`[INFO] Webhook updated successfully in Chatwoot via inbox PATCH`);
                } else {
                  // Salva a resposta mesmo que o webhook não tenha sido atualizado
                  responseJson.chatwoot_response = chatwootData;
                  console.log(`[WARN] PATCH returned OK but webhook_url was not updated. Current: ${chatwootData.webhook_url}, Expected: ${responseJson.webhook_url}`);
                  // Aplica substituição recursiva no chatwoot_response também
                  responseJson.chatwoot_response = replaceWebhookUrls(chatwootData);
                  
                  // Se o Chatwoot não permitir atualizar webhook_url via PATCH na inbox,
                  // isso indica que o webhook está configurado diretamente na inbox e não pode ser atualizado via API
                  // O Chatwoot pode ter restrições de segurança que impedem atualização via API
                  console.log(`[INFO] Chatwoot may not allow updating webhook_url via inbox PATCH API. This is a Chatwoot API limitation.`);
                  console.log(`[INFO] The webhook is configured directly in the inbox settings and may need to be updated manually in the Chatwoot UI.`);
                  
                  // Continua para tentar via endpoint de webhooks (pode ser que o webhook esteja na lista de webhooks separados)
                }
              } else {
                // Se o PATCH falhou, captura o erro
                const errorText = await chatwootResponse.text().catch(() => 'Unknown error');
                console.log(`[WARN] PATCH to Chatwoot inbox failed: ${chatwootResponse.status} - ${errorText.substring(0, 100)}`);
              }
              
              // Se PATCH não funcionou ou não atualizou o webhook, tenta criar/atualizar via endpoint de webhooks
              if (!responseJson.webhook_updated_in_chatwoot) {
                const webhooksUrl = `${chatwootBaseUrl}/api/v1/accounts/${bodyData.account_id}/webhooks`;
                const webhooksUrlWithFilter = `${webhooksUrl}?inbox_id=${bodyData.inbox_id}`;
                
                try {
                  // Primeiro tenta buscar webhooks filtrados por inbox_id
                  let listWebhooksResponse = await fetch(webhooksUrlWithFilter, {
                    method: 'GET',
                    headers: {
                      'api_access_token': bodyData.access_token,
                    },
                  });
                  
                  // Se não retornar resultados, tenta buscar todos os webhooks
                  if (listWebhooksResponse.ok) {
                    const filteredWebhooks = await listWebhooksResponse.json();
                    if (!Array.isArray(filteredWebhooks) || filteredWebhooks.length === 0) {
                      console.log(`[INFO] No webhooks found with inbox_id filter, trying to list all webhooks`);
                      listWebhooksResponse = await fetch(webhooksUrl, {
                        method: 'GET',
                        headers: {
                          'api_access_token': bodyData.access_token,
                        },
                      });
                    }
                  } else {
                    // Se o filtro falhar, tenta buscar todos
                    console.log(`[INFO] Filtered webhook list failed, trying to list all webhooks`);
                    listWebhooksResponse = await fetch(webhooksUrl, {
                      method: 'GET',
                      headers: {
                        'api_access_token': bodyData.access_token,
                      },
                    });
                  }
                  
                  if (listWebhooksResponse.ok) {
                    const existingWebhooks = await listWebhooksResponse.json();
                    console.log(`[INFO] Found ${Array.isArray(existingWebhooks) ? existingWebhooks.length : 0} webhooks in Chatwoot`);
                    
                    // Função auxiliar para encontrar webhook
                    const findWebhook = (webhooks, targetUrl, inboxId) => {
                      if (!Array.isArray(webhooks)) return null;
                      
                      // 1. Busca por URL exata (com qualquer domínio)
                      let found = webhooks.find(wh => {
                        const whUrl = wh.url || wh.webhook_url || '';
                        return whUrl === targetUrl || whUrl.replace(/https?:\/\/[^\/]+/, '') === targetUrl.replace(/https?:\/\/[^\/]+/, '');
                      });
                      if (found) {
                        console.log(`[INFO] Found webhook by exact URL match (ID: ${found.id})`);
                        return found;
                      }

                      // 2. Busca por path (ID da instância - última parte da URL)
                      const targetPath = targetUrl.split('/').pop();
                      found = webhooks.find(wh => {
                        const whUrl = wh.url || wh.webhook_url || '';
                        const whPath = whUrl.split('/').pop();
                        return whPath === targetPath;
                      });
                      if (found) {
                        console.log(`[INFO] Found webhook by path match (ID: ${found.id}, path: ${targetPath})`);
                        return found;
                      }

                      // 3. Busca por inbox_id (fallback)
                      found = webhooks.find(wh => wh.inbox_id && wh.inbox_id.toString() === inboxId.toString());
                      if (found) {
                        console.log(`[INFO] Found webhook by inbox_id match (ID: ${found.id})`);
                        return found;
                      }
                      
                      // 4. Busca por qualquer URL que contenha o path (mais flexível)
                      found = webhooks.find(wh => {
                        const whUrl = wh.url || wh.webhook_url || '';
                        return whUrl.includes(targetPath) || targetUrl.includes(whUrl.split('/').pop());
                      });
                      if (found) {
                        console.log(`[INFO] Found webhook by flexible path match (ID: ${found.id})`);
                        return found;
                      }
                      
                      return null;
                    };
                    
                    const existingWebhook = findWebhook(existingWebhooks, responseJson.webhook_url, bodyData.inbox_id);
                    
                    if (existingWebhook) {
                      // Atualiza webhook existente usando PATCH conforme documentação do Chatwoot
                      console.log(`[INFO] Updating existing webhook (ID: ${existingWebhook.id}) with URL: ${responseJson.webhook_url}`);
                      const updateWebhookResponse = await fetch(`${webhooksUrl}/${existingWebhook.id}`, {
                        method: 'PATCH',
                        headers: {
                          'Content-Type': 'application/json',
                          'api_access_token': bodyData.access_token,
                        },
                        body: JSON.stringify({
                          url: responseJson.webhook_url, // Chatwoot espera 'url' no endpoint de webhooks
                          // subscriptions pode ser necessário, mas vamos tentar sem primeiro
                        }),
                      });
                      
                      if (updateWebhookResponse.ok) {
                        const updatedWebhook = await updateWebhookResponse.json();
                        // Verifica se a URL foi realmente atualizada
                        if (updatedWebhook.url === responseJson.webhook_url) {
                          responseJson.webhook_updated_in_chatwoot = true;
                          responseJson.chatwoot_webhook_response = updatedWebhook;
                          console.log(`[INFO] Webhook updated successfully in Chatwoot via PATCH /webhooks/{id}`);
                        } else {
                          responseJson.webhook_updated_in_chatwoot = false;
                          responseJson.webhook_update_error = {
                            error: 'Webhook URL not updated',
                            details: `Expected: ${responseJson.webhook_url}, Got: ${updatedWebhook.url}`
                          };
                          console.log(`[WARN] PATCH returned OK but URL was not updated. Expected: ${responseJson.webhook_url}, Got: ${updatedWebhook.url}`);
                        }
                      } else {
                        const errorText = await updateWebhookResponse.text();
                        let errorDetails;
                        try {
                          errorDetails = JSON.parse(errorText);
                        } catch {
                          errorDetails = errorText.substring(0, 200);
                        }
                        responseJson.webhook_updated_in_chatwoot = false;
                        responseJson.webhook_update_error = {
                          error: `HTTP ${updateWebhookResponse.status}`,
                          details: errorDetails
                        };
                        console.log(`[WARN] Failed to update webhook in Chatwoot: ${updateWebhookResponse.status}`);
                        console.log(`[WARN] Error details: ${JSON.stringify(errorDetails)}`);
                      }
                    } else {
                      // Verifica se já existe webhook com a mesma URL (pode estar em outra inbox ou sem filtro)
                      // Isso evita criar webhooks duplicados
                      const targetPathForDuplicate = responseJson.webhook_url.split('/').pop();
                      const duplicateWebhook = Array.isArray(existingWebhooks) 
                        ? existingWebhooks.find(wh => {
                            const whUrl = wh.url || wh.webhook_url || '';
                            return whUrl === responseJson.webhook_url || whUrl.includes(targetPathForDuplicate);
                          })
                        : null;
                      
                      if (duplicateWebhook) {
                        console.log(`[WARN] ⚠️ Webhook duplicado detectado! Já existe webhook com URL similar (ID: ${duplicateWebhook.id})`);
                        console.log(`[WARN] URL existente: ${duplicateWebhook.url || duplicateWebhook.webhook_url}`);
                        console.log(`[WARN] URL nova: ${responseJson.webhook_url}`);
                        console.log(`[WARN] Isso pode causar mensagens duplicadas! Atualizando webhook existente em vez de criar novo.`);
                        
                        // Atualiza o webhook existente em vez de criar novo
                        try {
                          const updateDuplicateResponse = await fetch(`${webhooksUrl}/${duplicateWebhook.id}`, {
                            method: 'PATCH',
                            headers: {
                              'Content-Type': 'application/json',
                              'api_access_token': bodyData.access_token,
                            },
                            body: JSON.stringify({
                              url: responseJson.webhook_url,
                            }),
                          });
                          
                          if (updateDuplicateResponse.ok) {
                            const updatedDuplicate = await updateDuplicateResponse.json();
                            responseJson.webhook_updated_in_chatwoot = true;
                            responseJson.chatwoot_webhook_response = updatedDuplicate;
                            responseJson.webhook_duplicate_prevented = true;
                            console.log(`[INFO] ✅ Webhook duplicado atualizado com sucesso (ID: ${duplicateWebhook.id})`);
                          } else {
                            console.log(`[WARN] Falha ao atualizar webhook duplicado: ${updateDuplicateResponse.status}`);
                          }
                        } catch (updateError) {
                          console.error(`[ERROR] Erro ao atualizar webhook duplicado: ${updateError.message}`);
                        }
                      } else {
                        // Cria novo webhook apenas se não houver duplicado
                        // Cria novo webhook conforme documentação do Chatwoot
                        console.log(`[INFO] No existing webhook found, creating new webhook with URL: ${responseJson.webhook_url}`);
                        const createWebhookPayload = {
                          url: responseJson.webhook_url,
                          // subscriptions: eventos padrão para integração WhatsApp conforme documentação
                          subscriptions: [
                            'message_created',
                            'conversation_updated',
                            'conversation_status_changed',
                            'contact_created',
                            'contact_updated'
                          ]
                        };
                        
                        console.log(`[INFO] Creating webhook with payload: ${JSON.stringify(createWebhookPayload)}`);
                        const createWebhookResponse = await fetch(webhooksUrl, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'api_access_token': bodyData.access_token,
                          },
                          body: JSON.stringify(createWebhookPayload),
                        });
                        
                        console.log(`[INFO] Create webhook response status: ${createWebhookResponse.status}`);
                        
                        if (createWebhookResponse.ok) {
                          const createdWebhook = await createWebhookResponse.json();
                          responseJson.webhook_updated_in_chatwoot = true;
                          responseJson.chatwoot_webhook_response = createdWebhook;
                          console.log(`[INFO] Webhook created successfully in Chatwoot (ID: ${createdWebhook.id})`);
                          console.log(`[INFO] Created webhook URL: ${createdWebhook.url}`);
                        } else {
                          const errorText = await createWebhookResponse.text();
                          let errorDetails;
                          try {
                            errorDetails = JSON.parse(errorText);
                          } catch {
                            errorDetails = errorText.substring(0, 500);
                          }
                          
                          console.log(`[WARN] Failed to create webhook in Chatwoot: ${createWebhookResponse.status}`);
                          console.log(`[WARN] Error details: ${JSON.stringify(errorDetails)}`);
                          
                          // Se o erro for "Url has already been taken", tenta buscar e atualizar o webhook existente
                          if (createWebhookResponse.status === 422 && 
                              errorDetails.message && 
                              (errorDetails.message.includes('already been taken') || errorDetails.message.includes('already exists'))) {
                            console.log(`[INFO] Webhook URL already exists, attempting to find and update it`);
                            
                            // Busca novamente os webhooks para encontrar o que tem essa URL
                            // Tenta primeiro com filtro por inbox_id, depois sem filtro
                            const retryWebhooksUrlWithFilter = `${webhooksUrl}?inbox_id=${bodyData.inbox_id}`;
                            let retryListResponse = await fetch(retryWebhooksUrlWithFilter, {
                              method: 'GET',
                              headers: {
                                'api_access_token': bodyData.access_token,
                              },
                            });
                            
                            // Se não encontrar com filtro, busca todos
                            if (retryListResponse.ok) {
                              const filteredWebhooks = await retryListResponse.json();
                              if (!Array.isArray(filteredWebhooks) || filteredWebhooks.length === 0) {
                                console.log(`[INFO] No webhooks found with inbox_id filter, trying all webhooks`);
                                retryListResponse = await fetch(webhooksUrl, {
                                  method: 'GET',
                                  headers: {
                                    'api_access_token': bodyData.access_token,
                                  },
                                });
                              }
                            } else {
                              retryListResponse = await fetch(webhooksUrl, {
                                method: 'GET',
                                headers: {
                                  'api_access_token': bodyData.access_token,
                                },
                              });
                            }
                            
                            if (retryListResponse.ok) {
                              const allWebhooks = await retryListResponse.json();
                              console.log(`[INFO] Found ${Array.isArray(allWebhooks) ? allWebhooks.length : 0} webhooks in Chatwoot`);
                              
                              if (DEBUG_MODE && Array.isArray(allWebhooks) && allWebhooks.length > 0) {
                                console.log(`[DEBUG] Webhooks list: ${JSON.stringify(allWebhooks.map(wh => ({ id: wh.id, url: wh.url || wh.webhook_url, inbox_id: wh.inbox_id })), null, 2)}`);
                              }
                              
                              if (DEBUG_MODE && Array.isArray(allWebhooks)) {
                                console.log(`[DEBUG] Webhooks list: ${JSON.stringify(allWebhooks.map(wh => ({ id: wh.id, url: wh.url || wh.webhook_url, inbox_id: wh.inbox_id })), null, 2)}`);
                              }
                              
                              // Busca mais flexível - verifica URL exata, URL parcial, ou inbox_id
                              const matchingWebhook = Array.isArray(allWebhooks) 
                                ? allWebhooks.find((wh) => {
                                    const whUrl = wh.url || wh.webhook_url || '';
                                    const targetUrl = responseJson.webhook_url;
                                    
                                    // Verifica URL exata
                                    if (whUrl === targetUrl) {
                                      console.log(`[INFO] Found webhook by exact URL match`);
                                      return true;
                                    }
                                    
                                    // Verifica se ambas as URLs contêm o mesmo path final (última parte após a última barra)
                                    const whPath = whUrl.split('/').pop();
                                    const targetPath = targetUrl.split('/').pop();
                                    if (whPath && targetPath && whPath === targetPath) {
                                      console.log(`[INFO] Found webhook by path match: ${whPath}`);
                                      return true;
                                    }
                                    
                                    // Verifica inbox_id como fallback
                                    if (wh.inbox_id && wh.inbox_id.toString() === bodyData.inbox_id.toString()) {
                                      console.log(`[INFO] Found webhook by inbox_id match: ${wh.inbox_id}`);
                                      return true;
                                    }
                                    
                                    return false;
                                  })
                                : null;
                              
                              if (matchingWebhook) {
                                console.log(`[INFO] Found existing webhook with matching URL (ID: ${matchingWebhook.id}), updating it`);
                                const updateExistingResponse = await fetch(`${webhooksUrl}/${matchingWebhook.id}`, {
                                  method: 'PATCH',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    'api_access_token': bodyData.access_token,
                                  },
                                  body: JSON.stringify({
                                    url: responseJson.webhook_url,
                                    inbox_id: parseInt(bodyData.inbox_id)
                                  }),
                                });
                                
                                if (updateExistingResponse.ok) {
                                  responseJson.webhook_updated_in_chatwoot = true;
                                  console.log(`[INFO] Successfully updated existing webhook in Chatwoot`);
                                } else {
                                  const updateErrorText = await updateExistingResponse.text();
                                  let updateErrorDetails;
                                  try {
                                    updateErrorDetails = JSON.parse(updateErrorText);
                                  } catch {
                                    updateErrorDetails = updateErrorText.substring(0, 200);
                                  }
                                  responseJson.webhook_updated_in_chatwoot = false;
                                  responseJson.webhook_update_error = {
                                    error: `HTTP ${updateExistingResponse.status}`,
                                    details: updateErrorDetails
                                  };
                                  console.log(`[WARN] Failed to update existing webhook: ${updateExistingResponse.status}`);
                                }
                              } else {
                                responseJson.webhook_updated_in_chatwoot = false;
                                responseJson.webhook_update_error = {
                                  error: `HTTP ${createWebhookResponse.status}`,
                                  details: errorDetails,
                                  note: 'Webhook URL already exists but could not find it to update'
                                };
                                // Se não encontrou o webhook na lista mas o erro diz que já existe,
                                // isso confirma que o webhook está configurado diretamente na inbox
                                // O Chatwoot não permite atualizar webhook_url via API quando está configurado na inbox
                                responseJson.webhook_updated_in_chatwoot = false;
                                responseJson.webhook_update_error = {
                                  error: `HTTP ${createWebhookResponse.status}`,
                                  details: errorDetails,
                                  note: 'Webhook URL already exists in Chatwoot. The webhook is configured directly in the inbox settings (not as a separate webhook). Chatwoot API does not allow updating inbox webhook_url via API for security reasons.',
                                  suggestion: 'To update the webhook URL, please go to Chatwoot UI → Settings → Inboxes → Select your inbox → Settings → Webhook URL and update it manually. The new URL is provided in the webhook_url field above.',
                                  chatwoot_limitation: 'This is a known Chatwoot API limitation. Inbox webhook URLs can only be updated via the Chatwoot UI, not via API.'
                                };
                                console.log(`[WARN] Webhook URL exists but could not find it in the webhooks list. Confirmed: webhook is configured directly in inbox settings.`);
                                console.log(`[INFO] Chatwoot API limitation: inbox webhook_url cannot be updated via API. Manual update required in Chatwoot UI.`);
                              }
                            } else {
                              responseJson.webhook_updated_in_chatwoot = false;
                              responseJson.webhook_update_error = {
                                error: `HTTP ${createWebhookResponse.status}`,
                                details: errorDetails
                              };
                            }
                          } else {
                            responseJson.webhook_updated_in_chatwoot = false;
                            responseJson.webhook_update_error = {
                              error: `HTTP ${createWebhookResponse.status}`,
                              details: errorDetails,
                              payload_sent: {
                                url: responseJson.webhook_url,
                                inbox_id: parseInt(bodyData.inbox_id)
                              }
                            };
                            console.log(`[WARN] Failed to create webhook in Chatwoot: ${createWebhookResponse.status}`);
                            console.log(`[WARN] Error details: ${JSON.stringify(errorDetails)}`);
                          }
                        }
                      }
                    }
                  } else {
                    const errorText = await listWebhooksResponse.text();
                    responseJson.webhook_updated_in_chatwoot = false;
                    responseJson.webhook_update_error = {
                      error: `HTTP ${listWebhooksResponse.status}`,
                      details: errorText.substring(0, 200)
                    };
                    console.log(`[WARN] Failed to list webhooks in Chatwoot: ${listWebhooksResponse.status}`);
                  }
                } catch (webhookError) {
                  responseJson.webhook_updated_in_chatwoot = false;
                  responseJson.webhook_update_error = {
                    error: 'Erro ao tentar atualizar webhook via endpoint de webhooks',
                    message: webhookError.message
                  };
                  console.error(`[ERROR] Webhook endpoint error: ${webhookError.message}`);
                }
              }
              
              // Aplica substituição recursiva final em todo o responseJson (incluindo chatwoot_response se existir)
              // Isso garante que qualquer URL com sender.uazapi.com seja substituída
              responseJson = replaceWebhookUrls(responseJson);
              console.log(`[INFO] Applied final recursive URL replacement after Chatwoot update attempt`);
              
              // UPDATE ADICIONAL: Faz update do channel sempre que possível (mesmo se webhook_updated_in_chatwoot for false)
              // Isso garante que o webhook_url seja atualizado no channel mesmo quando o webhook já existe
              if (response.ok && 
                  responseJson.webhook_url && 
                  bodyData && 
                  bodyData.url && 
                  bodyData.access_token && 
                  bodyData.account_id && 
                  bodyData.inbox_id) {
                try {
                  console.log(`[INFO] Webhook atualizado com sucesso, fazendo update adicional do channel...`);
                  const chatwootBaseUrl = bodyData.url.endsWith('/') ? bodyData.url.slice(0, -1) : bodyData.url;
                  const channelUpdateUrl = `${chatwootBaseUrl}/api/v1/accounts/${bodyData.account_id}/inboxes/${bodyData.inbox_id}`;
                  
                  const channelUpdateResponse = await fetch(channelUpdateUrl, {
                    method: 'PATCH',
                    headers: {
                      'Content-Type': 'application/json',
                      'api_access_token': bodyData.access_token,
                    },
                    body: JSON.stringify({
                      channel: {
                        webhook_url: responseJson.webhook_url
                      }
                    }),
                  });
                  
                  if (channelUpdateResponse.ok) {
                    const channelUpdateData = await channelUpdateResponse.json();
                    responseJson.channel_update_response = channelUpdateData;
                    console.log(`[INFO] ✅ Channel atualizado com sucesso via PATCH /inboxes/{id}`);
                    
                    // Verifica se o webhook_url foi realmente atualizado no channel
                    if (channelUpdateData.channel && channelUpdateData.channel.webhook_url === responseJson.webhook_url) {
                      responseJson.channel_webhook_updated = true;
                      console.log(`[INFO] ✅ Channel webhook_url confirmado: ${channelUpdateData.channel.webhook_url}`);
                    } else if (channelUpdateData.webhook_url === responseJson.webhook_url) {
                      // Pode estar no nível raiz também
                      responseJson.channel_webhook_updated = true;
                      console.log(`[INFO] ✅ Channel webhook_url confirmado (nível raiz): ${channelUpdateData.webhook_url}`);
                    } else {
                      console.log(`[WARN] Channel PATCH retornou OK mas webhook_url não foi atualizado. Response: ${JSON.stringify(channelUpdateData).substring(0, 200)}`);
                    }
                  } else {
                    const errorText = await channelUpdateResponse.text();
                    let errorDetails;
                    try {
                      errorDetails = JSON.parse(errorText);
                    } catch {
                      errorDetails = errorText.substring(0, 200);
                    }
                    responseJson.channel_update_error = {
                      error: `HTTP ${channelUpdateResponse.status}`,
                      details: errorDetails
                    };
                    console.log(`[WARN] Falha ao atualizar channel: ${channelUpdateResponse.status} - ${JSON.stringify(errorDetails)}`);
                  }
                } catch (channelUpdateError) {
                  responseJson.channel_update_error = {
                    error: 'Erro ao tentar atualizar channel',
                    message: channelUpdateError.message
                  };
                  console.error(`[ERROR] Erro ao atualizar channel: ${channelUpdateError.message}`);
                }
              }
              
              // Atualiza responseData com o resultado da atualização do Chatwoot
              responseData = JSON.stringify(responseJson);
            } catch (chatwootError) {
              responseJson.webhook_updated_in_chatwoot = false;
              responseJson.webhook_update_error = {
                error: 'Erro ao tentar atualizar webhook no Chatwoot',
                message: chatwootError.message
              };
              console.error(`[ERROR] Failed to update webhook in Chatwoot: ${chatwootError.message}`);
              // Atualiza responseData mesmo em caso de erro
              responseData = JSON.stringify(responseJson);
            }
          } else {
            console.log(`[INFO] Skipping automatic Chatwoot webhook update - missing required data`);
          }
        } catch (error) {
          console.error(`[ERROR] Failed to process webhook URL replacement: ${error.message}`);
          console.error(`[ERROR] Stack: ${error.stack}`);
          // Mesmo em caso de erro, tenta atualizar responseData se webhook foi adicionado
          if (webhookWasAdded) {
            try {
              responseData = JSON.stringify(responseJson);
              console.log(`[INFO] Updated responseData after error (webhook was added)`);
            } catch (e) {
              console.error(`[ERROR] Failed to stringify responseJson: ${e.message}`);
            }
          }
        }
      }
      
      if (!response.ok) {
        baseLogPayload.error_message =
          responseJson?.error || responseJson?.message || baseLogPayload.error_message;
      }
    } catch (e) {
      if (DEBUG_MODE) {
        console.warn(`[WARN] API returned non-JSON response: ${responseData.substring(0, 100)}`);
      }
      const logPromise = logApiRequest({
        supabaseUrl: SUPABASE_URL,
        serviceKey: SUPABASE_SERVICE_KEY,
        payload: baseLogPayload,
        debugMode: DEBUG_MODE,
      });
      if (ctx && typeof ctx.waitUntil === 'function') {
        ctx.waitUntil(logPromise);
      } else {
        await logPromise;
      }
      return new Response(responseData, {
        status: response.status,
        headers: {
          ...corsHeaders,
          'Content-Type': response.headers.get('Content-Type') || 'text/plain',
        },
      });
    }

    const logPromise = logApiRequest({
      supabaseUrl: SUPABASE_URL,
      serviceKey: SUPABASE_SERVICE_KEY,
      payload: baseLogPayload,
      debugMode: DEBUG_MODE,
    });
    if (ctx && typeof ctx.waitUntil === 'function') {
      ctx.waitUntil(logPromise);
    } else {
      await logPromise;
    }
    
    // Adicionar headers de rate limit na resposta
    const responseHeaders = {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': rateLimit.limit.toString(),
      'X-RateLimit-Remaining': rateLimit.remaining.toString(),
      'X-RateLimit-Reset': rateLimit.reset.toString(),
    };
    
    // IMPORTANTE: Se responseData foi modificado (para integrações), usa ele
    // Caso contrário, usa o responseJson stringificado
    // responseData já foi modificado pela lógica de substituição se necessário
    const finalResponseBody = responseData || JSON.stringify(responseJson);
    
    if (isIntegrationEndpoint) {
      console.log(`[INFO] Returning response for integration endpoint. Response length: ${finalResponseBody.length}`);
      // Log uma amostra da resposta para verificar se a substituição funcionou
      if (finalResponseBody.includes('webhook')) {
        const webhookMatch = finalResponseBody.match(/https?:\/\/[^\s"']+webhook[^\s"']*/);
        if (webhookMatch) {
          console.log(`[INFO] Found webhook URL in response: ${webhookMatch[0].substring(0, 120)}`);
        }
      }
      // Verifica se ainda tem sender.uazapi.com (não deveria ter se a substituição funcionou)
      if (finalResponseBody.includes('sender.uazapi.com')) {
        console.log(`[WARN] Response still contains sender.uazapi.com - replacement may have failed`);
      } else {
        console.log(`[INFO] Response verified: no sender.uazapi.com found (replacement successful)`);
      }
    }
    
    return new Response(finalResponseBody, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    // Logs de erro críticos sempre são exibidos
    if (DEBUG_MODE) {
      console.error('[ERROR] Request processing failed:', error);
    } else {
      console.error('[ERROR] Request processing failed:', error.message);
    }
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        ...(DEBUG_MODE && { message: error.message }),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}

// ============================================
// EXPORT DEFAULT (Recomendado - suporta env vars)
// ============================================
// Use esta versão para suportar variáveis de ambiente do Cloudflare
export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env, ctx);
  }
};

// ============================================
// ALTERNATIVA: Event Listener (sem env vars)
// ============================================
// Descomente se preferir usar addEventListener (mas não terá acesso a env vars)
/*
addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request, {}));
});
*/

