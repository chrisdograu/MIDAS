import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flag, X, Upload, File, CheckCircle, Eye, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { checkRateLimit, RL } from "@/lib/clientRateLimit";
import SelectSimples from "@/components/SelectSimples";
import { cn } from "@/lib/utils";

type TargetType =
  | "profile"
  | "anuncio"
  | "forum_post"
  | "comentario_forum"
  | "review"
  | "comentario_review"
  | "mensagem"
  | "conversa"
  | "grupo";

interface ReportDialogProps {
  open: boolean;
  onClose: () => void;
  targetType: TargetType;
  targetId: string;
  label?: string;
}

const REASONS = ["Spam", "Conteúdo ofensivo", "Assédio", "Golpe / fraude", "Conteúdo sexual", "Violência", "Outro"];

// Categoria da denúncia (item 100). A coluna `denuncias.category` já existe
// mas nada gravava — todo mundo caía em 'outros'. Aqui a pessoa escolhe, e as
// duas categorias sensíveis (íntimo/perfil falso) sobem `priority = 'alta'`
// automaticamente para a fila de moderação.
const CATEGORIES: { value: string; label: string; priority?: "alta" }[] = [
  { value: "intimo_nao_consentido", label: "Conteúdo íntimo não consentido", priority: "alta" },
  { value: "perfil_falso", label: "Perfil falso / se passando por outra pessoa", priority: "alta" },
  { value: "mensagem_indevida", label: "Mensagem indevida (assédio, spam, golpe)" },
  { value: "produto_mal_classificado", label: "Produto/anúncio classificado incorretamente" },
  { value: "outros", label: "Outros" },
];

// Denúncias com contexto de marketplace/troca ganham campo opcional de evidência
// (link de print, foto, mensagem). Não trava o envio — só sinaliza que resolve mais rápido.
const MARKETPLACE_TARGETS: TargetType[] = ["anuncio", "mensagem", "conversa"];

// GAP-RP02: Tela de confirmação
function ConfirmationScreen({ protocol, onClose }: { protocol: string; onClose: () => void }) {
  return (
    <div className="text-center py-4">
      <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
        <CheckCircle className="h-8 w-8 text-success" />
      </div>
      <h3 className="text-lg font-bold text-foreground">Denúncia enviada!</h3>
      <p className="text-sm text-muted-foreground mt-1">
        Seu protocolo é <strong className="text-primary">{protocol}</strong>
      </p>
      <p className="text-xs text-muted-foreground mt-2">Nossa equipe vai analisar e tomar as medidas cabíveis.</p>
      <button
        onClick={onClose}
        className="mt-4 px-6 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90"
      >
        Entendi
      </button>
    </div>
  );
}

// GAP-RP04: Histórico de denúncias
function ReportHistory({ targetId, targetType }: { targetId: string; targetType: TargetType }) {
  const { user } = useAuth();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("denuncias")
        .select("id, reason, status, created_at, resolved_at")
        .eq("target_id", targetId)
        .eq("target_type", targetType)
        .eq("reporter_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      setHistory(data || []);
      setLoading(false);
    })();
  }, [targetId, targetType, user]);

  if (loading || history.length === 0) return null;

  const statusColors: Record<string, string> = {
    pending: "bg-warning/20 text-warning",
    pendente: "bg-warning/20 text-warning",
    resolved: "bg-success/20 text-success",
    resolvida: "bg-success/20 text-success",
    rejected: "bg-destructive/20 text-destructive",
    dismissed: "bg-destructive/20 text-destructive",
    recusada: "bg-destructive/20 text-destructive",
  };

  return (
    <div className="border-t border-border pt-3 mt-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <History className="h-3.5 w-3.5" />
        <span className="font-medium">Denúncias anteriores</span>
      </div>
      <div className="mt-1 space-y-1">
        {history.slice(0, 3).map((h) => (
          <div key={h.id} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{h.reason}</span>
            <span
              className={cn(
                "px-1.5 py-0.5 rounded text-[10px] font-medium",
                statusColors[h.status] || "bg-muted text-muted-foreground",
              )}
            >
              {h.status || "pendente"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReportDialog({ open, onClose, targetType, targetId, label }: ReportDialogProps) {
  const { user } = useAuth();
  const [reason, setReason] = useState(REASONS[0]);
  const [category, setCategory] = useState(CATEGORIES[0].value);
  const [desc, setDesc] = useState("");
  const [evidence, setEvidence] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<"form" | "confirm" | "done">("form");
  const [protocol, setProtocol] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const showEvidence = MARKETPLACE_TARGETS.includes(targetType);

  // GAP-RP01: Upload de anexos
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter((f) => f.size <= 5 * 1024 * 1024);
    if (validFiles.length !== files.length) {
      toast.error("Alguns arquivos excedem 5MB");
    }
    setAttachments((prev) => [...prev, ...validFiles]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // GAP-RP03: Preview do relatório
  const getPreview = () => {
    const categoryLabel = CATEGORIES.find((c) => c.value === category)?.label || category;
    return {
      type: label || targetType,
      reason,
      category: categoryLabel,
      description: desc || "Nenhum detalhe adicional",
      evidence: evidence || "Nenhuma evidência anexada",
      attachments: attachments.length,
    };
  };

  const submit = async () => {
    if (!user) {
      toast.error("Entre para denunciar");
      return;
    }
    const rl = checkRateLimit(RL.REPORT);
    if (rl.ok === false) {
      toast.error(`Aguarde ${rl.retryInSec}s antes de enviar outra denúncia.`);
      return;
    }

    setSubmitting(true);
    const evidenceTrim = evidence.trim();
    const descTrim = desc.trim();
    const fullDescription =
      [descTrim || null, evidenceTrim ? `[Evidência anexada pelo denunciante]: ${evidenceTrim}` : null]
        .filter(Boolean)
        .join("\n\n") || null;
    const catEntry = CATEGORIES.find((c) => c.value === category);

    // GAP-RP01: Upload de anexos
    let attachmentUrls: string[] = [];
    let uploadFailures = 0;
    for (const file of attachments) {
      try {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `reports/${user.id}/${Date.now()}_${safeName}`;
        const { error } = await supabase.storage.from("report-attachments").upload(path, file);
        if (!error) {
          // Bucket privado: guarda o caminho; a moderação gera URL assinada (createSignedUrl)
          attachmentUrls.push(`report-attachments/${path}`);
        } else {
          uploadFailures++;
          console.error("Falha no upload do anexo:", error);
        }
      } catch {
        uploadFailures++;
      }
    }
    if (uploadFailures > 0) toast.warning(`${uploadFailures} anexo(s) não puderam ser enviados`);

    const reportId = crypto.randomUUID();
    const { error } = await supabase.from("denuncias").insert({
      id: reportId,
      reporter_id: user.id,
      target_type: targetType,
      target_id: targetId,
      reason,
      description: fullDescription,
      category,
      priority: catEntry?.priority ?? "normal",
      attachments: attachmentUrls.length > 0 ? attachmentUrls : null,
    } as any);

    setSubmitting(false);
    if (error) {
      console.error("Erro ao denunciar:", error);
      toast.error(`Erro ao denunciar: ${error.message}`);
      return;
    }

    // GAP-RP02: Protocolo
    const protocolId = reportId.slice(0, 8).toUpperCase();
    setProtocol(protocolId);
    setStep("done");
    toast.success("Denúncia enviada com sucesso!");
  };

  const handleConfirm = () => {
    // GAP-RP03: Ir para confirmação
    setStep("confirm");
  };

  const handleBack = () => {
    setStep("form");
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] bg-overlay/60 flex items-end sm:items-center justify-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 200 }}
            animate={{ y: 0 }}
            exit={{ y: 200 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md bg-card rounded-t-2xl sm:rounded-2xl p-5 space-y-3 border border-border max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold flex items-center gap-2">
                <Flag className="h-4 w-4 text-destructive" />
                {step === "done"
                  ? "Denúncia enviada"
                  : step === "confirm"
                    ? "Confirmar denúncia"
                    : `Denunciar ${label || "conteúdo"}`}
              </h3>
              <button onClick={onClose}>
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            {/* GAP-RP02: Tela de confirmação */}
            {step === "done" ? (
              <ConfirmationScreen protocol={protocol} onClose={onClose} />
            ) : step === "confirm" ? (
              // GAP-RP03: Preview do relatório
              <div className="space-y-3">
                <div className="bg-secondary/30 rounded-lg p-3 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tipo:</span>
                    <span className="text-foreground font-medium">{getPreview().type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Categoria:</span>
                    <span className="text-foreground font-medium">{getPreview().category}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Motivo:</span>
                    <span className="text-foreground font-medium">{getPreview().reason}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Anexos:</span>
                    <span className="text-foreground font-medium">{getPreview().attachments}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleBack} className="flex-1 py-2.5 rounded-lg bg-secondary text-sm font-semibold">
                    Voltar
                  </button>
                  <button
                    onClick={submit}
                    disabled={submitting}
                    className="flex-1 py-2.5 rounded-lg bg-destructive text-destructive-foreground text-sm font-semibold disabled:opacity-50"
                  >
                    {submitting ? "Enviando..." : "Confirmar"}
                  </button>
                </div>
              </div>
            ) : (
              // Formulário
              <>
                <div>
                  <label className="block text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                    Categoria
                  </label>
                  <SelectSimples
                    value={category}
                    onChange={setCategory}
                    label="Categoria da denúncia"
                    className="w-full"
                    options={CATEGORIES.map((c) => ({
                      value: c.value,
                      label: `${c.label}${c.priority === "alta" ? " · prioridade alta" : ""}`,
                    }))}
                  />
                </div>
                <SelectSimples
                  value={reason}
                  onChange={setReason}
                  label="Motivo da denúncia"
                  className="w-full"
                  options={REASONS.map((r) => ({ value: r, label: r }))}
                />

                <textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="Detalhes (opcional)..."
                  className="w-full p-3 bg-background border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                />

                {showEvidence && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                    <p className="text-xs text-foreground font-semibold">
                      Anexar evidência (opcional, mas ajuda muito)
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Cole um link de print da conversa, foto do item ou comprovante. Denúncias com evidência são
                      resolvidas mais rápido — protege quem denuncia e quem foi denunciado.
                    </p>
                    <input
                      value={evidence}
                      onChange={(e) => setEvidence(e.target.value)}
                      maxLength={500}
                      placeholder="https://... ou descrição da evidência"
                      className="w-full p-2 bg-background border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                )}

                {/* GAP-RP01: Anexos */}
                <div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Anexar arquivos (máx 5MB)
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf,.doc,.docx"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  {attachments.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {attachments.map((file, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between text-xs bg-secondary/50 rounded px-2 py-1"
                        >
                          <span className="flex items-center gap-1.5">
                            <File className="h-3 w-3" />
                            {file.name}
                          </span>
                          <button
                            onClick={() => removeAttachment(i)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* GAP-RP04: Histórico */}
                <ReportHistory targetId={targetId} targetType={targetType} />

                {/* GAP-RP03: Botão de preview */}
                <button
                  onClick={handleConfirm}
                  className="flex items-center gap-2 text-xs text-primary hover:underline transition-colors"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Ver resumo antes de enviar
                </button>

                <div className="flex gap-2 mt-2">
                  <button onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-secondary text-sm font-semibold">
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirm}
                    className="flex-1 py-2.5 rounded-lg bg-destructive text-destructive-foreground text-sm font-semibold"
                  >
                    Continuar
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
