/*
  # Adicionar Política de Administrador para Instâncias

  1. Mudanças de Segurança
    - Adiciona política SELECT para administradores visualizarem todas as instâncias
    - Mantém as políticas existentes para usuários regulares

  2. Notas
    - Administradores agora podem visualizar todas as instâncias do sistema
    - Usuários regulares continuam vendo apenas suas próprias instâncias
*/

-- Adicionar política para admins verem todas as instâncias
CREATE POLICY "Admins can view all instances"
  ON whatsapp_instances
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
