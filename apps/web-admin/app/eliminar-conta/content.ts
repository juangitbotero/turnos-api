/**
 * Account deletion — public page, PT and EN.
 *
 * Google Play requires a web link where a user can ask for their account to be
 * deleted without having the app installed; it goes into Play Console → Data
 * safety. The in-app flow (Profile → Delete my account) stays the primary
 * route; this page explains it and gives the email route for anyone who has
 * uninstalled the app, and for companies, which have no self-service deletion.
 *
 * What is erased and kept must match privacy policy section 9 and
 * UsersService.deleteWorkerAccount() — change all three together.
 */

import { SUPPORT_EMAIL, LEGAL_ENTITY } from '@turnos/shared';
import type { LegalDoc } from '../../components/LegalDocPage';

const pt: LegalDoc = {
  back: '← Voltar',
  title: 'Eliminar a tua conta Turnos',
  updated: 'Última atualização: 1 de novembro de 2026',
  lede:
    `Esta página explica como eliminar uma conta Turnos (aplicação Turnos, de ${LEGAL_ENTITY.name}) ` +
    'e que dados são apagados ou conservados.',
  sections: [
    {
      heading: '1. Trabalhadores — na aplicação',
      paragraphs: [
        'Abre a aplicação Turnos e vai a Perfil → Eliminar a minha conta. Confirma e a conta é eliminada de imediato. Não precisas de nos contactar.',
      ],
    },
    {
      heading: '2. Trabalhadores — sem a aplicação',
      paragraphs: [
        `Se já não tens a aplicação, envia um email para ${SUPPORT_EMAIL} com o assunto "Eliminar conta" e o número de telemóvel com que te registaste. Para confirmar que a conta é tua, podemos pedir-te que confirmes o pedido a partir desse número. Eliminamos a conta no prazo máximo de 30 dias e avisamos-te quando estiver feito.`,
      ],
    },
    {
      heading: '3. Empresas',
      paragraphs: [
        `Envia um email para ${SUPPORT_EMAIL} a partir do email da conta, com o assunto "Eliminar conta" e o NIPC da empresa. A subscrição é cancelada e a conta eliminada no prazo máximo de 30 dias. As faturas já emitidas são conservadas pelo prazo exigido pela lei fiscal.`,
      ],
    },
    {
      heading: '4. O que é apagado',
      paragraphs: [
        'O teu nome, telemóvel, data de nascimento, NIF, IBAN, fotografia, CV, biografia, funções, documentos profissionais, idiomas, experiência, disponibilidade e as notificações da caixa de entrada. Deixas de receber qualquer notificação.',
      ],
    },
    {
      heading: '5. O que é conservado e porquê',
      paragraphs: [
        'Os registos de contrato e o registo de auditoria das verificações legais, porque a lei obriga a conservá-los (art. 17.º/3/b RGPD). Ficam associados a um identificador sem nome nem contactos, pelo prazo legal de conservação aplicável à relação laboral.',
        'Não é possível eliminar a conta enquanto tiveres um turno confirmado por realizar ou um pagamento por receber — no segundo caso, para que não fiques sem prova do que te é devido.',
      ],
    },
    {
      heading: '6. Mais informação',
      paragraphs: [
        'Os detalhes estão na Política de Privacidade, em turnos.cc/privacidade.',
      ],
    },
  ],
};

const en: LegalDoc = {
  back: '← Back',
  title: 'Delete your Turnos account',
  updated: 'Last updated: 1 November 2026',
  lede:
    `This page explains how to delete a Turnos account (the Turnos app, by ${LEGAL_ENTITY.name}) ` +
    'and which data is erased or kept.',
  sections: [
    {
      heading: '1. Workers — in the app',
      paragraphs: [
        'Open the Turnos app and go to Profile → Delete my account. Confirm, and the account is deleted immediately. You do not need to contact us.',
      ],
    },
    {
      heading: '2. Workers — without the app',
      paragraphs: [
        `If you no longer have the app, email ${SUPPORT_EMAIL} with the subject "Delete account" and the phone number you signed up with. To make sure the account is yours, we may ask you to confirm the request from that number. We delete the account within 30 days at most and tell you when it is done.`,
      ],
    },
    {
      heading: '3. Companies',
      paragraphs: [
        `Email ${SUPPORT_EMAIL} from the account's email address, with the subject "Delete account" and the company's NIPC. The subscription is cancelled and the account deleted within 30 days at most. Invoices already issued are kept for the period tax law requires.`,
      ],
    },
    {
      heading: '4. What is erased',
      paragraphs: [
        'Your name, phone number, date of birth, NIF, IBAN, photo, CV, bio, roles, professional documents, languages, experience, availability and your inbox notifications. You stop receiving any notification.',
      ],
    },
    {
      heading: '5. What is kept, and why',
      paragraphs: [
        'Contract records and the audit trail of legal checks, because the law requires them to be kept (GDPR Art. 17(3)(b)). They remain attached to an identifier carrying no name and no contact details, for the statutory retention period of the employment relationship.',
        'You cannot delete your account while you have a confirmed shift still to work or a payment still outstanding — the second, so that you are not left without evidence of what you are owed.',
      ],
    },
    {
      heading: '6. More information',
      paragraphs: [
        'The details are in the Privacy Policy, at turnos.cc/privacidade.',
      ],
    },
  ],
};

export const DELETION = { pt, en } as const;
