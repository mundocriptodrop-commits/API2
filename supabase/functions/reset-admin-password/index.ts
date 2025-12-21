import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Secret-Key'
      }
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({
      error: 'Missing environment variables'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  const { createClient } = await import('npm:@supabase/supabase-js@2');
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const adminUserId = '013484ea-851f-493a-8831-49765044553a';
    const newPassword = 'Admin123!@#';
    
    const { data, error } = await supabase.auth.admin.updateUserById(adminUserId, {
      password: newPassword,
      email_confirm: true
    });

    if (error) {
      return new Response(JSON.stringify({
        error: error.message
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Senha do administrador resetada com sucesso!',
      email: 'admin@whatsapp.com',
      newPassword: newPassword,
      warning: 'Por favor, altere esta senha após o primeiro login por questões de segurança.'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({
      error: error.message || 'Erro ao resetar senha'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
});