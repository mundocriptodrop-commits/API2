import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, token, X-Idempotency-Key",
};

interface SendTextRequest {
  number: string;
  text: string;
  message_id?: string;
}

// Cache simples em memória para verificar duplicação (expira após 5 minutos)
// Em produção, considere usar Redis ou Supabase para cache distribuído
const messageCache = new Map<string, { timestamp: number; response: unknown }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

function generateCacheKey(token: string, number: string, text: string, messageId?: string): string {
  // Usa message_id se disponível, senão usa hash do conteúdo
  if (messageId) {
    return `msg:${token}:${messageId}`;
  }
  // Fallback: hash simples baseado em token + number + text
  return `msg:${token}:${number}:${text.substring(0, 50)}`;
}

function cleanupCache() {
  const now = Date.now();
  for (const [key, value] of messageCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      messageCache.delete(key);
    }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const token = req.headers.get("token");
    const idempotencyKey = req.headers.get("X-Idempotency-Key");
    
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token é obrigatório no header" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const body: SendTextRequest = await req.json();

    if (!body.number || !body.text) {
      return new Response(
        JSON.stringify({ error: "Campos 'number' e 'text' são obrigatórios" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Limpa cache antigo periodicamente
    cleanupCache();

    // Verifica duplicação usando message_id ou idempotency key
    const cacheKey = generateCacheKey(token, body.number, body.text, body.message_id || idempotencyKey || undefined);
    const cached = messageCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      // Mensagem duplicada detectada - retorna resposta em cache
      console.log(`[DUPLICATE] Mensagem duplicada detectada: ${cacheKey.substring(0, 50)}...`);
      return new Response(
        JSON.stringify({
          ...(cached.response as Record<string, unknown>),
          duplicate: true,
          cached: true,
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "X-Duplicate-Detected": "true",
          },
        }
      );
    }

    // Remove message_id do body antes de enviar para UAZAPI (se não suportar)
    const { message_id, ...bodyToSend } = body;

    const response = await fetch("https://sender.uazapi.com/send/text", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "token": token,
      },
      body: JSON.stringify({
        number: bodyToSend.number,
        text: bodyToSend.text,
      }),
    });

    const responseData = await response.json();

    // Armazena resposta no cache para prevenir duplicação
    if (response.ok) {
      messageCache.set(cacheKey, {
        timestamp: Date.now(),
        response: responseData,
      });
    }

    return new Response(
      JSON.stringify(responseData),
      {
        status: response.status,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || "Erro ao processar requisição" }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});