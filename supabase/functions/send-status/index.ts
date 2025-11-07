import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, token, X-Client-Info",
};

interface SendStatusRequest {
  type: "text" | "image" | "video" | "audio";
  text?: string;
  background_color?: number;
  font?: number;
  file?: string;
  thumbnail?: string;
  mimetype?: string;
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

    const body: SendStatusRequest = await req.json();

    // Validação de campos obrigatórios
    if (!body.type) {
      return new Response(
        JSON.stringify({ error: "Campo 'type' é obrigatório (text, image, video, audio)" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Validação de tipos suportados
    const supportedTypes = ["text", "image", "video", "audio"];
    if (!supportedTypes.includes(body.type)) {
      return new Response(
        JSON.stringify({ 
          error: `Tipo '${body.type}' não suportado. Tipos suportados: ${supportedTypes.join(", ")}` 
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

    // Validação específica para tipo text
    if (body.type === "text" && !body.text) {
      return new Response(
        JSON.stringify({ error: "Campo 'text' é obrigatório para type='text'" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Validação para tipos que requerem arquivo
    if (body.type !== "text" && !body.file) {
      return new Response(
        JSON.stringify({ error: `Campo 'file' é obrigatório para type='${body.type}'` }),
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
    const response = await fetch("https://sender.uazapi.com/send/status", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "token": token,
      },
      body: JSON.stringify({
        type: body.type,
        ...(body.text && { text: body.text }),
        ...(body.background_color !== undefined && { background_color: body.background_color }),
        ...(body.font !== undefined && { font: body.font }),
        ...(body.file && { file: body.file }),
        ...(body.thumbnail && { thumbnail: body.thumbnail }),
        ...(body.mimetype && { mimetype: body.mimetype }),
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
        error: error.message || "Erro ao processar requisição de status",
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

