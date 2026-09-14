import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Mail, MessageSquare, Send, Phone, Paperclip, X, Loader2, AlertCircle, CheckCircle2, History, Flag } from 'lucide-react';
import { toast } from 'sonner';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import SelectSimples from '@/components/SelectSimples';
import { stripImageExif } from '@/lib/stripImageExif';

interface StoreInfo { name?: string; email?: string; phone?: string }

// GAP-457: Prioridades
type Priority = 'normal' | 'urgent';

// GAP-455: Arquivo anexado
interface Attachment {
  file: File;
  preview: string;
  uploadProgress?: number;
  uploaded?: boolean;
  url?: string;
}

// GAP-454: Enviar e-mail de confirmação via Edge Function
async function sendConfirmationEmail(email: string, name: string, ticketId: string) {
  try {
    const { error } = await supabase.functions.invoke('send-ticket-confirmation', {
      body: { email, name, ticketId }
    });
    if (error) {
      console.error('Erro ao enviar e-mail de confirmação:', error);
      // Não falha o fluxo principal
    }
  } catch {
    // Silencioso — não quebrar o fluxo
  }
}

// GAP-456: Buscar contagem de tickets do usuário
async function getTicketCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from('tickets')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  return count || 0;
}

export default function Contato() {
  const { user } = useAuth();
  const { value: store } = useSiteSettings<StoreInfo>('store_info');
  const [form, setForm] = useState({ 
    nome: '', 
    email: '', 
    assunto: '', 
    mensagem: '' 
  });
  // GAP-457: Prioridade
  const [priority, setPriority] = useState<Priority>('normal');
  // Honeypot
  const [website, setWebsite] = useState('');
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // GAP-455: Anexos
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // GAP-456: Contagem de tickets
  const [ticketCount, setTicketCount] = useState<number | null>(null);
  
  const contactEmail = store?.email || 'suporte@midias.com.br';
  const contactPhone = store?.phone;

  // GAP-456: Buscar contagem de tickets ao carregar
  useEffect(() => {
    if (user) {
      getTicketCount(user.id).then(setTicketCount);
    }
  }, [user]);

  // GAP-455: Upload de anexo
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Arquivo deve ter no máximo 5MB');
      return;
    }
    
    if (!file.type.startsWith('image/') && !file.type.startsWith('application/')) {
      toast.error('Formato não suportado. Use imagens ou PDF.');
      return;
    }
    
    setUploadingFile(true);
    try {
      let processedFile = file;
      if (file.type.startsWith('image/')) {
        processedFile = await stripImageExif(file);
      }
      
      const preview = URL.createObjectURL(processedFile);
      setAttachments(prev => [...prev, { 
        file: processedFile, 
        preview,
        uploadProgress: 0,
        uploaded: false 
      }]);
      toast.success('Arquivo adicionado!');
    } catch {
      toast.error('Erro ao processar arquivo');
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    const removed = attachments[index];
    if (removed.preview) URL.revokeObjectURL(removed.preview);
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (website.trim() !== '') {
      setForm({ nome: '', email: '', assunto: '', mensagem: '' });
      setWebsite('');
      toast.success('Mensagem enviada com sucesso! Responderemos em breve.');
      return;
    }
    
    const erros: Record<string, string> = {};
    if (form.nome.trim().length < 2) erros.nome = 'Informe seu nome completo.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) erros.email = 'Informe um e-mail válido.';
    if (form.mensagem.trim().length < 20) erros.mensagem = 'Detalhe um pouco mais (mínimo de 20 caracteres).';
    setErrors(erros);
    if (Object.keys(erros).length > 0) {
      toast.error('Revise os campos destacados.');
      return;
    }
    
    setSending(true);
    
    if (!user) {
      setSending(false);
      toast.error(`Entre na sua conta para abrir um atendimento, ou escreva para ${contactEmail}`);
      return;
    }
    
    const subject = form.assunto?.trim() || 'Contato pelo site';
    
    // GAP-457: Incluir prioridade no corpo
    const priorityText = priority === 'urgent' ? '[URGENTE] ' : '';
    const body = `${priorityText}${form.mensagem}\n\n— ${form.nome} (${form.email})`;
    
    const { data: ticket, error } = await supabase
      .from('tickets')
      .insert({
        user_id: user.id,
        channel: 'web',
        subject: `${priorityText}${subject}`,
        body,
        priority: priority,
      })
      .select('id')
      .single();
      
    if (error) {
      setSending(false);
      toast.error(`Não foi possível enviar sua mensagem: ${error.message}`);
      return;
    }
    
    // GAP-455: Fazer upload dos anexos
    let attachmentUrls: string[] = [];
    for (const attachment of attachments) {
      try {
        const ext = attachment.file.name.split('.').pop();
        const path = `tickets/${ticket.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('ticket-attachments')
          .upload(path, attachment.file);
        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from('ticket-attachments')
            .getPublicUrl(path);
          attachmentUrls.push(publicUrl);
        }
      } catch {
        // Silencioso — anexo não é crítico
      }
    }
    
    const { error: msgError } = await supabase.from('ticket_messages').insert({
      ticket_id: ticket.id,
      sender_id: user.id,
      content: form.mensagem,
      attachments: attachmentUrls.length > 0 ? attachmentUrls : null,
    });
    
    setSending(false);
    if (msgError) {
      toast.error(`Atendimento aberto, mas a mensagem não foi anexada: ${msgError.message}`);
      return;
    }
    
    // GAP-454: Enviar e-mail de confirmação
    await sendConfirmationEmail(form.email, form.nome, ticket.id);
    
    toast.success('Mensagem enviada com sucesso! Verifique seu e-mail para confirmação.');
    setForm({ nome: '', email: '', assunto: '', mensagem: '' });
    setErrors({});
    setAttachments([]);
    setPriority('normal');
    
    // GAP-456: Atualizar contagem
    if (user) {
      const count = await getTicketCount(user.id);
      setTicketCount(count);
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <div className="text-center mb-10">
        <MessageSquare className="h-12 w-12 text-primary mx-auto mb-4" />
        <h1 className="text-3xl font-bold text-foreground">Contato</h1>
        <p className="text-muted-foreground mt-2">Fale conosco — estamos aqui para ajudar</p>
        
        {/* GAP-456: Link para histórico de tickets */}
        {user && ticketCount !== null && (
          <Link 
            to="/meus-tickets" 
            className="inline-flex items-center gap-1.5 mt-3 text-sm text-primary hover:underline"
          >
            <History className="h-4 w-4" />
            Meus tickets ({ticketCount})
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-card border border-border rounded-xl p-6 text-center">
          <Mail className="h-8 w-8 text-primary mx-auto mb-2" />
          <h3 className="font-semibold text-foreground">E-mail</h3>
          <p className="text-sm text-muted-foreground">{contactEmail}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-6 text-center">
          {contactPhone ? <Phone className="h-8 w-8 text-primary mx-auto mb-2" /> : <MessageSquare className="h-8 w-8 text-primary mx-auto mb-2" />}
          <h3 className="font-semibold text-foreground">{contactPhone ? 'Telefone' : 'Atendimento'}</h3>
          <p className="text-sm text-muted-foreground">{contactPhone || '24 horas, 7 dias por semana'}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-6 space-y-4">
        {/* Honeypot */}
        <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', top: 'auto', width: '1px', height: '1px', overflow: 'hidden' }}>
          <label>Não preencha este campo
            <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} />
          </label>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="contato-nome">Nome *</Label>
            <Input
              id="contato-nome"
              value={form.nome}
              onChange={e => setForm({ ...form, nome: e.target.value })}
              aria-invalid={!!errors.nome}
              aria-describedby={errors.nome ? 'erro-nome' : undefined}
              autoComplete="name"
            />
            {errors.nome && <p id="erro-nome" className="text-xs text-destructive">{errors.nome}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contato-email">E-mail *</Label>
            <Input
              id="contato-email"
              type="email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'erro-email' : undefined}
              autoComplete="email"
            />
            {errors.email && <p id="erro-email" className="text-xs text-destructive">{errors.email}</p>}
          </div>
        </div>
        
        <div className="space-y-1.5">
          <Label htmlFor="contato-assunto">Assunto</Label>
          <Input
            id="contato-assunto"
            value={form.assunto}
            onChange={e => setForm({ ...form, assunto: e.target.value })}
            placeholder="Ex.: dúvida sobre um pedido"
          />
        </div>
        
        {/* GAP-457: Prioridade */}
        <div className="space-y-1.5">
          <Label htmlFor="contato-prioridade">Prioridade</Label>
          <SelectSimples
            value={priority}
            onChange={(v) => setPriority(v as Priority)}
            label="Prioridade"
            options={[
              { value: 'normal', label: 'Normal' },
              { value: 'urgent', label: '🔴 Urgente' },
            ]}
          />
        </div>
        
        <div className="space-y-1.5">
          <Label htmlFor="contato-mensagem">Mensagem *</Label>
          <Textarea
            id="contato-mensagem"
            rows={5}
            maxLength={2000}
            value={form.mensagem}
            onChange={e => setForm({ ...form, mensagem: e.target.value })}
            aria-invalid={!!errors.mensagem}
            aria-describedby={errors.mensagem ? 'erro-mensagem' : undefined}
            className="resize-none"
          />
          <div className="flex justify-between text-xs">
            <span className="text-destructive" id="erro-mensagem">{errors.mensagem || ''}</span>
            <span className="text-muted-foreground">{form.mensagem.trim().length}/2000</span>
          </div>
        </div>
        
        {/* GAP-455: Anexos */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingFile}
            >
              {uploadingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
              Anexar arquivo
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
            <span className="text-xs text-muted-foreground">(max 5MB, imagens ou PDF)</span>
          </div>
          
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {attachments.map((att, index) => (
                <div key={index} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-secondary text-xs">
                  <span className="truncate max-w-[100px]">{att.file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(index)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <Button type="submit" disabled={sending} className="w-full" size="lg">
          {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
          {sending ? 'Enviando...' : 'Enviar mensagem'}
        </Button>
      </form>
    </div>
  );
}