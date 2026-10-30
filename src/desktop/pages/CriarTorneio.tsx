import { useState, useEffect, useMemo } from 'react';
import { Sparkles, Loader2, Eye, Users, Trophy, Calendar, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { GameProductSelect } from '../components/GameProductSelect';
import { adminLog } from '../lib/adminLog';
import { tournamentCreateFields } from '@/lib/tournamentFields';

// GAP-D82: Simulação de bracket
function BracketPreview({ participants }: { participants: number }) {
  const rounds = Math.log2(participants);
  const roundNames = ['Final', 'Semi-final', 'Quartas', 'Oitavas', '16 avos', '32 avos'];
  
  if (participants < 2 || (participants & (participants - 1)) !== 0) {
    return (
      <div className="text-center text-xs text-muted-foreground p-4 border border-warning/30 rounded-lg bg-warning/5">
        <AlertCircle className="h-4 w-4 inline mr-1 text-warning" />
        Número de participantes deve ser potência de 2 (2, 4, 8, 16, 32, 64) para visualizar o bracket.
      </div>
    );
  }

  const displayRounds = Math.min(rounds, 6);
  const startRound = rounds - displayRounds;

  return (
    <div className="p-4 border border-border rounded-lg bg-card/50">
      <p className="text-xs text-muted-foreground mb-3 text-center">
        🏆 Prévia do bracket — {participants} participantes, {rounds} rodadas
      </p>
      <div className="flex justify-center gap-6 overflow-x-auto pb-2">
        {Array.from({ length: displayRounds }).map((_, idx) => {
          const roundIdx = startRound + idx;
          const matches = Math.pow(2, rounds - roundIdx - 1);
          const isFinal = roundIdx === rounds - 1;
          return (
            <div key={roundIdx} className="flex flex-col items-center min-w-[60px]">
              <div className={`text-[8px] uppercase text-muted-foreground mb-1 ${isFinal ? 'font-bold text-warning' : ''}`}>
                {roundNames[roundIdx] || `R${roundIdx + 1}`}
              </div>
              <div className="flex flex-col gap-0.5">
                {Array.from({ length: Math.min(matches, 4) }).map((_, m) => (
                  <div key={m} className={`w-10 h-3 rounded-sm ${isFinal ? 'bg-warning/30 border border-warning' : 'bg-muted'} ${m === 0 && isFinal ? 'animate-pulse' : ''}`} />
                ))}
                {matches > 4 && (
                  <div className="text-[8px] text-muted-foreground text-center">+{matches - 4}</div>
                )}
              </div>
              <div className="text-[8px] text-muted-foreground mt-0.5">{matches} jogos</div>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground text-center mt-2">
        {rounds} rodadas · {participants - 1} partidas no total
      </p>
    </div>
  );
}

// GAP-D83: Validações
const validateTournament = (form: any, productId: string | null) => {
  const errors: string[] = [];
  
  if (!form.title.trim()) errors.push('Título é obrigatório');
  if (!productId) errors.push('Selecione um jogo para o torneio');
  
  const max = Number(form.max_participants) || 0;
  if (max < 2) errors.push('O torneio precisa de pelo menos 2 participantes');
  if (max > 128) errors.push('Máximo de 128 participantes por torneio');
  
  if (form.type === 'single_elimination' && !(max >= 2 && (max & (max - 1)) === 0)) {
    errors.push('Chaveamento de eliminação simples exige potência de 2 (2, 4, 8, 16, 32, 64, 128)');
  }
  
  if (form.starts_at && form.ends_at) {
    const s = new Date(form.starts_at).getTime();
    const e = new Date(form.ends_at).getTime();
    if (isFinite(s) && isFinite(e) && e <= s) {
      errors.push('A data de fim precisa ser depois da data de início');
    }
    if (isFinite(s) && s < Date.now()) {
      errors.push('A data de início não pode ser no passado');
    }
  }
  
  return errors;
};

export default function CriarTorneio() {
  const [form, setForm] = useState({
    title: '', description: '', max_participants: 8, prize: '',
    starts_at: '', ends_at: '', type: 'single_elimination',
    is_paid: false, entry_fee: 0,
  });
  const [productId, setProductId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  const navigate = useNavigate();

  // GAP-D82: Prévia do bracket
  const canPreview = useMemo(() => {
    const max = Number(form.max_participants) || 0;
    return max >= 2 && (max & (max - 1)) === 0;
  }, [form.max_participants]);

  // GAP-D83: Validar em tempo real
  useEffect(() => {
    const errors = validateTournament(form, productId);
    setValidationErrors(errors);
  }, [form, productId]);

  const isPowerOf2 = (n: number) => n >= 2 && (n & (n - 1)) === 0;

  const save = async () => {
    const errors = validateTournament(form, productId);
    if (errors.length > 0) {
      setShowErrors(true);
      return toast.error('Corrija os erros antes de salvar');
    }
    
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !productId) {
      setSaving(false);
      toast.error('Entre novamente e selecione um jogo');
      return;
    }
    const max = Number(form.max_participants);
    const payload = tournamentCreateFields(form, productId, user.id);
    
    const { data: created, error } = await supabase
      .from('tournaments')
      .insert(payload as any)
      .select('id')
      .single();
    
    setSaving(false);
    if (error) return toast.error(error.message);
    
    // GAP-D83: Log
    await adminLog({
      action: 'criar_torneio',
      entity: 'tournaments',
      entity_id: created?.id,
      payload: { 
        titulo: form.title, 
        participantes: max, 
        tipo: form.type,
        formato: payload.default_format,
      },
    });
    
    toast.success('Torneio criado com sucesso!');
    navigate('/desktop/torneios');
  };

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <AdminPageHeader 
        icon={Sparkles} 
        title="Criar Torneio" 
        subtitle="Configure um novo torneio oficial"
        actions={
          <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)} disabled={!canPreview}>
            <Eye className="h-4 w-4 mr-1" /> Prévia do Bracket
          </Button>
        }
      />
      
      {/* GAP-D83: Erros de validação */}
      {showErrors && validationErrors.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4">
            <p className="text-sm font-semibold text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> Corrija os seguintes erros:
            </p>
            <ul className="text-xs text-destructive/90 mt-1 space-y-0.5 list-disc list-inside">
              {validationErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/50">
        <CardContent className="p-6 space-y-4">
          <div>
            <Label>Título <span className="text-destructive">*</span></Label>
            <Input 
              value={form.title} 
              onChange={e => setForm({ ...form, title: e.target.value })} 
              placeholder="Ex: Copa MIDIAS de Verão" 
            />
          </div>
          
          <div>
            <Label>Descrição</Label>
            <Textarea 
              rows={4} 
              value={form.description} 
              onChange={e => setForm({ ...form, description: e.target.value })} 
              placeholder="Descreva as regras, formato e detalhes do torneio..." 
            />
          </div>
          
          <GameProductSelect value={productId} onChange={setProductId} />
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Máx. participantes <span className="text-destructive">*</span></Label>
              <Input 
                type="number" 
                min={2} 
                max={128}
                value={form.max_participants} 
                onChange={e => setForm({ ...form, max_participants: Number(e.target.value) })} 
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                {form.type === 'single_elimination' && 'Deve ser potência de 2 (2, 4, 8, 16, 32, 64, 128)'}
              </p>
            </div>
            <div>
              <Label>Prêmio</Label>
              <Input 
                value={form.prize} 
                onChange={e => setForm({ ...form, prize: e.target.value })} 
                placeholder="Ex: R$ 100 em créditos" 
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data de início</Label>
              <Input 
                type="datetime-local" 
                value={form.starts_at} 
                onChange={e => setForm({ ...form, starts_at: e.target.value })} 
              />
            </div>
            <div>
              <Label>Data de fim</Label>
              <Input 
                type="datetime-local" 
                value={form.ends_at} 
                onChange={e => setForm({ ...form, ends_at: e.target.value })} 
              />
            </div>
          </div>

          <div>
            <Label>Formato do torneio</Label>
            <div className="flex gap-2">
              <Button 
                type="button"
                variant={form.type === 'single_elimination' ? 'default' : 'outline'} 
                className="flex-1"
                onClick={() => setForm({ ...form, type: 'single_elimination' })}
              >
                🏆 Eliminação Simples
              </Button>
              <Button 
                type="button"
                variant={form.type === 'double_elimination' ? 'default' : 'outline'} 
                className="flex-1"
                onClick={() => setForm({ ...form, type: 'double_elimination' })}
              >
                🔄 Dupla Eliminação
              </Button>
              <Button 
                type="button"
                variant={form.type === 'group_stage' ? 'default' : 'outline'} 
                className="flex-1"
                onClick={() => setForm({ ...form, type: 'group_stage' })}
              >
                📊 Fase de Grupos
              </Button>
            </div>
          </div>

          {/* GAP-D83: Torneio pago */}
          <div className="border border-border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="cursor-pointer">Torneio pago</Label>
                <p className="text-xs text-muted-foreground">Usuários pagam para participar</p>
              </div>
              <Switch 
                checked={form.is_paid} 
                onCheckedChange={v => setForm({ ...form, is_paid: v })} 
              />
            </div>
            {form.is_paid && (
              <div>
                <Label>Taxa de inscrição (R$)</Label>
                <Input 
                  type="number" 
                  min={0} 
                  step={0.01}
                  value={form.entry_fee} 
                  onChange={e => setForm({ ...form, entry_fee: Number(e.target.value) })} 
                  placeholder="Ex: 10.00" 
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  O valor arrecadado será usado para premiação e custos operacionais.
                </p>
              </div>
            )}
          </div>

          {/* GAP-D82: Resumo rápido */}
          <div className="grid grid-cols-3 gap-3 p-3 bg-muted/30 rounded-lg">
            <div className="text-center">
              <Users className="h-4 w-4 mx-auto text-muted-foreground" />
              <p className="text-sm font-semibold">{form.max_participants || 0}</p>
              <p className="text-[10px] text-muted-foreground">Participantes</p>
            </div>
            <div className="text-center">
              <Trophy className="h-4 w-4 mx-auto text-muted-foreground" />
              <p className="text-sm font-semibold">{form.prize || '—'}</p>
              <p className="text-[10px] text-muted-foreground">Prêmio</p>
            </div>
            <div className="text-center">
              <Calendar className="h-4 w-4 mx-auto text-muted-foreground" />
              <p className="text-sm font-semibold">
                {form.starts_at ? new Date(form.starts_at).toLocaleDateString('pt-BR') : '—'}
              </p>
              <p className="text-[10px] text-muted-foreground">Início</p>
            </div>
          </div>

          {canPreview && (
            <div className="border border-border rounded-lg p-3 bg-primary/5">
              <p className="text-xs text-success flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Bracket válido — {form.max_participants} participantes, {Math.log2(Number(form.max_participants))} rodadas
              </p>
            </div>
          )}

          <Button onClick={save} disabled={saving || validationErrors.length > 0} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Criar torneio
          </Button>
        </CardContent>
      </Card>

      {/* GAP-D82: Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" /> Prévia do Bracket
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Visualização do bracket para <b>{form.max_participants}</b> participantes em formato <b>{form.type === 'single_elimination' ? 'Eliminação Simples' : form.type === 'double_elimination' ? 'Dupla Eliminação' : 'Fase de Grupos'}</b>
            </p>
            <BracketPreview participants={Number(form.max_participants) || 0} />
            
            <div className="mt-4 p-3 bg-muted/30 rounded-lg">
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold">Info:</span> Este é um preview visual. O bracket real será gerado automaticamente quando as inscrições forem encerradas.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="font-semibold">XP base:</span> {(() => {
                  const max = Number(form.max_participants) || 0;
                  if (max >= 64) return '90 XP';
                  if (max >= 32) return '70 XP';
                  if (max >= 16) return '55 XP';
                  if (max >= 9) return '40 XP';
                  return '30 XP';
                })()} por participação
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}