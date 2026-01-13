import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Cria cliente Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Verifica autenticação
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Lê body da requisição
    const { instance_id, expires_hours } = await req.json();

    if (!instance_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: instance_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Valida se a instância pertence ao usuário
    const { data: instance, error: instanceError } = await supabaseClient
      .from('whatsapp_instances')
      .select('id, user_id')
      .eq('id', instance_id)
      .single();

    if (instanceError || !instance) {
      return new Response(
        JSON.stringify({ error: 'Instance not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (instance.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Instance does not belong to user' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Gera token único para o link
    const linkToken = crypto.randomUUID();

    // Define expiração (padrão: 24 horas)
    const expiresHours = expires_hours || 24;
    const expiresAt = new Date(Date.now() + expiresHours * 60 * 60 * 1000).toISOString();

    // Cria o link no banco
    const { data: linkData, error: linkError } = await supabaseClient
      .from('provisional_connection_links')
      .insert({
        instance_id: instance_id,
        token: linkToken,
        expires_at: expiresAt,
        created_by: user.id,
      })
      .select()
      .single();

    if (linkError) {
      console.error('Error creating provisional link:', linkError);
      return new Response(
        JSON.stringify({ error: 'Failed to create provisional link', details: linkError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Gera URL do link
    // Opção 1: Se FRONTEND_URL estiver configurado, usa página HTML estática
    // Opção 2: Caso contrário, usa Edge Function diretamente
    const frontendUrl = Deno.env.get('FRONTEND_URL');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const projectRef = supabaseUrl.split('//')[1]?.split('.')[0] || 'ctshqbxxlauulzsbapjb';
    
    let linkUrl;
    if (frontendUrl) {
      // Usa página HTML estática (evita problemas de CSP)
      linkUrl = `${frontendUrl}/connect.html?token=${linkToken}`;
    } else {
      // Usa Edge Function diretamente (pode ter problemas de CSP)
      linkUrl = `https://${projectRef}.supabase.co/functions/v1/connect/${linkToken}?apikey=${encodeURIComponent(supabaseAnonKey)}`;
    }

    return new Response(
      JSON.stringify({
        success: true,
        link: linkUrl,
        token: linkToken,
        expires_at: expiresAt,
        id: linkData.id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
