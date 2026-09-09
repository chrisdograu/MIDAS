# Backoffice — Marketplace C2C (Anúncios, Propostas, Trocas, Vendedores)

> **Rotas:** `/desktop/anuncios`, `/desktop/propostas`, `/desktop/trocas-arquivadas`, `/desktop/vendedores`
> **Arquivos:** `AnunciosAdmin.tsx`, `PropostasTroca.tsx`, `TrocasArquivadas.tsx`, `VendedoresAdmin.tsx`

---

## 1. Objetivo

Governar o **marketplace peer-to-peer** que roda no Mobile PWA: aprovar/remover anúncios, mediar propostas de troca, arquivar histórico, e gerir a reputação dos vendedores.

## 2. Filosofia

O C2C é onde MIDIAS se diferencia de Steam/Epic. Mas C2C **só funciona com confiança**, e confiança vem de moderação visível. Este módulo é a **polícia amigável** — atua rápido em fraude, mas premia vendedor honesto com certificado, destaque, e teto ampliado.

## 3. Usuários-alvo

| Perfil | Anúncios | Propostas | Vendedores |
| --- | --- | --- | --- |
| Admin | tudo | intervir | tudo |
| Atendente Marketplace | remover, editar, comentar | mediar disputa | ver + notas |
| Moderador | remover por denúncia | ver | ver |

## 4. Estrutura visual

### AnunciosAdmin
```text
Filtros (status, plataforma, preço, denúncias, sem foto, sem descrição)
   ↓
Tabela com preview thumb
   ↓
Ações: aprovar / pausar / remover / destacar / editar
```

### PropostasTroca (mediação)
```text
Kanban (pendente / aceita / rejeitada / disputa)
   ↓
Card com jogos oferecidos vs pedidos + chat da negociação
   ↓
Ações moderador: bloquear troca, aplicar penalidade, arquivar
```

### VendedoresAdmin
```text
Ranking (reputação, GMV, tempo de casa, taxa disputa)
   ↓
Perfil expandido (anúncios, avaliações recebidas, denúncias, certificado)
```

## 9. Regras de negócio

- Anúncio expira em 60 dias por padrão (`set_anuncio_default_expiration`).
- Trigger `enforce_seller_profile_for_anuncio`: precisa criar `seller_profiles` antes de anunciar.
- Trigger `enforce_uncertified_ad_limit`: max 5 anúncios ativos sem certificado.
- Proposta aceita → `trade_proposals.status='accepted'` → notificação (`notify_proposal_update`).
- Trocas arquivadas: `status ∈ {'completed','cancelled','rejected'}` migram para leitura só, view separada.
- Vendedor com **3 denúncias procedentes** em 30d → auto-suspensão do certificado. **Regra a implementar** — hoje é manual.

## 12. Origem dos dados

- `anuncios` (19 col), `fotos_anuncio`, `trade_proposals`, `seller_profiles`, `avaliacoes_usuario`, `denuncias`.

## 15. Ações admin

**Anúncios:**
- Remover com motivo (usuário recebe notificação com razão).
- Editar (com log) — ex.: corrigir preço absurdo, foto NSFW.
- Destacar (paid feature futura, hoje admin-only): `is_featured=true` até `featured_until`.
- Ver histórico de edições do anunciante.

**Propostas:**
- Ver conversa de negociação (chat mensagens filtrado por `conversas.trade_id`).
- Intervir com mensagem oficial.
- Forçar cancelamento em fraude confirmada.
- Aplicar penalidade (XP negativo, ban temporário).

**Vendedores:**
- Aprovar/revogar certificado (link para tela de Certificados).
- Ver LTV como vendedor + como comprador.
- "Congelar" perfil (impede novos anúncios sem banir a conta inteira).

## 16. Casos extremos

- Comprador aceita proposta e some → 48h sem resposta ⇒ auto-cancel. **P1**.
- Vendedor com anúncio de jogo que não existe no catálogo → ok, é C2C livre — mas admin precisa poder linkar ao `produtos.id` para permitir agregação de rating.
- Duas propostas simultâneas para mesmo anúncio único → race. **P0**: `SELECT ... FOR UPDATE` na proposta aceita.
- Certificado expirou entre criação e aprovação de anúncio.

## 20. Crítica

### 20.1 Bom
- Triggers de expiração default (60d) + limite de anúncios uncertified → economia de moderação.
- Separação `TrocasArquivadas` mantém tabela ativa enxuta.

### 20.2 Ruim
- **Chat de negociação não é aberto ao admin por default** (privacidade). Falta workflow "pedir permissão do usuário" ou "abrir por denúncia". **P0**: audit log toda vez que admin lê chat privado.
- **Ranking de vendedores sem fórmula transparente** — hoje é lista simples. **P1**: score = `(rating*0.4)+(disputas_negativas*-0.3)+(gmv_norm*0.3)`.
- **Sem heurísticas anti-fraude** (mesma foto em 10 anúncios, preço 90% abaixo da média). **P1**: edge function `detect-suspicious-ad`.
- **Auto-suspensão por denúncias procedentes** não existe. **P0**.

### 20.3 Dívida
- `anuncios.plataformas` (text[]) OK, mas sem constraint de valores (aceita "xbox", "Xbox", "XBOX"). **P1**: enum ou lookup.
- `trade_proposals` sem `expires_at` — proposta pendente eterna.

### 20.4 Não coberto
- **Escrow simulado**: TCC não modela custódia; poderia mostrar mesmo simulado para reforçar confiança.
- **Selo verificado** ≠ certificado (verificação de identidade vs. selo comercial). Hoje colapsados.
