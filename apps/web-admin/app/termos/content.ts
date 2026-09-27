/**
 * Terms of Use — Workers. Published at /termos; accepted in the mobile app.
 *
 * ⚠️ PROVISIONAL — first draft, under review by the law firm. The review copy,
 * with the open legal questions (⚖️), is docs/legal/termos-trabalhadores.md.
 * This file is the text users see. When the lawyer's final text comes back:
 * replace the sections here, update the review copy, and bump
 * TERMS_VERSIONS.WORKER in @turnos/shared — every worker is then asked to
 * accept again.
 *
 * Portuguese only until the final text exists; an English translation of a
 * draft would be a second draft to keep in step.
 */

import { SUPPORT_EMAIL, TERMS_VERSIONS } from '@turnos/shared';
import type { LegalDoc } from '../../components/LegalDocPage';

const CONTROLLER = '[[RAZÃO SOCIAL]]';
const NIPC       = '[[NIPC]]';
const ADDRESS    = '[[MORADA]]';

const pt: LegalDoc = {
  back: '← Voltar',
  title: 'Termos de Utilização — Trabalhadores',
  updated: `Versão ${TERMS_VERSIONS.WORKER}`,
  notice:
    'Versão provisória, em revisão jurídica, aplicável durante a fase de testes da Turnos. ' +
    'Quando a versão final for publicada, pedimos-te que a aceites na aplicação antes de continuares.',
  lede:
    'Estes termos explicam como funciona a Turnos para quem procura trabalho: o que fazemos, o que não fazemos, ' +
    'e as regras que se aplicam a todos. Estão escritos para ser lidos.',
  sections: [
    {
      heading: '1. Quem somos',
      paragraphs: [
        `A Turnos é uma plataforma digital explorada por ${CONTROLLER}, NIPC ${NIPC}, com sede em ${ADDRESS} ("Turnos"). Ao criares conta, aceitas estes termos. Registamos a versão que aceitaste e a data.`,
      ],
    },
    {
      heading: '2. O que a Turnos é — e o que não é',
      paragraphs: [
        'A Turnos é um mercado de trabalho: um software onde empresas publicam turnos de curta duração e trabalhadores se candidatam.',
        'A empresa que publica o turno é a tua entidade empregadora. É ela que define o turno — local, data, horário, funções, requisitos e valor/hora —, escolhe quem contrata, supervisiona o trabalho e te paga.',
        'A Turnos não é a tua entidade empregadora, nem uma empresa de trabalho temporário, nem uma agência de colocação, e não é parte do contrato entre ti e a empresa.',
      ],
    },
    {
      heading: '3. Quem pode usar a Turnos',
      bullets: [
        'Tens de ter pelo menos 18 anos. Pedimos a tua data de nascimento no registo e confirmamos que tens 18 anos na data de cada turno a que te candidatas.',
        'Tens de estar legalmente autorizado a trabalhar em Portugal e ter NIF português. És responsável por teres, e manteres válida, essa autorização.',
        'Uma pessoa, uma conta. As informações que dás têm de ser verdadeiras e estar atualizadas.',
      ],
    },
    {
      heading: '4. A tua conta',
      paragraphs: [
        'Entras com o teu número de telemóvel e um código SMS. Não partilhes o código com ninguém.',
        'Para te poderes candidatar, o teu perfil tem de atingir 80 pontos na pontuação de perfil e tens de ter indicado a data de nascimento.',
      ],
    },
    {
      heading: '5. Candidaturas, convites e aceitação',
      bullets: [
        'Candidatas-te aos turnos que quiseres, e podes juntar uma nota curta. Não há obrigação de te candidatares a nada.',
        'A empresa escolhe entre os candidatos, ou convida-te diretamente. Em ambos os casos tens 2 horas para aceitar; se não aceitares, a oferta expira sem consequências.',
        'Trabalhos de vários dias: candidatar-te ou aceitar é comprometeres-te com todos os dias do trabalho.',
        'A aplicação não te deixa candidatar quando o turno ultrapassaria 70 dias por ano para a mesma empresa, não respeitaria 11 horas de descanso desde o teu turno anterior, ou se realiza antes de fazeres 18 anos. Estas verificações ajudam a cumprir a lei; não substituem as obrigações da empresa.',
      ],
    },
    {
      heading: '6. O dia do turno',
      bullets: [
        'Ao chegar, lês o QR code da empresa. A aplicação confirma que estás a menos de 200 m do local e dentro da janela de check-in. A tua localização só é lida nesse momento.',
        'O turno termina automaticamente à hora de fim agendada — não há leitura à saída.',
        'Antes de te pagar, a empresa pode ajustar as horas efetivamente trabalhadas (nunca abaixo de 2 horas) ou reportar um problema. És sempre notificado e podes contestar junto do suporte.',
      ],
    },
    {
      heading: '7. Pagamento',
      bullets: [
        'A empresa paga-te diretamente o valor bruto acordado, pelo método que escolheu ao publicar o turno: Turnos Pay Link, transferência bancária ou MB WAY. Um trabalho de vários dias é pago de uma só vez, no fim.',
        'A Turnos nunca recebe, guarda ou transfere o teu salário, e não te cobra nada — nem inscrição, nem percentagem, nem taxas.',
        'Para receber por Pay Link, crias uma conta de pagamentos na Stripe, em teu nome, e aceitas o Acordo de Conta Conectada da Stripe. A taxa de processamento é suportada pela empresa.',
        'A empresa só vê o teu IBAN se tiveres dado autorização no perfil. Podes retirá-la a qualquer momento.',
        'Quando a empresa marca o turno como pago, pedimos-te que confirmes se recebeste. Se não recebeste, carrega em "Não recebi": a equipa Turnos acompanha o caso.',
        'A Turnos lembra a empresa de pagamentos em atraso e impede-a de publicar novos turnos ao fim de 72 horas sem pagar. A Turnos não é fiadora do teu salário: a obrigação de pagar é só da empresa.',
      ],
    },
    {
      heading: '8. Impostos e Segurança Social',
      paragraphs: [
        'As tuas obrigações fiscais e de Segurança Social dependem da tua situação pessoal e são da tua responsabilidade. A Turnos não as calcula, não as retém, não as paga por ti e não presta aconselhamento fiscal. Os valores de TSU mostrados na aplicação são uma simulação informativa.',
      ],
    },
    {
      heading: '9. Cancelamentos e faltas',
      paragraphs: [
        'Aplica-se a Política de Cancelamento e Faltas, que faz parte destes termos. Em resumo:',
      ],
      table: {
        head: ['Situação', 'Consequência'],
        rows: [
          ['Cancelar mais de 24 h antes', 'Nenhuma'],
          ['Cancelar 24 h ou menos antes', 'Cancelamento tardio; 2 em 30 dias = 7 dias sem te poderes candidatar'],
          ['Trabalho de vários dias já iniciado', 'Não pode ser cancelado na app — contacta o suporte'],
          ['1.ª falta (registada pela empresa)', 'Avaliação automática de 1★ + 30 dias sem te poderes candidatar'],
          ['2.ª falta', 'Bloqueio da conta'],
        ],
      },
      bullets: [
        'Podes justificar um cancelamento tardio (doença, lesão, emergência). Uma justificação aceite retira-o do teu registo.',
      ],
    },
    {
      heading: '10. Avaliações, reputação e decisões automáticas',
      bullets: [
        'Depois de cada trabalho, a empresa pode avaliar-te (1 a 5 estrelas, com um comentário curto que outras empresas podem ver). Tu podes avaliar a empresa; essa avaliação é interna e nunca é mostrada à empresa.',
        'As avaliações, faltas e o estado da conta determinam automaticamente os selos TOP, FIÁVEL e VERIFICADO, e a ordem pela qual és avisado de novos turnos (favoritos da empresa, depois selo TOP, depois os restantes).',
        `Revisão humana: qualquer decisão automática — pontuação, suspensão, avaliação de 1★, bloqueio — pode ser revista por uma pessoa da equipa Turnos a teu pedido, em ${SUPPORT_EMAIL}. Respondemos em até 48 horas.`,
      ],
    },
    {
      heading: '11. Suspensão e encerramento pela Turnos',
      bullets: [
        'Podemos suspender ou encerrar a tua conta nos casos da secção 9; por informação falsa, conta duplicada ou utilização por outra pessoa; por fraude no check-in (por exemplo, partilhar ou fotografar o QR code); ou por assédio, discriminação ou violência.',
        'Quando o fizermos, dizemos-te porquê — os factos, a regra aplicada, a consequência e como pedir revisão — por notificação, por email se nos tiveres dado um, e no teu perfil na aplicação.',
        'Uma suspensão ou bloqueio não afeta o teu direito a receber os turnos já trabalhados.',
      ],
    },
    {
      heading: '12. Regras de conduta',
      paragraphs: [
        'Comprometes-te a dar informação verdadeira, a comparecer aos turnos que aceitas ou cancelar a tempo, a usar o QR code apenas no local e em teu nome, e a tratar com respeito as empresas e as outras pessoas.',
      ],
    },
    {
      heading: '13. Dados pessoais',
      paragraphs: [
        'Tratamos os teus dados como descrito na Política de Privacidade (/privacidade). O teu NIF e a tua data de nascimento nunca são mostrados às empresas; o IBAN só com a tua autorização.',
      ],
    },
    {
      heading: '14. Responsabilidade',
      paragraphs: [
        'A Turnos não garante que encontres turnos nem qualquer rendimento, e não responde pelas condições de trabalho, pelo pagamento do salário nem por atos da empresa, que é a tua entidade empregadora.',
      ],
    },
    {
      heading: '15. Eliminar a conta',
      paragraphs: [
        'Podes eliminar a conta a qualquer momento em Perfil → Eliminar a minha conta, exceto enquanto tiveres um turno confirmado por realizar ou um pagamento por receber.',
      ],
    },
    {
      heading: '16. Alterações',
      paragraphs: [
        'Se alterarmos estes termos de forma significativa, avisamos-te na aplicação com pelo menos 15 dias de antecedência e pedimos-te que aceites a nova versão. Se não concordares, podes eliminar a conta antes de a alteração produzir efeitos.',
      ],
    },
    {
      heading: '17. Lei aplicável e contactos',
      paragraphs: [
        `Estes termos regem-se pela lei portuguesa. Reclamações e pedidos: ${SUPPORT_EMAIL}.`,
      ],
    },
  ],
};

export const WORKER_TERMS = { pt } as const;
