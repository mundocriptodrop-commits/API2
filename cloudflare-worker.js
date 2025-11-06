// Cloudflare Worker para api.evasend.com.br
// Deploy este código em: https://dash.cloudflare.com/workers

const SUPABASE_URL = 'https://agoyetuktxaknbonkwzz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnb3lldHVrdHhha25ib25rd3p6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzMDI1OTksImV4cCI6MjA3Nzg3ODU5OX0.MjtCwp4fDfXhyTE6-zZZrCn7R5sx-LhID_2SXFVpVO0';

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function validateToken(token) {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_instances?instance_token=eq.${token}&select=id,status,user_id`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    const data = await response.json();

    if (data && data.length > 0 && data[0].status === 'connected') {
      return { valid: true, instance: data[0] };
    }

    return { valid: false };
  } catch (error) {
    return { valid: false };
  }
}

async function handleRequest(request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, token',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const token = request.headers.get('token');

  if (!token) {
    return new Response(JSON.stringify({ error: 'Token is required' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const validation = await validateToken(token);

  if (!validation.valid) {
    return new Response(JSON.stringify({ error: 'Invalid or inactive instance token' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const url = new URL(request.url);
    const path = url.pathname.replace('/whatsapp/', '/');

    const body = await request.text();

    const response = await fetch(`${SUPABASE_URL}/functions/v1${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'token': token,
        'instance-id': validation.instance.id,
      },
      body: body,
    });

    const data = await response.text();

    return new Response(data, {
      status: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}
