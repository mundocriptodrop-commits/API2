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

  return (
    <div className="flex h-screen bg-gray-50">
      <ClientSidebar activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <ClientTopBar />

        <main className="flex-1 overflow-y-auto p-6">
          {activeTab === 'dashboard' && <ClientDashboardTab />}
          {activeTab === 'instances' && <ClientInstancesTab />}
          {activeTab === 'activity' && <ClientActivityTab />}
          {activeTab === 'api' && <ClientApiTab />}
          {activeTab === 'settings' && <ClientSettingsTab />}
        </main>
      </div>
    </div>
  );
}
