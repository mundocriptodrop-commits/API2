import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import ClientDashboard from './pages/ClientDashboard';

function AppContent() {
  const { user, profile, loading } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">Carregando...</div>
      </div>
    );
  }

  if (!user || !profile) {
    if (!showLogin) {
      return <LandingPage onLogin={() => setShowLogin(true)} />;
    }
    return <Login />;
  }

  if (profile.role === 'admin') {
    return <AdminDashboard />;
  }

  return <ClientDashboard />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
