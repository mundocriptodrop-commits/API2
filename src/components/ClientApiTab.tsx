import { useState, useEffect } from 'react';
import { Copy, Check, ChevronRight, ArrowRight, Send, Image, Smartphone, Zap, Plus, Trash2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

declare global {
  interface ImportMetaEnv {
    readonly VITE_SUPABASE_ANON_KEY?: string;
    readonly VITE_SUPABASE_URL?: string;
    readonly VITE_PUBLIC_API_URL?: string;
  }
}

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

type MenuButtonAction = 'reply' | 'url' | 'call' | 'copy';

type MenuButtonConfig = {
  id: string;
  label: string;
  action: MenuButtonAction;
  value?: string;
  replyId?: string;
};

type MenuListItem = {
  id: string;
  label: string;
  value?: string;
  description?: string;
};

type MenuListSection = {
  id: string;
  title: string;
  items: MenuListItem[];
};

type MenuPollOption = {
  id: string;
  label: string;
};

type MenuCarouselCard = {
  id: string;
  title: string;
  subtitle?: string;
  image?: string;
  buttons: MenuButtonConfig[];
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
  const generateId = () => Math.random().toString(36).slice(2, 10);

  const createMenuButton = (overrides?: Partial<MenuButtonConfig>): MenuButtonConfig => ({
    id: overrides?.id ?? generateId(),
    label: overrides?.label ?? 'Novo botão',
    action: overrides?.action ?? 'reply',
    value: overrides?.value,
    replyId: overrides?.replyId ?? '',
  });

  const createMenuListItem = (overrides?: Partial<MenuListItem>): MenuListItem => ({
    id: overrides?.id ?? generateId(),
    label: overrides?.label ?? 'Novo item',
    value: overrides?.value,
    description: overrides?.description,
  });

  const createMenuListSection = (overrides?: Partial<MenuListSection>): MenuListSection => ({
    id: overrides?.id ?? generateId(),
    title: overrides?.title ?? 'Nova seção',
    items: overrides?.items ?? [createMenuListItem()],
  });

  const createMenuPollOption = (overrides?: Partial<MenuPollOption>): MenuPollOption => ({
    id: overrides?.id ?? generateId(),
    label: overrides?.label ?? 'Opção',
  });

  const createMenuCarouselCard = (overrides?: Partial<MenuCarouselCard>): MenuCarouselCard => ({
    id: overrides?.id ?? generateId(),
    title: overrides?.title ?? 'Novo cartão',
    subtitle: overrides?.subtitle,
    image: overrides?.image,
    buttons: overrides?.buttons ?? [createMenuButton({ label: 'Comprar agora', replyId: 'COMPRAR', action: 'reply' })],
  });

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
  const [footerText, setFooterText] = useState('Escolha uma das opções abaixo');
  const [listButton, setListButton] = useState('Ver Opções');
  const [selectableCount, setSelectableCount] = useState(1);
  const [imageButton, setImageButton] = useState('');
  const [menuButtons, setMenuButtons] = useState<MenuButtonConfig[]>([
    createMenuButton({ label: 'Suporte Técnico', replyId: 'suporte' }),
    createMenuButton({ label: 'Fazer Pedido', replyId: 'pedido' }),
    createMenuButton({ label: 'Nosso Site', action: 'url', value: 'https://exemplo.com' }),
  ]);
  const [menuListSections, setMenuListSections] = useState<MenuListSection[]>([
    createMenuListSection({
      title: 'Serviços',
      items: [
        createMenuListItem({ label: 'Suporte Técnico', value: 'suporte', description: 'Atendimento imediato' }),
        createMenuListItem({ label: 'Fazer Pedido', value: 'pedido', description: 'Monte seu pedido completo' }),
      ],
    }),
  ]);
  const [menuPollOptions, setMenuPollOptions] = useState<MenuPollOption[]>([
    createMenuPollOption({ label: 'Opção 1' }),
    createMenuPollOption({ label: 'Opção 2' }),
  ]);
  const [menuCarouselCards, setMenuCarouselCards] = useState<MenuCarouselCard[]>([
    createMenuCarouselCard({
      title: 'Produto Exemplo',
      subtitle: 'Descrição resumida do produto',
      image: 'https://exemplo.com/produto.jpg',
      buttons: [
        createMenuButton({ label: 'Comprar Agora', replyId: 'COMPRAR_PRODUTO', action: 'reply' }),
        createMenuButton({ label: 'Ver Detalhes', action: 'url', value: 'https://exemplo.com/produto' }),
      ],
    }),
  ]);
  
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

  const DEFAULT_PUBLIC_API_URL = 'https://api.evasend.com.br/whatsapp';
  const sanitizedPublicApiUrl = import.meta.env.VITE_PUBLIC_API_URL
    ? import.meta.env.VITE_PUBLIC_API_URL.replace(/\/$/, '')
    : undefined;
  const sanitizedSupabaseUrl = import.meta.env.VITE_SUPABASE_URL
    ? `${import.meta.env.VITE_SUPABASE_URL.replace(/\/$/, '')}/functions/v1`
    : undefined;

  const baseUrlCandidates = [
    sanitizedPublicApiUrl,
    DEFAULT_PUBLIC_API_URL,
    sanitizedSupabaseUrl,
  ].filter((value): value is string => Boolean(value));

  const apiBaseUrl = baseUrlCandidates[0]!;
  const requiresSupabaseAuth = sanitizedSupabaseUrl !== undefined && apiBaseUrl === sanitizedSupabaseUrl;
  const buildEndpointUrl = (path: string) => `${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;

  const ensureMenuDefaults = (type: string) => {
    if (type === 'button' && menuButtons.length === 0) {
      setMenuButtons([createMenuButton()]);
    }
    if (type === 'list' && menuListSections.length === 0) {
      setMenuListSections([createMenuListSection()]);
    }
    if (type === 'poll' && menuPollOptions.length === 0) {
      setMenuPollOptions([createMenuPollOption(), createMenuPollOption()]);
    }
    if (type === 'carousel' && menuCarouselCards.length === 0) {
      setMenuCarouselCards([createMenuCarouselCard()]);
    }
  };

  const handleMenuTypeChange = (nextType: string) => {
    setMenuType(nextType);
    ensureMenuDefaults(nextType);
  };

  const handleAddMenuButton = () => {
    setMenuButtons((prev) => [...prev, createMenuButton({ label: `Botão ${prev.length + 1}` })]);
  };

  const handleUpdateMenuButton = (buttonId: string, updates: Partial<MenuButtonConfig>) => {
    setMenuButtons((prev) =>
      prev.map((button) =>
        button.id === buttonId
          ? {
              ...button,
              ...updates,
              value: updates.value !== undefined ? updates.value : button.value,
              replyId: updates.replyId !== undefined ? updates.replyId : button.replyId,
            }
          : button
      )
    );
  };

  const handleRemoveMenuButton = (buttonId: string) => {
    setMenuButtons((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((button) => button.id !== buttonId);
    });
  };

  const handleAddMenuListSection = () => {
    setMenuListSections((prev) => [...prev, createMenuListSection({ title: `Seção ${prev.length + 1}` })]);
  };

  const handleUpdateMenuListSection = (sectionId: string, updates: Partial<MenuListSection>) => {
    setMenuListSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              ...updates,
              items: updates.items ?? section.items,
            }
          : section
      )
    );
  };

  const handleRemoveMenuListSection = (sectionId: string) => {
    setMenuListSections((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((section) => section.id !== sectionId);
    });
  };

  const handleAddMenuListItem = (sectionId: string) => {
    setMenuListSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              items: [...section.items, createMenuListItem({ label: `Item ${section.items.length + 1}` })],
            }
          : section
      )
    );
  };

  const handleUpdateMenuListItem = (sectionId: string, itemId: string, updates: Partial<MenuListItem>) => {
    setMenuListSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              items: section.items.map((item) =>
                item.id === itemId
                  ? {
                      ...item,
                      ...updates,
                    }
                  : item
              ),
            }
          : section
      )
    );
  };

  const handleRemoveMenuListItem = (sectionId: string, itemId: string) => {
    setMenuListSections((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              items: section.items.length === 1 ? section.items : section.items.filter((item) => item.id !== itemId),
            }
          : section
      )
    );
  };

  const handleAddMenuPollOption = () => {
    setMenuPollOptions((prev) => [...prev, createMenuPollOption({ label: `Opção ${prev.length + 1}` })]);
  };

  const handleUpdateMenuPollOption = (optionId: string, label: string) => {
    setMenuPollOptions((prev) =>
      prev.map((option) =>
        option.id === optionId
          ? {
              ...option,
              label,
            }
          : option
      )
    );
  };

  const handleRemoveMenuPollOption = (optionId: string) => {
    setMenuPollOptions((prev) => {
      if (prev.length <= 2) return prev;
      return prev.filter((option) => option.id !== optionId);
    });
  };

  const handleAddMenuCarouselCard = () => {
    setMenuCarouselCards((prev) => [
      ...prev,
      createMenuCarouselCard({ title: `Cartão ${prev.length + 1}`, buttons: [createMenuButton()] }),
    ]);
  };

  const handleUpdateMenuCarouselCard = (cardId: string, updates: Partial<MenuCarouselCard>) => {
    setMenuCarouselCards((prev) =>
      prev.map((card) =>
        card.id === cardId
          ? {
              ...card,
              ...updates,
              buttons: updates.buttons ?? card.buttons,
            }
          : card
      )
    );
  };

  const handleRemoveMenuCarouselCard = (cardId: string) => {
    setMenuCarouselCards((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((card) => card.id !== cardId);
    });
  };

  const handleAddButtonToCarouselCard = (cardId: string) => {
    setMenuCarouselCards((prev) =>
      prev.map((card) =>
        card.id === cardId
          ? {
              ...card,
              buttons: [...card.buttons, createMenuButton({ label: `Botão ${card.buttons.length + 1}` })],
            }
          : card
      )
    );
  };

  const handleUpdateCarouselButton = (cardId: string, buttonId: string, updates: Partial<MenuButtonConfig>) => {
    setMenuCarouselCards((prev) =>
      prev.map((card) =>
        card.id === cardId
          ? {
              ...card,
              buttons: card.buttons.map((button) =>
                button.id === buttonId
                  ? {
                      ...button,
                      ...updates,
                      value: updates.value !== undefined ? updates.value : button.value,
                      replyId: updates.replyId !== undefined ? updates.replyId : button.replyId,
                    }
                  : button
              ),
            }
          : card
      )
    );
  };

  const handleRemoveCarouselButton = (cardId: string, buttonId: string) => {
    setMenuCarouselCards((prev) =>
      prev.map((card) =>
        card.id === cardId
          ? {
              ...card,
              buttons: card.buttons.length === 1 ? card.buttons : card.buttons.filter((button) => button.id !== buttonId),
            }
          : card
      )
    );
  };

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

  const escapeForShellSingleQuotes = (value: string) =>
    value.replace(/'/g, `'\"'\"'`);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedEndpoint(id);
    setTimeout(() => setCopiedEndpoint(null), 2000);
  };

  const buildRequestPayload = (): Record<string, unknown> => {
    switch (selectedEndpoint) {
      case 'send-text':
        return {
          number: testNumber,
          text: testMessage,
        };
      case 'send-media':
        return {
          number: testNumber,
          type: mediaType,
          file: mediaFile,
          text: mediaCaption,
          ...(mediaType === 'document' && docName ? { docName } : {}),
        };
      case 'send-menu': {
        const payload: Record<string, unknown> = {
          number: testNumber,
          type: menuType,
          text: testMessage,
        };

        const choices: string[] = [];

        if (menuType === 'button') {
          menuButtons.forEach((button) => {
            const label = button.label.trim();
            if (!label) return;

            let formatted = label;

            switch (button.action) {
              case 'reply': {
                const replyId = button.replyId?.trim();
                formatted = replyId ? `${label}|${replyId}` : label;
                break;
              }
              case 'url': {
                const url = button.value?.trim();
                if (!url) return;
                formatted = `${label}|${url}`;
                break;
              }
              case 'call': {
                const phone = button.value?.trim();
                if (!phone) return;
                formatted = `${label}|call:${phone}`;
                break;
              }
              case 'copy': {
                const code = button.value?.trim();
                if (!code) return;
                formatted = `${label}|copy:${code}`;
                break;
              }
              default:
                break;
            }

            choices.push(formatted);
          });

          if (imageButton) {
            payload.imageButton = imageButton;
          }
          if (footerText) {
            payload.footerText = footerText;
          }
        }

        if (menuType === 'list') {
          menuListSections.forEach((section) => {
            const title = section.title.trim();
            if (title) {
              choices.push(`[${title}]`);
            }
            section.items.forEach((item) => {
              const label = item.label.trim();
              if (!label) return;
              const parts = [label];
              if (item.value?.trim()) {
                parts.push(item.value.trim());
              }
              if (item.description?.trim()) {
                parts.push(item.description.trim());
              }
              choices.push(parts.join('|'));
            });
          });

          if (footerText) {
            payload.footerText = footerText;
          }
          if (listButton) {
            payload.listButton = listButton;
          }
        }

        if (menuType === 'poll') {
          menuPollOptions.forEach((option) => {
            const label = option.label.trim();
            if (!label) return;
            choices.push(label);
          });
          payload.selectableCount = selectableCount;
        }

        if (menuType === 'carousel') {
          menuCarouselCards.forEach((card) => {
            const title = card.title.trim();
            const subtitle = card.subtitle?.trim();
            if (title) {
              const cardText = subtitle ? `${title}\n${subtitle}` : title;
              choices.push(`[${cardText}]`);
            }
            const image = card.image?.trim();
            if (image) {
              choices.push(`{${image}}`);
            }
            card.buttons.forEach((button) => {
              const label = button.label.trim();
              if (!label) return;

              let formatted = label;

              switch (button.action) {
                case 'reply': {
                  const replyId = button.replyId?.trim();
                  formatted = replyId ? `${label}|${replyId}` : label;
                  break;
                }
                case 'url': {
                  const url = button.value?.trim();
                  if (!url) return;
                  formatted = `${label}|${url}`;
                  break;
                }
                case 'call': {
                  const phone = button.value?.trim();
                  if (!phone) return;
                  formatted = `${label}|call:${phone}`;
                  break;
                }
                case 'copy': {
                  const code = button.value?.trim();
                  if (!code) return;
                  formatted = `${label}|copy:${code}`;
                  break;
                }
                default:
                  break;
              }

              choices.push(formatted);
            });
          });

          if (footerText) {
            payload.footerText = footerText;
          }
        }

        payload.choices = choices;

        return payload;
      }
      case 'send-carousel':
        return {
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
      case 'send-pix-button':
        return {
          number: testNumber,
          pixType,
          pixKey,
          ...(pixName ? { pixName } : {}),
        };
      case 'send-status':
        if (statusType === 'text') {
          return {
            type: statusType,
            text: testMessage,
            background_color: backgroundColor,
            font,
          };
        }

        return {
          type: statusType,
          ...(statusFile ? { file: statusFile } : {}),
          ...(testMessage ? { text: testMessage } : {}),
          ...(thumbnail && statusType === 'video' ? { thumbnail } : {}),
        };
      default:
        return {};
    }
  };

  const handleTest = async () => {
    if (!testToken) {
      setTestResponse('{"error": "Token é obrigatório"}');
      return;
    }

    setIsLoading(true);
    setTestResponse('');

    try {
      const body = buildRequestPayload();

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        token: testToken,
      };

      if (requiresSupabaseAuth && SUPABASE_ANON_KEY) {
        headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
      }

      const response = await fetch(buildEndpointUrl(currentEndpoint.path), {
        method: 'POST',
        headers,
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
      path: '/send-text',
      icon: Send,
      color: 'cyan',
      features: [
        'Preview de links com suporte a personalização automática ou customizada',
        'Formatação básica do texto',
        'Substituição automática de placeholders dinâmicos'
      ],
      params: [
        { name: 'number', type: 'string', required: true, description: 'Número de telefone com código do país, sem espaços ou caracteres especiais (ex: 5511999999999)' },
        { name: 'text', type: 'string', required: true, description: 'Mensagem de texto a ser enviada. Suporta formatação básica e placeholders dinâmicos (ex: {{nome}})' },
        { name: 'replyid', type: 'string', required: false, description: 'ID da mensagem para responder (formato: 3EB0538DA65A59F6D8A251)' },
        { name: 'mentions', type: 'string', required: false, description: 'Números para mencionar, separados por vírgula (ex: 5511999999999,5511888888888)' },
        { name: 'readchat', type: 'boolean', required: false, description: 'Marca a conversa como lida após o envio (padrão: false)' },
        { name: 'readmessages', type: 'boolean', required: false, description: 'Marca as últimas mensagens recebidas como lidas (padrão: false)' },
        { name: 'delay', type: 'number', required: false, description: 'Atraso em milissegundos antes do envio. Durante o atraso aparecerá "Digitando..." (padrão: 0)' },
        { name: 'track_source', type: 'string', required: false, description: 'Origem do rastreamento da mensagem para analytics (ex: "chatwoot", "zapier")' },
        { name: 'track_id', type: 'string', required: false, description: 'ID para rastreamento da mensagem. Aceita valores duplicados (ex: "msg_123456789")' }
      ],
      exampleRequest: {
        number: "5511999999999",
        text: "Olá! Como posso ajudar?"
      },
      responses: [
        {
          status: 200,
          label: "Mensagem enviada com sucesso",
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
              message: "Message sent successfully"
            }
          }
        },
        {
          status: 400,
          label: "Requisição inválida",
          body: {
            error: "Missing number or text"
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
          status: 429,
          label: "Limite de requisições excedido",
          body: {
            error: "Rate limit exceeded"
          }
        },
        {
          status: 500,
          label: "Erro interno do servidor",
          body: {
            error: "Failed to send message"
          }
        }
      ]
    },
    'send-media': {
      title: 'Enviar mídia (imagem, vídeo, áudio ou documento)',
      description: 'Envia arquivos de mídia com caption opcional.',
      method: 'POST',
      path: '/send-media',
      icon: Image,
      color: 'green',
      features: [
        'Suporte para imagem, vídeo, documento, áudio',
        'Caption com formatação e placeholders',
        'Base64 ou URL para arquivo'
      ],
      params: [
        { name: 'number', type: 'string', required: true, description: 'Número de telefone com código do país, sem espaços ou caracteres especiais (ex: 5511999999999)' },
        { name: 'type', type: 'string', required: true, description: 'Tipo de mídia: image, video, document, audio, myaudio, ptt, sticker' },
        { name: 'file', type: 'string', required: true, description: 'URL pública (https://) ou string base64 do arquivo. Formatos: JPG/PNG/GIF (imagem), MP4/AVI/MOV (vídeo), PDF/DOC/XLS (documento), MP3/WAV/OGG (áudio)' },
        { name: 'text', type: 'string', required: false, description: 'Caption/legenda da mídia. Suporta formatação e placeholders dinâmicos (ex: {{nome}}). Máximo: 1024 caracteres' },
        { name: 'docName', type: 'string', required: false, description: 'Nome do arquivo com extensão (obrigatório para type: document, ex: "relatorio.pdf")' },
        { name: 'replyid', type: 'string', required: false, description: 'ID da mensagem para responder (formato: 3EB0538DA65A59F6D8A251)' },
        { name: 'mentions', type: 'string', required: false, description: 'Números para mencionar, separados por vírgula (ex: 5511999999999,5511888888888)' },
        { name: 'readchat', type: 'boolean', required: false, description: 'Marca a conversa como lida após o envio (padrão: false)' },
        { name: 'readmessages', type: 'boolean', required: false, description: 'Marca as últimas mensagens recebidas como lidas (padrão: false)' },
        { name: 'delay', type: 'number', required: false, description: 'Atraso em milissegundos antes do envio. Durante o atraso aparecerá "Digitando..." (padrão: 0)' },
        { name: 'track_source', type: 'string', required: false, description: 'Origem do rastreamento da mensagem para analytics (ex: "chatwoot", "zapier")' },
        { name: 'track_id', type: 'string', required: false, description: 'ID para rastreamento da mensagem. Aceita valores duplicados (ex: "msg_123456789")' }
      ],
      exampleRequest: {
        number: "5511999999999",
        type: "image",
        file: "https://exemplo.com/foto.jpg",
        text: "Veja esta foto!"
      },
      responses: [
        {
          status: 200,
          label: "Mídia enviada com sucesso",
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
              message: "Media sent successfully",
              fileUrl: "https://mmg.whatsapp.net/..."
            }
          }
        },
        {
          status: 400,
          label: "Requisição inválida",
          body: {
            error: "Invalid media type or file format"
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
          status: 413,
          label: "Arquivo muito grande",
          body: {
            error: "File too large"
          }
        },
        {
          status: 415,
          label: "Formato de mídia não suportado",
          body: {
            error: "Unsupported media type"
          }
        },
        {
          status: 500,
          label: "Erro interno do servidor",
          body: {
            error: "Failed to upload media"
          }
        }
      ]
    },
    'send-menu': {
      title: 'Enviar menu interativo',
      description: 'Envia menus interativos: botões, listas, enquetes ou carrossel.',
      method: 'POST',
      path: '/send-menu',
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
        { name: 'number', type: 'string', required: true, description: 'Número de telefone com código do país, sem espaços ou caracteres especiais (ex: 5511999999999)' },
        { name: 'type', type: 'string', required: true, description: 'Tipo de menu: button (botões), list (lista), poll (enquete), carousel (carrossel)' },
        { name: 'text', type: 'string', required: true, description: 'Texto principal da mensagem. Suporta formatação e placeholders dinâmicos (ex: {{nome}})' },
        { name: 'choices', type: 'array', required: true, description: 'Array de opções. Formato varia por tipo: button (["texto|id"]), list (["[Seção]", "item|id|desc"]), poll (["opção1", "opção2"]), carousel (["[Título]", "{imagem}", "botão"])' },
        { name: 'footerText', type: 'string', required: false, description: 'Texto do rodapé exibido abaixo da mensagem principal (opcional para button e list)' },
        { name: 'listButton', type: 'string', required: false, description: 'Texto do botão que abre a lista (obrigatório para type: list)' },
        { name: 'selectableCount', type: 'number', required: false, description: 'Número máximo de opções selecionáveis (padrão: 1, apenas para type: poll)' },
        { name: 'imageButton', type: 'string', required: false, description: 'URL pública (https://) ou base64 da imagem exibida acima dos botões (recomendado para type: button)' },
        { name: 'replyid', type: 'string', required: false, description: 'ID da mensagem para responder (formato: 3EB0538DA65A59F6D8A251)' },
        { name: 'mentions', type: 'string', required: false, description: 'Números para mencionar, separados por vírgula (ex: 5511999999999,5511888888888)' },
        { name: 'readchat', type: 'boolean', required: false, description: 'Marca a conversa como lida após o envio (padrão: false)' },
        { name: 'readmessages', type: 'boolean', required: false, description: 'Marca as últimas mensagens recebidas como lidas (padrão: false)' },
        { name: 'delay', type: 'number', required: false, description: 'Atraso em milissegundos antes do envio. Durante o atraso aparecerá "Digitando..." (padrão: 0)' },
        { name: 'track_source', type: 'string', required: false, description: 'Origem do rastreamento da mensagem para analytics (ex: "chatwoot", "zapier")' },
        { name: 'track_id', type: 'string', required: false, description: 'ID para rastreamento da mensagem. Aceita valores duplicados (ex: "msg_123456789")' }
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
      responses: [
        {
          status: 200,
          label: "Menu enviado com sucesso",
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
              message: "Menu sent successfully"
            }
          }
        },
        {
          status: 400,
          label: "Requisição inválida",
          body: {
            error: "Missing required fields or invalid menu type"
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
          status: 429,
          label: "Limite de requisições excedido",
          body: {
            error: "Rate limit exceeded"
          }
        },
        {
          status: 500,
          label: "Erro interno do servidor",
          body: {
            error: "Failed to send menu"
          }
        }
      ]
    },
    'send-carousel': {
      title: 'Enviar carrossel de mídia',
      description: 'Envia um carrossel com imagens e botões interativos.',
      method: 'POST',
      path: '/send-carousel',
      icon: Image,
      color: 'indigo',
      features: [
        'Carrossel de cartões com imagens',
        'Botões interativos por cartão',
        'Tipos de botões: REPLY, URL, COPY, CALL',
        'Múltiplos cartões em uma única mensagem'
      ],
      params: [
        { name: 'number', type: 'string', required: true, description: 'Número de telefone com código do país, sem espaços ou caracteres especiais (ex: 5511999999999)' },
        { name: 'text', type: 'string', required: true, description: 'Texto principal da mensagem. Suporta formatação e placeholders dinâmicos (ex: {{nome}})' },
        { name: 'carousel', type: 'array', required: true, description: 'Array de objetos com cartões do carrossel. Cada cartão deve ter: text (título/subtítulo), image (URL ou base64), buttons (array de botões com id, text, type: REPLY/URL/COPY/CALL)' },
        { name: 'replyid', type: 'string', required: false, description: 'ID da mensagem para responder (formato: 3EB0538DA65A59F6D8A251)' },
        { name: 'mentions', type: 'string', required: false, description: 'Números para mencionar, separados por vírgula (ex: 5511999999999,5511888888888)' },
        { name: 'readchat', type: 'boolean', required: false, description: 'Marca a conversa como lida após o envio (padrão: false)' },
        { name: 'readmessages', type: 'boolean', required: false, description: 'Marca as últimas mensagens recebidas como lidas (padrão: false)' },
        { name: 'delay', type: 'number', required: false, description: 'Atraso em milissegundos antes do envio. Durante o atraso aparecerá "Digitando..." (padrão: 0)' },
        { name: 'track_source', type: 'string', required: false, description: 'Origem do rastreamento da mensagem para analytics (ex: "chatwoot", "zapier")' },
        { name: 'track_id', type: 'string', required: false, description: 'ID para rastreamento da mensagem. Aceita valores duplicados (ex: "msg_123456789")' }
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
      path: '/send-pix-button',
      icon: Send,
      color: 'green',
      features: [
        'Botão nativo do WhatsApp',
        'Suporte a diferentes tipos de chave PIX',
        'Visualização do recebedor e chave',
        'Abertura direta no app de pagamento'
      ],
      params: [
        { name: 'number', type: 'string', required: true, description: 'Número de telefone com código do país, sem espaços ou caracteres especiais (ex: 5511999999999)' },
        { name: 'pixType', type: 'string', required: true, description: 'Tipo de chave PIX: CPF (11 dígitos), CNPJ (14 dígitos), PHONE (formato: +5511999999999), EMAIL (email válido), EVP (chave aleatória UUID)' },
        { name: 'pixKey', type: 'string', required: true, description: 'Valor da chave PIX conforme o tipo selecionado. Deve ser válido e formatado corretamente' },
        { name: 'pixName', type: 'string', required: false, description: 'Nome do recebedor exibido no botão (padrão: "Pix"). Máximo: 25 caracteres' },
        { name: 'replyid', type: 'string', required: false, description: 'ID da mensagem para responder (formato: 3EB0538DA65A59F6D8A251)' },
        { name: 'readchat', type: 'boolean', required: false, description: 'Marca a conversa como lida após o envio (padrão: false)' },
        { name: 'readmessages', type: 'boolean', required: false, description: 'Marca as últimas mensagens recebidas como lidas (padrão: false)' },
        { name: 'delay', type: 'number', required: false, description: 'Atraso em milissegundos antes do envio. Durante o atraso aparecerá "Digitando..." (padrão: 0)' },
        { name: 'track_source', type: 'string', required: false, description: 'Origem do rastreamento da mensagem para analytics (ex: "chatwoot", "zapier")' },
        { name: 'track_id', type: 'string', required: false, description: 'ID para rastreamento da mensagem. Aceita valores duplicados (ex: "msg_123456789")' }
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
      path: '/send-status',
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
        { name: 'type', type: 'string', required: true, description: 'Tipo de status: text (texto com estilo), image (imagem com legenda), video (vídeo), audio (áudio ou mensagem de voz)' },
        { name: 'text', type: 'string', required: false, description: 'Texto principal (obrigatório para type: text) ou legenda (opcional para image/video). Máximo: 139 caracteres para text' },
        { name: 'background_color', type: 'number', required: false, description: 'Código da cor de fundo para texto (1-19). Exemplos: 1=azul, 7=verde, 13=roxo. Apenas para type: text' },
        { name: 'font', type: 'number', required: false, description: 'Estilo da fonte para texto (0-8). Exemplos: 0=normal, 1=bold, 2=italic. Apenas para type: text' },
        { name: 'file', type: 'string', required: false, description: 'URL pública (https://) ou string base64 do arquivo. Obrigatório para image/video/audio. Formatos: JPG/PNG (imagem), MP4 (vídeo), MP3/OGG (áudio)' },
        { name: 'thumbnail', type: 'string', required: false, description: 'URL pública (https://) ou base64 da miniatura do vídeo (opcional, apenas para type: video). Recomendado: JPG/PNG' },
        { name: 'mimetype', type: 'string', required: false, description: 'MIME type do arquivo (opcional). Exemplos: image/jpeg, video/mp4, audio/mpeg. Se não informado, será detectado automaticamente' }
      ],
      exampleRequest: {
        type: "text",
        text: "Novidades chegando!",
        background_color: 7,
        font: 1
      },
      responses: [
        {
          status: 200,
          label: "Status enviado com sucesso",
          body: {
            Id: "ABCD1234",
            content: {},
            messageTimestamp: 1672531200000,
            status: "Pending"
          }
        },
        {
          status: 400,
          label: "Requisição inválida",
          body: {
            error: "Text too long"
          }
        },
        {
          status: 401,
          label: "Não autorizado",
          body: {
            error: "No session"
          }
        },
        {
          status: 500,
          label: "Erro interno do servidor",
          body: {
            error: "Failed to upload media"
          }
        }
      ]
    }
  };

  const currentEndpoint = endpointData[selectedEndpoint];
  const hasTestResponse = Boolean(testResponse);
  const isTestError =
    hasTestResponse &&
    (testResponse.includes('"error"') || testResponse.includes('"Error"'));
  const testResponseCardClass = !hasTestResponse
    ? 'bg-slate-900 border border-slate-700'
    : isTestError
    ? 'bg-slate-900 border border-red-600/60'
    : 'bg-slate-900 border border-emerald-600/60';
  const testResponseBarClass = !hasTestResponse
    ? 'bg-slate-600'
    : isTestError
    ? 'bg-red-500'
    : 'bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500';
  const testResponseTextClass = !hasTestResponse
    ? 'text-slate-200'
    : 'text-slate-100';
  
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

  const requestPayload = buildRequestPayload();
  const tokenHeaderValue = testToken || 'seu_token_de_instancia';
  const sanitizedTokenHeaderValue = escapeForShellSingleQuotes(tokenHeaderValue);

  const buildCurlCommand = (opts: { forCopy: boolean }) => {
    const tokenValue = opts.forCopy ? sanitizedTokenHeaderValue : tokenHeaderValue;
    const lines = [
      `curl --request ${currentEndpoint.method}`,
      `  --url ${buildEndpointUrl(currentEndpoint.path)}`,
      `  --header 'Content-Type: application/json'`,
    ];

    if (requiresSupabaseAuth) {
      const anonValue = SUPABASE_ANON_KEY ? `${SUPABASE_ANON_KEY.substring(0, 30)}...` : 'SUA_CHAVE_ANON';
      lines.push(`  --header 'Authorization: Bearer ${anonValue}'`);
    }

    lines.push(`  --header 'token: ${tokenValue}'`);
    lines.push(`  --data '${JSON.stringify(requestPayload, null, 2)}'`);

    return lines.join(' \\\n');
  };

  const curlCommandForDisplay = buildCurlCommand({ forCopy: false });
  const curlCommandForCopy = buildCurlCommand({ forCopy: true });

  useEffect(() => {
    const nextState: Record<string, boolean> = {};
    responseExamples.forEach((_, idx) => {
      const key = `${selectedEndpoint}-${idx}`;
      nextState[key] = false;
    });
    setExpandedResponses(nextState);
  }, [selectedEndpoint, responseSignature]);

  return (
    <div className="flex h-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Sidebar */}
      <div className="w-80 bg-white/95 backdrop-blur border-r border-slate-200 overflow-y-auto shadow-lg">
        <div className="sticky top-0 z-10 bg-white/95 border-b border-slate-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-800 tracking-wide uppercase">Documentação</h2>
          <p className="text-xs text-slate-500 mt-1">
            Explore os endpoints disponíveis e veja detalhes de requisição.
          </p>
        </div>

        <div className="p-4 space-y-4">
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
              <div key={group.id} className="space-y-2">
                <button
                  onClick={toggleGroup}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm text-slate-700 rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white hover:shadow transition-all duration-200 font-semibold"
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-7 h-7 flex items-center justify-center rounded-full bg-slate-200 text-slate-600 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                    <span>{group.label}</span>
                  </div>
                  <span className="text-xs font-bold text-slate-600 bg-white px-2.5 py-1 rounded-full border border-slate-200">{group.count}</span>
                </button>

                {isExpanded && group.children.length > 0 && (
                  <div className="ml-2 mt-1 space-y-1.5">
                    {group.children.map((child) => {
                      const childData = endpointData[child.id];
                      const isSelected = selectedEndpoint === child.id;

                      return (
                        <button
                          key={child.id}
                          onClick={() => setSelectedEndpoint(child.id)}
                          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all duration-200 ${
                            isSelected
                              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-transparent shadow-lg shadow-blue-500/25'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:bg-blue-50/50'
                          }`}
                        >
                          <div>
                            <span className={`block text-sm font-semibold ${isSelected ? 'text-white' : 'text-slate-700'}`}>
                              {child.label}
                            </span>
                            <span className={`block text-xs font-mono mt-1 ${isSelected ? 'text-white/70' : 'text-slate-400'}`}>
                              {childData.path}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span
                              className={`text-xs font-bold px-2.5 py-1 rounded-md ${
                                isSelected ? 'bg-white/25 text-white' : 'bg-blue-100 text-blue-700'
                              }`}
                            >
                              {child.method}
                            </span>
                            <ArrowRight
                              className={`w-4 h-4 ${
                                isSelected ? 'text-white' : 'text-blue-500'
                              }`}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto bg-white">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
          <div className="px-8 py-6">
            <div className="flex items-center gap-3 mb-3">
              <span className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-semibold ${
                currentEndpoint.color === 'cyan' ? 'bg-cyan-50 text-cyan-700 border border-cyan-200' : 
                currentEndpoint.color === 'green' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                currentEndpoint.color === 'purple' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                currentEndpoint.color === 'indigo' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                currentEndpoint.color === 'orange' ? 'bg-orange-50 text-orange-700 border border-orange-200' : 'bg-slate-50 text-slate-700 border border-slate-200'
              }`}>
                {currentEndpoint.method}
              </span>
              <code className="text-sm font-mono text-slate-600 bg-slate-50 px-3 py-1 rounded-md border border-slate-200">
                {currentEndpoint.path}
              </code>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">{currentEndpoint.title}</h1>
            <p className="text-slate-600 text-sm leading-relaxed max-w-3xl">{currentEndpoint.description}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 divide-x divide-slate-200">
          {/* Left Column - Documentation */}
          <div className="p-8 space-y-8 bg-white">
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

            {/* Features */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-6">
              <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
                Recursos
              </h3>
              <ul className="space-y-2.5">
                {currentEndpoint.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-sm text-slate-700">
                    <div className="mt-1.5 flex h-1.5 w-1.5 shrink-0 items-center justify-center rounded-full bg-blue-500"></div>
                    <span className="leading-relaxed">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Parameters */}
            <div>
              <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
                Parâmetros
              </h3>
              <div className="space-y-4">
                {currentEndpoint.params.map((param) => (
                  <div key={param.name} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono font-semibold text-slate-900">{param.name}</code>
                        {param.required && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-red-50 text-red-600 border border-red-200">
                            obrigatório
                          </span>
                        )}
                        {!param.required && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-slate-100 text-slate-600">
                            opcional
                          </span>
                        )}
                      </div>
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-mono text-slate-600 bg-slate-100 border border-slate-200">
                        {param.type}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed ml-0">{param.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Example Response */}
            <div>
              <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
                {responseExamples.length > 1 ? 'Respostas' : 'Resposta'}
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
                    const cardClass = `bg-slate-900 border ${
                      isError ? 'border-red-600/60' : 'border-emerald-600/60'
                    }`;
                    const barClass = isError
                      ? 'bg-red-500'
                      : 'bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500';
                    const textClass = 'text-slate-100';
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
          <div className="bg-slate-50/50">
            {/* Tabs */}
            <div className="sticky top-0 z-10 flex border-b border-slate-200 bg-white/95 backdrop-blur">
              <button
                onClick={() => setActiveTab('try')}
                className={`flex-1 px-6 py-4 text-sm font-semibold transition-all relative ${
                  activeTab === 'try'
                    ? 'text-slate-900'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Try It
                {activeTab === 'try' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
                )}
              </button>
              <button
                onClick={() => setActiveTab('code')}
                className={`flex-1 px-6 py-4 text-sm font-semibold transition-all relative ${
                  activeTab === 'code'
                    ? 'text-slate-900'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Code
                {activeTab === 'code' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
                )}
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
                        {buildEndpointUrl(currentEndpoint.path)}
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
                                onChange={(e) => handleMenuTypeChange(e.target.value)}
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

                            {menuType === 'button' && (
                              <div className="space-y-3">
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
                                <div className="space-y-2">
                                  {menuButtons.map((button, index) => (
                                    <div
                                      key={button.id}
                                      className="bg-slate-800/40 border border-slate-700 rounded-lg p-3 space-y-3"
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs uppercase tracking-wide text-slate-300 font-semibold">
                                          Botão {index + 1}
                                        </span>
                                        <div className="flex items-center space-x-2">
                                          <span className="text-[10px] uppercase tracking-wide text-slate-500">
                                            {button.action}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveMenuButton(button.id)}
                                            disabled={menuButtons.length === 1}
                                            className="p-1.5 rounded-md bg-slate-700/40 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
                                          >
                                            <Trash2 className="w-3.5 h-3.5 text-slate-300" />
                                          </button>
                                        </div>
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        <div className="space-y-1.5">
                                          <label className="text-[11px] text-slate-400 uppercase tracking-wide">
                                            Texto do botão
                                          </label>
                                          <input
                                            type="text"
                                            value={button.label}
                                            onChange={(e) => handleUpdateMenuButton(button.id, { label: e.target.value })}
                                            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                                          />
                                        </div>
                                        <div className="space-y-1.5">
                                          <label className="text-[11px] text-slate-400 uppercase tracking-wide">
                                            Ação
                                          </label>
                                          <select
                                            value={button.action}
                                            onChange={(e) =>
                                              handleUpdateMenuButton(button.id, {
                                                action: e.target.value as MenuButtonAction,
                                                value: '',
                                                replyId: '',
                                              })
                                            }
                                            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                                          >
                                            <option value="reply">Resposta rápida</option>
                                            <option value="url">Abrir link</option>
                                            <option value="call">Chamada telefônica</option>
                                            <option value="copy">Copiar código</option>
                                          </select>
                                        </div>
                                      </div>
                                      {button.action === 'reply' && (
                                        <div className="space-y-1.5">
                                          <label className="text-[11px] text-slate-400 uppercase tracking-wide">
                                            ID da resposta (opcional)
                                          </label>
                                          <input
                                            type="text"
                                            value={button.replyId ?? ''}
                                            onChange={(e) => handleUpdateMenuButton(button.id, { replyId: e.target.value })}
                                            placeholder="Ex.: suporte"
                                            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                                          />
                                        </div>
                                      )}
                                      {button.action !== 'reply' && (
                                        <div className="space-y-1.5">
                                          <label className="text-[11px] text-slate-400 uppercase tracking-wide">
                                            {button.action === 'url'
                                              ? 'URL do botão'
                                              : button.action === 'call'
                                              ? 'Número para ligação'
                                              : 'Texto para copiar'}
                                          </label>
                                          <input
                                            type="text"
                                            value={button.value ?? ''}
                                            onChange={(e) => handleUpdateMenuButton(button.id, { value: e.target.value })}
                                            placeholder={
                                              button.action === 'url'
                                                ? 'https://...'
                                                : button.action === 'call'
                                                ? '+5511999999999'
                                                : 'CÓDIGO123'
                                            }
                                            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                                          />
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                                <button
                                  type="button"
                                  onClick={handleAddMenuButton}
                                  className="flex items-center justify-center w-full bg-slate-800/40 hover:bg-slate-800 border border-dashed border-slate-600 rounded-lg py-2.5 text-xs text-slate-200 transition-colors"
                                >
                                  <Plus className="w-4 h-4 mr-1" />
                                  Adicionar botão
                                </button>
                              </div>
                            )}

                            {menuType === 'list' && (
                              <div className="space-y-3">
                                <div className="flex items-center space-x-2">
                                  <span className="text-cyan-400 font-semibold">"listButton"</span>
                                  <span className="text-slate-400">:</span>
                                  <input
                                    type="text"
                                    value={listButton}
                                    onChange={(e) => setListButton(e.target.value)}
                                    placeholder="Texto exibido no botão principal"
                                    className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                                  />
                                </div>
                                <div className="space-y-3">
                                  {menuListSections.map((section, sectionIndex) => (
                                    <div key={section.id} className="bg-slate-800/40 border border-slate-700 rounded-lg p-3 space-y-3">
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs uppercase tracking-wide text-slate-300 font-semibold">
                                          Seção {sectionIndex + 1}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveMenuListSection(section.id)}
                                          disabled={menuListSections.length === 1}
                                          className="p-1.5 rounded-md bg-slate-700/40 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                          <Trash2 className="w-3.5 h-3.5 text-slate-300" />
                                        </button>
                                      </div>
                                      <div className="space-y-1.5">
                                        <label className="text-[11px] text-slate-400 uppercase tracking-wide">Título da seção</label>
                                        <input
                                          type="text"
                                          value={section.title}
                                          onChange={(e) => handleUpdateMenuListSection(section.id, { title: e.target.value })}
                                          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        {section.items.map((item, itemIndex) => (
                                          <div key={item.id} className="bg-slate-900/60 border border-slate-700 rounded-lg p-3 space-y-2">
                                            <div className="flex items-center justify-between">
                                              <span className="text-[11px] uppercase tracking-wide text-slate-400">
                                                Item {itemIndex + 1}
                                              </span>
                                              <button
                                                type="button"
                                                onClick={() => handleRemoveMenuListItem(section.id, item.id)}
                                                disabled={section.items.length === 1}
                                                className="p-1 rounded-md bg-slate-800/60 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                                              >
                                                <Trash2 className="w-3.5 h-3.5 text-slate-300" />
                                              </button>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                              <div className="space-y-1">
                                                <label className="text-[11px] text-slate-400 uppercase tracking-wide">Texto</label>
                                                <input
                                                  type="text"
                                                  value={item.label}
                                                  onChange={(e) =>
                                                    handleUpdateMenuListItem(section.id, item.id, { label: e.target.value })
                                                  }
                                                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                                                />
                                              </div>
                                              <div className="space-y-1">
                                                <label className="text-[11px] text-slate-400 uppercase tracking-wide">
                                                  ID (opcional)
                                                </label>
                                                <input
                                                  type="text"
                                                  value={item.value ?? ''}
                                                  onChange={(e) =>
                                                    handleUpdateMenuListItem(section.id, item.id, { value: e.target.value })
                                                  }
                                                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                                                />
                                              </div>
                                            </div>
                                            <div className="space-y-1">
                                              <label className="text-[11px] text-slate-400 uppercase tracking-wide">
                                                Descrição (opcional)
                                              </label>
                                              <input
                                                type="text"
                                                value={item.description ?? ''}
                                                onChange={(e) =>
                                                  handleUpdateMenuListItem(section.id, item.id, { description: e.target.value })
                                                }
                                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                                              />
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleAddMenuListItem(section.id)}
                                        className="flex items-center justify-center w-full bg-slate-800/40 hover:bg-slate-800 border border-dashed border-slate-600 rounded-lg py-2 text-xs text-slate-200 transition-colors"
                                      >
                                        <Plus className="w-4 h-4 mr-1" />
                                        Adicionar item
                                      </button>
                                    </div>
                                  ))}
                                </div>
                                <button
                                  type="button"
                                  onClick={handleAddMenuListSection}
                                  className="flex items-center justify-center w-full bg-slate-800/40 hover:bg-slate-800 border border-dashed border-slate-600 rounded-lg py-2.5 text-xs text-slate-200 transition-colors"
                                >
                                  <Plus className="w-4 h-4 mr-1" />
                                  Adicionar seção
                                </button>
                              </div>
                            )}

                            {menuType === 'poll' && (
                              <div className="space-y-3">
                                <div className="flex items-center space-x-2">
                                  <span className="text-cyan-400 font-semibold">"selectableCount"</span>
                                  <span className="text-slate-400">:</span>
                                  <input
                                    type="number"
                                    value={selectableCount}
                                    min={1}
                                    onChange={(e) => setSelectableCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                                    placeholder="Número máximo de opções que podem ser escolhidas"
                                    className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                                  />
                                </div>
                                <div className="space-y-2">
                                  {menuPollOptions.map((option, index) => (
                                    <div key={option.id} className="flex items-center space-x-2">
                                      <span className="text-[11px] text-slate-400 uppercase tracking-wide w-16">
                                        Opção {index + 1}
                                      </span>
                                      <input
                                        type="text"
                                        value={option.label}
                                        onChange={(e) => handleUpdateMenuPollOption(option.id, e.target.value)}
                                        className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveMenuPollOption(option.id)}
                                        disabled={menuPollOptions.length <= 2}
                                        className="p-1.5 rounded-md bg-slate-700/40 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
                                      >
                                        <Trash2 className="w-3.5 h-3.5 text-slate-300" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                                <button
                                  type="button"
                                  onClick={handleAddMenuPollOption}
                                  className="flex items-center justify-center w-full bg-slate-800/40 hover:bg-slate-800 border border-dashed border-slate-600 rounded-lg py-2 text-xs text-slate-200 transition-colors"
                                >
                                  <Plus className="w-4 h-4 mr-1" />
                                  Adicionar opção
                                </button>
                              </div>
                            )}

                            {menuType === 'carousel' && (
                              <div className="space-y-3">
                                {menuCarouselCards.map((card, cardIndex) => (
                                  <div key={card.id} className="bg-slate-800/40 border border-slate-700 rounded-lg p-3 space-y-3">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs uppercase tracking-wide text-slate-300 font-semibold">
                                        Cartão {cardIndex + 1}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveMenuCarouselCard(card.id)}
                                        disabled={menuCarouselCards.length === 1}
                                        className="p-1.5 rounded-md bg-slate-700/40 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
                                      >
                                        <Trash2 className="w-3.5 h-3.5 text-slate-300" />
                                      </button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                      <div className="space-y-1">
                                        <label className="text-[11px] text-slate-400 uppercase tracking-wide">
                                          Título do cartão
                                        </label>
                                        <input
                                          type="text"
                                          value={card.title}
                                          onChange={(e) => handleUpdateMenuCarouselCard(card.id, { title: e.target.value })}
                                          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[11px] text-slate-400 uppercase tracking-wide">
                                          Subtítulo (opcional)
                                        </label>
                                        <input
                                          type="text"
                                          value={card.subtitle ?? ''}
                                          onChange={(e) => handleUpdateMenuCarouselCard(card.id, { subtitle: e.target.value })}
                                          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                                        />
                                      </div>
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[11px] text-slate-400 uppercase tracking-wide">
                                        Imagem (URL ou base64)
                                      </label>
                                      <input
                                        type="text"
                                        value={card.image ?? ''}
                                        onChange={(e) => handleUpdateMenuCarouselCard(card.id, { image: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      {card.buttons.map((button, idx) => (
                                        <div key={button.id} className="bg-slate-900/60 border border-slate-700 rounded-lg p-3 space-y-2">
                                          <div className="flex items-center justify-between">
                                            <span className="text-[11px] uppercase tracking-wide text-slate-400">
                                              Botão {idx + 1}
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() => handleRemoveCarouselButton(card.id, button.id)}
                                              disabled={card.buttons.length === 1}
                                              className="p-1 rounded-md bg-slate-800/60 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                                            >
                                              <Trash2 className="w-3.5 h-3.5 text-slate-300" />
                                            </button>
                                          </div>
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                            <div className="space-y-1">
                                              <label className="text-[11px] text-slate-400 uppercase tracking-wide">
                                                Texto
                                              </label>
                                              <input
                                                type="text"
                                                value={button.label}
                                                onChange={(e) =>
                                                  handleUpdateCarouselButton(card.id, button.id, { label: e.target.value })
                                                }
                                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                                              />
                                            </div>
                                            <div className="space-y-1">
                                              <label className="text-[11px] text-slate-400 uppercase tracking-wide">
                                                Ação
                                              </label>
                                              <select
                                                value={button.action}
                                                onChange={(e) =>
                                                  handleUpdateCarouselButton(card.id, button.id, {
                                                    action: e.target.value as MenuButtonAction,
                                                    value: '',
                                                    replyId: '',
                                                  })
                                                }
                                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                                              >
                                                <option value="reply">Resposta rápida</option>
                                                <option value="url">Abrir link</option>
                                                <option value="call">Chamada telefônica</option>
                                                <option value="copy">Copiar código</option>
                                              </select>
                                            </div>
                                          </div>
                                          {button.action === 'reply' ? (
                                            <div className="space-y-1">
                                              <label className="text-[11px] text-slate-400 uppercase tracking-wide">
                                                ID da resposta (opcional)
                                              </label>
                                              <input
                                                type="text"
                                                value={button.replyId ?? ''}
                                                onChange={(e) =>
                                                  handleUpdateCarouselButton(card.id, button.id, { replyId: e.target.value })
                                                }
                                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                                              />
                                            </div>
                                          ) : (
                                            <div className="space-y-1">
                                              <label className="text-[11px] text-slate-400 uppercase tracking-wide">
                                                {button.action === 'url'
                                                  ? 'URL do botão'
                                                  : button.action === 'call'
                                                  ? 'Número para ligação'
                                                  : 'Texto para copiar'}
                                              </label>
                                              <input
                                                type="text"
                                                value={button.value ?? ''}
                                                onChange={(e) =>
                                                  handleUpdateCarouselButton(card.id, button.id, { value: e.target.value })
                                                }
                                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                                              />
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleAddButtonToCarouselCard(card.id)}
                                      className="flex items-center justify-center w-full bg-slate-800/40 hover:bg-slate-800 border border-dashed border-slate-600 rounded-lg py-2 text-xs text-slate-200 transition-colors"
                                    >
                                      <Plus className="w-4 h-4 mr-1" />
                                      Adicionar botão ao cartão
                                    </button>
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  onClick={handleAddMenuCarouselCard}
                                  className="flex items-center justify-center w-full bg-slate-800/40 hover:bg-slate-800 border border-dashed border-slate-600 rounded-lg py-2.5 text-xs text-slate-200 transition-colors"
                                >
                                  <Plus className="w-4 h-4 mr-1" />
                                  Adicionar cartão
                                </button>
                              </div>
                            )}

                            {(menuType === 'button' || menuType === 'list' || menuType === 'carousel') && (
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
            <div className={`rounded-xl p-6 border-2 shadow-xl overflow-hidden relative ${testResponseCardClass}`}>
              <div className={`absolute top-0 left-0 right-0 h-1.5 ${testResponseBarClass}`}></div>
              <div className="relative max-h-96 overflow-y-auto pt-2">
                {!hasTestResponse ? (
                  <div className="text-center py-16 text-slate-400">
                    <div className="text-lg font-semibold mb-2 text-slate-300">Nenhuma resposta ainda</div>
                    <div className="text-sm">Envie uma requisição para ver o resultado aqui</div>
                  </div>
                ) : (
                  <pre className={`text-base font-mono leading-relaxed whitespace-pre-wrap ${testResponseTextClass}`}>
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
                      onClick={() => copyToClipboard(curlCommandForCopy, 'curl-code')}
                      className="absolute top-3 right-3 p-2 hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      {copiedEndpoint === 'curl-code' ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                    <pre className="text-sm text-slate-100 font-mono whitespace-pre-wrap pr-12">
{curlCommandForDisplay}
                    </pre>
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
