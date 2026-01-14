import { supabase } from '../lib/supabase';

const CLIENT_SUB_USERS_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/client-sub-users`;

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No session');

  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

export interface SubUser {
  id: string;
  email: string;
  max_instances: number;
  instances_count: number;
  created_at: string;
  updated_at: string;
}

export const clientSubUsersApi = {
  async listSubUsers(): Promise<{ subUsers: SubUser[] }> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${CLIENT_SUB_USERS_FUNCTION_URL}/list`, { headers });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to list sub-users');
    }

    return response.json();
  },

  async createSubUser(
    email: string,
    password: string,
    maxInstances: number,
    companyName: string,
    chatConfig?: { chat_url: string; chat_api_key: string; chat_account_id: number } | null
  ) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${CLIENT_SUB_USERS_FUNCTION_URL}/create`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        email,
        password,
        maxInstances,
        companyName,
        chatConfig: chatConfig || null,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Erro ao criar sub-usuário');
    }

    return data;
  },

  async updateSubUser(userId: string, maxInstances: number, password?: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${CLIENT_SUB_USERS_FUNCTION_URL}/update`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ userId, maxInstances, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to update sub-user');
    }

    return data;
  },

  async deleteSubUser(userId: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${CLIENT_SUB_USERS_FUNCTION_URL}/delete`, {
      method: 'DELETE',
      headers,
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to delete sub-user');
    }

    return response.json();
  },
};
