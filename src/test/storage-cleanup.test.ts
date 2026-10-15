import { describe, expect, it } from 'vitest';
import { storedImagePath, unusedImages } from '@/lib/storageCleanup';

describe('limpeza de imagens armazenadas', () => {
  it('calcula apenas imagens que deixaram de ser usadas', () => {
    expect(unusedImages(['a', 'b'], ['b', 'c'])).toEqual(['a']);
  });

  it('aceita somente URLs públicas do bucket de imagens do projeto', () => {
    expect(storedImagePath('https://example.supabase.co/storage/v1/object/public/product-images/equipe/foto.webp')).toBe('equipe/foto.webp');
    expect(storedImagePath('https://externo.example/foto.webp')).toBeNull();
    expect(storedImagePath('https://example.supabase.co/storage/v1/object/public/product-images/../segredo')).toBeNull();
  });
});