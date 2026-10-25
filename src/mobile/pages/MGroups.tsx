import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Plus, Users, Crown, Archive, ArchiveRestore } from "lucide-react";
import EstadoVazio from "@/components/EstadoVazio";
import BuscaInput from "@/components/BuscaInput";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { timeAgo } from "@/mobile/lib/time";
import { toast } from "sonner";
import { dbWrite } from "@/lib/dbWrite";

interface Group {
  id: string;
  name: string;
  image_url: string | null;
  description: string | null;
  member_count: number;
  my_role: string;
  last_message: string | null;
  last_message_at: string | null;
  is_archived?: boolean;
}

// GAP-1070: Arquivar/restaurar grupo
async function toggleArchiveGroup(groupId: string, userId: string, archive: boolean): Promise<boolean> {
  const ok = await dbWrite(
    supabase
      .from("group_members")
      .update({ archived_at: archive ? new Date().toISOString() : null })
      .eq("group_id", groupId)
      .eq("user_id", userId),
  );
  if (!ok) {
    toast.error(`Erro ao ${archive ? "arquivar" : "restaurar"} grupo`);
    return false;
  }
  toast.success(archive ? "Grupo arquivado" : "Grupo restaurado");
  return true;
}

export default function MGroups() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data: mems } = await supabase
        .from("group_members")
        .select("group_id, role, archived_at")
        .eq("user_id", user.id);
      const ids = (mems || []).map((m: any) => m.group_id);
      if (!ids.length) {
        setGroups([]);
        setLoading(false);
        return;
      }
      const [{ data: gs }, { data: counts }, { data: last }] = await Promise.all([
        supabase.from("groups").select("id, name, image_url, description, is_disabled").in("id", ids),
        supabase.from("group_members").select("group_id").in("group_id", ids),
        supabase
          .from("mensagens")
          .select("group_id, content, created_at")
          .in("group_id", ids)
          .order("created_at", { ascending: false })
          .limit(200),
      ]);
      const countMap = new Map<string, number>();
      (counts || []).forEach((c: any) => countMap.set(c.group_id, (countMap.get(c.group_id) || 0) + 1));
      const lastMap = new Map<string, any>();
      (last || []).forEach((m: any) => {
        if (!lastMap.has(m.group_id)) lastMap.set(m.group_id, m);
      });
      const roleMap = new Map<string, string>((mems || []).map((m: any) => [m.group_id, m.role]));
      const archivedMap = new Map<string, boolean>((mems || []).map((m: any) => [m.group_id, !!m.archived_at]));
      const merged = (gs || [])
        .map((g: any) => ({
          ...g,
          member_count: countMap.get(g.id) || 0,
          my_role: roleMap.get(g.id) || "member",
          last_message: lastMap.get(g.id)?.content || null,
          last_message_at: lastMap.get(g.id)?.created_at || null,
          is_archived: archivedMap.get(g.id) || false,
        }))
        .sort((a, b) => +new Date(b.last_message_at || 0) - +new Date(a.last_message_at || 0));
      setGroups(merged);
      setLoading(false);
    })();
  }, [user?.id]);

  if (!user) return <Navigate to="/m/auth" replace />;

  const termo = busca.trim().toLowerCase();
  let visiveis = termo
    ? groups.filter((g) => g.name.toLowerCase().includes(termo) || (g.description || "").toLowerCase().includes(termo))
    : groups;

  // GAP-1070: Filtrar arquivados
  if (!showArchived) {
    visiveis = visiveis.filter((g) => !g.is_archived);
  }

  // GAP-1070: Arquivar/restaurar
  const handleArchive = async (groupId: string, currentStatus: boolean) => {
    await toggleArchiveGroup(groupId, user.id, !currentStatus);
    setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, is_archived: !currentStatus } : g)));
  };

  return (
    <div className="px-4 py-5 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold gradient-text">Grupos</h1>
        <div className="flex items-center gap-2">
          {/* GAP-1070: Toggle mostrar arquivados */}
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              showArchived ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"
            }`}
          >
            {showArchived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
            {showArchived ? "Ver todos" : "Arquivados"}
          </button>
          <Link
            to="/m/grupos/novo"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-primary to-accent text-primary-foreground text-xs font-semibold"
          >
            <Plus className="h-3.5 w-3.5" /> Novo
          </Link>
        </div>
      </div>

      {groups.length > 0 && <BuscaInput value={busca} onChange={setBusca} placeholder="Buscar grupo" />}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 glass rounded-xl">
              <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <EstadoVazio
          icone={Users}
          titulo="Você ainda não tem grupos"
          descricao="Crie um grupo com seus amigos para conversar juntos."
          acao={{ label: "Criar grupo", to: "/m/grupos/novo" }}
        />
      ) : visiveis.length === 0 ? (
        <EstadoVazio
          icone={Users}
          titulo={showArchived ? "Nenhum grupo arquivado" : "Nenhum grupo com esse termo"}
          acao={!showArchived ? { label: "Limpar busca", onClick: () => setBusca("") } : undefined}
        />
      ) : (
        <div className="space-y-2">
          {visiveis.map((g) => (
            <div
              key={g.id}
              className="flex items-center gap-3 p-3 glass rounded-xl hover:border-primary/40 transition-colors group"
            >
              <Link to={`/m/grupos/${g.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent overflow-hidden flex items-center justify-center text-primary-foreground font-bold shrink-0">
                  {g.image_url ? (
                    <img src={g.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <Users className="h-5 w-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold truncate flex items-center gap-1.5">
                      {g.name}
                      {g.my_role === "admin" && <Crown className="h-3 w-3 text-warning" />}
                      {(g as any).is_disabled && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive shrink-0">
                          desativado
                        </span>
                      )}
                      {g.is_archived && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                          arquivado
                        </span>
                      )}
                    </p>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {g.last_message_at ? timeAgo(g.last_message_at) : ""}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {g.member_count} membros · {g.last_message || "Sem mensagens"}
                  </p>
                </div>
              </Link>
              {/* GAP-1070: Botão arquivar/restaurar */}
              <button
                onClick={() => handleArchive(g.id, g.is_archived || false)}
                className="opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-secondary"
                title={g.is_archived ? "Restaurar" : "Arquivar"}
              >
                {g.is_archived ? (
                  <ArchiveRestore className="h-4 w-4 text-muted-foreground hover:text-primary" />
                ) : (
                  <Archive className="h-4 w-4 text-muted-foreground hover:text-muted-foreground" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
