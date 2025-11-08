import { useState, useEffect } from 'react';
import { Copy, Check, ChevronRight, Send, Image, Smartphone, Shield, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

// Chave anon do Supabase para autenticação nas Edge Functions
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

interface WhatsAppInstance {
  id: string;
  name: string;
  instance_token: string | null;
  status: 'disconnected' | 'connecting' | 'connected';
  phone_number: string | null;
}

type EndpointType = 'send-text' | 'send-media' | 'send-menu' | 'send-carousel' | 'send-pix-button' | 'send-status';

type EndpointParam = {
  name: string;
  type: string;
  required: boolean;
  description: string;
};

type EndpointResponseExample = {
  status: number | string;
  label: string;
  body: Record<string, unknown>;
};

type EndpointDoc = {
  title: string;
  description: string;
  method: 'POST' | 'GET' | 'PUT' | 'DELETE';
  path: string;
  icon: LucideIcon;
  color: string;
  features: string[];
  params: EndpointParam[];
  exampleRequest: Record<string, unknown>;
  exampleResponse?: Record<string, unknown>;
  responses?: EndpointResponseExample[];
};

export default function ClientApiTab() {
  const { user } = useAuth();
  const [copiedEndpoint, setCopiedEndpoint] = useState<string | null>(null);
  const [testNumber, setTestNumber] = useState('5511999999999');
  const [testMessage, setTestMessage] = useState('Olá! Como posso ajudar?');
  const [testToken, setTestToken] = useState('');
  const [mediaType, setMediaType] = useState('image');
  const [mediaFile, setMediaFile] = useState('https://exemplo.com/foto.jpg');
  const [mediaCaption, setMediaCaption] = useState('Veja esta foto!');
  const [docName, setDocName] = useState('documento.pdf');
  
  // Estados para send-menu
  const [menuType, setMenuType] = useState('button');
  const [menuChoices, setMenuChoices] = useState('Suporte Técnico|suporte\nFazer Pedido|pedido\nNosso Site|https://exemplo.com');
  const [footerText, setFooterText] = useState('Escolha uma das opções abaixo');
  const [listButton, setListButton] = useState('Ver Opções');
  const [selectableCount, setSelectableCount] = useState(1);
  const [imageButton, setImageButton] = useState('');
  
  // Estados para send-carousel
  const [carouselItems, setCarouselItems] = useState('Produto Exemplo');
  const [carouselImage, setCarouselImage] = useState('https://exemplo.com/imagem.jpg');
  const [buttonText, setButtonText] = useState('Comprar');
  const [buttonId, setButtonId] = useState('comprar');
  const [buttonType, setButtonType] = useState('REPLY');
  
  // Estados para send-pix-button
  const [pixType, setPixType] = useState('EVP');
  const [pixKey, setPixKey] = useState('123e4567-e89b-12d3-a456-426614174000');
  const [pixName, setPixName] = useState('Loja Exemplo');
  
  // Estados para send-status
  const [statusType, setStatusType] = useState('text');
  const [backgroundColor, setBackgroundColor] = useState(7);
  const [font, setFont] = useState(1);
  const [statusFile, setStatusFile] = useState('');
  const [thumbnail, setThumbnail] = useState('');

  const [expandedResponses, setExpandedResponses] = useState<Record<string, boolean>>({});
  
  const [testResponse, setTestResponse] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(true);
  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointType>('send-text');
  const [activeTab, setActiveTab] = useState<'try' | 'code'>('try');
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['enviar-mensagem']);

  const displayApiUrl = 'https://api.evasend.com.br/whatsapp';
  const actualApiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

  useEffect(() => {
    if (user) {
      fetchInstances();
    }
  }, [user]);

  const fetchInstances = async () => {
    try {
      setLoadingInstances(true);
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('id, name, instance_token, status, phone_number')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInstances(data || []);
    } catch (error) {
      console.error('Erro ao carregar instâncias:', error);
    } finally {
      setLoadingInstances(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedEndpoint(id);
    setTimeout(() => setCopiedEndpoint(null), 2000);
  };

  const handleTest = async () => {
    if (!testToken) {
      setTestResponse('{"error": "Token é obrigatório"}');
      return;
    }

    setIsLoading(true);
    setTestResponse('');

    try {
      let body: any = {};

      // Construir body baseado no endpoint selecionado
      switch (selectedEndpoint) {
        case 'send-text':
          body = {
            number: testNumber,
            text: testMessage,
          };
          break;
        case 'send-media':
          body = {
            number: testNumber,
            type: mediaType,
            file: mediaFile,
            text: mediaCaption,
          };
          if (mediaType === 'document') {
            body.docName = docName;
          }
          break;
        case 'send-menu':
          body = {
            number: testNumber,
            type: menuType,
            text: testMessage,
            choices: menuChoices.split('\n').filter(c => c.trim() !== ''),
          };
          if (footerText) body.footerText = footerText;
          if (menuType === 'list' && listButton) body.listButton = listButton;
          if (menuType === 'poll' && selectableCount) body.selectableCount = selectableCount;
          if (imageButton) body.imageButton = imageButton;
          break;
        case 'send-carousel':
          body = {
            number: testNumber,
            text: testMessage,
            carousel: [
              {
                text: carouselItems,
                image: carouselImage,
                buttons: [
                  {
                    id: buttonId,
                    text: buttonText,
                    type: buttonType,
                  },
                ],
              },
            ],
          };
          break;
        case 'send-pix-button':
          body = {
            number: testNumber,
            pixType: pixType,
            pixKey: pixKey,
          };
          if (pixName) body.pixName = pixName;
          break;
        case 'send-status':
          // Status não requer número (é enviado para o próprio número conectado)
          body = {
            type: statusType,
          };
          if (statusType === 'text') {
            body.text = testMessage;
            body.background_color = backgroundColor;
            body.font = font;
          } else {
            if (statusFile) body.file = statusFile;
            if (testMessage) body.text = testMessage;
            if (thumbnail) body.thumbnail = thumbnail;
          }
          break;
      }

      const response = await fetch(`${actualApiUrl}/${selectedEndpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, // Required by Supabase Edge Functions
          'token': testToken, // Token da instância WhatsApp
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      setTestResponse(JSON.stringify(data, null, 2));
    } catch (error: any) {
      setTestResponse(JSON.stringify({ 
        error: 'Erro ao fazer requisição',
        message: error.message || 'Erro desconhecido'
      }, null, 2));
    } finally {
      setIsLoading(false);
    }
  };

  const endpoints = [
    {
      id: 'administracao' as const,
      label: 'Administração',
      count: 0,
      children: []
    },
    {
      id: 'instancia' as const,
      label: 'Instancia',
      count: 0,
      children: []
    },
    {
      id: 'perfil' as const,
      label: 'Perfil',
      count: 0,
      children: []
    },
    {
      id: 'enviar-mensagem' as const,
      label: 'Enviar Mensagem',
      count: 6,
      children: [
        { id: 'send-text' as EndpointType, label: 'Enviar mensagem de texto', method: 'POST' },
        { id: 'send-media' as EndpointType, label: 'Enviar mídia (imagem, vídeo, áudio ou documento)', method: 'POST' },
        { id: 'send-menu' as EndpointType, label: 'Enviar menu interativo (botões, lista, enquete, carrossel)', method: 'POST' },
        { id: 'send-carousel' as EndpointType, label: 'Enviar carrossel de mídia com botões', method: 'POST' },
        { id: 'send-pix-button' as EndpointType, label: 'Enviar botão PIX', method: 'POST' },
        { id: 'send-status' as EndpointType, label: 'Enviar Stories (Status)', method: 'POST' },
      ]
    }
  ];

  const endpointData: Record<EndpointType, EndpointDoc> = {
    'send-text': {
      title: 'Enviar mensagem de texto',
      description: 'Envia uma mensagem de texto para um contato ou grupo.',
      method: 'POST',
      path: '/send/text',
      icon: Send,
      color: 'cyan',
      features: [
        'Preview de links com suporte a personalização automática ou customizada',
        'Formatação básica do texto',
        'Substituição automática de placeholders dinâmicos'
      ],
      params: [
        { name: 'number', type: 'string', required: true, description: 'Número de telefone com código do país (ex: 5511999999999)' },
        { name: 'text', type: 'string', required: true, description: 'Mensagem de texto a ser enviada' }
      ],
      exampleRequest: {
        number: "5511999999999",
        text: "Olá! Como posso ajudar?"
      },
      exampleResponse: {
        success: true,
        messageId: "3EB0123456789ABCDEF",
        timestamp: 1699564800
      }
    },
    'send-media': {
      title: 'Enviar mídia (imagem, vídeo, áudio ou documento)',
      description: 'Envia arquivos de mídia com caption opcional.',
      method: 'POST',
      path: '/send/media',
      icon: Image,
      color: 'green',
      features: [
        'Suporte para imagem, vídeo, documento, áudio',
        'Caption com formatação e placeholders',
        'Base64 ou URL para arquivo'
      ],
      params: [
        { name: 'number', type: 'string', required: true, description: 'Número com código do país' },
        { name: 'type', type: 'string', required: true, description: 'image, video, document, audio, myaudio, ptt, sticker' },
        { name: 'file', type: 'string', required: true, description: 'URL ou base64 do arquivo' },
        { name: 'text', type: 'string', required: false, description: 'Caption/legenda (aceita placeholders)' },
        { name: 'docName', type: 'string', required: false, description: 'Nome do arquivo (apenas para documents)' }
      ],
      exampleRequest: {
        number: "5511999999999",
        type: "image",
        file: "https://exemplo.com/foto.jpg",
        text: "Veja esta foto!"
      },
      exampleResponse: {
        success: true,
        messageId: "3EB0123456789ABCDEF",
        timestamp: 1699564800
      }
    },
    'send-menu': {
      title: 'Enviar menu interativo',
      description: 'Envia menus interativos: botões, listas, enquetes ou carrossel.',
      method: 'POST',
      path: '/send/menu',
      icon: Send,
      color: 'purple',
      features: [
        'Botões interativos com ações (resposta, URL, chamada, copiar)',
        'Listas organizadas em seções',
        'Enquetes para votação',
        'Carrossel de botões com imagens',
        'Suporte a imagens nos botões'
      ],
      params: [
        { name: 'number', type: 'string', required: true, description: 'Número com código do país' },
        { name: 'type', type: 'string', required: true, description: 'Tipo: button, list, poll, carousel' },
        { name: 'text', type: 'string', required: true, description: 'Texto principal da mensagem' },
        { name: 'choices', type: 'array', required: true, description: 'Array de opções (formato varia por tipo)' },
        { name: 'footerText', type: 'string', required: false, description: 'Texto do rodapé (opcional)' },
        { name: 'listButton', type: 'string', required: false, description: 'Texto do botão principal (para listas)' },
        { name: 'selectableCount', type: 'number', required: false, description: 'Número de opções selecionáveis (para enquetes)' },
        { name: 'imageButton', type: 'string', required: false, description: 'URL da imagem para botões' }
      ],
      exampleRequest: {
        number: "5511999999999",
        type: "button",
        text: "Como podemos ajudar?",
        choices: [
          "Suporte Técnico|suporte",
          "Fazer Pedido|pedido",
          "Nosso Site|https://exemplo.com"
        ],
        footerText: "Escolha uma das opções abaixo"
      },
      exampleResponse: {
        success: true,
        messageId: "3EB0123456789ABCDEF",
        timestamp: 1699564800
      }
    },
    'send-carousel': {
      title: 'Enviar carrossel de mídia',
      description: 'Envia um carrossel com imagens e botões interativos.',
      method: 'POST',
      path: '/send/carousel',
      icon: Image,
      color: 'indigo',
      features: [
        'Carrossel de cartões com imagens',
        'Botões interativos por cartão',
        'Tipos de botões: REPLY, URL, COPY, CALL',
        'Múltiplos cartões em uma única mensagem'
      ],
      params: [
        { name: 'number', type: 'string', required: true, description: 'Número com código do país' },
        { name: 'text', type: 'string', required: true, description: 'Texto principal da mensagem' },
        { name: 'carousel', type: 'array', required: true, description: 'Array de cartões do carrossel' }
      ],
      exampleRequest: {
        number: "5511999999999",
        text: "Nossos Produtos em Destaque",
        carousel: [
          {
            text: "Smartphone XYZ\nO mais avançado smartphone",
            image: "https://exemplo.com/produto1.jpg",
            buttons: [
              {
                id: "SIM_COMPRAR_XYZ",
                text: "Comprar Agora",
                type: "REPLY"
              },
              {
                id: "https://exemplo.com/xyz",
                text: "Ver Detalhes",
                type: "URL"
              }
            ]
          }
        ]
      },
      responses: [
        {
          status: 200,
          label: "Carrossel enviado com sucesso",
          body: {
            id: "123e4567-e89b-12d3-a456-426614174000",
            messageid: "string",
            chatid: "string",
            fromMe: false,
            isGroup: false,
            messageType: "text",
            messageTimestamp: 0,
            edited: "string",
            quoted: "string",
            reaction: "string",
            sender: "string",
            senderName: "string",
            source: "ios",
            status: "pending",
            text: "string",
            vote: "string",
            buttonOrListid: "string",
            convertOptions: "string",
            fileURL: "https://example.com",
            content: "string",
            owner: "string",
            track_source: "string",
            track_id: "string",
            created: "2024-01-15T10:30:00Z",
            updated: "2024-01-15T10:30:00Z",
            ai_metadata: {
              agent_id: "string",
              request: {
                messages: ["item"],
                tools: ["item"],
                options: {
                  model: "string",
                  temperature: 0,
                  maxTokens: 0,
                  topP: 0,
                  frequencyPenalty: 0,
                  presencePenalty: 0
                }
              },
              response: {
                choices: ["item"],
                toolResults: ["item"],
                error: "string"
              }
            },
            response: {
              status: "success",
              message: "Carousel sent successfully"
            }
          }
        },
        {
          status: 400,
          label: "Requisição inválida",
          body: {
            error: "Missing required fields or invalid card format"
          }
        },
        {
          status: 401,
          label: "Não autorizado",
          body: {
            error: "Invalid token"
          }
        },
        {
          status: 500,
          label: "Erro interno do servidor",
          body: {
            error: "Failed to send carousel"
          }
        }
      ]
    },
    'send-pix-button': {
      title: 'Enviar botão PIX',
      description: 'Envia um botão nativo do WhatsApp para pagamento PIX.',
      method: 'POST',
      path: '/send/pix-button',
      icon: Send,
      color: 'green',
      features: [
        'Botão nativo do WhatsApp',
        'Suporte a diferentes tipos de chave PIX',
        'Visualização do recebedor e chave',
        'Abertura direta no app de pagamento'
      ],
      params: [
        { name: 'number', type: 'string', required: true, description: 'Número com código do país' },
        { name: 'pixType', type: 'string', required: true, description: 'Tipo: CPF, CNPJ, PHONE, EMAIL, EVP' },
        { name: 'pixKey', type: 'string', required: true, description: 'Valor da chave PIX' },
        { name: 'pixName', type: 'string', required: false, description: 'Nome do recebedor (padrão: "Pix")' }
      ],
      exampleRequest: {
        number: "5511999999999",
        pixType: "EVP",
        pixKey: "123e4567-e89b-12d3-a456-426614174000",
        pixName: "Loja Exemplo"
      },
      responses: [
        {
          status: 200,
          label: "Botão PIX enviado com sucesso",
          body: {
            id: "123e4567-e89b-12d3-a456-426614174000",
            messageid: "string",
            chatid: "string",
            fromMe: false,
            isGroup: false,
            messageType: "text",
            messageTimestamp: 0,
            edited: "string",
            quoted: "string",
            reaction: "string",
            sender: "string",
            senderName: "string",
            source: "ios",
            status: "pending",
            text: "string",
            vote: "string",
            buttonOrListid: "string",
            convertOptions: "string",
            fileURL: "https://example.com",
            content: "string",
            owner: "string",
            track_source: "string",
            track_id: "string",
            created: "2024-01-15T10:30:00Z",
            updated: "2024-01-15T10:30:00Z",
            ai_metadata: {
              agent_id: "string",
              request: {
                messages: ["item"],
                tools: ["item"],
                options: {
                  model: "string",
                  temperature: 0,
                  maxTokens: 0,
                  topP: 0,
                  frequencyPenalty: 0,
                  presencePenalty: 0
                }
              },
              response: {
                choices: ["item"],
                toolResults: ["item"],
                error: "string"
              }
            },
            response: {
              status: "success",
              message: "PIX button sent successfully"
            }
          }
        },
        {
          status: 400,
          label: "Requisição inválida",
          body: {
            error: "Invalid keyType. Allowed: CPF, CNPJ, PHONE, EMAIL, EVP"
          }
        },
        {
          status: 401,
          label: "Não autorizado",
          body: {
            error: "Invalid token"
          }
        },
        {
          status: 500,
          label: "Erro interno do servidor",
          body: {
            error: "Failed to send PIX button"
          }
        }
      ]
    },
    'send-status': {
      title: 'Enviar Stories (Status)',
      description: 'Envia um story (status) com texto, imagem, vídeo ou áudio.',
      method: 'POST',
      path: '/send/status',
      icon: Send,
      color: 'orange',
      features: [
        'Texto com estilo e cor de fundo',
        'Imagens com legenda opcional',
        'Vídeos com thumbnail',
        'Áudio normal ou mensagem de voz',
        'Múltiplas cores e fontes disponíveis'
      ],
      params: [
        { name: 'type', type: 'string', required: true, description: 'Tipo: text, image, video, audio' },
        { name: 'text', type: 'string', required: false, description: 'Texto principal ou legenda' },
        { name: 'background_color', type: 'number', required: false, description: 'Código da cor de fundo (1-19)' },
        { name: 'font', type: 'number', required: false, description: 'Estilo da fonte (0-8, apenas para text)' },
        { name: 'file', type: 'string', required: false, description: 'URL ou Base64 do arquivo (obrigatório para image/video/audio)' },
        { name: 'thumbnail', type: 'string', required: false, description: 'URL ou Base64 da miniatura (opcional para vídeos)' },
        { name: 'mimetype', type: 'string', required: false, description: 'MIME type do arquivo (opcional)' }
      ],
      exampleRequest: {
        type: "text",
        text: "Novidades chegando!",
        background_color: 7,
        font: 1
      },
      exampleResponse: {
        Id: "ABCD1234",
        status: "Pending",
        messageTimestamp: 1672531200000
      }
    }
  };

  const currentEndpoint = endpointData[selectedEndpoint];
  
  // Verificação de segurança para evitar erros
  if (!currentEndpoint) {
  return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-600 font-semibold">Endpoint não encontrado</p>
          <p className="text-gray-600 mt-2">Por favor, selecione um endpoint válido.</p>
        </div>
      </div>
    );
  }
  
  const IconComponent = currentEndpoint.icon;

  const responseExamples = currentEndpoint.responses && currentEndpoint.responses.length > 0
    ? currentEndpoint.responses
    : currentEndpoint.exampleResponse
    ? [
        {
          status: 200,
          label: 'Resposta de Exemplo',
          body: currentEndpoint.exampleResponse,
        },
      ]
    : [];

  const responseSignature = responseExamples
    .map((response, idx) => `${idx}-${response.status}-${response.label}`)
    .join('|');

  useEffect(() => {
    const nextState: Record<string, boolean> = {};
    responseExamples.forEach((_, idx) => {
      const key = `${selectedEndpoint}-${idx}`;
      nextState[key] = idx === 0;
    });
    setExpandedResponses(nextState);
  }, [selectedEndpoint, responseSignature]);

  return (
    <div className="flex h-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-slate-200 overflow-y-auto shadow-lg">
        <div className="p-4 border-b border-slate-200 bg-gradient-to-br from-blue-500 to-indigo-600">
          <h3 className="text-xs font-semibold text-blue-100 mb-1 tracking-wider uppercase">Endpoints</h3>
          <div className="text-2xl font-bold text-white">6</div>
          <p className="text-xs text-blue-100 mt-0.5">Recursos disponíveis</p>
          </div>

        <div className="p-3">
          {endpoints.map((group) => {
            const isExpanded = expandedGroups.includes(group.id);
            const toggleGroup = () => {
              setExpandedGroups(prev =>
                prev.includes(group.id)
                  ? prev.filter(id => id !== group.id)
                  : [...prev, group.id]
              );
            };

            return (
              <div key={group.id} className="mb-2">
                <button
                  onClick={toggleGroup}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 rounded-xl transition-all duration-200 font-medium"
                >
                  <div className="flex items-center space-x-3">
                    <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    <span>{group.label}</span>
                    </div>
                  <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">{group.count}</span>
                </button>

                {isExpanded && group.children.length > 0 && (
                  <div className="ml-4 mt-2 space-y-1">
                    {group.children.map((child) => (
                      <button
                        key={child.id}
                        onClick={() => setSelectedEndpoint(child.id)}
                        className={`w-full flex items-center justify-between px-4 py-3 text-sm rounded-xl transition-all duration-200 ${
                          selectedEndpoint === child.id
                            ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30'
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span className="text-left text-xs font-medium">{child.label}</span>
                        <span className={`text-xs px-2.5 py-1 rounded-md font-bold ${
                          child.id === 'send-text'
                            ? selectedEndpoint === child.id ? 'bg-white/20 text-white' : 'bg-cyan-500 text-white'
                            : selectedEndpoint === child.id ? 'bg-white/20 text-white' : 'bg-green-500 text-white'
                        }`}>
                          {child.method}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 border-b border-indigo-500 px-5 py-3 shadow-xl">
          <div className="flex items-center space-x-2 mb-1.5">
            <span className={`px-2 py-0.5 rounded text-xs font-bold shadow-lg ${
              currentEndpoint.color === 'cyan' ? 'bg-cyan-500 text-white' : 
              currentEndpoint.color === 'green' ? 'bg-green-500 text-white' :
              currentEndpoint.color === 'purple' ? 'bg-purple-500 text-white' :
              currentEndpoint.color === 'indigo' ? 'bg-indigo-500 text-white' :
              currentEndpoint.color === 'orange' ? 'bg-orange-500 text-white' : 'bg-gray-500 text-white'
            }`}>
              {currentEndpoint.method}
                  </span>
            <h1 className="text-base font-bold text-white/90">{currentEndpoint.path}</h1>
          </div>
          <h2 className="text-xl font-bold text-white mb-1">{currentEndpoint.title}</h2>
          <p className="text-blue-100 text-xs">{currentEndpoint.description}</p>
        </div>

        <div className="grid grid-cols-2 divide-x divide-slate-200">
          {/* Left Column - Documentation */}
          <div className="p-8 space-y-6 bg-white">
            {/* Tokens Section */}
            {!loadingInstances && instances.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-lg">
                <div className="bg-gradient-to-r from-emerald-500 to-green-600 px-6 py-4 border-b border-emerald-400">
                  <h3 className="font-bold text-white flex items-center">
                    <Smartphone className="w-5 h-5 mr-2" />
                    Tokens das Instâncias
                  </h3>
                </div>
                <div className="p-6 space-y-4">
                  {instances.slice(0, 2).map((instance) => (
                    <div key={instance.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700">{instance.name}</span>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          instance.status === 'connected'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {instance.status === 'connected' ? 'Conectada' : 'Desconectada'}
                        </span>
                      </div>
                      {instance.instance_token && instance.status === 'connected' && (
                        <div className="bg-slate-50 rounded-lg p-3 flex items-center space-x-2 border border-slate-200">
                          <code className="flex-1 text-xs text-slate-700 font-mono break-all">
                        {instance.instance_token}
                      </code>
                      <button
                        onClick={() => copyToClipboard(instance.instance_token!, `token-${instance.id}`)}
                            className="p-1.5 hover:bg-slate-200 rounded transition-colors flex-shrink-0"
                      >
                        {copiedEndpoint === `token-${instance.id}` ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                              <Copy className="w-4 h-4 text-slate-500" />
                        )}
                      </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

            {/* Rate Limiting */}
            <div className="bg-white rounded-2xl border border-orange-200 overflow-hidden shadow-lg">
              <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-3 border-b border-orange-400">
                <h3 className="font-bold text-white flex items-center text-sm">
                  <Shield className="w-4 h-4 mr-2" />
                  Rate Limiting
                </h3>
              </div>
              <div className="p-5">
                <p className="text-xs text-slate-600 mb-3">
                  Proteção contra abuso com limites de requisições:
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg p-3 text-center border border-orange-200">
                    <div className="text-xs text-slate-600 mb-1 font-medium">Limite por IP</div>
                    <div className="text-2xl font-bold text-orange-600">1.000</div>
                    <div className="text-xs text-slate-500">req/min</div>
              </div>
                  <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg p-3 text-center border border-orange-200">
                    <div className="text-xs text-slate-600 mb-1 font-medium">Limite por Token</div>
                    <div className="text-2xl font-bold text-orange-600">1.000</div>
                    <div className="text-xs text-slate-500">req/min</div>
            </div>
          </div>
        </div>
      </div>

            {/* Features */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-lg">
              <h3 className="text-lg font-bold text-slate-800 mb-4">Recursos Específicos</h3>
              <ul className="space-y-3">
                {currentEndpoint.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start space-x-3 text-sm text-slate-600">
                    <span className="text-green-500 mt-0.5 text-lg">✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
        </div>

            {/* Parameters */}
          <div>
              <h3 className="text-lg font-bold text-slate-800 mb-4">Campos Comuns</h3>
              <div className="space-y-3">
                {currentEndpoint.params.map((param) => (
                  <div key={param.name} className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <code className="text-sm font-mono font-bold text-blue-600">{param.name}</code>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">{param.type}</span>
                        {param.required && (
                          <span className="px-2.5 py-1 bg-red-100 text-red-600 rounded-full text-xs font-bold">
                            required
                          </span>
                        )}
                      </div>
              </div>
                    <p className="text-sm text-slate-600">{param.description}</p>
              </div>
                ))}
            </div>
          </div>

            {/* Example Response */}
          <div>
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                <div className={`w-2 h-2 rounded-full mr-2 ${responseExamples.length > 1 ? 'bg-gradient-to-r from-emerald-500 to-green-500' : 'bg-green-500'}`}></div>
                {responseExamples.length > 1 ? 'Respostas de Exemplo' : 'Resposta de Exemplo'}
              </h3>
              {responseExamples.length === 0 ? (
                <div className="bg-slate-100 border border-slate-300 rounded-xl p-6 text-sm text-slate-600">
                  Nenhum exemplo de resposta disponível.
                </div>
              ) : (
                <div className="space-y-5">
                  {responseExamples.map((response, idx) => {
                    const statusString = String(response.status);
                    const statusNumber = Number(statusString);
                    const statusText = `HTTP ${statusString}`;
                    const isError = !Number.isNaN(statusNumber)
                      ? statusNumber >= 400
                      : statusString.startsWith('4') || statusString.startsWith('5');
                    const cardClass = isError
                      ? 'bg-gradient-to-br from-red-950/80 via-red-900/60 to-slate-900 border-red-600/70'
                      : 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-emerald-600/70';
                    const barClass = isError
                      ? 'bg-gradient-to-r from-red-500 via-red-600 to-red-700'
                      : 'bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500';
                    const textClass = isError ? 'text-red-50' : 'text-emerald-50';
                    const badgeClass = isError ? 'text-red-300' : 'text-emerald-300';
                    const copyKey = `response-${statusString}-${idx}`;
                    const responseKey = `${selectedEndpoint}-${idx}`;
                    const isExpanded = expandedResponses[responseKey] ?? (idx === 0);

                    return (
                      <div
                        key={copyKey}
                        className={`rounded-xl border-2 shadow-xl overflow-hidden relative ${cardClass}`}
                      >
                        <div className={`absolute top-0 left-0 right-0 h-1.5 ${barClass}`}></div>
                        <div className="flex items-start justify-between px-5 pt-4 pb-2 space-x-3">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedResponses((prev) => ({
                                ...prev,
                                [responseKey]: !isExpanded,
                              }))
                            }
                            className="flex items-center text-left space-x-3 group"
                          >
                            <div className={`flex-shrink-0 rounded-full bg-white/10 p-1 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                              <ChevronRight className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <div className={`text-xs uppercase tracking-wide ${badgeClass}`}>{statusText}</div>
                              <h4 className="text-white text-sm font-semibold mt-1 group-hover:underline">
                                {response.label}
                              </h4>
                            </div>
                          </button>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() =>
                                setExpandedResponses((prev) => ({
                                  ...prev,
                                  [responseKey]: !isExpanded,
                                }))
                              }
                              className="hidden md:flex items-center space-x-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-xs font-medium text-white"
                              type="button"
                            >
                              <span>{isExpanded ? 'Recolher' : 'Expandir'}</span>
                            </button>
                            <button
                              onClick={() =>
                                copyToClipboard(JSON.stringify(response.body, null, 2), copyKey)
                              }
                              className="flex items-center space-x-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-xs font-medium text-white"
                              type="button"
                            >
                              {copiedEndpoint === copyKey ? (
                                <>
                                  <Check className="w-4 h-4 text-emerald-200" />
                                  <span>Copiado!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-4 h-4 text-emerald-100" />
                                  <span>Copiar</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="px-5 pb-5 pt-1">
                            <pre className={`text-sm md:text-base font-mono leading-relaxed overflow-x-auto ${textClass}`}>
                              <code className="block">
                                {JSON.stringify(response.body, null, 2)}
                              </code>
                            </pre>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Try It / Code */}
          <div className="bg-slate-50">
            {/* Tabs */}
            <div className="flex border-b border-slate-200 bg-white">
              <button
                onClick={() => setActiveTab('try')}
                className={`flex-1 px-6 py-4 text-sm font-bold transition-all ${
                  activeTab === 'try'
                    ? 'bg-white text-blue-600 border-b-3 border-blue-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                Try It
              </button>
              <button
                onClick={() => setActiveTab('code')}
                className={`flex-1 px-6 py-4 text-sm font-bold transition-all ${
                  activeTab === 'code'
                    ? 'bg-white text-blue-600 border-b-3 border-blue-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                Code
              </button>
            </div>

            <div className="p-6">
              {activeTab === 'try' ? (
                <div className="space-y-6">
                  {/* Form */}
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className={`px-4 py-3 font-bold text-sm text-white ${
                      currentEndpoint.color === 'cyan' ? 'bg-cyan-500' : 
                      currentEndpoint.color === 'green' ? 'bg-green-500' :
                      currentEndpoint.color === 'purple' ? 'bg-purple-500' :
                      currentEndpoint.color === 'indigo' ? 'bg-indigo-500' :
                      currentEndpoint.color === 'orange' ? 'bg-orange-500' : 'bg-gray-500'
                    }`}>
                      {currentEndpoint.method}
                    </div>
                    <div className="bg-slate-50 px-4 py-3 border-t border-slate-200">
                      <div className="text-sm text-slate-700 font-mono">
                        {displayApiUrl}{currentEndpoint.path}
          </div>
        </div>
      </div>


          <div>
                    <label className="text-sm font-bold text-slate-700 mb-2 flex items-center">
                      token
                      <span className="ml-1 text-red-500">*</span>
                    </label>
            <input
              type="text"
              value={testToken}
              onChange={(e) => setTestToken(e.target.value)}
                      placeholder="Digite seu token aqui"
                      className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-700 text-sm placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all shadow-sm"
            />
          </div>

          <div>
                    <h4 className="text-sm font-bold text-slate-700 mb-2">Body</h4>
                    <div className="bg-slate-900 rounded-xl p-4 border border-slate-700 font-mono text-sm shadow-lg">
                      <div className="space-y-3">
                        {(selectedEndpoint !== 'send-status') && (
                          <div className="flex items-center space-x-2">
                            <span className="text-cyan-400 font-semibold">"number"</span>
                            <span className="text-slate-400">:</span>
                            <input
                              type="text"
                              value={testNumber}
                              onChange={(e) => setTestNumber(e.target.value)}
                              className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                            />
                          </div>
                        )}
                        {selectedEndpoint === 'send-text' && (
                          <div className="flex items-center space-x-2">
                            <span className="text-cyan-400 font-semibold">"text"</span>
                            <span className="text-slate-400">:</span>
                            <input
                              type="text"
                              value={testMessage}
                              onChange={(e) => setTestMessage(e.target.value)}
                              className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                            />
                          </div>
                        )}
                        {selectedEndpoint === 'send-media' && (
                          <>
                            <div className="flex items-center space-x-2">
                              <span className="text-cyan-400 font-semibold">"type"</span>
                              <span className="text-slate-400">:</span>
                              <select
                                value={mediaType}
                                onChange={(e) => setMediaType(e.target.value)}
                                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                              >
                                <option value="image">image</option>
                                <option value="video">video</option>
                                <option value="document">document</option>
                                <option value="audio">audio</option>
                                <option value="myaudio">myaudio</option>
                                <option value="ptt">ptt</option>
                                <option value="sticker">sticker</option>
                              </select>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-cyan-400 font-semibold">"file"</span>
                              <span className="text-slate-400">:</span>
                              <input
                                type="text"
                                value={mediaFile}
                                onChange={(e) => setMediaFile(e.target.value)}
                                placeholder="URL ou base64"
                                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                              />
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-cyan-400 font-semibold">"text"</span>
                              <span className="text-slate-400">:</span>
                              <input
                                type="text"
                                value={mediaCaption}
                                onChange={(e) => setMediaCaption(e.target.value)}
                                placeholder="Caption/legenda"
                                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                              />
                            </div>
                            {mediaType === 'document' && (
                              <div className="flex items-center space-x-2">
                                <span className="text-cyan-400 font-semibold">"docName"</span>
                                <span className="text-slate-400">:</span>
                                <input
                                  type="text"
                                  value={docName}
                                  onChange={(e) => setDocName(e.target.value)}
                                  placeholder="Nome do arquivo"
                                  className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                                />
                              </div>
                            )}
                          </>
                        )}
                        {selectedEndpoint === 'send-menu' && (
                          <>
                            <div className="flex items-center space-x-2">
                              <span className="text-cyan-400 font-semibold">"type"</span>
                              <span className="text-slate-400">:</span>
                              <select
                                value={menuType}
                                onChange={(e) => setMenuType(e.target.value)}
                                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                              >
                                <option value="button">button</option>
                                <option value="list">list</option>
                                <option value="poll">poll</option>
                                <option value="carousel">carousel</option>
                              </select>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-cyan-400 font-semibold">"text"</span>
                              <span className="text-slate-400">:</span>
                              <input
                                type="text"
                                value={testMessage}
                                onChange={(e) => setTestMessage(e.target.value)}
                                placeholder="Texto principal"
                                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                              />
                            </div>
                            <div className="flex items-start space-x-2">
                              <span className="text-cyan-400 font-semibold mt-2">"choices"</span>
                              <span className="text-slate-400 mt-2">:</span>
                              <textarea
                                value={menuChoices}
                                onChange={(e) => setMenuChoices(e.target.value)}
                                placeholder="Uma opção por linha. Formato: texto|id"
                                rows={4}
                                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 resize-none"
                              />
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-cyan-400 font-semibold">"footerText"</span>
                              <span className="text-slate-400">:</span>
                              <input
                                type="text"
                                value={footerText}
                                onChange={(e) => setFooterText(e.target.value)}
                                placeholder="Texto do rodapé (opcional)"
                                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                              />
                            </div>
                            {menuType === 'list' && (
                              <div className="flex items-center space-x-2">
                                <span className="text-cyan-400 font-semibold">"listButton"</span>
                                <span className="text-slate-400">:</span>
                                <input
                                  type="text"
                                  value={listButton}
                                  onChange={(e) => setListButton(e.target.value)}
                                  placeholder="Texto do botão"
                                  className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                                />
                              </div>
                            )}
                            {menuType === 'poll' && (
                              <div className="flex items-center space-x-2">
                                <span className="text-cyan-400 font-semibold">"selectableCount"</span>
                                <span className="text-slate-400">:</span>
                                <input
                                  type="number"
                                  value={selectableCount}
                                  onChange={(e) => setSelectableCount(parseInt(e.target.value) || 1)}
                                  placeholder="Número de opções selecionáveis"
                                  className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                                />
                              </div>
                            )}
                            {menuType === 'button' && (
                              <div className="flex items-center space-x-2">
                                <span className="text-cyan-400 font-semibold">"imageButton"</span>
                                <span className="text-slate-400">:</span>
                                <input
                                  type="text"
                                  value={imageButton}
                                  onChange={(e) => setImageButton(e.target.value)}
                                  placeholder="URL da imagem (opcional)"
                                  className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                                />
                              </div>
                            )}
                          </>
                        )}
                        {selectedEndpoint === 'send-carousel' && (
                          <>
                            <div className="flex items-center space-x-2">
                              <span className="text-cyan-400 font-semibold">"text"</span>
                              <span className="text-slate-400">:</span>
                              <input
                                type="text"
                                value={testMessage}
                                onChange={(e) => setTestMessage(e.target.value)}
                                placeholder="Texto principal"
                                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                              />
                            </div>
                            <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700">
                              <div className="text-xs text-slate-400 mb-2">carousel[0]:</div>
                              <div className="space-y-2">
                                <div className="flex items-center space-x-2">
                                  <span className="text-cyan-400 font-semibold text-xs">"text"</span>
                                  <span className="text-slate-400">:</span>
                                  <input
                                    type="text"
                                    value={carouselItems}
                                    onChange={(e) => setCarouselItems(e.target.value)}
                                    placeholder="Texto do cartão"
                                    className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                                  />
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className="text-cyan-400 font-semibold text-xs">"image"</span>
                                  <span className="text-slate-400">:</span>
                                  <input
                                    type="text"
                                    value={carouselImage}
                                    onChange={(e) => setCarouselImage(e.target.value)}
                                    placeholder="URL da imagem"
                                    className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                                  />
                                </div>
                                <div className="bg-slate-700/50 rounded-lg p-2 border border-slate-600">
                                  <div className="text-xs text-slate-400 mb-1">buttons[0]:</div>
                                  <div className="space-y-2">
                                    <div className="flex items-center space-x-2">
                                      <span className="text-cyan-400 font-semibold text-xs">"id"</span>
                                      <span className="text-slate-400">:</span>
                                      <input
                                        type="text"
                                        value={buttonId}
                                        onChange={(e) => setButtonId(e.target.value)}
                                        placeholder="ID do botão"
                                        className="flex-1 bg-slate-600 border border-slate-500 rounded-lg px-2 py-1 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                                      />
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <span className="text-cyan-400 font-semibold text-xs">"text"</span>
                                      <span className="text-slate-400">:</span>
                                      <input
                                        type="text"
                                        value={buttonText}
                                        onChange={(e) => setButtonText(e.target.value)}
                                        placeholder="Texto do botão"
                                        className="flex-1 bg-slate-600 border border-slate-500 rounded-lg px-2 py-1 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                                      />
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <span className="text-cyan-400 font-semibold text-xs">"type"</span>
                                      <span className="text-slate-400">:</span>
                                      <select
                                        value={buttonType}
                                        onChange={(e) => setButtonType(e.target.value)}
                                        className="flex-1 bg-slate-600 border border-slate-500 rounded-lg px-2 py-1 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                                      >
                                        <option value="REPLY">REPLY</option>
                                        <option value="URL">URL</option>
                                        <option value="COPY">COPY</option>
                                        <option value="CALL">CALL</option>
                                      </select>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                        {selectedEndpoint === 'send-pix-button' && (
                          <>
                            <div className="flex items-center space-x-2">
                              <span className="text-cyan-400 font-semibold">"pixType"</span>
                              <span className="text-slate-400">:</span>
                              <select
                                value={pixType}
                                onChange={(e) => setPixType(e.target.value)}
                                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                              >
                                <option value="CPF">CPF</option>
                                <option value="CNPJ">CNPJ</option>
                                <option value="PHONE">PHONE</option>
                                <option value="EMAIL">EMAIL</option>
                                <option value="EVP">EVP</option>
                              </select>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-cyan-400 font-semibold">"pixKey"</span>
                              <span className="text-slate-400">:</span>
                              <input
                                type="text"
                                value={pixKey}
                                onChange={(e) => setPixKey(e.target.value)}
                                placeholder="Chave PIX"
                                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                              />
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-cyan-400 font-semibold">"pixName"</span>
                              <span className="text-slate-400">:</span>
                              <input
                                type="text"
                                value={pixName}
                                onChange={(e) => setPixName(e.target.value)}
                                placeholder="Nome do recebedor (opcional)"
                                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                              />
                            </div>
                          </>
                        )}
                        {selectedEndpoint === 'send-status' && (
                          <>
                            <div className="flex items-center space-x-2">
                              <span className="text-cyan-400 font-semibold">"type"</span>
                              <span className="text-slate-400">:</span>
                              <select
                                value={statusType}
                                onChange={(e) => setStatusType(e.target.value)}
                                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                              >
                                <option value="text">text</option>
                                <option value="image">image</option>
                                <option value="video">video</option>
                                <option value="audio">audio</option>
                              </select>
                            </div>
                            {statusType === 'text' ? (
                              <>
                                <div className="flex items-center space-x-2">
                                  <span className="text-cyan-400 font-semibold">"text"</span>
                                  <span className="text-slate-400">:</span>
                                  <input
                                    type="text"
                                    value={testMessage}
                                    onChange={(e) => setTestMessage(e.target.value)}
                                    placeholder="Texto do status"
                                    className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                                  />
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className="text-cyan-400 font-semibold">"background_color"</span>
                                  <span className="text-slate-400">:</span>
                                  <input
                                    type="number"
                                    value={backgroundColor}
                                    onChange={(e) => setBackgroundColor(parseInt(e.target.value) || 7)}
                                    placeholder="1-19"
                                    min="1"
                                    max="19"
                                    className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                                  />
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className="text-cyan-400 font-semibold">"font"</span>
                                  <span className="text-slate-400">:</span>
                                  <input
                                    type="number"
                                    value={font}
                                    onChange={(e) => setFont(parseInt(e.target.value) || 1)}
                                    placeholder="0-8"
                                    min="0"
                                    max="8"
                                    className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                                  />
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="flex items-center space-x-2">
                                  <span className="text-cyan-400 font-semibold">"file"</span>
                                  <span className="text-slate-400">:</span>
                                  <input
                                    type="text"
                                    value={statusFile}
                                    onChange={(e) => setStatusFile(e.target.value)}
                                    placeholder="URL ou base64 do arquivo"
                                    className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                                  />
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className="text-cyan-400 font-semibold">"text"</span>
                                  <span className="text-slate-400">:</span>
                                  <input
                                    type="text"
                                    value={testMessage}
                                    onChange={(e) => setTestMessage(e.target.value)}
                                    placeholder="Legenda (opcional)"
                                    className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                                  />
                                </div>
                                {statusType === 'video' && (
                                  <div className="flex items-center space-x-2">
                                    <span className="text-cyan-400 font-semibold">"thumbnail"</span>
                                    <span className="text-slate-400">:</span>
                                    <input
                                      type="text"
                                      value={thumbnail}
                                      onChange={(e) => setThumbnail(e.target.value)}
                                      placeholder="URL da miniatura (opcional)"
                                      className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                                    />
                                  </div>
                                )}
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>
          </div>

          <button
            onClick={handleTest}
            disabled={isLoading}
                    className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold py-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 shadow-lg shadow-orange-500/30"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Enviando...</span>
              </>
            ) : (
              <>
                        <Zap className="w-5 h-5" />
                        <span>Enviar Requisição</span>
              </>
            )}
          </button>

          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${
                  testResponse && (testResponse.includes('"error"') || testResponse.includes('"Error"'))
                    ? 'bg-red-500 animate-pulse' 
                    : testResponse
                    ? 'bg-green-500'
                    : 'bg-slate-400'
                }`}></div>
                <div className="text-base font-bold text-slate-800">
                  {testResponse 
                    ? (testResponse.includes('"error"') || testResponse.includes('"Error"')
                      ? 'Resposta com Erro' 
                      : 'Resposta de Sucesso')
                    : 'Aguardando Resposta'}
                </div>
              </div>
              {testResponse && (
                <button
                  onClick={() => copyToClipboard(testResponse, 'test-response')}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors text-xs font-medium text-slate-700"
                >
                  {copiedEndpoint === 'test-response' ? (
                    <>
                      <Check className="w-4 h-4 text-green-600" />
                      <span>Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-slate-600" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              )}
            </div>
            <div className={`rounded-xl p-6 border-2 shadow-xl overflow-hidden relative ${
              testResponse 
                ? (testResponse.includes('"error"') || testResponse.includes('"Error"')
                  ? 'bg-gradient-to-br from-red-950/80 via-red-900/60 to-slate-900 border-red-600/70'
                  : 'bg-gradient-to-br from-green-950/50 via-emerald-900/40 to-slate-900 border-green-600/70')
                : 'bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700'
            }`}>
              <div className={`absolute top-0 left-0 right-0 h-1.5 ${
                testResponse
                  ? (testResponse.includes('"error"') || testResponse.includes('"Error"')
                    ? 'bg-gradient-to-r from-red-500 via-red-600 to-red-700'
                    : 'bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500')
                  : 'bg-slate-600'
              }`}></div>
              <div className="relative max-h-96 overflow-y-auto pt-2">
                {!testResponse ? (
                  <div className="text-center py-16 text-slate-400">
                    <div className="text-lg font-semibold mb-2 text-slate-300">Nenhuma resposta ainda</div>
                    <div className="text-sm">Envie uma requisição para ver o resultado aqui</div>
                  </div>
                ) : (
                  <pre className={`text-base font-mono leading-relaxed whitespace-pre-wrap ${
                    testResponse.includes('"error"') || testResponse.includes('"Error"')
                      ? 'text-red-50'
                      : 'text-green-50'
                  }`}>
                    <code className="block">
                      {(() => {
                        try {
                          const parsed = JSON.parse(testResponse);
                          return JSON.stringify(parsed, null, 2);
                        } catch {
                          // Se não for JSON válido, retorna como texto simples
                          return testResponse;
                        }
                      })()}
                    </code>
                  </pre>
                )}
              </div>
            </div>
          </div>
                </div>
              ) : (
                <div>
                  <div className="mb-4">
                    <select className="bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-slate-700 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm">
                      <option>cURL</option>
                      <option>JavaScript</option>
                      <option>Python</option>
                    </select>
                  </div>

                  <div className="bg-slate-900 rounded-xl p-5 border border-slate-700 relative shadow-lg">
                    <button
                      onClick={() => copyToClipboard(`curl --request POST \\\n  --url ${displayApiUrl}${currentEndpoint.path} \\\n  --header 'Content-Type: application/json' \\\n  --header 'Authorization: Bearer ${SUPABASE_ANON_KEY?.substring(0, 30)}...' \\\n  --header 'token: seu_token_de_instancia' \\\n  --data '${JSON.stringify(currentEndpoint.exampleRequest, null, 2)}'`, 'curl-code')}
                      className="absolute top-3 right-3 p-2 hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      {copiedEndpoint === 'curl-code' ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                    <pre className="text-sm text-slate-100 font-mono whitespace-pre-wrap pr-12">
{`curl --request POST \\
  --url ${displayApiUrl}${currentEndpoint.path} \\
  --header 'Content-Type: application/json' \\
  --header 'Authorization: Bearer SUA_CHAVE_ANON' \\
  --header 'token: seu_token_de_instancia' \\
  --data '${JSON.stringify(currentEndpoint.exampleRequest, null, 2)}'`}
                    </pre>
                    <div className="mt-3 bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                      <p className="text-xs text-slate-300 mb-1">
                        <strong className="text-slate-100">Nota:</strong> O header <code className="bg-slate-700 px-1 py-0.5 rounded text-slate-200">Authorization</code> é necessário apenas quando usar a Edge Function diretamente.
                      </p>
                      <p className="text-xs text-slate-300">
                        Para o Cloudflare Worker, apenas o header <code className="bg-slate-700 px-1 py-0.5 rounded text-slate-200">token</code> é necessário.
                      </p>
                    </div>
              </div>
            </div>
          )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
