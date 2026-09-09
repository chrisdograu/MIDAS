// Bloco A — visibilidade por publicação (opiniões, prints, linha do tempo).
// null  => usa o padrão do perfil (configuração global de privacidade)
// 'friends' | 'favorites' | 'private' | 'user:<uuid>' | 'nobody'
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Eye, Users, Star, Lock, User, Globe, Info } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export const VISIBILITY_DEFAULT = "__default__";

// GAP-PV01: Cores e ícones por opção
const VISIBILITY_OPTIONS: Record<string, { icon: any; color: string; label: string; description: string }> = {
  [VISIBILITY_DEFAULT]: { icon: Globe, color: 'text-muted-foreground', label: 'Padrão do perfil', description: 'Usa a configuração global de privacidade do seu perfil' },
  'friends': { icon: Users, color: 'text-primary', label: 'Amigos', description: 'Todos os seus amigos mútuos podem ver' },
  'favorites': { icon: Star, color: 'text-warning', label: 'Favoritos', description: 'Apenas amigos marcados como favoritos' },
  'private': { icon: Lock, color: 'text-accent', label: 'Exceções', description: 'Apenas você e exceções autorizadas' },
  'nobody': { icon: User, color: 'text-destructive', label: 'Ninguém', description: 'Ninguém mais vê — só você' },
};

// GAP-PV03: Verificar se o usuário tem amigos favoritos
function useHasFavoriteFriends(userId?: string) {
  return useQuery({
    queryKey: ['has-favorite-friends', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { count } = await supabase
        .from('friend_favorites')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId!);
      return (count || 0) > 0;
    },
  });
}

interface Props {
  value: string | null;
  onChange: (v: string | null) => void;
  className?: string;
  /** GAP-PV04: Mostrar contagem de quem pode ver */
  showCount?: boolean;
}

export default function PostVisibilitySelect({ value, onChange, className, showCount = false }: Props) {
  const { user } = useAuth();

  const { data: friends = [] } = useQuery({
    queryKey: ["post-visibility-friends", user?.id],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.rpc("get_mutual_friends", { _user_id: user!.id });
      return ((data as any[]) || []).map((r) => ({
        id: r.friend_id as string,
        name: (r.friend_name as string | null) || "Amigo",
      }));
    },
  });

  const { data: hasFavorites = false } = useHasFavoriteFriends(user?.id);

  const currentValue = value ?? VISIBILITY_DEFAULT;
  const currentOption = VISIBILITY_OPTIONS[currentValue] || VISIBILITY_OPTIONS[VISIBILITY_DEFAULT];
  const Icon = currentOption.icon;

  // GAP-PV04: Contagem de pessoas que podem ver
  const getViewerCount = (val: string): number => {
    if (!user) return 0;
    if (val === VISIBILITY_DEFAULT) return 0; // depende da configuração do perfil
    if (val === 'friends') return friends.length;
    if (val === 'favorites') return friends.filter(f => f.is_favorite).length;
    if (val === 'private') return 0;
    if (val === 'nobody') return 0;
    if (val.startsWith('user:')) return 1;
    return 0;
  };

  const viewerCount = showCount ? getViewerCount(currentValue) : 0;

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 cursor-help">
              <Icon className={cn("h-4 w-4 shrink-0", currentOption.color)} aria-hidden />
              <Select
                value={currentValue}
                onValueChange={(v) => onChange(v === VISIBILITY_DEFAULT ? null : v)}
              >
                <SelectTrigger className="h-8 text-xs w-[180px]" aria-label="Quem pode ver esta publicação">
                  <SelectValue placeholder="Quem pode ver" />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {/* GAP-PV03: Opção padrão */}
                  <SelectItem value={VISIBILITY_DEFAULT} className="text-muted-foreground">
                    <span className="flex items-center gap-2">
                      <Globe className="h-3.5 w-3.5" />
                      Padrão do meu perfil
                    </span>
                  </SelectItem>
                  
                  <SelectItem value="friends" className="text-primary">
                    <span className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5" />
                      Todos os meus amigos
                      {showCount && friends.length > 0 && (
                        <span className="text-[10px] text-muted-foreground ml-auto">({friends.length})</span>
                      )}
                    </span>
                  </SelectItem>
                  
                  {/* GAP-PV02: Desabilitar favoritos se não houver */}
                  <SelectItem 
                    value="favorites" 
                    className="text-warning"
                    disabled={!hasFavorites}
                  >
                    <span className="flex items-center gap-2">
                      <Star className="h-3.5 w-3.5" />
                      Somente amigos favoritos
                      {!hasFavorites && (
                        <span className="text-[10px] text-muted-foreground ml-auto">(nenhum)</span>
                      )}
                    </span>
                  </SelectItem>
                  
                  <SelectItem value="private" className="text-accent">
                    <span className="flex items-center gap-2">
                      <Lock className="h-3.5 w-3.5" />
                      Ninguém, exceto exceções
                    </span>
                  </SelectItem>
                  
                  <SelectItem value="nobody" className="text-destructive">
                    <span className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5" />
                      Ninguém (só você)
                    </span>
                  </SelectItem>
                  
                  {/* Amigos específicos */}
                  {friends.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-[10px] text-muted-foreground border-t border-border mt-1 pt-1">
                        Amigos específicos
                      </div>
                      {friends.slice(0, 10).map((f) => (
                        <SelectItem key={f.id} value={`user:${f.id}`} className="text-foreground">
                          <span className="flex items-center gap-2">
                            <User className="h-3.5 w-3.5" />
                            Somente {f.name}
                          </span>
                        </SelectItem>
                      ))}
                      {friends.length > 10 && (
                        <div className="px-2 py-1 text-[10px] text-muted-foreground">
                          +{friends.length - 10} outros amigos
                        </div>
                      )}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p className="text-xs font-medium">{currentOption.label}</p>
            <p className="text-[10px] text-muted-foreground">{currentOption.description}</p>
            {/* GAP-PV04: Contagem */}
            {showCount && viewerCount > 0 && (
              <p className="text-[10px] text-primary mt-1">
                {viewerCount} pessoa{viewerCount !== 1 ? 's' : ''} pode{viewerCount === 1 ? '' : 'm'} ver
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

// ─── HELPERS ──────────────────────────────────────────────────────────────

export function visibilityLabel(v?: string | null, friendName?: string | null) {
  if (!v || v === VISIBILITY_DEFAULT) return "Padrão do perfil";
  if (v === "friends") return "Amigos";
  if (v === "favorites") return "Favoritos";
  if (v === "private") return "Ninguém, exceto exceções";
  if (v === "nobody") return "Ninguém (só você)";
  if (v.startsWith("user:")) return friendName ? `Só ${friendName}` : "Pessoa específica";
  return v;
}

export function getVisibilityIcon(v?: string | null) {
  if (!v || v === VISIBILITY_DEFAULT) return Globe;
  if (v === "friends") return Users;
  if (v === "favorites") return Star;
  if (v === "private") return Lock;
  if (v === "nobody") return User;
  if (v.startsWith("user:")) return User;
  return Eye;
}

export function getVisibilityColor(v?: string | null) {
  if (!v || v === VISIBILITY_DEFAULT) return "text-muted-foreground";
  if (v === "friends") return "text-primary";
  if (v === "favorites") return "text-warning";
  if (v === "private") return "text-accent";
  if (v === "nobody") return "text-destructive";
  if (v.startsWith("user:")) return "text-foreground";
  return "text-muted-foreground";
}