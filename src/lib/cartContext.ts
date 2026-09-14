import { createContext } from 'react';
import { Game } from './gameData';

export interface CartItem {
  game: Game;
  quantity: number;
  bundleId?: string | null;
  bundleTitle?: string | null;
  bundlePrice?: number | null;
  bundleImage?: string | null;
}

export interface CartContextType {
  items: CartItem[];
  addItem: (game: Game, opts?: { bundleId?: string | null; bundleTitle?: string | null; bundlePrice?: number | null; bundleImage?: string | null }) => void;
  removeItem: (gameId: string, bundleId?: string | null) => void;
  updateQuantity: (gameId: string, quantity: number, bundleId?: string | null) => void;
  clearCart: () => void;
  total: number;
  itemCount: number;
}

export const CartContext = createContext<CartContextType | null>(null);
