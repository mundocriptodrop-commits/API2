import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, token, X-Client-Info",
};

interface SendPixButtonRequest {
  number: string;
  pixType: "CPF" | "CNPJ" | "PHONE" | "EMAIL" | "EVP";
  pixKey: string;
  pixName?: string;
  async?: boolean;
  delay?: number;
  readchat?: boolean;
  readmessages?: boolean;
  replyid?: string;
  mentions?: string;
  track_source?: string;
  track_id?: string;
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const token = req.headers.get("token");
    
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

    const body: SendPixButtonRequest = await req.json();

    // Validação de campos obrigatórios
    if (!body.number) {
      return new Response(
        JSON.stringify({ error: "Campo 'number' é obrigatório" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (!body.pixType) {
      return new Response(
        JSON.stringify({ error: "Campo 'pixType' é obrigatório (CPF, CNPJ, PHONE, EMAIL, EVP)" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Validação de tipos PIX suportados
    const supportedPixTypes = ["CPF", "CNPJ", "PHONE", "EMAIL", "EVP"];
    if (!supportedPixTypes.includes(body.pixType.toUpperCase())) {
      return new Response(
        JSON.stringify({ 
          error: `Tipo PIX '${body.pixType}' não suportado. Tipos suportados: ${supportedPixTypes.join(", ")}` 
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (!body.pixKey) {
      return new Response(
        JSON.stringify({ error: "Campo 'pixKey' é obrigatório" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Faz proxy para a API externa
    const response = await fetch("https://sender.uazapi.com/send/pix-button", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "token": token,
      },
      body: JSON.stringify({
        number: body.number,
        pixType: body.pixType.toUpperCase(),
        pixKey: body.pixKey,
        ...(body.pixName && { pixName: body.pixName }),
        ...(body.async !== undefined && { async: body.async }),
        ...(body.delay !== undefined && { delay: body.delay }),
        ...(body.readchat !== undefined && { readchat: body.readchat }),
        ...(body.readmessages !== undefined && { readmessages: body.readmessages }),
        ...(body.replyid && { replyid: body.replyid }),
        ...(body.mentions && { mentions: body.mentions }),
        ...(body.track_source && { track_source: body.track_source }),
        ...(body.track_id && { track_id: body.track_id }),
      }),
    });

    const responseData = await response.json();

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
      JSON.stringify({ 
        error: error.message || "Erro ao processar requisição de botão PIX",
        details: error instanceof Error ? error.message : String(error)
      }),
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

