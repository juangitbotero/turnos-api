/**
 * Terms of Use — Companies. (Annex A, the art. 28 data processing agreement,
 * was removed on 2026-10-05 together with the accountant email it covered.)
 * Published at /termos-empresas; accepted at registration and, after any
 * change, in the dashboard.
 *
 * ⚠️ PROVISIONAL — first draft, under review by the law firm. The review copy,
 * with the open legal questions (⚖️), is docs/legal/termos-empresas.md. When
 * the final text comes back: replace the sections here, update the review
 * copy, and bump TERMS_VERSIONS.EMPLOYER in @turnos/shared.
 */

import { SUPPORT_EMAIL, TERMS_VERSIONS, SUBSCRIPTION_TIERS, TURNOS_FEE_FIXED_EUR } from '@turnos/shared';
import type { LegalDoc } from '../../components/LegalDocPage';

const CONTROLLER = '[[RAZÃO SOCIAL]]';
const NIPC       = '[[NIPC]]';
const ADDRESS    = '[[MORADA]]';
const STARTER    = SUBSCRIPTION_TIERS.STARTER;
const PRO        = SUBSCRIPTION_TIERS.PRO;

const pt: LegalDoc = {
  back: '← Voltar',
  title: 'Termos de Utilização — Empresas',
  updated: `Versão ${TERMS_VERSIONS.EMPLOYER}`,
  notice:
    'Versão provisória, em revisão jurídica, aplicável durante a fase de testes da Turnos. ' +
    'Quando a versão final for publicada, pedimos que a aceite no dashboard antes de continuar.',
  lede:
    'Estes termos regulam a utilização da Turnos pela sua empresa: o serviço que prestamos, os preços, ' +
    'e as obrigações de cada parte.',
  sections: [
    {
      heading: '1. Partes e objeto',
      paragraphs: [
        `A Turnos é explorada por ${CONTROLLER}, NIPC ${NIPC}, com sede em ${ADDRESS} ("Turnos"). A Turnos presta à Empresa um serviço de software: publicação de turnos, receção de candidaturas, pesquisa de trabalhadores, check-in por QR code, ferramentas de conformidade, ferramentas de pagamento e reputação.`,
      ],
    },
    {
      heading: '2. O que a Turnos é — e o que não é',
      paragraphs: [
        'A Empresa é a entidade empregadora de cada trabalhador que contrata através da Turnos: define as condições do turno, escolhe quem contrata, dirige e supervisiona o trabalho e paga o salário.',
        'A Turnos não é empregadora, empresa de trabalho temporário nem agência de colocação, não é parte da relação de trabalho e não recebe, guarda nem transfere salários. A remuneração da Turnos é fixa e não depende do salário pago ao trabalhador.',
      ],
    },
    {
      heading: '3. Conta',
      bullets: [
        'A Empresa regista-se com denominação social, NIPC e NIF válidos, morada, e o email de quem gere a conta. Cada Empresa tem uma conta e um acesso.',
        'A Turnos não envia dados a terceiros em nome da Empresa. Os dados de cada contratação ficam disponíveis no painel da Empresa (secção 7).',
        'A Empresa é responsável pela exatidão destes dados e pelo que é feito com o seu acesso.',
      ],
    },
    {
      heading: '4. Preços',
      table: {
        head: ['Plano', 'Preço', 'Trabalhos ativos em simultâneo', 'Taxa por trabalho concluído'],
        rows: [
          [STARTER.name, `${STARTER.monthlyEur} € / mês`, `até ${STARTER.maxActiveShifts}`, `${STARTER.shiftFeeEur} €`],
          [`${PRO.name} (quando disponível)`, `${PRO.monthlyEur} € / mês`, 'ilimitado', `${PRO.shiftFeeEur} €`],
        ],
      },
      bullets: [
        `Um trabalho de vários dias conta como um trabalho — uma taxa. A taxa de ${TURNOS_FEE_FIXED_EUR} € é também devida quando a Empresa cancela sem justificação a menos de 3 horas do início.`,
        'As taxas do mês são faturadas com a subscrição seguinte e cobradas no cartão registado, através da Stripe. A Turnos não guarda os dados do cartão.',
        'Sem subscrição ativa, ou com pagamento falhado, a Empresa não pode publicar novos turnos.',
        'A Empresa pode cancelar a subscrição a qualquer momento; o cancelamento produz efeitos no fim do período de faturação em curso.',
      ],
    },
    {
      heading: '5. Publicar turnos',
      bullets: [
        'A Empresa define, em cada turno: função, descrição, local, data(s), horário, valor/hora bruto, requisitos e o método de pagamento ao trabalhador (Turnos Pay Link, transferência ou MB WAY).',
        'A Empresa garante que o valor/hora respeita o salário mínimo e os instrumentos de regulamentação coletiva aplicáveis, que a descrição é verdadeira, e que os requisitos não são discriminatórios.',
        'O valor/hora bruto é mostrado em todos os turnos.',
      ],
    },
    {
      heading: '6. Escolher trabalhadores',
      bullets: [
        'A Empresa vê as candidaturas e escolhe; pode também convidar diretamente trabalhadores que encontre na pesquisa. A decisão de contratar é sempre da Empresa. O trabalhador tem 2 horas para aceitar.',
        'A Empresa vê do trabalhador: nome, foto, biografia, CV, competências, idiomas, experiência, disponibilidade, avaliações, selos e número de faltas. Não vê o NIF, a data de nascimento nem os rendimentos declarados; o IBAN só com autorização do trabalhador.',
        'A plataforma não deixa aceitar candidaturas que ultrapassem 70 dias por ano com a mesma Empresa, que não respeitem 11 horas de descanso, ou de quem ainda não tenha 18 anos na data do turno.',
      ],
    },
    {
      heading: '7. Obrigações de entidade empregadora',
      paragraphs: [
        'Todas as obrigações de entidade empregadora são da Empresa, incluindo: a forma do contrato de trabalho; a comunicação da admissão à Segurança Social antes do início do trabalho; as contribuições e retenções devidas; o seguro de acidentes de trabalho; a segurança e saúde no trabalho e o registo dos tempos de trabalho; e a verificação de que o trabalhador está autorizado a trabalhar em Portugal. As verificações da secção 6 são uma ajuda e não substituem o cumprimento pela Empresa.',
        'Quando um trabalhador confirma um turno, os dados necessários à comunicação da admissão — nome e NIF do trabalhador, função, data, horário, local e valor/hora — ficam de imediato disponíveis no painel da Empresa, para copiar ou exportar. A Turnos não comunica a admissão nem envia estes dados a terceiros. A comunicação é da responsabilidade da Empresa e deve ser feita antes do início do trabalho.',
      ],
    },
    {
      heading: '8. Pagar o trabalhador',
      bullets: [
        'A Empresa paga ao trabalhador o valor bruto por inteiro, diretamente, pelo método escolhido na publicação. A Turnos não intervém no fluxo do dinheiro.',
        'O pagamento é devido quando o trabalho termina. A Turnos envia lembretes 8, 24 e 48 horas depois; ao fim de 72 horas sem pagamento registado, a Empresa fica impedida de publicar novos turnos até regularizar.',
        'Turnos Pay Link: link de pagamento Stripe cujo beneficiário é o próprio trabalhador, pago por cartão ou MB WAY. O valor inclui a taxa de processamento da Stripe, suportada pela Empresa. A Turnos não recebe qualquer parte deste pagamento.',
        'Transferência ou MB WAY: a Turnos mostra o IBAN do trabalhador apenas se ele o tiver autorizado. Ao marcar como pago, a Empresa anexa o comprovativo ou indica porque não o tem.',
        'Antes de pagar, a Empresa pode ajustar as horas efetivamente trabalhadas (mínimo 2 horas) ou reportar um problema, que suspende os lembretes e é analisado pela Turnos em até 48 horas.',
        'A Empresa não contesta junto do banco (chargeback) um pagamento Pay Link por trabalho efetivamente prestado; divergências resolvem-se pelos meios acima.',
      ],
    },
    {
      heading: '9. Cancelamentos e faltas',
      paragraphs: [
        'Aplica-se a Política de Cancelamento e Faltas. Em resumo:',
      ],
      table: {
        head: ['Cancelamento pela Empresa', 'Consequência'],
        rows: [
          ['Mais de 24 h antes', 'Nenhuma'],
          ['Entre 24 h e 3 h antes', 'Registo na fiabilidade da Empresa'],
          ['Menos de 3 h antes, por erro ou decisão própria', `Paga 2 h ao trabalhador (Pay Link) + taxa de ${TURNOS_FEE_FIXED_EUR} €`],
          ['Menos de 3 h antes, por motivo justificado', 'Analisado pela Turnos; o mínimo de 2 h pode não ser devido'],
          ['Turno terminado mais cedo', 'Paga as horas trabalhadas ou 2 h, o que for maior'],
        ],
      },
      bullets: [
        'A Empresa regista faltas do trabalhador na página do turno. Uma falta registada tem consequências graves para o trabalhador (avaliação de 1★, suspensão, bloqueio); registar uma falta que não aconteceu é uma violação grave destes termos.',
      ],
    },
    {
      heading: '10. Avaliações',
      paragraphs: [
        'A Empresa pode avaliar cada trabalhador (1 a 5 estrelas e um comentário até 150 caracteres, visível para outras empresas). As avaliações têm de ser verdadeiras e respeitosas. Os trabalhadores também avaliam a Empresa; essas avaliações são internas à Turnos.',
      ],
    },
    {
      heading: '11. Dados dos trabalhadores',
      bullets: [
        'A Empresa usa os dados dos trabalhadores apenas para escolher, contratar, gerir e pagar, e para cumprir as suas obrigações legais — finalidades para as quais é responsável pelo tratamento.',
        'Os dados de cada contratação que a Empresa consulta ou exporta no painel (secção 7) são-lhe disponibilizados para cumprir as suas obrigações de entidade empregadora; a partir daí, a Empresa trata-os como responsável.',
        'É proibido extrair em massa perfis de trabalhadores ou usá-los fora da Turnos para outros fins.',
      ],
    },
    {
      heading: '12. Suspensão e encerramento',
      paragraphs: [
        'A Turnos pode suspender a publicação ou a conta da Empresa por salário por pagar há mais de 72 horas, subscrição por pagar, faltas falsamente registadas, cancelamentos tardios repetidos, discriminação ou assédio, ou chargeback abusivo, e informa a Empresa do motivo e de como regularizar. Suspensão ou encerramento não extinguem salários ou taxas já devidos.',
      ],
    },
    {
      heading: '13. Responsabilidade',
      paragraphs: [
        'A Turnos não garante o preenchimento de nenhum turno nem a qualidade do trabalho de nenhum trabalhador, e não responde pelas obrigações da Empresa enquanto entidade empregadora.',
      ],
    },
    {
      heading: '14. Duração, alterações e lei aplicável',
      paragraphs: [
        'Estes termos vigoram enquanto a Empresa tiver conta. Alterações significativas são comunicadas com 30 dias de antecedência e aceites no dashboard; a Empresa pode cancelar antes de produzirem efeitos. Aplica-se a lei portuguesa.',
        `Contactos: ${SUPPORT_EMAIL}.`,
      ],
    },
  ],
};

export const COMPANY_TERMS = { pt } as const;
