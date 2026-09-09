# Mobile · 01 · Autenticação (`/m/auth`)

> Arquivo real: `src/mobile/pages/MAuth.tsx` · Rota: `/m/auth` (fora do `MobileLayout`, sem bottom-nav).

## 1. Objetivo
Portal de entrada do PWA mobile. Precisa converter visitante em usuário logado no menor número de toques possíveis, mantendo paridade visual com a Auth Web (memória `auth-design-parity`).

## 2. Filosofia
No mobile o usuário chega **em movimento** (rede instável, tela pequena, uma mão). Login/cadastro precisam ser **um único fluxo**, sem trocar de tela. O social login é primeiro-cidadão, não fallback.

## 3. Usuários-alvo
| Perfil | O que vê |
|---|---|
| Visitante primeiro contato | Hero curto + botão Google + tabs Login/Cadastro |
| Usuário retornante logado | Redirect automático para `/m` (guardar via `useAuth`) |
| Vendedor mobile | Idêntico ao usuário — separação só existe no Perfil |
| Banido | Ao logar, ver banner de banimento (memória `banimento-header-global`) e sair para tela readonly |

## 4. Estrutura visual
```
[Logo MIDIAS gradiente]
[Tab: Entrar | Cadastrar]
[Campo email (ícone)]
[Campo senha (ícone + eye)]
[Botão primário]
[divisor "ou"]
[Google (branded)]
[link "Esqueci senha"]
```

## 5. Componentes
- **Tabs Login/Cadastro** — estado local, sem rota separada
- **Inputs com ícone** — paridade com Web (memória)
- **Google button** — dispara `signInWithOAuth({provider:'google', redirectTo: origin + '/m'})`
- **Toast de erro** — mensagens PT-BR humanizadas (não "invalid_grant")

## 6-8. Fluxos
Entrada: deep-links de push, click em rota protegida (`ProtectedRoute` redireciona pra cá), banner "criar conta" no MHome.
Saída: `/m` (default), ou `redirectTo` da query (voltar pra rota que originou).
Conversa com: **Perfil** (primeiro login cria row em `profiles` via trigger), **Notificações** (registra `device_tokens` no primeiro login mobile).

## 9. Regras de negócio
- Senha ≥ 8, exige número + letra
- Email verificação: **desligado** por padrão em TCC (memória de simulação). Reabilitar em produção.
- Não permitir signup anônimo
- Rate-limit client-side: 3 tentativas → cooldown 30s

## 10. Estados
Loading (spinner no botão, inputs desabilitados), erro (toast + shake do form), offline (banner "sem conexão"), já-logado (redirect imediato, sem flash da tela).

## 11. Permissões
Pública. Se logado + banido → mostra apenas mensagem de banimento e botão logout.

## 12-14. Dados / APIs
- `supabase.auth.signInWithPassword`
- `supabase.auth.signUp` + trigger `handle_new_user` cria `profiles`
- `supabase.auth.signInWithOAuth({provider:'google'})`
- Hook: `useAuth` (contexto global)

## 15. Painel admin relacionado
Desktop → **Clientes** e **Funcionários** (`ClientesAdmin`, `Funcionarios.tsx`). Admin pode:
- Ver último login, IP, device
- Forçar reset de senha (edge function `manage-employee` — expandir para clientes)
- Banir/desbanir (usa `profiles.banned_until` + trigger `banned-until-trigger`)
- **Faltando**: log de tentativas falhas por email (anti brute-force), lista de sessões ativas do usuário para revogar remotamente.

## 16. Casos extremos
- Google cancelado pelo usuário → sem erro, volta silencioso
- Email já existe no signup → sugerir "fazer login" com o email pré-preenchido
- Token expirado durante sessão → interceptor global renova; se falhar, redireciona pra `/m/auth?reason=expired`
- Deep-link pra `/m/chat/x` sem login → após login, retomar destino (hoje **perde** o destino → P0)

## 17. Justificativa UX
Tabs > páginas separadas: evita reload, mantém estado do email digitado. Google no topo do bloco social porque é ~70% dos logins reais. Botão de tema **removido** da Auth mobile (memória: usuário decide tema depois, no Config; poluição visual desnecessária aqui).

## 18. Escalabilidade
Auth é serverless (Supabase Auth). Sem gargalo. Único risco: se OAuth Google cair, hoje não há fallback claro além de email/senha — considerar Apple Sign-In quando iOS Capacitor entrar (roadmap).

## 19. Melhorias futuras
- Magic-link (passwordless) — reduz fricção em 40%+
- Biometria via Capacitor após "instalar app"
- Apple Sign-In (obrigatório se publicar iOS)
- "Continuar como convidado" para browse-only (hoje não existe)

## 20. Crítica
**Bom**: paridade visual com Web (consistência de marca), Google integrado, redirect pós-login.
**Ruim**:
- **P0**: perde destino do deep-link após login. Salvar em `sessionStorage.setItem('post_auth_redirect', location)` e ler no `useAuth` após signIn.
- **P0**: sem tratamento de banido no signIn — deixa entrar e só bloqueia depois. Checar `banned_until` antes de redirect.
- **P1**: sem indicador de força de senha no cadastro.
- **P2**: tabs recriam o form ao trocar, perde o que já foi digitado.

**Dívida técnica**: `useAuth` faz refetch de perfil em cada mudança de rota — mover para React Query com `staleTime: 5min`.

**Ângulos não cobertos inicialmente**: acessibilidade (labels dos inputs ok, mas foco não vai automático pro primeiro campo em cada tab), i18n (strings hardcoded PT-BR — ok para TCC, planejar `i18next` para v2).
