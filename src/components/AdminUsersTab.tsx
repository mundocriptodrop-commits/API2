import { useState, useEffect } from 'react';
import { adminApi } from '../services/admin';
import { supabase } from '../lib/supabase';
import { Plus, Edit2, Trash2, ChevronDown, ChevronRight, Users } from 'lucide-react';
import type { Database } from '../lib/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface ProfileWithSubUsers extends Profile {
  subUsers?: Profile[];
  subUsersCount?: number;
}

export default function AdminUsersTab() {
  const [profiles, setProfiles] = useState<ProfileWithSubUsers[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [subUsersCache, setSubUsersCache] = useState<Map<string, Profile[]>>(new Map());
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    maxInstances: 5,
  });

  useEffect(() => {
    loadProfiles();
  }, []);

  async function loadProfiles() {
    try {
      const data = await adminApi.listUsers();
      // Filtrar apenas usuários principais (sem parent_user_id)
      const mainUsers = (data.profiles || []).filter(p => !p.parent_user_id);
      
      // Buscar contagem de sub-usuários para cada usuário principal
      const usersWithSubCount = await Promise.all(
        mainUsers.map(async (user) => {
          const { count } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('parent_user_id', user.id);
          
          return {
            ...user,
            subUsersCount: count || 0,
          };
        })
      );

      setProfiles(usersWithSubCount);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  }

  async function loadSubUsers(parentUserId: string) {
    // Se já está no cache, não buscar novamente
    if (subUsersCache.has(parentUserId)) {
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('parent_user_id', parentUserId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Adicionar ao cache
      setSubUsersCache(prev => new Map(prev).set(parentUserId, data || []));
      
      // Atualizar profiles com sub-usuários
      setProfiles(prev => prev.map(p => 
        p.id === parentUserId 
          ? { ...p, subUsers: data || [] }
          : p
      ));
    } catch (error) {
    }
  }

  function toggleExpand(userId: string) {
    const newExpanded = new Set(expandedUsers);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
      // Carregar sub-usuários quando expandir
      loadSubUsers(userId);
    }
    setExpandedUsers(newExpanded);
  }

  async function handleCreateUser() {
    try {
      await adminApi.createUser(formData.email, formData.password, formData.maxInstances);

      alert(`Usuário criado!\nEmail: ${formData.email}\nSenha: ${formData.password}`);
      setShowModal(false);
      setFormData({ email: '', password: '', maxInstances: 5 });
      loadProfiles();
    } catch (error: any) {
      alert(error.message || 'Erro ao criar usuário');
    }
  }

  async function handleUpdateProfile() {
    if (!editingProfile) return;

    try {
      // Se a senha foi preenchida, enviar para atualização
      const password = formData.password.trim() !== '' ? formData.password : undefined;
      await adminApi.updateUser(editingProfile.id, formData.maxInstances, password);

      const message = password 
        ? 'Usuário e senha atualizados com sucesso!'
        : 'Usuário atualizado com sucesso!';
      alert(message);
      setShowModal(false);
      setEditingProfile(null);
      setFormData({ email: '', password: '', maxInstances: 5 });
      loadProfiles();
    } catch (error: any) {
      alert(error.message || 'Erro ao atualizar usuário');
    }
  }

  async function handleDeleteProfile(profileId: string) {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return;

    try {
      await adminApi.deleteUser(profileId);
      
      // Limpar cache de sub-usuários se necessário
      const deletedProfile = profiles.find(p => p.id === profileId);
      if (deletedProfile?.parent_user_id) {
        // Se deletou um sub-usuário, limpar cache do pai
        setSubUsersCache(prev => {
          const newCache = new Map(prev);
          newCache.delete(deletedProfile.parent_user_id!);
          return newCache;
        });
      } else {
        // Se deletou um usuário principal, limpar seu cache
        setSubUsersCache(prev => {
          const newCache = new Map(prev);
          newCache.delete(profileId);
          return newCache;
        });
      }

      loadProfiles();
    } catch (error) {
      alert('Erro ao excluir usuário');
    }
  }

  function openCreateModal() {
    setEditingProfile(null);
    setFormData({ email: '', password: '', maxInstances: 5 });
    setShowModal(true);
  }

  function openEditModal(profile: Profile) {
    setEditingProfile(profile);
    setFormData({ email: profile.email, password: '', maxInstances: profile.max_instances || 5 });
    setShowModal(true);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Carregando usuários...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Usuários</h2>
          <p className="text-gray-500 mt-1">Gerencie os usuários do sistema</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center space-x-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors shadow-md hover:shadow-lg"
        >
          <Plus className="w-5 h-5" />
          <span>Novo Usuário</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Max. Instâncias
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Criado em
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {profiles.map((profile) => {
                const isExpanded = expandedUsers.has(profile.id);
                const subUsers = profile.subUsers || subUsersCache.get(profile.id) || [];
                const subUsersCount = profile.subUsersCount ?? subUsers.length;
                const hasSubUsers = subUsersCount > 0;
                
                return (
                  <>
                    <tr key={profile.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center space-x-2">
                          {profile.role === 'client' && (
                            <button
                              onClick={() => toggleExpand(profile.id)}
                              className="p-1 hover:bg-gray-100 rounded transition-colors"
                              title={hasSubUsers ? `${subUsers.length} sub-usuário(s)` : 'Sem sub-usuários'}
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-gray-500" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-gray-500" />
                              )}
                            </button>
                          )}
                          <span>{profile.email}</span>
                          {hasSubUsers && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                              <Users className="w-3 h-3" />
                              {subUsersCount}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            profile.role === 'admin'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {profile.role === 'admin' ? 'Administrador' : 'Cliente'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {profile.max_instances || 'Ilimitado'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(profile.created_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        {profile.role === 'client' && (
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={() => openEditModal(profile)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteProfile(profile.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                    
                    {/* Linhas dos sub-usuários */}
                    {isExpanded && hasSubUsers && subUsers.map((subUser) => (
                      <tr key={subUser.id} className="bg-gray-50 hover:bg-gray-100 transition-colors">
                        <td className="px-6 py-3 text-sm text-gray-600">
                          <div className="flex items-center space-x-2 pl-8">
                            <span className="w-4 h-4 border-l-2 border-b-2 border-gray-300"></span>
                            <span className="text-xs text-gray-500">└─</span>
                            <span>{subUser.email}</span>
                            <span className="px-2 py-0.5 text-xs font-medium bg-gray-200 text-gray-600 rounded-full">
                              Sub-usuário
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-200 text-gray-600">
                            Sub-usuário
                          </span>
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600">
                          {subUser.max_instances || 'Ilimitado'}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">
                          {new Date(subUser.created_at).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-right text-sm">
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={() => openEditModal(subUser)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Editar sub-usuário"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteProfile(subUser.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Excluir sub-usuário"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    
                    {isExpanded && !hasSubUsers && (
                      <tr className="bg-gray-50">
                        <td colSpan={5} className="px-6 py-3 text-sm text-gray-500 italic pl-12">
                          Nenhum sub-usuário cadastrado
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">
                {editingProfile ? 'Editar Usuário' : 'Novo Usuário'}
              </h3>
            </div>

            <div className="p-6 space-y-4">
              {!editingProfile && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="usuario@email.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Senha
                    </label>
                    <input
                      type="text"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Senha do usuário"
                    />
                  </div>
                </>
              )}

              {editingProfile && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nova Senha (deixe em branco para não alterar)
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Deixe em branco para manter a senha atual"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Preencha apenas se desejar alterar a senha do usuário
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Máximo de Instâncias
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.maxInstances}
                  onChange={(e) =>
                    setFormData({ ...formData, maxInstances: parseInt(e.target.value) })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingProfile(null);
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={editingProfile ? handleUpdateProfile : handleCreateUser}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors shadow-md hover:shadow-lg"
              >
                {editingProfile ? 'Atualizar' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
