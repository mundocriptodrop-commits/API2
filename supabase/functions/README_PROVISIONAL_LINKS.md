# Configuração de Links Provisórios de Conexão

## Variáveis de Ambiente Necessárias

As Edge Functions `connect` e `generate-provisional-link` precisam das seguintes variáveis de ambiente configuradas no Supabase:

### Configurar no Supabase Dashboard:

1. Acesse: **Supabase Dashboard → Project Settings → Edge Functions → Secrets**
2. Adicione as seguintes variáveis:

```
SUPABASE_URL=https://ctshqbxxlauulzsbapjb.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0c2hxYnh4bGF1dWx6c2JhcGpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzODgzMzUsImV4cCI6MjA3Nzk2NDMzNX0.NUcOBwoVOC4eE8BukporxYVzDyh0RAc8iQ1dM9qbalY
SUPABASE_SERVICE_ROLE_KEY=[sua-service-role-key]
```

**Importante**: A `SUPABASE_SERVICE_ROLE_KEY` é necessária para a função `connect` acessar o banco sem autenticação do usuário.

### Como obter a SERVICE_ROLE_KEY:

1. Acesse: **Supabase Dashboard → Project Settings → API**
2. Copie a chave **service_role** (secret)
3. Adicione como variável de ambiente na seção Edge Functions

## Deploy das Funções

```bash
# Deploy da função de gerar links
supabase functions deploy generate-provisional-link

# Deploy da função de exibir QR code (sem verificação JWT para permitir acesso público)
supabase functions deploy connect --no-verify-jwt
```

**Importante**: A função `connect` usa `--no-verify-jwt` porque precisa ser acessível publicamente via navegador. A validação do `apikey` é feita manualmente dentro da função.

## Como Funciona

1. **Gerar Link**: Usuário clica em "Link Provisório" → função `generate-provisional-link` cria um link único
2. **Acessar Link**: Cliente acessa `https://[projeto].supabase.co/functions/v1/connect/[token]`
3. **Exibir QR Code**: Função `connect` busca o link no banco e retorna HTML com QR code
4. **Invalidar Link**: Quando instância conecta, trigger no banco marca o link como usado

## Troubleshooting

### Erro: "Missing authorization header"
- **Causa**: Variável `SUPABASE_SERVICE_ROLE_KEY` não configurada
- **Solução**: Configure a variável de ambiente no Supabase Dashboard

### Erro: "Link not found"
- **Causa**: Token inválido ou link expirado
- **Solução**: Gere um novo link

### Link não invalida após conexão
- **Causa**: Trigger não está funcionando
- **Solução**: Verifique se a migration foi aplicada corretamente
