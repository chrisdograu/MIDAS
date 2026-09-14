import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Plus, Trophy, Loader2, Calendar, Image, AlertCircle, Check, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSubmitGuard } from '@/hooks/useSubmitGuard';
import { toast } from 'sonner';
import { dbWrite } from '@/lib/dbWrite';
import SelectSimples from '@/components/SelectSimples';
import { cn } from '@/lib/utils';
import { Users } from 'lucide-react';

export default function CreateTournamentDialog({ onCreated }: { onCreated?: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('eliminação simples');
  const [maxParticipants, setMaxParticipants] = useState(8);
  const [startsAt, setStartsAt] = useState('');
  const [verified, setVerified] = useState(false);
  const [adaptadoPcd, setAdaptadoPcd] = useState(false);
  const [prize, setPrize] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [rules, setRules] = useState('');
  const { submitting, guard } = useSubmitGuard();
  const [isStaff, setIsStaff] = useState(false);
  // GAP-CT01: Preview
  const [showPreview, setShowPreview] = useState(false);
  // GAP-CT02: Validação de data
  const [dateError, setDateError] = useState('');

  useEffect(() => {
    if (!user) { setIsStaff(false); return; }
    (supabase as any).rpc('is_staff').then(({ data }: { data: boolean | null }) => setIsStaff(!!data));
  }, [user?.id]);

  // GAP-CT02: Validar data
  useEffect(() => {
    if (!startsAt) { setDateError(''); return; }
    const selected = new Date(startsAt);
    const now = new Date();
    if (selected < now) {
      setDateError('A data não pode ser no passado');
    } else {
      setDateError('');
    }
  }, [startsAt]);

  const comunitario = !isStaff;
  const opcoesParticipantes = comunitario ? [4, 8, 16] : [4, 8, 16, 32, 64];
  
  useEffect(() => {
    if (comunitario && maxParticipants > 16) setMaxParticipants(16);
  }, [comunitario, maxParticipants]);

  const xp = {
    signup: Math.max(20, Math.round(maxParticipants * 5)),
    win: Math.max(50, Math.round(maxParticipants * 15)),
    champion: Math.max(200, Math.round(maxParticipants * 80)),
  };

  // GAP-CT01: Preview do bracket
  const getBracketPreview = () => {
    const total = maxParticipants;
    const rounds = Math.ceil(Math.log2(total));
    const matchesPerRound = total / Math.pow(2, 1);
    return `${total} jogadores · ${rounds} rodadas · ${Math.round(matchesPerRound)} partidas por rodada`;
  };

  const submit = guard(async () => {
    if (!user) { toast.error('Entre para criar torneios'); return; }
    if (!title.trim()) { toast.error('Dê um título'); return; }
    if (bannerUrl && !/^https?:\/\//i.test(bannerUrl.trim())) {
      toast.error('O banner precisa ser uma URL http(s) válida');
      return;
    }
    if (comunitario && maxParticipants > 16) { toast.error('Torneio da comunidade aceita no máximo 16 jogadores'); return; }
    if (dateError) { toast.error('Corrija a data do torneio'); return; }
    
    const { data, error } = await supabase.from('tournaments').insert({
      title: title.trim(),
      description: description.trim() || null,
      type,
      max_participants: maxParticipants,
      status: 'open',
      starts_at: startsAt ? new Date(startsAt).toISOString() : null,
      verified,
      adaptado_pcd: adaptadoPcd,
      is_community: comunitario,
      unlisted: comunitario,
      prize: prize.trim().slice(0, 200) || null,
      banner_url: bannerUrl.trim() || null,
      custom_rules: rules.trim() || null,
      created_by: user.id,
      xp_signup: xp.signup,
      xp_match_win: xp.win,
      xp_champion: xp.champion,
    } as any).select('id').single();
    
    if (error) { toast.error(error.message); return; }
    
    await dbWrite(supabase.from('tournament_participants').insert({
      tournament_id: data.id, user_id: user.id,
    } as any), 'Torneio criado, mas não foi possível inscrever você automaticamente');
    
    toast.success(comunitario
      ? 'Torneio da comunidade criado! Compartilhe o link para convidar.'
      : 'Torneio criado! Você é o moderador.');
    setOpen(false);
    setTitle(''); setDescription(''); setPrize(''); setStartsAt(''); setBannerUrl(''); setRules('');
    onCreated?.();
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> Criar torneio
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-warning" /> Novo torneio
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Título */}
          <div>
            <Label>Título *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Copa de Verão FIFA" />
          </div>
          
          {/* Descrição */}
          <div>
            <Label>Descrição</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Regras, formato, premiação..." />
          </div>
          
          {/* GAP-CT04: Regras customizadas */}
          <div>
            <Label>Regras do torneio (opcional)</Label>
            <Textarea 
              value={rules} 
              onChange={e => setRules(e.target.value)} 
              rows={2} 
              placeholder="Ex: Melhor de 3, tempo limite de 10min por partida..." 
            />
          </div>
          
          {/* GAP-CT03: Banner */}
          <div>
            <Label>Banner (URL da imagem)</Label>
            <div className="flex gap-2">
              <Input 
                value={bannerUrl} 
                onChange={e => setBannerUrl(e.target.value)} 
                placeholder="https://exemplo.com/banner.jpg" 
              />
            </div>
            {bannerUrl && (
              <div className="mt-1">
                <img src={bannerUrl} alt="Preview do banner" className="h-16 w-full object-cover rounded-lg border border-border" />
              </div>
            )}
          </div>
          
          {/* Configurações */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Formato</Label>
              <SelectSimples
                value={type}
                onChange={setType}
                label="Formato do torneio"
                className="w-full"
                options={[
                  { value: 'eliminação simples', label: 'Eliminação simples' },
                  { value: 'eliminação dupla', label: 'Eliminação dupla' },
                  { value: 'grupos', label: 'Fase de grupos' },
                  { value: 'liga', label: 'Liga (pontos corridos)' },
                ]}
              />
            </div>
            <div>
              <Label>Participantes</Label>
              <SelectSimples
                value={String(maxParticipants)}
                onChange={v => setMaxParticipants(Number(v))}
                label="Número de participantes"
                className="w-full"
                options={opcoesParticipantes.map(n => ({ value: String(n), label: `${n} jogadores` }))}
              />
            </div>
          </div>
          
          {/* GAP-CT01: Preview do bracket */}
          <div className="bg-secondary/40 rounded-lg p-2 text-center text-[10px] text-muted-foreground">
            <span className="font-medium text-foreground">Preview:</span> {getBracketPreview()}
          </div>
          
          {/* Data */}
          <div>
            <Label>Início</Label>
            <div className="relative">
              <Input 
                type="datetime-local" 
                value={startsAt} 
                onChange={e => setStartsAt(e.target.value)} 
                className={cn(dateError && "border-destructive focus-visible:ring-destructive")}
              />
              <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
            {dateError && (
              <p className="text-[10px] text-destructive flex items-center gap-1 mt-1">
                <AlertCircle className="h-3 w-3" /> {dateError}
              </p>
            )}
          </div>
          
          {/* Prêmio */}
          <div>
            <Label>Prêmio (texto)</Label>
            <Input value={prize} onChange={e => setPrize(e.target.value)} placeholder="Steam Gift Card R$50" />
          </div>
          
          {comunitario && (
            <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground flex items-center gap-1">
                <Users className="h-3.5 w-3.5 text-primary" /> Torneio da comunidade
              </p>
              <p className="mt-1">
                Até 16 jogadores e acesso por link — ele não aparece na lista pública de torneios oficiais.
                Você é o moderador e responde pelas decisões de partida.
              </p>
            </div>
          )}
          
          {/* Switches */}
          <div className="flex items-center justify-between bg-secondary/40 rounded-lg p-3">
            <div>
              <Label className="text-sm">Torneio verificado</Label>
              <p className="text-xs text-muted-foreground">Exige telefone cadastrado para inscrição</p>
            </div>
            <Switch checked={verified} onCheckedChange={setVerified} />
          </div>
          
          <div className="flex items-center justify-between bg-secondary/40 rounded-lg p-3">
            <div>
              <Label className="text-sm">♿ Torneio adaptado / PcD</Label>
              <p className="text-xs text-muted-foreground">Sinaliza que o torneio é inclusivo para pessoas com deficiência</p>
            </div>
            <Switch checked={adaptadoPcd} onCheckedChange={setAdaptadoPcd} />
          </div>
          
          {/* XP Preview */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-primary/10 border border-primary/30 rounded p-2">
              <div className="text-[10px] text-muted-foreground uppercase">Inscrição</div>
              <div className="text-sm font-bold text-primary">+{xp.signup} XP</div>
            </div>
            <div className="bg-accent/10 border border-accent/30 rounded p-2">
              <div className="text-[10px] text-muted-foreground uppercase">Vitória</div>
              <div className="text-sm font-bold text-accent">+{xp.win} XP</div>
            </div>
            <div className="bg-warning/10 border border-warning/30 rounded p-2">
              <div className="text-[10px] text-muted-foreground uppercase">Campeão</div>
              <div className="text-sm font-bold text-warning">+{xp.champion} XP</div>
            </div>
          </div>
          
          <Button 
            onClick={submit} 
            disabled={submitting || !!dateError} 
            className="w-full"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trophy className="h-4 w-4 mr-2" />}
            Criar e me inscrever
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}