import { Link } from 'react-router-dom';
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { parseMentionParts } from '@/mobile/lib/mentions';
import { escapeIlikeTerm } from '@/lib/escapeIlike';
import { cn } from '@/lib/utils';
import { Loader2, AtSign, DollarSign } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// GAP-MC02: Tooltip com preview do usuário
interface UserPreview {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  username?: string | null;
  handle?: string;
}

function UserTooltip({ 
  user, 
  type, 
  children 
}: { 
  user: UserPreview; 
  type: 'personal' | 'seller';
  children: React.ReactNode;
}) {
  const label = type === 'personal' ? 'Perfil pessoal' : 'Perfil de vendedor';
  const icon = type === 'personal' ? AtSign : DollarSign;
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent side="top" className="p-2 max-w-xs">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent overflow-hidden flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="" className="w-full h-full object-cover" loading="lazy" />
              ) : (
                (user.display_name || '?')[0].toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {user.display_name || 'Usuário'}
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                {icon({ className: 'h-3 w-3' })}
                {user.handle || user.username || 'usuário'}
                <span className="text-[10px] bg-secondary px-1.5 rounded-full">{label}</span>
              </p>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface MentionCardProps {
  text: string;
  className?: string;
  /** GAP-MC01: Mostrar skeleton durante carregamento */
  showLoading?: boolean;
  /** GAP-MC04: Renderizar emojis */
  renderEmojis?: boolean;
}

/**
 * Web mention renderer — suporta @usuario e $vendedor com cartões distintos.
 */
export function MentionCard({ 
  text, 
  className, 
  showLoading = true,
  renderEmojis = true,
}: MentionCardProps) {
  const parts = useMemo(() => parseMentionParts(text), [text]);
  const personalHandles = parts.filter(p => p.kind === 'mention' && p.mentionKind === 'personal').map(p => (p as any).handle.toLowerCase());
  const sellerHandles = parts.filter(p => p.kind === 'mention' && p.mentionKind === 'seller').map(p => (p as any).handle.toLowerCase());
  
  const [pmap, setPmap] = useState<Record<string, UserPreview>>({});
  const [smap, setSmap] = useState<Record<string, UserPreview>>({});
  const [loading, setLoading] = useState(true);

  // GAP-MC01: Estado de loading
  useEffect(() => {
    let cancel = false;
    setLoading(true);
    
    (async () => {
      if (personalHandles.length) {
        const { data } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url, username')
          .or(personalHandles.map(h => `display_name.ilike.${escapeIlikeTerm(h)}`).join(','))
          .limit(50);
        if (!cancel && data) { 
          const m: Record<string, UserPreview> = {}; 
          data.forEach(p => { 
            m[(p.display_name || '').toLowerCase()] = { 
              id: p.id, 
              display_name: p.display_name, 
              avatar_url: p.avatar_url,
              username: p.username,
            }; 
          }); 
          setPmap(m); 
        }
      }
      
      if (sellerHandles.length) {
        const { data } = await supabase
          .from('seller_profiles' as any)
          .select('handle, display_name, avatar_url')
          .in('handle', sellerHandles)
          .limit(50);
        if (!cancel && data) { 
          const m: Record<string, UserPreview> = {}; 
          (data as any[]).forEach(p => { 
            m[(p.handle || '').toLowerCase()] = { 
              id: p.handle, 
              display_name: p.display_name, 
              avatar_url: p.avatar_url,
              handle: p.handle,
            }; 
          }); 
          setSmap(m); 
        }
      }
      
      if (!cancel) setLoading(false);
    })();
    
    return () => { cancel = true; };
  }, [personalHandles.join(','), sellerHandles.join(',')]);

  // GAP-MC04: Renderização de emojis
  const renderEmoji = (text: string) => {
    if (!renderEmojis) return text;
    // Suporte básico a emojis via Unicode
    const emojiRegex = /[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27BF}]|[\u{FE00}-\u{FEFF}]/gu;
    return text.split(emojiRegex).map((part, i) => {
      const match = text.match(emojiRegex)?.[i];
      return (
        <span key={i}>
          {part}
          {match && <span className="inline-block">{match}</span>}
        </span>
      );
    });
  };

  // GAP-MC01: Estado de loading
  if (loading && showLoading) {
    return (
      <span className={cn("inline-flex items-center gap-1", className)}>
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        <span className="text-muted-foreground">Carregando menções...</span>
      </span>
    );
  }

  return (
    <span className={cn("break-words", className)}>
      {parts.map((p, i) => {
        if (p.kind === 'text') {
          return <span key={i}>{renderEmoji(p.value)}</span>;
        }
        
        if (p.mentionKind === 'seller') {
          const s = smap[p.handle.toLowerCase()];
          if (!s) {
            return (
              <span key={i} className="text-accent font-medium">
                ${p.handle}
              </span>
            );
          }
          
          const link = (
            <Link 
              key={i} 
              to={`/vendedor/${s.handle}`}
              className="inline-flex items-center gap-1.5 px-1.5 py-0.5 mx-0.5 rounded-md bg-accent/15 text-accent text-sm font-semibold hover:bg-accent/25 transition-colors align-baseline"
            >
              {s.avatar_url && (
                <img 
                  src={s.avatar_url} 
                  alt="" 
                  className="w-4 h-4 rounded-full object-cover"
                  loading="lazy" 
                />
              )}
              ${s.handle}
            </Link>
          );
          
          // GAP-MC02: Tooltip
          return (
            <UserTooltip key={i} user={s} type="seller">
              {link}
            </UserTooltip>
          );
        }
        
        const prof = pmap[p.handle.toLowerCase()];
        if (!prof) {
          return (
            <span key={i} className="text-primary font-medium">
              @{p.handle}
            </span>
          );
        }
        
        const link = (
          <Link 
            key={i} 
            to={`/perfil/${prof.id}`}
            className="inline-flex items-center gap-1.5 px-1.5 py-0.5 mx-0.5 rounded-md bg-primary/15 text-primary text-sm font-semibold hover:bg-primary/25 transition-colors align-baseline"
          >
            {prof.avatar_url && (
              <img 
                src={prof.avatar_url} 
                alt="" 
                className="w-4 h-4 rounded-full object-cover"
                loading="lazy" 
              />
            )}
            @{prof.display_name || prof.username || p.handle}
          </Link>
        );
        
        return (
          <UserTooltip key={i} user={prof} type="personal">
            {link}
          </UserTooltip>
        );
      })}
    </span>
  );
}

export default MentionCard;

// GAP-MC01: Skeleton para menções
export function MentionCardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-muted h-5 w-20" />
      ))}
    </span>
  );
}