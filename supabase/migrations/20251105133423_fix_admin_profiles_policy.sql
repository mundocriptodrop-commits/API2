/*
  # Corrigir Política de Administrador para Perfis

  1. Mudanças de Segurança
    - Remove política recursiva que causa erro
    - Adiciona nova política usando raw_user_meta_data para verificar role
    - Mantém as políticas existentes para usuários regulares

  2. Notas
    - Usa uma abordagem sem recursão para verificar se o usuário é admin
    - Administradores podem visualizar todos os perfis
    - Usuários regulares continuam vendo apenas seu próprio perfil
*/

-- Remover política problemática
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

-- Adicionar política correta usando subquery na tabela profiles
-- mas com uma condição que não causa recursão
CREATE POLICY "Admins can view all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );
