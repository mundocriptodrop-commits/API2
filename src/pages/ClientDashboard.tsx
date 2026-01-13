import { useState } from 'react';
import ClientSidebar from '../components/ClientSidebar';
import ClientTopBar from '../components/ClientTopBar';
import ClientDashboardTab from '../components/ClientDashboardTab';
import ClientInstancesTab from '../components/ClientInstancesTab';
import ClientActivityTab from '../components/ClientActivityTab';
import ClientSubscriptionTab from '../components/ClientSubscriptionTab';
import ClientApiTab from '../components/ClientApiTab';
import ClientSettingsTab from '../components/ClientSettingsTab';
import ClientSubUsersTab from '../components/ClientSubUsersTab';

export default function ClientDashboard() {
  const [activeTab, setActiveTab] = useState('subscription');
  const [pendingCreateInstance, setPendingCreateInstance] = useState(false);

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
          {activeTab === 'sub-users' && <ClientSubUsersTab />}
          {activeTab === 'activity' && <ClientActivityTab />}
          {activeTab === 'subscription' && <ClientSubscriptionTab />}
          {activeTab === 'api' && <ClientApiTab />}
          {activeTab === 'settings' && <ClientSettingsTab />}
        </main>
      </div>
    </div>
  );
}
