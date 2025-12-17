import { useState, useEffect } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type SubscriptionPlan = Database['public']['Tables']['subscription_plans']['Row'];

interface LandingPageProps {
  onLogin: () => void;
}

export default function LandingPage({ onLogin }: LandingPageProps) {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error('Error loading plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-gradient-to-br from-blue-400/20 to-cyan-400/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[700px] h-[700px] bg-gradient-to-tl from-blue-500/15 to-cyan-500/15 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <img src="/Logo_login.png" alt="EVA.Send" className="h-12 w-auto" />
            </div>
            <button
              onClick={onLogin}
              className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-medium transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              Entrar
            </button>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-16">
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
              Escolha o Plano Ideal para Você
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Gerencie suas instâncias do WhatsApp com facilidade e eficiência
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : plans.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-gray-500 text-lg">Nenhum plano disponível no momento</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className="bg-white rounded-2xl shadow-xl border-2 border-gray-200 overflow-hidden hover:border-blue-500 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1"
                >
                  <div className="p-8">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">
                      {plan.name}
                    </h3>

                    {plan.description && (
                      <p className="text-gray-600 text-sm mb-6">
                        {plan.description}
                      </p>
                    )}

                    <div className="mb-6">
                      <div className="flex items-baseline">
                        <span className="text-4xl font-bold text-gray-900">
                          {formatPrice(plan.price)}
                        </span>
                        <span className="text-gray-600 ml-2">/mês</span>
                      </div>
                    </div>

                    <div className="space-y-4 mb-8">
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 mt-1">
                          <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                            <Check className="w-3 h-3 text-green-600" />
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {plan.max_instances === -1
                              ? 'Instâncias ilimitadas'
                              : `Até ${plan.max_instances} ${plan.max_instances === 1 ? 'instância' : 'instâncias'}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 mt-1">
                          <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                            <Check className="w-3 h-3 text-green-600" />
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {plan.max_messages_per_day === -1
                              ? 'Mensagens ilimitadas por dia'
                              : `Até ${plan.max_messages_per_day.toLocaleString('pt-BR')} mensagens/dia`}
                          </p>
                        </div>
                      </div>

                      {Array.isArray(plan.features) && plan.features.length > 0 && (
                        <>
                          {plan.features.map((feature, index) => (
                            <div key={index} className="flex items-start space-x-3">
                              <div className="flex-shrink-0 mt-1">
                                <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                                  <Check className="w-3 h-3 text-green-600" />
                                </div>
                              </div>
                              <div>
                                <p className="text-sm text-gray-700">{feature}</p>
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </div>

                    <button
                      onClick={onLogin}
                      className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                    >
                      Começar Agora
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-16 text-center">
            <p className="text-gray-600 mb-4">
              Já tem uma conta?
            </p>
            <button
              onClick={onLogin}
              className="text-blue-600 hover:text-blue-700 font-semibold hover:underline transition-colors"
            >
              Faça login aqui
            </button>
          </div>
        </main>

        <footer className="bg-white/50 backdrop-blur-sm border-t border-gray-200 mt-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center text-gray-600 text-sm">
              <p>© 2024 EVA.Send - WhatsApp Management Platform</p>
              <p className="mt-2">Versão 1.0.1</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
