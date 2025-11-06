/*
  # Corrigir Políticas de Perfis - Eliminar Recursão

  1. Mudanças de Segurança
    - Remove TODAS as políticas que causam recursão
    - Cria políticas simples sem subqueries na própria tabela
    - Simplifica acesso: usuários veem apenas seu próprio perfil

  2. Notas Importantes
    - A verificação de admin será feita na aplicação, não no banco
    - Evita completamente o problema de recursão infinita
    - Mantém segurança: cada usuário acessa apenas seus dados
*/

-- Remover TODAS as políticas existentes de profiles
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

-- Política simples: usuários podem ver seu próprio perfil
CREATE POLICY "Users can view own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Política simples: usuários podem inserir seu próprio perfil
CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Política simples: usuários podem atualizar seu próprio perfil
CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
