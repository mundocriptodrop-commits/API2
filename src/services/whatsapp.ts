import { supabase } from '../lib/supabase';

const API_BASE_URL = 'https://api.evasend.com.br/whatsapp';
const UAZAPI_BASE_URL = 'https://sender.uazapi.com';

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
  instance?: {
    id?: string;
    token?: string;
    status?: string;
    paircode?: string;
    qrcode?: string;
    name?: string;
    profileName?: string;
    profilePicUrl?: string;
    owner?: string;
    [key: string]: unknown;
  };
  status?: {
    connected?: boolean;
    jid?: string;
    loggedIn?: boolean;
    [key: string]: unknown;
  };
  // Compatibilidade com formato antigo
  success?: boolean;
  qrCode?: string;
  pairingCode?: string;
  profile?: {
    name: string;
    phone: string;
    profilePicUrl?: string;
  };
}

export const whatsappApi = {
  async createInstance(name: string, systemName = 'apilocal'): Promise<CreateInstanceResponse> {
    const adminToken = await getAdminToken();

    if (!adminToken) {
      throw new Error('Token de administração não configurado. Configure nas Configurações do painel administrativo.');
    }

    const response = await fetch(`${UAZAPI_BASE_URL}/instance/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'admintoken': adminToken,
      },
      body: JSON.stringify({ name, systemName }),
    });

    if (!response.ok) {
      const errorText = await response.text();

      try {
        const errorData = JSON.parse(errorText);
        throw new Error(errorData.message || `Erro ao criar instância: ${response.status}`);
      } catch {
        throw new Error(`Erro ao criar instância: ${response.status} - ${errorText}`);
      }
    }

    const responseText = await response.text();

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      throw new Error('Resposta inválida da API: não é um JSON válido');
    }

    // Verificar estrutura da resposta
    if (!data || typeof data !== 'object') {
      throw new Error('Resposta inválida da API: formato inesperado');
    }

    // Verificar se tem o campo token
    if (!data.token) {
      throw new Error('API não retornou um token de instância');
    }

    return data;
  },

  async connectInstance(token: string, phone?: string): Promise<ConnectInstanceResponse> {
    const response = await fetch(`${UAZAPI_BASE_URL}/instance/connect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': token,
      },
      body: JSON.stringify(phone ? { phone } : {}),
    });

    const responseText = await response.text();

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      throw new Error('Resposta inválida da API de conexão');
    }

    if (!response.ok) {
      const errorMessage = data.message || data.error || `Erro ao conectar instância: ${response.status}`;

      if (response.status === 409) {
        throw new Error('Instância já está conectada ou em processo de conexão. Tente desconectar primeiro.');
      }

      throw new Error(errorMessage);
    }

    return data;
  },

  async disconnectInstance(token: string): Promise<{ success: boolean }> {
    const response = await fetch(`${UAZAPI_BASE_URL}/instance/disconnect`, {
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
    const response = await fetch(`${UAZAPI_BASE_URL}/instance/status`, {
      method: 'GET',
      headers: {
        'token': token,
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      let errorMessage = 'Failed to get instance status';
      
      if (response.status === 401) {
        errorMessage = 'Token inválido ou expirado';
      } else if (response.status === 404) {
        errorMessage = 'Instância não encontrada';
      } else if (response.status === 500) {
        errorMessage = 'Erro interno do servidor';
      }
      
      const error: any = new Error(errorMessage);
      error.status = response.status;
      error.details = errorText;
      throw error;
    }

    return response.json();
  },

  async logoutInstance(token: string): Promise<{ success: boolean }> {
    const response = await fetch(`${UAZAPI_BASE_URL}/instance/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': token,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Erro ao fazer logout: ${response.status}`);
    }

    return response.json();
  },

  async updateInstanceName(token: string, name: string): Promise<{ success: boolean }> {
    const response = await fetch(`${UAZAPI_BASE_URL}/instance/updateInstanceName`, {
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
    const response = await fetch(`${UAZAPI_BASE_URL}/instance`, {
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
