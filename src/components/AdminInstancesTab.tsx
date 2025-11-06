import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Smartphone, User, Calendar, Activity, ChevronDown, ChevronUp } from 'lucide-react';
import type { Database } from '../lib/database.types';

type WhatsAppInstance = Database['public']['Tables']['whatsapp_instances']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

interface InstanceWithUser extends WhatsAppInstance {
  user?: Profile;
}

export default function AdminInstancesTab() {
  const [instances, setInstances] = useState<InstanceWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterUser, setFilterUser] = useState<string>('all');
  const [users, setUsers] = useState<Profile[]>([]);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [instancesResult, usersResult] = await Promise.all([
        supabase
          .from('whatsapp_instances')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase.rpc('get_all_profiles'),
      ]);

      if (instancesResult.error) throw instancesResult.error;
      if (usersResult.error) throw usersResult.error;

      // Mapear usuários para as instâncias
      const usersMap = new Map(
        (usersResult.data || []).map((u: any) => [u.id, u])
      );

      const instancesWithUsers = (instancesResult.data || []).map((instance) => ({
        ...instance,
        user: usersMap.get(instance.user_id) || null,
      }));

      setInstances(instancesWithUsers);
      setUsers((usersResult.data || []).filter((u: any) => u.role === 'client'));
    } catch (error) {
      console.error('Error loading instances:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredInstances =
    filterUser === 'all'
      ? instances
      : instances.filter((i) => i.user_id === filterUser);

  const getStatusBadge = (status: string) => {
    const badges = {
      connected: 'bg-green-100 text-green-700',
      connecting: 'bg-yellow-100 text-yellow-700',
      disconnected: 'bg-gray-100 text-gray-700',
    };
    const labels = {
      connected: 'Conectada',
      connecting: 'Conectando',
      disconnected: 'Desconectada',
    };
    return {
      className: badges[status as keyof typeof badges] || badges.disconnected,
      label: labels[status as keyof typeof labels] || status,
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Carregando instâncias...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Instâncias WhatsApp</h2>
          <p className="text-gray-500 mt-1">Visualize todas as instâncias por usuário</p>
        </div>

        <div>
          <select
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value="all">Todos os usuários</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.email}
              </option>
            ))}
          </select>
        </div>
      </div>

      {(() => {
        const filteredUsers = filterUser === 'all' ? users : users.filter((u) => u.id === filterUser);

        if (filteredUsers.length === 0) {
          return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <User className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500">Nenhum usuário encontrado</p>
            </div>
          );
        }

        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {filteredUsers.map((user) => {
          const userInstances = instances.filter((i) => i.user_id === user.id);
          const connectedCount = userInstances.filter((i) => i.status === 'connected').length;
          const disconnectedCount = userInstances.filter((i) => i.status === 'disconnected').length;
          const isExpanded = expandedUsers.has(user.id);

          const toggleExpand = () => {
            const newExpanded = new Set(expandedUsers);
            if (isExpanded) {
              newExpanded.delete(user.id);
            } else {
              newExpanded.add(user.id);
            }
            setExpandedUsers(newExpanded);
          };

          return (
            <div key={user.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{user.email}</p>
                    <p className="text-xs text-gray-500">
                      {userInstances.length} {userInstances.length === 1 ? 'instância' : 'instâncias'}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-gray-600">Conectadas</span>
                    </div>
                    <span className="font-medium text-gray-900">{connectedCount}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                      <span className="text-gray-600">Desconectadas</span>
                    </div>
                    <span className="font-medium text-gray-900">{disconnectedCount}</span>
                  </div>
                </div>
              </div>

              {userInstances.length > 0 && (
                <>
                  <button
                    onClick={toggleExpand}
                    className="w-full px-6 py-3 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between text-sm font-medium text-gray-700"
                  >
                    <span>Ver instâncias</span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-200 bg-gray-50">
                      <div className="p-4 space-y-2">
                        {userInstances.map((instance) => {
                          const statusColor =
                            instance.status === 'connected'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800';

                          return (
                            <div
                              key={instance.id}
                              className="bg-white rounded-lg p-3 border border-gray-200"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center space-x-2">
                                  <Smartphone className="w-4 h-4 text-gray-400" />
                                  <span className="text-sm font-medium text-gray-900">
                                    {instance.name}
                                  </span>
                                </div>
                                <span
                                  className={`px-2 py-1 text-xs font-medium rounded-full ${statusColor}`}
                                >
                                  {instance.status === 'connected' ? 'Conectada' : 'Desconectada'}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 truncate">
                                {instance.instance_token}
                              </p>
                              {instance.phone_number && (
                                <p className="text-xs text-gray-600 mt-1">
                                  📱 {instance.phone_number}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
          </div>
        );
      })()}
    </div>
  );
}
