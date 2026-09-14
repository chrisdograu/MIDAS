# Plano de Resposta a Incidentes de Segurança e Dados

Documento exigido pela auditoria (item 101). Vale para Web, Mobile e Backoffice.

## 1. Classificação

| Nível | Exemplo | Prazo de 1ª resposta |
| --- | --- | --- |
| P0 | Vazamento de dados pessoais, acesso indevido a conta, exposição de dados de menor | 1 hora |
| P1 | Falha de RLS, escalonamento de privilégio, fraude em massa no marketplace | 4 horas |
| P2 | Abuso pontual, spam, denúncia de conteúdo grave | 24 horas |
| P3 | Bug sem impacto em dados | 5 dias úteis |

## 2. Fluxo

1. **Detectar** — alerta do backoffice, denúncia de usuário ou aviso do DPO.
2. **Conter** — suspender a conta/rota afetada; se necessário, desativar a
   funcionalidade por feature flag em `site_settings`.
3. **Registrar** — abrir entrada em `admin_logs` com quem agiu, o que fez e por quê.
4. **Erradicar** — corrigir a causa (migração, política RLS, patch de front).
5. **Comunicar** — usuários afetados em até 72h no caso de dados pessoais
   (LGPD, art. 48), com descrição do dado, do risco e das medidas tomadas.
6. **Aprender** — post-mortem escrito, sem culpa individual, com ação preventiva.

## 3. Papéis

- **DPO / Encarregado**: comunica titulares e ANPD; consta no rodapé, FAQ e Termos.
- **Admin pleno / Direção**: autoriza contenção que afete a operação.
- **Moderação**: trata conteúdo e contas; nunca acessa biblioteca de usuário sem
  justificativa registrada (`read_user_library_admin`).

## 4. Dados de menores

Incidente que envolva conta de menor de idade é **sempre P0**. Além do fluxo
acima: notificar o responsável vinculado (`guardian_link_requests`) e revisar as
travas de chat e de classificação indicativa antes de reabrir o acesso.

## 5. Evidências

Preservar por 6 meses: logs administrativos, mensagens denunciadas e histórico
de alterações de configuração (`site_settings_history`). Não exportar dado
pessoal para fora do ambiente sem autorização do DPO.
