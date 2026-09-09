# Web · Busca Global (/busca)

## Propósito
Search cross-entidade: jogos, usuários, anúncios, tópicos.

## Achados P0
- **N+1 crítico**: hoje faz 4+ queries paralelas por letra digitada. Consolidar em RPC `global_search(term text, limit int)` com `UNION ALL` e `pg_trgm`.
- **Sem debounce visível** — cada tecla dispara requests.
- **Ranking arbitrário** — não usa `ts_rank` nem popularidade.

## P1
- Sem histórico de busca por usuário.
- Sem realce (highlight) dos termos no resultado.

