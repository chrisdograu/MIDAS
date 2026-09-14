# Auditoria MIDIAS — Índice

## Web (público + autenticado + transversal)

1.  Home · 02. Catálogo · 03. Ofertas · 04. Em Alta · 05. Para Você
2.  Game Detail · 07. Bundles · 08. Torneios (hub)
3.  Perfil · 10. Biblioteca · 11. Carrinho · 12. Checkout · 13. Pedidos · 14. Favoritos · 15. Social
4.  Auth · 17. Reset Password · 18. FAQ · 19. Contato · 20. Termos
5.  Busca Global · 22. Oportunidades · 23. Public Profile · 24. Friend Profile
6.  Seller Profile · 26. Criar Vendedor · 27. Vendedor Config · 28. Privacidade
7.  Game Social Hub · 30. Review Completa Editor · 31. Timeline Gamer
8.  Biblioteca Jogo · 33. Opinions Conversations · 34. Opinion Conversation
9.  Checkout Sucesso · 36. Tutoriais · 37. Tutorial · 38. Fórum Geral (legado)
10. Social (legado) · 40. NotFound · 41. Tournament Event · 42. Tournament Match · 43. Tournament Group

## Mobile (Capacitor) (documentado via schema compartilhado + páginas React /m espelho)

1.  Auth · 02. Home · 03. Marketplace · 04. Fórum · 05. Chat
2.  Perfil/Config · 07. Favoritos/Amigos · 08. Torneios/Tutoriais
3.  Novo Anúncio · 10. Item Marketplace · 11. Fórum Jogo · 12. Post
4.  Fórum Comunidade · 14. Review · 15. Grupos · 16. Novo Grupo
5.  Chat Grupo · 18. Info Grupo · 19. Info Chat · 20. Bloqueados · 21. NotFound

## Desktop Admin (temáticos 01-10 + páginas individuais 11-56)

Temáticos: Dashboard/Analytics · Catálogo · Estoque · Pedidos · Marketplace · Moderação · Torneios · Recompensas · Comunicação · Config
Páginas: uma por arquivo em `src/desktop/pages/`

## Apêndices

- A · C4 (Context + Container)
- B · ADRs (8 decisões formais + template)
- C · ERD completo por domínio

## Convenções

Ver `_template.md`, `_glossario.md`, `_fluxos-globais.md`.

2. Front-end — trocar tabela por view
   profiles → public_profiles_view (leitura de OUTROS usuários)
   Leitura do próprio perfil continua em profiles (tem policy id = auth.uid()). Só o que lê terceiros muda.

Antes:

js
supabase.from('profiles').select('username, avatar_url').eq('id', id)
Agora:

js
supabase.from('public_profiles_view').select('username, avatar_url').eq('id', id)
Regra prática: em qualquer lugar que você passa um user_id que não é o logado, usa a view.

Onde isso aparece no seu app:

Página de produto → card do vendedor

Review → autor

Fórum → quem postou/respondeu

Comentários

Lista de seguidores/seguindo

Participantes de torneio

Chat → cabeçalho da conversa

Menções (@user)

Denúncia → mostrar quem foi denunciado

site_settings → public_site_settings
Antes:

js
supabase.from('site_settings').select('\*')
Agora:

js
supabase.from('public_site_settings').select('\*')
Painel admin continua lendo site_settings direto (tem is_staff()).

3. Front-end — features que podem quebrar
   3.1 Stats de perfil de terceiros
   Essas 7 tabelas agora respeitam privacidade:

user_xp_log, user_playtime, user_achievements

user_badges, user_titles, user_follows, profile_highlights

Como funciona agora (can_view_scope):

sql
owner = viewer
OR viewer IN profiles.privacy_exceptions
OR privacy_grants tem (owner_id, viewer_id, scope IN ('stats','full'))
Ou seja: só vê se:

É o próprio dono, ou

O dono adicionou você em privacy_exceptions, ou

O dono criou um privacy_grant com scope 'stats' ou 'full'

⚠️ Ação no app: se sua UI tem botão "ver minha privacidade" ou uma tela de gerenciamento, precisa permitir criar privacy_grants com scope = 'stats'. Sem isso, só o próprio dono vê.

Se o app não faz isso hoje, as stats de terceiros desaparecem. Ou você:

(a) aceita e informa o usuário, ou

(b) cria a UI de grants

3.2 rate_limits
Saiu da API. Se o front mostrava "tentativas restantes", quebrou. Ou remove o display, ou passa por edge function.

3.3 Botão "denunciar mensagem" (trigger novo)
Se o receptor de uma mensagem faz UPDATE em qualquer campo além de is_read, dispara:

text
ERROR: Receiver pode apenas marcar is_read
Cenário comum que quebra:

js
// receptor quer flagrar
await supabase.from('mensagens')
.update({ flagged_auto: true }).eq('id', msgId)
Fix: mover pra RPC SECURITY DEFINER, ou restringir a UI pra não permitir isso.

3.4 config_history / admin_notifications via front
INSERT agora é só service_role. Se o admin tinha um botão que inseria direto → migrar pra edge function.

4. Backend / Edge Functions
   4.1 Usar anonimizar_usuario(uuid) pra LGPD
   Em vez de DELETE FROM profiles, chame:

ts
await supabase.rpc('anonimizar_usuario', { target_id: userId });
Ela limpa PII, apaga tokens, bloqueia login — sem quebrar histórico de fórum, reviews, pedidos.

4.2 Seeds / testes
131 FKs agora validadas. Se algum seed/fixture/teste E2E grava UUID fake (00000000-... ou test-user-1), vai falhar.

Ação: gere UUIDs reais ou insira o profile/produto/etc antes.

4.3 is_staff() expandiu
Moderador, marketplace staff e estoquista agora veem tudo que is_staff() libera: todas avaliações, todas denúncias, todos produtos, todos grupos, todas notificações.

Confirme que é isso mesmo que esses cargos devem ver. Se não:

sql
-- Exemplo: só admin e atendimento veem movimentações de estoque
DROP POLICY "Staff vê movimentações de estoque" ON movimentacoes_estoque;
CREATE POLICY "estoque vê movimentações" ON movimentacoes_estoque
FOR SELECT TO authenticated
USING (is_operacao_estoque() OR is_admin()); 5. Testes manuais (fazer um por um)
Perfil / social
□ Abrir próprio perfil → vê tudo (via profiles)
□ Abrir perfil de outro usuário → vê nome/avatar/bio (via view)
□ Perfil de outro com XP/badges → vê stats? (depende de grants)
□ Lista de seguidores de outro usuário
□ Ver conquistas / títulos de outro
Conteúdo
□ Criar review → funciona
□ Editar própria review → funciona
□ Tentar editar review de outro → deve falhar
□ Criar post no fórum
□ Ver post de outro no fórum
Mensagens
□ Enviar mensagem (sender funciona)
□ Marcar como lida (receiver funciona)
□ Tentar editar conteúdo recebido → deve falhar (novo trigger)
□ Botão "denunciar mensagem" → testar se quebrou com o trigger
Produto / compra
□ Listar produtos
□ Ver produto individual
□ Ver card do vendedor (usar view)
□ Adicionar ao carrinho
□ Finalizar pedido (testa FK)
□ Ver pedidos
□ Aplicar cupom
Marketplace / troca
□ Criar anúncio
□ Enviar proposta de troca
□ Aceitar/rejeitar proposta
Torneio
□ Inscrever-se
□ Ver partidas
□ Chat do torneio
□ Ver participantes
Admin
□ Login como admin
□ Ver denúncias
□ Ver produtos
□ Ver configurações do site (site_settings direto)
□ Ver logs de admin
□ Ver curated_lists privadas (fix 2)
□ Ver movimentações de estoque (se for admin/estoque)
□ Notificação admin (testa se ainda cria)
Público (deslogado)
□ Ver produtos sem login
□ Ver site_settings públicos via public_site_settings
□ Ver conteúdo 18+ sem login → deve bloquear (age gate)
□ Ver perfil público via public_profiles_view 6. Coisas pra documentar/guardar
Audit SQL — rodar antes de cada deploy
Salva em scripts/audit.sql:

sql
-- 1) RLS perigosa (USING true em tabela que não deveria)
SELECT tablename, policyname FROM pg_policies
WHERE schemaname='public' AND (qual='true' OR with_check='true')
AND tablename NOT IN ('badge_catalog','categorias','developers',
'forum_categories','games_catalog','publishers','xp_levels','team_members');

-- 2) FKs não validadas
SELECT conname, conrelid::regclass FROM pg_constraint
WHERE contype='f' AND convalidated=false AND connamespace='public'::regnamespace;

-- 3) RLS sem policy (tabelas silenciosamente inacessíveis)
SELECT t.tablename FROM pg_tables t
LEFT JOIN pg_policies p ON p.tablename=t.tablename AND p.schemaname=t.schemaname
WHERE t.schemaname='public' AND t.rowsecurity=true AND p.policyname IS NULL;
As 3 devem voltar 0 linhas. Se aparecer algo → você introduziu buraco novo.

Regras do projeto (colar no README/CONTRIBUTING)
Toda nova coluna \_id cria FK na mesma migration

Toda view em public com security_invoker = true (exceto views públicas com allowlist de coluna, tipo public_profiles_view)

USING (true) em policy só se for dado realmente público

Dado sensível (CPF, telefone, menor) → RLS estrito + anonimização, nunca DELETE real

site_settings → novas chaves só entram na view public_site_settings se forem públicas

Hierarquia de roles (documentar)
text
admin_pleno (role='admin' + position='admin'/null)
└── direcao (position in 'admin','gerente')
├── atendimento (position='atendente')
├── moderador (position='moderador')
├── marketplace (position='atendente_marketplace')
└── estoque (position='estoquista')

is_admin() = role='admin' (qualquer position)
is_atendente() = role='atendente'
is_staff() = todos acima 7. Ordem recomendada pra executar
Dia 1 — SQL crítico

Rodar os 2 fixes (view + curated_lists)

Testar página de perfil de outro usuário

Dia 2 — Front

Trocar profiles → public_profiles_view em leitura de terceiros

Trocar site_settings → public_site_settings

Remover UI de rate_limits

Dia 3 — Testes

Rodar o checklist do item 5

Anotar o que quebrou

Ajustar o que precisar

Dia 4 — Edge functions

Migrar INSERT de config_history/admin_notifications pra service_role

Se aplicável: criar UI de privacy_grants com scope 'stats'

Testar anonimizar_usuario

Contínuo

audit.sql no CI antes de deploy

Documentar as regras do item 6

Resumo do resumo
SQL agora: 2 fixes (view + curated_lists)
Front: trocar profiles → public_profiles_view, site_settings → public_site_settings, remover rate_limits
Backend: usar anonimizar_usuario em vez de DELETE, migrar inserts admin pra edge function
Testes: checklist do item 5
Docs: salvar audit.sql, documentar hierarquia de roles e regras de migration

Se quiser, eu transformo isso num MIGRATION_NOTES.md pronto pra commitar. Só pedir.
