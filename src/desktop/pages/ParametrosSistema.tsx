// Bloco B — Parâmetros do sistema. Regras de negócio antes fixas no código agora
// vivem em site_settings.business_params, editáveis apenas pelo administrador pleno.
// Toda alteração é registrada automaticamente em admin_logs (trigger no banco).
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDesktopAuth } from "@/hooks/useDesktopAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ShieldAlert, Save, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Params = Record<string, number>;

const GROUPS: { title: string; description: string; keys: { key: string; label: string; hint?: string }[] }[] = [
  {
    title: "Marketplace e vendedores",
    description: "Regras do selo de vendedor frequente e das trocas entre usuários.",
    keys: [
      { key: "frequent_seller_min_sales", label: "Vendas para virar vendedor frequente" },
      { key: "frequent_seller_window_days", label: "Janela de apuração (dias)" },
      { key: "urgency_friction_minutes", label: "Aviso anti-pressa: pagar em menos de (minutos)" },
      { key: "dispute_window_hours", label: "Prazo para confirmar ou contestar (horas)" },
      { key: "safe_zone_min_price", label: "Valor a partir do qual sugerir ponto seguro (R$)" },
      { key: "max_forums_per_ad", label: "Máximo de fóruns por anúncio" },
    ],
  },
  {
    title: "Torneios",
    description: "Limites de torneios comunitários e intervalo entre torneios oficiais.",
    keys: [
      { key: "community_tournament_max_participants", label: "Máximo de participantes (comunitário)" },
      { key: "official_tournament_cooldown_weeks", label: "Intervalo entre torneios oficiais (semanas)" },
    ],
  },
  {
    title: "Limites de tentativas",
    description: "Proteção contra abuso em login, denúncias e cupons.",
    keys: [
      { key: "rate_limit_login_attempts", label: "Tentativas de login" },
      { key: "rate_limit_login_window_seconds", label: "Janela do login (segundos)" },
      { key: "rate_limit_reset_attempts", label: "Pedidos de nova senha" },
      { key: "rate_limit_reset_window_seconds", label: "Janela da nova senha (segundos)" },
      { key: "rate_limit_report_attempts", label: "Denúncias por usuário" },
      { key: "rate_limit_report_window_seconds", label: "Janela das denúncias (segundos)" },
      { key: "rate_limit_coupon_attempts", label: "Tentativas de cupom" },
      { key: "rate_limit_coupon_window_seconds", label: "Janela do cupom (segundos)" },
    ],
  },
  {
    title: "Moderação",
    description: "Quando uma denúncia agrupada sobe de prioridade.",
    keys: [
      { key: "report_priority_media_threshold", label: "Denúncias para prioridade média" },
      { key: "report_priority_alta_threshold", label: "Denúncias para prioridade alta" },
      { key: "admin_revert_window_minutes", label: "Prazo para desfazer ação administrativa (minutos)" },
    ],
  },
  {
    title: "XP e perfil",
    description: "Pontos concedidos por contribuição e limites de personalização.",
    keys: [
      { key: "xp_review", label: "XP por avaliação" },
      { key: "xp_forum_post", label: "XP por tópico no fórum" },
      { key: "xp_forum_reply", label: "XP por resposta no fórum" },
      { key: "backlog_note_max_chars", label: "Tamanho do recado de backlog (caracteres)" },
      { key: "trophy_showcase_max", label: "Troféus exibidos na vitrine" },
    ],
  },
];

export default function ParametrosSistema() {
  const { position } = useDesktopAuth();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Params | null>(null);
  const [saving, setSaving] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const openHistory = async () => {
    setHistoryOpen(true);
    setLoadingHistory(true);
    const { data } = await supabase
      .from('config_history')
      .select('*, profiles!changed_by(display_name)')
      .eq('config_key', 'business_params')
      .order('changed_at', { ascending: false })
      .limit(50);
    setHistoryData(data || []);
    setLoadingHistory(false);
  };

  const isFullAdmin = position === "admin";

  const { data, isLoading } = useQuery({
    queryKey: ["business-params"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings").select("value").eq("key", "business_params").maybeSingle();
      if (error) throw error;
      return ((data?.value as unknown) as Params) ?? {};
    },
  });

  const values = useMemo<Params>(() => draft ?? data ?? {}, [draft, data]);
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(data ?? {});

  const setValue = (key: string, raw: string) => {
    const n = Number(raw);
    setDraft({ ...(draft ?? data ?? {}), [key]: Number.isFinite(n) ? n : 0 });
  };

  // GAP-D221: Validação de valores negativos
  const save = async () => {
    if (!draft) return;
    
    // Validação: valores não podem ser negativos
    const invalid = Object.entries(draft).find(([, v]) => !Number.isFinite(v) || v < 0);
    if (invalid) { 
      toast.error(`Valor inválido em "${invalid[0]}": não pode ser negativo ou vazio.`); 
      return; 
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("site_settings").update({ value: draft as any }).eq("key", "business_params");
      
      if (error) throw error;
      
      toast.success("Parâmetros salvos e registrados no histórico administrativo");
      setDraft(null);
      qc.invalidateQueries({ queryKey: ["business-params"] });
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar parâmetros");
    } finally {
      setSaving(false);
    }
  };

  if (!isFullAdmin) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex items-center gap-3 py-8 text-muted-foreground">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            Somente o administrador pleno pode ver e alterar os parâmetros do sistema.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Parâmetros do sistema</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Números que antes estavam fixos no código. Alterações valem para toda a plataforma
            imediatamente e ficam registradas no histórico administrativo.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setDraft(null)} disabled={!dirty || saving}>
            <RotateCcw className="h-4 w-4 mr-2" /> Descartar
          </Button>
          <Button onClick={save} disabled={!dirty || saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar
          </Button>
        </div>
      </div>

      {GROUPS.map((g) => (
        <Card key={g.title}>
          <CardHeader>
            <CardTitle className="text-base">{g.title}</CardTitle>
            <p className="text-xs text-muted-foreground">{g.description}</p>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {g.keys.map(({ key, label }) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={key} className="text-xs">{label}</Label>
                <Input
                  id={key}
                  type="number"
                  min={0}
                  value={values[key] ?? 0}
                  onChange={(e) => setValue(key, e.target.value)}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" /> Histórico de Alterações
            </DialogTitle>
          </DialogHeader>
          {loadingHistory ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : historyData.length === 0 ? (
            <EstadoVazio titulo="Nenhuma alteração registrada" />
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {historyData.map((h) => (
                <div key={h.id} className="bg-card border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{h.config_key}</p>
                    <span className="text-xs text-muted-foreground">{h.changed_by?.display_name || 'Sistema'}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{new Date(h.changed_at).toLocaleString('pt-BR')}</p>
                  <details className="mt-1">
                    <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">Ver detalhes</summary>
                    <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">
                      {JSON.stringify({ old: h.old_value, new: h.new_value }, null, 2)}
                    </pre>
                  </details>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog></div>
  );
}