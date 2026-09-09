# Web · Autenticação (/auth)

## Propósito
Login e cadastro unificados. Design com paridade estrita ao mobile (Teal/Purple, ícones nos campos).

## Componentes
`src/pages/Auth.tsx`, `useAuth`. Providers: email/senha + Google OAuth.

## Fluxos
1) Signup → trigger cria `profiles` → redirect. 2) Login → onAuthStateChange → redirect para `redirectTo` (query param). 3) Google OAuth → `redirect_uri = window.location.origin`.

## Achados P0
- **Redirect após login perde `?next=`** quando OAuth externo interrompe. Persistir em `sessionStorage` antes de `signInWithOAuth`.
- **Não trata `banned_until`** no client — usuário banido loga e só recebe erro depois. Checar `profiles.banned_until` no `onAuthStateChange`.

## Achados P1
- Sem rate-limit visível (mensagem genérica de erro).
- Falta reCAPTCHA/hCaptcha no signup.
- Password strength meter ausente.

## P2
Ícones dos campos podem virar componente compartilhado com `MAuth`.

