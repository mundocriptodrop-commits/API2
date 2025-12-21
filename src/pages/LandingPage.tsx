import { useState, useEffect } from 'react';
import { 
  Check, 
  Loader2, 
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type SubscriptionPlan = Database['public']['Tables']['subscription_plans']['Row'];

interface LandingPageProps {
  onLogin: () => void;
}

export default function LandingPage({ onLogin }: LandingPageProps) {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

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

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const features = [
    'Envio de mensagens de texto, mídia e interativas',
    'Menus, botões, listas e carrosséis',
    'Botão PIX integrado',
    'Status e stories do WhatsApp',
    'Múltiplas instâncias simultâneas',
    'Webhooks em tempo real',
    'API REST simples e documentada',
    'Suporte técnico em português'
  ];

  const useCases = [
    'Integração com CRMs e ERPs',
    'Automação de atendimento',
    'Envio de notificações e lembretes',
    'Distribuição de códigos promocionais',
    'Tracking de encomendas',
    'Cobrança e envio de boletos',
    'Agendamentos e confirmações',
    'Pesquisas de satisfação'
  ];

  const faqs = [
    {
      question: 'Quais tipos de sistemas podem integrar com a API?',
      answer: 'Qualquer sistema: ERPs, CRMs, plataformas SaaS, sistemas de agendamento, logística, saúde, e-commerce e muito mais. Se você desenvolve software, consegue se conectar com nossa API.'
    },
    {
      question: 'Em quanto tempo posso começar a usar?',
      answer: 'Em menos de 10 minutos. Basta criar uma instância, conectar seu número WhatsApp e sua API já estará pronta para enviar e receber mensagens.'
    },
    {
      question: 'Preciso de um número novo para usar a API?',
      answer: 'Não! Você pode usar qualquer número já existente, seja ele pessoal ou comercial. Basta conectar via QR Code ou código de pareamento.'
    },
    {
      question: 'A API tem limitações de envio de mensagens?',
      answer: 'Depende do seu plano. Oferecemos planos com diferentes limites de mensagens por dia, desde planos básicos até planos com mensagens ilimitadas.'
    },
    {
      question: 'Preciso de um servidor dedicado para usar?',
      answer: 'Não. A integração é simples, via JSON + Webhooks, e requer apenas um telefone com WhatsApp ativo. Nossa infraestrutura é gerenciada na nuvem.'
    },
    {
      question: 'A API funciona fora do Brasil?',
      answer: 'Sim! Nossa API tem cobertura global e pode ser usada em qualquer país que permita o uso do WhatsApp.'
    },
    {
      question: 'Como funciona o pagamento?',
      answer: 'Pagamento em Real (R$), com planos mensais acessíveis e faturamento nacional. Sem surpresas em dólar ou taxas ocultas.'
    },
    {
      question: 'A API oferece suporte?',
      answer: 'Sim. Nosso suporte funciona com atendimento humano e documentação completa em português. Oferecemos suporte técnico para ajudar na integração.'
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-black sticky top-0 z-50 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <img src="/Logo_login.png" alt="EVA.Send" className="h-8 w-auto" />
              <span className="text-lg font-bold">EVA.Send</span>
            </div>
            <nav className="hidden md:flex items-center space-x-6 text-sm">
              <a href="#funcionalidades" className="hover:underline">Funcionalidades</a>
              <a href="#planos" className="hover:underline">Planos</a>
              <a href="#faq" className="hover:underline">FAQ</a>
            </nav>
            <button
              onClick={onLogin}
              className="px-5 py-2 bg-black text-white text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              Entrar
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="border-b border-black">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="max-w-3xl">
            <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
              API WhatsApp para seu sistema
            </h1>
            <p className="text-xl text-gray-700 mb-8 leading-relaxed">
              Integre WhatsApp no seu software. Envie mensagens, gerencie conversas e automatize processos com nossa API REST.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={onLogin}
                className="px-8 py-3 bg-black text-white font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
              >
                Começar agora
                <ArrowRight className="w-5 h-5" />
              </button>
              <a
                href="#planos"
                className="px-8 py-3 border-2 border-black text-black font-medium hover:bg-black hover:text-white transition-colors text-center"
              >
                Ver planos
              </a>
            </div>
            <p className="mt-6 text-sm text-gray-600">
              Teste grátis • Sem cartão de crédito • Suporte em português
            </p>
          </div>
        </div>
      </section>

      {/* Funcionalidades */}
      <section id="funcionalidades" className="border-b border-black">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <h2 className="text-3xl font-bold mb-12">Funcionalidades</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((feature, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="mt-1 w-5 h-5 border-2 border-black flex-shrink-0 flex items-center justify-center">
                  <Check className="w-3 h-3" />
                </div>
                <p className="text-gray-700">{feature}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Casos de Uso */}
      <section className="border-b border-black bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <h2 className="text-3xl font-bold mb-12">Casos de uso</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {useCases.map((useCase, index) => (
              <div key={index} className="border border-black p-4 bg-white">
                <p className="text-sm">{useCase}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Planos */}
      <section id="planos" className="border-b border-black">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="mb-12">
            <h2 className="text-3xl font-bold mb-4">Planos</h2>
            <p className="text-gray-700">Escolha o plano ideal para seu negócio</p>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : plans.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-gray-500">Nenhum plano disponível no momento</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className="border-2 border-black p-6 bg-white"
                >
                  <h3 className="text-2xl font-bold mb-2">
                    {plan.name}
                  </h3>

                  {plan.description && (
                    <p className="text-sm text-gray-600 mb-6">
                      {plan.description}
                    </p>
                  )}

                  <div className="mb-6">
                    <div className="flex items-baseline">
                      <span className="text-4xl font-bold">
                        {formatPrice(plan.price)}
                      </span>
                      <span className="text-gray-600 ml-2">/mês</span>
                    </div>
                  </div>

                  <div className="space-y-3 mb-8">
                    <div className="flex items-start gap-2">
                      <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <p className="text-sm">
                        {plan.max_instances === -1
                          ? 'Instâncias ilimitadas'
                          : `Até ${plan.max_instances} ${plan.max_instances === 1 ? 'instância' : 'instâncias'}`}
                      </p>
                    </div>

                    <div className="flex items-start gap-2">
                      <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <p className="text-sm">
                        {plan.max_messages_per_day === -1
                          ? 'Mensagens ilimitadas por dia'
                          : `Até ${plan.max_messages_per_day.toLocaleString('pt-BR')} mensagens/dia`}
                      </p>
                    </div>

                    {Array.isArray(plan.features) && plan.features.length > 0 && (
                      <>
                        {plan.features.map((feature, index) => (
                          <div key={index} className="flex items-start gap-2">
                            <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            <p className="text-sm">{feature}</p>
                          </div>
                        ))}
                      </>
                    )}
                  </div>

                  <button
                    onClick={onLogin}
                    className="w-full py-3 px-4 bg-black text-white font-medium hover:bg-gray-800 transition-colors"
                  >
                    Começar agora
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-12 text-center">
            <p className="text-gray-600 mb-2">Já tem uma conta?</p>
            <button
              onClick={onLogin}
              className="text-black font-medium hover:underline"
            >
              Faça login aqui
            </button>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-b border-black bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-20">
          <div className="mb-12">
            <h2 className="text-3xl font-bold mb-4">Perguntas frequentes</h2>
            <p className="text-gray-700">Dúvidas sobre a EVA.Send API</p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="border border-black bg-white"
              >
                <button
                  onClick={() => toggleFaq(index)}
                  className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <span className="font-medium pr-4">
                    {faq.question}
                  </span>
                  {openFaq === index ? (
                    <ChevronUp className="w-5 h-5 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 flex-shrink-0" />
                  )}
                </button>
                {openFaq === index && (
                  <div className="px-6 py-4 border-t border-black bg-gray-50">
                    <p className="text-gray-700">
                      {faq.answer}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="bg-black text-white">
        <div className="max-w-4xl mx-auto px-6 py-20 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Pronto para começar?
          </h2>
          <p className="text-xl mb-8 text-gray-300">
            Comece a integrar WhatsApp no seu sistema hoje mesmo
          </p>
          <button
            onClick={onLogin}
            className="px-8 py-3 bg-white text-black font-medium hover:bg-gray-200 transition-colors inline-flex items-center gap-2"
          >
            Começar agora
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-black">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <img src="/Logo_login.png" alt="EVA.Send" className="h-6 w-auto" />
                <span className="font-bold">EVA.Send</span>
              </div>
              <p className="text-sm text-gray-600">
                API WhatsApp para integração com sistemas
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Links</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#funcionalidades" className="text-gray-600 hover:underline">Funcionalidades</a></li>
                <li><a href="#planos" className="text-gray-600 hover:underline">Planos</a></li>
                <li><a href="#faq" className="text-gray-600 hover:underline">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Contato</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>suporte@evasend.com</li>
                <li>(00) 0000-0000</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-300 pt-8 text-center text-sm text-gray-600">
            <p>© 2024 EVA.Send. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
