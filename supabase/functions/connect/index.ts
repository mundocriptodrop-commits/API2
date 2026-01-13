// Esta função é um alias para get-connection-link
// Permite URLs mais curtas: /functions/v1/connect/[token]
// Redireciona para a lógica de get-connection-link
//
// IMPORTANTE: Esta função precisa ser acessível publicamente sem autenticação.
// O Supabase exige o header 'apikey' mesmo para funções públicas.
// Para acessar via navegador, o HTML gerado inclui o apikey nas requisições JavaScript.

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
    const pathParts = url.pathname.split('/').filter(p => p);
    let linkToken = pathParts[pathParts.length - 1];
    
    // Verifica apikey (pode vir do header ou query parameter)
    // Esta função usa --no-verify-jwt, então verificamos manualmente
    const apikeyFromHeader = req.headers.get('apikey');
    const apikeyFromQuery = url.searchParams.get('apikey');
    const apikey = apikeyFromHeader || apikeyFromQuery;
    const expectedAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    
    // Valida apikey (deve ser ANON_KEY para acesso público)
    if (!apikey || apikey !== expectedAnonKey) {
      // Se não tem apikey válido, retorna HTML com JavaScript que faz a requisição correta
      if (!apikeyFromQuery) {
        // Redireciona para a mesma URL com apikey na query
        const redirectUrl = `${url.origin}${url.pathname}?apikey=${encodeURIComponent(expectedAnonKey)}`;
        return new Response(null, {
          status: 302,
          headers: {
            ...corsHeaders,
            'Location': redirectUrl,
          },
        });
      }
      
      // Se tem apikey mas é inválido, retorna erro
      return new Response(
        JSON.stringify({ code: 401, message: 'Invalid API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!linkToken || linkToken === 'connect') {
      const errorHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Link Inválido</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 20px;
      padding: 40px;
      max-width: 500px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      text-align: center;
    }
    .error {
      background: #ffebee;
      color: #c62828;
      padding: 20px;
      border-radius: 10px;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>❌ Link Inválido</h1>
    <div class="error">
      <p>Token do link não encontrado na URL.</p>
    </div>
  </div>
</body>
</html>`;
      return new Response(errorHtml, {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Cria cliente Supabase usando SERVICE_ROLE_KEY para bypass de RLS
    // Isso é necessário porque a Edge Function precisa acessar dados sem autenticação do usuário
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    let supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    // Se SERVICE_ROLE_KEY não estiver configurada, tenta ANON_KEY
    if (!supabaseServiceKey) {
      console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY not configured, using ANON_KEY');
      supabaseServiceKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    }
    
    if (!supabaseServiceKey || !supabaseUrl) {
      console.error('❌ Missing Supabase configuration');
      const errorHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Erro de Configuração</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 20px;
      padding: 40px;
      max-width: 500px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      text-align: center;
    }
    .error {
      background: #ffebee;
      color: #c62828;
      padding: 20px;
      border-radius: 10px;
      margin-top: 20px;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>⚠️ Erro de Configuração</h1>
    <div class="error">
      <p><strong>A Edge Function não está configurada corretamente.</strong></p>
      <p style="margin-top: 15px;">Configure as variáveis de ambiente no Supabase Dashboard:</p>
      <p style="margin-top: 10px; font-family: monospace; background: #f5f5f5; padding: 10px; border-radius: 5px;">
        SUPABASE_SERVICE_ROLE_KEY
      </p>
      <p style="margin-top: 15px; font-size: 12px;">Veja o arquivo README_PROVISIONAL_LINKS.md para instruções detalhadas.</p>
    </div>
  </div>
</body>
</html>`;
      return new Response(errorHtml, {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
    
    // Usa SERVICE_ROLE_KEY para bypass de RLS (necessário para acesso público)
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Busca o link no banco
    console.log(`[CONNECT] Buscando link com token: ${linkToken.substring(0, 20)}...`);
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

    console.log(`[CONNECT] Resultado da busca:`, link ? 'Link encontrado' : 'Link não encontrado');
    if (linkError) {
      console.error(`[CONNECT] Erro ao buscar link:`, linkError);
    }

    if (linkError || !link) {
      const errorHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Link Inválido</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 20px;
      padding: 40px;
      max-width: 500px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      text-align: center;
    }
    .error {
      background: #ffebee;
      color: #c62828;
      padding: 20px;
      border-radius: 10px;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>❌ Link Inválido</h1>
    <div class="error">
      <p>Link não encontrado ou inválido. Verifique o link e tente novamente.</p>
    </div>
  </div>
</body>
</html>`;
      return new Response(errorHtml, {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    const instance = link.whatsapp_instances;

    // Verifica se o link está válido
    if (link.used_at) {
      const usedHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Link Já Usado</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 20px;
      padding: 40px;
      max-width: 500px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      text-align: center;
    }
    .status {
      background: #fff3cd;
      color: #856404;
      padding: 20px;
      border-radius: 10px;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>⚠️ Link Já Usado</h1>
    <div class="status">
      <p>Este link já foi utilizado para conectar o WhatsApp.</p>
      <p style="margin-top: 10px; font-size: 14px;">O link expira automaticamente após a conexão.</p>
    </div>
  </div>
</body>
</html>`;
      return new Response(usedHtml, {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    if (new Date(link.expires_at) < new Date()) {
      const expiredHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Link Expirado</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 20px;
      padding: 40px;
      max-width: 500px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      text-align: center;
    }
    .status {
      background: #ffebee;
      color: #c62828;
      padding: 20px;
      border-radius: 10px;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>⏰ Link Expirado</h1>
    <div class="status">
      <p>Este link expirou. Solicite um novo link para conectar.</p>
    </div>
  </div>
</body>
</html>`;
      return new Response(expiredHtml, {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Se a instância já está conectada, marca o link como usado
    if (instance && instance.status === 'connected') {
      await supabaseClient
        .from('provisional_connection_links')
        .update({ used_at: new Date().toISOString() })
        .eq('id', link.id);

      const successHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WhatsApp Conectado</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 20px;
      padding: 40px;
      max-width: 500px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      text-align: center;
    }
    h1 { color: #2e7d32; margin-bottom: 20px; font-size: 32px; }
    .success {
      background: #e8f5e9;
      color: #2e7d32;
      padding: 20px;
      border-radius: 10px;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>✅ WhatsApp Conectado!</h1>
    <div class="success">
      <h2>Conectado com Sucesso</h2>
      <p style="margin-top: 10px;">Instância: ${instance.name || 'N/A'}</p>
      <p style="margin-top: 10px;">Você pode fechar esta página.</p>
    </div>
  </div>
</body>
</html>`;

      return new Response(successHtml, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Busca QR code da instância via UAZAPI
    if (!instance || !instance.instance_token) {
      const errorHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Erro</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 20px;
      padding: 40px;
      max-width: 500px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      text-align: center;
    }
    .error {
      background: #ffebee;
      color: #c62828;
      padding: 20px;
      border-radius: 10px;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>❌ Erro</h1>
    <div class="error">
      <p>Token da instância não encontrado.</p>
    </div>
  </div>
</body>
</html>`;
      return new Response(errorHtml, {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
      });
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
      const errorHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Erro</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 20px;
      padding: 40px;
      max-width: 500px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      text-align: center;
    }
    .error {
      background: #ffebee;
      color: #c62828;
      padding: 20px;
      border-radius: 10px;
      margin-top: 20px;
    }
    .loading {
      display: inline-block;
      width: 40px;
      height: 40px;
      border: 4px solid #f3f3f3;
      border-top: 4px solid #667eea;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 20px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>⏳ Aguarde</h1>
    <div class="loading"></div>
    <div class="error">
      <p>Preparando conexão... Recarregue a página em alguns segundos.</p>
    </div>
  </div>
  <script>
    setTimeout(() => location.reload(), 5000);
  </script>
</body>
</html>`;
      return new Response(errorHtml, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    const statusData = await statusResponse.json();
    const qrCode = statusData.instance?.qrcode || statusData.qrCode || null;
    const pairingCode = statusData.instance?.paircode || statusData.pairingCode || null;

    // Retorna HTML com QR code
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Conectar WhatsApp</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 20px;
      padding: 40px;
      max-width: 500px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      text-align: center;
    }
    h1 { color: #333; margin-bottom: 10px; font-size: 28px; }
    p { color: #666; margin-bottom: 30px; line-height: 1.6; }
    .qr-container {
      background: #f8f9fa;
      border-radius: 15px;
      padding: 30px;
      margin: 30px 0;
      display: inline-block;
    }
    .qr-code { max-width: 100%; height: auto; }
    .pairing-code {
      font-size: 32px;
      font-weight: bold;
      color: #667eea;
      letter-spacing: 8px;
      margin: 20px 0;
      font-family: 'Courier New', monospace;
    }
    .status {
      margin-top: 20px;
      padding: 15px;
      border-radius: 10px;
      background: #e3f2fd;
      color: #1976d2;
    }
    .success {
      background: #e8f5e9;
      color: #2e7d32;
    }
    .loading {
      display: inline-block;
      width: 40px;
      height: 40px;
      border: 4px solid #f3f3f3;
      border-top: 4px solid #667eea;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 20px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📱 Conectar WhatsApp</h1>
    <p style="font-size: 18px; font-weight: 600; color: #333; margin-bottom: 10px;">${instance.name || 'Instância WhatsApp'}</p>
    <p style="font-size: 14px; color: #666; margin-bottom: 30px;">Escaneie o QR Code abaixo com seu WhatsApp para conectar</p>
    <div id="content">
      ${qrCode ? `
        <div class="qr-container">
          <img src="${qrCode}" alt="QR Code" class="qr-code" />
        </div>
        ${pairingCode ? `
          <div style="margin-top: 20px;">
            <p style="font-size: 14px; color: #666; margin-bottom: 10px;">Ou use o código de pareamento:</p>
            <div class="pairing-code">${pairingCode}</div>
          </div>
        ` : ''}
        <div class="status" style="margin-top: 30px;">
          <p style="margin: 0;">⏳ Aguardando conexão...</p>
          <p style="margin: 5px 0 0 0; font-size: 12px;">Este link expirará automaticamente após a conexão</p>
        </div>
      ` : pairingCode ? `
        <div style="margin-top: 20px;">
          <p style="font-size: 16px; color: #333; margin-bottom: 15px; font-weight: 600;">Código de Pareamento:</p>
          <div class="pairing-code">${pairingCode}</div>
          <p style="font-size: 14px; color: #666; margin-top: 20px;">Digite este código no WhatsApp:</p>
          <p style="font-size: 13px; color: #888; margin-top: 5px;">Configurações → Aparelhos conectados → Conectar um aparelho</p>
        </div>
        <div class="status" style="margin-top: 30px;">
          <p style="margin: 0;">⏳ Aguardando conexão...</p>
          <p style="margin: 5px 0 0 0; font-size: 12px;">Este link expirará automaticamente após a conexão</p>
        </div>
      ` : `
        <div class="loading"></div>
        <div class="status" style="margin-top: 20px;">
          <p style="margin: 0;">⏳ Preparando conexão...</p>
          <p style="margin: 5px 0 0 0; font-size: 12px;">Aguarde alguns segundos e recarregue a página</p>
        </div>
      `}
    </div>
  </div>
  <script>
    (function() {
      const linkToken = '${linkToken}';
      const supabaseUrl = 'https://ctshqbxxlauulzsbapjb.supabase.co';
      const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0c2hxYnh4bGF1dWx6c2JhcGpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzODgzMzUsImV4cCI6MjA3Nzk2NDMzNX0.NUcOBwoVOC4eE8BukporxYVzDyh0RAc8iQ1dM9qbalY';
      
      // Auto-refresh a cada 3 segundos para verificar se conectou
      const checkInterval = setInterval(async function() {
        try {
          const url = supabaseUrl + '/functions/v1/connect/' + linkToken + '?apikey=' + encodeURIComponent(supabaseAnonKey);
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'apikey': supabaseAnonKey,
              'Accept': 'application/json, text/html',
            },
          });
          
          const contentType = response.headers.get('content-type') || '';
          
          // Se a resposta é HTML (instância conectada), substitui a página
          if (contentType.includes('text/html')) {
            const html = await response.text();
            if (html.includes('Conectado') || html.includes('WhatsApp Conectado') || html.includes('✅')) {
              clearInterval(checkInterval);
              document.open();
              document.write(html);
              document.close();
              return;
            }
          }
          
          // Se a resposta é JSON, processa normalmente
          if (contentType.includes('application/json')) {
            const data = await response.json();
            
            if (data.connected) {
              clearInterval(checkInterval);
              const container = document.querySelector('.container');
              if (container) {
                container.innerHTML = '<h1>✅ Conectado!</h1><div class="status success"><h2>WhatsApp Conectado com Sucesso!</h2><p>Instância: ' + (data.instance_name || 'N/A') + '</p><p>Você pode fechar esta página.</p></div>';
              }
            } else if (data.qr_code && !document.querySelector('.qr-code')) {
              // Atualiza QR code se aparecer
              location.reload();
            }
          }
        } catch (e) {
          console.error('Error checking status:', e);
        }
      }, 3000);
      
      // Se não tem QR code, recarrega após 5 segundos
      ${!qrCode ? `setTimeout(function() { location.reload(); }, 5000);` : ''}
    })();
  </script>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Encoding': 'utf-8',
      },
    });
  } catch (error) {
    console.error('Error:', error);
    const errorHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Erro</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 20px;
      padding: 40px;
      max-width: 500px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      text-align: center;
    }
    .error {
      background: #ffebee;
      color: #c62828;
      padding: 20px;
      border-radius: 10px;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>❌ Erro</h1>
    <div class="error">
      <p>Erro ao processar link. Tente novamente.</p>
    </div>
  </div>
</body>
</html>`;
    return new Response(errorHtml, {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
});
