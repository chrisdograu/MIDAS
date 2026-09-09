---
name: Banner de banimento global no Header
description: Barra vermelha no topo de todas as páginas web quando o usuário logado está com conta suspensa (banned_until)
type: feature
---
O Header.tsx verifica `profile.banned_until` via useAuth (que agora inclui o campo no SELECT do profiles).
Se `banned_until > now()`, exibe uma barra vermelha acima do header com ícone Ban e data de término.
O campo `banned_until` é gerenciado pela tela de Moderação no Desktop.
