import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Clock, Star, MessageSquare, Camera, Trophy, Calendar, Trash2, Undo, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDate, formatRelativeTime } from '@/lib/format';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

type EventType = 'all' | 'status' | 'review' | 'opinion' | 'screenshot' | 'platinum' | 'game_diary';

interface TimelineEvent {
  id: string;
  type: EventType;
  title: string;
  description?: string;
  product_id?: string;
  product_title?: string;
  product_image?: string;
  created_at: string;
  metadata?: any;
}

interface GameTimelineProps {
  userId: string;
  filter?: EventType;
  deletedEvents?: Set<string>;
  onDeleteEvent?: (eventId: string, eventType: string) => void;
  onRestoreEvent?: (eventId: string, eventType: string) => void;
  isRecentEvent?: (date: string) => boolean;
}

const ITEMS_PER_PAGE = 15;

export default function GameTimeline({ 
  userId, 
  filter = 'all',
  deletedEvents = new Set(),
  onDeleteEvent,
  onRestoreEvent,
  isRecentEvent = () => false,
}: GameTimelineProps) {
  const { user } = useAuth();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const isOwn = user?.id === userId;

  // GAP-637: Carregar eventos com paginação
  const loadEvents = async (reset: boolean = false) => {
    const currentPage = reset ? 0 : page;
    const offset = currentPage * ITEMS_PER_PAGE;
    
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      // Buscar eventos da timeline (exemplo — adaptar para sua estrutura real)
      const { data, error } = await supabase
        .from('game_timeline_events' as any)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + ITEMS_PER_PAGE - 1);

      if (error) throw error;

      const newEvents = (data || []) as TimelineEvent[];
      
      // GAP-638: Aplicar filtro por tipo
      let filteredEvents = newEvents;
      if (filter !== 'all') {
        filteredEvents = newEvents.filter(e => e.type === filter);
      }

      // Remover eventos excluídos (GAP-639)
      filteredEvents = filteredEvents.filter(e => {
        const key = `${e.type}-${e.id}`;
        return !deletedEvents.has(key);
      });

      if (reset) {
        setEvents(filteredEvents);
      } else {
        setEvents(prev => [...prev, ...filteredEvents]);
      }

      setHasMore(newEvents.length >= ITEMS_PER_PAGE);
      setPage(currentPage + 1);
    } catch (error) {
      console.error('Erro ao carregar timeline:', error);
      toast.error('Erro ao carregar timeline');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Recarregar quando filtro ou eventos excluídos mudarem
  useEffect(() => {
    loadEvents(true);
  }, [userId, filter, deletedEvents]);

  // GAP-637: Carregar mais
  const loadMore = () => {
    if (!loadingMore && hasMore) {
      loadEvents(false);
    }
  };

  // GAP-639: Excluir evento
  const handleDelete = (event: TimelineEvent) => {
    if (!isOwn) {
      toast.error('Você só pode excluir seus próprios eventos');
      return;
    }
    if (onDeleteEvent) {
      onDeleteEvent(event.id, event.type);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
        <Clock className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
        <p className="text-sm font-medium text-foreground">Nenhum evento na timeline ainda</p>
        <p className="text-xs mt-1">Suas conquistas, reviews e marcos aparecerão aqui.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <AnimatePresence>
        {events.map((event, index) => {
          const isRecent = isRecentEvent(event.created_at);
          const eventKey = `${event.type}-${event.id}`;
          const isDeleted = deletedEvents.has(eventKey);
          
          if (isDeleted) return null;

          return (
            <motion.div
              key={eventKey}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`bg-card border border-border rounded-xl p-4 ${
                isRecent ? 'ring-1 ring-primary/30' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 text-primary">
                  {event.type === 'status' && <Clock className="h-5 w-5" />}
                  {event.type === 'review' && <Star className="h-5 w-5 text-warning" />}
                  {event.type === 'opinion' && <MessageSquare className="h-5 w-5 text-accent" />}
                  {event.type === 'screenshot' && <Camera className="h-5 w-5 text-primary" />}
                  {event.type === 'platinum' && <Trophy className="h-5 w-5 text-price" />}
                  {event.type === 'game_diary' && <Calendar className="h-5 w-5 text-accent" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">{event.title}</span>
                    {/* GAP-641: Badge de evento recente */}
                    {isRecent && (
                      <span className="text-[10px] font-semibold bg-primary/15 text-primary px-1.5 py-0.5 rounded-full animate-pulse">
                        NOVO
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(event.created_at)}
                    </span>
                  </div>
                  {event.description && (
                    <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                  )}
                  {event.product_title && (
                    <Link 
                      to={`/jogo/${event.product_id}`} 
                      className="text-xs text-primary hover:underline mt-1 inline-block"
                    >
                      Ver jogo →
                    </Link>
                  )}
                </div>
                {/* GAP-639: Ações do evento (apenas para o próprio usuário) */}
                {isOwn && (
                  <div className="flex items-center gap-1 shrink-0">
                    {onRestoreEvent && deletedEvents.has(eventKey) && (
                      <button
                        onClick={() => onRestoreEvent(event.id, event.type)}
                        className="p-1 rounded hover:bg-secondary transition-colors"
                        title="Restaurar evento"
                      >
                        <Undo className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                      </button>
                    )}
                    {!deletedEvents.has(eventKey) && (
                      <button
                        onClick={() => handleDelete(event)}
                        className="p-1 rounded hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                        title="Ocultar evento"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* GAP-637: Botão "Carregar mais" */}
      {hasMore && (
        <div className="text-center pt-2">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="px-4 py-2 rounded-lg border border-border bg-card text-sm font-medium hover:border-primary/40 transition-colors disabled:opacity-50"
          >
            {loadingMore ? (
              <><Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Carregando...</>
            ) : (
              'Carregar mais eventos'
            )}
          </button>
        </div>
      )}
    </div>
  );
}