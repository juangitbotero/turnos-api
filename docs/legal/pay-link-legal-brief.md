# Turnos Pay Link — Estrutura do Fluxo de Pagamento (Brief Jurídico)

> Para revisão e validação por escrito pelo advogado. 2026-07-06.
> Contexto: pivot do modelo de negócio (ADR 007) — a Turnos saiu do fluxo
> monetário salarial para eliminar qualquer vínculo de intermediação laboral.

## Princípios da estrutura

1. **A Turnos nunca detém, recebe ou reencaminha salários.** O pagamento é
   feito diretamente da empresa ao trabalhador.
2. **A Turnos nunca fatura o trabalho.** A única faturação da Turnos é a sua
   própria receita: subscrição mensal (€45) + taxa fixa de serviço de 3€ por
   turno concluído, agregada na fatura mensal da subscrição.
3. O Pay Link é apenas **facilitação técnica de pagamento** — equivalente a a
   empresa fazer uma transferência, mas com rasto documental automático.

## Fluxo técnico do Turnos Pay Link

1. No registo, o trabalhador completa um onboarding único **Stripe Connect
   Express**: verificação de identidade + IBAN, diretamente com a Stripe
   (entidade licenciada de serviços de pagamento na UE). É criada uma conta
   Stripe própria **do trabalhador** (o trabalhador é o titular).
2. Quando um turno é concluído (check-out), a Turnos gera um link de
   pagamento Stripe Checkout configurado como **direct charge na conta
   Stripe do trabalhador** — juridicamente, o beneficiário/comerciante da
   transação é o trabalhador, não a Turnos.
3. A empresa abre o link e paga com cartão. Os fundos liquidam **diretamente
   no saldo Stripe do trabalhador** e a Stripe transfere-os automaticamente
   para o IBAN do trabalhador (1–2 dias úteis).
4. O valor cobrado é acrescido da taxa de processamento Stripe (~1,5% +
   €0,25), **suportada pela empresa** — o trabalhador recebe o valor bruto
   por inteiro.
5. A Turnos emite um **comprovativo de pagamento** (não uma fatura) para
   ambas as partes, acompanhado dos valores TSU informativos.
6. Em nenhum momento os fundos salariais transitam por contas da Turnos —
   nem em custódia transitória.

## Pagamentos alternativos

A empresa pode optar por transferência bancária, MB WAY ou numerário —
inteiramente fora da plataforma. Nesses casos a Turnos apenas regista a
declaração de pagamento da empresa e a confirmação de receção do trabalhador
(mecanismo de confiança, sem intervenção monetária).

## Mínimo de 2 horas em cancelamentos <3h

Conforme a política de cancelamento v1.1: se a empresa cancelar um turno
preenchido a menos de 3 horas do início por erro/decisão própria, deve pagar
ao trabalhador o mínimo de 2 horas. A Turnos gera o mesmo Pay Link para
facilitar esse pagamento (mesma estrutura acima) e fatura apenas a sua taxa
fixa de 3€.

## Questões para validação do advogado

1. A estrutura "direct charge na conta Connect do trabalhador" preserva a
   posição da Turnos como mera facilitadora (sem custódia, sem paymaster)?
2. O comprovativo de pagamento emitido pela Turnos (sem fatura de trabalho)
   é o documento adequado no enquadramento MCD (pagamento = salário)?
3. Alguma implicação do gross-up da taxa de processamento (empresa suporta a
   taxa; trabalhador recebe o bruto por inteiro)?
4. O texto público da política (docs/policies/cancellation-and-noshow-policy.md)
   precisa de ajustes de linguagem?

**Sign-off:** ___________________________ Data: ___________
