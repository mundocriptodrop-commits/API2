import { useState, useEffect } from 'react';
import { Copy, Check, Code, Send, Smartphone, Image, Shield, Info } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface WhatsAppInstance {
  id: string;
  name: string;
  instance_token: string | null;
  status: 'disconnected' | 'connecting' | 'connected';
  phone_number: string | null;
}

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

  const displayApiUrl = 'https://api.evasend.com.br/whatsapp/send-text';
  const actualApiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-text`;
  const displayMediaUrl = 'https://api.evasend.com.br/whatsapp/send-media';
  const actualMediaUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-media`;

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
      const response = await fetch(actualApiUrl, {
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'connecting':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected':
        return 'Conectada';
      case 'connecting':
        return 'Conectando';
      default:
        return 'Desconectada';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Documentação da API</h2>
        <p className="text-gray-600">
          Integre facilmente o envio de mensagens WhatsApp em sua aplicação. Suporte para texto e mídia.
        </p>
      </div>

      {/* Rate Limiting Info */}
      <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl p-5 border border-purple-200">
        <div className="flex items-start space-x-3">
          <Shield className="w-6 h-6 text-purple-600 flex-shrink-0 mt-1" />
          <div className="flex-1">
            <h3 className="font-semibold text-purple-900 mb-2">Rate Limiting</h3>
            <p className="text-sm text-purple-800 mb-3">
              O sistema implementa proteção contra abuso com limites de requisições:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-white rounded-lg p-3 border border-purple-200">
                <p className="text-xs font-semibold text-purple-700 mb-1">Limite por IP</p>
                <p className="text-lg font-bold text-purple-900">1.000 req/min</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-purple-200">
                <p className="text-xs font-semibold text-purple-700 mb-1">Limite por Token</p>
                <p className="text-lg font-bold text-purple-900">1.000 req/min</p>
              </div>
            </div>
            <div className="mt-3 bg-white rounded-lg p-3 border border-purple-200">
              <div className="flex items-start space-x-2">
                <Info className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-purple-800">
                  Todas as respostas incluem headers informativos: <code className="bg-purple-50 px-1 py-0.5 rounded">X-RateLimit-Limit</code>, <code className="bg-purple-50 px-1 py-0.5 rounded">X-RateLimit-Remaining</code>, <code className="bg-purple-50 px-1 py-0.5 rounded">X-RateLimit-Reset</code>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {!loadingInstances && instances.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-green-50 to-green-100 px-6 py-4 border-b border-green-200">
            <h3 className="font-semibold text-green-900 flex items-center">
              <Smartphone className="w-5 h-5 mr-2" />
              Tokens das Instâncias Conectadas
            </h3>
          </div>

          <div className="p-6 space-y-4">
            {instances.map((instance) => (
              <div
                key={instance.id}
                className="bg-gray-50 rounded-lg p-4 space-y-3 border border-gray-200"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Smartphone className="w-5 h-5 text-gray-600" />
                    <div>
                      <p className="font-semibold text-gray-900">{instance.name}</p>
                      {instance.phone_number && (
                        <p className="text-sm text-gray-600">{instance.phone_number}</p>
                      )}
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(instance.status)}`}>
                    {getStatusText(instance.status)}
                  </span>
                </div>

                {instance.instance_token && instance.status === 'connected' ? (
                  <div className="bg-white rounded-lg p-3 border border-gray-300">
                    <label className="block text-xs font-semibold text-gray-700 mb-2">Token da Instância</label>
                    <div className="flex items-center space-x-2">
                      <code className="flex-1 font-mono text-sm text-gray-800 break-all">
                        {instance.instance_token}
                      </code>
                      <button
                        onClick={() => copyToClipboard(instance.instance_token!, `token-${instance.id}`)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                      >
                        {copiedEndpoint === `token-${instance.id}` ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4 text-gray-600" />
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                    <p className="text-sm text-yellow-800">
                      {instance.status === 'connected'
                        ? 'Token não disponível para esta instância'
                        : 'Conecte a instância para visualizar o token'}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
        <div className="flex items-start space-x-3">
          <Code className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
          <div className="w-full">
            <h3 className="font-semibold text-blue-900 mb-2">Base URL</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-blue-800 mb-1">URL API (Produção)</label>
                <div className="bg-white rounded-lg p-3 font-mono text-sm text-gray-800 flex items-center justify-between">
                  <span className="break-all">{displayApiUrl}</span>
                  <button
                    onClick={() => copyToClipboard(displayApiUrl, 'display-url')}
                    className="ml-3 p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                  >
                    {copiedEndpoint === 'display-url' ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-600" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900 flex items-center">
            <Send className="w-5 h-5 mr-2" />
            POST /send-text
          </h3>
          <p className="text-sm text-gray-600 mt-1">Enviar mensagem de texto via WhatsApp</p>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h4 className="font-semibold text-gray-900 mb-3">Headers</h4>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 font-mono text-sm">
              <div className="flex items-center">
                <span className="text-blue-600 font-semibold w-40">Content-Type:</span>
                <span className="text-gray-800">application/json</span>
              </div>
              <div className="flex items-center">
                <span className="text-blue-600 font-semibold w-40">token:</span>
                <span className="text-gray-800">seu_token_de_autenticacao</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-3">Body (JSON)</h4>
            <div className="bg-gray-900 rounded-lg p-4 relative overflow-x-auto">
              <button
                onClick={() => copyToClipboard('{\n  "number": "5511999999999",\n  "text": "Olá! Como posso ajudar?"\n}', 'body')}
                className="absolute top-3 right-3 p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                {copiedEndpoint === 'body' ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-gray-400" />
                )}
              </button>
              <pre className="text-sm text-gray-100">
{`{
  "number": "5511999999999",
  "text": "Olá! Como posso ajudar?"
}`}
              </pre>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-3">Parâmetros</h4>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Campo</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Tipo</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Descrição</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="px-4 py-3 text-sm font-mono text-blue-600">number</td>
                    <td className="px-4 py-3 text-sm text-gray-600">string</td>
                    <td className="px-4 py-3 text-sm text-gray-600">Número de telefone com código do país (ex: 5511999999999)</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm font-mono text-blue-600">text</td>
                    <td className="px-4 py-3 text-sm text-gray-600">string</td>
                    <td className="px-4 py-3 text-sm text-gray-600">Mensagem de texto a ser enviada</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-3">Exemplo cURL</h4>
            <div className="bg-gray-900 rounded-lg p-4 relative overflow-x-auto">
              <button
                onClick={() => copyToClipboard(`curl --request POST \\\n  --url ${displayApiUrl} \\\n  --header 'Content-Type: application/json' \\\n  --header 'token: seu_token_aqui' \\\n  --data '{\n  "number": "5511999999999",\n  "text": "Olá! Como posso ajudar?"\n}'`, 'curl')}
                className="absolute top-3 right-3 p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                {copiedEndpoint === 'curl' ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-gray-400" />
                )}
              </button>
              <pre className="text-sm text-gray-100 whitespace-pre-wrap">
{`curl --request POST \\
  --url ${displayApiUrl} \\
  --header 'Content-Type: application/json' \\
  --header 'token: seu_token_aqui' \\
  --data '{
  "number": "5511999999999",
  "text": "Olá! Como posso ajudar?"
}'`}
              </pre>
            </div>
          </div>
        </div>
      </div>

      {/* Send Media Endpoint */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-green-50 to-green-100 px-6 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900 flex items-center">
            <Image className="w-5 h-5 mr-2" />
            POST /send-media
          </h3>
          <p className="text-sm text-gray-600 mt-1">Enviar mídia (imagem, vídeo, documento, áudio, sticker) via WhatsApp</p>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h4 className="font-semibold text-gray-900 mb-3">Headers</h4>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 font-mono text-sm">
              <div className="flex items-center">
                <span className="text-blue-600 font-semibold w-40">Content-Type:</span>
                <span className="text-gray-800">application/json</span>
              </div>
              <div className="flex items-center">
                <span className="text-blue-600 font-semibold w-40">token:</span>
                <span className="text-gray-800">seu_token_de_autenticacao</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-3">Body (JSON)</h4>
            <div className="bg-gray-900 rounded-lg p-4 relative overflow-x-auto">
              <button
                onClick={() => copyToClipboard('{\n  "number": "5511999999999",\n  "type": "image",\n  "file": "https://exemplo.com/foto.jpg",\n  "text": "Veja esta foto!"\n}', 'media-body')}
                className="absolute top-3 right-3 p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                {copiedEndpoint === 'media-body' ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-gray-400" />
                )}
              </button>
              <pre className="text-sm text-gray-100">
{`{
  "number": "5511999999999",
  "type": "image",
  "file": "https://exemplo.com/foto.jpg",
  "text": "Veja esta foto!"
}`}
              </pre>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-3">Parâmetros Principais</h4>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Campo</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Tipo</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Obrigatório</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Descrição</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="px-4 py-3 text-sm font-mono text-blue-600">number</td>
                    <td className="px-4 py-3 text-sm text-gray-600">string</td>
                    <td className="px-4 py-3 text-sm text-gray-600"><span className="text-red-600 font-semibold">Sim</span></td>
                    <td className="px-4 py-3 text-sm text-gray-600">Número com código do país</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm font-mono text-blue-600">type</td>
                    <td className="px-4 py-3 text-sm text-gray-600">string</td>
                    <td className="px-4 py-3 text-sm text-gray-600"><span className="text-red-600 font-semibold">Sim</span></td>
                    <td className="px-4 py-3 text-sm text-gray-600">image, video, document, audio, myaudio, ptt, sticker</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm font-mono text-blue-600">file</td>
                    <td className="px-4 py-3 text-sm text-gray-600">string</td>
                    <td className="px-4 py-3 text-sm text-gray-600"><span className="text-red-600 font-semibold">Sim</span></td>
                    <td className="px-4 py-3 text-sm text-gray-600">URL ou base64 do arquivo</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm font-mono text-blue-600">text</td>
                    <td className="px-4 py-3 text-sm text-gray-600">string</td>
                    <td className="px-4 py-3 text-sm text-gray-600">Não</td>
                    <td className="px-4 py-3 text-sm text-gray-600">Caption/legenda (aceita placeholders)</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-sm font-mono text-blue-600">docName</td>
                    <td className="px-4 py-3 text-sm text-gray-600">string</td>
                    <td className="px-4 py-3 text-sm text-gray-600">Não</td>
                    <td className="px-4 py-3 text-sm text-gray-600">Nome do arquivo (apenas para documents)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-3">Tipos de Mídia Suportados</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {['image', 'video', 'document', 'audio', 'myaudio', 'ptt', 'sticker'].map((type) => (
                <div key={type} className="bg-gray-50 rounded-lg p-3 border border-gray-200 text-center">
                  <p className="text-sm font-mono text-gray-800">{type}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-3">Exemplo cURL</h4>
            <div className="bg-gray-900 rounded-lg p-4 relative overflow-x-auto">
              <button
                onClick={() => copyToClipboard(`curl --request POST \\\n  --url ${displayMediaUrl} \\\n  --header 'Content-Type: application/json' \\\n  --header 'token: seu_token_aqui' \\\n  --data '{\n  "number": "5511999999999",\n  "type": "image",\n  "file": "https://exemplo.com/foto.jpg",\n  "text": "Veja esta foto!"\n}'`, 'media-curl')}
                className="absolute top-3 right-3 p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                {copiedEndpoint === 'media-curl' ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-gray-400" />
                )}
              </button>
              <pre className="text-sm text-gray-100 whitespace-pre-wrap">
{`curl --request POST \\
  --url ${displayMediaUrl} \\
  --header 'Content-Type: application/json' \\
  --header 'token: seu_token_aqui' \\
  --data '{
  "number": "5511999999999",
  "type": "image",
  "file": "https://exemplo.com/foto.jpg",
  "text": "Veja esta foto!"
}'`}
              </pre>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
          <h3 className="font-semibold text-white flex items-center">
            <Send className="w-5 h-5 mr-2" />
            Testar API
          </h3>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Token</label>
            <input
              type="text"
              value={testToken}
              onChange={(e) => setTestToken(e.target.value)}
              placeholder="Seu token de autenticação"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Número</label>
            <input
              type="text"
              value={testNumber}
              onChange={(e) => setTestNumber(e.target.value)}
              placeholder="5511999999999"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Mensagem</label>
            <textarea
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              placeholder="Olá! Como posso ajudar?"
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <button
            onClick={handleTest}
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-3 rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Enviando...</span>
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                <span>Enviar Teste</span>
              </>
            )}
          </button>

          {testResponse && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Resposta</label>
              <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                <pre className="text-sm text-gray-100">{testResponse}</pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
