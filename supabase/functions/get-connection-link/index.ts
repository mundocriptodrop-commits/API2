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
    // Extrai token da URL
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const linkToken = pathParts[pathParts.length - 1];

    if (!linkToken) {
      return new Response(
        JSON.stringify({ error: 'Invalid link token' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cria cliente Supabase (sem autenticação - acesso público)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Busca o link no banco
    const { data: link, error: linkError } = await supabaseClient
      .from('provisional_connection_links')
      .select(`
        *,
        whatsapp_instances (
          instance_token,
          status,
          name
        )
      `)
      .eq('token', linkToken)
      .single();

    if (linkError || !link) {
      return new Response(
        JSON.stringify({ error: 'Link not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const instance = link.whatsapp_instances;

    // Verifica se o link está válido
    if (link.used_at) {
      return new Response(
        JSON.stringify({ error: 'Link already used', used_at: link.used_at }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (new Date(link.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Link expired', expires_at: link.expires_at }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Se a instância já está conectada, marca o link como usado
    if (instance && instance.status === 'connected') {
      await supabaseClient
        .from('provisional_connection_links')
        .update({ used_at: new Date().toISOString() })
        .eq('id', link.id);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Instance already connected',
          connected: true,
          instance_name: instance.name,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Busca QR code da instância via UAZAPI
    if (!instance || !instance.instance_token) {
      return new Response(
        JSON.stringify({ error: 'Instance token not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Conecta a instância se ainda não estiver conectando
    if (instance.status === 'disconnected') {
      try {
        await fetch('https://sender.uazapi.com/instance/connect', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'token': instance.instance_token,
          },
          body: JSON.stringify({}),
        });
      } catch (e) {
        console.warn('Failed to trigger connection:', e);
      }
    }

    // Busca status da instância para obter QR code
    const statusResponse = await fetch('https://sender.uazapi.com/instance/status', {
      headers: { 'token': instance.instance_token },
    });

    if (!statusResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to get instance status' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const statusData = await statusResponse.json();
    const qrCode = statusData.instance?.qrcode || statusData.qrCode || null;
    const pairingCode = statusData.instance?.paircode || statusData.pairingCode || null;

    // Retorna dados do QR code
    return new Response(
      JSON.stringify({
        success: true,
        qr_code: qrCode,
        pairing_code: pairingCode,
        instance_name: instance.name,
        connected: false,
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
