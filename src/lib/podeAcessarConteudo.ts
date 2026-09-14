// Item 97: ponto central de checagem de classificação indicativa x idade da conta.
// Espelha public.pode_acessar_conteudo(user, classificacao) do banco.

export type Classificacao = 'L' | '10' | '12' | '14' | '16' | '18';

const MIN_AGE: Record<Classificacao, number> = {
  L: 0, '10': 10, '12': 12, '14': 14, '16': 16, '18': 18,
};

function calcAge(birth: string | Date): number {
  const d = new Date(birth);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

/**
 * Retorna true se a conta pode acessar/ver conteúdo com aquela classificação.
 * Sem birthDate → só conteúdo Livre. Anônimo → até 12.
 */
export function podeAcessarConteudo(
  birthDate: string | Date | null | undefined,
  classificacao: Classificacao | null | undefined,
  opts: { isAdmin?: boolean; anonymous?: boolean } = {}
): boolean {
  const c: Classificacao = (classificacao || 'L');
  if (opts.isAdmin) return true;
  if (opts.anonymous || !birthDate) {
    if (opts.anonymous) return ['L', '10', '12'].includes(c);
    return c === 'L';
  }
  return calcAge(birthDate) >= MIN_AGE[c];
}

export function ageBracket(birthDate: string | Date | null | undefined): 'crianca' | 'adolescente' | 'adulto' | 'desconhecido' {
  if (!birthDate) return 'desconhecido';
  const a = calcAge(birthDate);
  if (a < 12) return 'crianca';
  if (a < 18) return 'adolescente';
  return 'adulto';
}
