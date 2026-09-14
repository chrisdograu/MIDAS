// Itens 108/110 — tela do moderador para partidas com placar divergente.
// Só aparece para moderadores do torneio específico (tournament_moderators) ou admin.
import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, Gavel, CheckCircle2, XCircle, Image, Upload, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import EstadoVazio from '@/components/EstadoVazio';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { adminLog } from '../lib/adminLog';
import { formatDateTime } from '@/lib/format';

interface Row {
  id: string;
  tournament_id: string;
  tournament_name: string;
  round_label: string | null;
  player_a: string | null;
  player_b: string | null;
  name_a: string;
  name_b: string;
  score_a: number | null;
  score_b: number | null;
  reported_score_a: number | null;
  reported_score_b: number | null;
  reported_by: string | null;
  reporter_name: string;
  reported_at: string | null;
  proof_a: string | null;
  proof_b: string | null;
}

export default function DisputasPartidas() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [edit, setEdit] = useState<Record<string, { a: string; b: string }>>({});
  const [reason, setReason] = useState<Record<string, string>>({});
  const [decisionDialog, setDecisionDialog] = useState<{ row: Row; winner: 'a' | 'b' } | null>(null);
  const [proofDialog, setProofDialog] = useState<{ row: Row; player: 'a' | 'b' } | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: matches } = await supabase
      .from('tournament_matches')
      .select('id, tournament_id, round_label, player_a, player_b, score_a, score_b, reported_score_a, reported_score_b, reported_by, reported_at, proof_a, proof_b')
      .eq('dispute_open', true)
      .order('reported_at', { ascending: false })
      .limit(200);

    const list = (matches || []) as any[];
    if (!list.length) { setRows([]); setLoading(false); return; }

    const tids = [...new Set(list.map(m => m.tournament_id))];
    const uids = [...new Set(list.flatMap(m => [m.player_a, m.player_b, m.reported_by]).filter(Boolean))] as string[];

    const [{ data: tours }, { data: profs }] = await Promise.all([
      supabase.from('tournaments').select('id, title').in('id', tids),
      uids.length ? supabase.from('profiles').select('id, display_name').in('id', uids) : Promise.resolve({ data: [] as any[] }),
    ]);
    const tMap = new Map((tours || []).map((t: any) => [t.id, t.title]));
    const pMap = new Map((profs || []).map((p: any) => [p.id, p.display_name || 'Jogador']));

    setRows(list.map(m => ({
      ...m,
      tournament_name: tMap.get(m.tournament_id) || 'Torneio',
      name_a: pMap.get(m.player_a) || 'Jogador A',
      name_b: pMap.get(m.player_b) || 'Jogador B',
      reporter_name: pMap.get(m.reported_by) || '—',
      proof_a: m.proof_a,
      proof_b: m.proof_b,
    })));
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  const decide = async (row: Row, winner: 'a' | 'b') => {
    const values = edit[row.id];
    const a = Number(values?.a ?? row.score_a ?? 0);
    const b = Number(values?.b ?? row.score_b ?? 0);
    const justification = reason[row.id] || 'Decisão do moderador';
    
    if (Number.isNaN(a) || Number.isNaN(b)) { toast.error('Placar inválido'); return; }
    if (justification.trim().length < 4) { toast.error('Justificativa obrigatória (mínimo 4 caracteres)'); return; }
    
    setSaving(row.id);
    const winnerId = winner === 'a' ? row.player_a : row.player_b;
    
    const { error } = await supabase.from('tournament_matches').update({
      score_a: a, score_b: b, winner: winnerId, status: 'finished', dispute_open: false,
    } as any).eq('id', row.id);
    
    setSaving(null);
    if (error) { toast.error('Sem permissão para decidir esta partida'); return; }
    
    await adminLog({
      action: 'resolve_match_dispute',
      entity: 'tournament_matches',
      entity_id: row.id,
      reason: justification,
      payload: { 
        score_a: a, 
        score_b: b, 
        winner: winnerId,
        vencedor_nome: winner === 'a' ? row.name_a : row.name_b,
      },
    });
    
    toast.success(`Resultado decidido: ${winner === 'a' ? row.name_a : row.name_b} venceu`);
    setDecisionDialog(null);
    load();
  };

  const openProof = (row: Row, player: 'a' | 'b') => {
    setProofDialog({ row, player });
  };

  if (loading) return <div className="p-6 flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Gavel className="h-6 w-6 text-primary" /> Disputas de Partida
        </h1>
        <p className="text-muted-foreground text-sm">
          Partidas em que os dois jogadores reportaram placares diferentes. Visível apenas para moderadores do torneio.
        </p>
      </div>

      {rows.length === 0 ? (
        <Card className="border-border/50"><CardContent className="p-0">
          <EstadoVazio titulo="Nenhuma disputa aberta" descricao="Partidas com placares divergentes aparecem aqui para decisão do moderador." />
        </CardContent></Card>
      ) : rows.map(row => (
        <Card key={row.id} className="border-warning/40">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <span className="font-semibold">{row.tournament_name}</span>
              <span className="text-muted-foreground">· {row.round_label || 'Partida'}</span>
              <Badge variant="outline" className="text-xs">Disputa</Badge>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* GAP-D107: Comprovantes lado a lado */}
              <div className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Resultado registrado por {row.reporter_name}</p>
                  {row.reported_at && (
                    <span className="text-[10px] text-muted-foreground">{formatDateTime(row.reported_at)}</span>
                  )}
                </div>
                <p className="text-lg font-bold">
                  {row.name_a} {row.reported_score_a ?? '—'} × {row.reported_score_b ?? '—'} {row.name_b}
                </p>
                <div className="flex gap-2 mt-2">
                  {row.proof_a && (
                    <Button variant="outline" size="sm" onClick={() => openProof(row, 'a')}>
                      <Image className="h-3 w-3 mr-1" /> Prova A
                    </Button>
                  )}
                  {row.proof_b && (
                    <Button variant="outline" size="sm" onClick={() => openProof(row, 'b')}>
                      <Image className="h-3 w-3 mr-1" /> Prova B
                    </Button>
                  )}
                  {!row.proof_a && !row.proof_b && (
                    <span className="text-xs text-muted-foreground">Sem comprovantes anexados</span>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-warning/30 p-3 bg-warning/5">
                <p className="text-xs text-muted-foreground">Decisão do moderador</p>
                <div className="flex items-center gap-2 mt-1">
                  <input 
                    type="number" 
                    min={0}
                    placeholder={row.name_a}
                    value={edit[row.id]?.a ?? String(row.score_a ?? '')}
                    onChange={e => setEdit(s => ({ ...s, [row.id]: { a: e.target.value, b: s[row.id]?.b ?? String(row.score_b ?? '') } }))}
                    className="w-16 px-2 py-1 rounded bg-background border border-border text-sm" 
                  />
                  <span className="text-sm font-bold text-muted-foreground">×</span>
                  <input 
                    type="number" 
                    min={0}
                    placeholder={row.name_b}
                    value={edit[row.id]?.b ?? String(row.score_b ?? '')}
                    onChange={e => setEdit(s => ({ ...s, [row.id]: { b: e.target.value, a: s[row.id]?.a ?? String(row.score_a ?? '') } }))}
                    className="w-16 px-2 py-1 rounded bg-background border border-border text-sm" 
                  />
                </div>
                <div className="mt-2">
                  <Textarea
                    placeholder="Justificativa da decisão (mín. 4 caracteres)"
                    value={reason[row.id] || ''}
                    onChange={e => setReason(r => ({ ...r, [row.id]: e.target.value }))}
                    className="text-xs h-16"
                  />
                </div>
                <div className="flex gap-2 mt-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="flex-1 text-success border-success hover:bg-success/10"
                    onClick={() => setDecisionDialog({ row, winner: 'a' })}
                    disabled={saving === row.id}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> {row.name_a} vence
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="flex-1 text-destructive border-destructive hover:bg-destructive/10"
                    onClick={() => setDecisionDialog({ row, winner: 'b' })}
                    disabled={saving === row.id}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> {row.name_b} vence
                  </Button>
                </div>
                {saving === row.id && (
                  <div className="flex justify-center mt-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* GAP-D107: Dialog de visualização de comprovantes */}
      <Dialog open={!!proofDialog} onOpenChange={() => setProofDialog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Comprovante — {proofDialog?.player === 'a' ? proofDialog?.row.name_a : proofDialog?.row.name_b}
            </DialogTitle>
          </DialogHeader>
          {proofDialog && (
            <div className="py-4">
              {proofDialog.player === 'a' && proofDialog.row.proof_a && (
                <img 
                  src={proofDialog.row.proof_a} 
                  alt="Comprovante A" 
                  className="max-w-full max-h-[60vh] object-contain rounded-lg border border-border"
                  loading="lazy"
                />
              )}
              {proofDialog.player === 'b' && proofDialog.row.proof_b && (
                <img 
                  src={proofDialog.row.proof_b} 
                  alt="Comprovante B" 
                  className="max-w-full max-h-[60vh] object-contain rounded-lg border border-border"
                  loading="lazy"
                />
              )}
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Clique fora para fechar
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* GAP-D108: Confirmação de decisão */}
      <Dialog open={!!decisionDialog} onOpenChange={() => setDecisionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gavel className="h-5 w-5 text-primary" /> Confirmar decisão
            </DialogTitle>
          </DialogHeader>
          {decisionDialog && (
            <div className="space-y-3 py-2">
              <p className="text-sm">
                Você está declarando <b>{decisionDialog.winner === 'a' ? decisionDialog.row.name_a : decisionDialog.row.name_b}</b> como vencedor.
              </p>
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="text-xs text-muted-foreground">Placar definido:</p>
                <p className="text-sm font-semibold">
                  {decisionDialog.row.name_a} {edit[decisionDialog.row.id]?.a ?? decisionDialog.row.score_a ?? '—'} × {edit[decisionDialog.row.id]?.b ?? decisionDialog.row.score_b ?? '—'} {decisionDialog.row.name_b}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Justificativa: <span className="font-medium">{reason[decisionDialog.row.id] || '—'}</span>
              </p>
              <p className="text-xs text-warning">⚠️ Esta ação será registrada nos logs administrativos.</p>
              <Button 
                className="w-full" 
                onClick={() => decide(decisionDialog.row, decisionDialog.winner)}
                disabled={saving === decisionDialog.row.id}
              >
                {saving === decisionDialog.row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar decisão'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}