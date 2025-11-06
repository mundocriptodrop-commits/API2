import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Key, Save } from 'lucide-react';

export default function AdminSettingsTab() {
  const [whatsappToken, setWhatsappToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'whatsapp_admin_token')
        .maybeSingle();

      if (error) throw error;
      setWhatsappToken(data?.value || '');
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveSettings() {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('system_settings')
        .update({ value: whatsappToken })
        .eq('key', 'whatsapp_admin_token');

      if (error) throw error;

      alert('Configurações salvas com sucesso!');
    } catch (error: any) {
      console.error('Error saving settings:', error);
      alert(error.message || 'Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Carregando configurações...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Configurações</h2>
        <p className="text-gray-500 mt-1">Configure as integrações do sistema</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <Key className="w-5 h-5 text-green-500" />
            <h3 className="text-lg font-semibold text-gray-900">API WhatsApp</h3>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Configure o token de administração da API uazapi.com
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Token Admin WhatsApp
            </label>
            <input
              type="password"
              value={whatsappToken}
              onChange={(e) => setWhatsappToken(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm"
              placeholder="Cole o token admin da API aqui"
            />
            <p className="text-xs text-gray-500 mt-2">
              Este token é usado para criar e gerenciar instâncias do WhatsApp através da API
              uazapi.com
            </p>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="flex items-center space-x-2 bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg transition-colors shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-5 h-5" />
              <span>{saving ? 'Salvando...' : 'Salvar Configurações'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">Informações Importantes</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• O token é armazenado de forma segura no banco de dados</li>
          <li>• Apenas administradores têm acesso a estas configurações</li>
          <li>• Alterações entram em vigor imediatamente</li>
        </ul>
      </div>
    </div>
  );
}
