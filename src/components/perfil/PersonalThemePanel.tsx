// Rodada 18 — "ambiente pessoal": cor de destaque escolhida pelo usuário,
// aplicada como token do design system e com verificação de contraste.
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Palette, Loader2, RotateCcw, Eye, Share2, Check, History } from 'lucide-react';
import { toast } from 'sonner';
import { applyPersonalTheme, contrastRatio, hexToHsl, type PersonalTheme } from '@/lib/personalTheme';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const PRESETS: { label: string; accent: string; bg?: string; text?: string }[] = [
  { label: 'Padrão MIDIAS', accent: '#14B8A6' },
  { label: 'Roxo neon', accent: '#A855F7' },
  { label: 'Âmbar retrô', accent: '#F59E0B' },
  { label: 'Azul cyber', accent: '#3B82F6' },
  { label: 'Rosa arcade', accent: '#EC4899' },
  { label: 'Verde terminal', accent: '#22C55E' },
  { label: 'Vermelho intenso', accent: '#EF4444' },
  { label: 'Laranja sunset', accent: '#F97316' },
];

// GAP-PT02: Cores complementares
const getComplementaryPalette = (hex: string): { accent: string; bg: string; text: string }[] => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const hsl = hexToHsl(hex);
  return [
    { accent: hex, bg: `${hex}22`, text: hex },
    { accent: `hsl(${Math.round((r+g+b)/3 * 0.3)}, 70%, 50%)`, bg: `${hex}44`, text: '#FFFFFF' },
    { accent: `hsl(${Math.round((r+g+b)/3 * 0.6)}, 80%, 40%)`, bg: `${hex}66`, text: '#FFFFFF' },
  ];
};

// GAP-PT03: Histórico de temas
const THEME_HISTORY_KEY = 'midias-theme-history';

export default function PersonalThemePanel() {
  const { user } = useAuth();
  const [theme, setTheme] = useState<PersonalTheme>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // GAP-PT01: Preview
  const [previewMode, setPreviewMode] = useState(false);
  // GAP-PT03: Histórico
  const [themeHistory, setThemeHistory] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(THEME_HISTORY_KEY) || '[]');
    } catch { return []; }
  });
  // GAP-PT04: Compartilhamento
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase.from('profiles').select('personal_theme').eq('id', user.id).maybeSingle();
      const t = ((data as any)?.personal_theme || {}) as PersonalTheme;
      setTheme(t);
      applyPersonalTheme(t);
      setLoading(false);
    })();
  }, [user?.id]);

  const save = async (next: PersonalTheme) => {
    if (!user) return;
    setTheme(next);
    applyPersonalTheme(next);
    // GAP-PT03: Salvar no histórico
    if (next.accent) {
      const history = [next.accent, ...themeHistory.filter(h => h !== next.accent)].slice(0, 5);
      setThemeHistory(history);
      localStorage.setItem(THEME_HISTORY_KEY, JSON.stringify(history));
    }
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ personal_theme: next } as any).eq('id', user.id);
    setSaving(false);
    if (error) toast.error('Não foi possível salvar o tema');
    else toast.success('Ambiente atualizado');
  };

  // GAP-PT04: Compartilhar tema
  const shareTheme = async () => {
    if (!theme.accent) return;
    const url = `${window.location.origin}?theme=${encodeURIComponent(theme.accent)}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      toast.success('Link do tema copiado!');
      setTimeout(() => setShareCopied(false), 3000);
    } catch {
      toast.error('Não foi possível copiar');
    }
  };

  if (!user) return null;

  const accent = theme.accent || '#14B8A6';
  const onDark = contrastRatio(accent, '#0B0F14');
  const onLight = contrastRatio(accent, '#FFFFFF');
  const legivel = Math.max(onDark, onLight) >= 4.5;
  const palette = getComplementaryPalette(accent);

  return (
    <section className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Ambiente pessoal</h3>
          {(loading || saving) && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>
        <div className="flex items-center gap-1">
          {/* GAP-PT04: Compartilhar */}
          {theme.accent && (
            <Button variant="ghost" size="sm" onClick={shareTheme} className="h-7 px-2 text-xs">
              {shareCopied ? <Check className="h-3 w-3" /> : <Share2 className="h-3 w-3" />}
            </Button>
          )}
          {/* GAP-PT01: Preview */}
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition"
          >
            <Eye className="h-3 w-3" />
          </button>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground mb-3">
        Escolha a cor de destaque da sua conta. Só muda pra você — quem visita seu perfil continua vendo o tema do site.
      </p>

      {/* GAP-PT01: Preview ao vivo */}
      {previewMode && (
        <div className="mb-3 p-3 rounded-lg border border-primary/20 bg-primary/5">
          <p className="text-xs font-medium">Preview do tema</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-8 h-8 rounded-full" style={{ background: accent }} />
            <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
              <div className="h-full rounded-full" style={{ width: '60%', background: accent }} />
            </div>
            <span className="text-[10px] font-mono">{accent}</span>
          </div>
          <div className="flex gap-2 mt-2">
            <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: accent, color: '#fff' }}>Botão</span>
            <span className="text-[10px] px-2 py-0.5 rounded border" style={{ borderColor: accent, color: accent }}>Contorno</span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {PRESETS.map(p => (
          <button
            key={p.accent}
            type="button"
            onClick={() => save({ ...theme, accent: p.accent })}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-full border text-[11px] font-medium transition-colors ${
              accent.toLowerCase() === p.accent.toLowerCase() ? 'border-primary text-foreground' : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className="h-3 w-3 rounded-full" style={{ background: p.accent }} aria-hidden />
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 mt-3">
        <label className="text-[11px] text-muted-foreground flex items-center gap-2">
          Cor personalizada
          <input
            type="color"
            value={accent}
            onChange={e => setTheme(t => ({ ...t, accent: e.target.value }))}
            onBlur={e => save({ ...theme, accent: e.target.value })}
            className="h-7 w-10 rounded border border-border bg-transparent"
            aria-label="Cor de destaque personalizada"
          />
        </label>
        <button
          type="button"
          onClick={() => save({})}
          className="ml-auto text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <RotateCcw className="h-3 w-3" /> Voltar ao padrão
        </button>
      </div>

      {/* GAP-PT03: Histórico de temas */}
      {themeHistory.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-[10px] text-muted-foreground mb-1.5 flex items-center gap-1">
            <History className="h-3 w-3" /> Últimos temas usados
          </p>
          <div className="flex gap-1.5">
            {themeHistory.map(h => (
              <button
                key={h}
                onClick={() => save({ ...theme, accent: h })}
                className="w-6 h-6 rounded-full border border-border transition hover:scale-110"
                style={{ background: h }}
                title={h}
              />
            ))}
          </div>
        </div>
      )}

      {/* GAP-PT02: Cores complementares */}
      <div className="mt-3 pt-3 border-t border-border">
        <p className="text-[10px] text-muted-foreground mb-1.5">Paleta complementar</p>
        <div className="flex gap-2">
          {palette.slice(0, 3).map((c, i) => (
            <button
              key={i}
              onClick={() => save({ ...theme, accent: c.accent })}
              className="w-8 h-8 rounded-full border border-border transition hover:scale-110 flex items-center justify-center text-[8px]"
              style={{ background: c.accent, color: c.text }}
            >
              {i === 0 ? '✦' : ''}
            </button>
          ))}
        </div>
      </div>

      {!legivel && (
        <p className="mt-3 text-[11px] text-destructive">
          Essa cor tem contraste baixo ({Math.max(onDark, onLight).toFixed(1)}:1) e pode dificultar a leitura de botões.
          Recomendamos pelo menos 4.5:1.
        </p>
      )}
      <p className="mt-2 text-[10px] text-muted-foreground">
        HSL aplicado: {hexToHsl(accent)}
      </p>
    </section>
  );
}