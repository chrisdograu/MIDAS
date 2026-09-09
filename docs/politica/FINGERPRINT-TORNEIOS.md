# Decisão — inscrição única em torneios: `user_id` vs `device_fingerprint`

> Status: **decidido** · Rodada 19 · Escopo: `tournament_participants`

## Decisão

A regra canônica de "uma inscrição por pessoa" é o **`user_id`**, garantida no banco pela
restrição `UNIQUE (tournament_id, user_id)`. O `device_fingerprint` **não bloqueia** inscrição.

## Por que não bloquear por fingerprint

- **Falso positivo alto**: irmãos, casais, república, LAN house e laboratório de escola
  compartilham o mesmo dispositivo. Bloquear pelo aparelho exclui jogador legítimo.
- **Fácil de burlar**: o fingerprint é calculado no cliente (user agent, resolução, fuso).
  Quem quer fraudar troca navegador em 10 segundos; quem é honesto é o único punido.
- **Camadas que já seguram fraude**: e-mail confirmado obrigatório, telefone obrigatório em
  torneio verificado, banimento por torneio (`tournament_bans`) e moderação manual.

## Para que serve o fingerprint então

Sinal **consultivo** de moderação: alimenta `tournament_duplicate_alerts` para o moderador
revisar contas suspeitas do mesmo aparelho. A decisão final é sempre humana, com log em
`admin_logs`.

## Consequências

- Nenhuma mudança de comportamento na inscrição: o limite por conta já existia.
- Se um dia o abuso crescer, a evolução é elevar o alerta (não bloquear automaticamente),
  exigindo verificação extra — nunca recusa silenciosa.
