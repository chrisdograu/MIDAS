# Moderação de conteúdo privado — decisão registrada

Auditoria, item 29. Registro da decisão para que o comportamento não seja
"descoberto" por engenharia reversa depois.

## Decisão

Conversas privadas **não são lidas** pela moderação de forma proativa.
A equipe só acessa o conteúdo de uma conversa quando:

1. há denúncia formal daquela conversa (`denuncias` com alvo do tipo conversa); **ou**
2. há disputa aberta de troca/partida e o moderador é parte da mediação; **ou**
3. há alerta automático de proteção de menor (`chat_ai_alerts`).

Em todos os casos o acesso fica registrado em `admin_logs` com justificativa.

## O que é automático

O sistema faz verificação automática **sem leitura humana** para: flood em chat
de torneio, tentativa de contato externo com menor e padrões conhecidos de
golpe (pedido de pagamento fora da plataforma). O resultado gera alerta para a
moderação — não uma leitura livre do histórico.

## Canal de escalada externa (obrigatório)

Quando um alerta automático ou uma denúncia indicar **suspeita de conteúdo de
abuso sexual infantil**, a escalada externa é **obrigatória**, não opcional, e
acontece além do registro interno em `admin_logs`:

1. Preservar o conteúdo e os metadados (sem download nem compartilhamento
   interno desnecessário), suspender preventivamente as contas envolvidas e
   registrar tudo em `admin_logs` com justificativa.
2. **Denúncia formal à SaferNet Brasil** (canal nacional de denúncia de crimes
   contra direitos humanos na internet) — passo obrigatório em todos os casos.
3. **Disque 100** (Disque Direitos Humanos) quando houver indício de risco atual
   a uma criança ou adolescente identificável, em paralelo à SaferNet.
4. Encaminhar o caso ao DPO, que acompanha prazos legais e eventual
   requisição de autoridade policial.

Esta é uma medida de **processo humano**: não existe (nem está prometida)
detecção automática por hash de CSAM, que exigiria vetting formal via SaferNet.
Nenhum passo acima é automatizado — cada um é executado e assinado por pessoa da
equipe de moderação.

## O que o usuário vê

Isso está resumido em linguagem simples nos Termos de Uso e no FAQ, para que a
regra seja conhecida antes do uso, não depois de um problema.

## Denúncias repetidas

Denúncias sobre o mesmo conteúdo são **agrupadas** e aumentam a prioridade da
fila. Volume de denúncias nunca remove conteúdo sozinho: a decisão é sempre de
um moderador humano, evitando remoção por perseguição coordenada.
