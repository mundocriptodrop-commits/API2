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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se o usuário tem perfil
    const { data: currentProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, max_instances, parent_user_id')
      .eq('id', user.id)
      .single();

    if (profileError || !currentProfile) {
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Não permitir que sub-usuários criem outros sub-usuários
    if (currentProfile.parent_user_id) {
      return new Response(
        JSON.stringify({ error: 'Sub-users cannot create other sub-users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const path = url.pathname.replace('/client-sub-users', '');

    // Listar sub-usuários
    if (req.method === 'GET' && path === '/list') {
      const { data: subUsers, error } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          max_instances,
          created_at,
          updated_at
        `)
        .eq('parent_user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Buscar contagem de instâncias de cada sub-usuário
      const subUsersWithCounts = await Promise.all(
        (subUsers || []).map(async (subUser) => {
          const { count } = await supabase
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

    // Criar sub-usuário
    if (req.method === 'POST' && path === '/create') {
      const { email, password, maxInstances, chatConfig } = await req.json();

      if (!email || !password || !maxInstances) {
        return new Response(
          JSON.stringify({ error: 'Email, password and maxInstances are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verificar se o usuário tem instâncias disponíveis
      const parentUserId = currentProfile.id;
      const { data: parentProfile } = await supabase
        .from('profiles')
        .select('max_instances')
        .eq('id', parentUserId)
        .single();

      // Contar instâncias usadas pelo pai
      const { count: parentInstances } = await supabase
        .from('whatsapp_instances')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', parentUserId);

      // Buscar todos os sub-usuários
      const { data: subUsers } = await supabase
        .from('profiles')
        .select('id')
        .eq('parent_user_id', parentUserId);

      const subUserIds = subUsers?.map(u => u.id) || [];
      
      // Contar instâncias de todos os sub-usuários
      let subUserInstances = 0;
      if (subUserIds.length > 0) {
        const { count } = await supabase
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

      // Verificar se email já existe
      const { data: existingUser } = await supabase.auth.admin.listUsers();
      const userExists = existingUser?.users?.some(u => u.email === email);

      if (userExists) {
        return new Response(
          JSON.stringify({ error: 'Este email já está cadastrado no sistema' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Criar usuário
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
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

      // Criar perfil com parent_user_id e configurações de chat (se fornecidas)
      const profileData: any = {
        id: authData.user.id,
        email,
        role: 'client',
        max_instances: maxInstances,
        parent_user_id: user.id,
      };

      // Adicionar configurações de chat se fornecidas
      if (chatConfig && chatConfig.chat_url && chatConfig.chat_api_key && chatConfig.chat_account_id) {
        profileData.chat_url = chatConfig.chat_url;
        profileData.chat_api_key = chatConfig.chat_api_key;
        profileData.chat_account_id = chatConfig.chat_account_id;
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .insert(profileData);

      if (profileError) {
        await supabase.auth.admin.deleteUser(authData.user.id);
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

    // Atualizar sub-usuário
    if (req.method === 'PUT' && path === '/update') {
      const { userId, maxInstances, password } = await req.json();

      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'userId is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verificar se é sub-usuário do usuário atual
      const { data: subUser, error: subUserError } = await supabase
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

      // Verificar disponibilidade (similar ao create)
      const parentUserId = currentProfile.id;
      const { data: parentProfile } = await supabase
        .from('profiles')
        .select('max_instances')
        .eq('id', parentUserId)
        .single();

      const { count: parentInstances } = await supabase
        .from('whatsapp_instances')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', parentUserId);

      const { data: subUsers } = await supabase
        .from('profiles')
        .select('id')
        .eq('parent_user_id', parentUserId);

      const subUserIds = subUsers?.map(u => u.id) || [];
      
      let subUserInstances = 0;
      if (subUserIds.length > 0) {
        const { count } = await supabase
          .from('whatsapp_instances')
          .select('*', { count: 'exact', head: true })
          .in('user_id', subUserIds);
        subUserInstances = count || 0;
      }

      // Contar instâncias atuais deste sub-usuário
      const { count: currentSubUserInstances } = await supabase
        .from('whatsapp_instances')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      const totalUsed = (parentInstances || 0) + subUserInstances - (currentSubUserInstances || 0);
      const available = parentProfile?.max_instances 
        ? parentProfile.max_instances - totalUsed 
        : -1;

      if (available !== -1 && maxInstances > available) {
        return new Response(
          JSON.stringify({ 
            error: `Você só tem ${available} instâncias disponíveis para este sub-usuário.` 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Atualizar perfil
      const updateData: any = { max_instances: maxInstances };
      
      if (password && password.trim() !== '') {
        const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
          password,
        });
        if (updateError) {
          return new Response(
            JSON.stringify({ error: updateError.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update(updateData)
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

    // Deletar sub-usuário
    if (req.method === 'DELETE' && path === '/delete') {
      const { userId } = await req.json();

      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'userId is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verificar se é sub-usuário
      const { data: subUser, error: subUserError } = await supabase
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

      const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
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
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
