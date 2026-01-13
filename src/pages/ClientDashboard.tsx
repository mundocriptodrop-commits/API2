import { useState, useEffect } from 'react';
import ClientSidebar from '../components/ClientSidebar';
import ClientTopBar from '../components/ClientTopBar';
import ClientDashboardTab from '../components/ClientDashboardTab';
import ClientInstancesTab from '../components/ClientInstancesTab';
import ClientActivityTab from '../components/ClientActivityTab';
import ClientSubscriptionTab from '../components/ClientSubscriptionTab';
import ClientApiTab from '../components/ClientApiTab';
import ClientSettingsTab from '../components/ClientSettingsTab';
import ClientSubUsersTab from '../components/ClientSubUsersTab';
import { useAuth } from '../contexts/AuthContext';

export default function ClientDashboard() {
  const { isSubUser } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [pendingCreateInstance, setPendingCreateInstance] = useState(false);
  
  // Redirecionar sub-usuários se tentarem acessar abas restritas
  useEffect(() => {
    if (isSubUser) {
      const restrictedTabs = ['sub-users', 'activity', 'subscription'];
      if (restrictedTabs.includes(activeTab)) {
        setActiveTab('dashboard');
      }
    }
  }, [isSubUser, activeTab]);

  const handleRequestCreateInstance = () => {
    setPendingCreateInstance(true);
    setActiveTab('instances');
  };

  const handleCloseCreateInstance = () => {
    setPendingCreateInstance(false);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <ClientSidebar activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <ClientTopBar />

        <main className={`flex-1 overflow-y-auto ${activeTab === 'api' ? '' : 'p-6'}`}>
          {activeTab === 'dashboard' && (
            <ClientDashboardTab onRequestCreateInstance={handleRequestCreateInstance} />
          )}
          {activeTab === 'instances' && (
            <ClientInstancesTab
              openCreate={pendingCreateInstance}
              onCloseCreate={handleCloseCreateInstance}
            />
          )}
          {!isSubUser && activeTab === 'sub-users' && <ClientSubUsersTab />}
          {!isSubUser && activeTab === 'activity' && <ClientActivityTab />}
          {!isSubUser && activeTab === 'subscription' && <ClientSubscriptionTab />}
          {activeTab === 'api' && <ClientApiTab />}
          {activeTab === 'settings' && <ClientSettingsTab />}
        </main>
      </div>
    </div>
  );
}
