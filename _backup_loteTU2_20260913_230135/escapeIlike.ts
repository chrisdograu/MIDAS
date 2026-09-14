// Sanitiza um termo antes de usar em `.ilike()` ou `.or(...ilike...)` do PostgREST.
// - Escapa curingas `%` e `_` e a barra `\`.
// - Remove `,` e parênteses, que quebram o parser do `.or(...)`.
// Use como: .ilike('col', `%${escapeIlikeTerm(term)}%`)
export function escapeIlikeTerm(s: string): string {
  if (!s) return '';
  return s
    .replace(/[\\%_]/g, (m) => '\\' + m)
    .replace(/,/g, ' ')
    .replace(/[()]/g, '');
}
