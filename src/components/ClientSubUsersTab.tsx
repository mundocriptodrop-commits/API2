import { useState, useEffect } from 'react';
import { clientCompaniesApi, type Company, type CompanyUser } from '../services/client-companies';
import { Plus, Edit2, Trash2, Building2, Users, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function ClientSubUsersTab() {
  const { profile } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([]);
  const [editingUser, setEditingUser] = useState<CompanyUser | null>(null);
  const [companyFormData, setCompanyFormData] = useState({
    name: '',
    maxInstances: 1,
    createUser: false,
    userEmail: '',
    userPassword: '',
    userMaxInstances: 1,
  });
  const [userFormData, setUserFormData] = useState({
    email: '',
    password: '',
    maxInstances: 1,
  });

  useEffect(() => {
    loadCompanies();
  }, []);

  async function loadCompanies() {
    try {
      setLoading(true);
      const data = await clientCompaniesApi.listCompanies();
      setCompanies(data.companies || []);
    } catch (error: any) {
      alert(error.message || 'Erro ao carregar empresas');
    } finally {
      setLoading(false);
    }
  }

  async function loadCompanyUsers(companyId: string) {
    try {
      const data = await clientCompaniesApi.listCompanyUsers(companyId);
      setCompanyUsers(data.users || []);
    } catch (error: any) {
      alert(error.message || 'Erro ao carregar usuários da empresa');
    }
  }

  async function handleCreateCompany() {
    try {
      const company = await clientCompaniesApi.createCompany(
        companyFormData.name,
        companyFormData.maxInstances
      );

      if (companyFormData.createUser) {
        if (!companyFormData.userEmail.trim() || !companyFormData.userPassword.trim()) {
          alert('Por favor, preencha email e senha do usuário ou desmarque a opção de criar usuário.');
          return;
        }

        try {
          await clientCompaniesApi.addUserToCompany(
            company.company.id,
            companyFormData.userEmail,
            companyFormData.userPassword,
            companyFormData.userMaxInstances
          );

          alert(`Empresa e usuário criados com sucesso!\n\nUsuário:\nEmail: ${companyFormData.userEmail}\nSenha: ${companyFormData.userPassword}`);
        } catch (userError: any) {
          alert(`Empresa criada, mas erro ao criar usuário: ${userError.message}`);
        }
      } else {
        alert('Empresa criada com sucesso!');
      }

      setShowCompanyModal(false);
      setCompanyFormData({
        name: '',
        maxInstances: 1,
        createUser: false,
        userEmail: '',
        userPassword: '',
        userMaxInstances: 1
      });
      loadCompanies();
    } catch (error: any) {
      alert(error.message || 'Erro ao criar empresa');
    }
  }

  async function handleUpdateCompany() {
    if (!editingCompany) return;

    try {
      await clientCompaniesApi.updateCompany(
        editingCompany.id,
        companyFormData.name,
        companyFormData.maxInstances
      );

      alert('Empresa atualizada com sucesso!');
      setShowCompanyModal(false);
      setEditingCompany(null);
      setCompanyFormData({ name: '', maxInstances: 1 });
      loadCompanies();
    } catch (error: any) {
      alert(error.message || 'Erro ao atualizar empresa');
    }
  }

  async function handleDeleteCompany(companyId: string) {
    if (!confirm('Tem certeza que deseja excluir esta empresa? Todos os usuários e instâncias serão removidos.')) return;

    try {
      await clientCompaniesApi.deleteCompany(companyId);
      loadCompanies();
    } catch (error: any) {
      alert(error.message || 'Erro ao excluir empresa');
    }
  }

  async function handleAddUser() {
    if (!selectedCompany) return;

    try {
      await clientCompaniesApi.addUserToCompany(
        selectedCompany.id,
        userFormData.email,
        userFormData.password,
        userFormData.maxInstances
      );

      alert(`Usuário adicionado!\nEmail: ${userFormData.email}\nSenha: ${userFormData.password}`);
      setShowUserModal(false);
      setUserFormData({ email: '', password: '', maxInstances: 1 });
      loadCompanyUsers(selectedCompany.id);
      loadCompanies();
    } catch (error: any) {
      alert(error.message || 'Erro ao adicionar usuário');
    }
  }

  async function handleUpdateUser() {
    if (!editingUser || !selectedCompany) return;

    try {
      const password = userFormData.password.trim() !== '' ? userFormData.password : undefined;
      await clientCompaniesApi.updateCompanyUser(
        editingUser.id,
        userFormData.maxInstances,
        password
      );

      const message = password
        ? 'Usuário e senha atualizados com sucesso!'
        : 'Usuário atualizado com sucesso!';
      alert(message);
      setShowUserModal(false);
      setEditingUser(null);
      setUserFormData({ email: '', password: '', maxInstances: 1 });
      loadCompanyUsers(selectedCompany.id);
      loadCompanies();
    } catch (error: any) {
      alert(error.message || 'Erro ao atualizar usuário');
    }
  }

  async function handleRemoveUser(userId: string) {
    if (!confirm('Tem certeza que deseja remover este usuário? Todas as instâncias dele serão removidas.')) return;

    try {
      await clientCompaniesApi.removeUserFromCompany(userId);
      if (selectedCompany) {
        loadCompanyUsers(selectedCompany.id);
        loadCompanies();
      }
    } catch (error: any) {
      alert(error.message || 'Erro ao remover usuário');
    }
  }

  function openCreateCompanyModal() {
    setEditingCompany(null);
    setCompanyFormData({
      name: '',
      maxInstances: 1,
      createUser: false,
      userEmail: '',
      userPassword: '',
      userMaxInstances: 1
    });
    setShowCompanyModal(true);
  }

  function openEditCompanyModal(company: Company) {
    setEditingCompany(company);
    setCompanyFormData({
      name: company.name,
      maxInstances: company.max_instances,
      createUser: false,
      userEmail: '',
      userPassword: '',
      userMaxInstances: 1
    });
    setShowCompanyModal(true);
  }

  function openAddUserModal() {
    setEditingUser(null);
    setUserFormData({ email: '', password: '', maxInstances: 1 });
    setShowUserModal(true);
  }

  function openEditUserModal(user: CompanyUser) {
    setEditingUser(user);
    setUserFormData({ email: user.email, password: '', maxInstances: user.max_instances });
    setShowUserModal(true);
  }

  function selectCompany(company: Company) {
    setSelectedCompany(company);
    loadCompanyUsers(company.id);
  }

  function backToCompanies() {
    setSelectedCompany(null);
    setCompanyUsers([]);
  }

  const totalInstances = companies.reduce((sum, c) => sum + (c.instances_count || 0), 0);
  const availableInstances = profile?.max_instances ? profile.max_instances - totalInstances : -1;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Carregando empresas...</div>
      </div>
    );
  }

  if (selectedCompany) {
    const companyAvailable = selectedCompany.max_instances - companyUsers.reduce((sum, u) => sum + (u.instances_count || 0), 0);

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={backToCompanies}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Voltar para empresas"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{selectedCompany.name}</h2>
              <p className="text-gray-500 mt-1">
                Usuários da empresa
                {companyAvailable >= 0 && (
                  <span className="ml-2 text-blue-600 font-medium">
                    ({companyAvailable} instâncias disponíveis na empresa)
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={openAddUserModal}
            className="flex items-center space-x-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors shadow-md hover:shadow-lg"
          >
            <Plus className="w-5 h-5" />
            <span>Adicionar Usuário</span>
          </button>
        </div>

        {companyUsers.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum usuário nesta empresa</h3>
            <p className="text-gray-500 mb-6">
              Adicione usuários para que eles possam criar instâncias.
            </p>
            <button
              onClick={openAddUserModal}
              className="inline-flex items-center space-x-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>Adicionar Primeiro Usuário</span>
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
                  {companyUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                          {user.instances_count || 0} instâncias
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user.max_instances || 'Ilimitado'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(user.created_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => openEditUserModal(user)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleRemoveUser(user.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Remover"
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

        {showUserModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-xl font-semibold text-gray-900">
                  {editingUser ? 'Editar Usuário' : 'Adicionar Usuário'}
                </h3>
              </div>

              <div className="p-6 space-y-4">
                {!editingUser && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email
                      </label>
                      <input
                        type="email"
                        value={userFormData.email}
                        onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
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
                        value={userFormData.password}
                        onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Senha do usuário"
                      />
                    </div>
                  </>
                )}

                {editingUser && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nova Senha (deixe em branco para não alterar)
                    </label>
                    <input
                      type="password"
                      value={userFormData.password}
                      onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                    max={companyAvailable >= 0 ? companyAvailable : undefined}
                    value={userFormData.maxInstances}
                    onChange={(e) =>
                      setUserFormData({ ...userFormData, maxInstances: parseInt(e.target.value) || 1 })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {companyAvailable >= 0 && (
                    <p className="mt-1 text-xs text-gray-500">
                      A empresa tem {companyAvailable} instâncias disponíveis
                    </p>
                  )}
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowUserModal(false);
                    setEditingUser(null);
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={editingUser ? handleUpdateUser : handleAddUser}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors shadow-md hover:shadow-lg"
                >
                  {editingUser ? 'Atualizar' : 'Adicionar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Empresas</h2>
          <p className="text-gray-500 mt-1">
            Gerencie empresas e seus usuários
            {availableInstances >= 0 && (
              <span className="ml-2 text-blue-600 font-medium">
                ({availableInstances} instâncias disponíveis)
              </span>
            )}
          </p>
        </div>
        <button
          onClick={openCreateCompanyModal}
          className="flex items-center space-x-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors shadow-md hover:shadow-lg"
        >
          <Plus className="w-5 h-5" />
          <span>Nova Empresa</span>
        </button>
      </div>

      {companies.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhuma empresa</h3>
          <p className="text-gray-500 mb-6">
            Crie empresas para organizar e gerenciar seus usuários.
          </p>
          <button
            onClick={openCreateCompanyModal}
            className="inline-flex items-center space-x-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Criar Primeira Empresa</span>
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nome
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usuários
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Instâncias
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Max. Instâncias
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Criada em
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {companies.map((company) => (
                  <tr
                    key={company.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => selectCompany(company)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {company.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                        {company.users_count || 0} usuários
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                        {company.instances_count || 0} instâncias
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {company.max_instances || 'Ilimitado'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(company.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditCompanyModal(company);
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCompany(company.id);
                          }}
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

      {showCompanyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">
                {editingCompany ? 'Editar Empresa' : 'Nova Empresa'}
              </h3>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome da Empresa
                </label>
                <input
                  type="text"
                  value={companyFormData.name}
                  onChange={(e) => setCompanyFormData({ ...companyFormData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Nome da empresa"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Máximo de Instâncias
                </label>
                <input
                  type="number"
                  min="1"
                  max={availableInstances >= 0 ? availableInstances : undefined}
                  value={companyFormData.maxInstances}
                  onChange={(e) =>
                    setCompanyFormData({ ...companyFormData, maxInstances: parseInt(e.target.value) || 1 })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {availableInstances >= 0 && (
                  <p className="mt-1 text-xs text-gray-500">
                    Você tem {availableInstances} instâncias disponíveis
                  </p>
                )}
              </div>

              {!editingCompany && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                    <div>
                      <p className="font-medium text-gray-900">Criar Primeiro Usuário</p>
                      <p className="text-sm text-gray-500">
                        Crie um usuário junto com a empresa
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={companyFormData.createUser}
                        onChange={(e) =>
                          setCompanyFormData({ ...companyFormData, createUser: e.target.checked })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                    </label>
                  </div>

                  {companyFormData.createUser && (
                    <div className="space-y-3 pl-4 border-l-2 border-blue-200 bg-blue-50/30 p-4 rounded-lg">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Email do Usuário
                        </label>
                        <input
                          type="email"
                          value={companyFormData.userEmail}
                          onChange={(e) =>
                            setCompanyFormData({ ...companyFormData, userEmail: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="usuario@email.com"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Senha do Usuário
                        </label>
                        <input
                          type="text"
                          value={companyFormData.userPassword}
                          onChange={(e) =>
                            setCompanyFormData({ ...companyFormData, userPassword: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Senha do usuário"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Máximo de Instâncias do Usuário
                        </label>
                        <input
                          type="number"
                          min="1"
                          max={companyFormData.maxInstances}
                          value={companyFormData.userMaxInstances}
                          onChange={(e) =>
                            setCompanyFormData({ ...companyFormData, userMaxInstances: parseInt(e.target.value) || 1 })
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Máximo: {companyFormData.maxInstances} instâncias
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowCompanyModal(false);
                  setEditingCompany(null);
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={editingCompany ? handleUpdateCompany : handleCreateCompany}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors shadow-md hover:shadow-lg"
              >
                {editingCompany ? 'Atualizar' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
