// Product type matching the database schema
export interface Game {
  id: string;
  title: string;
  image: string;
  price: number;
  originalPrice: number;
  discount: number;
  category: string;
  platform: string[];
  rating: number;
  description: string;
  releaseDate: string;
  publisher: string;
  tags: string[];
  stock: number;
  featured?: boolean;
  createdAt?: string;
  type?: string;
  trailer_url?: string | null;
  systemRequirements?: Record<string, string> | null;
}

// Map database row to Game interface
export function mapProdutoToGame(row: {
  id: string;
  title: string;
  image_url: string | null;
  price: number;
  original_price: number;
  discount: number;
  category: string | null;
  platform: string[] | null;
  rating: number | null;
  description: string | null;
  release_date: string | null;
  publisher: string | null;
  tags: string[] | null;
  stock?: number;
  featured?: boolean | null;
}): Game {
  return {
    id: row.id,
    title: row.title,
    image: row.image_url || '/placeholder.svg',
    price: Number(row.price),
    originalPrice: Number(row.original_price),
    discount: row.discount,
    category: row.category || 'Outros',
    platform: row.platform || [],
    rating: Number(row.rating) || 0,
    description: row.description || '',
    releaseDate: row.release_date || '',
    publisher: row.publisher || '',
    tags: row.tags || [],
    stock: row.stock ?? 0,
    featured: !!row.featured,
    createdAt: (row as any).created_at || undefined,
    type: (row as any).type || undefined,
    trailer_url: (row as any).trailer_url || null,
    systemRequirements: (row as any).system_requirements || null,
  };
}

export const categories = ["Todos", "RPG", "Ação", "Aventura", "Esportes", "Corrida", "Estratégia", "Terror", "Indie"];
export const platforms = ["Todos", "PC", "PS5", "Xbox", "Switch"];
