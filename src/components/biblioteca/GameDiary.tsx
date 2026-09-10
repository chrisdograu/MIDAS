// Bloco E — Diário do jogo: várias anotações datadas por jogo (antes era um texto único).
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { BookOpen, Loader2, Trash2, Plus, Edit2, Save, X, Download, Calendar, Filter } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { exportCsv } from "@/desktop/lib/adminLog";
import { AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface Entry {
  id: string;
  entry_date: string;
  content: string;
  created_at: string;
}

export default function GameDiary({ productId }: { productId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [content, setContent] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editDate, setEditDate] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [exporting, setExporting] = useState(false);

  const key = ["game-diary", user?.id, productId];
  const { data: entries = [], isLoading } = useQuery({
    queryKey: key,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("biblioteca_diario")
        .select("id, entry_date, content, created_at")
        .eq("user_id", user!.id)
        .eq("product_id", productId)
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Entry[];
    },
  });

  // GAP-M019: Filtro por período
  const filteredEntries = useMemo(() => {
    if (dateFilter === "all") return entries;
    const now = new Date();
    const cutoff = new Date();
    if (dateFilter === "week") cutoff.setDate(now.getDate() - 7);
    else if (dateFilter === "month") cutoff.setDate(now.getDate() - 30);
    else if (dateFilter === "year") cutoff.setFullYear(now.getFullYear() - 1);
    
    return entries.filter(e => new Date(e.entry_date) >= cutoff);
  }, [entries, dateFilter]);

  const add = async () => {
    if (!user || !content.trim()) return;
    if (content.length > 2000) {
      toast.error("Máximo de 2000 caracteres");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("biblioteca_diario").insert({
      user_id: user.id, product_id: productId, entry_date: date, content: content.trim(),
    });
    setSaving(false);
    if (error) { toast.error("Não foi possível salvar a anotação"); return; }
    setContent("");
    toast.success("Anotação adicionada ao diário");
    qc.invalidateQueries({ queryKey: key });
  };

  // GAP-M017: Editar entrada
  const startEdit = (entry: Entry) => {
    setEditingId(entry.id);
    setEditContent(entry.content);
    setEditDate(entry.entry_date);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent("");
    setEditDate("");
  };

  const saveEdit = async () => {
    if (!user || !editingId) return;
    if (editContent.length > 2000) {
      toast.error("Máximo de 2000 caracteres");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("biblioteca_diario")
      .update({ content: editContent.trim(), entry_date: editDate })
      .eq("id", editingId)
      .eq("user_id", user.id);
    setSaving(false);
    if (error) { toast.error("Não foi possível salvar a edição"); return; }
    toast.success("Anotação atualizada");
    setEditingId(null);
    qc.invalidateQueries({ queryKey: key });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("biblioteca_diario").delete().eq("id", id);
    if (error) { toast.error("Não foi possível apagar"); return; }
    qc.invalidateQueries({ queryKey: key });
    toast.success("Anotação removida");
  };

  // GAP-M020: Exportar
  const exportData = () => {
    setExporting(true);
    const data = filteredEntries.map(e => ({
      Data: new Date(e.entry_date + "T00:00:00").toLocaleDateString("pt-BR"),
      Conteúdo: e.content,
      "Criado em": new Date(e.created_at).toLocaleDateString("pt-BR"),
    }));
    exportCsv(`diario_${productId.slice(0, 8)}.csv`, data);
    setExporting(false);
    toast.success("Diário exportado com sucesso");
  };

  if (!user) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-accent" /> Diário do jogo
        </h3>
        <Button variant="ghost" size="sm" onClick={exportData} disabled={exporting || entries.length === 0}>
          <Download className="h-4 w-4 mr-1" />
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Exportar"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Anotações privadas com data. Só você vê.
      </p>

      <div className="space-y-2">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="O que aconteceu nessa sessão?"
        />
        {/* GAP-M018: Contador de caracteres */}
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{content.length}/2000</span>
          {content.length > 1800 && content.length <= 2000 && (
            <span className="text-warning">⚠️ Próximo do limite</span>
          )}
          {content.length > 2000 && (
            <span className="text-destructive">⛔ Limite excedido</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-auto"
            aria-label="Data da anotação"
          />
          <Button onClick={add} disabled={saving || !content.trim() || content.length > 2000} size="sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" /> Adicionar</>}
          </Button>
        </div>
      </div>

      {/* GAP-M019: Filtro */}
      {entries.length > 0 && (
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-auto h-8 text-xs">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="week">Última semana</SelectItem>
              <SelectItem value="month">Último mês</SelectItem>
              <SelectItem value="year">Último ano</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">
            {filteredEntries.length} anotações
          </span>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : filteredEntries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {entries.length === 0 ? "Nenhuma anotação ainda." : "Nenhuma anotação no período selecionado."}
        </p>
      ) : (
        <ul className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
          {filteredEntries.map((e) => {
            const isEditing = editingId === e.id;
            return (
              <li key={e.id} className="border-l-2 border-accent/50 pl-3">
                {isEditing ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        value={editDate}
                        onChange={(v) => setEditDate(v.target.value)}
                        className="w-auto h-8 text-xs"
                      />
                      <Button size="sm" variant="ghost" onClick={saveEdit} disabled={saving}>
                        <Save className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancelEdit}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Textarea
                      value={editContent}
                      onChange={(v) => setEditContent(v.target.value)}
                      rows={2}
                      maxLength={2000}
                      className="text-sm"
                    />
                    <div className="text-right text-xs text-muted-foreground">
                      {editContent.length}/2000
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {new Date(e.entry_date + "T00:00:00").toLocaleDateString("pt-BR")}
                      </span>
                      <div className="flex items-center gap-1 ml-auto">
                        <button 
                          onClick={() => startEdit(e)} 
                          className="text-muted-foreground hover:text-primary"
                          aria-label="Editar anotação"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button className="text-muted-foreground hover:text-destructive" aria-label="Apagar anotação">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Apagar esta anotação?</AlertDialogTitle>
                              <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => remove(e.id)}>Apagar</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{e.content}</p>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}