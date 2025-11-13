import { useState } from 'react';
import ClientSidebar from '../components/ClientSidebar';
import ClientTopBar from '../components/ClientTopBar';
import ClientDashboardTab from '../components/ClientDashboardTab';
import ClientInstancesTab from '../components/ClientInstancesTab';
import ClientActivityTab from '../components/ClientActivityTab';
import ClientApiTab from '../components/ClientApiTab';
import ClientSettingsTab from '../components/ClientSettingsTab';

export default function ClientDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
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
          {activeTab === 'activity' && <ClientActivityTab />}
          {activeTab === 'api' && <ClientApiTab />}
          {activeTab === 'settings' && <ClientSettingsTab />}
        </main>
      </div>
    </div>
  );
}
