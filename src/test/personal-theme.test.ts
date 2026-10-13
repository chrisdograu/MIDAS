import { afterEach, describe, expect, it } from 'vitest';
import { applyPersonalTheme, complementaryThemeColors, hexToHsl } from '@/lib/personalTheme';

afterEach(() => applyPersonalTheme(null));

describe('Tema pessoal', () => {
  it('restaura também a cor do texto dos botões', () => {
    applyPersonalTheme({ accent: '#FFFFFF' });
    expect(document.documentElement.style.getPropertyValue('--primary-foreground')).not.toBe('');
    applyPersonalTheme(null);
    for (const token of ['--primary', '--ring', '--primary-foreground']) {
      expect(document.documentElement.style.getPropertyValue(token)).toBe('');
    }
  });
  it('gera sugestões em hexadecimal que podem ser aplicadas e salvas', () => {
    const colors = complementaryThemeColors('#3B82F6');
    expect(colors).toHaveLength(3);
    for (const color of colors) {
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(hexToHsl(color)).not.toBe('');
    }
    expect(complementaryThemeColors('hsl(10, 20%, 30%)')).toEqual([]);
  });
});