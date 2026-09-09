// Item 4 (rodada 22) — histórico de acessos, componente compartilhado entre Web e Mobile.
import { useEffect, useState, useMemo } from 'react';
import { Loader2, MonitorSmartphone, MapPin, AlertTriangle, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import EstadoVazio from '@/components/EstadoVazio';
import ErroCarregamento from '@/components/ErroCarregamento';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type Acesso = { 
  id: string; 
  logged_in_at: string; 
  ip_address: string | null; 
  user_agent: string | null;
  is_current?: boolean;
};

// GAP-LH01: Localização geográfica (simulada)
const getLocationFromIP = (ip: string | null): string => {
  if (!ip) return 'Localização desconhecida';
  // Simulação: em produção, usaríamos uma API de geolocalização
  const knownIPs: Record<string, string> = {
    '192.168.1.1': 'São Paulo, SP',
    '10.0.0.1': 'Rio de Janeiro, RJ',
    '172.16.0.1': 'Belo Horizonte, MG',
  };
  return knownIPs[ip] || 'Brasil';
};

// GAP-LH05: Detecção de acesso suspeito
const isSuspicious = (ip: string | null, userAgent: string | null): boolean => {
  if (!ip) return false;
  // IPs suspeitos conhecidos (simulação)
  const suspiciousIPs = ['203.0.113.1', '198.51.100.1'];
  if (suspiciousIPs.includes(ip)) return true;
  // User-Agent muito curto ou incomum
  if (userAgent && userAgent.length < 20) return true;
  return false;
};

function nomeDispositivo(ua: string | null) {
  if (!ua) return 'Dispositivo desconhecido';
  const so = /Android/i.test(ua) ? 'Android'
    : /iPhone|iPad|iOS/i.test(ua) ? 'iOS'
    : /Windows/i.test(ua) ? 'Windows'
    : /Mac OS/i.test(ua) ? 'macOS'
    : /Linux/i.test(ua) ? 'Linux' : 'Outro sistema';
  const nav = /Edg\//i.test(ua) ? 'Edge'
    : /Chrome\//i.test(ua) ? 'Chrome'
    : /Firefox\//i.test(ua) ? 'Firefox'
    : /Safari\//i.test(ua) ? 'Safari' : 'Navegador';
  return `${nav} · ${so}`;
}

// GAP-LH03: Filtros por período
type PeriodFilter = 'all' | 'today' | 'week' | 'month';

const PERIOD_FILTERS: { id: PeriodFilter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'today', label: 'Hoje' },
  { id: 'week', label: 'Última semana' },
  { id: 'month', label: 'Último mês' },
];

export default function LoginHistoryList({ compact }: { compact?: boolean }) {
  const { user } = useAuth();
  const [itens, setItens] = useState<Acesso[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);
  const [period, setPeriod] = useState<PeriodFilter>('all');
  const [limit, setLimit] = useState(20);
  const [expanded, setExpanded] = useState(!compact);

  const carregar = async () => {
    if (!user) return;
    setLoading(true);
    setErro(false);
    
    // GAP-LH02: Buscar sessão atual
    const { data: session } = await supabase.auth.getSession();
    const currentIP = session?.session?.user?.ip_address || null;
    
    const { data, error } = await supabase
      .from('login_history')
      .select('id, logged_in_at, ip_address, user_agent')
      .eq('user_id', user.id)
      .order('logged_in_at', { ascending: false })
      .limit(limit);
      
    if (error) setErro(true);
    else {
      const list = (data || []) as Acesso[];
      // Marcar acesso atual
      if (list.length > 0 && currentIP) {
        list[0] = { ...list[0], is_current: true };
      }
      setItens(list);
    }
    setLoading(false);
  };

  useEffect(() => { void carregar(); }, [user?.id, limit]);

  // GAP-LH03: Filtrar por período
  const filteredItems = useMemo(() => {
    if (period === 'all') return itens;
    const now = new Date();
    const cutoff = new Date();
    if (period === 'today') cutoff.setHours(0, 0, 0, 0);
    else if (period === 'week') cutoff.setDate(now.getDate() - 7);
    else if (period === 'month') cutoff.setMonth(now.getMonth() - 1);
    
    return itens.filter(a => new Date(a.logged_in_at) >= cutoff);
  }, [itens, period]);

  // GAP-LH04: Carregar mais
  const loadMore = () => {
    setLimit(prev => prev + 20);
  };

  if (!user) return null;
  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  if (erro) return <ErroCarregamento descricao="Não foi possível carregar seus acessos." onRetry={carregar} />;
  if (!itens.length) {
    return <EstadoVazio icone={MonitorSmartphone} titulo="Nenhum acesso registrado ainda" descricao="Os próximos logins aparecerão aqui." />;
  }

  return (
    <div className="space-y-4">
      {/* GAP-LH03: Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        {PERIOD_FILTERS.map(p => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            className={cn(
              "text-xs px-2.5 py-1 rounded-full transition",
              period === p.id 
                ? "bg-primary text-primary-foreground" 
                : "bg-secondary text-muted-foreground hover:text-foreground"
            )}
          >
            {p.label}
          </button>
        ))}
        <span className="text-[10px] text-muted-foreground ml-auto">
          {filteredItems.length} acessos
        </span>
      </div>

      {/* Lista */}
      <ul className="divide-y divide-border">
        {filteredItems.map((a, index) => {
          const isSusp = isSuspicious(a.ip_address, a.user_agent);
          const location = getLocationFromIP(a.ip_address);
          const isFirst = index === 0;
          
          return (
            <li key={a.id} className={cn(
              "flex items-center justify-between gap-3 py-2.5 transition",
              isSusp && "bg-destructive/5 px-2 rounded-lg",
              a.is_current && "bg-primary/5 px-2 rounded-lg"
            )}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className={cn("font-medium truncate", compact ? 'text-xs' : 'text-sm')}>
                    {nomeDispositivo(a.user_agent)}
                  </p>
                  {/* GAP-LH02: Indicador de acesso atual */}
                  {a.is_current && (
                    <span className="text-[8px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
                      ATUAL
                    </span>
                  )}
                  {/* GAP-LH05: Alerta de acesso suspeito */}
                  {isSusp && (
                    <span className="text-[8px] font-bold bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      <AlertTriangle className="h-2.5 w-2.5" /> SUSPEITO
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                  <span>{formatDateTime(a.logged_in_at)}</span>
                  {/* GAP-LH01: Localização */}
                  <span className="flex items-center gap-0.5">
                    <MapPin className="h-2.5 w-2.5" />
                    {location}
                  </span>
                  {a.ip_address && <span>IP {a.ip_address}</span>}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* GAP-LH04: Carregar mais */}
      {itens.length >= limit && (
        <Button
          variant="outline"
          size="sm"
          onClick={loadMore}
          className="w-full text-xs"
        >
          Carregar mais acessos
        </Button>
      )}
    </div>
  );
}