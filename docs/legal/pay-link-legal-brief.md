# Turnos Pay Link — Estrutura do Fluxo de Pagamento (Brief Jurídico)

> Para revisão e validação por escrito pelo advogado.
> Versão 2 — 2026-07-29 (v1: 2026-07-06). Ainda **sem sign-off**.
> Contexto: pivot do modelo de negócio (ADR 007) — a Turnos saiu do fluxo
> monetário salarial para eliminar qualquer vínculo de intermediação laboral.

## O que mudou desde a v1

Esta versão corrige e amplia o documento anterior. As alterações materiais:

1. **Já não existe check-out.** O ADR 008 (2026-07-14) eliminou a leitura de QR
   à saída: o turno conclui-se automaticamente à hora agendada de fim. A v1
   descrevia o Pay Link como gerado "no check-out" — deixou de ser verdade.
2. **O numerário foi retirado** como método de pagamento (2026-07-29). Um
   salário MCD deve deixar rasto documental; um pagamento em numerário não dá
   nada à análise de uma disputa.
3. **A transferência bancária passou a exigir comprovativo** carregado pela
   empresa (recibo bancário ou captura MB WAY), associado ao turno.
4. **O MB WAY passou a estar disponível dentro do próprio Pay Link** (e não
   apenas como pagamento manual fora da plataforma).
5. **O IBAN do trabalhador só é divulgado à empresa mediante consentimento
   explícito, revogável e datado** — mecanismo descrito na secção
   "Consentimento para partilha do IBAN".
6. **Divulgam-se agora os mecanismos de execução** (secção "Poderes contratuais
   da Turnos") que a v1 omitia — é o ponto que mais precisa de parecer.

## Princípios da estrutura

1. **A Turnos nunca detém, recebe ou reencaminha salários.** O pagamento é
   feito diretamente da empresa ao trabalhador.
2. **A Turnos não cobra qualquer percentagem nem taxa sobre o pagamento
   salarial.** Confirmado no código: a sessão de pagamento é criada sem
   `application_fee_amount`. A totalidade do valor cobrado liquida na conta do
   trabalhador; a Turnos recebe **zero** dessa transação.
3. **A Turnos nunca fatura o trabalho.** A única faturação da Turnos é a sua
   própria receita: subscrição mensal (€45 Starter / €99 Pro) + taxa fixa de
   serviço de 3€ por turno concluído (2€ no Pro), agregada na fatura mensal da
   subscrição e cobrada **à empresa**. O trabalhador não paga nada.
4. A taxa é deliberadamente **fixa e não percentual**: uma taxa indexada à
   remuneração do trabalhador recriaria a aparência de intermediação laboral.
5. O Pay Link é apenas **facilitação técnica de pagamento** — equivalente a a
   empresa fazer uma transferência, mas com rasto documental automático.

## Fluxo técnico do Turnos Pay Link

1. No registo, o trabalhador completa um onboarding único **Stripe Connect
   Express**: verificação de identidade + IBAN, diretamente com a Stripe
   (entidade licenciada de serviços de pagamento na UE). É criada uma conta
   Stripe própria **do trabalhador** (o trabalhador é o titular).
2. O trabalhador faz uma única leitura de QR à chegada (check-in). **O turno
   conclui-se automaticamente à hora agendada de fim** — não há leitura de
   saída. Nessa conclusão, a Turnos gera um link de pagamento Stripe Checkout
   configurado como **direct charge na conta Stripe do trabalhador** —
   juridicamente, o beneficiário/comerciante da transação é o trabalhador, não
   a Turnos.
3. A empresa abre o link e paga por **cartão ou MB WAY** (o MB WAY é
   disponibilizado através da capacidade `mb_way_payments` pedida na conta do
   trabalhador). Os fundos liquidam **diretamente no saldo Stripe do
   trabalhador** e a Stripe transfere-os automaticamente para o IBAN do
   trabalhador (1–2 dias úteis).
4. O valor cobrado é acrescido da taxa de processamento Stripe, **suportada
   pela empresa** — o trabalhador recebe o valor bruto por inteiro. Ver secção
   seguinte sobre o cálculo desta majoração.
5. A Turnos emite um **comprovativo de pagamento** (não uma fatura) para ambas
   as partes, acompanhado dos valores TSU informativos.
6. Em nenhum momento os fundos salariais transitam por contas da Turnos — nem
   em custódia transitória.

## Majoração da taxa de processamento (*gross-up*)

A taxa exata não é conhecida no momento em que o link é criado: depende do
cartão que o pagador vier a escolher (tarifário EEE da Stripe: 1,5% + €0,25 em
cartão de consumidor; 2,8% + €0,25 em cartão premium/empresarial — e os cartões
de empresa são tipicamente empresariais).

A majoração é por isso calculada pelo **pior cenário EEE realista**, para
garantir que o trabalhador nunca recebe menos do que o salário acordado. Quando
a empresa paga por um meio mais barato (cartão de consumidor, ou MB WAY a 1,5%
+ €0,25), o pequeno excedente **reverte para o trabalhador** — nunca para a
Turnos.

Após cada pagamento, a Turnos lê a taxa efetivamente cobrada pela Stripe e
regista o valor líquido que entrou na conta do trabalhador. Se ainda assim
houver diferença para menos (caso residual de cartão extra-EEE, até 3,15% +
2% de conversão cambial), o caso é sinalizado internamente para regularização.

## Pagamentos alternativos

A empresa pode optar por **transferência bancária** ou **MB WAY** feitos
diretamente, inteiramente fora da plataforma. Nesses casos a Turnos apenas
regista a declaração de pagamento da empresa e a confirmação de receção do
trabalhador (mecanismo de confiança, sem intervenção monetária).

Para esses métodos a Turnos:
- mostra à empresa o **nome e o IBAN do trabalhador** e uma referência de
  pagamento, para que a empresa possa efetuar a transferência — **apenas
  mediante consentimento prévio e explícito do trabalhador** (ver secção
  seguinte);
- pede à empresa que **anexe o comprovativo** ao declarar o pagamento. Não é
  bloqueante: a empresa pode declarar sem comprovativo, mas tem de indicar o
  motivo, e essa ausência fica registada e visível em caso de disputa;
- disponibiliza o comprovativo ao trabalhador antes de este confirmar a receção.

### Consentimento para partilha do IBAN

O IBAN do trabalhador **nunca é divulgado a uma empresa sem consentimento
explícito**. O mecanismo implementado:

1. No momento em que introduz o IBAN — no onboarding ou no perfil — o
   trabalhador vê uma caixa de seleção com o texto: *"Autorizo a partilha do meu
   nome e IBAN com as empresas onde fiz turnos, para que me possam pagar por
   transferência. Posso retirar esta autorização no meu perfil a qualquer
   momento."*
2. A caixa só aparece se houver IBAN preenchido, e **não vem pré-selecionada**.
3. O consentimento é registado com **data e hora** (`Worker.ibanShareConsentAt`),
   não como simples booleano, para poder ser evidenciado.
4. **É revogável a todo o tempo** no perfil; a revogação tem efeito imediato e o
   IBAN deixa de ser divulgado.
5. Sem consentimento, a empresa vê apenas uma nota a indicar que deve usar o Pay
   Link ou combinar MB WAY diretamente — nunca o IBAN.
6. A divulgação é **limitada ao estritamente necessário**: apenas às empresas com
   um salário em aberto para esse trabalhador, apenas enquanto o pagamento
   estiver por liquidar, e nunca em pagamentos por Pay Link (onde não existe
   transferência a fazer).

O **numerário deixou de ser oferecido** (2026-07-29).

## Poderes contratuais da Turnos sobre a obrigação salarial

Esta secção não constava da v1 e é o ponto que mais carece de parecer. A Turnos
não detém fundos, mas exerce sobre a empresa os seguintes poderes contratuais,
ao abrigo dos termos de utilização:

| Mecanismo | Efeito |
|---|---|
| Ciclo de lembretes | Emails à empresa a +8h, +24h e +48h (último aviso) sobre um salário por pagar |
| Suspensão de publicação | Ao fim de **72h** com salário por pagar, a empresa fica impedida de publicar novos turnos |
| Mínimo de 2 horas | Cancelamento pela empresa a <3h do início por erro próprio obriga ao pagamento de 2h ao trabalhador |
| Ajuste de horas | A empresa pode reduzir as horas pagas antes de pagar, com **piso de 2 horas**; o trabalhador é notificado e pode contestar |
| Reporte de problema | A empresa suspende o ciclo de lembretes e o caso vai a análise da Turnos (SLA 48h) |
| Disputa do trabalhador | "Não recebi" marca o pagamento como disputado e alerta a equipa Turnos |
| Fiabilidade do trabalhador | Cancelamentos tardios e faltas geram *strikes*, suspensões temporárias e, na reincidência, bloqueio |

## Mínimo de 2 horas em cancelamentos <3h

Conforme a política de cancelamento v1.1: se a empresa cancelar um turno
preenchido a menos de 3 horas do início por erro/decisão própria, deve pagar ao
trabalhador o mínimo de 2 horas. A Turnos gera o mesmo Pay Link para facilitar
esse pagamento (mesma estrutura acima) e fatura apenas a sua taxa fixa.

## Questões para validação do advogado

1. A estrutura "direct charge na conta Connect do trabalhador", sem
   `application_fee_amount`, preserva a posição da Turnos como mera
   facilitadora (sem custódia, sem *paymaster*)?
2. **Os poderes contratuais listados acima** (em especial a suspensão de
   publicação por não pagamento, o mínimo de 2h e o piso de 2h no ajuste de
   horas) são compatíveis com a posição de não-intermediário, ou podem ser
   lidos por uma inspeção (ACT) como exercício de **controlo** sobre a relação
   laboral? Se o risco existir, que redação dos termos o mitiga?
3. **Responsabilidade da Turnos como plataforma Connect.** A Turnos é a
   plataforma das contas Express dos trabalhadores. Num *chargeback* da empresa
   após o trabalhador já ter recebido o valor no IBAN, o saldo da conta do
   trabalhador fica negativo e a Stripe pode repercutir a perda na plataforma.
   Que exposição real existe e como deve ser tratada nos termos e/ou por via de
   uma reserva?
4. O comprovativo de pagamento emitido pela Turnos (sem fatura de trabalho) é o
   documento adequado no enquadramento MCD (pagamento = salário)?
5. **Divulgação do IBAN do trabalhador à empresa** para os métodos manuais. O
   mecanismo de consentimento descrito acima já está implementado. Confirma-se
   que (a) o consentimento é a base legal correta — ou seria antes execução de
   contrato, dispensando a caixa de seleção? (b) a redação do texto de
   consentimento é suficiente? (c) falta alguma informação a prestar ao
   trabalhador no momento da recolha (destinatários, prazo, direitos)?
6. **Comprovativos de pagamento carregados pelas empresas**: prazo de
   conservação, base legal e regime de acesso (o trabalhador vê o seu).
7. Alguma implicação do *gross-up* da taxa de processamento — em particular do
   facto de o excedente, quando existe, reverter para o trabalhador (o
   trabalhador recebe pontualmente um valor ligeiramente superior ao bruto
   acordado)?
8. O texto público da política (`docs/policies/cancellation-and-noshow-policy.md`)
   precisa de ajustes de linguagem?

**Sign-off:** ___________________________ Data: ___________
