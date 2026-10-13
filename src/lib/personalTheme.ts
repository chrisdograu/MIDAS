// Rodada 18 — tema pessoal aplicado via tokens do design system.
// Nunca escrevemos cor direto em componente: só sobrescrevemos as variáveis
// CSS (--primary / --ring / --accent) no :root, então dark mode e shadcn
// continuam funcionando normalmente.
export type PersonalTheme = { accent?: string };

const HEX = /^#[0-9a-fA-F]{6}$/;

export function complementaryThemeColors(hex: string): string[] {
  if (!HEX.test(hex)) return [];
  const rgb = hexToRgb(hex);
  const encode = (values: number[]) => `#${values.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
  return [hex, encode(rgb.map(v => 255 - v)), encode(rgb.map(v => v + (255 - v) * 0.25))];
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Retorna "H S% L%" no formato aceito pelas variáveis do Tailwind/shadcn. */
export function hexToHsl(hex: string): string {
  if (!HEX.test(hex)) return '';
  const [r0, g0, b0] = hexToRgb(hex).map(v => v / 255) as [number, number, number];
  const max = Math.max(r0, g0, b0);
  const min = Math.min(r0, g0, b0);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r0) h = ((g0 - b0) / d + (g0 < b0 ? 6 : 0));
    else if (max === g0) h = (b0 - r0) / d + 2;
    else h = (r0 - g0) / d + 4;
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function luminance(hex: string): number {
  const srgb = hexToRgb(hex).map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

/** Razão de contraste WCAG entre duas cores hex. */
export function contrastRatio(a: string, b: string): number {
  if (!HEX.test(a) || !HEX.test(b)) return 21;
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export function applyPersonalTheme(theme: PersonalTheme | null | undefined) {
  const root = document.documentElement;
  const accent = theme?.accent;
  if (!accent || !HEX.test(accent)) {
    root.style.removeProperty('--primary');
    root.style.removeProperty('--ring');
    root.style.removeProperty('--primary-foreground');
    return;
  }
  const hsl = hexToHsl(accent);
  root.style.setProperty('--primary', hsl);
  root.style.setProperty('--ring', hsl);
  // texto do botão primário segue o lado de maior contraste
  const usarEscuro = contrastRatio(accent, '#0B0F14') >= contrastRatio(accent, '#FFFFFF');
  root.style.setProperty('--primary-foreground', usarEscuro ? '222 47% 6%' : '0 0% 100%');
}
