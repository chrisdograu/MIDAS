# Checklist de Design — auditoria por tela

Referência: `docs/design/DESIGN-SYSTEM.md`. Cada tela auditada recebe uma seção
"Auditoria de design/estado" no seu arquivo em `docs/auditoria/<área>/`.

## Como pontuar

Cada regra recebe: OK · PARCIAL · FALHA · N/A. Ao lado, o motivo em uma linha
e o arquivo/linha do achado.

| # | Regra | O que checar |
|---|---|---|
| 1 | Cor tem significado fixo | Nenhuma classe crua (`text-green-400`, `bg-red-500`, `text-white`, `bg-[#...]`). Papel resolvido via `src/lib/semanticTone.ts` (`toneText`, `toneBadge`, `toneForPending`) |
| 2 | Hierarquia por tamanho/posição | Métrica mais importante primeiro e maior (Tier 1 `text-3xl` → Tier 4 `text-sm`) |
| 3 | Densidade | Navegação/listas com mais de ~8 itens têm agrupamento colapsável; página com >8-10 blocos agrupa por prioridade |
| 4 | Estado vazio | Usa `EstadoVazio` (ícone + explicação + ação quando faz sentido). Erro usa `ErroCarregamento` |
| 5 | Ativo/selecionado | `.glow-primary` / `.glow-accent`, nunca só `bg-primary/10` |
| 6 | Espaçamento | `gap-1/2` intra-grupo, `gap-3` no card, `gap-4/6` entre seções, página `p-4`–`p-6` |
| 7 | Tipografia | Escala fixa; `font-bold` só em título e métrica de destaque |
| 8 | Estados interativos | `hover:`, `focus:ring-2 focus:ring-primary`, `active:scale-95`, disabled `opacity-40 cursor-not-allowed` |

## Além do design, cada tela responde

- **Funciona?** carrega, grava, filtra, respeita permissão/RLS.
- **Falta algo?** campo do schema nunca preenchido, ação existente na web e ausente no mobile (ou vice-versa), estado de erro sem tratamento.
- **Está estranho?** cor sem significado, hierarquia invertida, densidade, quebra responsiva.

## Exceção justificada

Se uma regra atrapalhar numa tela específica, registrar comentário no código
daquela tela explicando o motivo (exigência do próprio documento) e anotar aqui:

| Tela | Regra | Motivo |
|---|---|---|
| — | — | — |
