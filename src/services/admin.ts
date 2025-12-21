import { supabase } from '../lib/supabase';

const ADMIN_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`;

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No session');

  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

export const adminApi = {
  async listUsers() {
    const headers = await getAuthHeaders();
    const response = await fetch(`${ADMIN_FUNCTION_URL}/list`, { headers });

    if (!response.ok) {
      throw new Error('Failed to list users');
    }

    return response.json();
  },

  async createUser(email: string, password: string, maxInstances: number) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${ADMIN_FUNCTION_URL}/create`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email, password, maxInstances }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Erro ao criar usuário');
    }

    return data;
  },

  async updateUser(userId: string, maxInstances: number, password?: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${ADMIN_FUNCTION_URL}/update`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ userId, maxInstances, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to update user');
    }

    return data;
  },

  async deleteUser(userId: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${ADMIN_FUNCTION_URL}/delete`, {
      method: 'DELETE',
      headers,
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      throw new Error('Failed to delete user');
    }

    return response.json();
  },
};
