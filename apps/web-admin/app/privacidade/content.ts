/**
 * Privacy policy text, PT and EN.
 *
 * ⚠️ DRAFT — NOT REVIEWED BY A LAWYER.
 *
 * Written from the data flows that actually exist in this codebase, not from a
 * template: every category listed below maps to a real column or a real
 * third-party call. Where a fact was not knowable from the code — the legal
 * entity name, NIPC, registered address, DPO contact — the value is a
 * `[[PLACEHOLDER]]` and must be filled before this page is linked from an app
 * store listing.
 *
 * Two things in here are load-bearing and must not be softened by a later edit:
 *
 *   1. Turnos never holds or transfers wages. The company pays the worker
 *      directly (ADR 007). Any wording implying Turnos processes the wage is
 *      both false and a regulated-activity claim.
 *   2. A worker's IBAN is disclosed to a company ONLY where the worker has
 *      consented (`Worker.ibanShareConsentAt`), and consent is withdrawable
 *      with immediate effect. The gate is server-side.
 *
 * Kept out of the shared i18n catalogue deliberately — a legal document is
 * reviewed as a whole, and 100+ catalogue keys would obstruct that review.
 */

export interface PolicySection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  table?: { head: string[]; rows: string[][] };
}

export interface PolicyDoc {
  back: string;
  title: string;
  updated: string;
  lede: string;
  sections: PolicySection[];
}

const CONTROLLER = '[[RAZÃO SOCIAL]]';
const NIPC       = '[[NIPC]]';
const ADDRESS    = '[[MORADA]]';
const EMAIL      = '[[EMAIL DE CONTACTO]]';

const pt: PolicyDoc = {
  back: '← Voltar',
  title: 'Política de Privacidade',
  updated: 'Última atualização: 9 de setembro de 2026',
  lede:
    'Esta política explica que dados a Turnos recolhe, porquê, com quem os partilha e que direitos tens. ' +
    'Está escrita para ser lida — se alguma coisa não for clara, escreve-nos.',
  sections: [
    {
      heading: '1. Quem é o responsável pelo tratamento',
      paragraphs: [
        `${CONTROLLER}, NIPC ${NIPC}, com sede em ${ADDRESS} ("Turnos"), é a entidade responsável pelo tratamento dos dados pessoais descritos nesta política.`,
        `Para qualquer questão sobre privacidade ou para exerceres os teus direitos: ${EMAIL}.`,
      ],
    },
    {
      heading: '2. O que a Turnos é — e o que não é',
      paragraphs: [
        'A Turnos é um mercado de trabalho que liga empresas a trabalhadores para turnos de curta duração. A empresa é a entidade empregadora; a Turnos não é uma empresa de trabalho temporário nem uma agência de colocação.',
        'O salário é pago diretamente pela empresa ao trabalhador. O dinheiro do salário nunca passa pela Turnos, nem sequer quando é usado o Turnos Pay Link — nesse caso o pagamento é feito diretamente para a conta Stripe do trabalhador. A Turnos cobra apenas as suas próprias taxas às empresas.',
      ],
    },
    {
      heading: '3. Que dados recolhemos',
      table: {
        head: ['Categoria', 'Dados', 'Porquê'],
        rows: [
          ['Identificação', 'Nome, número de telemóvel, fotografia de perfil', 'Criar a conta, autenticar por SMS e identificar-te perante a empresa do turno'],
          ['Fiscais e bancários', 'NIF, IBAN', 'Obrigações legais do contrato MCD e da Segurança Social; o IBAN serve para a empresa te pagar'],
          ['Perfil profissional', 'Competências, idiomas, experiência, biografia, CV, disponibilidade', 'Mostrar-te turnos relevantes e permitir que a empresa avalie a tua candidatura'],
          ['Atividade', 'Candidaturas, turnos realizados, check-ins, avaliações, faltas', 'Fazer funcionar o mercado, calcular a tua reputação e cumprir a lei laboral'],
          ['Localização', 'Coordenadas GPS no momento em que leste o QR code', 'Confirmar que estás no local do turno (raio de 200 m). Não recolhemos a tua localização em contínuo nem fora desse momento'],
          ['Técnicos', 'Token de notificações, identificadores de sessão, registos de acesso', 'Enviar-te avisos de turnos e manter a plataforma segura'],
          ['Empresas', 'Denominação social, NIPC, NIF, morada, email, email do contabilista', 'Emitir contratos, comunicar à Segurança Social e faturar a subscrição'],
        ],
      },
    },
    {
      heading: '4. Com que fundamento legal',
      bullets: [
        'Execução do contrato (art. 6.º/1/b RGPD) — criar a conta, apresentar turnos, gerir candidaturas e registar a assiduidade.',
        'Obrigação legal (art. 6.º/1/c RGPD) — contratos de Muito Curta Duração, comunicação à Segurança Social, limites legais de dias e de descanso, e o registo de auditoria exigido pela ACT.',
        'Consentimento (art. 6.º/1/a RGPD) — partilha do teu IBAN com a empresa para a qual trabalhaste, e notificações. Podes retirar o consentimento a qualquer momento.',
        'Interesse legítimo (art. 6.º/1/f RGPD) — prevenção de fraude na leitura do QR code, e segurança da plataforma.',
      ],
    },
    {
      heading: '5. Partilha do teu IBAN',
      paragraphs: [
        'O teu IBAN só é mostrado a uma empresa se tiveres dado consentimento expresso para isso, através da caixa própria no teu perfil, e apenas a empresas para as quais realizaste um turno com pagamento em falta.',
        'Podes retirar esse consentimento a qualquer momento no perfil, com efeito imediato: a partir desse momento a empresa deixa de ver o IBAN e passa a ter de te pagar pelo Turnos Pay Link. Registamos a data em que o consentimento foi dado, porque um consentimento sem data não é comprovável.',
      ],
    },
    {
      heading: '6. Com quem partilhamos',
      paragraphs: [
        'Não vendemos dados pessoais. Partilhamos apenas o necessário, e apenas com:',
      ],
      table: {
        head: ['Quem', 'O quê', 'Para quê'],
        rows: [
          ['A empresa do turno', 'Nome, foto, competências, experiência, avaliações, e o IBAN se consentires', 'Selecionar quem contrata e cumprir as obrigações de entidade empregadora'],
          ['Contabilista da empresa', 'Dados do contrato MCD (nome, NIF, datas, valor)', 'Comunicação à Segurança Social nas 24 h anteriores ao turno'],
          ['Stripe', 'Identificação e dados de conta do trabalhador que ative o Pay Link', 'Processar o pagamento direto da empresa para o trabalhador'],
          ['Twilio', 'Número de telemóvel', 'Envio do código SMS de início de sessão'],
          ['Expo', 'Token de notificação', 'Envio de notificações de novos turnos'],
          ['Cloudflare, Railway', 'Ficheiros e dados alojados', 'Alojamento e armazenamento da plataforma'],
          ['Autoridades', 'O que for legalmente exigido', 'ACT, Segurança Social, Autoridade Tributária, tribunais'],
        ],
      },
    },
    {
      heading: '7. Durante quanto tempo guardamos',
      bullets: [
        'Dados do perfil: enquanto a conta existir.',
        'Contratos MCD, comunicações à Segurança Social e registo de auditoria: pelo prazo legal de conservação aplicável à relação laboral e às obrigações fiscais, mesmo depois de eliminares a conta.',
        'Histórico de turnos e pagamentos: conservado de forma anonimizada após a eliminação da conta.',
        'Registos técnicos de acesso: 12 meses.',
      ],
    },
    {
      heading: '8. Eliminar a tua conta',
      paragraphs: [
        'Podes eliminar a conta a qualquer momento na aplicação, em Perfil → Eliminar a minha conta. Não precisas de nos contactar.',
        'Ao eliminares, apagamos o teu nome, telemóvel, NIF, IBAN, fotografia, CV, competências, idiomas, experiência e disponibilidade, e deixas de receber qualquer notificação.',
        'Não podemos apagar os contratos MCD e as comunicações à Segurança Social já emitidos, nem o registo de auditoria da ACT: a lei portuguesa obriga-nos a conservá-los (art. 17.º/3/b RGPD). Esses registos ficam associados a um identificador sem nome nem contactos.',
        'Não é possível eliminar a conta enquanto tiveres um turno confirmado por realizar ou um pagamento por receber — no segundo caso, para que não fiques sem prova do que te é devido.',
      ],
    },
    {
      heading: '9. Os teus direitos',
      paragraphs: [
        `Tens direito de acesso, retificação, apagamento, limitação, portabilidade e oposição, e a retirar o consentimento a qualquer momento. Exerce-os em ${EMAIL}; respondemos no prazo de 30 dias.`,
        'Se considerares que os teus dados não estão a ser tratados corretamente, podes apresentar reclamação à Comissão Nacional de Proteção de Dados (CNPD), www.cnpd.pt.',
      ],
    },
    {
      heading: '10. Segurança e onde estão os dados',
      paragraphs: [
        'As palavras-passe são guardadas com hash, as sessões usam tokens de curta duração e todo o tráfego é cifrado em trânsito. Os dados são alojados na União Europeia.',
        'Alguns subcontratantes (Stripe, Twilio, Expo, Cloudflare) podem tratar dados fora do Espaço Económico Europeu, ao abrigo das cláusulas contratuais-tipo da Comissão Europeia.',
      ],
    },
    {
      heading: '11. Menores',
      paragraphs: [
        'A Turnos destina-se a maiores de 18 anos. Não recolhemos conscientemente dados de menores; se tomarmos conhecimento de uma conta de menor, eliminamo-la.',
      ],
    },
    {
      heading: '12. Alterações a esta política',
      paragraphs: [
        'Se alterarmos esta política de forma significativa, avisamos-te na aplicação antes de a alteração produzir efeitos. A data no topo indica sempre a versão em vigor.',
      ],
    },
  ],
};

const en: PolicyDoc = {
  back: '← Back',
  title: 'Privacy Policy',
  updated: 'Last updated: 9 September 2026',
  lede:
    'This policy explains what data Turnos collects, why, who we share it with and what rights you have. ' +
    'It is written to be read — if anything is unclear, write to us.',
  sections: [
    {
      heading: '1. Who the data controller is',
      paragraphs: [
        `${CONTROLLER}, NIPC ${NIPC}, registered at ${ADDRESS} ("Turnos"), is the controller responsible for the personal data described in this policy.`,
        `For any privacy question, or to exercise your rights: ${EMAIL}.`,
      ],
    },
    {
      heading: '2. What Turnos is — and is not',
      paragraphs: [
        'Turnos is a labour marketplace connecting companies with workers for short shifts. The company is the employer; Turnos is neither a temporary work agency nor a placement agency.',
        'Wages are paid directly by the company to the worker. Wage money never passes through Turnos, not even when the Turnos Pay Link is used — in that case payment goes straight to the worker’s Stripe account. Turnos invoices only its own fees, and only to companies.',
      ],
    },
    {
      heading: '3. What we collect',
      table: {
        head: ['Category', 'Data', 'Why'],
        rows: [
          ['Identity', 'Name, mobile number, profile photo', 'Create your account, authenticate by SMS, and identify you to the company running the shift'],
          ['Tax and banking', 'NIF, IBAN', 'Legal obligations of the MCD contract and Social Security; the IBAN is how the company pays you'],
          ['Professional profile', 'Skills, languages, experience, bio, CV, availability', 'Show you relevant shifts and let a company assess your application'],
          ['Activity', 'Applications, completed shifts, check-ins, ratings, no-shows', 'Run the marketplace, calculate your reputation and meet labour-law duties'],
          ['Location', 'GPS coordinates at the moment you scan the QR code', 'Confirm you are at the shift location (200 m radius). We do not track your location continuously or at any other time'],
          ['Technical', 'Notification token, session identifiers, access logs', 'Send you shift alerts and keep the platform secure'],
          ['Companies', 'Company name, NIPC, NIF, address, email, accountant email', 'Issue contracts, file with Social Security and bill the subscription'],
        ],
      },
    },
    {
      heading: '4. Legal bases',
      bullets: [
        'Performance of a contract (GDPR Art. 6(1)(b)) — creating your account, showing shifts, handling applications and recording attendance.',
        'Legal obligation (Art. 6(1)(c)) — Muito Curta Duração contracts, Social Security filings, statutory day and rest-period limits, and the audit trail required by the ACT labour authority.',
        'Consent (Art. 6(1)(a)) — sharing your IBAN with a company you worked for, and notifications. You can withdraw consent at any time.',
        'Legitimate interest (Art. 6(1)(f)) — fraud prevention on QR check-in, and platform security.',
      ],
    },
    {
      heading: '5. Sharing your IBAN',
      paragraphs: [
        'Your IBAN is shown to a company only if you have given explicit consent through the checkbox in your profile, and only to companies where you worked a shift with a payment still outstanding.',
        'You can withdraw that consent at any time in your profile, with immediate effect: from then on the company can no longer see the IBAN and must pay you through the Turnos Pay Link. We record the date consent was given, because consent without a date cannot be evidenced.',
      ],
    },
    {
      heading: '6. Who we share with',
      paragraphs: [
        'We do not sell personal data. We share only what is necessary, and only with:',
      ],
      table: {
        head: ['Who', 'What', 'Why'],
        rows: [
          ['The company running the shift', 'Name, photo, skills, experience, ratings, and your IBAN if you consent', 'Choose who to hire and meet their duties as your employer'],
          ['The company’s accountant', 'MCD contract data (name, NIF, dates, amount)', 'Social Security filing in the 24 hours before the shift'],
          ['Stripe', 'Identity and account details of workers who activate the Pay Link', 'Process the direct payment from company to worker'],
          ['Twilio', 'Mobile number', 'Send the SMS sign-in code'],
          ['Expo', 'Notification token', 'Send new-shift notifications'],
          ['Cloudflare, Railway', 'Hosted files and data', 'Platform hosting and storage'],
          ['Authorities', 'Whatever is legally required', 'ACT, Social Security, tax authority, courts'],
        ],
      },
    },
    {
      heading: '7. How long we keep it',
      bullets: [
        'Profile data: for as long as the account exists.',
        'MCD contracts, Social Security filings and the audit trail: for the statutory retention period applicable to employment and tax records, even after you delete your account.',
        'Shift and payment history: retained in anonymised form after account deletion.',
        'Technical access logs: 12 months.',
      ],
    },
    {
      heading: '8. Deleting your account',
      paragraphs: [
        'You can delete your account at any time in the app, under Profile → Delete my account. You do not need to contact us.',
        'When you do, we erase your name, phone number, NIF, IBAN, photo, CV, skills, languages, experience and availability, and you stop receiving any notification.',
        'We cannot erase MCD contracts and Social Security filings already issued, or the ACT audit trail: Portuguese law requires us to keep them (GDPR Art. 17(3)(b)). Those records remain attached to an identifier carrying no name and no contact details.',
        'You cannot delete your account while you have a confirmed shift still to work or a payment still outstanding — the second, so that you are not left without evidence of what you are owed.',
      ],
    },
    {
      heading: '9. Your rights',
      paragraphs: [
        `You have the right of access, rectification, erasure, restriction, portability and objection, and to withdraw consent at any time. Exercise them at ${EMAIL}; we respond within 30 days.`,
        'If you believe your data is not being handled properly, you may complain to the Portuguese data protection authority, Comissão Nacional de Proteção de Dados (CNPD), www.cnpd.pt.',
      ],
    },
    {
      heading: '10. Security and where data lives',
      paragraphs: [
        'Passwords are hashed, sessions use short-lived tokens, and all traffic is encrypted in transit. Data is hosted in the European Union.',
        'Some processors (Stripe, Twilio, Expo, Cloudflare) may process data outside the European Economic Area under the European Commission’s standard contractual clauses.',
      ],
    },
    {
      heading: '11. Minors',
      paragraphs: [
        'Turnos is for people aged 18 and over. We do not knowingly collect data from minors; if we learn of an account belonging to one, we delete it.',
      ],
    },
    {
      heading: '12. Changes to this policy',
      paragraphs: [
        'If we change this policy materially, we will tell you in the app before the change takes effect. The date at the top always identifies the version in force.',
      ],
    },
  ],
};

export const POLICY = { pt, en } as const;
