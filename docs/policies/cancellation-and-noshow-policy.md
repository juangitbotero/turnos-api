# Política de Cancelamento e Faltas — Turnos

> Versão 1.1 · 2026-07-05 · Fonte única para Web Admin e app móvel.
> Baseada nas decisões de negócio de ADR 007. Texto pronto a publicar.

Cancelamentos e faltas prejudicam toda a comunidade Turnos. Os turnos
confirmados são compromissos entre empresas e trabalhadores: quando uma
empresa publica um turno, espera-se que o possa realmente oferecer; quando um
trabalhador confirma, espera-se que esteja certo da sua disponibilidade.

---

## Antes de o turno ser confirmado

Sem qualquer penalização para ambas as partes:

- A empresa pode **cancelar turnos publicados** que ainda não foram preenchidos;
- A empresa pode **retirar uma pré-seleção** antes de o trabalhador a aceitar;
- O trabalhador pode **recusar uma pré-seleção** ou retirar a candidatura.

---

## Antes do início de cada turno

Os trabalhadores são relembrados das consequências de cancelamentos tardios e
faltas na app e por notificação push antes de cada turno confirmado.

---

## Cancelamentos pelo Trabalhador

Depois de confirmar um turno, o trabalhador compromete-se a realizá-lo, salvo
motivo válido.

### Como cancelar (sempre nesta ordem)
1. **Cancelar o turno na app Turnos** (Os Meus Turnos → Cancelar turno) —
   nunca apenas por mensagem. Só o cancelamento na app reabre o turno e
   mantém o teu registo correto;
2. **Avisar a empresa de imediato**;
3. Se o cancelamento for a **menos de 24 horas** do início, submeter o
   comprovativo do motivo válido (ver abaixo).

### Com mais de 24 horas de antecedência
- **Sem qualquer penalização.**
- O turno reabre automaticamente e os trabalhadores compatíveis são
  notificados de imediato.

### Com menos de 24 horas de antecedência ("cancelamento tardio")
- Não há penalização monetária — a Turnos nunca cobra dinheiro a trabalhadores.
- O cancelamento fica registado como **cancelamento tardio** no perfil de
  fiabilidade:
  - Impede a obtenção do selo **FIÁVEL**;
  - Reduz a prioridade nas notificações de novos turnos;
  - **2 cancelamentos tardios em 30 dias = suspensão de 7 dias.**
- O turno reabre automaticamente e a onda de notificações é disparada.

### Se for a EMPRESA a cancelar, protege o teu registo
Se a empresa te pedir para cancelares tu o turno:
1. Pergunta o motivo do cancelamento;
2. **Pede à empresa que cancele do lado dela na plataforma** — nunca canceles
   tu um turno que a empresa decidiu cancelar, para não afetar o teu registo
   de fiabilidade;
3. Se achares que um cancelamento de última hora da empresa foi injusto,
   contacta o suporte: suporte@turnos.pt.

---

## Faltas (No-Show)

Faltar a um turno confirmado sem cancelar é a violação mais grave da
comunidade Turnos.

- **1.ª falta:** avaliação automática de **1 estrela** no perfil + **suspensão
  de 30 dias**. Após os 30 dias, o trabalhador pode voltar a candidatar-se.
- **2.ª falta:** **bloqueio permanente da conta** — deixa de ser possível
  candidatar-se a turnos na Turnos. Turnos confirmados futuros são cancelados
  e reabertos.
- A empresa regista a falta na app (na página do turno) — com informação
  adicional pode contactar o suporte.
- Motivos de força maior com comprovativo são avaliados caso a caso.

---

## Cancelamentos pela Empresa

### Com mais de 24 horas de antecedência
- **Sem custos.** O trabalhador é notificado com um pedido de desculpas e
  recebe prioridade em turnos semelhantes.

### Entre 24 e 3 horas antes do início
- **Sem custos de pagamento**, mas o cancelamento fica registado na métrica
  interna de fiabilidade da empresa. Cancelamentos tardios repetidos levam a
  revisão da conta.
- O trabalhador é notificado de imediato com pedido de desculpas + prioridade.

### Menos de 3 horas antes do início, sem justificação
Se a empresa cancelar por erro ou decisão própria a menos de 3 horas do início:

- A empresa deve **pagar ao trabalhador o mínimo de 2 horas** ao valor/hora do
  turno. A Turnos gera automaticamente um **Pay Link** (como num turno
  concluído) para facilitar este pagamento — feito diretamente da empresa ao
  trabalhador.
- A Turnos fatura a **taxa fixa de 3€**, como num turno concluído.
- O cancelamento pesa fortemente na métrica de fiabilidade da empresa.

### Exceções — cancelamentos justificados
A obrigação do mínimo de 2 horas **não se aplica** quando o cancelamento se
deve a causas alheias à empresa ou a incumprimento do trabalhador, por exemplo:

- Trabalhador chegou atrasado ao turno;
- Trabalhador incapaz de, ou indisponível para, desempenhar a função acordada;
- Incumprimento do código de vestuário/requisitos indicados no turno;
- Razões de saúde e segurança;
- Avaria de equipamento essencial (ex.: máquina de café, máquina de lavar);
- Cancelamento do evento por terceiros (ex.: catering cancelado).

Nestes casos a empresa seleciona o motivo ao cancelar, dá o máximo de aviso
possível ao trabalhador, e o caso é avaliado individualmente pela Turnos.

### Turno já iniciado, terminado mais cedo
Se a empresa terminar um turno já iniciado antes da duração acordada, deve
pagar **as horas trabalhadas ou o mínimo de 2 horas — o que for maior**.

---

## Justificações — como funcionam

1. **No momento do cancelamento**, a app/dashboard pede o motivo:
   - Trabalhador (<24h): categoria (Doença · Lesão · Emergência · Outro) +
     descrição + comprovativo (foto/documento, opcional mas recomendado);
   - Empresa (<3h): categoria (da lista de exceções acima · Erro da empresa) +
     descrição.
2. O caso entra na fila de revisão da equipa Turnos. **Resposta em até 48h.**
3. Resultados possíveis:
   - **Justificação do trabalhador aceite** → o cancelamento tardio é removido
     do registo de fiabilidade;
   - **Justificação da empresa aceite** → o mínimo de 2 horas não é devido;
   - **Justificação da empresa recusada** → o Pay Link do mínimo de 2 horas é
     gerado e a empresa deve pagá-lo;
   - A parte afetada é sempre notificada e pode contestar uma vez,
     respondendo ao suporte com informação adicional.
4. A Turnos pode contactar empresa e trabalhador para mais informações.

---

## Consequências de conta (resumo)

| Situação | Consequência |
|---|---|
| Empresa cancela turno não preenchido / retira pré-seleção | Nenhuma |
| Worker recusa pré-seleção | Nenhuma |
| Worker cancela >24h | Nenhuma |
| Worker cancela ≤24h | Strike de fiabilidade; 2 em 30 dias = suspensão 7 dias |
| Worker falta (1.ª) | 1★ automático + suspensão 30 dias |
| Worker falta (2.ª) | Bloqueio permanente + turnos futuros cancelados |
| Empresa cancela >24h | Nenhuma (desculpas + prioridade ao worker) |
| Empresa cancela 24h–3h | Registo na fiabilidade interna da empresa |
| Empresa cancela <3h s/ justificação | Paga 2h mínimo ao worker (Pay Link) + taxa 3€ |
| Empresa termina turno cedo | Paga horas trabalhadas ou 2h mínimo (o maior) |

A Turnos acompanha de perto cancelamentos e faltas para garantir justiça e
profissionalismo na comunidade — podemos contactar empresa e trabalhador para
mais informações.
