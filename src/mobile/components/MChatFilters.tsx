import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, CheckCheck, ChevronDown, Inbox, ListChecks, MessagesSquare, MoreHorizontal, SlidersHorizontal, Star, Store, Trophy, Users, UsersRound, X } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export type ChatFilter = 'all' | 'favorites' | 'unread' | 'archived';
type ChatTab = 'amigos' | 'vendedores' | 'torneios';
const filters = [
  { id: 'all', label: 'Todos', icon: Inbox },
  { id: 'favorites', label: 'Favoritos', icon: Star },
  { id: 'unread', label: 'Não lidos', icon: MessagesSquare },
  { id: 'archived', label: 'Arquivados', icon: Archive },
] as const;
const tabs = [
  { id: 'amigos', label: 'Amigos', icon: Users, color: 'text-primary hover:text-primary', active: 'border-primary bg-primary/5 hover:bg-primary/10', badge: 'bg-primary text-primary-foreground' },
  { id: 'vendedores', label: 'Vendedores', icon: Store, color: 'text-seller hover:text-seller', active: 'border-seller bg-seller/5 hover:bg-seller/10', badge: 'bg-seller text-seller-foreground' },
  { id: 'torneios', label: 'Torneios', icon: Trophy, color: 'text-gold hover:text-gold', active: 'border-gold bg-gold/5 hover:bg-gold/10', badge: 'bg-gold text-background' },
] as const;

interface Props {
  tab: ChatTab;
  onTabChange: (tab: ChatTab) => void;
  filter: ChatFilter;
  onFilterChange: (filter: ChatFilter) => void;
  unread: Record<ChatTab, number>;
  hasUnread: boolean;
  markingAll: boolean;
  onMarkAllRead: () => void;
  selectMode: boolean;
  selectedCount: number;
  onToggleSelect: () => void;
  onArchiveSelected: () => void;
}

export default function MChatFilters(props: Props) {
  const [expanded, setExpanded] = useState(false);
  const activeFilter = filters.find(f => f.id === props.filter);
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-xl font-bold text-foreground">Chat</h1>
        <div className="flex items-center gap-1">
          <Link to="/m/grupos" className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'h-10 text-xs' })}>
            <UsersRound /> Grupos
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Ações das conversas" title="Ações das conversas"><MoreHorizontal /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={props.onToggleSelect}><ListChecks className="mr-2 h-4 w-4" />{props.selectMode ? 'Cancelar seleção' : 'Selecionar conversas'}</DropdownMenuItem>
              <DropdownMenuItem disabled={!props.hasUnread || props.markingAll} onSelect={props.onMarkAllRead}><CheckCheck className="mr-2 h-4 w-4" />{props.markingAll ? 'Marcando como lidas...' : 'Marcar todas como lidas'}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="grid grid-cols-3 border-b border-border" role="tablist" aria-label="Tipo de conversa">
        {tabs.map(t => (
          <Button key={t.id} variant="ghost" role="tab" aria-selected={props.tab === t.id} onClick={() => props.onTabChange(t.id)}
            className={cn('h-11 min-w-0 gap-1 rounded-none border-b-2 border-transparent px-1 text-xs', t.color, props.tab === t.id && t.active)}>
            <t.icon className="h-3.5 w-3.5" /><span>{t.label}</span>
            {props.unread[t.id] > 0 && <span className={cn('flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full px-1 text-[9px]', t.badge)}>{props.unread[t.id] > 99 ? '99+' : props.unread[t.id]}</span>}
          </Button>
        ))}
      </div>
      <div className="space-y-2">
        <div className="flex min-h-10 items-center justify-between gap-2">
          <Button variant="ghost" size="sm" aria-expanded={expanded} aria-controls="chat-filters" onClick={() => setExpanded(v => !v)} className="h-10 px-2 text-xs text-muted-foreground">
            <SlidersHorizontal /> Filtros <ChevronDown className={cn('transition-transform motion-reduce:transition-none', expanded && 'rotate-180')} />
          </Button>
          {props.filter !== 'all' ? (
            <Button variant="secondary" size="sm" onClick={() => props.onFilterChange('all')} aria-label={`Limpar filtro ${activeFilter?.label}`} className="h-8 min-w-0 gap-1.5 text-xs">
              {activeFilter?.label}<X />
            </Button>
          ) : <span className="text-xs text-muted-foreground">Todas as conversas</span>}
        </div>
        {expanded && (
          <div id="chat-filters" className="grid grid-cols-2 gap-2 pb-2">
            {filters.map(f => (
              <Button key={f.id} variant={props.filter === f.id ? 'secondary' : 'outline'} aria-pressed={props.filter === f.id}
                onClick={() => { props.onFilterChange(f.id); setExpanded(false); }}
                className={cn('h-11 justify-start text-xs', props.filter === f.id && 'border border-primary/30 text-primary')}>
                <f.icon />{f.label}
              </Button>
            ))}
          </div>
        )}
        {props.selectMode && (
          <div className="flex items-center justify-between gap-2 border-y border-border py-2">
            <Button variant="ghost" size="icon" onClick={props.onToggleSelect} aria-label="Cancelar seleção"><X /></Button>
            <span className="flex-1 text-xs text-muted-foreground">{props.selectedCount} selecionadas</span>
            <Button variant="secondary" size="sm" onClick={props.onArchiveSelected} disabled={props.selectedCount === 0} className="text-xs"><Archive />Arquivar</Button>
          </div>
        )}
      </div>
    </>
  );
}