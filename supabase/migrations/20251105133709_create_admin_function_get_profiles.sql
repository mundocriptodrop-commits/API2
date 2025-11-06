/*
  # Criar Função para Admins Acessarem Perfis

  1. Nova Função
    - `get_all_profiles()` - Retorna todos os perfis para admins
    - Verifica se o usuário é admin antes de retornar dados
    - Executa com SECURITY DEFINER para bypass RLS

  2. Segurança
    - Apenas admins autenticados podem executar
    - Função segura que valida permissões internamente
    - Não causa recursão pois usa SECURITY DEFINER
*/

-- Criar função para admins obterem todos os perfis
CREATE OR REPLACE FUNCTION get_all_profiles()
RETURNS SETOF profiles
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_role text;
BEGIN
  -- Obter role do usuário atual
  SELECT role INTO user_role
  FROM profiles
  WHERE id = auth.uid();

  -- Verificar se é admin
  IF user_role != 'admin' THEN
    RAISE EXCEPTION 'Access denied: Only admins can view all profiles';
  END IF;

  -- Retornar todos os perfis
  RETURN QUERY
  SELECT * FROM profiles;
END;
$$;

-- Conceder permissão para usuários autenticados executarem a função
GRANT EXECUTE ON FUNCTION get_all_profiles() TO authenticated;
