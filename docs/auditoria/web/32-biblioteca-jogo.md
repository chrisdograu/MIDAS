# Web · Detalhe da Biblioteca (/biblioteca/:productId)

## Propósito
View pessoal profunda de um jogo comprado: status, playtime, custom cover, notas privadas.

## Achados P0
- `library_custom_covers` upload sem validação de MIME/tamanho.
- `user_playtime` atualizado sem debounce — realtime pode inundar writes.

## P1
- Sem export dos highlights/screenshots vinculados.

