// Rodada 23 · item 4 — espelho de privacidade dentro das telas de conteúdo.
// Não é um sistema novo: edita exatamente o mesmo campo de `profiles` que a
// Central de Privacidade edita (library/opinions/screenshots/timeline_visibility).
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Eye, Loader2, Lock, Users, Shield, Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export type ProfileVisibility = "friends" | "private" | "nobody";

export const PROFILE_VISIBILITY_LEVELS: { id: ProfileVisibility; label: string; hint: string; icon: any }[] = [
  { id: "friends", label: "Amigos", hint: "Apenas amigos mútuos veem.", icon: Users },
  { id: "nobody", label: "Ninguém", hint: "Bloqueio total: nem exceções, nem amigos próximos.", icon: Lock },
  { id: "private", label: "Ninguém, exceto exceções", hint: "Só amigos próximos e exceções autorizadas.", icon: Shield },
];

export function profileVisibilityLabel(v?: string | null) {
  return PROFILE_VISIBILITY_LEVELS.find(l => l.id === v)?.label ?? "Amigos";
}

// GAP-VQ02: Preview de como fica
function VisibilityPreview({ value }: { value: ProfileVisibility }) {
  const previews: Record<ProfileVisibility, { description: string; example: string }> = {
    friends: {
      description: 'Seus amigos mútuos podem ver este conteúdo',
      example: '👤 João vê · 👤 Maria vê · 👤 Pedro vê',
    },
    nobody: {
      description: 'Ninguém mais vê este conteúdo',
      example: '🔒 Apenas você pode ver',
    },
    private: {
      description: 'Apenas exceções autorizadas podem ver',
      example: '🔑 Você + 3 exceções autorizadas',
    },
  };
  const preview = previews[value];
  if (!preview) return null;
  return (
    <div className="mt-2 p-2 rounded-lg bg-secondary/40 border border-border text-[10px]">
      <p className="text-muted-foreground">{preview.description}</p>
      <p className="text-foreground/70 mt-0.5">{preview.example}</p>
    </div>
  );
}

interface Props {
  column: "library_visibility" | "opinions_visibility" | "screenshots_visibility" | "timeline_visibility";
  title: string;
  description?: string;
}

export default function VisibilityQuickToggle({ column, title, description }: Props) {
  const { user } = useAuth();
  const [value, setValue] = useState<ProfileVisibility>("friends");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  // GAP-VQ03: Sincronização em tempo real
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancel = false;
    
    const loadValue = async () => {
      const { data } = await supabase.from("profiles").select(column).eq("id", user.id).maybeSingle();
      if (cancel) return;
      const raw = (data as Record<string, string | null> | null)?.[column];
      setValue((raw === "private" || raw === "nobody" ? raw : "friends") as ProfileVisibility);
      setLoading(false);
    };
    
    loadValue();

    // GAP-VQ03: Realtime subscription
    const channel = supabase
      .channel(`visibility-${user.id}-${column}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          const newVal = (payload.new as any)?.[column];
          if (newVal !== undefined) {
            setValue((newVal === "private" || newVal === "nobody" ? newVal : "friends") as ProfileVisibility);
          }
        }
      )
      .subscribe();

    return () => { 
      cancel = true; 
      supabase.removeChannel(channel);
    };
  }, [user?.id, column]);

  const save = async (next: ProfileVisibility) => {
    if (!user || saving) return;
    const prev = value;
    setValue(next);
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ [column]: next } as never).eq("id", user.id);
    setSaving(false);
    if (error) {
      setValue(prev);
      toast.error("Não foi possível salvar a visibilidade");
    } else {
      toast.success("Visibilidade atualizada — vale também para o que já está publicado");
      setOpen(false);
    }
  };

  if (!user) return null;

  // GAP-VQ01: Skeleton
  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-6 w-6 rounded-full" />
      </div>
    );
  }

  const currentLevel = PROFILE_VISIBILITY_LEVELS.find(l => l.id === value);
  const Icon = currentLevel?.icon || Eye;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Quem vê ${title.toLowerCase()}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Icon className="h-3.5 w-3.5" />
          )}
          <span className="max-w-[9rem] truncate">{profileVisibilityLabel(value)}</span>
          {saving && <span className="text-[8px] text-muted-foreground">salvando...</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="z-50 w-80 bg-popover">
        <p className="text-xs font-semibold text-foreground">{title}</p>
        {description && <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>}
        
        <div className="mt-3 space-y-1.5">
          {PROFILE_VISIBILITY_LEVELS.map(l => {
            const LevelIcon = l.icon;
            const active = value === l.id;
            return (
              <button
                key={l.id}
                type="button"
                disabled={saving}
                onClick={() => save(l.id)}
                className={cn(
                  "w-full rounded-lg border px-2.5 py-2 text-left transition-colors",
                  active ? "border-primary bg-primary/10" : "border-border bg-secondary hover:border-primary/40"
                )}
              >
                <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                  <LevelIcon className={cn("h-3.5 w-3.5", active ? "text-primary" : "text-muted-foreground")} />
                  {l.label}
                  {active && <span className="ml-auto text-[10px] text-primary font-bold">✓</span>}
                </span>
                <span className="block text-[11px] text-muted-foreground">{l.hint}</span>
              </button>
            );
          })}
        </div>

        {/* GAP-VQ02: Preview */}
        <VisibilityPreview value={value} />

        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground border-t border-border pt-2">
          <Info className="h-3 w-3" />
          É o mesmo controle da Central de Privacidade — muda aqui, muda lá.
        </div>
      </PopoverContent>
    </Popover>
  );
}