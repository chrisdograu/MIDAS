import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, Trash2, Loader2, ImagePlus, Link2, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { dbWrite } from '@/lib/dbWrite';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { cn } from '@/lib/utils';

interface Img { id: string; image_url: string; position: number; }

export default function ProductGalleryAdmin({ productId }: { productId: string }) {
  const [imgs, setImgs] = useState<Img[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [url, setUrl] = useState('');
  const [addingUrl, setAddingUrl] = useState(false);
  const [reordering, setReordering] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('produto_imagens' as any).select('*').eq('product_id', productId).order('position');
    setImgs((data as any) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [productId]);

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) { toast.error(`${file.name}: máx 5MB`); continue; }
      const ext = file.name.split('.').pop();
      const path = `gallery/${productId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('product-images').upload(path, file);
      if (error) { toast.error(error.message); continue; }
      const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(path);
      await dbWrite(supabase.from('produto_imagens' as any).insert({ product_id: productId, image_url: publicUrl, position: imgs.length }));
    }
    setUploading(false);
    if (ref.current) ref.current.value = '';
    toast.success('Imagens adicionadas!');
    load();
  };

  const del = async (id: string) => {
    const { error } = await supabase.from('produto_imagens' as any).delete().eq('id', id);
    if (error) return toast.error(error.message);
    load();
  };

  const addUrl = async () => {
    const value = url.trim();
    if (!value) return;
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('protocolo');
    } catch {
      toast.error('Informe uma URL de imagem válida (começando com https://).');
      return;
    }
    setAddingUrl(true);
    const { error } = await supabase.from('produto_imagens' as any).insert({ product_id: productId, image_url: value, position: imgs.length });
    setAddingUrl(false);
    if (error) return toast.error(error.message);
    setUrl('');
    toast.success('Imagem adicionada!');
    load();
  };

  // GAP-PG04: Reordenação via drag-and-drop
  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    
    const items = Array.from(imgs);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    // Atualizar posições
    const updated = items.map((item, index) => ({
      ...item,
      position: index,
    }));
    
    setImgs(updated);
    setReordering(true);
    
    try {
      // Atualizar no banco
      for (const item of updated) {
        await supabase
          .from('produto_imagens' as any)
          .update({ position: item.position })
          .eq('id', item.id);
      }
      toast.success('Ordem atualizada!');
    } catch {
      toast.error('Erro ao reordenar');
      load(); // Recarregar para desfazer
    } finally {
      setReordering(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium flex items-center gap-2">
          <ImagePlus className="h-4 w-4" /> Galeria adicional
          <span className="text-xs text-muted-foreground">({imgs.length})</span>
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => ref.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
            {uploading ? 'Enviando...' : 'Enviar arquivo'}
          </Button>
          <input ref={ref} type="file" accept="image/*" multiple onChange={upload} className="hidden" />
        </div>
      </div>
      
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addUrl(); } }}
            placeholder="Cole o link da imagem (https://...)"
            aria-label="URL da imagem para a galeria"
            className="pl-9"
          />
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addUrl} disabled={addingUrl || !url.trim()}>
          {addingUrl ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Adicionar link'}
        </Button>
      </div>

      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        // GAP-PG04: Drag-and-drop reorder
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="gallery" direction="horizontal">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="grid grid-cols-4 gap-2"
              >
                {imgs.map((im, index) => (
                  <Draggable key={im.id} draggableId={im.id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={cn(
                          "relative group aspect-video rounded border border-border overflow-hidden",
                          snapshot.isDragging && "opacity-50"
                        )}
                      >
                        <img src={im.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                        
                        {/* Grip handle */}
                        <div
                          {...provided.dragHandleProps}
                          className="absolute top-1 left-1 p-1 bg-overlay/50 rounded opacity-0 group-hover:opacity-100 transition cursor-grab active:cursor-grabbing"
                        >
                          <GripVertical className="h-3 w-3 text-on-media" />
                        </div>
                        
                        <button
                          type="button"
                          onClick={() => del(im.id)}
                          className="absolute top-1 right-1 bg-destructive text-destructive-foreground p-1 rounded opacity-0 group-hover:opacity-100 transition"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                        
                        <div className="absolute bottom-1 right-1 text-[10px] text-on-media/60 bg-overlay/30 px-1.5 rounded">
                          #{index + 1}
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}
      
      {!loading && imgs.length === 0 && (
        <p className="text-xs text-muted-foreground col-span-4 py-4 text-center">
          Sem imagens extras. A imagem principal já é exibida automaticamente.
        </p>
      )}
    </div>
  );
}