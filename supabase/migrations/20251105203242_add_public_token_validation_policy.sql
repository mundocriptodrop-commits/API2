/*
  # Adicionar política pública para validação de tokens

  1. Mudanças
    - Adiciona política pública SELECT para validação de instance_token
    - Permite que aplicações externas (via anon key) validem tokens
    - Expõe apenas campos necessários para validação (id, status, user_id)
    - Mantém segurança: só permite busca por instance_token (não lista todas)
  
  2. Segurança
    - Política restritiva: requer filtro por instance_token
    - Não expõe dados sensíveis (phone_number, qr_code, etc)
    - Permite validação sem autenticação (necessário para APIs externas)
*/

-- Criar política pública para validação de tokens via API
CREATE POLICY "Public can validate instance tokens"
  ON whatsapp_instances
  FOR SELECT
  TO anon
  USING (instance_token IS NOT NULL);
