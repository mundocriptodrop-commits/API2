import { Users, Smartphone, Activity, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function AdminDashboardTab() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalInstances: 0,
    connectedInstances: 0,
    connectingInstances: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const [usersResult, instancesResult] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('whatsapp_instances').select('*'),
      ]);

      const instances = instancesResult.data || [];

      setStats({
        totalUsers: usersResult.count || 0,
        totalInstances: instances.length,
        connectedInstances: instances.filter((i) => i.status === 'connected').length,
        connectingInstances: instances.filter((i) => i.status === 'connecting').length,
      });
    } catch (error) {
    }
  }

  const cards = [
    {
      title: 'Total de Usuários',
      value: stats.totalUsers,
      icon: Users,
      color: 'blue',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
    },
    {
      title: 'Total de Instâncias',
      value: stats.totalInstances,
      icon: Smartphone,
      color: 'green',
      bgColor: 'bg-green-50',
      textColor: 'text-green-600',
    },
    {
      title: 'Instâncias Conectadas',
      value: stats.connectedInstances,
      icon: Activity,
      color: 'emerald',
      bgColor: 'bg-emerald-50',
      textColor: 'text-emerald-600',
    },
    {
      title: 'Conectando',
      value: stats.connectingInstances,
      icon: TrendingUp,
      color: 'orange',
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-600',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-500 mt-1">Visão geral do sistema</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{card.title}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{card.value}</p>
                </div>
                <div className={`${card.bgColor} p-3 rounded-lg`}>
                  <Icon className={`w-6 h-6 ${card.textColor}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Atividade Recente</h3>
        <p className="text-gray-500 text-sm">Nenhuma atividade recente para exibir.</p>
      </div>
    </div>
  );
}
