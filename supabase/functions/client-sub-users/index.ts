import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const authHeader = req.headers.get('Authorization');
    console.log('Auth header:', authHeader ? 'present' : 'missing');
    
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('Token length:', token.length);
    
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: `Bearer ${token}` }
      }
    });

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    console.log('User:', user ? user.id : 'null', 'Error:', userError?.message || 'none');

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: userError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: currentProfile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('id, max_instances, parent_user_id')
      .eq('id', user.id)
      .single();

    if (profileError || !currentProfile) {
      console.log('Profile error:', profileError?.message);
      return new Response(
        JSON.stringify({ error: 'Profile not found', details: profileError?.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (currentProfile.parent_user_id) {
      return new Response(
        JSON.stringify({ error: 'Sub-users cannot manage other sub-users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const path = url.pathname.split('/client-sub-users')[1] || '';
    console.log('Path:', path, 'Method:', req.method);

    if (req.method === 'GET' && path === '/list') {
      const { data: subUsers, error } = await supabaseClient
        .from('profiles')
        .select('id, email, max_instances, created_at, updated_at')
        .eq('parent_user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const subUsersWithCounts = await Promise.all(
        (subUsers || []).map(async (subUser) => {
          const { count } = await supabaseClient
            .from('whatsapp_instances')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', subUser.id);
          
          return {
            ...subUser,
            instances_count: count || 0,
          };
        })
      );

      return new Response(
        JSON.stringify({ subUsers: subUsersWithCounts }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'POST' && path === '/create') {
      const { email, password, maxInstances } = await req.json();

      if (!email || !password || !maxInstances) {
        return new Response(
          JSON.stringify({ error: 'Email, password and maxInstances are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const supabaseAdmin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

      const { data: parentProfile } = await supabaseClient
        .from('profiles')
        .select('max_instances')
        .eq('id', user.id)
        .single();

      const { count: parentInstances } = await supabaseClient
        .from('whatsapp_instances')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      const { data: subUsers } = await supabaseClient
        .from('profiles')
        .select('id')
        .eq('parent_user_id', user.id);

      const subUserIds = subUsers?.map(u => u.id) || [];
      
      let subUserInstances = 0;
      if (subUserIds.length > 0) {
        const { count } = await supabaseClient
          .from('whatsapp_instances')
          .select('*', { count: 'exact', head: true })
          .in('user_id', subUserIds);
        subUserInstances = count || 0;
      }

      const totalUsed = (parentInstances || 0) + subUserInstances;
      const available = parentProfile?.max_instances 
        ? parentProfile.max_instances - totalUsed 
        : -1;

      if (available !== -1 && maxInstances > available) {
        return new Response(
          JSON.stringify({ 
            error: `Você só tem ${available} instâncias disponíveis. Você já está usando ${totalUsed} de ${parentProfile.max_instances}.` 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
      const userExists = existingUser?.users?.some(u => u.email === email);

      if (userExists) {
        return new Response(
          JSON.stringify({ error: 'Este email já está cadastrado no sistema' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (authError) {
        return new Response(
          JSON.stringify({ error: authError.message || 'Erro ao criar usuário' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: authData.user.id,
          email,
          role: 'client',
          max_instances: maxInstances,
          parent_user_id: user.id,
        });

      if (profileError) {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        return new Response(
          JSON.stringify({ error: 'Erro ao criar perfil do usuário' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, user: authData.user }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'PUT' && path === '/update') {
      const { userId, maxInstances, password } = await req.json();

      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'userId is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: subUser, error: subUserError } = await supabaseClient
        .from('profiles')
        .select('id, max_instances')
        .eq('id', userId)
        .eq('parent_user_id', user.id)
        .single();

      if (subUserError || !subUser) {
        return new Response(
          JSON.stringify({ error: 'Sub-usuário não encontrado' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const supabaseAdmin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

      if (password && password.trim() !== '') {
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          password,
        });
        if (updateError) {
          return new Response(
            JSON.stringify({ error: updateError.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ max_instances: maxInstances })
        .eq('id', userId);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'DELETE' && path === '/delete') {
      const { userId } = await req.json();

      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'userId is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: subUser, error: subUserError } = await supabaseClient
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .eq('parent_user_id', user.id)
        .single();

      if (subUserError || !subUser) {
        return new Response(
          JSON.stringify({ error: 'Sub-usuário não encontrado' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const supabaseAdmin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (deleteError) {
        return new Response(
          JSON.stringify({ error: deleteError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});