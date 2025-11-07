import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, token, X-Client-Info",
};

interface SendMenuRequest {
  number: string;
  type: "button" | "list" | "poll" | "carousel";
  text: string;
  choices: string[];
  footerText?: string;
  listButton?: string;
  selectableCount?: number;
  imageButton?: string;
  replyid?: string;
  mentions?: string;
  readchat?: boolean;
  readmessages?: boolean;
  delay?: number;
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

    const body: SendMenuRequest = await req.json();

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

    if (!body.type) {
      return new Response(
        JSON.stringify({ error: "Campo 'type' é obrigatório (button, list, poll, carousel)" }),
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
    const supportedTypes = ["button", "list", "poll", "carousel"];
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

    if (!body.text) {
      return new Response(
        JSON.stringify({ error: "Campo 'text' é obrigatório" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (!body.choices || !Array.isArray(body.choices) || body.choices.length === 0) {
      return new Response(
        JSON.stringify({ error: "Campo 'choices' é obrigatório e deve ser um array não vazio" }),
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
    const response = await fetch("https://sender.uazapi.com/send/menu", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "token": token,
      },
      body: JSON.stringify({
        number: body.number,
        type: body.type,
        text: body.text,
        choices: body.choices,
        ...(body.footerText && { footerText: body.footerText }),
        ...(body.listButton && { listButton: body.listButton }),
        ...(body.selectableCount !== undefined && { selectableCount: body.selectableCount }),
        ...(body.imageButton && { imageButton: body.imageButton }),
        ...(body.replyid && { replyid: body.replyid }),
        ...(body.mentions && { mentions: body.mentions }),
        ...(body.readchat !== undefined && { readchat: body.readchat }),
        ...(body.readmessages !== undefined && { readmessages: body.readmessages }),
        ...(body.delay !== undefined && { delay: body.delay }),
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
        error: error.message || "Erro ao processar requisição de menu",
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

