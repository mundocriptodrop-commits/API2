import { useState, useEffect } from 'react';
import { 
  Check, 
  Loader2, 
  Zap, 
  Code, 
  Send, 
  Image, 
  Menu, 
  Carousel, 
  CreditCard,
  BarChart3,
  Users,
  ShoppingCart,
  Calendar,
  FileText,
  Bot,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Github,
  Mail,
  Phone,
  Package
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
      description: 'Envie mensagens de texto, mídia e interativas via WhatsApp com nossa API REST simples e poderosa.'
    },
    {
      icon: Image,
      title: 'Mídia Completa',
      description: 'Envie imagens, vídeos, áudios e documentos com suporte completo a todos os formatos do WhatsApp.'
    },
    {
      icon: Menu,
      title: 'Menus Interativos',
      description: 'Crie botões, listas, enquetes e carrosséis para uma experiência rica e interativa com seus clientes.'
    },
    {
      icon: Carousel,
      title: 'Carrossel de Mídia',
      description: 'Envie múltiplas imagens em sequência com botões clicáveis, ideal para catálogos e produtos.'
    },
    {
      icon: CreditCard,
      title: 'Botão PIX',
      description: 'Envie botões PIX diretamente no WhatsApp para facilitar pagamentos e cobranças.'
    },
    {
      icon: BarChart3,
      title: 'Status e Stories',
      description: 'Envie status (stories) do WhatsApp programaticamente para manter seus clientes engajados.'
    }
  ];

  const useCases = [
    {
      title: 'CRM Channel',
      description: 'Integração direta com CRMs para centralizar conversas via WhatsApp no histórico do cliente.',
      icon: Users
    },
    {
      title: 'Captação de Leads',
      description: 'Abordagens proativas com envio de mensagens automáticas para captar leads qualificados.',
      icon: Zap
    },
    {
      title: 'Códigos Promocionais',
      description: 'Distribuição automatizada de cupons e descontos via WhatsApp com segmentação inteligente.',
      icon: ShoppingCart
    },
    {
      title: 'Tracking de Encomendas',
      description: 'Atualizações em tempo real de status de pedidos e entregas diretamente no WhatsApp.',
      icon: Package
    },
    {
      title: 'Envio de Boletos',
      description: 'Automação de cobranças via WhatsApp com envio de segunda via e lembretes de pagamento.',
      icon: FileText
    },
    {
      title: 'Bot de Atendimento',
      description: 'Crie bots conversacionais avançados capazes de interpretar linguagem natural.',
      icon: Bot
    },
    {
      title: 'Agendamentos',
      description: 'Lembretes e confirmações automatizadas de agendamentos para clínicas e serviços.',
      icon: Calendar
    },
    {
      title: 'Pesquisas de Opinião',
      description: 'Envio de NPS ou enquetes diretamente no WhatsApp para medir satisfação do cliente.',
      icon: BarChart3
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
      <header className="bg-white/95 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <img src="/Logo_login.png" alt="EVA.Send" className="h-10 w-auto" />
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                EVA.Send
              </span>
            </div>
            <nav className="hidden md:flex items-center space-x-8">
              <a href="#funcionalidades" className="text-gray-600 hover:text-blue-600 transition-colors">Funcionalidades</a>
              <a href="#casos-uso" className="text-gray-600 hover:text-blue-600 transition-colors">Casos de Uso</a>
              <a href="#planos" className="text-gray-600 hover:text-blue-600 transition-colors">Planos</a>
              <a href="#faq" className="text-gray-600 hover:text-blue-600 transition-colors">FAQ</a>
            </nav>
            <button
              onClick={onLogin}
              className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-medium transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              Entrar
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-20 lg:py-32">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-gradient-to-br from-blue-400/20 to-indigo-400/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-[700px] h-[700px] bg-gradient-to-tl from-indigo-500/15 to-blue-500/15 rounded-full blur-3xl" />
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
              Conecte seu sistema ao <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">EVA.Send API</span>
            </h1>
            <p className="text-xl sm:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto">
              A API WhatsApp mais estável e completa do Brasil. Integre atendimento, notificações e automações com suporte técnico nacional e documentação clara.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={onLogin}
                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold text-lg transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 flex items-center gap-2"
              >
                <Zap className="w-5 h-5" />
                Começar Agora
              </button>
              <a
                href="#planos"
                className="px-8 py-4 bg-white border-2 border-gray-300 hover:border-blue-500 text-gray-700 hover:text-blue-600 rounded-xl font-semibold text-lg transition-all duration-300 shadow-lg hover:shadow-xl flex items-center gap-2"
              >
                <BookOpen className="w-5 h-5" />
                Ver Planos
              </a>
            </div>
            <p className="mt-6 text-sm text-gray-500">
              ✓ Teste grátis • ✓ Sem necessidade de cartão de crédito • ✓ Suporte em português
            </p>
          </div>
        </div>
      </section>

      {/* Funcionamento */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Como Funciona a <span className="text-blue-600">EVA.Send API</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Com a EVA.Send API você tem <strong>menos complexidade</strong>, com suporte <strong>100% nacional</strong> e integração <strong>plug & play</strong>.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                number: '01',
                title: 'Automatize Fluxos',
                description: 'Automatiza fluxos de atendimento com chatbots customizáveis e APIs REST. Integre facilmente com seus sistemas existentes.'
              },
              {
                number: '02',
                title: 'Teste na Prática',
                description: 'Use nossa interface interativa para testar a API sem precisar escrever código. Ideal para validar rotas e parâmetros em tempo real.'
              },
              {
                number: '03',
                title: 'Múltiplas Instâncias',
                description: 'Gerencie múltiplas instâncias em paralelo com autenticação segura e escalabilidade horizontal para crescer com seu negócio.'
              },
              {
                number: '04',
                title: 'Integração Universal',
                description: 'A API integra com qualquer stack: CRMs, ERPs, plataformas web, mobile, gateways ou arquiteturas próprias.'
              },
              {
                number: '05',
                title: 'Teste Imediato',
                description: 'Faça seus primeiros testes diretamente via interface web sem a necessidade de codificar nada. Comece imediatamente.'
              },
              {
                number: '06',
                title: 'Webhooks em Tempo Real',
                description: 'Receba notificações em tempo real de mensagens recebidas, status de entrega e eventos importantes do WhatsApp.'
              }
            ].map((step, index) => (
              <div
                key={index}
                className="relative p-6 bg-gradient-to-br from-gray-50 to-white rounded-2xl border border-gray-200 hover:border-blue-300 transition-all duration-300 hover:shadow-xl"
              >
                <div className="absolute top-4 right-4 text-6xl font-bold text-blue-100">
                  {step.number}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3 relative z-10">
                  {step.title}
                </h3>
                <p className="text-gray-600 relative z-10">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Funcionalidades Exclusivas */}
      <section id="funcionalidades" className="py-20 bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              O que só a <span className="text-blue-600">EVA.Send API</span> tem
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Conheça as funcionalidades exclusivas que só nossa ferramenta pode te proporcionar.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-200 hover:border-blue-300"
              >
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center mb-4">
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">
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

      {/* Casos de Uso */}
      <section id="casos-uso" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Casos de Uso com a <span className="text-blue-600">EVA.Send API</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Conheça <strong>casos de uso reais!</strong> Nossas ferramentas comprovadas ajudam clientes a otimizar processos e alcançar melhores resultados.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {useCases.map((useCase, index) => (
              <div
                key={index}
                className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-6 border border-gray-200 hover:border-blue-300 transition-all duration-300 hover:shadow-lg"
              >
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <useCase.icon className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  {useCase.title}
                </h3>
                <p className="text-sm text-gray-600">
                  {useCase.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Planos */}
      <section id="planos" className="py-20 bg-gradient-to-br from-indigo-50 to-blue-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Escolha o Plano Ideal para Você
            </h2>
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
        </div>
      </section>

      {/* Documentação */}
      <section id="documentacao" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Documentação Completa
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Tudo que você precisa para começar a integrar em minutos
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200">
              <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center mb-4">
                <BookOpen className="w-7 h-7 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                Guia de Início Rápido
              </h3>
              <p className="text-gray-600 mb-4">
                Aprenda a criar sua primeira instância e enviar sua primeira mensagem em menos de 10 minutos.
              </p>
              <a
                href="#"
                className="text-blue-600 font-semibold hover:underline flex items-center gap-2"
              >
                Ler Documentação <ArrowRight className="w-4 h-4" />
              </a>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200">
              <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                <Code className="w-7 h-7 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                Referência da API
              </h3>
              <p className="text-gray-600 mb-4">
                Documentação completa de todos os endpoints, parâmetros e exemplos de código em múltiplas linguagens.
              </p>
              <a
                href="#"
                className="text-blue-600 font-semibold hover:underline flex items-center gap-2"
              >
                Ver Endpoints <ArrowRight className="w-4 h-4" />
              </a>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200">
              <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
                <Github className="w-7 h-7 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                Exemplos e SDKs
              </h3>
              <p className="text-gray-600 mb-4">
                Bibliotecas prontas e exemplos de código em JavaScript, Python, PHP e outras linguagens populares.
              </p>
              <a
                href="#"
                className="text-blue-600 font-semibold hover:underline flex items-center gap-2"
              >
                Ver Exemplos <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 bg-gradient-to-br from-blue-50 to-indigo-50">
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
                className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-blue-300 transition-colors"
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
      <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Pronto para começar?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            A API que SaaS ativa hoje e monetiza amanhã. Comece agora mesmo!
          </p>
          <button
            onClick={onLogin}
            className="px-8 py-4 bg-white text-blue-600 rounded-xl font-semibold text-lg transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 flex items-center gap-2 mx-auto"
          >
            <Zap className="w-5 h-5" />
            Começar Agora - Teste Grátis
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <img src="/Logo_login.png" alt="EVA.Send" className="h-8 w-auto filter brightness-0 invert" />
                <span className="text-white font-bold">EVA.Send</span>
              </div>
              <p className="text-sm text-gray-400">
                A API WhatsApp mais estável e completa do Brasil.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Solução</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#funcionalidades" className="hover:text-white transition-colors">Funcionalidades</a></li>
                <li><a href="#casos-uso" className="hover:text-white transition-colors">Casos de Uso</a></li>
                <li><a href="#documentacao" className="hover:text-white transition-colors">Documentação</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Desenvolvedor</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Documentação</a></li>
                <li><a href="#" className="hover:text-white transition-colors">GitHub</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Central de Ajuda</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Contato</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  <a href="mailto:suporte@evasend.com" className="hover:text-white transition-colors">suporte@evasend.com</a>
                </li>
                <li className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  <span>(00) 0000-0000</span>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm text-gray-400">
            <p>© 2024 EVA.Send - WhatsApp Management Platform. Todos os direitos reservados.</p>
            <div className="mt-4 flex justify-center gap-6">
              <a href="#" className="hover:text-white transition-colors">Política de Privacidade</a>
              <a href="#" className="hover:text-white transition-colors">Termos de Uso</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
