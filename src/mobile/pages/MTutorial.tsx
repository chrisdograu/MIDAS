// Mobile tutorial passo-a-passo com mini-playground interativo e link "Ir para o real".
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, CheckCircle2, ExternalLink, Star, Heart, Send, Search, ShoppingBag, Trophy, MessageCircle, User, Gamepad2, Palette, Camera, Plus, Bell, ShieldCheck, FastForward, AlertTriangle } from 'lucide-react';
import { TUTORIALS, TutorialKey, useTutorial } from '@/components/tutorial/TutorialContext';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Step { title: string; text: string; tip?: string; play: React.ReactNode }

// ===== Mini playgrounds =====
function PFeed() {
  const [liked, setLiked] = useState<Record<number, boolean>>({});
  const posts = [
    { id: 1, who: 'Léo Gamer 🎮', what: 'platinou Elden Ring 💎' },
    { id: 2, who: 'Bia Vendedora 🛒', what: 'publicou um anúncio novo' },
    { id: 3, who: 'Duda Pro 🏆', what: 'venceu uma partida no torneio' },
  ];
  return (
    <div className="space-y-2">
      {posts.map(p => (
        <div key={p.id} className="p-3 rounded-xl bg-card border border-border">
          <p className="text-xs"><b>{p.who}</b> {p.what}</p>
          <button onClick={() => setLiked(s => ({ ...s, [p.id]: !s[p.id] }))} className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Heart className={`h-3.5 w-3.5 ${liked[p.id] ? 'fill-destructive text-destructive' : ''}`} />
            {liked[p.id] ? 'Curtido' : 'Curtir'}
          </button>
        </div>
      ))}
    </div>
  );
}
function PMarketplace() {
  const [fav, setFav] = useState(false);
  return (
    <div className="space-y-2">
      <div className="p-3 rounded-xl bg-card border border-border">
        <div className="flex items-center gap-2">
          <div className="w-12 h-12 rounded bg-secondary flex items-center justify-center"><ShoppingBag className="h-5 w-5 text-accent" /></div>
          <div className="flex-1">
            <p className="text-xs font-semibold">Elden Ring PS5 — Mídia Física</p>
            <p className="text-[10px] text-muted-foreground">R$ 200 • Protegido pela loja 🛡️</p>
          </div>
          <button onClick={() => { setFav(f => !f); toast.success(fav ? 'Removido' : 'Favoritado ⭐'); }}>
            <Star className={`h-5 w-5 ${fav ? 'fill-warning text-warning' : 'text-muted-foreground'}`} />
          </button>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground text-center">Toque na estrela para favoritar.</p>
    </div>
  );
}
function PForum() {
  const cats = [
    { slug: 'novidades', icon: '📰', label: 'Novidades' },
    { slug: 'off-topic', icon: '☕', label: 'Off-topic' },
    { slug: 'sugestoes', icon: '💡', label: 'Sugestões' },
    { slug: 'apresentacoes', icon: '👋', label: 'Apresentações' },
  ];
  const [pick, setPick] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-1.5">
        {cats.map(c => (
          <button key={c.slug} onClick={() => setPick(c.slug)}
            className={`p-2 rounded-lg border text-left ${pick === c.slug ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}>
            <p className="text-sm">{c.icon} {c.label}</p>
          </button>
        ))}
      </div>
      {pick && <p className="text-[11px] text-center text-primary">Você abriria a categoria "{pick}" agora 🎯</p>}
    </div>
  );
}
function PChat() {
  const [msgs, setMsgs] = useState<{ me: boolean; text: string }[]>([{ me: false, text: 'Oi! Tudo bem?' }]);
  const [v, setV] = useState('');
  return (
    <div className="space-y-2">
      <div className="bg-card border border-border rounded-xl p-2 space-y-1 max-h-40 overflow-y-auto">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.me ? 'justify-end' : ''}`}>
            <span className={`px-3 py-1.5 rounded-2xl text-xs ${m.me ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>{m.text}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-1">
        <input value={v} onChange={e => setV(e.target.value)} placeholder="Digite..." className="flex-1 px-3 py-2 bg-secondary rounded-lg text-xs border border-border" />
        <button onClick={() => { if (v.trim()) { setMsgs(m => [...m, { me: true, text: v }]); setV(''); } }}
          className="px-3 py-2 bg-primary text-primary-foreground rounded-lg"><Send className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );
}
function PAnunciar() {
  const [step, setStep] = useState(0);
  const labels = ['Tipo', 'Fotos', 'Preço', 'Publicar'];
  return (
    <div className="space-y-2">
      <div className="flex gap-1">{labels.map((l, i) => (
        <div key={l} className={`flex-1 h-1.5 rounded ${i <= step ? 'bg-primary' : 'bg-secondary'}`} />
      ))}</div>
      <p className="text-xs text-center">Etapa {step + 1}/4 — <b>{labels[step]}</b></p>
      <div className="bg-card border border-border rounded-lg p-3 text-[11px] text-muted-foreground text-center min-h-[60px] flex items-center justify-center">
        {step === 0 && 'Escolha entre venda, troca ou doação'}
        {step === 1 && 'Adicione até 6 fotos'}
        {step === 2 && 'R$ 0,00 — defina valor e formas de pagamento'}
        {step === 3 && '✅ Tudo certo — toque em publicar'}
      </div>
      <div className="flex gap-1">
        <button disabled={step === 0} onClick={() => setStep(s => s - 1)} className="flex-1 py-2 bg-secondary rounded-lg text-xs disabled:opacity-50"><ChevronLeft className="h-3 w-3 inline" /> Voltar</button>
        <button disabled={step === 3} onClick={() => setStep(s => s + 1)} className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-xs disabled:opacity-50">Próximo <ChevronRight className="h-3 w-3 inline" /></button>
      </div>
    </div>
  );
}
function PPerfil() {
  const [color, setColor] = useState('#14B8A6');
  const [bio, setBio] = useState('Gamer • RPGs • Pixel art');
  return (
    <div className="space-y-2">
      <div className="h-20 rounded-xl relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${color}, ${color}80)` }}>
        <div className="absolute bottom-2 left-3 flex items-end gap-2">
          <div className="w-12 h-12 rounded-full bg-card border-2 border-background flex items-center justify-center"><User className="h-5 w-5" /></div>
          <div className="pb-1"><p className="text-on-media font-bold text-xs">@você</p><p className="text-on-media-soft text-[10px]">{bio}</p></div>
        </div>
      </div>
      <div className="flex gap-1.5 items-center"><Palette className="h-3 w-3" /><span className="text-[10px] uppercase text-muted-foreground">Cor</span></div>
      <div className="flex gap-1">{['#14B8A6','#A855F7','#EF4444','#F97316','#22C55E','#3B82F6'].map(p => (
        <button key={p} onClick={() => setColor(p)} className={`w-6 h-6 rounded-full border-2 ${color===p?'border-foreground':'border-transparent'}`} style={{ background: p }} />
      ))}</div>
      <input value={bio} onChange={e => setBio(e.target.value)} className="w-full px-3 py-2 bg-secondary rounded-lg text-xs border border-border" />
    </div>
  );
}

// ===== Conteúdo por tutorial =====
const STEPS: Record<TutorialKey, { realRoute: string; steps: Step[] }> = {
  mobile_feed: {
    realRoute: '/m',
    steps: [
      { title: 'Veja o que rola', text: 'O feed mostra o que seus amigos andam fazendo: platinas, novos posts, jogos.', tip: 'Toque em curtir para reagir', play: <PFeed /> },
      { title: 'Reaja em segundos', text: 'Curtir gera engajamento e ajuda os algoritmos a priorizar amigos próximos.', play: <PFeed /> },
    ],
  },
  mobile_marketplace: {
    realRoute: '/m/marketplace',
    steps: [
      { title: 'Veja anúncios', text: 'Cada card mostra preço, tipo (físico/conta) e se é protegido pela loja.', tip: '🛡️ = certificado: reembolso garantido', play: <PMarketplace /> },
      { title: 'Favorite o que gosta', text: 'A estrela ⭐ salva nos favoritos. Você acompanha quedas de preço.', play: <PMarketplace /> },
    ],
  },
  mobile_forum: {
    realRoute: '/m/forum',
    steps: [
      { title: 'Escolha uma categoria', text: 'O fórum tem 4 áreas gerais + áreas específicas por jogo.', play: <PForum /> },
      { title: 'Discuta com a comunidade', text: 'Posts ganham likes e respostas. Você ganha XP por interação real.', play: <PForum /> },
    ],
  },
  mobile_chat: {
    realRoute: '/m/chat',
    steps: [
      { title: 'Envie mensagens', text: 'Conversas privadas com amigos ou interesse em anúncios.', play: <PChat /> },
      { title: 'Bloqueio e mute', text: 'Em "Info da conversa" você pode silenciar ou bloquear o usuário.', play: <PChat /> },
    ],
  },
  mobile_anunciar: {
    realRoute: '/m/marketplace/novo',
    steps: [
      { title: 'Tipo do anúncio', text: 'Escolha entre venda, troca ou doação. Tipo físico exige fotos reais.', play: <PAnunciar /> },
      { title: 'Fotos e preço', text: 'Boas fotos vendem mais rápido. Defina preço fixo ou aceite propostas.', play: <PAnunciar /> },
      { title: 'Publique', text: 'Após publicar, o anúncio fica visível no marketplace em tempo real.', play: <PAnunciar /> },
    ],
  },
  mobile_perfil: {
    realRoute: '/m/perfil',
    steps: [
      { title: 'Personalize sua cor', text: 'A cor de tema aparece no banner e detalhes do seu perfil.', play: <PPerfil /> },
      { title: 'Bio + foto', text: 'Mostre quem você é. Bio é o primeiro contato dos amigos.', tip: 'Use até 280 caracteres', play: <PPerfil /> },
      { title: 'Vendedor ($)', text: 'Se quiser vender, crie um perfil de vendedor separado em Config → Vendedor.', play: <PPerfil /> },
    ],
  },
  // Web-only fallbacks (não usados aqui)
  web_perfil: { realRoute: '/perfil', steps: [] },
  web_biblioteca: { realRoute: '/biblioteca', steps: [] },
  web_review_completa: { realRoute: '/perfil', steps: [] },
  web_torneios: { realRoute: '/torneios', steps: [] },
  web_busca_global: { realRoute: '/busca', steps: [] },
  web_conversas_opinioes: { realRoute: '/conversas-opinioes', steps: [] },
  web_destaques: { realRoute: '/perfil', steps: [] },
};

export default function MTutorial() {
  const { key } = useParams<{ key: TutorialKey }>();
  const navigate = useNavigate();
  const { markSeen } = useTutorial();
  const meta = TUTORIALS.find(t => t.key === key);
  const data = key ? STEPS[key as TutorialKey] : null;
  const [i, setI] = useState(0);
  
  // GAP-1131: Pular tutorial
  const [skipDialog, setSkipDialog] = useState(false);

  if (!meta || !data || data.steps.length === 0) {
    return (
      <div className="px-4 py-8 text-center space-y-3">
        <p className="text-sm text-muted-foreground">Tutorial não disponível na versão mobile.</p>
        <Link to="/m/tutoriais" className="text-primary text-sm">Voltar à lista</Link>
      </div>
    );
  }
  const step = data.steps[i];
  const last = i === data.steps.length - 1;

  const handleSkip = async () => {
    await markSeen(meta.key);
    toast.info('Tutorial pulado. Você pode refazê-lo a qualquer momento nos tutoriais.');
    navigate(data.realRoute);
  };

  return (
    <div className="px-4 py-5 space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <Link to="/m/tutoriais" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Tutoriais
        </Link>
        {/* GAP-1131: Botão Pular */}
        <button
          onClick={() => setSkipDialog(true)}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <FastForward className="h-3.5 w-3.5" /> Pular
        </button>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-accent">🎓 Tutorial mobile</p>
        <h1 className="font-display text-lg font-bold">{meta.title}</h1>
      </div>

      <div className="flex gap-1">
        {data.steps.map((_, idx) => (
          <div key={idx} className={`flex-1 h-1 rounded ${idx <= i ? 'bg-primary' : 'bg-secondary'}`} />
        ))}
      </div>

      <div className="glass rounded-2xl p-4 space-y-3">
        <p className="text-[10px] uppercase text-muted-foreground">Etapa {i + 1}/{data.steps.length}</p>
        <h2 className="font-bold text-sm">{step.title}</h2>
        <p className="text-xs text-muted-foreground">{step.text}</p>
        {step.tip && <p className="text-[11px] p-2 bg-accent/10 border border-accent/30 rounded-lg">💡 {step.tip}</p>}
        <div className="pt-2 border-t border-border">{step.play}</div>
      </div>

      <div className="flex gap-2">
        <button disabled={i === 0} onClick={() => setI(x => x - 1)} className="flex-1 py-2.5 rounded-xl bg-secondary text-sm font-semibold disabled:opacity-50">
          <ChevronLeft className="h-4 w-4 inline" /> Voltar
        </button>
        {!last ? (
          <button onClick={() => setI(x => x + 1)} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">
            Próximo <ChevronRight className="h-4 w-4 inline" />
          </button>
        ) : (
          <button onClick={async () => { await markSeen(meta.key); toast.success('Tutorial concluído! 🎉'); navigate(data.realRoute); }}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground text-sm font-semibold inline-flex items-center justify-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" /> Concluir
          </button>
        )}
      </div>

      <button onClick={() => navigate(data.realRoute)}
        className="w-full py-2.5 rounded-xl bg-card border border-primary/40 text-primary text-sm font-semibold inline-flex items-center justify-center gap-1.5">
        <ExternalLink className="h-3.5 w-3.5" /> Ir para o real agora
      </button>

      {/* GAP-1131: AlertDialog de confirmação para pular */}
      <AlertDialog open={skipDialog} onOpenChange={setSkipDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Pular tutorial?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Você pode refazer este tutorial a qualquer momento pela lista de tutoriais.
              Se pular agora, não será marcado como concluído.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSkipDialog(false)}>Continuar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSkip} className="bg-warning hover:bg-warning/90 text-warning-foreground">
              Sim, pular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}