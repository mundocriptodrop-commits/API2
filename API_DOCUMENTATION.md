# Documentação da API WhatsApp Manager

## Visão Geral

Sistema de envio de mensagens WhatsApp com suporte a **múltiplas instâncias isoladas**. Cada instância possui seu próprio token único para autenticação.

## Endpoints Disponíveis

### Opção 1: Edge Function Direta (Recomendado)
```
https://agoyetuktxaknbonkwzz.supabase.co/functions/v1/send-text
```

### Opção 2: Cloudflare Worker (Domínio Customizado)
```
https://api.evasend.com.br/whatsapp/send-text
```

---

## POST /send-text

Envia mensagem de texto via WhatsApp usando uma instância específica.

### Headers

```
Content-Type: application/json
token: seu_instance_token
```

### Body (JSON)

```json
{
  "number": "5511999999999",
  "text": "Olá! Como posso ajudar?"
}
```

### Parâmetros

| Campo  | Tipo   | Obrigatório | Descrição                                           |
|--------|--------|-------------|-----------------------------------------------------|
| number | string | Sim         | Número com código do país (ex: 5511999999999)      |
| text   | string | Sim         | Mensagem de texto a ser enviada                     |

### Resposta de Sucesso (200)

```json
{
  "success": true,
  "message": "Mensagem enviada com sucesso",
  "instance": {
    "id": "uuid-da-instancia",
    "name": "Nome da Instância"
  }
}
```

### Respostas de Erro

**401 Unauthorized** - Token inválido ou instância desconectada
```json
{
  "error": "Token inválido ou instância não conectada"
}
```

**400 Bad Request** - Parâmetros inválidos
```json
{
  "error": "Campos 'number' e 'text' são obrigatórios"
}
```

**500 Internal Server Error** - Erro no servidor
```json
{
  "success": false,
  "error": "Erro ao processar requisição"
}
```

---

## Exemplos de Uso

### cURL

```bash
curl --request POST \
  --url https://agoyetuktxaknbonkwzz.supabase.co/functions/v1/send-text \
  --header 'Content-Type: application/json' \
  --header 'token: seu_instance_token_aqui' \
  --data '{
    "number": "5511999999999",
    "text": "Olá! Como posso ajudar?"
  }'
```

### JavaScript (Fetch)

```javascript
const response = await fetch('https://agoyetuktxaknbonkwzz.supabase.co/functions/v1/send-text', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'token': 'seu_instance_token_aqui'
  },
  body: JSON.stringify({
    number: '5511999999999',
    text: 'Olá! Como posso ajudar?'
  })
});

const data = await response.json();
console.log(data);
```

### Python (Requests)

```python
import requests

url = "https://agoyetuktxaknbonkwzz.supabase.co/functions/v1/send-text"
headers = {
    "Content-Type": "application/json",
    "token": "seu_instance_token_aqui"
}
data = {
    "number": "5511999999999",
    "text": "Olá! Como posso ajudar?"
}

response = requests.post(url, json=data, headers=headers)
print(response.json())
```

### PHP

```php
<?php
$url = 'https://agoyetuktxaknbonkwzz.supabase.co/functions/v1/send-text';
$data = [
    'number' => '5511999999999',
    'text' => 'Olá! Como posso ajudar?'
];

$options = [
    'http' => [
        'method' => 'POST',
        'header' => [
            'Content-Type: application/json',
            'token: seu_instance_token_aqui'
        ],
        'content' => json_encode($data)
    ]
];

$context = stream_context_create($options);
$response = file_get_contents($url, false, $context);
echo $response;
?>
```

---

## Integração com n8n

### Configuração no n8n

1. **Adicionar nó HTTP Request**
2. **Configurar Method:** POST
3. **Configurar URL:** `https://agoyetuktxaknbonkwzz.supabase.co/functions/v1/send-text`
4. **Adicionar Authentication:**
   - Type: `Header Auth`
   - Name: `token`
   - Value: `[seu_instance_token]`
5. **Configurar Body:**
   - Body Content Type: `JSON`
   - Body:
     ```json
     {
       "number": "{{$json.phone}}",
       "text": "{{$json.message}}"
     }
     ```

### Múltiplas Instâncias no n8n

Crie **múltiplas credenciais**, uma para cada instância:

- **WhatsApp Vendas**
  - Name: `token`
  - Value: `abc123def456...` (token da instância Vendas)

- **WhatsApp Suporte**
  - Name: `token`
  - Value: `ghi789jkl012...` (token da instância Suporte)

- **WhatsApp Marketing**
  - Name: `token`
  - Value: `mno345pqr678...` (token da instância Marketing)

Cada workflow pode selecionar qual credencial (instância) usar.

### Exemplo de Workflow n8n

```
Webhook → Set Variables → HTTP Request (WhatsApp) → Response
```

**Set Variables:**
```json
{
  "phone": "{{$json.body.phone}}",
  "message": "Olá {{$json.body.name}}, sua mensagem foi recebida!"
}
```

**HTTP Request:**
- URL: `https://agoyetuktxaknbonkwzz.supabase.co/functions/v1/send-text`
- Authentication: `WhatsApp Vendas` (selecione a credencial desejada)
- Body:
```json
{
  "number": "{{$json.phone}}",
  "text": "{{$json.message}}"
}
```

---

## Múltiplas Instâncias

### Como Funciona

Cada instância WhatsApp possui:
- ✅ Token único (`instance_token`)
- ✅ Isolamento automático no banco de dados
- ✅ Validação em cada requisição
- ✅ Status independente (conectada/desconectada)

### Exemplo com Múltiplas Instâncias

```bash
# Enviar via instância "Vendas"
curl -X POST https://agoyetuktxaknbonkwzz.supabase.co/functions/v1/send-text \
  -H "token: abc123def456..." \
  -d '{"number":"5511999999999","text":"Mensagem da equipe de Vendas"}'

# Enviar via instância "Suporte"
curl -X POST https://agoyetuktxaknbonkwzz.supabase.co/functions/v1/send-text \
  -H "token: ghi789jkl012..." \
  -d '{"number":"5511999999999","text":"Mensagem da equipe de Suporte"}'
```

### Obtendo Tokens das Instâncias

1. Acesse o painel do cliente
2. Vá em "Instâncias"
3. Conecte uma instância WhatsApp (QR Code)
4. Após conectada, acesse a aba "API"
5. Copie o `instance_token` da instância desejada

---

## Segurança

### Validação Automática

Cada requisição valida:
- ✅ Token existe no banco de dados?
- ✅ Instância está com status "conectada"?
- ✅ Token pertence a um usuário válido? (via RLS)

### Isolamento

- ❌ Token de uma instância **não funciona** em outra
- ❌ Token inválido retorna erro 401
- ❌ Instância desconectada retorna erro 401
- ✅ Row Level Security (RLS) garante isolamento

### Boas Práticas

1. **Nunca exponha tokens publicamente**
2. **Use HTTPS sempre**
3. **Rotacione tokens se comprometidos** (reconecte a instância)
4. **Monitore logs de acesso** (disponível no Supabase)
5. **Use uma instância por departamento/aplicação**

---

## Troubleshooting

### Erro 401 "Unauthorized"

**Possíveis causas:**
- Token inválido ou copiado incorretamente
- Instância desconectada
- Token de outra instância

**Soluções:**
1. Verifique se copiou o token correto da aba "API"
2. Certifique-se que a instância está "Conectada" (status verde)
3. Teste o token no painel (aba "API" → "Testar API")
4. Reconecte a instância se necessário

### Erro 400 "Bad Request"

**Possíveis causas:**
- Campos obrigatórios ausentes (`number` ou `text`)
- Formato JSON inválido
- Número de telefone inválido

**Soluções:**
1. Verifique se enviou `number` e `text` no body
2. Valide o JSON usando um validador online
3. Certifique-se que o número está no formato correto: `5511999999999`

### Erro 500 "Internal Server Error"

**Possíveis causas:**
- Erro no servidor WhatsApp externo
- Edge Function com problema
- Timeout na requisição

**Soluções:**
1. Verifique logs no painel do Supabase
2. Tente novamente após alguns segundos
3. Verifique se a instância continua conectada
4. Entre em contato com o suporte se persistir

---

## Limites e Quotas

### Rate Limiting

- **Supabase Edge Functions:** Conforme plano contratado
- **Recomendado:** Máximo 10 requisições/segundo por instância

### Timeouts

- **Requisição HTTP:** 30 segundos
- **Edge Function:** 60 segundos

### Tamanho

- **Texto máximo:** 4096 caracteres
- **Body máximo:** 1 MB

---

## Suporte

### Documentação
- Painel do Cliente: Aba "API"
- Logs: Painel Supabase → Edge Functions

### Contato
- Para dúvidas sobre integração, consulte esta documentação
- Para problemas técnicos, verifique os logs primeiro
- Para novos recursos, entre em contato com o administrador
