# Web · Contato (/contato)

## Propósito
Formulário de contato → cria `tickets` tipo web.

## Achados P0
- **Sem honeypot/captcha** — vulnerável a spam.
- Não valida email server-side.
- Anexos não implementados (usuários pedem no formulário mas não têm campo).

## P1
Confirmar envio com toast + email de confirmação ao usuário via edge function.

