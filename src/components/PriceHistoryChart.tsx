import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  CartesianGrid, ReferenceLine, Legend, Brush 
} from 'recharts';
import { TrendingDown, History, Download, TrendingUp, Activity } from 'lucide-react';
import { formatCurrency, formatDateShort } from '@/lib/format';
import { toast } from 'sonner';

interface Point { date: string; price: number; }

// GAP-PH03: Calcular média
const calculateAverage = (data: Point[]): number => {
  if (data.length === 0) return 0;
  const sum = data.reduce((acc, p) => acc + p.price, 0);
  return sum / data.length;
};

// GAP-PH02: Exportar CSV
const exportToCSV = (data: Point[]) => {
  if (data.length === 0) {
    toast.error('Sem dados para exportar');
    return;
  }
  
  const headers = 'Data,Preço\n';
  const rows = data.map(p => `${p.date},${p.price}`).join('\n');
  const csv = headers + rows;
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `historico_precos_${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  
  toast.success('Dados exportados com sucesso!');
};

interface PriceHistoryChartProps {
  productId: string;
  currentPrice: number;
  /** GAP-PH01: Habilitar zoom */
  enableZoom?: boolean;
  /** GAP-PH02: Habilitar exportação */
  enableExport?: boolean;
  /** GAP-PH03: Mostrar linha de média */
  showAverage?: boolean;
  /** GAP-PH04: Mostrar legendas */
  showLegend?: boolean;
}

export default function PriceHistoryChart({ 
  productId, 
  currentPrice,
  enableZoom = true,
  enableExport = true,
  showAverage = true,
  showLegend = true,
}: PriceHistoryChartProps) {
  const [data, setData] = useState<Point[]>([]);
  const [minPrice, setMinPrice] = useState<number | null>(null);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [showAverageLine, setShowAverageLine] = useState(showAverage);

  useEffect(() => {
    (async () => {
      const { data: rows } = await supabase
        .from('price_history' as any)
        .select('price, recorded_at')
        .eq('product_id', productId)
        .order('recorded_at', { ascending: false })
        .limit(50);
      const pts: Point[] = ((rows as any) || [])
        .slice()
        .reverse()
        .map((r: any) => ({
          date: formatDateShort(r.recorded_at),
          price: Number(r.price),
        }));
      setData(pts);
      if (pts.length) {
        const prices = pts.map(p => p.price);
        setMinPrice(Math.min(...prices, currentPrice));
        setMaxPrice(Math.max(...prices, currentPrice));
      } else {
        setMinPrice(currentPrice);
        setMaxPrice(currentPrice);
      }
    })();
  }, [productId, currentPrice]);

  // GAP-PH03: Calcular média
  const averagePrice = useMemo(() => calculateAverage(data), [data]);
  const isLowest = minPrice !== null && currentPrice <= minPrice;
  const isHighest = maxPrice !== null && currentPrice >= maxPrice;

  // GAP-PH04: Legendas customizadas
  const CustomLegend = ({ payload }: any) => {
    if (!showLegend || !payload) return null;
    return (
      <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-1.5">
            <span 
              className="w-3 h-0.5 rounded" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 mt-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">Histórico de Preços</h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* GAP-PH02: Botão de exportação */}
          {enableExport && data.length > 0 && (
            <button
              onClick={() => exportToCSV(data)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary text-xs font-medium hover:bg-secondary/70 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Exportar
            </button>
          )}
          
          {/* Badge de menor preço */}
          {isLowest && (
            <span className="inline-flex items-center gap-1 bg-success/15 text-success text-xs font-bold px-2.5 py-1 rounded-full border border-success/30">
              <TrendingDown className="h-3.5 w-3.5" /> Menor preço
            </span>
          )}
          {isHighest && (
            <span className="inline-flex items-center gap-1 bg-destructive/15 text-destructive text-xs font-bold px-2.5 py-1 rounded-full border border-destructive/30">
              <TrendingUp className="h-3.5 w-3.5" /> Maior preço
            </span>
          )}
        </div>
      </div>

      {data.length < 2 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          Ainda não há histórico suficiente para exibir um gráfico. Acompanhe este jogo — registramos cada mudança de preço.
          {minPrice !== null && (
            <span className="block mt-2">Preço atual: <strong className={isLowest ? 'text-success' : 'text-price'}>{formatCurrency(currentPrice)}</strong></span>
          )}
        </p>
      ) : (
        <>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart 
                data={data} 
                margin={{ top: 5, right: 10, bottom: 5, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} 
                />
                <YAxis 
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} 
                  domain={['auto', 'auto']} 
                />
                
                {/* GAP-PH01: Zoom com Brush */}
                {enableZoom && data.length > 10 && (
                  <Brush
                    dataKey="date"
                    height={20}
                    stroke="hsl(var(--primary))"
                    className="mt-1"
                  />
                )}
                
                <Tooltip
                  contentStyle={{ 
                    background: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))', 
                    borderRadius: 8 
                  }}
                  formatter={(v: number) => [`${formatCurrency(v)}`, 'Preço']}
                />
                
                {/* GAP-PH04: Legendas */}
                {showLegend && (
                  <Legend 
                    content={<CustomLegend />}
                    verticalAlign="bottom"
                    height={30}
                  />
                )}
                
                {/* Linha principal */}
                <Line 
                  type="monotone" 
                  dataKey="price" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2} 
                  dot={{ r: 3 }}
                  name="Preço"
                />
                
                {/* GAP-PH03: Linha de preço médio */}
                {showAverageLine && averagePrice > 0 && (
                  <ReferenceLine 
                    y={averagePrice} 
                    stroke="hsl(var(--muted-foreground))" 
                    strokeDasharray="5 5"
                    label={{
                      value: `Média: ${formatCurrency(averagePrice)}`,
                      fill: 'hsl(var(--muted-foreground))',
                      fontSize: 10,
                      position: 'right',
                    }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
          
          <div className="flex flex-wrap items-center justify-between gap-2 mt-4 text-xs text-muted-foreground">
            <span>
              {data.length} registros
              {minPrice !== null && (
                <span className="ml-2">
                  Menor: <strong className={isLowest ? 'text-success' : 'text-price'}>{formatCurrency(minPrice)}</strong>
                </span>
              )}
              {maxPrice !== null && (
                <span className="ml-2">
                  Maior: <strong className={isHighest ? 'text-destructive' : 'text-foreground'}>{formatCurrency(maxPrice)}</strong>
                </span>
              )}
              {averagePrice > 0 && (
                <span className="ml-2">
                  Média: <span className="text-muted-foreground">{formatCurrency(averagePrice)}</span>
                </span>
              )}
            </span>
            <span>
              Preço atual: <strong className={isLowest ? 'text-success' : 'text-price'}>{formatCurrency(currentPrice)}</strong>
            </span>
          </div>
        </>
      )}
    </div>
  );
}