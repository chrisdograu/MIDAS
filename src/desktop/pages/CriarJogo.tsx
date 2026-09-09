import { useState, useMemo } from 'react';
import { Sparkles, Loader2, Eye, CheckCircle2, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ProdutoFormFields } from '../components/ProdutoFormFields';
import ImageGalleryField from '../components/ImageGalleryField';
import { adminLog } from '../lib/adminLog';

const CLASSIFICACOES: { value: 'L' | '10' | '12' | '14' | '16' | '18'; label: string; hint: string }[] = [
  { value: 'L', label: 'Livre', hint: 'Sem restrição de idade.' },
  { value: '10', label: '10 anos', hint: 'Fantasia leve, competição.' },
  { value: '12', label: '12 anos', hint: 'Violência leve, insinuação.' },
  { value: '14', label: '14 anos', hint: 'Violência, terror leve.' },
  { value: '16', label: '16 anos', hint: 'Violência intensa, drogas.' },
  { value: '18', label: '18 anos', hint: 'Adulto — só maiores.' },
];

// GAP-D91: Validação
interface ValidationError {
  field: string;
  message: string;
}

export default function CriarJogo() {
  const [form, setForm] = useState({ title: '', description: '', price: 0, original_price: 0, stock: 0, image_url: '', publisher: '' });
  const [featured, setFeatured] = useState(false);
  const [classificacao, setClassificacao] = useState<'L' | '10' | '12' | '14' | '16' | '18'>('L');
  const [tipo, setTipo] = useState<'digital' | 'physical' | 'subscription'>('digital');
  const [basics, setBasics] = useState({ platform: [] as string[], category_id: '' });
  const [categoryName, setCategoryName] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  // GAP-D91: Validações
  const validationErrors = useMemo((): ValidationError[] => {
    const errors: ValidationError[] = [];
    if (!form.title.trim()) errors.push({ field: 'title', message: 'Título é obrigatório' });
    if (form.title.trim().length < 3) errors.push({ field: 'title', message: 'Título deve ter pelo menos 3 caracteres' });
    if (form.price <= 0) errors.push({ field: 'price', message: 'Preço deve ser maior que zero' });
    if (basics.platform.length === 0) errors.push({ field: 'platform', message: 'Selecione ao menos uma plataforma' });
    if (images.length === 0 && !form.image_url) errors.push({ field: 'images', message: 'Adicione ao menos uma imagem' });
    if (form.stock < 0) errors.push({ field: 'stock', message: 'Estoque não pode ser negativo' });
    return errors;
  }, [form, basics.platform, images]);

  const isFieldValid = (field: string) => {
    if (!touched.has(field)) return true;
    return !validationErrors.some(e => e.field === field);
  };

  const getFieldError = (field: string) => {
    return validationErrors.find(e => e.field === field)?.message;
  };

  // GAP-D94: Validar imagem
  const validateImage = (url: string) => {
    if (!url) return true;
    // Aceitar URLs de imagem comuns
    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const lower = url.toLowerCase();
    if (validExtensions.some(ext => lower.includes(ext))) return true;
    // Aceitar URLs do storage do Supabase
    if (url.includes('supabase.co/storage')) return true;
    // Aceitar URLs que começam com http e parecem imagens
    if (url.startsWith('http') && (url.includes('image') || url.includes('img'))) return true;
    return false;
  };

  // GAP-D92: Preview do jogo
  const previewData = useMemo(() => ({
    title: form.title || 'Título do Jogo',
    description: form.description || 'Descrição do jogo...',
    price: form.price || 0,
    image: images[0] || form.image_url || null,
    platform: basics.platform,
    category: categoryName || 'Categoria',
    classificacao: CLASSIFICACOES.find(c => c.value === classificacao)?.label || 'Livre',
    tipo: tipo === 'digital' ? 'Digital' : tipo === 'physical' ? 'Físico' : 'Assinatura',
  }), [form, images, basics.platform, categoryName, classificacao, tipo]);

  const save = async () => {
    // GAP-D91: Validar antes de salvar
    if (validationErrors.length > 0) {
      // Marcar todos como touched
      validationErrors.forEach(e => touched.add(e.field));
      setTouched(new Set(touched));
      toast.error('Corrija os erros antes de salvar');
      return;
    }

    setSaving(true);
    const originalPrice = form.original_price && form.original_price > 0 ? form.original_price : form.price;
    const mainImage = images[0] || form.image_url;
    
    const { data: created, error } = await supabase.from('produtos').insert({
      ...form,
      image_url: mainImage,
      original_price: originalPrice,
      featured,
      classificacao_indicativa: classificacao,
      platform: basics.platform,
      category_id: basics.category_id || null,
      category: categoryName,
      product_type: tipo,
      estado_publicacao: 'ativo',
      is_active: true,
      awaiting_first_stock: form.stock <= 0,
    } as any).select('id').single();
    
    if (error || !created) { 
      setSaving(false); 
      return toast.error(error?.message || 'Erro ao criar o jogo'); 
    }

    // GAP-D93: Admin log
    await adminLog({
      action: 'criar_jogo',
      entity: 'produtos',
      entity_id: (created as any).id,
      payload: { 
        titulo: form.title, 
        preco: form.price, 
        plataformas: basics.platform,
        categoria: categoryName,
        tipo,
      },
    });

    // Imagens extras
    const extras = images.slice(1);
    if (extras.length) {
      const { error: errImgs } = await supabase.from('produto_imagens').insert(
        extras.map((image_url, i) => ({ product_id: (created as any).id, image_url, position: i }))
      );
      if (errImgs) toast.error(`Jogo criado, mas a galeria não foi salva: ${errImgs.message}`);
    }
    
    setSaving(false);
    toast.success('Jogo criado com sucesso!');
    navigate('/desktop/jogos');
  };

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <AdminPageHeader 
        icon={Sparkles} 
        title="Criar Jogo" 
        subtitle="Cadastre um novo jogo no catálogo"
        actions={
          <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
            <Eye className="h-4 w-4 mr-1" /> Prévia
          </Button>
        }
      />

      {/* GAP-D91: Resumo de erros */}
      {validationErrors.length > 0 && touched.size > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-3">
            <p className="text-sm font-semibold text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> {validationErrors.length} erro(s) encontrado(s)
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/50">
        <CardContent className="p-6 space-y-4">
          {/* Título */}
          <div className={!isFieldValid('title') ? 'border-destructive border rounded-lg p-3' : ''}>
            <Label>Título <span className="text-destructive">*</span></Label>
            <Input 
              value={form.title} 
              onChange={e => setForm({ ...form, title: e.target.value })}
              onBlur={() => { touched.add('title'); setTouched(new Set(touched)); }}
              placeholder="Ex: Elden Ring" 
              className={!isFieldValid('title') ? 'border-destructive' : ''}
            />
            {!isFieldValid('title') && (
              <p className="text-xs text-destructive mt-1">{getFieldError('title')}</p>
            )}
          </div>

          <div>
            <Label>Editora</Label>
            <Input 
              value={form.publisher} 
              onChange={e => setForm({ ...form, publisher: e.target.value })} 
              placeholder="Ex: FromSoftware" 
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className={!isFieldValid('price') ? 'border-destructive border rounded-lg p-3' : ''}>
              <Label>Preço <span className="text-destructive">*</span></Label>
              <Input 
                type="number" 
                step="0.01" 
                value={form.price} 
                onChange={e => setForm({ ...form, price: Number(e.target.value) })}
                onBlur={() => { touched.add('price'); setTouched(new Set(touched)); }}
                className={!isFieldValid('price') ? 'border-destructive' : ''}
              />
              {!isFieldValid('price') && (
                <p className="text-xs text-destructive mt-1">{getFieldError('price')}</p>
              )}
            </div>
            <div>
              <Label>Preço original</Label>
              <Input 
                type="number" 
                step="0.01" 
                value={form.original_price} 
                onChange={e => setForm({ ...form, original_price: Number(e.target.value) })} 
              />
            </div>
            <div className={!isFieldValid('stock') ? 'border-destructive border rounded-lg p-3' : ''}>
              <Label>Estoque</Label>
              <Input 
                type="number" 
                value={form.stock} 
                onChange={e => setForm({ ...form, stock: Number(e.target.value) })}
                onBlur={() => { touched.add('stock'); setTouched(new Set(touched)); }}
                className={!isFieldValid('stock') ? 'border-destructive' : ''}
              />
              {!isFieldValid('stock') && (
                <p className="text-xs text-destructive mt-1">{getFieldError('stock')}</p>
              )}
            </div>
          </div>

          <div>
            <Label>Tipo de mídia</Label>
            <Select value={tipo} onValueChange={(v: any) => setTipo(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="digital">Digital (chave/download)</SelectItem>
                <SelectItem value="physical">Físico (mídia em caixa)</SelectItem>
                <SelectItem value="subscription">Assinatura</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">Sem estoque, o jogo entra como "aguardando primeiro estoque" e não aparece na loja.</p>
          </div>

          <div className={!isFieldValid('images') ? 'border-destructive border rounded-lg p-3' : ''}>
            <ImageGalleryField
              label="Imagens do jogo"
              hint="A primeira imagem é a principal; as demais vão para a galeria. Pode enviar arquivos e/ou colar links."
              value={images}
              onChange={setImages}
              folder="jogos"
              validateImage={validateImage}
              onBlur={() => { touched.add('images'); setTouched(new Set(touched)); }}
            />
            {!isFieldValid('images') && (
              <p className="text-xs text-destructive mt-1">{getFieldError('images')}</p>
            )}
          </div>

          <div className={!isFieldValid('platform') ? 'border-destructive border rounded-lg p-3' : ''}>
            <ProdutoFormFields 
              value={basics} 
              onChange={setBasics} 
              onCategoryName={setCategoryName}
              onBlur={() => { touched.add('platform'); setTouched(new Set(touched)); }}
            />
            {!isFieldValid('platform') && (
              <p className="text-xs text-destructive mt-1">{getFieldError('platform')}</p>
            )}
          </div>

          <div>
            <Label>Descrição</Label>
            <Textarea 
              rows={5} 
              value={form.description} 
              onChange={e => setForm({ ...form, description: e.target.value })} 
              placeholder="Descreva o jogo, sua história, jogabilidade e diferenciais..." 
            />
          </div>

          <div>
            <Label>Classificação indicativa (ECA Digital — Lei 15.211/2025)</Label>
            <Select value={classificacao} onValueChange={(v: any) => setClassificacao(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CLASSIFICACOES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label} — <span className="text-muted-foreground">{c.hint}</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">Define a idade mínima para o jogo aparecer no catálogo do usuário.</p>
          </div>

          <div className="flex items-center gap-3 rounded-lg border border-border p-3">
            <Switch checked={featured} onCheckedChange={setFeatured} />
            <div>
              <Label className="cursor-pointer">Destacar na Home</Label>
              <p className="text-xs text-muted-foreground">Aparece na prateleira de destaques quando ativo.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${validationErrors.length === 0 ? 'bg-success' : 'bg-warning'}`} />
            <span className="text-sm">
              {validationErrors.length === 0 
                ? '✅ Tudo pronto para criar' 
                : `${validationErrors.length} erro(s) pendente(s)`}
            </span>
          </div>

          <Button onClick={save} disabled={saving || validationErrors.length > 0} className="w-full">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Criar jogo
          </Button>
        </CardContent>
      </Card>

      {/* GAP-D92: Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" /> Prévia do Jogo
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="border border-border rounded-lg overflow-hidden">
              {previewData.image ? (
                <img 
                  src={previewData.image} 
                  alt={previewData.title} 
                  className="w-full aspect-[16/9] object-cover" 
                  loading="lazy"
                />
              ) : (
                <div className="w-full aspect-[16/9] bg-muted flex items-center justify-center">
                  <ImageIcon className="h-12 w-12 text-muted-foreground" />
                </div>
              )}
              <div className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-lg">{previewData.title}</h3>
                    <p className="text-xs text-muted-foreground">{previewData.category} · {previewData.tipo}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {previewData.classificacao}
                  </Badge>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {previewData.platform.map(p => (
                    <Badge key={p} variant="secondary" className="text-[10px]">{p}</Badge>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground line-clamp-3">{previewData.description}</p>
                <p className="text-xl font-bold text-primary">R$ {previewData.price.toFixed(2)}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3 w-3 text-success" />
              {images.length > 0 ? `${images.length} imagem(ns)` : 'Sem imagens'}
              {' · '}
              {basics.platform.length > 0 ? `${basics.platform.length} plataforma(s)` : 'Sem plataformas'}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}