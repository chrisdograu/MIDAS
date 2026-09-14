import { Link, useLocation } from 'react-router-dom';
import { User, Store, ShoppingBag, ChevronRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

/**
 * Barra/aba no topo do perfil para alternar entre @usuario (pessoal) e $vendedor (seller).
 * NÃO é um toggle de modo — são duas páginas diferentes. Esta barra apenas linka entre elas.
 */
export default function SellerProfileSwitcher({
  userId,
  personalHandle,
  sellerHandle,
  hasSeller,
  isOwn,
  personalAvatar,
  sellerAvatar,
  sellerAdCount,
}: {
  userId?: string;
  personalHandle?: string | null;
  sellerHandle?: string | null;
  hasSeller: boolean;
  isOwn?: boolean;
  personalAvatar?: string | null;
  sellerAvatar?: string | null;
  sellerAdCount?: number;
}) {
  const { pathname } = useLocation();
  const onSeller = pathname.startsWith('/vendedor/') || pathname.startsWith('/v/');
  const personalUrl = userId ? `/perfil/${userId}` : '/perfil';
  const sellerUrl = sellerHandle ? `/vendedor/${sellerHandle}` : null;
  // GAP-SS02: Transição
  const [transitioning, setTransitioning] = useState(false);

  const handleTransition = (to: string) => {
    setTransitioning(true);
    setTimeout(() => setTransitioning(false), 300);
    // A navegação é feita pelo Link
  };

  return (
    <div className={cn(
      "flex items-center gap-1 p-1 bg-card border border-border rounded-xl mb-6 transition-opacity duration-300",
      transitioning ? "opacity-50" : "opacity-100"
    )}>
      {/* GAP-SS01: Perfil Pessoal */}
      <Link
        to={personalUrl}
        onClick={() => handleTransition(personalUrl)}
        className={cn(
          "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300",
          !onSeller 
            ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' 
            : 'text-muted-foreground hover:bg-muted'
        )}
      >
        <div className="relative">
          {/* GAP-SS04: Avatar do perfil pessoal */}
          {personalAvatar ? (
            <img src={personalAvatar} alt="" className="w-5 h-5 rounded-full object-cover" />
          ) : (
            <User className="h-4 w-4" />
          )}
          {!onSeller && (
            <Check className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 text-primary-foreground" />
          )}
        </div>
        <span className="truncate">@{personalHandle || 'pessoal'}</span>
        {!onSeller && <span className="text-[8px] font-bold bg-primary-foreground/20 px-1 rounded">ativo</span>}
      </Link>

      {/* Separador visual */}
      <div className="w-px h-8 bg-border/60" />

      {/* GAP-SS01: Perfil Vendedor */}
      {sellerUrl ? (
        <Link
          to={sellerUrl}
          onClick={() => handleTransition(sellerUrl)}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 relative",
            onSeller 
              ? 'bg-accent text-accent-foreground shadow-lg shadow-accent/20' 
              : 'text-muted-foreground hover:bg-muted'
          )}
        >
          <div className="relative">
            {/* GAP-SS04: Avatar do vendedor */}
            {sellerAvatar ? (
              <img src={sellerAvatar} alt="" className="w-5 h-5 rounded-full object-cover" />
            ) : (
              <Store className="h-4 w-4" />
            )}
            {onSeller && (
              <Check className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 text-accent-foreground" />
            )}
          </div>
          <span className="truncate">${sellerHandle}</span>
          
          {/* GAP-SS03: Contador de anúncios */}
          {(sellerAdCount !== undefined && sellerAdCount > 0) && (
            <span className="text-[8px] font-bold bg-accent-foreground/20 px-1.5 py-0.5 rounded-full">
              {sellerAdCount} anúncio{sellerAdCount !== 1 ? 's' : ''}
            </span>
          )}
          
          {onSeller && (
            <span className="text-[8px] font-bold bg-accent-foreground/20 px-1 rounded">ativo</span>
          )}
        </Link>
      ) : isOwn ? (
        <Link
          to="/vendedor/criar"
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-accent border border-dashed border-accent/40 hover:bg-accent/10 transition group"
        >
          <Store className="h-4 w-4 group-hover:scale-110 transition" />
          Criar vendedor
          <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition" />
        </Link>
      ) : (
        <div className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs text-muted-foreground">
          <Store className="h-3.5 w-3.5 opacity-40" />
          Sem perfil vendedor
        </div>
      )}
    </div>
  );
}