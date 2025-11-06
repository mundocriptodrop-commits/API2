import { MessageCircle, LayoutDashboard, Settings, Activity, Code } from 'lucide-react';

interface ClientSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function ClientSidebar({ activeTab, onTabChange }: ClientSidebarProps) {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'instances', label: 'Minhas Instâncias', icon: MessageCircle },
    { id: 'activity', label: 'Atividades', icon: Activity },
    { id: 'api', label: 'Documentação API', icon: Code },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-gradient-to-b from-slate-50 to-white border-r border-gray-200 min-h-screen flex flex-col">
      <div className="px-6 pt-8 pb-12">
        <div className="flex items-center justify-center">
          <img
            src="/Logo_login.png"
            alt="EVA.Send"
            className="w-[184px] h-auto object-contain"
          />
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-2 mt-4">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3.5 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30 font-semibold scale-105'
                  : 'text-gray-700 hover:bg-white hover:shadow-md font-medium'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
              <span className="text-sm">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-200">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-blue-900 mb-1">Suporte</p>
          <p className="text-xs text-blue-700">Precisa de ajuda? Entre em contato conosco.</p>
        </div>
      </div>
    </aside>
  );
}
