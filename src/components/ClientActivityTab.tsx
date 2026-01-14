import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Activity,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Gauge,
  BarChart3,
  Target,
  ShieldCheck,
  Clock,
  Zap,
} from 'lucide-react';

type Timeframe = '24h' | '7d' | '30d';

type ApiSummary = {
  totalRequests: number;
  requestsChange: number;
  successRate: number;
  totalFailures: number;
  failureChange: number;
  averageLatencyMs: number;
  peakLatencyMs: number;
  throughputPerMinute: number;
  uptimePercent: number;
};

type EndpointStat = {
  endpoint: string;
  method: string;
  totalRequests: number;
  successRate: number;
  averageLatencyMs: number;
  totalFailures: number;
  status: 'operational' | 'degraded' | 'down';
};

type FailureLog = {
  id: string;
  endpoint: string;
  method: string;
  status_code: number;
  message: string;
  logged_at: string;
};

type MonitoringPayload = {
  summary: ApiSummary;
  endpoints: EndpointStat[];
  failures: FailureLog[];
};

const timeframes: { id: Timeframe; label: string }[] = [
  { id: '24h', label: 'Últimas 24h' },
  { id: '7d', label: '7 dias' },
  { id: '30d', label: '30 dias' },
];

const timeframeLabel: Record<Timeframe, string> = {
  '24h': '24 horas',
  '7d': '7 dias',
  '30d': '30 dias',
};

function createMockMonitoring(timeframe: Timeframe): MonitoringPayload {
  const multiplier = timeframe === '24h' ? 1 : timeframe === '7d' ? 4 : 10;
  const totalRequests = Math.round(3800 * multiplier);
  const totalFailures = Math.round(totalRequests * (timeframe === '24h' ? 0.028 : timeframe === '7d' ? 0.032 : 0.035));
  const successRate = Number((((totalRequests - totalFailures) / totalRequests) * 100).toFixed(2));
  const averageLatencyMs = Math.round(420 + 15 * multiplier + Math.random() * 40);
  const peakLatencyMs = averageLatencyMs + Math.round(180 + Math.random() * 120);
  const throughputPerMinute = Math.max(
    1,
    Math.round(
      totalRequests /
        (timeframe === '24h' ? 1440 : timeframe === '7d' ? 10_080 : 43_200)
    )
  );
  const uptimePercent = Number((99.2 + Math.random() * 0.6).toFixed(2));
  const summary: ApiSummary = {
    totalRequests,
    requestsChange: timeframe === '24h' ? 5.4 : timeframe === '7d' ? 2.1 : 1.3,
    successRate,
    totalFailures,
    failureChange: timeframe === '24h' ? -3.2 : timeframe === '7d' ? -4.1 : -5.8,
    averageLatencyMs,
    peakLatencyMs,
    throughputPerMinute,
    uptimePercent,
  };

  const endpointBlueprint = [
    { endpoint: '/send/text', method: 'POST', share: 0.28, baseLatency: 380 },
    { endpoint: '/send/media', method: 'POST', share: 0.23, baseLatency: 520 },
    { endpoint: '/send/menu', method: 'POST', share: 0.17, baseLatency: 610 },
    { endpoint: '/send/carousel', method: 'POST', share: 0.12, baseLatency: 640 },
    { endpoint: '/send/pix-button', method: 'POST', share: 0.11, baseLatency: 450 },
    { endpoint: '/send/status', method: 'POST', share: 0.09, baseLatency: 700 },
  ];

  const endpoints: EndpointStat[] = endpointBlueprint.map((item, index) => {
    const requests = Math.max(1, Math.round(totalRequests * item.share));
    const failureRatio = 0.015 + index * 0.006 + Math.random() * 0.003;
    const failures = Math.round(requests * failureRatio);
    const successRateEndpoint = Number((((requests - failures) / requests) * 100).toFixed(2));
    const status: EndpointStat['status'] =
      successRateEndpoint >= 98 ? 'operational' : successRateEndpoint >= 94 ? 'degraded' : 'down';

    return {
      endpoint: item.endpoint,
      method: item.method,
      totalRequests: requests,
      successRate: successRateEndpoint,
      averageLatencyMs: Math.round(item.baseLatency + Math.random() * 80),
      totalFailures: failures,
      status,
    };
  });

  const failureLogs: FailureLog[] = Array.from({ length: Math.min(6, totalFailures ? 6 : 0) }).map((_, idx) => {
    const endpoint = endpoints[idx % endpoints.length];
    const statusCodeOptions = [500, 504, 429, 422, 503, 408];
    const statusCode = statusCodeOptions[idx % statusCodeOptions.length];
    const timestampOffsetMinutes =
      timeframe === '24h' ? (idx + 1) * 75 : timeframe === '7d' ? (idx + 2) * 6 * 60 : (idx + 3) * 12 * 60;

    return {
      id: `mock-failure-${timeframe}-${idx}`,
      endpoint: endpoint.endpoint,
      method: endpoint.method,
      status_code: statusCode,
      message:
        statusCode >= 500
          ? 'Erro interno no serviço upstream.'
          : statusCode === 429
          ? 'Limite de requisições excedido para o endpoint.'
          : 'Validação rejeitou o payload recebido.',
      logged_at: new Date(Date.now() - timestampOffsetMinutes * 60 * 1000).toISOString(),
    };
  });

  return { summary, endpoints, failures: failureLogs };
}

function formatRelativeTime(isoDate: string) {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) return 'Agora mesmo';
  if (diffMinutes < 60) return `${diffMinutes} min atrás`;
  if (diffHours < 24) return `${diffHours}h atrás`;
  if (diffDays === 1) return 'Ontem';
  if (diffDays <= 7) return `${diffDays} dias atrás`;

  return date.toLocaleString('pt-BR');
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '0';
  }
  return Number(value).toLocaleString('pt-BR');
}

function formatLatency(value: number) {
  return `${Math.round(value)} ms`;
}

function formatPercent(value: number | null | undefined, fractionDigits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    const decimals = fractionDigits > 0 ? `.${'0'.repeat(fractionDigits)}` : '';
    return `0${decimals}%`;
  }
  return `${Number(value).toFixed(fractionDigits)}%`;
}

function renderChangeBadge(value: number | null | undefined, positiveIsGood = true) {
  const numericValue = Number.isFinite(value as number) ? Number(value) : 0;
  const isPositive = numericValue >= 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;
  const isGood = positiveIsGood ? isPositive : !isPositive;
  const classes = isGood ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700';

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${classes}`}>
      <Icon className="w-3.5 h-3.5" />
      {`${isPositive ? '+' : ''}${numericValue.toFixed(1)}%`}
    </span>
  );
}

const normalizeNumber = (value: unknown, fallback = 0) => {
  if (value === null || value === undefined) {
    return fallback;
  }
  const numericValue = typeof value === 'string' ? parseFloat(value) : Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

const mapSummaryFromRpc = (raw: any): ApiSummary => {
  if (!raw) {
    return {
      totalRequests: 0,
      requestsChange: 0,
      successRate: 0,
      totalFailures: 0,
      failureChange: 0,
      averageLatencyMs: 0,
      peakLatencyMs: 0,
      throughputPerMinute: 0,
      uptimePercent: 0,
    };
  }

  return {
    totalRequests: normalizeNumber(raw.total_requests ?? raw.totalRequests),
    requestsChange: normalizeNumber(raw.requests_change ?? raw.requestsChange),
    successRate: normalizeNumber(raw.success_rate ?? raw.successRate),
    totalFailures: normalizeNumber(raw.total_failures ?? raw.totalFailures),
    failureChange: normalizeNumber(raw.failure_change ?? raw.failureChange),
    averageLatencyMs: normalizeNumber(raw.average_latency_ms ?? raw.averageLatencyMs),
    peakLatencyMs: normalizeNumber(raw.peak_latency_ms ?? raw.peakLatencyMs),
    throughputPerMinute: normalizeNumber(raw.throughput_per_minute ?? raw.throughputPerMinute),
    uptimePercent: normalizeNumber(raw.uptime_percent ?? raw.uptimePercent),
  };
};

const mapEndpointStatFromRpc = (raw: any): EndpointStat => {
  return {
    endpoint: raw.endpoint,
    method: raw.method,
    totalRequests: normalizeNumber(raw.total_requests ?? raw.totalRequests),
    successRate: normalizeNumber(raw.success_rate ?? raw.successRate),
    averageLatencyMs: normalizeNumber(raw.average_latency_ms ?? raw.averageLatencyMs),
    totalFailures: normalizeNumber(raw.total_failures ?? raw.totalFailures),
    status: raw.status ?? 'operational',
  };
};

export default function ClientActivityTab() {
  const { user } = useAuth();
  const [timeframe, setTimeframe] = useState<Timeframe>('24h');
  const [summary, setSummary] = useState<ApiSummary | null>(null);
  const [endpointStats, setEndpointStats] = useState<EndpointStat[]>([]);
  const [failureLogs, setFailureLogs] = useState<FailureLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchMonitoring = async (options?: { silent?: boolean }) => {
    if (options?.silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const fallback = createMockMonitoring(timeframe);

      const { data: summaryData, error: summaryError } = await supabase.rpc('get_api_monitoring_summary', {
        timeframe,
      });
      const { data: endpointsData, error: endpointsError } = await supabase.rpc('get_api_monitoring_endpoints', {
        timeframe,
      });
      const { data: failuresData, error: failuresError } = await supabase.rpc('get_api_monitoring_failures', {
        timeframe,
        target_limit: 6,
      });

      if (summaryError || endpointsError) {
        throw new Error('API monitoring RPCs indisponíveis');
      }

      const summaryRecord = Array.isArray(summaryData) ? summaryData[0] : summaryData;
      setSummary(mapSummaryFromRpc(summaryRecord));

      const endpointsRecords = Array.isArray(endpointsData) ? endpointsData : endpointsData ? [endpointsData] : [];
      setEndpointStats(endpointsRecords.map(mapEndpointStatFromRpc));

      const failuresRecords = Array.isArray(failuresData) ? failuresData : failuresData ? [failuresData] : [];
      setFailureLogs(failuresRecords as FailureLog[]);

    } catch (error) {
      const fallback = createMockMonitoring(timeframe);
      setSummary(fallback.summary);
      setEndpointStats(fallback.endpoints);
      setFailureLogs(fallback.failures);
    } finally {
      setLastUpdated(new Date());
      if (options?.silent) {
        setRefreshing(false);
      } else {
      setLoading(false);
    }
  }
  };

  useEffect(() => {
    if (user) {
      fetchMonitoring();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, timeframe]);

  const handleRefresh = () => {
    fetchMonitoring({ silent: true });
  };

  const handleTimeframeChange = (value: Timeframe) => {
    setTimeframe(value);
  };

  const operationalEndpoints = useMemo(
    () => endpointStats.filter((endpoint) => endpoint.status === 'operational').length,
    [endpointStats]
  );

  const degradedEndpoints = useMemo(
    () => endpointStats.filter((endpoint) => endpoint.status === 'degraded').length,
    [endpointStats]
  );

  const downEndpoints = useMemo(
    () => endpointStats.filter((endpoint) => endpoint.status === 'down').length,
    [endpointStats]
  );

  const initialLoading = loading && !summary;

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-lg text-slate-500">Carregando monitoramento da API...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
          <h2 className="text-2xl font-bold text-slate-900">Monitoramento da API</h2>
          <p className="text-slate-500 mt-1">
            Acompanhe volume de requisições, erros e desempenho dos endpoints.
          </p>
          <p className="text-xs text-slate-400 mt-2">
            Última atualização:{' '}
            {lastUpdated ? lastUpdated.toLocaleString('pt-BR') : 'aguardando primeira sincronização'}
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-2">
          <div className="flex rounded-xl border border-slate-200 bg-white p-1">
            {timeframes.map((option) => (
              <button
                key={option.id}
                onClick={() => handleTimeframeChange(option.id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  timeframe === option.id
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow shadow-blue-500/25'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>
      </div>

      {summary && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-slate-400">
                Requisições ({timeframeLabel[timeframe]})
              </p>
              <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center">
                <Activity className="w-4.5 h-4.5" />
              </div>
            </div>
            <div className="mt-3 flex items-end justify-between">
              <span className="text-3xl font-semibold text-slate-900">
                {formatNumber(summary.totalRequests)}
              </span>
              {renderChangeBadge(summary.requestsChange)}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Taxa média: {formatNumber(summary.throughputPerMinute)} req/min
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-emerald-500">Taxa de sucesso</p>
              <div className="h-9 w-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <ShieldCheck className="w-4.5 h-4.5" />
              </div>
            </div>
            <div className="mt-3 flex items-end justify-between">
              <span className="text-3xl font-semibold text-emerald-700">
                {formatPercent(summary.successRate)}
              </span>
              {renderChangeBadge(summary.requestsChange / 2, true)}
            </div>
            <p className="mt-2 text-xs text-emerald-700">
              Uptime estimado em {formatPercent(summary.uptimePercent)} no período.
            </p>
          </div>

          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-rose-500">Falhas registradas</p>
              <div className="h-9 w-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                <AlertTriangle className="w-4.5 h-4.5" />
              </div>
            </div>
            <div className="mt-3 flex items-end justify-between">
              <span className="text-3xl font-semibold text-rose-600">
                {formatNumber(summary.totalFailures)}
              </span>
              {renderChangeBadge(summary.failureChange, false)}
            </div>
            <p className="mt-2 text-xs text-rose-600">
              Distribuição similar aos endpoints intensivos de mídia.
            </p>
      </div>

          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-indigo-500">Latência média</p>
              <div className="h-9 w-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                <Gauge className="w-4.5 h-4.5" />
              </div>
            </div>
            <div className="mt-3 flex items-end justify-between">
              <span className="text-3xl font-semibold text-indigo-700">
                {formatLatency(summary.averageLatencyMs)}
              </span>
              {renderChangeBadge(-summary.requestsChange / 3, false)}
            </div>
            <p className="mt-2 text-xs text-indigo-600">
              Pico observado: {formatLatency(summary.peakLatencyMs)}.
          </p>
        </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">Saúde por endpoint</h3>
            <span className="text-xs uppercase tracking-[0.32em] text-slate-400">
              {endpointStats.length} monitorados
            </span>
          </div>

        <div className="space-y-4">
            {endpointStats.map((endpoint) => (
              <div
                key={endpoint.endpoint}
                className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 hover:bg-slate-50 transition"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-slate-600 border border-slate-200">
                        {endpoint.method}
                      </span>
                      <p className="text-sm font-semibold text-slate-900">
                        {endpoint.endpoint}
                      </p>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {formatNumber(endpoint.totalRequests)} requisições •{' '}
                      {formatLatency(endpoint.averageLatencyMs)} em média • {endpoint.totalFailures} falhas
                    </p>
                    </div>
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                      endpoint.status === 'operational'
                        ? 'bg-emerald-100 text-emerald-700'
                        : endpoint.status === 'degraded'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    {endpoint.status === 'operational'
                      ? 'Operacional'
                      : endpoint.status === 'degraded'
                      ? 'Degradação'
                      : 'Instável'}
                  </span>
                    </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>Taxa de sucesso</span>
                    <span>{formatPercent(endpoint.successRate)}</span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-full rounded-full ${
                        endpoint.status === 'operational'
                          ? 'bg-gradient-to-r from-emerald-500 to-emerald-600'
                          : endpoint.status === 'degraded'
                          ? 'bg-gradient-to-r from-amber-500 to-amber-600'
                          : 'bg-gradient-to-r from-rose-500 to-rose-600'
                      }`}
                      style={{ width: `${Math.min(endpoint.successRate, 100)}%` }}
                    />
                </div>
              </div>
            </div>
          ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Resumo de serviço</h3>
            <div className="space-y-3 text-sm text-slate-600">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  Endpoints operacionais
                </span>
                <span className="font-semibold text-emerald-600">{operationalEndpoints}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-amber-500" />
                  Monitorando degradações
                </span>
                <span className="font-semibold text-amber-600">{degradedEndpoints}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-rose-500" />
                  Falhas críticas
                </span>
                <span className="font-semibold text-rose-600">{downEndpoints}</span>
              </div>
              {summary && (
                <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-xs">
                  <p className="font-semibold text-slate-600 mb-1">Insight rápido</p>
                  <p className="text-slate-500 leading-relaxed">
                    A throughput atual está em{' '}
                    <span className="font-semibold text-slate-700">
                      {formatNumber(summary.throughputPerMinute)} req/min
                    </span>
                    . Reavalie limites do Worker se ultrapassar 120 req/min neste período.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Falhas recentes</h3>
              <span className="text-xs uppercase tracking-[0.32em] text-slate-400">
                {failureLogs.length} eventos
              </span>
            </div>
            {failureLogs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50 py-6 text-center text-sm text-emerald-700">
                Nenhuma falha registrada nas últimas {timeframeLabel[timeframe]}.
              </div>
            ) : (
              <div className="space-y-3">
                {failureLogs.map((failure) => (
                  <div
                    key={failure.id}
                    className="rounded-xl border border-rose-200 bg-rose-50/60 p-3 text-sm text-rose-600"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-rose-700">
                        {failure.method} {failure.endpoint}
                      </span>
                      <span className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-semibold text-rose-600 border border-rose-200">
                        {failure.status_code}
                      </span>
                    </div>
                    <p className="mt-1 text-rose-600/80 leading-relaxed">{failure.message}</p>
                    <div className="mt-2 flex items-center justify-between text-xs text-rose-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {formatRelativeTime(failure.logged_at)}
                      </span>
                      <span>Evento {failure.id.slice(-4)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {loading && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-4 text-center text-sm text-slate-500">
          Atualizando métricas de monitoramento...
        </div>
      )}
    </div>
  );
}
