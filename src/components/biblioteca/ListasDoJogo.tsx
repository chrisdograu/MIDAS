// Bloco E — Listas personalizadas (N:N): um jogo pode estar em várias listas.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ListPlus, Loader2, Plus, Edit2, Save, X, Trash2, Palette } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// GAP-M021: Cores disponíveis
const COLORS = [
  { name: "Azul", value: "blue" },
  { name: "Verde", value: "green" },
  { name: "Roxo", value: "purple" },
  { name: "Vermelho", value: "red" },
  { name: "Amarelo", value: "yellow" },
  { name: "Rosa", value: "pink" },
  { name: "Laranja", value: "orange" },
  { name: "Cinza", value: "gray" },
];

const COLOR_CLASSES: Record<string, string> = {
  blue: "bg-info/20 text-info border-info/30",
  green: "bg-success/20 text-success border-success/30",
  purple: "bg-highlight/20 text-highlight border-highlight/30",
  red: "bg-destructive/20 text-destructive border-destructive/30",
  yellow: "bg-warning/20 text-warning border-warning/30",
  pink: "bg-playful/20 text-playful border-playful/30",
  orange: "bg-seller/20 text-seller border-seller/30",
  gray: "bg-muted-foreground/20 text-muted-foreground border-muted-foreground/30",
};

interface Lista { 
  id: string; 
  nome: string; 
  cor: string | null;
  count?: number;
}

export function useListas() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["biblioteca-listas", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("biblioteca_listas")
        .select("id, nome, cor")
        .eq("user_id", user!.id)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Lista[];
    },
  });
}

export default function ListasDoJogo({ productId }: { productId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [novaLista, setNovaLista] = useState("");
  const [novaCor, setNovaCor] = useState("blue");
  const [criando, setCriando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editCor, setEditCor] = useState("");
  const [deletandoId, setDeletandoId] = useState<string | null>(null);

  const { data: listas = [], isLoading } = useListas();

  // GAP-M024: Contagem de itens por lista
  const itensKey = ["biblioteca-lista-itens", user?.id];
  const { data: allItems } = useQuery({
    queryKey: itensKey,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("biblioteca_lista_itens")
        .select("lista_id, product_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data || [];
    },
  });

  const listasComContagem = listas.map(lista => ({
    ...lista,
    count: (allItems || []).filter(i => i.lista_id === lista.id).length,
  }));

  const marcadasKey = ["biblioteca-lista-itens-marcados", user?.id, productId];
  const { data: marcadas = [] } = useQuery({
    queryKey: marcadasKey,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("biblioteca_lista_itens")
        .select("lista_id")
        .eq("user_id", user!.id)
        .eq("product_id", productId);
      if (error) throw error;
      return (data ?? []).map((r) => r.lista_id as string);
    },
  });

  const toggle = async (listaId: string, checked: boolean) => {
    if (!user) return;
    const { error } = checked
      ? await supabase.from("biblioteca_lista_itens").insert({ lista_id: listaId, user_id: user.id, product_id: productId })
      : await supabase.from("biblioteca_lista_itens").delete()
          .match({ lista_id: listaId, user_id: user.id, product_id: productId });
    if (error) { toast.error("Não foi possível atualizar a lista"); return; }
    qc.invalidateQueries({ queryKey: marcadasKey });
    qc.invalidateQueries({ queryKey: itensKey });
  };

  const criar = async () => {
    if (!user || !novaLista.trim()) return;
    setCriando(true);
    const { data, error } = await supabase
      .from("biblioteca_listas")
      .insert({ user_id: user.id, nome: novaLista.trim(), cor: novaCor || null })
      .select("id").single();
    setCriando(false);
    if (error) {
      toast.error(error.message.includes("duplicate") ? "Você já tem uma lista com esse nome" : "Erro ao criar lista");
      return;
    }
    setNovaLista("");
    setNovaCor("blue");
    qc.invalidateQueries({ queryKey: ["biblioteca-listas", user.id] });
    if (data?.id) await toggle(data.id, true);
    toast.success("Lista criada");
  };

  // GAP-M022: Editar lista
  const startEdit = (lista: Lista) => {
    setEditandoId(lista.id);
    setEditNome(lista.nome);
    setEditCor(lista.cor || "blue");
  };

  const saveEdit = async () => {
    if (!user || !editandoId || !editNome.trim()) return;
    const { error } = await supabase
      .from("biblioteca_listas")
      .update({ nome: editNome.trim(), cor: editCor || null })
      .eq("id", editandoId)
      .eq("user_id", user.id);
    if (error) { toast.error("Erro ao salvar"); return; }
    setEditandoId(null);
    qc.invalidateQueries({ queryKey: ["biblioteca-listas", user.id] });
    toast.success("Lista atualizada");
  };

  // GAP-M023: Excluir com confirmação
  const excluirLista = async () => {
    if (!user || !deletandoId) return;
    const { error } = await supabase
      .from("biblioteca_listas")
      .delete()
      .eq("id", deletandoId)
      .eq("user_id", user.id);
    if (error) { toast.error("Erro ao excluir"); return; }
    setDeletandoId(null);
    qc.invalidateQueries({ queryKey: ["biblioteca-listas", user.id] });
    qc.invalidateQueries({ queryKey: itensKey });
    toast.success("Lista excluída");
  };

  if (!user) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-3">
      <h3 className="font-semibold flex items-center gap-2">
        <ListPlus className="h-4 w-4 text-primary" /> Minhas listas
      </h3>
      <p className="text-xs text-muted-foreground -mt-2">
        Este jogo pode estar em quantas listas você quiser.
      </p>

      {isLoading ? (
        <div className="flex justify-center py-3"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : listasComContagem.length === 0 ? (
        <p className="text-sm text-muted-foreground">Você ainda não criou listas.</p>
      ) : (
        <ul className="space-y-2 max-h-60 overflow-y-auto pr-2">
          {listasComContagem.map((l) => {
            const isEditing = editandoId === l.id;
            const colorClass = l.cor ? COLOR_CLASSES[l.cor] : "bg-muted text-muted-foreground border-border";
            
            return (
              <li key={l.id} className="flex items-center gap-2">
                {isEditing ? (
                  <div className="flex-1 flex flex-wrap items-center gap-2">
                    <Input
                      value={editNome}
                      onChange={(e) => setEditNome(e.target.value)}
                      className="flex-1 min-w-[120px] h-8 text-sm"
                      placeholder="Nome da lista"
                    />
                    <select
                      value={editCor}
                      onChange={(e) => setEditCor(e.target.value)}
                      className="h-8 rounded-lg border border-border bg-background px-2 text-sm"
                    >
                      {COLORS.map(c => (
                        <option key={c.value} value={c.value}>{c.name}</option>
                      ))}
                    </select>
                    <Button size="sm" variant="ghost" className="h-8" onClick={saveEdit}>
                      <Save className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditandoId(null)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Checkbox
                      id={`lista-${l.id}`}
                      checked={marcadas.includes(l.id)}
                      onCheckedChange={(c) => toggle(l.id, c === true)}
                    />
                    <label htmlFor={`lista-${l.id}`} className={cn(
                      "text-sm cursor-pointer px-2 py-0.5 rounded border",
                      colorClass
                    )}>
                      {l.nome}
                    </label>
                    <span className="text-xs text-muted-foreground">
                      ({l.count || 0})
                    </span>
                    <div className="flex items-center gap-1 ml-auto">
                      <button 
                        onClick={() => startEdit(l)} 
                        className="text-muted-foreground hover:text-primary"
                        aria-label="Editar lista"
                      >
                        <Edit2 className="h-3 w-3" />
                      </button>
                      <button 
                        onClick={() => setDeletandoId(l.id)} 
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Excluir lista"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex gap-2 pt-1">
        <div className="flex-1 flex gap-2">
          <Input
            value={novaLista}
            onChange={(e) => setNovaLista(e.target.value)}
            placeholder="Nova lista (ex: Zerar em 2026)"
            maxLength={60}
            className="flex-1"
          />
          <select
            value={novaCor}
            onChange={(e) => setNovaCor(e.target.value)}
            className="h-10 rounded-lg border border-border bg-background px-2 text-sm"
          >
            {COLORS.map(c => (
              <option key={c.value} value={c.value}>{c.name}</option>
            ))}
          </select>
        </div>
        <Button variant="outline" size="sm" onClick={criar} disabled={criando || !novaLista.trim()}>
          {criando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </Button>
      </div>

      {/* GAP-M023: Modal de exclusão */}
      <AlertDialog open={!!deletandoId} onOpenChange={(o) => !o && setDeletandoId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lista?</AlertDialogTitle>
            <AlertDialogDescription>
              A lista será removida permanentemente. Os jogos não serão afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={excluirLista} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Utilitário para className condicional
const cn = (...classes: (string | undefined | false)[]) => classes.filter(Boolean).join(' ');