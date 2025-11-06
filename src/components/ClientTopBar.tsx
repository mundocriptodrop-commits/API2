import { LogOut, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function ClientTopBar() {
  const { user, profile, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Erro ao sair:', error);
      alert('Erro ao sair. Tente novamente.');
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Painel do Cliente</h1>
      </div>

      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-3 px-4 py-2 bg-gray-50 rounded-lg">
          <User className="w-5 h-5 text-gray-400" />
          <div className="text-sm">
            <p className="font-medium text-gray-900">{user?.email}</p>
            <p className="text-xs text-gray-500">
              {profile?.max_instances || 0} instâncias
            </p>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span>Sair</span>
        </button>
      </div>
    </header>
  );
}
