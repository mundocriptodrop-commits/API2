import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Smartphone, Activity as ActivityIcon, CheckCircle, XCircle } from 'lucide-react';
import type { Database } from '../lib/database.types';

type WhatsAppInstance = Database['public']['Tables']['whatsapp_instances']['Row'];

export default function ClientDashboardTab() {
  const { user, profile } = useAuth();
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadInstances();
    }
  }, [user]);

  async function loadInstances() {
    try {
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('user_id', user?.id || '')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInstances(data || []);
    } catch (error) {
      console.error('Error loading instances:', error);
    } finally {
      setLoading(false);
    }
  }

  const connectedInstances = instances.filter(i => i.status === 'connected').length;
  const disconnectedInstances = instances.filter(i => i.status === 'disconnected').length;
  const connectingInstances = instances.filter(i => i.status === 'connecting').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-lg text-gray-600">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-500 mt-1">Visão geral das suas instâncias</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">Total de Instâncias</p>
              <p className="text-3xl font-bold text-gray-900">{instances.length}</p>
              <p className="text-xs text-gray-400 mt-1">
                de {profile?.max_instances || 0} disponíveis
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">Conectadas</p>
              <p className="text-3xl font-bold text-green-600">{connectedInstances}</p>
              <p className="text-xs text-gray-400 mt-1">instâncias ativas</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">Desconectadas</p>
              <p className="text-3xl font-bold text-gray-600">{disconnectedInstances}</p>
              <p className="text-xs text-gray-400 mt-1">instâncias inativas</p>
            </div>
            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
              <XCircle className="w-6 h-6 text-gray-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">Conectando</p>
              <p className="text-3xl font-bold text-yellow-600">{connectingInstances}</p>
              <p className="text-xs text-gray-400 mt-1">em processo</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <ActivityIcon className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Instâncias Recentes</h3>
        {instances.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Nenhuma instância criada ainda</p>
        ) : (
          <div className="space-y-3">
            {instances.slice(0, 5).map((instance) => (
              <div
                key={instance.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <Smartphone className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{instance.name}</p>
                    <p className="text-sm text-gray-500">
                      {instance.phone_number || 'Sem número configurado'}
                    </p>
                  </div>
                </div>
                <span
                  className={`px-3 py-1 text-xs font-medium rounded-full ${
                    instance.status === 'connected'
                      ? 'bg-green-100 text-green-700'
                      : instance.status === 'connecting'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {instance.status === 'connected'
                    ? 'Conectado'
                    : instance.status === 'connecting'
                    ? 'Conectando'
                    : 'Desconectado'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
