import { createContext } from 'react';
import { Game } from './gameData';

export interface CartItem {
  game: Game;
  quantity: number;
  bundleId?: string | null;
}

export interface CartContextType {
  items: CartItem[];
  addItem: (game: Game, opts?: { bundleId?: string | null }) => void;
  removeItem: (gameId: string) => void;
  updateQuantity: (gameId: string, quantity: number) => void;
  clearCart: () => void;
  total: number;
  itemCount: number;
}

export const CartContext = createContext<CartContextType | null>(null);
