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

  // Extrai token do header
  const token = request.headers.get('token');

  if (!token) {
    return new Response(
      JSON.stringify({ error: 'Token is required in header' }),
      {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Rate Limiting - Verificar antes de processar (após validar que token existe)
  // Isso protege contra abuso mesmo com tokens inválidos
  const rateLimit = await checkRateLimit(request, token, RATE_LIMIT_REQUESTS_PER_MINUTE, DEBUG_MODE);
  
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
  console.log(`[INFO] Starting token validation for token: ${token.substring(0, 20)}...`);
  const validationStartTime = Date.now();
  
  let validation;
  try {
    validation = await validateToken(token, SUPABASE_URL, SUPABASE_ANON_KEY, DEBUG_MODE, TOKEN_CACHE);
    const validationDuration = Date.now() - validationStartTime;
    console.log(`[INFO] Token validation completed in ${validationDuration}ms - Valid: ${validation.valid}`);
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

  if (!validation.valid) {
    // Log detalhado do erro de validação
    if (validation.error === 'Instance not connected') {
      console.warn(`[WARN] Request rejected - Instance not connected: ID=${validation.instanceId}, Status=${validation.status}, Token=${token.substring(0, 20)}...`);
    } else if (validation.error === 'Token not found') {
      console.warn(`[WARN] Request rejected - Invalid token: Token=${token.substring(0, 20)}...`);
    } else if (validation.error === 'Validation timeout') {
      console.warn(`[WARN] Request rejected - Token validation timeout: Token=${token.substring(0, 20)}...`);
    } else {
      console.warn(`[WARN] Request rejected - Token validation failed: Error=${validation.error}, Token=${token.substring(0, 20)}...`);
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
  
  console.log(`[INFO] Token validated successfully - Instance ID: ${validation.instance.id}, Status: ${validation.instance.status}`);

  // Token válido! Processa a requisição
  try {
    const url = new URL(request.url);
    
    // Extrai o path e normaliza para ambos os endpoints
    let path = url.pathname;
    
    // Log do path original
    if (DEBUG_MODE) {
      console.log(`[DEBUG] Original request path: ${path}`);
    }
    
    // Remove /whatsapp/ se existir (formato do Cloudflare Worker: /whatsapp/send-text)
    if (path.startsWith('/whatsapp/')) {
      path = path.replace('/whatsapp/', '/');
    }
    
    // Remove /functions/v1/ se já estiver presente (caso chamada direta)
    if (path.startsWith('/functions/v1/')) {
      path = path.replace('/functions/v1/', '/');
    }
    
    // Remove trailing slash
    if (path.endsWith('/') && path.length > 1) {
      path = path.slice(0, -1);
    }
    
    // Se não começar com /, adiciona
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    
    // Log do path processado
    console.log(`[INFO] Processing endpoint - Original: ${url.pathname}, Processed: ${path}`);
    
    // Verifica se é um endpoint suportado
    const supportedEndpoints = [
      // Envio de mensagens
      '/send-text', '/send-media', '/send-menu', '/send-carousel', '/send-pix-button', '/send-status',
      // Perfil
      '/profile/name', '/profile/image',
      // Instância
      '/instance/connect', '/instance/disconnect', '/instance/status', '/instance/updateInstanceName', 
      '/instance', '/instance/privacy', '/instance/presence',
      // Integrações
      '/chatwoot/config'
    ];
    if (!supportedEndpoints.includes(path)) {
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
    const isInstanceOrProfileEndpoint = path.startsWith('/instance/') || path.startsWith('/profile/');
    const isIntegrationEndpoint = path.startsWith('/chatwoot/');
    const EXTERNAL_API_URL = 'https://sender.uazapi.com';
    
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
      fetchHeaders['X-Instance-ID'] = validation.instance.id;
      fetchHeaders['X-User-ID'] = validation.instance.user_id;
      
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
    
    // Lê a resposta (só pode ler uma vez!)
    const responseData = await response.text();
    
    const baseLogPayload = {
      endpoint: path,
      method: request.method,
      status_code: response.status,
      latency_ms: latencyMs,
      success: response.ok,
      user_id: validation.instance.user_id,
      instance_id: validation.instance.id,
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
        // Substitui webhook_url ou webhookUrl se existir
        if (responseJson.webhook_url && typeof responseJson.webhook_url === 'string') {
          // Substitui o domínio e ajusta o path se necessário
          responseJson.webhook_url = responseJson.webhook_url
            .replace('https://sender.uazapi.com/chatwoot/', 'https://api.evasend.com.br/whatsapp/chatwoot/')
            .replace('https://sender.uazapi.com', 'https://api.evasend.com.br/whatsapp');
        } else if (responseJson.webhookUrl && typeof responseJson.webhookUrl === 'string') {
          responseJson.webhookUrl = responseJson.webhookUrl
            .replace('https://sender.uazapi.com/chatwoot/', 'https://api.evasend.com.br/whatsapp/chatwoot/')
            .replace('https://sender.uazapi.com', 'https://api.evasend.com.br/whatsapp');
        }
        // Atualiza responseData com a URL substituída
        responseData = JSON.stringify(responseJson);
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
    
    return new Response(JSON.stringify(responseJson), {
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

