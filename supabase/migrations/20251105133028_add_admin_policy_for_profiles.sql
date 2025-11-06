/*
  # Adicionar Política de Administrador para Perfis

  1. Mudanças de Segurança
    - Adiciona política SELECT para administradores visualizarem todos os perfis
    - Mantém as políticas existentes para usuários regulares

  2. Notas
    - Administradores agora podem visualizar todos os perfis do sistema
    - Usuários regulares continuam vendo apenas seu próprio perfil
    - Necessário para o painel administrativo exibir informações dos usuários
*/

-- Adicionar política para admins verem todos os perfis
CREATE POLICY "Admins can view all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
    )
  );
