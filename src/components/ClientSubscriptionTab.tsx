import { useState, useEffect } from 'react';
import { Check, Package, MessageSquare, Crown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import ToastContainer, { type ToastMessage } from './ToastContainer';

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  features: string[];
  max_instances: number;
  max_messages_per_day: number;
  is_active: boolean;
  display_order: number;
}

export default function ClientSubscriptionTab() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (message: string, type: 'success' | 'error' | 'warning') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

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
      showToast('Erro ao carregar planos', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPlan = (plan: SubscriptionPlan) => {
    showToast('Em breve você poderá assinar este plano!', 'info');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Carregando planos...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Escolha o Plano Ideal para Você
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Selecione o plano que melhor atende às necessidades do seu negócio e comece a enviar mensagens agora mesmo
        </p>
      </div>

      {plans.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">Nenhum plano disponível no momento</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {plans.map((plan, index) => {
            const isPopular = index === 1 && plans.length >= 3;

            return (
              <div
                key={plan.id}
                className={`relative bg-white rounded-2xl shadow-lg overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-xl ${
                  isPopular ? 'ring-2 ring-blue-500' : ''
                }`}
              >
                {isPopular && (
                  <div className="absolute top-0 right-0 bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-1 text-sm font-semibold rounded-bl-lg flex items-center gap-1">
                    <Crown className="w-4 h-4" />
                    Mais Popular
                  </div>
                )}

                <div className="p-8">
                  <div className="mb-6">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                    <p className="text-gray-600">{plan.description}</p>
                  </div>

                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-5xl font-bold text-gray-900">
                        R$ {plan.price.toFixed(2).replace('.', ',')}
                      </span>
                      <span className="text-gray-500 text-lg">/mês</span>
                    </div>
                  </div>

                  <div className="space-y-4 mb-8">
                    <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Package className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">Instâncias</div>
                        <div className="font-semibold text-gray-900">
                          {plan.max_instances} {plan.max_instances === 1 ? 'instância' : 'instâncias'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <MessageSquare className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">Mensagens por dia</div>
                        <div className="font-semibold text-gray-900">
                          {plan.max_messages_per_day.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {plan.features.length > 0 && (
                    <div className="mb-8">
                      <h4 className="font-semibold text-gray-900 mb-4">Recursos inclusos:</h4>
                      <ul className="space-y-3">
                        {plan.features.map((feature, idx) => (
                          <li key={idx} className="flex items-start gap-3">
                            <div className="mt-0.5">
                              <Check className="w-5 h-5 text-green-600" />
                            </div>
                            <span className="text-gray-700">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <button
                    onClick={() => handleSelectPlan(plan)}
                    className={`w-full py-3 px-6 rounded-lg font-semibold transition-colors ${
                      isPopular
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg shadow-blue-500/30'
                        : 'bg-gray-900 hover:bg-gray-800 text-white'
                    }`}
                  >
                    Selecionar Plano
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-16 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-8 border border-blue-100">
        <div className="text-center">
          <h3 className="text-2xl font-bold text-gray-900 mb-3">
            Precisa de um Plano Personalizado?
          </h3>
          <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
            Se nenhum dos nossos planos atende às suas necessidades específicas, entre em contato conosco para criar um plano personalizado para o seu negócio
          </p>
          <button className="px-8 py-3 bg-gray-900 text-white rounded-lg font-semibold hover:bg-gray-800 transition-colors">
            Falar com Vendas
          </button>
        </div>
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
