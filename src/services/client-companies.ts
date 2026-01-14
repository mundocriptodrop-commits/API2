import { supabase } from '../lib/supabase';

const CLIENT_COMPANIES_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/client-companies`;

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No session');

  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

export interface Company {
  id: string;
  name: string;
  owner_id: string;
  max_instances: number;
  users_count: number;
  instances_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompanyUser {
  id: string;
  email: string;
  max_instances: number;
  instances_count: number;
  created_at: string;
}

export const clientCompaniesApi = {
  async listCompanies(): Promise<{ companies: Company[] }> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${CLIENT_COMPANIES_FUNCTION_URL}/list`, { headers });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Erro ao carregar empresas');
    }

    return response.json();
  },

  async createCompany(name: string, maxInstances: number) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${CLIENT_COMPANIES_FUNCTION_URL}/create`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name, maxInstances }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Erro ao criar empresa');
    }

    return data;
  },

  async updateCompany(companyId: string, name: string, maxInstances: number) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${CLIENT_COMPANIES_FUNCTION_URL}/update`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ companyId, name, maxInstances }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Erro ao atualizar empresa');
    }

    return data;
  },

  async deleteCompany(companyId: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${CLIENT_COMPANIES_FUNCTION_URL}/delete`, {
      method: 'DELETE',
      headers,
      body: JSON.stringify({ companyId }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Erro ao excluir empresa');
    }

    return response.json();
  },

  async listCompanyUsers(companyId: string): Promise<{ users: CompanyUser[] }> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${CLIENT_COMPANIES_FUNCTION_URL}/users/${companyId}`, { headers });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Erro ao carregar usuários da empresa');
    }

    return response.json();
  },

  async addUserToCompany(
    companyId: string,
    email: string,
    password: string,
    maxInstances: number
  ) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${CLIENT_COMPANIES_FUNCTION_URL}/users/add`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ companyId, email, password, maxInstances }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Erro ao adicionar usuário à empresa');
    }

    return data;
  },

  async updateCompanyUser(userId: string, maxInstances: number, password?: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${CLIENT_COMPANIES_FUNCTION_URL}/users/update`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ userId, maxInstances, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Erro ao atualizar usuário');
    }

    return data;
  },

  async removeUserFromCompany(userId: string) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${CLIENT_COMPANIES_FUNCTION_URL}/users/remove`, {
      method: 'DELETE',
      headers,
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Erro ao remover usuário da empresa');
    }

    return response.json();
  },
};
