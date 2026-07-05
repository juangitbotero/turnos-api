# Política de Cancelamento e Faltas — Turnos

> Versão 1.0 · 2026-07-05 · Fonte única para Web Admin e app móvel.
> Baseada nas decisões de negócio de ADR 007. Texto pronto a publicar.

---

## Antes do início de cada turno

Os trabalhadores são relembrados das consequências de cancelamentos tardios e
faltas na app e por notificação push antes de cada turno confirmado.

---

## Cancelamentos pelo Trabalhador

Depois de confirmar um turno, o trabalhador compromete-se a realizá-lo, salvo
motivo válido.

### Com mais de 24 horas de antecedência
- **Sem qualquer penalização.**
- O turno reabre automaticamente e os trabalhadores compatíveis são notificados
  de imediato para que a empresa possa preencher a vaga.

### Com menos de 24 horas de antecedência ("cancelamento tardio")
- Não há penalização monetária — a Turnos nunca cobra dinheiro a trabalhadores.
- O cancelamento fica registado como **cancelamento tardio** no perfil de
  fiabilidade do trabalhador:
  - Impede a obtenção do selo **FIÁVEL**;
  - Reduz a prioridade nas notificações de novos turnos;
  - **2 cancelamentos tardios em 30 dias = suspensão de 7 dias** (não é
    possível candidatar-se a turnos durante esse período).
- O turno reabre automaticamente e a onda de notificações é disparada.

### Como cancelar
O cancelamento deve ser feito **sempre na app Turnos** (Os Meus Turnos →
Cancelar turno) — nunca apenas por mensagem à empresa. Só o cancelamento na
app reabre o turno e mantém o registo correto.

### Motivos válidos
Cancelamentos por **doença, lesão ou emergência**, com comprovativo, são
avaliados caso a caso pela equipa Turnos — se aceites, o cancelamento tardio é
removido do registo. Contacto: suporte@turnos.pt.

---

## Faltas (No-Show)

Faltar a um turno confirmado sem cancelar é a violação mais grave da
comunidade Turnos.

- **1.ª falta:** avaliação automática de **1 estrela** no perfil + **suspensão
  de 30 dias**. Após os 30 dias, o trabalhador pode voltar a candidatar-se.
- **2.ª falta:** **bloqueio permanente da conta** — deixa de ser possível
  candidatar-se a turnos na Turnos. Turnos confirmados futuros são cancelados
  e reabertos.
- Motivos de força maior com comprovativo são avaliados caso a caso.

---

## Cancelamentos pela Empresa

### Com mais de 24 horas de antecedência
- **Sem custos.**
- O trabalhador é notificado de imediato com um pedido de desculpas e recebe
  prioridade em turnos semelhantes na sua zona.

### Com menos de 24 horas de antecedência, sem justificação
Se a empresa cancelar um turno preenchido no próprio dia (menos de 24h antes
do início) por erro ou decisão própria:

- A empresa deve **pagar ao trabalhador o mínimo de 2 horas** ao valor/hora do
  turno. A Turnos gera automaticamente um **Pay Link** (como num turno
  concluído) para facilitar este pagamento — que é feito diretamente da
  empresa ao trabalhador.
- A Turnos fatura a **taxa fixa de 3€**, como num turno concluído.
- O cancelamento fica registado na métrica interna de fiabilidade da empresa.
  Cancelamentos tardios repetidos levam a revisão da conta.

### Exceções — cancelamentos justificados
A obrigação do mínimo de 2 horas **não se aplica** quando o cancelamento se
deve a causas alheias à empresa ou a incumprimento do trabalhador, por exemplo:

- Trabalhador chegou atrasado ao turno;
- Trabalhador incapaz de, ou indisponível para, desempenhar a função acordada;
- Incumprimento do código de vestuário/requisitos indicados no turno;
- Razões de saúde e segurança;
- Avaria de equipamento essencial (ex.: máquina de café, máquina de lavar);
- Cancelamento do evento por terceiros (ex.: catering cancelado).

Nestes casos a empresa deve dar o máximo de aviso possível ao trabalhador e
pode contactar o suporte Turnos. Os casos são avaliados individualmente.

### Turno já iniciado, terminado mais cedo
Se a empresa terminar um turno já iniciado antes da duração acordada, deve
pagar **as horas trabalhadas ou o mínimo de 2 horas — o que for maior**.

---

## Consequências de conta (resumo)

| Situação | Consequência |
|---|---|
| Worker cancela >24h | Nenhuma |
| Worker cancela ≤24h | Strike de fiabilidade; 2 em 30 dias = suspensão 7 dias |
| Worker falta (1.ª) | 1★ automático + suspensão 30 dias |
| Worker falta (2.ª) | Bloqueio permanente + turnos futuros cancelados |
| Empresa cancela >24h | Nenhuma (pedido de desculpas ao worker + prioridade) |
| Empresa cancela ≤24h s/ justificação | Paga 2h mínimo ao worker (Pay Link) + taxa 3€ Turnos |
| Empresa termina turno cedo | Paga horas trabalhadas ou 2h mínimo (o maior) |

A Turnos acompanha de perto cancelamentos e faltas para garantir justiça e
profissionalismo na comunidade — podemos contactar empresa e trabalhador para
mais informações.
