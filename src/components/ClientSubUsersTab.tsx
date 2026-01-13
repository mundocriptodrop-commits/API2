import { useState, useEffect } from 'react';
import { clientSubUsersApi, type SubUser } from '../services/client-sub-users';
import { Plus, Edit2, Trash2, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function ClientSubUsersTab() {
  const { profile } = useAuth();
  const [subUsers, setSubUsers] = useState<SubUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSubUser, setEditingSubUser] = useState<SubUser | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    maxInstances: 1,
  });

  useEffect(() => {
    loadSubUsers();
  }, []);

  async function loadSubUsers() {
    try {
      setLoading(true);
      const data = await clientSubUsersApi.listSubUsers();
      setSubUsers(data.subUsers || []);
    } catch (error: any) {
      console.error('Error loading sub-users:', error);
      alert(error.message || 'Erro ao carregar sub-usuários');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateSubUser() {
    try {
      await clientSubUsersApi.createSubUser(
        formData.email,
        formData.password,
        formData.maxInstances
      );

      alert(`Sub-usuário criado!\nEmail: ${formData.email}\nSenha: ${formData.password}`);
      setShowModal(false);
      setFormData({ email: '', password: '', maxInstances: 1 });
      loadSubUsers();
    } catch (error: any) {
      console.error('Error creating sub-user:', error);
      alert(error.message || 'Erro ao criar sub-usuário');
    }
  }

  async function handleUpdateSubUser() {
    if (!editingSubUser) return;

    try {
      const password = formData.password.trim() !== '' ? formData.password : undefined;
      await clientSubUsersApi.updateSubUser(
        editingSubUser.id,
        formData.maxInstances,
        password
      );

      const message = password
        ? 'Sub-usuário e senha atualizados com sucesso!'
        : 'Sub-usuário atualizado com sucesso!';
      alert(message);
      setShowModal(false);
      setEditingSubUser(null);
      setFormData({ email: '', password: '', maxInstances: 1 });
      loadSubUsers();
    } catch (error: any) {
      console.error('Error updating sub-user:', error);
      alert(error.message || 'Erro ao atualizar sub-usuário');
    }
  }

  async function handleDeleteSubUser(subUserId: string) {
    if (!confirm('Tem certeza que deseja excluir este sub-usuário? Todas as instâncias dele serão removidas.')) return;

    try {
      await clientSubUsersApi.deleteSubUser(subUserId);
      loadSubUsers();
    } catch (error: any) {
      console.error('Error deleting sub-user:', error);
      alert(error.message || 'Erro ao excluir sub-usuário');
    }
  }

  function openCreateModal() {
    setEditingSubUser(null);
    setFormData({ email: '', password: '', maxInstances: 1 });
    setShowModal(true);
  }

  function openEditModal(subUser: SubUser) {
    setEditingSubUser(subUser);
    setFormData({ email: subUser.email, password: '', maxInstances: subUser.max_instances || 1 });
    setShowModal(true);
  }

  // Calcular instâncias disponíveis
  const availableInstances = profile?.max_instances 
    ? profile.max_instances - subUsers.reduce((sum, u) => sum + (u.instances_count || 0), 0)
    : -1;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Carregando sub-usuários...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Sub-usuários</h2>
          <p className="text-gray-500 mt-1">
            Gerencie usuários que compartilham suas instâncias
            {availableInstances >= 0 && (
              <span className="ml-2 text-blue-600 font-medium">
                ({availableInstances} instâncias disponíveis)
              </span>
            )}
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center space-x-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors shadow-md hover:shadow-lg"
        >
          <Plus className="w-5 h-5" />
          <span>Novo Sub-usuário</span>
        </button>
      </div>

      {subUsers.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum sub-usuário</h3>
          <p className="text-gray-500 mb-6">
            Crie sub-usuários para compartilhar suas instâncias com outras pessoas.
          </p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center space-x-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Criar Primeiro Sub-usuário</span>
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Instâncias
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
                {subUsers.map((subUser) => (
                  <tr key={subUser.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {subUser.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                        {subUser.instances_count || 0} instâncias
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {subUser.max_instances || 'Ilimitado'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(subUser.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => openEditModal(subUser)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteSubUser(subUser.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">
                {editingSubUser ? 'Editar Sub-usuário' : 'Novo Sub-usuário'}
              </h3>
            </div>

            <div className="p-6 space-y-4">
              {!editingSubUser && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Senha do usuário"
                    />
                  </div>
                </>
              )}

              {editingSubUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nova Senha (deixe em branco para não alterar)
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Deixe em branco para manter a senha atual"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Preencha apenas se desejar alterar a senha do sub-usuário
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
                  max={availableInstances >= 0 ? availableInstances : undefined}
                  value={formData.maxInstances}
                  onChange={(e) =>
                    setFormData({ ...formData, maxInstances: parseInt(e.target.value) || 1 })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {availableInstances >= 0 && (
                  <p className="mt-1 text-xs text-gray-500">
                    Você tem {availableInstances} instâncias disponíveis
                  </p>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingSubUser(null);
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={editingSubUser ? handleUpdateSubUser : handleCreateSubUser}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors shadow-md hover:shadow-lg"
              >
                {editingSubUser ? 'Atualizar' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
