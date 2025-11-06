import { supabase } from '../lib/supabase';

const API_BASE_URL = 'https://sender.uazapi.com';

async function getAdminToken(): Promise<string> {
  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'whatsapp_admin_token')
    .maybeSingle();

  if (error) throw error;
  return data?.value || '';
}

export interface CreateInstanceResponse {
  name: string;
  connected: boolean;
  loggedIn: boolean;
  info: string;
  token: string;
  instance: {
    id: string;
    name: string;
    token: string;
  };
}

export interface ConnectInstanceResponse {
  success: boolean;
  qrCode?: string;
  pairingCode?: string;
  status?: string;
  message?: string;
}

export interface InstanceStatusResponse {
  success: boolean;
  status: 'disconnected' | 'connecting' | 'connected';
  qrCode?: string;
  pairingCode?: string;
  profile?: {
    name: string;
    phone: string;
    profilePicUrl?: string;
  };
  lastDisconnect?: {
    reason: string;
    timestamp: string;
  };
}

export const whatsappApi = {
  async createInstance(name: string, systemName = 'apilocal'): Promise<CreateInstanceResponse> {
    console.log('Buscando token admin...');
    const adminToken = await getAdminToken();
    console.log('Token encontrado:', adminToken ? 'Sim' : 'Não');

    if (!adminToken) {
      throw new Error('Token de administração não configurado. Configure nas Configurações do painel administrativo.');
    }

    console.log('Fazendo requisição para API:', `${API_BASE_URL}/instance/init`);
    console.log('Payload:', { name, systemName });

    const response = await fetch(`${API_BASE_URL}/instance/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'admintoken': adminToken,
      },
      body: JSON.stringify({ name, systemName }),
    });

    console.log('Status da resposta:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro da API (status):', response.status);
      console.error('Erro da API (texto):', errorText);

      try {
        const errorData = JSON.parse(errorText);
        throw new Error(errorData.message || `Erro ao criar instância: ${response.status}`);
      } catch {
        throw new Error(`Erro ao criar instância: ${response.status} - ${errorText}`);
      }
    }

    const responseText = await response.text();
    console.log('Resposta da API (texto bruto):', responseText);

    let data;
    try {
      data = JSON.parse(responseText);
      console.log('Resposta da API (JSON parseado):', data);
    } catch (parseError) {
      console.error('Erro ao parsear JSON:', parseError);
      throw new Error('Resposta inválida da API: não é um JSON válido');
    }

    // Verificar estrutura da resposta
    if (!data || typeof data !== 'object') {
      throw new Error('Resposta inválida da API: formato inesperado');
    }

    // Verificar se tem o campo token
    if (!data.token) {
      console.error('Resposta sem token:', data);
      throw new Error('API não retornou um token de instância');
    }

    return data;
  },

  async connectInstance(token: string, phone?: string): Promise<ConnectInstanceResponse> {
    console.log('Conectando instância com token:', token);
    console.log('Telefone:', phone || 'Usando QR Code');

    const response = await fetch(`${API_BASE_URL}/instance/connect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': token,
      },
      body: JSON.stringify(phone ? { phone } : {}),
    });

    console.log('Status da resposta de conexão:', response.status);

    const responseText = await response.text();
    console.log('Resposta de conexão (texto):', responseText);

    let data;
    try {
      data = JSON.parse(responseText);
      console.log('Resposta de conexão (JSON):', data);
    } catch (parseError) {
      console.error('Erro ao parsear JSON de conexão:', parseError);
      throw new Error('Resposta inválida da API de conexão');
    }

    if (!response.ok) {
      const errorMessage = data.message || data.error || `Erro ao conectar instância: ${response.status}`;

      if (response.status === 409) {
        console.log('Erro 409: Instância já conectada ou em conexão');
        throw new Error('Instância já está conectada ou em processo de conexão. Tente desconectar primeiro.');
      }

      throw new Error(errorMessage);
    }

    return data;
  },

  async disconnectInstance(token: string): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE_URL}/instance/disconnect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': token,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Erro ao desconectar instância: ${response.status}`);
    }

    return response.json();
  },

  async getInstanceStatus(token: string): Promise<InstanceStatusResponse> {
    const response = await fetch(`${API_BASE_URL}/instance/status`, {
      method: 'GET',
      headers: {
        'token': token,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get instance status');
    }

    return response.json();
  },

  async logoutInstance(token: string): Promise<{ success: boolean }> {
    console.log('Fazendo logout da instância:', token);
    const response = await fetch(`${API_BASE_URL}/instance/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': token,
      },
    });

    console.log('Status do logout:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Erro ao fazer logout: ${response.status}`);
    }

    return response.json();
  },

  async updateInstanceName(token: string, name: string): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE_URL}/instance/updateInstanceName`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': token,
      },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      throw new Error('Failed to update instance name');
    }

    return response.json();
  },

  async deleteInstance(token: string): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE_URL}/instance`, {
      method: 'DELETE',
      headers: {
        'token': token,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to delete instance');
    }

    return response.json();
  },
};
