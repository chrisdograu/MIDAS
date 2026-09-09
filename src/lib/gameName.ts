/**
 * Nome de jogo "limpo" a partir do título de um produto (SKU).
 *
 * Os produtos guardam o título comercial completo — com edição e plataforma
 * ("Elden Ring - Deluxe Edition (PS5)"). Nas telas onde o assunto é o JOGO
 * (fórum, avaliações, biblioteca) queremos o nome base.
 *
 * Preferência: usar o vínculo real com `games_catalog` (produtos.catalog_game_id).
 * Este helper é só o fallback para produtos ainda sem vínculo.
 */
export function baseGameName(productTitle: string | null | undefined): string {
  if (!productTitle) return 'Jogo';
  let t = productTitle;
  // remove sufixo entre parênteses no fim: "(PS5)", "(Edição Deluxe)"
  t = t.replace(/\s*\([^()]*\)\s*$/, '');
  // corta sufixos após separadores comuns: " - Deluxe Edition", " – GOTY", " : Edition"
  t = t.split(/\s+[-–—:|]\s+/)[0];
  return t.trim() || productTitle;
}

/** Nome do jogo dando prioridade ao catálogo oficial. */
export function gameDisplayName(catalogTitle?: string | null, productTitle?: string | null): string {
  return catalogTitle?.trim() || baseGameName(productTitle);
}
