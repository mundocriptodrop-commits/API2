import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { User, Mail, Key, Shield, Bell, MessageSquare, Save } from 'lucide-react';
import ToastContainer, { type ToastMessage } from './ToastContainer';

export default function ClientSettingsTab() {
  const { user, profile } = useAuth();
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [notifications, setNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [chatUrl, setChatUrl] = useState('');
  const [loadingChatUrl, setLoadingChatUrl] = useState(true);
  const [savingChatUrl, setSavingChatUrl] = useState(false);
  const [chatApiKey, setChatApiKey] = useState('');
  const [loadingChatApiKey, setLoadingChatApiKey] = useState(true);
  const [savingChatApiKey, setSavingChatApiKey] = useState(false);
  const [chatAccountId, setChatAccountId] = useState('');
  const [loadingChatAccountId, setLoadingChatAccountId] = useState(true);
  const [savingChatAccountId, setSavingChatAccountId] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' | 'warning') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  useEffect(() => {
    if (user?.id) {
      loadChatUrl();
      loadChatApiKey();
      loadChatAccountId();
    }
  }, [user?.id]);

  async function loadChatUrl() {
    try {
      setLoadingChatUrl(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('chat_url')
        .eq('id', user?.id)
        .maybeSingle();

      if (error) throw error;
      setChatUrl(data?.chat_url || '');
    } catch (error) {
      console.error('Error loading chat URL:', error);
      showToast('Erro ao carregar URL do Chat', 'error');
    } finally {
      setLoadingChatUrl(false);
    }
  }

  async function loadChatApiKey() {
    try {
      setLoadingChatApiKey(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('chat_api_key')
        .eq('id', user?.id)
        .maybeSingle();

      if (error) throw error;
      setChatApiKey(data?.chat_api_key || '');
    } catch (error) {
      console.error('Error loading chat API key:', error);
      showToast('Erro ao carregar API Key do Chat', 'error');
    } finally {
      setLoadingChatApiKey(false);
    }
  }

  async function loadChatAccountId() {
    try {
      setLoadingChatAccountId(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('chat_account_id')
        .eq('id', user?.id)
        .maybeSingle();

      if (error) throw error;
      setChatAccountId(data?.chat_account_id?.toString() || '');
    } catch (error) {
      console.error('Error loading chat account ID:', error);
      showToast('Erro ao carregar Account ID do Chat', 'error');
    } finally {
      setLoadingChatAccountId(false);
    }
  }

  async function handleSaveChatUrl() {
    if (!user?.id) return;

    setSavingChatUrl(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ chat_url: chatUrl.trim() || null })
        .eq('id', user.id);

      if (error) throw error;
      showToast('URL do Chat salva com sucesso!', 'success');
    } catch (error: any) {
      console.error('Error saving chat URL:', error);
      showToast(error.message || 'Erro ao salvar URL do Chat', 'error');
    } finally {
      setSavingChatUrl(false);
    }
  }

  async function handleSaveChatApiKey() {
    if (!user?.id) return;

    setSavingChatApiKey(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ chat_api_key: chatApiKey.trim() || null })
        .eq('id', user.id);

      if (error) throw error;
      showToast('API Key do Chat salva com sucesso!', 'success');
    } catch (error: any) {
      console.error('Error saving chat API key:', error);
      showToast(error.message || 'Erro ao salvar API Key do Chat', 'error');
    } finally {
      setSavingChatApiKey(false);
    }
  }

  async function handleSaveChatAccountId() {
    if (!user?.id) return;

    setSavingChatAccountId(true);
    try {
      const accountId = chatAccountId.trim() ? parseInt(chatAccountId.trim(), 10) : null;
      if (chatAccountId.trim() && isNaN(accountId!)) {
        showToast('Account ID deve ser um número válido', 'error');
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({ chat_account_id: accountId })
        .eq('id', user.id);

      if (error) throw error;
      showToast('Account ID do Chat salvo com sucesso!', 'success');
    } catch (error: any) {
      console.error('Error saving chat account ID:', error);
      showToast(error.message || 'Erro ao salvar Account ID do Chat', 'error');
    } finally {
      setSavingChatAccountId(false);
    }
  }

  const handleSaveNotifications = () => {
    showToast('Configurações de notificações salvas com sucesso!', 'success');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Configurações</h2>
        <p className="text-gray-500 mt-1">Gerencie suas preferências e informações da conta</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
            <User className="w-5 h-5" />
            <span>Informações da Conta</span>
          </h3>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <div className="flex items-center space-x-2 px-4 py-3 bg-gray-50 rounded-lg border border-gray-200">
              <Mail className="w-5 h-5 text-gray-400" />
              <span className="text-gray-900">{user?.email}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Plano
            </label>
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center space-x-2">
                <Shield className="w-5 h-5 text-gray-400" />
                <span className="text-gray-900">
                  {profile?.role === 'admin' ? 'Administrador' : 'Cliente'}
                </span>
              </div>
              <span className="text-sm text-gray-500">
                Até {profile?.max_instances || 0} instâncias
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ID do Usuário
            </label>
            <div className="px-4 py-3 bg-gray-50 rounded-lg border border-gray-200">
              <code className="text-xs text-gray-600 break-all">{user?.id}</code>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
            <Bell className="w-5 h-5" />
            <span>Notificações</span>
          </h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Notificações do Sistema</p>
              <p className="text-sm text-gray-500">
                Receba notificações sobre suas instâncias
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={notifications}
                onChange={(e) => setNotifications(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Notificações Rápidas</p>
              <p className="text-sm text-gray-500">
                Receba alertas importantes por email
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={emailNotifications}
                onChange={(e) => setEmailNotifications(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
            </label>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <button
              onClick={handleSaveNotifications}
              className="w-full px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors shadow-md hover:shadow-lg"
            >
              Salvar Preferências
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
            <MessageSquare className="w-5 h-5" />
            <span>Integrações</span>
          </h3>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              URL do Chat
            </label>
            <input
              type="url"
              value={chatUrl}
              onChange={(e) => setChatUrl(e.target.value)}
              placeholder="https://chat.exemplo.com.br"
              disabled={loadingChatUrl || savingChatUrl}
              className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-2">
              URL base do sistema de Chat para integrações futuras
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              API Key do Chat
            </label>
            <input
              type="password"
              value={chatApiKey}
              onChange={(e) => setChatApiKey(e.target.value)}
              placeholder="pxTv3AJcUwZUSxCS6c8q4JMN"
              disabled={loadingChatApiKey || savingChatApiKey}
              className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-2">
              API Key do sistema de Chat para autenticação nas integrações
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Account ID do Chat
            </label>
            <input
              type="number"
              value={chatAccountId}
              onChange={(e) => setChatAccountId(e.target.value)}
              placeholder="1"
              disabled={loadingChatAccountId || savingChatAccountId}
              className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-2">
              ID numérico da conta no sistema de Chat (visível na URL da conta)
            </p>
          </div>

          <div className="pt-4 border-t border-gray-200 space-y-3">
            <button
              onClick={handleSaveChatUrl}
              disabled={loadingChatUrl || savingChatUrl}
              className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {savingChatUrl ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Salvar URL do Chat</span>
                </>
              )}
            </button>

            <button
              onClick={handleSaveChatApiKey}
              disabled={loadingChatApiKey || savingChatApiKey}
              className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {savingChatApiKey ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Salvar API Key do Chat</span>
                </>
              )}
            </button>

            <button
              onClick={handleSaveChatAccountId}
              disabled={loadingChatAccountId || savingChatAccountId}
              className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {savingChatAccountId ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Salvar Account ID do Chat</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
            <Key className="w-5 h-5" />
            <span>Segurança</span>
          </h3>
        </div>
        <div className="p-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-800">
              Para alterar sua senha ou configurações de segurança, entre em contato com o suporte.
            </p>
          </div>
          <button
            disabled
            className="w-full px-4 py-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed"
          >
            Alterar Senha (Em breve)
          </button>
        </div>
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
