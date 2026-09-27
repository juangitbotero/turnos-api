# Política de Cancelamento e Faltas — Turnos

> Versão 1.2 · 2026-09-27 · Fonte única para Web Admin e app móvel.
> Baseada nas decisões de negócio de ADR 007 e ADR 008. Texto pronto a publicar
> **depois** de revisto pelo advogado (ver `docs/legal/brief-advogados.md`).
>
> **O que mudou desde a v1.1 (2026-07-05):**
> - Novo: **trabalhos de vários dias** (candidatura a todos os dias, cancelamento
>   antes do primeiro dia, impossibilidade de cancelar depois de começar, falta
>   a meio do trabalho).
> - Novo: **direito a revisão humana** de qualquer consequência automática.
> - Retirado — prometido mas não implementado, por isso não pode estar num texto
>   publicado: o lembrete push antes de cada turno; "impede o selo FIÁVEL" e
>   "reduz a prioridade nas notificações" num cancelamento tardio; "prioridade em
>   turnos semelhantes" para o trabalhador quando a empresa cancela; e (27/09,
>   2.ª passagem) "turnos confirmados futuros são cancelados" à 2.ª falta. Se
>   forem construídos, voltam a entrar.
> - Novo: **fundamentação de cada suspensão ou bloqueio**, enviada ao
>   trabalhador e visível no perfil (implementado a 27/09).
> - Clarificado: a Turnos regista e aplica as regras da plataforma, mas **não é
>   parte** na relação de trabalho — o mínimo de 2 horas é pago pela empresa ao
>   trabalhador, diretamente.

Cancelamentos e faltas prejudicam toda a comunidade Turnos. Os turnos
confirmados são compromissos entre empresas e trabalhadores: quando uma
empresa publica um turno, espera-se que o possa realmente oferecer; quando um
trabalhador confirma, espera-se que esteja certo da sua disponibilidade.

Estas regras aplicam-se a todos os turnos confirmados na Turnos e estão sempre
disponíveis na app e no dashboard.

---

## Antes de o turno ser confirmado

Sem qualquer penalização para ambas as partes:

- A empresa pode **cancelar turnos publicados** que ainda não foram preenchidos;
- A empresa pode **retirar uma pré-seleção** antes de o trabalhador a aceitar;
- O trabalhador pode **recusar uma pré-seleção ou um convite**, ou retirar a
  candidatura.

Uma pré-seleção ou convite que o trabalhador não aceite em **2 horas** expira e
o turno volta a ficar disponível, sem consequências para ninguém.

---

## Cancelamentos pelo Trabalhador

Depois de confirmar um turno, o trabalhador compromete-se a realizá-lo, salvo
motivo válido.

### Como cancelar (sempre nesta ordem)
1. **Cancelar o turno na app Turnos** (Os Meus Turnos → Cancelar turno) —
   nunca apenas por mensagem. Só o cancelamento na app reabre o turno e
   mantém o teu registo correto;
2. **Avisar a empresa de imediato**;
3. Se o cancelamento for a **menos de 24 horas** do início, indicar o motivo
   (ver "Justificações").

### Com mais de 24 horas de antecedência
- **Sem qualquer penalização.**
- O turno reabre automaticamente e os trabalhadores compatíveis são
  notificados.

### Com menos de 24 horas de antecedência ("cancelamento tardio")
- Não há penalização monetária — a Turnos nunca cobra dinheiro a trabalhadores.
- O cancelamento fica registado como **cancelamento tardio**.
- **2 cancelamentos tardios em 30 dias = suspensão de 7 dias** das
  candidaturas.
- O turno reabre automaticamente e os trabalhadores compatíveis são
  notificados.

### Se for a EMPRESA a cancelar, protege o teu registo
Se a empresa te pedir para cancelares tu o turno:
1. Pergunta o motivo do cancelamento;
2. **Pede à empresa que cancele do lado dela na plataforma** — nunca canceles
   tu um turno que a empresa decidiu cancelar, para não afetar o teu registo;
3. Se achares que um cancelamento de última hora da empresa foi injusto,
   contacta o suporte: turnos.contact@gmail.com.

---

## Trabalhos de vários dias

Alguns trabalhos duram vários dias seguidos (por exemplo, um evento de 3 dias).

- **Candidatar-te é comprometeres-te com todos os dias.** Não é possível
  aceitar só alguns.
- **Cancelar antes do primeiro dia** segue as regras acima, contadas a partir
  do início do **primeiro dia**. Um cancelamento tardio de um trabalho de
  vários dias conta como **um** cancelamento tardio, não um por dia.
- **Depois de o primeiro dia começar, o trabalho não pode ser cancelado na
  app.** Se tiveres uma emergência, contacta o suporte — resolvemos o caso
  contigo e com a empresa.
- **Faltar a um dia** conta como falta (secção seguinte). Os dias que faltam
  voltam a ficar disponíveis para outros trabalhadores. Os dias que já
  trabalhaste são sempre pagos.
- O pagamento de um trabalho de vários dias é **um só**, feito pela empresa no
  fim, e cobre todos os dias trabalhados.

---

## Faltas (No-Show)

Faltar a um turno confirmado sem cancelar é a violação mais grave da
comunidade Turnos.

- A falta é registada **pela empresa**, na página do turno. Nunca é decidida
  automaticamente pela ausência de check-in.
- **1.ª falta:** avaliação automática de **1 estrela** no perfil + **suspensão
  de 30 dias**. Após os 30 dias, o trabalhador pode voltar a candidatar-se.
- **2.ª falta:** **bloqueio da conta** — deixa de ser possível candidatar-se a
  turnos na Turnos.
- Motivos de força maior com comprovativo são avaliados caso a caso.
- Em qualquer suspensão ou bloqueio, o trabalhador recebe uma notificação (e
  um email, se tiver indicado um) com **os factos, a regra aplicada, a
  consequência e como pedir revisão** — e a mesma explicação fica visível no
  seu perfil enquanto a restrição durar.

---

## Cancelamentos pela Empresa

### Com mais de 24 horas de antecedência
- **Sem custos.** O trabalhador é notificado de imediato.

### Entre 24 e 3 horas antes do início
- **Sem custos de pagamento**, mas o cancelamento fica registado na métrica
  interna de fiabilidade da empresa. Cancelamentos tardios repetidos levam a
  revisão da conta.
- O trabalhador é notificado de imediato.

### Menos de 3 horas antes do início, sem justificação
Se a empresa cancelar por erro ou decisão própria a menos de 3 horas do início:

- A empresa deve **pagar ao trabalhador o mínimo de 2 horas** ao valor/hora do
  turno, diretamente. A Turnos gera um **Pay Link** (como num turno concluído)
  para facilitar esse pagamento — o dinheiro vai da empresa para o
  trabalhador, sem passar pela Turnos.
- A Turnos fatura à empresa a sua **taxa fixa de 3€**, como num turno concluído.
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

### Trabalhos de vários dias
Cancelar um trabalho de vários dias cancela **todos os dias ainda não
trabalhados**. Os dias já trabalhados mantêm-se e são pagos.

### Turno já iniciado, terminado mais cedo
Se a empresa terminar um turno já iniciado antes da duração acordada, deve
pagar **as horas trabalhadas ou o mínimo de 2 horas — o que for maior**.
Os turnos concluem automaticamente à hora de fim agendada; a empresa pode
**ajustar as horas trabalhadas no dashboard antes de pagar** (mínimo 2h) —
o trabalhador é notificado e pode contestar — ou **reportar um problema**
(ex.: abandono do turno), que é analisado pela Turnos em até 48h.

---

## Justificações — como funcionam

1. **No momento do cancelamento**, a app/dashboard pede o motivo:
   - Trabalhador (<24h): categoria (Doença · Lesão · Emergência · Outro) +
     descrição. Um comprovativo pode ser enviado ao suporte — é opcional, mas
     ajuda;
   - Empresa (<3h): categoria (da lista de exceções acima · Erro da empresa) +
     descrição.
2. O caso entra na fila de revisão da equipa Turnos. **Resposta em até 48h.**
3. Resultados possíveis:
   - **Justificação do trabalhador aceite** → o cancelamento tardio é removido
     do registo;
   - **Justificação da empresa aceite** → o mínimo de 2 horas não é devido;
   - **Justificação da empresa recusada** → o Pay Link do mínimo de 2 horas é
     gerado e a empresa deve pagá-lo;
   - A parte afetada é sempre notificada e pode contestar uma vez,
     respondendo ao suporte com informação adicional.
4. A Turnos pode contactar empresa e trabalhador para mais informações.

Indicar doença ou lesão, ou enviar um atestado, é partilhar um dado de saúde.
Só o fazes se quiseres; é usado apenas para decidir a justificação e apagado 6
meses depois (Política de Privacidade, secções 4 e 8).

---

## Revisão humana

Todas as consequências automáticas desta política — cancelamento tardio,
suspensão, avaliação de 1 estrela, bloqueio — podem ser revistas por uma
pessoa da equipa Turnos. Escreve para turnos.contact@gmail.com com a tua versão dos
factos; respondemos em até 48 horas.

---

## Consequências de conta (resumo)

| Situação | Consequência |
|---|---|
| Empresa cancela turno não preenchido / retira pré-seleção | Nenhuma |
| Trabalhador recusa pré-seleção ou convite | Nenhuma |
| Trabalhador cancela >24h | Nenhuma |
| Trabalhador cancela ≤24h | Cancelamento tardio; 2 em 30 dias = suspensão 7 dias |
| Trabalhador cancela trabalho de vários dias já iniciado | Não é possível na app — contactar o suporte |
| Trabalhador falta (1.ª) | 1★ automático + suspensão 30 dias |
| Trabalhador falta (2.ª) | Bloqueio da conta |
| Empresa cancela >24h | Nenhuma |
| Empresa cancela 24h–3h | Registo na fiabilidade interna da empresa |
| Empresa cancela <3h s/ justificação | Paga 2h mínimo ao trabalhador (Pay Link) + taxa 3€ |
| Empresa termina turno cedo | Paga horas trabalhadas ou 2h mínimo (o maior) |

A Turnos acompanha de perto cancelamentos e faltas para garantir justiça e
profissionalismo na comunidade — podemos contactar empresa e trabalhador para
mais informações.
