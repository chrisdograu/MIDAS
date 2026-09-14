import { useState, useCallback, FC, ReactNode, useEffect } from 'react';
import { CartContext, CartItem } from '@/lib/cartContext';
import { Game } from '@/lib/gameData';

const CART_STORAGE_KEY = 'midias-cart-v1';

export const CartProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore persistence failures
    }
  }, [items]);

  const addItem = useCallback((game: Game, opts?: { bundleId?: string | null; bundleTitle?: string | null; bundlePrice?: number | null; bundleImage?: string | null }) => {
    const bundleId = opts?.bundleId ?? null;
    setItems(prev => {
      const existing = prev.find(i => i.game.id === game.id && (i.bundleId ?? null) === bundleId);
      if (existing) return prev.map(i => (i.game.id === game.id && (i.bundleId ?? null) === bundleId) ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { game, quantity: 1, bundleId, bundleTitle: opts?.bundleTitle ?? null, bundlePrice: opts?.bundlePrice ?? null, bundleImage: opts?.bundleImage ?? null }];
    });
  }, []);

  const removeItem = useCallback((gameId: string, bundleId?: string | null) => {
    setItems(prev => bundleId
      ? prev.filter(i => i.bundleId !== bundleId)
      : prev.filter(i => i.game.id !== gameId));
  }, []);

  const updateQuantity = useCallback((gameId: string, quantity: number, bundleId?: string | null) => {
    if (quantity <= 0) {
      setItems(prev => bundleId ? prev.filter(i => i.bundleId !== bundleId) : prev.filter(i => i.game.id !== gameId));
    } else {
      setItems(prev => prev.map(i => bundleId ? (i.bundleId === bundleId ? { ...i, quantity } : i) : (i.game.id === gameId ? { ...i, quantity } : i)));
    }
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const seenBundles = new Set<string>();
  const total = items.reduce((sum, i) => {
    if (!i.bundleId) return sum + i.game.price * i.quantity;
    if (seenBundles.has(i.bundleId)) return sum;
    seenBundles.add(i.bundleId);
    const bundleItems = items.filter(x => x.bundleId === i.bundleId);
    const fallbackPrice = bundleItems.reduce((value, x) => value + x.game.price, 0);
    return sum + (i.bundlePrice ?? fallbackPrice) * i.quantity;
  }, 0);
  const countedBundles = new Set<string>();
  const itemCount = items.reduce((sum, i) => {
    if (!i.bundleId) return sum + i.quantity;
    if (countedBundles.has(i.bundleId)) return sum;
    countedBundles.add(i.bundleId);
    return sum + i.quantity;
  }, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, total, itemCount }}>
      {children}
    </CartContext.Provider>
  );
};
