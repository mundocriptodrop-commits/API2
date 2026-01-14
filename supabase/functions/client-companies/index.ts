import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Token de autorização ausente' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: `Não autorizado: ${authError?.message || 'usuário inválido'}` }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const path = url.pathname.split('/').filter(Boolean).slice(1);
    const method = req.method;

    if (method === 'GET' && path[0] === 'list') {
      return await handleListCompanies(supabaseClient, user.id);
    }

    if (method === 'POST' && path[0] === 'create') {
      const body = await req.json();
      return await handleCreateCompany(supabaseClient, user.id, body);
    }

    if (method === 'PUT' && path[0] === 'update') {
      const body = await req.json();
      return await handleUpdateCompany(supabaseClient, user.id, body);
    }

    if (method === 'DELETE' && path[0] === 'delete') {
      const body = await req.json();
      return await handleDeleteCompany(supabaseClient, user.id, body);
    }

    if (method === 'GET' && path[0] === 'users' && path[1]) {
      return await handleListCompanyUsers(supabaseClient, user.id, path[1]);
    }

    if (method === 'POST' && path[0] === 'users' && path[1] === 'add') {
      const body = await req.json();
      return await handleAddUserToCompany(supabaseClient, user.id, body);
    }

    if (method === 'PUT' && path[0] === 'users' && path[1] === 'update') {
      const body = await req.json();
      return await handleUpdateCompanyUser(supabaseClient, user.id, body);
    }

    if (method === 'DELETE' && path[0] === 'users' && path[1] === 'remove') {
      const body = await req.json();
      return await handleRemoveUserFromCompany(supabaseClient, user.id, body);
    }

    return new Response(
      JSON.stringify({ error: 'Rota não encontrada' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handleListCompanies(supabaseClient: any, userId: string) {
  const { data: companies, error } = await supabaseClient
    .from('companies')
    .select('*')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const companiesWithCounts = await Promise.all(
    companies.map(async (company: any) => {
      const { count: usersCount } = await supabaseClient
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', company.id);

      const { data: companyUsers } = await supabaseClient
        .from('profiles')
        .select('id')
        .eq('company_id', company.id);

      let instancesCount = 0;
      if (companyUsers && companyUsers.length > 0) {
        const userIds = companyUsers.map((u: any) => u.id);
        const { count } = await supabaseClient
          .from('whatsapp_instances')
          .select('*', { count: 'exact', head: true })
          .in('user_id', userIds);
        instancesCount = count || 0;
      }

      return {
        ...company,
        users_count: usersCount || 0,
        instances_count: instancesCount,
      };
    })
  );

  return new Response(
    JSON.stringify({ companies: companiesWithCounts }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleCreateCompany(supabaseClient: any, userId: string, body: any) {
  const { name, maxInstances } = body;

  if (!name || !maxInstances) {
    return new Response(
      JSON.stringify({ error: 'Nome e máximo de instâncias são obrigatórios' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { data: company, error } = await supabaseClient
    .from('companies')
    .insert({
      name,
      owner_id: userId,
      max_instances: maxInstances,
    })
    .select()
    .single();

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ company }),
    { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleUpdateCompany(supabaseClient: any, userId: string, body: any) {
  const { companyId, name, maxInstances } = body;

  if (!companyId) {
    return new Response(
      JSON.stringify({ error: 'ID da empresa é obrigatório' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { data: company, error: fetchError } = await supabaseClient
    .from('companies')
    .select('*')
    .eq('id', companyId)
    .eq('owner_id', userId)
    .single();

  if (fetchError || !company) {
    return new Response(
      JSON.stringify({ error: 'Empresa não encontrada ou você não tem permissão' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { error } = await supabaseClient
    .from('companies')
    .update({ name, max_instances: maxInstances })
    .eq('id', companyId)
    .eq('owner_id', userId);

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleDeleteCompany(supabaseClient: any, userId: string, body: any) {
  const { companyId } = body;

  if (!companyId) {
    return new Response(
      JSON.stringify({ error: 'ID da empresa é obrigatório' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { data: company, error: fetchError } = await supabaseClient
    .from('companies')
    .select('*')
    .eq('id', companyId)
    .eq('owner_id', userId)
    .single();

  if (fetchError || !company) {
    return new Response(
      JSON.stringify({ error: 'Empresa não encontrada ou você não tem permissão' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { data: users } = await supabaseClient
    .from('profiles')
    .select('id')
    .eq('company_id', companyId);

  if (users && users.length > 0) {
    const userIds = users.map((u: any) => u.id);
    
    await supabaseClient
      .from('whatsapp_instances')
      .delete()
      .in('user_id', userIds);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    for (const user of users) {
      await supabaseAdmin.auth.admin.deleteUser(user.id);
    }
  }

  const { error } = await supabaseClient
    .from('companies')
    .delete()
    .eq('id', companyId)
    .eq('owner_id', userId);

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleListCompanyUsers(supabaseClient: any, userId: string, companyId: string) {
  const { data: company, error: companyError } = await supabaseClient
    .from('companies')
    .select('*')
    .eq('id', companyId)
    .eq('owner_id', userId)
    .single();

  if (companyError || !company) {
    return new Response(
      JSON.stringify({ error: 'Empresa não encontrada ou você não tem permissão' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { data: users, error } = await supabaseClient
    .from('profiles')
    .select('id, email, max_instances, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const usersWithCounts = await Promise.all(
    users.map(async (user: any) => {
      const { count } = await supabaseClient
        .from('whatsapp_instances')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      return {
        ...user,
        instances_count: count || 0,
      };
    })
  );

  return new Response(
    JSON.stringify({ users: usersWithCounts }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleAddUserToCompany(supabaseClient: any, userId: string, body: any) {
  const { companyId, email, password, maxInstances } = body;

  if (!companyId || !email || !password || !maxInstances) {
    return new Response(
      JSON.stringify({ error: 'Todos os campos são obrigatórios' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { data: company, error: companyError } = await supabaseAdmin
    .from('companies')
    .select('*')
    .eq('id', companyId)
    .eq('owner_id', userId)
    .single();

  if (companyError || !company) {
    return new Response(
      JSON.stringify({ error: `Empresa não encontrada ou você não tem permissão: ${companyError?.message || 'empresa não existe'}` }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { data: authData, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (signUpError) {
    return new Response(
      JSON.stringify({ error: signUpError.message || 'Erro ao criar usuário' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const newUserId = authData.user.id;

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({
      role: 'client',
      max_instances: maxInstances,
      company_id: companyId,
      parent_user_id: userId,
    })
    .eq('id', newUserId);

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(newUserId);
    return new Response(
      JSON.stringify({ error: `Erro ao configurar perfil do usuário: ${profileError.message}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, userId: newUserId }),
    { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleUpdateCompanyUser(supabaseClient: any, userId: string, body: any) {
  const { userId: targetUserId, maxInstances, password } = body;

  if (!targetUserId || !maxInstances) {
    return new Response(
      JSON.stringify({ error: 'ID do usuário e máximo de instâncias são obrigatórios' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { data: targetUser, error: fetchError } = await supabaseClient
    .from('profiles')
    .select('*, companies!inner(owner_id)')
    .eq('id', targetUserId)
    .single();

  if (fetchError || !targetUser || targetUser.companies.owner_id !== userId) {
    return new Response(
      JSON.stringify({ error: 'Usuário não encontrado ou você não tem permissão' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { error } = await supabaseClient
    .from('profiles')
    .update({ max_instances: maxInstances })
    .eq('id', targetUserId);

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (password) {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
      targetUserId,
      { password }
    );

    if (passwordError) {
      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar senha' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleRemoveUserFromCompany(supabaseClient: any, userId: string, body: any) {
  const { userId: targetUserId } = body;

  if (!targetUserId) {
    return new Response(
      JSON.stringify({ error: 'ID do usuário é obrigatório' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { data: targetUser, error: fetchError } = await supabaseClient
    .from('profiles')
    .select('*, companies!inner(owner_id)')
    .eq('id', targetUserId)
    .single();

  if (fetchError || !targetUser || targetUser.companies.owner_id !== userId) {
    return new Response(
      JSON.stringify({ error: 'Usuário não encontrado ou você não tem permissão' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  await supabaseClient
    .from('whatsapp_instances')
    .delete()
    .eq('user_id', targetUserId);

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { error } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}