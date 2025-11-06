import { useState } from 'react';
import AdminSidebar from '../components/AdminSidebar';
import AdminTopBar from '../components/AdminTopBar';
import AdminDashboardTab from '../components/AdminDashboardTab';
import AdminUsersTab from '../components/AdminUsersTab';
import AdminInstancesTab from '../components/AdminInstancesTab';
import ClientApiTab from '../components/ClientApiTab';
import AdminSettingsTab from '../components/AdminSettingsTab';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <AdminDashboardTab />;
      case 'users':
        return <AdminUsersTab />;
      case 'instances':
        return <AdminInstancesTab />;
      case 'api':
        return <ClientApiTab />;
      case 'settings':
        return <AdminSettingsTab />;
      default:
        return <AdminDashboardTab />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <AdminSidebar activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex-1">
        <AdminTopBar />

        <main className="p-8">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
