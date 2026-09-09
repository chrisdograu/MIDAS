import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Trava de regressão (Regra 1 do design system): nenhuma cor crua no app.
// Cores só podem vir de tokens semânticos (primary, success, warning, destructive,
// price, accent, muted...) ou das utilidades .text-on-media / .overlay-scrim.
const BANNED = new RegExp(
  [
    String.raw`\b(?:text|bg|border|fill|stroke|ring|shadow)-white\b`,
    String.raw`\b(?:text|bg|border|fill|stroke|ring|shadow)-black\b`,
    String.raw`\b(?:text|bg|border|fill|stroke|ring|shadow|from|to|via)-(?:red|green|yellow|blue|orange|purple|emerald|amber|sky|rose|indigo|teal|pink|lime|cyan|violet|fuchsia|slate|gray|zinc|neutral|stone)-\d{2,3}\b`,
    String.raw`\b(?:text|bg|border)-\[#[0-9a-fA-F]{3,8}\]`,
  ].join('|'),
);

// shadcn/ui é biblioteca de terceiros e já usa tokens; ignorado na varredura.
const IGNORED_DIRS = ['components/ui', 'test'];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (IGNORED_DIRS.some((d) => full.replace(/\\/g, '/').includes(`src/${d}`))) continue;
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx$/.test(entry)) out.push(full);
  }
  return out;
}

describe('design system — cores semânticas', () => {
  it('não usa cores hardcoded do Tailwind em nenhuma tela', () => {
    const offenders: string[] = [];
    for (const file of walk('src')) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          const match = line.match(BANNED);
          if (match) offenders.push(`${file}:${i + 1} → ${match[0]}`);
        });
    }
    expect(offenders, `Use tokens semânticos:\n${offenders.join('\n')}`).toEqual([]);
  });
});
