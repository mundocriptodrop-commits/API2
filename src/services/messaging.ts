const MESSAGING_API_URL = 'https://api.evasend.com.br/whatsapp';

export interface SendMessageRequest {
  number: string;
  text: string;
}

export interface SendMessageResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export const messagingApi = {
  async sendText(token: string, number: string, text: string): Promise<SendMessageResponse> {
    try {
      const response = await fetch(`${MESSAGING_API_URL}/send-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'token': token,
        },
        body: JSON.stringify({
          number,
          text,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro ao enviar mensagem: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      throw error;
    }
  },
};
