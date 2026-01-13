import { MessageCircle, LayoutDashboard, Settings, Activity, Code, Package, Users } from 'lucide-react';

interface ClientSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function ClientSidebar({ activeTab, onTabChange }: ClientSidebarProps) {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'instances', label: 'Minhas Instâncias', icon: MessageCircle },
    { id: 'sub-users', label: 'Sub-usuários', icon: Users },
    { id: 'activity', label: 'Atividades', icon: Activity },
    { id: 'subscription', label: 'Planos', icon: Package },
    { id: 'api', label: 'Documentação API', icon: Code },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-white/80 backdrop-blur border-r border-slate-200 min-h-screen flex flex-col">
      <div className="px-6 pt-7 pb-6 border-b border-slate-200">
        <div className="flex items-center justify-center">
          <img
            src="/Logo_login.png"
            alt="EVA.Send"
            className="w-[184px] h-auto object-contain"
          />
        </div>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-3">
        <p className="text-[11px] uppercase tracking-[0.35em] text-slate-400 font-semibold px-2">
          Navegação
        </p>
        <div className="space-y-1.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl transition-all duration-200 border ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-transparent shadow-lg shadow-blue-500/25'
                    : 'bg-white/90 hover:bg-blue-50/70 text-slate-600 border-slate-200'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                      isActive ? 'bg-white/15' : 'bg-slate-100'
                    }`}
                  >
                    <Icon className={`w-4.5 h-4.5 ${isActive ? 'text-white stroke-[2.5]' : 'text-slate-500'}`} />
                  </div>
                  <div className="text-left">
                    <span className={`text-sm font-semibold ${isActive ? 'text-white' : 'text-slate-700'}`}>
                      {tab.label}
                    </span>
                    <div className={`flex items-center space-x-2 mt-0.5 ${isActive ? 'text-white/70' : 'text-slate-400'}`}>
                      <span className="inline-block w-1 h-1 rounded-full bg-current" />
                      <span className="text-[11px] uppercase tracking-[0.3em]">
                        {tab.id === 'dashboard' && 'Visão'}
                        {tab.id === 'instances' && 'Gestão'}
                        {tab.id === 'sub-users' && 'Usuários'}
                        {tab.id === 'activity' && 'Monitor'}
                        {tab.id === 'subscription' && 'Assinaturas'}
                        {tab.id === 'api' && 'Docs'}
                        {tab.id === 'settings' && 'Conta'}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </nav>

      <div className="px-4 pb-6 pt-4 border-t border-slate-200">
        <div className="rounded-2xl bg-gradient-to-br from-blue-500/10 via-indigo-500/10 to-purple-500/10 border border-blue-200/40 p-4">
          <p className="text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-2">
            <span className="h-2 w-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 shadow-sm shadow-blue-500/40" />
            <span>Precisa de suporte?</span>
          </p>
          <p className="text-xs text-slate-500 leading-relaxed">
            Nossa equipe está disponível para ajudar você a configurar integrações, revisar mensagens interativas ou tirar dúvidas sobre a plataforma.
          </p>
          <a
            href="mailto:suporte@evasend.com.br"
            className="mt-3 inline-flex items-center justify-center w-full text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 py-2.5 rounded-lg shadow shadow-blue-500/20 hover:shadow-md hover:shadow-blue-500/25 transition-all duration-200"
          >
            Falar com o suporte
          </a>
        </div>
      </div>
    </aside>
  );
}
