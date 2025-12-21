import { useState, useEffect } from 'react';
import { 
  Check, 
  Loader2, 
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Zap,
  Code,
  Send,
  Shield,
  Clock,
  Globe,
  MessageSquare,
  FileText,
  Settings,
  BarChart3
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
    {
      icon: Send,
      title: 'Envio de Mensagens',
      description: 'Envie textos, mídias e mensagens interativas via API REST simples e rápida.'
    },
    {
      icon: MessageSquare,
      title: 'Recebimento em Tempo Real',
      description: 'Webhooks configuráveis para receber mensagens e eventos do WhatsApp instantaneamente.'
    },
    {
      icon: FileText,
      title: 'Múltiplos Formatos',
      description: 'Suporte completo para imagens, vídeos, áudios, documentos e localização.'
    },
    {
      icon: Settings,
      title: 'Múltiplas Instâncias',
      description: 'Gerencie várias contas WhatsApp simultaneamente com isolamento completo.'
    },
    {
      icon: Shield,
      title: 'Segurança',
      description: 'Autenticação por token, criptografia e controle de acesso granular.'
    },
    {
      icon: BarChart3,
      title: 'Monitoramento',
      description: 'Acompanhe status de entrega, leitura e métricas de uso em tempo real.'
    }
  ];

  const benefits = [
    {
      icon: Zap,
      title: 'Integração Rápida',
      description: 'Comece a usar em menos de 10 minutos com nossa documentação completa.'
    },
    {
      icon: Code,
      title: 'API REST Simples',
      description: 'Endpoints intuitivos com exemplos em múltiplas linguagens de programação.'
    },
    {
      icon: Clock,
      title: 'Alta Disponibilidade',
      description: 'Infraestrutura escalável com 99.9% de uptime garantido.'
    },
    {
      icon: Globe,
      title: 'Suporte Nacional',
      description: 'Atendimento em português com equipe técnica especializada.'
    }
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
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <img src="/Logo_login.png" alt="EVA.Send" className="h-8 w-auto" />
              <span className="text-xl font-semibold text-gray-900">EVA.Send</span>
            </div>
            <nav className="hidden md:flex items-center space-x-8">
              <a href="#funcionalidades" className="text-gray-600 hover:text-gray-900 transition-colors text-sm font-medium">Funcionalidades</a>
              <a href="#planos" className="text-gray-600 hover:text-gray-900 transition-colors text-sm font-medium">Planos</a>
              <a href="#faq" className="text-gray-600 hover:text-gray-900 transition-colors text-sm font-medium">FAQ</a>
            </nav>
            <button
              onClick={onLogin}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Entrar
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              API WhatsApp para{' '}
              <span className="text-blue-600">desenvolvedores</span>
            </h1>
            <p className="text-xl text-gray-600 mb-10 leading-relaxed">
              Integre WhatsApp no seu sistema com nossa API REST. Envie mensagens, gerencie conversas e automatize processos de forma simples e confiável.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={onLogin}
                className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl flex items-center gap-2"
              >
                Começar agora
                <ArrowRight className="w-5 h-5" />
              </button>
              <a
                href="#planos"
                className="px-8 py-3 bg-white border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:border-blue-500 hover:text-blue-600 transition-colors"
              >
                Ver planos
              </a>
            </div>
            <p className="mt-8 text-sm text-gray-500">
              ✓ Teste grátis • ✓ Sem cartão de crédito • ✓ Suporte em português
            </p>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((benefit, index) => (
              <div key={index} className="text-center p-6">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <benefit.icon className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {benefit.title}
                </h3>
                <p className="text-sm text-gray-600">
                  {benefit.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Funcionalidades */}
      <section id="funcionalidades" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Funcionalidades
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Tudo que você precisa para integrar WhatsApp no seu sistema
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
              >
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Planos */}
      <section id="planos" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Planos e Preços
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Escolha o plano ideal para seu negócio
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
                  className="bg-white rounded-xl shadow-lg border-2 border-gray-200 overflow-hidden hover:border-blue-500 transition-all"
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
                        <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-gray-700">
                          {plan.max_instances === -1
                            ? 'Instâncias ilimitadas'
                            : `Até ${plan.max_instances} ${plan.max_instances === 1 ? 'instância' : 'instâncias'}`}
                        </p>
                      </div>

                      <div className="flex items-start space-x-3">
                        <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-gray-700">
                          {plan.max_messages_per_day === -1
                            ? 'Mensagens ilimitadas por dia'
                            : `Até ${plan.max_messages_per_day.toLocaleString('pt-BR')} mensagens/dia`}
                        </p>
                      </div>

                      {Array.isArray(plan.features) && plan.features.length > 0 && (
                        <>
                          {plan.features.map((feature, index) => (
                            <div key={index} className="flex items-start space-x-3">
                              <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                              <p className="text-sm text-gray-700">{feature}</p>
                            </div>
                          ))}
                        </>
                      )}
                    </div>

                    <button
                      onClick={onLogin}
                      className="w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Começar agora
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-12 text-center">
            <p className="text-gray-600 mb-2">Já tem uma conta?</p>
            <button
              onClick={onLogin}
              className="text-blue-600 font-semibold hover:underline"
            >
              Faça login aqui
            </button>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Perguntas Frequentes
            </h2>
            <p className="text-xl text-gray-600">
              Tire suas dúvidas sobre a EVA.Send API
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:border-blue-300 transition-colors"
              >
                <button
                  onClick={() => toggleFaq(index)}
                  className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <span className="font-semibold text-gray-900 pr-4">
                    {faq.question}
                  </span>
                  {openFaq === index ? (
                    <ChevronUp className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  )}
                </button>
                {openFaq === index && (
                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                    <p className="text-gray-600">
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
      <section className="py-20 bg-blue-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Pronto para começar?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Integre WhatsApp no seu sistema hoje mesmo
          </p>
          <button
            onClick={onLogin}
            className="px-8 py-3 bg-white text-blue-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors shadow-lg inline-flex items-center gap-2"
          >
            Começar agora
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <img src="/Logo_login.png" alt="EVA.Send" className="h-6 w-auto filter brightness-0 invert" />
                <span className="text-white font-semibold">EVA.Send</span>
              </div>
              <p className="text-sm text-gray-400">
                API WhatsApp para integração com sistemas
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Produto</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#funcionalidades" className="hover:text-white transition-colors">Funcionalidades</a></li>
                <li><a href="#planos" className="hover:text-white transition-colors">Planos</a></li>
                <li><a href="#faq" className="hover:text-white transition-colors">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Desenvolvedor</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Documentação</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API Reference</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Suporte</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Contato</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>suporte@evasend.com</li>
                <li>(00) 0000-0000</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm text-gray-400">
            <p>© 2024 EVA.Send. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
