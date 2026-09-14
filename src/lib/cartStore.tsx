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

  const addItem = useCallback((game: Game, opts?: { bundleId?: string | null }) => {
    const bundleId = opts?.bundleId ?? null;
    setItems(prev => {
      const existing = prev.find(i => i.game.id === game.id && (i.bundleId ?? null) === bundleId);
      if (existing) return prev.map(i => (i.game.id === game.id && (i.bundleId ?? null) === bundleId) ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { game, quantity: 1, bundleId }];
    });
  }, []);

  const removeItem = useCallback((gameId: string, bundleId?: string | null) => {
    setItems(prev => prev.filter(i => {
      if (i.game.id !== gameId) return true;
      if (bundleId === undefined) return false; // remove qualquer
      return (i.bundleId ?? null) !== (bundleId ?? null);
    }));
  }, []);

  const updateQuantity = useCallback((gameId: string, quantity: number, bundleId?: string | null) => {
    const matchBundle = (i: any) => bundleId === undefined || (i.bundleId ?? null) === (bundleId ?? null);
    if (quantity <= 0) {
      setItems(prev => prev.filter(i => !(i.game.id === gameId && matchBundle(i))));
    } else {
      setItems(prev => prev.map(i => (i.game.id === gameId && matchBundle(i)) ? { ...i, quantity } : i));
    }
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const total = items.reduce((sum, i) => sum + i.game.price * i.quantity, 0);
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, total, itemCount }}>
      {children}
    </CartContext.Provider>
  );
};
