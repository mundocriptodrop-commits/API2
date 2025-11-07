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
    <div className="flex h-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-slate-200 overflow-y-auto shadow-lg">
        <div className="p-6 border-b border-slate-200 bg-gradient-to-br from-blue-500 to-indigo-600">
          <h3 className="text-xs font-bold text-blue-100 mb-2 tracking-wider uppercase">Endpoints</h3>
          <div className="text-3xl font-bold text-white">91</div>
          <p className="text-xs text-blue-100 mt-1">Recursos disponíveis</p>
        </div>

        <div className="p-3">
          {endpoints.map((group) => (
            <div key={group.id} className="mb-2">
              <button className="w-full flex items-center justify-between px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 rounded-xl transition-all duration-200 font-medium">
                <div className="flex items-center space-x-3">
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                  <span>{group.label}</span>
                </div>
                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">{group.count}</span>
              </button>

              {group.children.length > 0 && (
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
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 border-b border-indigo-500 px-8 py-8 shadow-xl">
          <div className="flex items-center space-x-3 mb-3">
            <span className={`px-4 py-1.5 rounded-lg text-sm font-bold shadow-lg ${
              currentEndpoint.color === 'cyan' ? 'bg-cyan-500 text-white' : 'bg-green-500 text-white'
            }`}>
              {currentEndpoint.method}
            </span>
            <h1 className="text-2xl font-bold text-white/90">{currentEndpoint.path}</h1>
          </div>
          <h2 className="text-4xl font-bold text-white mb-3">{currentEndpoint.title}</h2>
          <p className="text-blue-100 text-lg">{currentEndpoint.description}</p>
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
              <h3 className="text-lg font-bold text-slate-800 mb-4">Resposta de Exemplo</h3>
              <div className="bg-slate-900 rounded-xl p-5 border border-slate-700 relative shadow-lg">
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
                <pre className="text-sm text-slate-100 font-mono">
                  {JSON.stringify(currentEndpoint.exampleResponse, null, 2)}
                </pre>
              </div>
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
                      currentEndpoint.color === 'cyan' ? 'bg-cyan-500' : 'bg-green-500'
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
                    <h4 className="text-sm font-bold text-slate-700 mb-2">Subdomain</h4>
                    <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value="sender"
                          disabled
                          className="flex-1 bg-transparent text-slate-500 text-sm outline-none font-mono"
                        />
                        <span className="text-slate-400">.evasend.com.br</span>
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
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-bold text-slate-700">Body</h4>
                      <button className="text-xs text-blue-600 hover:text-blue-700 font-semibold">+ Novo Campo</button>
                    </div>
                    <div className="bg-slate-900 rounded-xl p-4 border border-slate-700 font-mono text-sm shadow-lg">
                      <div className="space-y-3">
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

                  {testResponse && (
                    <div>
                      <div className="text-sm font-bold text-slate-700 mb-2">Resposta</div>
                      <div className="bg-slate-900 rounded-xl p-4 border border-slate-700 max-h-80 overflow-y-auto shadow-lg">
                        {testResponse === '' ? (
                          <div className="text-center py-12 text-slate-400 text-sm">
                            Nenhuma resposta ainda<br />
                            <span className="text-xs">Envie uma requisição para ver o resultado</span>
                          </div>
                        ) : (
                          <pre className="text-xs text-slate-100 font-mono whitespace-pre-wrap">
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
                    <select className="bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-slate-700 text-sm font-semibold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm">
                      <option>cURL</option>
                      <option>JavaScript</option>
                      <option>Python</option>
                    </select>
                  </div>

                  <div className="bg-slate-900 rounded-xl p-5 border border-slate-700 relative shadow-lg">
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
                    <pre className="text-sm text-slate-100 font-mono whitespace-pre-wrap pr-12">
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
