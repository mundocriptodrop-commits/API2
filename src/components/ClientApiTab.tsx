import { useState, useEffect } from 'react';
import { Copy, Check, ChevronRight, Send, Image, Smartphone, Zap, Plus, Trash2, User, Settings, Power, PowerOff, Eye, Lock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

declare global {
  interface ImportMetaEnv {
    readonly VITE_SUPABASE_ANON_KEY?: string;
    readonly VITE_SUPABASE_URL?: string;
    readonly VITE_PUBLIC_API_URL?: string;
  }
  interface ImportMeta {
    readonly env: ImportMetaEnv;
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

type EndpointType = 
  | 'send-text' | 'send-media' | 'send-menu' | 'send-carousel' | 'send-pix-button' | 'send-status'
  | 'profile-name' | 'profile-image'
  | 'instance-connect' | 'instance-disconnect' | 'instance-status' | 'instance-update-name' | 'instance-delete' | 'instance-privacy-get' | 'instance-privacy-set' | 'instance-presence'
  | 'chatwoot-config';

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

  // Helper function para cores dos métodos HTTP
  const getMethodColorClasses = (method: string, isSelected: boolean = false) => {
    if (isSelected) {
      return 'bg-white/20 text-white';
    }
    switch (method) {
      case 'POST':
        return 'bg-blue-100 text-blue-700';
      case 'GET':
        return 'bg-green-100 text-green-700';
      case 'PUT':
        return 'bg-yellow-100 text-yellow-700';
      case 'DELETE':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-slate-200 text-slate-600';
    }
  };

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

  // Estados para profile
  const [profileName, setProfileName] = useState('Minha Empresa - Atendimento');
  const [profileImage, setProfileImage] = useState('https://picsum.photos/640/640.jpg');

  // Estados para instance
  const [instancePhone, setInstancePhone] = useState('5511999999999');
  const [instanceName, setInstanceName] = useState('Minha Nova Instância 2024!@#');
  const [privacyGroupadd, setPrivacyGroupadd] = useState('contacts');
  const [privacyLast, setPrivacyLast] = useState('none');
  const [privacyStatus, setPrivacyStatus] = useState('contacts');
  const [privacyProfile, setPrivacyProfile] = useState('');
  const [privacyReadreceipts, setPrivacyReadreceipts] = useState('');
  const [privacyOnline, setPrivacyOnline] = useState('');
  const [privacyCalladd, setPrivacyCalladd] = useState('');
  const [presenceValue, setPresenceValue] = useState('available');

  // Estados para chatwoot-config
  const [chatwootEnabled, setChatwootEnabled] = useState(true);
  const [chatwootUrl, setChatwootUrl] = useState('https://chat.evachat.com.br');
  const [chatwootAccessToken, setChatwootAccessToken] = useState('');
  const [chatwootAccountId, setChatwootAccountId] = useState('');
  const [chatwootInboxId, setChatwootInboxId] = useState('');
  const [chatwootIgnoreGroups, setChatwootIgnoreGroups] = useState(false);
  const [chatwootSignMessages, setChatwootSignMessages] = useState(true);
  const [chatwootCreateNewConversation, setChatwootCreateNewConversation] = useState(false);

  const [expandedResponses, setExpandedResponses] = useState<Record<string, boolean>>({});
  
  const [testResponse, setTestResponse] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(true);
  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointType>('send-text');
  const [activeTab, setActiveTab] = useState<'try' | 'code'>('try');
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

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
    setMenuButtons((prev: MenuButtonConfig[]) => [...prev, createMenuButton({ label: `Botão ${prev.length + 1}` })]);
  };

  const handleUpdateMenuButton = (buttonId: string, updates: Partial<MenuButtonConfig>) => {
    setMenuButtons((prev: MenuButtonConfig[]) =>
      prev.map((button: MenuButtonConfig) =>
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
    setMenuButtons((prev: MenuButtonConfig[]) => {
      if (prev.length === 1) return prev;
      return prev.filter((button: MenuButtonConfig) => button.id !== buttonId);
    });
  };

  const handleAddMenuListSection = () => {
    setMenuListSections((prev: MenuListSection[]) => [...prev, createMenuListSection({ title: `Seção ${prev.length + 1}` })]);
  };

  const handleUpdateMenuListSection = (sectionId: string, updates: Partial<MenuListSection>) => {
    setMenuListSections((prev: MenuListSection[]) =>
      prev.map((section: MenuListSection) =>
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
    setMenuListSections((prev: MenuListSection[]) => {
      if (prev.length === 1) return prev;
      return prev.filter((section: MenuListSection) => section.id !== sectionId);
    });
  };

  const handleAddMenuListItem = (sectionId: string) => {
    setMenuListSections((prev: MenuListSection[]) =>
      prev.map((section: MenuListSection) =>
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
    setMenuListSections((prev: MenuListSection[]) =>
      prev.map((section: MenuListSection) =>
        section.id === sectionId
          ? {
              ...section,
              items: section.items.map((item: MenuListItem) =>
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
    setMenuListSections((prev: MenuListSection[]) =>
      prev.map((section: MenuListSection) =>
        section.id === sectionId
          ? {
              ...section,
              items: section.items.length === 1 ? section.items : section.items.filter((item: MenuListItem) => item.id !== itemId),
            }
          : section
      )
    );
  };

  const handleAddMenuPollOption = () => {
    setMenuPollOptions((prev: MenuPollOption[]) => [...prev, createMenuPollOption({ label: `Opção ${prev.length + 1}` })]);
  };

  const handleUpdateMenuPollOption = (optionId: string, label: string) => {
    setMenuPollOptions((prev: MenuPollOption[]) =>
      prev.map((option: MenuPollOption) =>
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
    setMenuPollOptions((prev: MenuPollOption[]) => {
      if (prev.length <= 2) return prev;
      return prev.filter((option: MenuPollOption) => option.id !== optionId);
    });
  };

  const handleAddMenuCarouselCard = () => {
    setMenuCarouselCards((prev: MenuCarouselCard[]) => [
      ...prev,
      createMenuCarouselCard({ title: `Cartão ${prev.length + 1}`, buttons: [createMenuButton()] }),
    ]);
  };

  const handleUpdateMenuCarouselCard = (cardId: string, updates: Partial<MenuCarouselCard>) => {
    setMenuCarouselCards((prev: MenuCarouselCard[]) =>
      prev.map((card: MenuCarouselCard) =>
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
    setMenuCarouselCards((prev: MenuCarouselCard[]) => {
      if (prev.length === 1) return prev;
      return prev.filter((card: MenuCarouselCard) => card.id !== cardId);
    });
  };

  const handleAddButtonToCarouselCard = (cardId: string) => {
    setMenuCarouselCards((prev: MenuCarouselCard[]) =>
      prev.map((card: MenuCarouselCard) =>
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
    setMenuCarouselCards((prev: MenuCarouselCard[]) =>
      prev.map((card: MenuCarouselCard) =>
        card.id === cardId
          ? {
              ...card,
              buttons: card.buttons.map((button: MenuButtonConfig) =>
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
    setMenuCarouselCards((prev: MenuCarouselCard[]) =>
      prev.map((card: MenuCarouselCard) =>
        card.id === cardId
          ? {
              ...card,
              buttons: card.buttons.length === 1 ? card.buttons : card.buttons.filter((button: MenuButtonConfig) => button.id !== buttonId),
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

  // Garantir que os grupos iniciem recolhidos
  useEffect(() => {
    setExpandedGroups([]);
  }, []);

  const fetchInstances = async () => {
    if (!user || !user.id) return;
    try {
      setLoadingInstances(true);
      const userId = user.id;
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('id, name, instance_token, status, phone_number')
        .eq('user_id', userId)
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
          menuButtons.forEach((button: MenuButtonConfig) => {
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
          menuListSections.forEach((section: MenuListSection) => {
            const title = section.title.trim();
            if (title) {
              choices.push(`[${title}]`);
            }
            section.items.forEach((item: MenuListItem) => {
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
          menuPollOptions.forEach((option: MenuPollOption) => {
            const label = option.label.trim();
            if (!label) return;
            choices.push(label);
          });
          payload.selectableCount = selectableCount;
        }

        if (menuType === 'carousel') {
          menuCarouselCards.forEach((card: MenuCarouselCard) => {
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
            card.buttons.forEach((button: MenuButtonConfig) => {
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
      case 'profile-name':
        return {
          name: profileName,
        };
      case 'profile-image':
        return {
          image: profileImage,
        };
      case 'instance-connect':
        return {
          ...(instancePhone ? { phone: instancePhone } : {}),
        };
      case 'instance-disconnect':
        return {};
      case 'instance-status':
        return {};
      case 'instance-update-name':
        return {
          name: instanceName,
        };
      case 'instance-delete':
        return {};
      case 'instance-privacy-get':
        return {};
      case 'instance-privacy-set': {
        const payload: Record<string, unknown> = {};
        if (privacyGroupadd && privacyGroupadd.trim()) payload.groupadd = privacyGroupadd;
        if (privacyLast && privacyLast.trim()) payload.last = privacyLast;
        if (privacyStatus && privacyStatus.trim()) payload.status = privacyStatus;
        if (privacyProfile && privacyProfile.trim()) payload.profile = privacyProfile;
        if (privacyReadreceipts && privacyReadreceipts.trim()) payload.readreceipts = privacyReadreceipts;
        if (privacyOnline && privacyOnline.trim()) payload.online = privacyOnline;
        if (privacyCalladd && privacyCalladd.trim()) payload.calladd = privacyCalladd;
        return payload;
      }
      case 'instance-presence':
        return {
          presence: presenceValue,
        };
      case 'chatwoot-config':
        return {
          enabled: chatwootEnabled,
          url: chatwootUrl,
          access_token: chatwootAccessToken,
          account_id: parseInt(chatwootAccountId) || 0,
          inbox_id: parseInt(chatwootInboxId) || 0,
          ignore_groups: chatwootIgnoreGroups,
          sign_messages: chatwootSignMessages,
          create_new_conversation: chatwootCreateNewConversation,
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
      const method = currentEndpoint.method;

      const headers: Record<string, string> = {
        token: testToken,
      };

      // Adiciona Content-Type apenas para métodos que enviam body
      if (method !== 'GET' && method !== 'DELETE') {
        headers['Content-Type'] = 'application/json';
      }

      if (requiresSupabaseAuth && SUPABASE_ANON_KEY) {
        headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
      }

      const fetchOptions: RequestInit = {
        method,
        headers,
      };

      // Adiciona body apenas para métodos que suportam
      if (method !== 'GET' && method !== 'DELETE' && Object.keys(body).length > 0) {
        fetchOptions.body = JSON.stringify(body);
      }

      const response = await fetch(buildEndpointUrl(currentEndpoint.path), fetchOptions);

      const data = await response.json();
      
      // Se for endpoint do Chatwoot e tiver webhook_url na resposta, tenta atualizar automaticamente no Chatwoot
      if (selectedEndpoint === 'chatwoot-config' && data.webhook_url && response.ok && chatwootAccessToken && chatwootAccountId && chatwootInboxId) {
        try {
          const chatwootBaseUrl = chatwootUrl.endsWith('/') ? chatwootUrl.slice(0, -1) : chatwootUrl;
          
          // Tenta atualizar o webhook na inbox do Chatwoot usando PATCH
          // O Chatwoot pode aceitar webhook_url no update da inbox
          const updateWebhookUrl = `${chatwootBaseUrl}/api/v1/accounts/${chatwootAccountId}/inboxes/${chatwootInboxId}`;
          
          const chatwootResponse = await fetch(updateWebhookUrl, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'api_access_token': chatwootAccessToken,
            },
            body: JSON.stringify({
              webhook_url: data.webhook_url
            }),
          });
          
          if (chatwootResponse.ok) {
            const chatwootData = await chatwootResponse.json();
            data.webhook_updated_in_chatwoot = true;
            data.chatwoot_response = chatwootData;
          } else {
            // Se PATCH não funcionar, tenta criar/atualizar webhook via endpoint de webhooks
            const webhooksUrl = `${chatwootBaseUrl}/api/v1/accounts/${chatwootAccountId}/webhooks`;
            
            // Primeiro, tenta listar webhooks existentes
            const listWebhooksResponse = await fetch(webhooksUrl, {
              method: 'GET',
              headers: {
                'api_access_token': chatwootAccessToken,
              },
            });
            
            if (listWebhooksResponse.ok) {
              const existingWebhooks = await listWebhooksResponse.json();
              // Procura webhook existente para esta inbox
              const existingWebhook = existingWebhooks.find((wh: any) => 
                wh.webhook_url === data.webhook_url || 
                (wh.inbox_id && wh.inbox_id.toString() === chatwootInboxId.toString())
              );
              
              if (existingWebhook) {
                // Atualiza webhook existente
                const updateWebhookResponse = await fetch(`${webhooksUrl}/${existingWebhook.id}`, {
                  method: 'PATCH',
                  headers: {
                    'Content-Type': 'application/json',
                    'api_access_token': chatwootAccessToken,
                  },
                  body: JSON.stringify({
                    webhook_url: data.webhook_url,
                    inbox_id: parseInt(chatwootInboxId)
                  }),
                });
                
                if (updateWebhookResponse.ok) {
                  data.webhook_updated_in_chatwoot = true;
                } else {
                  const errorData = await updateWebhookResponse.json().catch(() => ({ error: 'Erro ao atualizar webhook' }));
                  data.webhook_updated_in_chatwoot = false;
                  data.webhook_update_error = errorData;
                }
              } else {
                // Cria novo webhook
                const createWebhookResponse = await fetch(webhooksUrl, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'api_access_token': chatwootAccessToken,
                  },
                  body: JSON.stringify({
                    webhook_url: data.webhook_url,
                    inbox_id: parseInt(chatwootInboxId)
                  }),
                });
                
                if (createWebhookResponse.ok) {
                  data.webhook_updated_in_chatwoot = true;
                } else {
                  const errorData = await createWebhookResponse.json().catch(() => ({ error: 'Erro ao criar webhook' }));
                  data.webhook_updated_in_chatwoot = false;
                  data.webhook_update_error = errorData;
                }
              }
            } else {
              const errorData = await chatwootResponse.json().catch(() => ({ error: 'Erro ao atualizar webhook no Chatwoot' }));
              data.webhook_updated_in_chatwoot = false;
              data.webhook_update_error = errorData;
            }
          }
        } catch (error: any) {
          // Se falhar, apenas adiciona informação no log, mas não bloqueia a resposta
          data.webhook_updated_in_chatwoot = false;
          data.webhook_update_error = { error: 'Erro ao tentar atualizar webhook no Chatwoot', message: error.message };
        }
      }
      
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
      label: 'Instância',
      count: 8,
      children: [
        { id: 'instance-connect' as EndpointType, label: 'Conectar instância ao WhatsApp', method: 'POST' },
        { id: 'instance-disconnect' as EndpointType, label: 'Desconectar instância', method: 'POST' },
        { id: 'instance-status' as EndpointType, label: 'Verificar status da instância', method: 'GET' },
        { id: 'instance-update-name' as EndpointType, label: 'Atualizar nome da instância', method: 'POST' },
        { id: 'instance-delete' as EndpointType, label: 'Deletar instância', method: 'DELETE' },
        { id: 'instance-privacy-get' as EndpointType, label: 'Buscar configurações de privacidade', method: 'GET' },
        { id: 'instance-privacy-set' as EndpointType, label: 'Alterar configurações de privacidade', method: 'POST' },
        { id: 'instance-presence' as EndpointType, label: 'Atualizar status de presença', method: 'POST' },
      ]
    },
    {
      id: 'perfil' as const,
      label: 'Perfil',
      count: 2,
      children: [
        { id: 'profile-name' as EndpointType, label: 'Alterar nome do perfil', method: 'POST' },
        { id: 'profile-image' as EndpointType, label: 'Alterar imagem do perfil', method: 'POST' },
      ]
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
    },
    {
      id: 'integracoes' as const,
      label: 'Integrações',
      count: 1,
      children: [
        { id: 'chatwoot-config' as EndpointType, label: 'Configurar integração Chatwoot', method: 'PUT' },
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
    },
    'profile-name': {
      title: 'Alterar nome do perfil',
      description: 'Altera o nome de exibição do perfil da instância do WhatsApp. A instância deve estar conectada ao WhatsApp.',
      method: 'POST',
      path: '/profile/name',
      icon: User,
      color: 'blue',
      features: [
        'Atualiza o nome do perfil usando o WhatsApp AppState',
        'Sincroniza a mudança com o servidor do WhatsApp',
        'Retorna confirmação da alteração'
      ],
      params: [
        { name: 'name', type: 'string', required: true, description: 'Novo nome do perfil do WhatsApp. Será visível para todos os contatos.' }
      ],
      exampleRequest: {
        name: "Minha Empresa - Atendimento"
      },
      responses: [
        {
          status: 200,
          label: "Nome do perfil alterado com sucesso",
          body: {
            success: true,
            message: "Nome do perfil alterado com sucesso",
            profile: {
              name: "Minha Empresa - Atendimento",
              updated_at: 1704067200
            }
          }
        },
        {
          status: 400,
          label: "Dados inválidos na requisição",
          body: {
            error: "Invalid name"
          }
        },
        {
          status: 401,
          label: "Sem sessão ativa",
          body: {
            error: "No session"
          }
        },
        {
          status: 403,
          label: "Ação não permitida",
          body: {
            error: "Action not allowed"
          }
        },
        {
          status: 500,
          label: "Erro interno do servidor",
          body: {
            error: "Erro ao alterar nome do perfil"
          }
        }
      ]
    },
    'profile-image': {
      title: 'Alterar imagem do perfil',
      description: 'Altera a imagem de perfil da instância do WhatsApp. A imagem deve estar em formato JPEG e tamanho 640x640 pixels.',
      method: 'POST',
      path: '/profile/image',
      icon: Image,
      color: 'purple',
      features: [
        'Atualiza a imagem do perfil',
        'Suporte para URL, base64 ou remoção',
        'Sincroniza a mudança com o servidor do WhatsApp',
        'Retorna confirmação da alteração'
      ],
      params: [
        { name: 'image', type: 'string', required: true, description: 'Imagem do perfil. Pode ser: URL da imagem (http/https), string base64 da imagem, ou "remove"/"delete" para remover a imagem atual. Recomendado: JPEG 640x640 pixels.' }
      ],
      exampleRequest: {
        image: "https://picsum.photos/640/640.jpg"
      },
      responses: [
        {
          status: 200,
          label: "Imagem do perfil alterada com sucesso",
          body: {
            success: true,
            message: "Imagem do perfil alterada com sucesso",
            profile: {
              image_updated: true,
              image_removed: false,
              updated_at: 1704067200
            }
          }
        },
        {
          status: 400,
          label: "Dados inválidos na requisição",
          body: {
            error: "Invalid image format"
          }
        },
        {
          status: 401,
          label: "Sem sessão ativa",
          body: {
            error: "No session"
          }
        },
        {
          status: 403,
          label: "Ação não permitida",
          body: {
            error: "Action not allowed"
          }
        },
        {
          status: 413,
          label: "Imagem muito grande",
          body: {
            error: "Image too large"
          }
        },
        {
          status: 500,
          label: "Erro interno do servidor",
          body: {
            error: "Erro ao alterar imagem do perfil"
          }
        }
      ]
    },
    'instance-connect': {
      title: 'Conectar instância ao WhatsApp',
      description: 'Inicia o processo de conexão de uma instância ao WhatsApp. Gera QR code ou código de pareamento dependendo se o número de telefone é fornecido.',
      method: 'POST',
      path: '/instance/connect',
      icon: Power,
      color: 'green',
      features: [
        'Gera QR code para conexão (sem telefone)',
        'Gera código de pareamento (com telefone)',
        'Atualiza status da instância para "connecting"',
        'Timeout de 2 minutos para QRCode ou 5 minutos para pareamento'
      ],
      params: [
        { name: 'phone', type: 'string', required: false, description: 'Número de telefone no formato internacional (ex: 5511999999999). Se não fornecido, será gerado QR code. Se fornecido, será gerado código de pareamento.' }
      ],
      exampleRequest: {
        phone: "5511999999999"
      },
      responses: [
        {
          status: 200,
          label: "Sucesso",
          body: {
            connected: false,
            loggedIn: false,
            jid: null,
            instance: {
              id: "i91011ijkl",
              token: "abc123xyz",
              status: "connecting",
              paircode: "1234-5678",
              qrcode: "data:image/png;base64,iVBORw0KGg...",
              name: "Instância Principal",
              profileName: "Loja ABC",
              profilePicUrl: "https://example.com/profile.jpg",
              isBusiness: true,
              plataform: "Android",
              systemName: "uazapi",
              owner: "user@example.com"
            }
          }
        },
        {
          status: 401,
          label: "Token inválido/expirado",
          body: {
            error: "Invalid token"
          }
        },
        {
          status: 404,
          label: "Instância não encontrada",
          body: {
            error: "Instance not found"
          }
        },
        {
          status: 429,
          label: "Limite de conexões simultâneas atingido",
          body: {
            error: "Too many connections"
          }
        },
        {
          status: 500,
          label: "Erro interno",
          body: {
            error: "Internal server error"
          }
        }
      ]
    },
    'instance-disconnect': {
      title: 'Desconectar instância',
      description: 'Desconecta a instância do WhatsApp, encerrando a sessão atual. Após desconectar, será necessário novo QR code para reconectar.',
      method: 'POST',
      path: '/instance/disconnect',
      icon: PowerOff,
      color: 'red',
      features: [
        'Encerra a conexão ativa',
        'Requer novo QR code para reconectar',
        'Limpa credenciais da instância',
        'Reinicia o processo de conexão'
      ],
      params: [],
      exampleRequest: {},
      responses: [
        {
          status: 200,
          label: "Instância desconectada com sucesso",
          body: {
            success: true,
            message: "Instance disconnected"
          }
        },
        {
          status: 401,
          label: "Token inválido/expirado",
          body: {
            error: "Invalid token"
          }
        },
        {
          status: 404,
          label: "Instância não encontrada",
          body: {
            error: "Instance not found"
          }
        },
        {
          status: 500,
          label: "Erro interno",
          body: {
            error: "Internal server error"
          }
        }
      ]
    },
    'instance-status': {
      title: 'Verificar status da instância',
      description: 'Retorna o status atual de uma instância, incluindo estado da conexão, QR code, código de pareamento e detalhes completos da instância.',
      method: 'GET',
      path: '/instance/status',
      icon: Eye,
      color: 'blue',
      features: [
        'Monitora o progresso da conexão',
        'Obtém QR codes atualizados',
        'Verifica estado atual da instância',
        'Identifica problemas de conexão'
      ],
      params: [],
      exampleRequest: {},
      responses: [
        {
          status: 200,
          label: "Sucesso",
          body: {
            instance: {
              id: "i91011ijkl",
              token: "abc123xyz",
              status: "connected",
              paircode: "1234-5678",
              qrcode: "",
              name: "Instância Principal",
              profileName: "Loja ABC",
              profilePicUrl: "https://example.com/profile.jpg",
              isBusiness: true,
              plataform: "Android",
              systemName: "uazapi",
              owner: "user@example.com",
              lastDisconnect: "2025-01-24T14:00:00Z",
              lastDisconnectReason: "Network error"
            },
            status: {
              connected: true,
              loggedIn: true,
              jid: "5511999999999:70@s.whatsapp.net"
            }
          }
        },
        {
          status: 401,
          label: "Token inválido/expirado",
          body: {
            error: "instance info not found"
          }
        },
        {
          status: 404,
          label: "Instância não encontrada",
          body: {
            error: "Instance not found"
          }
        },
        {
          status: 500,
          label: "Erro interno",
          body: {
            error: "Internal server error"
          }
        }
      ]
    },
    'instance-update-name': {
      title: 'Atualizar nome da instância',
      description: 'Atualiza o nome de uma instância WhatsApp existente. O nome não precisa ser único.',
      method: 'POST',
      path: '/instance/updateInstanceName',
      icon: Settings,
      color: 'indigo',
      features: [
        'Atualiza o nome da instância',
        'Nome não precisa ser único',
        'Retorna dados atualizados da instância'
      ],
      params: [
        { name: 'name', type: 'string', required: true, description: 'Novo nome para a instância' }
      ],
      exampleRequest: {
        name: "Minha Nova Instância 2024!@#"
      },
      responses: [
        {
          status: 200,
          label: "Sucesso",
          body: {
            id: "i91011ijkl",
            token: "abc123xyz",
            status: "connected",
            name: "Minha Nova Instância 2024!@#",
            profileName: "Loja ABC",
            profilePicUrl: "https://example.com/profile.jpg",
            isBusiness: true,
            plataform: "Android",
            systemName: "uazapi",
            owner: "user@example.com"
          }
        },
        {
          status: 401,
          label: "Token inválido/expirado",
          body: {
            error: "Invalid token"
          }
        },
        {
          status: 404,
          label: "Instância não encontrada",
          body: {
            error: "Instance not found"
          }
        },
        {
          status: 500,
          label: "Erro interno",
          body: {
            error: "Internal server error"
          }
        }
      ]
    },
    'instance-delete': {
      title: 'Deletar instância',
      description: 'Remove a instância do sistema permanentemente. Esta ação não pode ser desfeita.',
      method: 'DELETE',
      path: '/instance',
      icon: Trash2,
      color: 'red',
      features: [
        'Remove a instância permanentemente',
        'Desconecta o dispositivo',
        'Remove do banco de dados',
        'Ação irreversível'
      ],
      params: [],
      exampleRequest: {},
      responses: [
        {
          status: 200,
          label: "Instância deletada com sucesso",
          body: {
            response: "Instance Deleted",
            info: "O dispositivo foi desconectado com sucesso e a instância foi removida do banco de dados."
          }
        },
        {
          status: 401,
          label: "Falha na autenticação",
          body: {
            error: "Não autorizado - Token inválido ou ausente"
          }
        },
        {
          status: 404,
          label: "Instância não encontrada",
          body: {
            error: "Instância não encontrada"
          }
        },
        {
          status: 500,
          label: "Erro interno do servidor",
          body: {
            error: "Falha ao deletar instância"
          }
        }
      ]
    },
    'instance-privacy-get': {
      title: 'Buscar configurações de privacidade',
      description: 'Busca as configurações de privacidade atuais da instância do WhatsApp. Retorna todas as configurações como quem pode adicionar aos grupos, ver visto por último, ver status, etc.',
      method: 'GET',
      path: '/instance/privacy',
      icon: Lock,
      color: 'blue',
      features: [
        'Retorna todas as configurações de privacidade',
        'Inclui: grupos, visto por último, status, foto, leitura, online, chamadas',
        'Configurações de broadcast não disponíveis via API'
      ],
      params: [],
      exampleRequest: {},
      responses: [
        {
          status: 200,
          label: "Configurações de privacidade obtidas com sucesso",
          body: {
            groupadd: "contacts",
            last: "contacts",
            status: "contacts",
            profile: "contacts",
            readreceipts: "all",
            online: "all",
            calladd: "all"
          }
        },
        {
          status: 401,
          label: "Token de autenticação inválido",
          body: {
            error: "client not found"
          }
        },
        {
          status: 500,
          label: "Erro interno do servidor",
          body: {
            error: "No session"
          }
        }
      ]
    },
    'instance-privacy-set': {
      title: 'Alterar configurações de privacidade',
      description: 'Altera uma ou múltiplas configurações de privacidade da instância do WhatsApp de forma otimizada. Pode alterar apenas as configurações que realmente mudaram.',
      method: 'POST',
      path: '/instance/privacy',
      icon: Lock,
      color: 'purple',
      features: [
        'Altera apenas configurações que mudaram',
        'Pode alterar uma ou múltiplas configurações',
        'Retorna todas as configurações atualizadas',
        'Valores: all, contacts, contact_blacklist, none, match_last_seen, known'
      ],
      params: [
        { name: 'groupadd', type: 'string', required: false, description: 'Quem pode adicionar aos grupos. Valores: all, contacts, contact_blacklist, none' },
        { name: 'last', type: 'string', required: false, description: 'Quem pode ver visto por último. Valores: all, contacts, contact_blacklist, none' },
        { name: 'status', type: 'string', required: false, description: 'Quem pode ver status (recado embaixo do nome). Valores: all, contacts, contact_blacklist, none' },
        { name: 'profile', type: 'string', required: false, description: 'Quem pode ver foto de perfil. Valores: all, contacts, contact_blacklist, none' },
        { name: 'readreceipts', type: 'string', required: false, description: 'Confirmação de leitura. Valores: all, none' },
        { name: 'online', type: 'string', required: false, description: 'Quem pode ver status online. Valores: all, match_last_seen' },
        { name: 'calladd', type: 'string', required: false, description: 'Quem pode fazer chamadas. Valores: all, known' }
      ],
      exampleRequest: {
        groupadd: "contacts",
        last: "none",
        status: "contacts"
      },
      responses: [
        {
          status: 200,
          label: "Configuração de privacidade alterada com sucesso",
          body: {
            groupadd: "all",
            last: "all",
            status: "all",
            profile: "all",
            readreceipts: "all",
            online: "all",
            calladd: "all"
          }
        },
        {
          status: 400,
          label: "Dados de entrada inválidos",
          body: {
            error: "Invalid privacy value"
          }
        },
        {
          status: 401,
          label: "Token de autenticação inválido",
          body: {
            error: "client not found"
          }
        },
        {
          status: 500,
          label: "Erro interno do servidor",
          body: {
            error: "string"
          }
        }
      ]
    },
    'instance-presence': {
      title: 'Atualizar status de presença',
      description: 'Atualiza o status de presença global da instância do WhatsApp. Permite definir se a instância está disponível (online) ou indisponível (offline).',
      method: 'POST',
      path: '/instance/presence',
      icon: Zap,
      color: 'orange',
      features: [
        'Define status disponível (available) ou indisponível (unavailable)',
        'Controla presença para todos os contatos',
        'Salva estado atual da presença',
        'Atenção: unavailable pode afetar confirmações de entrega/leitura'
      ],
      params: [
        { name: 'presence', type: 'string', required: true, description: 'Status de presença da instância. Valores: available (online) ou unavailable (offline)' }
      ],
      exampleRequest: {
        presence: "available"
      },
      responses: [
        {
          status: 200,
          label: "Presença atualizada com sucesso",
          body: {
            response: "Presence updated successfully"
          }
        },
        {
          status: 400,
          label: "Requisição inválida",
          body: {
            error: "Invalid presence value"
          }
        },
        {
          status: 401,
          label: "Token inválido ou expirado",
          body: {
            error: "client not found"
          }
        },
        {
          status: 500,
          label: "Erro interno do servidor",
          body: {
            error: "No session"
          }
        }
      ]
    },
    'chatwoot-config': {
      title: 'Configurar integração Chatwoot',
      description: 'Atualiza a configuração da integração com Chatwoot para a instância. Configura todos os parâmetros da integração, reinicializa automaticamente o cliente Chatwoot quando habilitado e retorna URL do webhook para configurar no Chatwoot. Sincronização bidirecional de mensagens novas entre WhatsApp e Chatwoot, sincronização automática de contatos (nome e telefone) e atualização automática LID → PN (Local ID para Phone Number). Sistema de nomes inteligentes com til (~). ⚠️ AVISO: Esta integração está em fase BETA - teste em ambiente não-produtivo antes de usar em produção.',
      method: 'PUT',
      path: '/chatwoot/config',
      icon: Settings,
      color: 'purple',
      features: [
        'Configura todos os parâmetros da integração Chatwoot',
        'Reinicializa automaticamente o cliente Chatwoot quando habilitado',
        'Retorna URL do webhook para configurar no Chatwoot',
        'Sincronização bidirecional de mensagens novas entre WhatsApp e Chatwoot',
        'Sincronização automática de contatos (nome e telefone)',
        'Atualização automática LID → PN (Local ID para Phone Number)',
        'Sistema de nomes inteligentes com til (~)',
        'Nomes com til (~) são atualizados automaticamente quando o contato modifica seu nome no WhatsApp',
        'Nomes específicos: Para definir um nome fixo, remova o til (~) do nome no Chatwoot',
        'Durante a migração LID→PN, não haverá duplicação de conversas',
        'Todas as respostas dos agentes aparecem nativamente no Chatwoot',
        '⚠️ FASE BETA: Funcionalidades podem mudar sem aviso prévio',
        '⚠️ LIMITAÇÃO: Sincronização de histórico não implementada - apenas mensagens novas são sincronizadas'
      ],
      params: [
        { name: 'enabled', type: 'boolean', required: true, description: 'Habilitar/desabilitar integração com Chatwoot' },
        { name: 'url', type: 'string', required: true, description: 'URL base da instância Chatwoot (sem barra final). Exemplo: "https://app.chatwoot.com"' },
        { name: 'access_token', type: 'string', required: true, description: 'Token de acesso da API Chatwoot (obtido em Profile Settings > Access Token)' },
        { name: 'account_id', type: 'integer', required: true, description: 'ID da conta no Chatwoot (visível na URL da conta)' },
        { name: 'inbox_id', type: 'integer', required: true, description: 'ID da inbox no Chatwoot (obtido nas configurações da inbox)' },
        { name: 'ignore_groups', type: 'boolean', required: false, description: 'Ignorar mensagens de grupos do WhatsApp na sincronização' },
        { name: 'sign_messages', type: 'boolean', required: false, description: 'Assinar mensagens enviadas para WhatsApp com identificação do agente' },
        { name: 'create_new_conversation', type: 'boolean', required: false, description: 'Sempre criar nova conversa ao invés de reutilizar conversas existentes' }
      ],
      exampleRequest: {
        enabled: true,
        url: "https://chat.evachat.com.br",
        access_token: "pxTv3AJcUwZUSxCS6c8q4JMN",
        account_id: 31,
        inbox_id: 134,
        ignore_groups: false,
        sign_messages: true,
        create_new_conversation: false
      },
      responses: [
        {
          status: 200,
          label: "Configuração atualizada com sucesso",
          body: {
            success: true,
            webhook_url: "https://api.evasend.com.br/whatsapp/chatwoot/webhook/..."
          }
        },
        {
          status: 400,
          label: "Dados inválidos no body da requisição",
          body: {
            error: "Invalid request data"
          }
        },
        {
          status: 401,
          label: "Token inválido/expirado",
          body: {
            error: "Invalid or expired token"
          }
        },
        {
          status: 500,
          label: "Erro interno ao salvar configuração",
          body: {
            error: "Internal server error"
          }
        }
      ]
    }
  };

  const currentEndpointRaw = endpointData[selectedEndpoint as EndpointType];
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
  if (!currentEndpointRaw) {
  return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-600 font-semibold">Endpoint não encontrado</p>
          <p className="text-gray-600 mt-2">Por favor, selecione um endpoint válido.</p>
        </div>
      </div>
    );
  }
  
  const currentEndpoint: EndpointDoc = currentEndpointRaw;
  

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
    .map((response: EndpointResponseExample, idx: number) => `${idx}-${response.status}-${response.label}`)
    .join('|');

  const requestPayload = buildRequestPayload();
  const tokenHeaderValue = testToken || 'seu_token_de_instancia';
  const sanitizedTokenHeaderValue = escapeForShellSingleQuotes(tokenHeaderValue);

  const buildCurlCommand = (opts: { forCopy: boolean }) => {
    const tokenValue = opts.forCopy ? sanitizedTokenHeaderValue : tokenHeaderValue;
    const method = currentEndpoint.method;
    const lines = [
      `curl --request ${method}`,
      `  --url ${buildEndpointUrl(currentEndpoint.path)}`,
    ];

    // Adiciona Content-Type apenas para métodos que enviam body
    if (method !== 'GET' && method !== 'DELETE') {
      lines.push(`  --header 'Content-Type: application/json'`);
    }

    if (requiresSupabaseAuth) {
      const anonValue = SUPABASE_ANON_KEY ? `${SUPABASE_ANON_KEY.substring(0, 30)}...` : 'SUA_CHAVE_ANON';
      lines.push(`  --header 'Authorization: Bearer ${anonValue}'`);
    }

    lines.push(`  --header 'token: ${tokenValue}'`);

    // Adiciona --data apenas para métodos que suportam body e têm payload
    if (method !== 'GET' && method !== 'DELETE' && Object.keys(requestPayload).length > 0) {
      lines.push(`  --data '${JSON.stringify(requestPayload, null, 2)}'`);
    }

    return lines.join(' \\\n');
  };

  const curlCommandForDisplay = buildCurlCommand({ forCopy: false });
  const curlCommandForCopy = buildCurlCommand({ forCopy: true });

  useEffect(() => {
    const nextState: Record<string, boolean> = {};
    responseExamples.forEach((_: EndpointResponseExample, idx: number) => {
      const key = `${selectedEndpoint}-${idx}`;
      nextState[key] = false;
    });
    setExpandedResponses(nextState);
  }, [selectedEndpoint, responseSignature]);

  return (
    <div className="flex h-full bg-white">
      {/* Sidebar */}
      <div className="w-72 bg-slate-50 border-r border-slate-200 overflow-y-auto">
        <div className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 px-6 py-5">
          <h2 className="text-lg font-bold text-slate-900">API Reference</h2>
          <p className="text-xs text-slate-500 mt-1.5">
            Documentação completa da API
          </p>
        </div>

        <div className="px-4 py-4 space-y-1">
          {endpoints.map((group) => {
            const isExpanded = expandedGroups.includes(group.id);
            const toggleGroup = () => {
              setExpandedGroups((prev: string[]) =>
                prev.includes(group.id)
                  ? prev.filter((id: string) => id !== group.id)
                  : [...prev, group.id]
              );
            };

            return (
              <div key={group.id} className="space-y-0.5">
                <button
                  onClick={toggleGroup}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-slate-700 rounded-lg hover:bg-slate-100 transition-colors font-medium"
                >
                  <div className="flex items-center gap-2">
                    <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    <span>{group.label}</span>
                  </div>
                  <span className="text-xs text-slate-400 bg-slate-200 px-2 py-0.5 rounded">{group.count}</span>
                </button>

                {isExpanded && group.children.length > 0 && (
                  <div className="ml-4 mt-1 space-y-0.5 border-l border-slate-200 pl-3">
                    {group.children.map((child) => {
                      const childData = endpointData[child.id];
                      const isSelected = selectedEndpoint === child.id;

                      return (
                        <button
                          key={child.id}
                          onClick={() => setSelectedEndpoint(child.id)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-all ${
                            isSelected
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-medium break-words ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                              {child.label}
                            </div>
                            <div className={`text-xs font-mono mt-0.5 break-words ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                              {childData.path}
                            </div>
                          </div>
                          <span className={`ml-2 text-xs font-semibold px-2 py-0.5 rounded ${getMethodColorClasses(child.method, isSelected)}`}>
                            {child.method}
                          </span>
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
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-white border-b border-slate-200">
          <div className="px-10 py-8">
            <div className="flex items-center gap-2 mb-4">
              <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold ${getMethodColorClasses(currentEndpoint.method)}`}>
                {currentEndpoint.method}
              </span>
              <code className="text-sm font-mono text-slate-500">
                {currentEndpoint.path}
              </code>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-3">{currentEndpoint.title}</h1>
            <p className="text-slate-600 text-base leading-relaxed max-w-4xl">{currentEndpoint.description}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 divide-x divide-slate-200">
          {/* Left Column - Documentation */}
          <div className="px-10 py-8 space-y-10">
            {/* Tokens Section */}
            {!loadingInstances && instances.length > 0 && (
              <div className="bg-slate-50 rounded-lg border border-slate-200 p-6">
                <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Smartphone className="w-4 h-4" />
                  Instâncias Disponíveis
                </h3>
                <div className="space-y-3">
                  {instances.slice(0, 2).map((instance: WhatsAppInstance) => (
                    <div key={instance.id} className="bg-white rounded-lg border border-slate-200 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-slate-900">{instance.name}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          instance.status === 'connected'
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {instance.status === 'connected' ? 'Conectada' : 'Desconectada'}
                        </span>
                      </div>
                      {instance.instance_token && instance.status === 'connected' && (
                        <div className="flex items-center gap-2 mt-3">
                          <code className="flex-1 text-xs text-slate-600 font-mono bg-slate-50 px-3 py-2 rounded border border-slate-200 break-all">
                            {instance.instance_token}
                          </code>
                          <button
                            onClick={() => copyToClipboard(instance.instance_token!, `token-${instance.id}`)}
                            className="p-2 hover:bg-slate-100 rounded transition-colors"
                          >
                            {copiedEndpoint === `token-${instance.id}` ? (
                              <Check className="w-4 h-4 text-green-600" />
                            ) : (
                              <Copy className="w-4 h-4 text-slate-400" />
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
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Recursos</h3>
              <ul className="space-y-3">
                {currentEndpoint.features.map((feature: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-3 text-sm text-slate-600">
                    <div className="mt-1.5 flex h-2 w-2 shrink-0 items-center justify-center rounded-full bg-blue-500"></div>
                    <span className="leading-relaxed">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Parameters */}
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-6">Parâmetros</h3>
              <div className="space-y-6">
                {currentEndpoint.params.map((param: EndpointParam) => (
                  <div key={param.name} className="border-l-2 border-slate-200 pl-4">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="text-base font-mono font-semibold text-slate-900">{param.name}</code>
                        {param.required ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                            obrigatório
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                            opcional
                          </span>
                        )}
                      </div>
                      <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-mono text-slate-500 bg-slate-50 border border-slate-200">
                        {param.type}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">{param.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Example Response */}
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-6">
                {responseExamples.length > 1 ? 'Respostas' : 'Resposta'}
              </h3>
              {responseExamples.length === 0 ? (
                <div className="bg-slate-100 border border-slate-300 rounded-xl p-6 text-sm text-slate-600">
                  Nenhum exemplo de resposta disponível.
                </div>
              ) : (
                <div className="space-y-5">
                  {responseExamples.map((response: EndpointResponseExample, idx: number) => {
                    const statusString = String(response.status);
                    const statusNumber = Number(statusString);
                    const statusText = `HTTP ${statusString}`;
                    const isError = !Number.isNaN(statusNumber)
                      ? statusNumber >= 400
                      : statusString.startsWith('4') || statusString.startsWith('5');
                    const copyKey = `response-${statusString}-${idx}`;
                    const responseKey = `${selectedEndpoint}-${idx}`;
                    const isExpanded = expandedResponses[responseKey] ?? (idx === 0);

                    return (
                      <div
                        key={copyKey}
                        className={`rounded-lg border overflow-hidden ${isError ? 'border-red-200 bg-red-50/30' : 'border-green-200 bg-green-50/30'}`}
                      >
                        <div className="flex items-start justify-between p-4">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedResponses((prev: Record<string, boolean>) => ({
                                ...prev,
                                [responseKey]: !isExpanded,
                              }))
                            }
                            className="flex items-center gap-3 text-left flex-1 group"
                          >
                            <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                            <div className="flex-1">
                              <div className={`text-xs font-semibold mb-1 ${isError ? 'text-red-600' : 'text-green-600'}`}>
                                {statusText}
                              </div>
                              <h4 className="text-sm font-medium text-slate-900 group-hover:text-blue-600 transition-colors">
                                {response.label}
                              </h4>
                            </div>
                          </button>
                          <button
                            onClick={() =>
                              copyToClipboard(JSON.stringify(response.body, null, 2), copyKey)
                            }
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 rounded-lg border border-slate-200 transition-colors text-xs font-medium text-slate-600"
                            type="button"
                          >
                            {copiedEndpoint === copyKey ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-green-600" />
                                <span>Copiado</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copiar</span>
                              </>
                            )}
                          </button>
                        </div>
                        {isExpanded && (
                          <div className="px-4 pb-4 pt-0">
                            <pre className="bg-slate-900 rounded-lg p-4 text-sm font-mono text-slate-100 leading-relaxed overflow-x-auto">
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
            <div className="sticky top-0 z-10 flex border-b border-slate-200 bg-white">
              <button
                onClick={() => setActiveTab('try')}
                className={`flex-1 px-6 py-4 text-sm font-medium transition-all relative ${
                  activeTab === 'try'
                    ? 'text-slate-900 bg-slate-50'
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
                className={`flex-1 px-6 py-4 text-sm font-medium transition-all relative ${
                  activeTab === 'code'
                    ? 'text-slate-900 bg-slate-50'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Code
                {activeTab === 'code' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
                )}
              </button>
            </div>

            <div className="p-8">
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
              onChange={(e) => setTestToken((e.target as HTMLInputElement).value)}
                      placeholder="Digite seu token aqui"
                      className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-700 text-sm placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all shadow-sm"
            />
          </div>

          {(currentEndpoint.method === 'POST' || currentEndpoint.method === 'PUT') && (
          <div>
                    <h4 className="text-sm font-bold text-slate-700 mb-2">Body</h4>
                    <div className="bg-slate-900 rounded-xl p-4 border border-slate-700 font-mono text-sm shadow-lg">
                      <div className="space-y-3">
                        {!(selectedEndpoint === 'profile-name' || selectedEndpoint === 'profile-image' || selectedEndpoint === 'instance-connect' || selectedEndpoint === 'instance-update-name' || selectedEndpoint === 'instance-privacy-set' || selectedEndpoint === 'instance-presence' || selectedEndpoint === 'instance-disconnect' || selectedEndpoint === 'chatwoot-config') && selectedEndpoint !== 'send-status' && (
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
                        {selectedEndpoint === 'profile-name' && (
                          <div className="flex items-center space-x-2">
                            <span className="text-cyan-400 font-semibold">"name"</span>
                            <span className="text-slate-400">:</span>
                            <input
                              type="text"
                              value={profileName}
                              onChange={(e) => setProfileName(e.target.value)}
                              placeholder="Nome do perfil"
                              className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                            />
                          </div>
                        )}
                        {selectedEndpoint === 'profile-image' && (
                          <div className="flex items-center space-x-2">
                            <span className="text-cyan-400 font-semibold">"image"</span>
                            <span className="text-slate-400">:</span>
                            <input
                              type="text"
                              value={profileImage}
                              onChange={(e) => setProfileImage(e.target.value)}
                              placeholder="URL, base64 ou 'remove'/'delete'"
                              className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                            />
                          </div>
                        )}
                        {selectedEndpoint === 'instance-connect' && (
                          <div className="flex items-center space-x-2">
                            <span className="text-cyan-400 font-semibold">"phone"</span>
                            <span className="text-slate-400">:</span>
                            <input
                              type="text"
                              value={instancePhone}
                              onChange={(e) => setInstancePhone(e.target.value)}
                              placeholder="5511999999999 (opcional - deixe vazio para QR code)"
                              className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                            />
                          </div>
                        )}
                        {(selectedEndpoint === 'instance-disconnect' || 
                          selectedEndpoint === 'instance-status' || 
                          selectedEndpoint === 'instance-delete' || 
                          selectedEndpoint === 'instance-privacy-get') && (
                          <div className="text-slate-400 text-xs italic py-2">
                            Este endpoint não requer parâmetros no body
                          </div>
                        )}
                        {selectedEndpoint === 'instance-update-name' && (
                          <div className="flex items-center space-x-2">
                            <span className="text-cyan-400 font-semibold">"name"</span>
                            <span className="text-slate-400">:</span>
                            <input
                              type="text"
                              value={instanceName}
                              onChange={(e) => setInstanceName(e.target.value)}
                              placeholder="Novo nome da instância"
                              className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                            />
                          </div>
                        )}
                        {selectedEndpoint === 'instance-privacy-set' && (
                          <>
                            <div className="flex items-center space-x-2">
                              <span className="text-cyan-400 font-semibold">"groupadd"</span>
                              <span className="text-slate-400">:</span>
                              <select
                                value={privacyGroupadd}
                                onChange={(e) => setPrivacyGroupadd(e.target.value)}
                                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                              >
                                <option value="">Não alterar</option>
                                <option value="all">all</option>
                                <option value="contacts">contacts</option>
                                <option value="contact_blacklist">contact_blacklist</option>
                                <option value="none">none</option>
                              </select>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-cyan-400 font-semibold">"last"</span>
                              <span className="text-slate-400">:</span>
                              <select
                                value={privacyLast}
                                onChange={(e) => setPrivacyLast(e.target.value)}
                                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                              >
                                <option value="">Não alterar</option>
                                <option value="all">all</option>
                                <option value="contacts">contacts</option>
                                <option value="contact_blacklist">contact_blacklist</option>
                                <option value="none">none</option>
                              </select>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-cyan-400 font-semibold">"status"</span>
                              <span className="text-slate-400">:</span>
                              <select
                                value={privacyStatus}
                                onChange={(e) => setPrivacyStatus(e.target.value)}
                                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                              >
                                <option value="">Não alterar</option>
                                <option value="all">all</option>
                                <option value="contacts">contacts</option>
                                <option value="contact_blacklist">contact_blacklist</option>
                                <option value="none">none</option>
                              </select>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-cyan-400 font-semibold">"profile"</span>
                              <span className="text-slate-400">:</span>
                              <select
                                value={privacyProfile}
                                onChange={(e) => setPrivacyProfile(e.target.value)}
                                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                              >
                                <option value="">Não alterar</option>
                                <option value="all">all</option>
                                <option value="contacts">contacts</option>
                                <option value="contact_blacklist">contact_blacklist</option>
                                <option value="none">none</option>
                              </select>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-cyan-400 font-semibold">"readreceipts"</span>
                              <span className="text-slate-400">:</span>
                              <select
                                value={privacyReadreceipts}
                                onChange={(e) => setPrivacyReadreceipts(e.target.value)}
                                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                              >
                                <option value="">Não alterar</option>
                                <option value="all">all</option>
                                <option value="none">none</option>
                              </select>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-cyan-400 font-semibold">"online"</span>
                              <span className="text-slate-400">:</span>
                              <select
                                value={privacyOnline}
                                onChange={(e) => setPrivacyOnline(e.target.value)}
                                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                              >
                                <option value="">Não alterar</option>
                                <option value="all">all</option>
                                <option value="match_last_seen">match_last_seen</option>
                              </select>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-cyan-400 font-semibold">"calladd"</span>
                              <span className="text-slate-400">:</span>
                              <select
                                value={privacyCalladd}
                                onChange={(e) => setPrivacyCalladd(e.target.value)}
                                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                              >
                                <option value="">Não alterar</option>
                                <option value="all">all</option>
                                <option value="known">known</option>
                              </select>
                            </div>
                          </>
                        )}
                        {selectedEndpoint === 'instance-presence' && (
                          <div className="flex items-center space-x-2">
                            <span className="text-cyan-400 font-semibold">"presence"</span>
                            <span className="text-slate-400">:</span>
                            <select
                              value={presenceValue}
                              onChange={(e) => setPresenceValue(e.target.value)}
                              className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                            >
                              <option value="available">available (online)</option>
                              <option value="unavailable">unavailable (offline)</option>
                            </select>
                          </div>
                        )}
                        {selectedEndpoint === 'chatwoot-config' && (
                          <>
                            <div className="flex items-center space-x-2">
                              <span className="text-cyan-400 font-semibold">"enabled"</span>
                              <span className="text-slate-400">:</span>
                              <select
                                value={chatwootEnabled ? 'true' : 'false'}
                                onChange={(e) => setChatwootEnabled(e.target.value === 'true')}
                                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                              >
                                <option value="true">true</option>
                                <option value="false">false</option>
                              </select>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-cyan-400 font-semibold">"url"</span>
                              <span className="text-slate-400">:</span>
                              <input
                                type="text"
                                value={chatwootUrl}
                                onChange={(e) => setChatwootUrl(e.target.value)}
                                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                                placeholder="https://app.chatwoot.com"
                              />
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-cyan-400 font-semibold">"access_token"</span>
                              <span className="text-slate-400">:</span>
                              <input
                                type="text"
                                value={chatwootAccessToken}
                                onChange={(e) => setChatwootAccessToken(e.target.value)}
                                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                                placeholder="Token de acesso da API Chatwoot"
                              />
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-cyan-400 font-semibold">"account_id"</span>
                              <span className="text-slate-400">:</span>
                              <input
                                type="number"
                                value={chatwootAccountId}
                                onChange={(e) => setChatwootAccountId(e.target.value)}
                                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                                placeholder="1"
                              />
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-cyan-400 font-semibold">"inbox_id"</span>
                              <span className="text-slate-400">:</span>
                              <input
                                type="number"
                                value={chatwootInboxId}
                                onChange={(e) => setChatwootInboxId(e.target.value)}
                                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                                placeholder="5"
                              />
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-cyan-400 font-semibold">"ignore_groups"</span>
                              <span className="text-slate-400">:</span>
                              <select
                                value={chatwootIgnoreGroups ? 'true' : 'false'}
                                onChange={(e) => setChatwootIgnoreGroups(e.target.value === 'true')}
                                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                              >
                                <option value="false">false</option>
                                <option value="true">true</option>
                              </select>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-cyan-400 font-semibold">"sign_messages"</span>
                              <span className="text-slate-400">:</span>
                              <select
                                value={chatwootSignMessages ? 'true' : 'false'}
                                onChange={(e) => setChatwootSignMessages(e.target.value === 'true')}
                                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                              >
                                <option value="true">true</option>
                                <option value="false">false</option>
                              </select>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-cyan-400 font-semibold">"create_new_conversation"</span>
                              <span className="text-slate-400">:</span>
                              <select
                                value={chatwootCreateNewConversation ? 'true' : 'false'}
                                onChange={(e) => setChatwootCreateNewConversation(e.target.value === 'true')}
                                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                              >
                                <option value="false">false</option>
                                <option value="true">true</option>
                              </select>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
          )}

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
                  <>
                    {(() => {
                      try {
                        const parsed = JSON.parse(testResponse);
                        // Se for resposta do Chatwoot e tiver webhook_url, destaca
                        if (selectedEndpoint === 'chatwoot-config' && parsed.webhook_url) {
                          const webhookUpdated = parsed.webhook_updated_in_chatwoot === true;
                          const webhookUpdateError = parsed.webhook_update_error;
                          
                          return (
                            <div className="space-y-4">
                              <div className={`bg-gradient-to-r ${webhookUpdated ? 'from-green-500/10 to-emerald-500/10 border-green-500/30' : 'from-blue-500/10 to-cyan-500/10 border-blue-500/30'} border rounded-lg p-4`}>
                                <div className="flex items-center space-x-2 mb-2">
                                  <div className={`w-2 h-2 ${webhookUpdated ? 'bg-green-500' : 'bg-blue-500'} rounded-full ${webhookUpdated ? 'animate-pulse' : ''}`}></div>
                                  <span className={`text-sm font-semibold ${webhookUpdated ? 'text-green-400' : 'text-blue-400'}`}>
                                    {webhookUpdated ? '✅ Webhook configurado automaticamente no Chatwoot!' : 'URL do Webhook para Chatwoot'}
                                  </span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="text"
                                    readOnly
                                    value={parsed.webhook_url}
                                    className={`flex-1 bg-slate-800 border ${webhookUpdated ? 'border-green-500/50 text-green-300' : 'border-blue-500/50 text-blue-300'} rounded-lg px-4 py-2 text-sm font-mono focus:outline-none focus:ring-2 ${webhookUpdated ? 'focus:ring-green-500' : 'focus:ring-blue-500'}`}
                                  />
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(parsed.webhook_url);
                                      setCopiedEndpoint('webhook-url');
                                      setTimeout(() => setCopiedEndpoint(null), 2000);
                                    }}
                                    className={`px-4 py-2 ${webhookUpdated ? 'bg-green-500 hover:bg-green-600' : 'bg-blue-500 hover:bg-blue-600'} text-white rounded-lg transition-colors flex items-center space-x-2`}
                                  >
                                    {copiedEndpoint === 'webhook-url' ? (
                                      <>
                                        <Check className="w-4 h-4" />
                                        <span>Copiado!</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-4 h-4" />
                                        <span>Copiar</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                                {webhookUpdated ? (
                                  <p className="text-xs text-green-300/70 mt-2">
                                    ✅ Webhook atualizado automaticamente no Chatwoot! A integração está pronta para uso.
                                  </p>
                                ) : webhookUpdateError ? (
                                  <div className="mt-2">
                                    <p className="text-xs text-yellow-300/70 mb-1">
                                      ⚠️ Não foi possível atualizar automaticamente o webhook no Chatwoot.
                                    </p>
                                    <p className="text-xs text-yellow-300/70">
                                      Por favor, copie a URL acima e cole manualmente no campo "URL do webhook" nas configurações da inbox no Chatwoot.
                                    </p>
                                    {webhookUpdateError.error && (
                                      <p className="text-xs text-red-300/70 mt-1">
                                        Erro: {typeof webhookUpdateError.error === 'string' ? webhookUpdateError.error : JSON.stringify(webhookUpdateError.error)}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-xs text-blue-300/70 mt-2">
                                    ⚠️ Copie esta URL e cole no campo "URL do webhook" nas configurações da inbox no Chatwoot
                                  </p>
                                )}
                              </div>
                              <div className="border-t border-slate-700 pt-4">
                                <div className="text-xs text-slate-400 mb-2">Resposta completa:</div>
                                <pre className={`text-base font-mono leading-relaxed whitespace-pre-wrap ${testResponseTextClass}`}>
                                  <code className="block">
                                    {JSON.stringify(parsed, null, 2)}
                                  </code>
                                </pre>
                              </div>
                            </div>
                          );
                        }
                        return (
                          <pre className={`text-base font-mono leading-relaxed whitespace-pre-wrap ${testResponseTextClass}`}>
                            <code className="block">
                              {JSON.stringify(parsed, null, 2)}
                            </code>
                          </pre>
                        );
                      } catch {
                        // Se não for JSON válido, retorna como texto simples
                        return (
                          <pre className={`text-base font-mono leading-relaxed whitespace-pre-wrap ${testResponseTextClass}`}>
                            <code className="block">
                              {testResponse}
                            </code>
                          </pre>
                        );
                      }
                    })()}
                  </>
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
