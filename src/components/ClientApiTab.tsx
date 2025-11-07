import { useState, useEffect } from 'react';
import { Copy, Check, ChevronRight, Send, Image, Smartphone, Shield, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface WhatsAppInstance {
  id: string;
  name: string;
  instance_token: string | null;
  status: 'disconnected' | 'connecting' | 'connected';
  phone_number: string | null;
}

type EndpointType = 'send-text' | 'send-media';

export default function ClientApiTab() {
  const { user } = useAuth();
  const [copiedEndpoint, setCopiedEndpoint] = useState<string | null>(null);
  const [testNumber, setTestNumber] = useState('5511999999999');
  const [testMessage, setTestMessage] = useState('Olá! Como posso ajudar?');
  const [testToken, setTestToken] = useState('');
  const [testResponse, setTestResponse] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(true);
  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointType>('send-text');
  const [activeTab, setActiveTab] = useState<'try' | 'code'>('try');

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
      const endpoint = selectedEndpoint === 'send-text' ? 'send-text' : 'send-media';
      const response = await fetch(`${actualApiUrl}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'token': testToken,
        },
        body: JSON.stringify({
          number: testNumber,
          text: testMessage,
        }),
      });

      const data = await response.json();
      setTestResponse(JSON.stringify(data, null, 2));
    } catch (error) {
      setTestResponse(JSON.stringify({ error: 'Erro ao fazer requisição' }, null, 2));
    } finally {
      setIsLoading(false);
    }
  };

  const endpoints = [
    {
      id: 'administracao' as const,
      label: 'Administração',
      count: 5,
      children: []
    },
    {
      id: 'instancia' as const,
      label: 'Instancia',
      count: 8,
      children: []
    },
    {
      id: 'perfil' as const,
      label: 'Perfil',
      count: 2,
      children: []
    },
    {
      id: 'enviar-mensagem' as const,
      label: 'Enviar Mensagem',
      count: 11,
      children: [
        { id: 'send-text' as EndpointType, label: 'Enviar mensagem de texto', method: 'POST' },
        { id: 'send-media' as EndpointType, label: 'Enviar mídia (imagem, vídeo, áudio ou documento)', method: 'POST' },
      ]
    }
  ];

  const endpointData = {
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
    }
  };

  const currentEndpoint = endpointData[selectedEndpoint];
  const IconComponent = currentEndpoint.icon;

  return (
    <div className="flex h-full bg-slate-950">
      {/* Sidebar */}
      <div className="w-80 bg-slate-900 border-r border-slate-800 overflow-y-auto">
        <div className="p-4 border-b border-slate-800">
          <h3 className="text-sm font-semibold text-slate-400 mb-1">ENDPOINTS</h3>
          <div className="text-2xl font-bold text-white">91</div>
        </div>

        <div className="p-2">
          {endpoints.map((group) => (
            <div key={group.id} className="mb-1">
              <button className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 rounded-lg transition-colors">
                <div className="flex items-center space-x-2">
                  <ChevronRight className="w-4 h-4" />
                  <span>{group.label}</span>
                </div>
                <span className="text-xs text-slate-500">{group.count}</span>
              </button>

              {group.children.length > 0 && (
                <div className="ml-4 mt-1 space-y-1">
                  {group.children.map((child) => (
                    <button
                      key={child.id}
                      onClick={() => setSelectedEndpoint(child.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors ${
                        selectedEndpoint === child.id
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <span className="text-left text-xs">{child.label}</span>
                      <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                        child.id === 'send-text' ? 'bg-cyan-500 text-white' : 'bg-green-500 text-white'
                      }`}>
                        {child.method}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 border-b border-slate-700 px-8 py-6">
          <div className="flex items-center space-x-3 mb-2">
            <span className={`px-3 py-1 rounded-md text-sm font-bold ${
              currentEndpoint.color === 'cyan' ? 'bg-cyan-500' : 'bg-green-500'
            } text-white`}>
              {currentEndpoint.method}
            </span>
            <h1 className="text-2xl font-bold text-white">{currentEndpoint.path}</h1>
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">{currentEndpoint.title}</h2>
          <p className="text-slate-400">{currentEndpoint.description}</p>
        </div>

        <div className="grid grid-cols-2 divide-x divide-slate-800">
          {/* Left Column - Documentation */}
          <div className="p-8 space-y-8">
            {/* Tokens Section */}
            {!loadingInstances && instances.length > 0 && (
              <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                <div className="bg-gradient-to-r from-green-900/30 to-green-800/30 px-6 py-4 border-b border-green-800/50">
                  <h3 className="font-semibold text-green-400 flex items-center">
                    <Smartphone className="w-5 h-5 mr-2" />
                    Tokens das Instâncias
                  </h3>
                </div>
                <div className="p-6 space-y-4">
                  {instances.slice(0, 2).map((instance) => (
                    <div key={instance.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">{instance.name}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          instance.status === 'connected'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-slate-700 text-slate-400'
                        }`}>
                          {instance.status === 'connected' ? 'Conectada' : 'Desconectada'}
                        </span>
                      </div>
                      {instance.instance_token && instance.status === 'connected' && (
                        <div className="bg-slate-800 rounded-lg p-3 flex items-center space-x-2">
                          <code className="flex-1 text-xs text-slate-300 font-mono break-all">
                            {instance.instance_token}
                          </code>
                          <button
                            onClick={() => copyToClipboard(instance.instance_token!, `token-${instance.id}`)}
                            className="p-1.5 hover:bg-slate-700 rounded transition-colors flex-shrink-0"
                          >
                            {copiedEndpoint === `token-${instance.id}` ? (
                              <Check className="w-4 h-4 text-green-400" />
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

            {/* Rate Limiting */}
            <div className="bg-slate-900 rounded-xl border border-amber-800/50 overflow-hidden">
              <div className="bg-gradient-to-r from-amber-900/30 to-orange-900/30 px-6 py-4 border-b border-amber-800/50">
                <h3 className="font-semibold text-amber-400 flex items-center">
                  <Shield className="w-5 h-5 mr-2" />
                  Rate Limiting
                </h3>
              </div>
              <div className="p-6">
                <p className="text-sm text-slate-400 mb-4">
                  Proteção contra abuso com limites de requisições:
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800 rounded-lg p-4 text-center">
                    <div className="text-xs text-slate-500 mb-1">Limite por IP</div>
                    <div className="text-2xl font-bold text-amber-400">1.000</div>
                    <div className="text-xs text-slate-500">req/min</div>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-4 text-center">
                    <div className="text-xs text-slate-500 mb-1">Limite por Token</div>
                    <div className="text-2xl font-bold text-amber-400">1.000</div>
                    <div className="text-xs text-slate-500">req/min</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Features */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Recursos Específicos</h3>
              <ul className="space-y-2">
                {currentEndpoint.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start space-x-2 text-sm text-slate-400">
                    <span className="text-green-400 mt-0.5">•</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Parameters */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Campos Comuns</h3>
              <div className="space-y-3">
                {currentEndpoint.params.map((param) => (
                  <div key={param.name} className="bg-slate-900 rounded-lg p-4 border border-slate-800">
                    <div className="flex items-start justify-between mb-2">
                      <code className="text-sm font-mono text-cyan-400">{param.name}</code>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-slate-500">{param.type}</span>
                        {param.required && (
                          <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-xs font-semibold">
                            required
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-slate-400">{param.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Example Response */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Resposta de Exemplo</h3>
              <div className="bg-slate-950 rounded-lg p-4 border border-slate-800 relative">
                <button
                  onClick={() => copyToClipboard(JSON.stringify(currentEndpoint.exampleResponse, null, 2), 'response')}
                  className="absolute top-3 right-3 p-2 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  {copiedEndpoint === 'response' ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-slate-400" />
                  )}
                </button>
                <pre className="text-sm text-slate-300 font-mono">
                  {JSON.stringify(currentEndpoint.exampleResponse, null, 2)}
                </pre>
              </div>
            </div>
          </div>

          {/* Right Column - Try It / Code */}
          <div className="bg-slate-900">
            {/* Tabs */}
            <div className="flex border-b border-slate-800">
              <button
                onClick={() => setActiveTab('try')}
                className={`flex-1 px-6 py-4 text-sm font-semibold transition-colors ${
                  activeTab === 'try'
                    ? 'bg-slate-800 text-white border-b-2 border-cyan-500'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                Try It
              </button>
              <button
                onClick={() => setActiveTab('code')}
                className={`flex-1 px-6 py-4 text-sm font-semibold transition-colors ${
                  activeTab === 'code'
                    ? 'bg-slate-800 text-white border-b-2 border-cyan-500'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                Code
              </button>
            </div>

            <div className="p-6">
              {activeTab === 'try' ? (
                <div className="space-y-6">
                  {/* Form */}
                  <div>
                    <div className="bg-cyan-500 text-white px-4 py-2 rounded-t-lg font-semibold text-sm">
                      {currentEndpoint.method}
                    </div>
                    <div className="bg-slate-950 px-4 py-3 rounded-b-lg border border-slate-800 border-t-0">
                      <div className="text-sm text-slate-400 font-mono">
                        {displayApiUrl}{currentEndpoint.path}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-slate-300 mb-2">Subdomain</h4>
                    <div className="bg-slate-950 rounded-lg p-3 border border-slate-800">
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value="sender"
                          disabled
                          className="flex-1 bg-transparent text-slate-400 text-sm outline-none"
                        />
                        <span className="text-slate-600">.uazapi.com</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-slate-300 mb-2 flex items-center">
                      token
                      <span className="ml-1 text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={testToken}
                      onChange={(e) => setTestToken(e.target.value)}
                      placeholder="Enter your token"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-slate-300 text-sm placeholder-slate-600 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-slate-300">Body</h4>
                      <button className="text-xs text-cyan-400 hover:text-cyan-300">+ Novo</button>
                    </div>
                    <div className="bg-slate-950 rounded-lg p-4 border border-slate-800 font-mono text-sm">
                      <div className="space-y-2">
                        <div className="text-slate-400">
                          <span className="text-cyan-400">"number"</span>:
                          <input
                            type="text"
                            value={testNumber}
                            onChange={(e) => setTestNumber(e.target.value)}
                            className="ml-2 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-300 text-xs outline-none focus:border-cyan-500"
                          />
                        </div>
                        <div className="text-slate-400">
                          <span className="text-cyan-400">"text"</span>:
                          <input
                            type="text"
                            value={testMessage}
                            onChange={(e) => setTestMessage(e.target.value)}
                            className="ml-2 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-300 text-xs outline-none focus:border-cyan-500 w-64"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleTest}
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-5 h-5" />
                        <span>Send API Request</span>
                      </>
                    )}
                  </button>

                  {testResponse && (
                    <div>
                      <div className="text-sm font-semibold text-slate-300 mb-2">Response</div>
                      <div className="bg-slate-950 rounded-lg p-4 border border-slate-800 max-h-64 overflow-y-auto">
                        {testResponse === '' ? (
                          <div className="text-center py-8 text-slate-500 text-sm">
                            No response yet<br />
                            Send a request to see the actual response
                          </div>
                        ) : (
                          <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap">
                            {testResponse}
                          </pre>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="mb-4">
                    <select className="bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-300 text-sm outline-none">
                      <option>cURL</option>
                      <option>JavaScript</option>
                      <option>Python</option>
                    </select>
                  </div>

                  <div className="bg-slate-950 rounded-lg p-4 border border-slate-800 relative">
                    <button
                      onClick={() => copyToClipboard(`curl --request POST \\\n  --url ${displayApiUrl}${currentEndpoint.path} \\\n  --header 'Content-Type: application/json' \\\n  --header 'token: seu_token_aqui' \\\n  --data '${JSON.stringify(currentEndpoint.exampleRequest, null, 2)}'`, 'curl-code')}
                      className="absolute top-3 right-3 p-2 hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      {copiedEndpoint === 'curl-code' ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                    <pre className="text-sm text-slate-300 font-mono whitespace-pre-wrap pr-12">
{`curl --request POST \\
  --url ${displayApiUrl}${currentEndpoint.path} \\
  --header 'Content-Type: application/json' \\
  --header 'token: seu_token_aqui' \\
  --data '${JSON.stringify(currentEndpoint.exampleRequest, null, 2)}'`}
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
