/**
 * Privacy policy text, PT and EN.
 *
 * ⚠️ DRAFT — NOT REVIEWED BY A LAWYER. Sent to the law firm with
 * docs/legal/brief-advogados.md.
 *
 * Written from the data flows that actually exist in this codebase, not from a
 * template: every category listed below maps to a real column or a real
 * third-party call. Where a fact was not knowable from the code — the legal
 * entity name, NIPC, registered address, contact email, hosting region — the
 * value is a `[[PLACEHOLDER]]` and must be filled before this page is linked
 * from an app store listing.
 *
 * Load-bearing statements that must not be softened by a later edit:
 *
 *   1. Turnos never holds or transfers wages. The company pays the worker
 *      directly (ADR 007). Any wording implying Turnos processes the wage is
 *      both false and a regulated-activity claim.
 *   2. A worker's IBAN is disclosed to a company ONLY where the worker has
 *      consented (`Worker.ibanShareConsentAt`), and consent is withdrawable
 *      with immediate effect. The gate is server-side
 *      (WagePaymentsService.getEmployerPending); the applicant list returns a
 *      fixed field set without NIF, IBAN or date of birth
 *      (ShiftsService.toApplicantWorker).
 *   3. The automatic consequences in section 6 are the ones the code applies —
 *      if the enforcement ladder changes, this section changes with it.
 *
 * Revised 2026-09-27: date of birth (18+), automated decisions, cancellation
 * justifications (possible health data), payment proofs, declared external
 * income, company-side data, processor list, concrete retention periods,
 * hosting region made a placeholder rather than an unverified claim.
 *
 * Kept out of the shared i18n catalogue deliberately — a legal document is
 * reviewed as a whole, and 100+ catalogue keys would obstruct that review.
 */

import { SUPPORT_EMAIL } from '@turnos/shared';
import type { LegalDoc } from '../../components/LegalDocPage';

type PolicyDoc = LegalDoc;

const CONTROLLER = '[[RAZÃO SOCIAL]]';
const NIPC       = '[[NIPC]]';
const ADDRESS    = '[[MORADA]]';
const EMAIL      = SUPPORT_EMAIL;
const REGION     = '[[REGIÃO DE ALOJAMENTO]]';

const pt: PolicyDoc = {
  back: '← Voltar',
  title: 'Política de Privacidade',
  updated: 'Última atualização: 5 de outubro de 2026',
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
        'A Turnos é um mercado de trabalho: uma plataforma onde empresas publicam turnos de curta duração e trabalhadores se candidatam. A empresa é a entidade empregadora — é ela que define o turno (local, horário, funções, valor/hora), escolhe quem contrata e supervisiona o trabalho. A Turnos não é uma empresa de trabalho temporário nem uma agência de colocação.',
        'O salário é pago diretamente pela empresa ao trabalhador, pelo valor bruto. O dinheiro do salário nunca passa pela Turnos, nem sequer quando é usado o Turnos Pay Link — nesse caso o pagamento é feito diretamente para a conta Stripe do trabalhador. A Turnos cobra apenas as suas próprias taxas, e apenas às empresas.',
        'A Turnos não calcula, retém nem entrega impostos ou contribuições em nome de ninguém. Os valores de TSU que a aplicação mostra são uma simulação informativa.',
      ],
    },
    {
      heading: '3. Que dados recolhemos sobre trabalhadores',
      table: {
        head: ['Categoria', 'Dados', 'Porquê'],
        rows: [
          ['Identificação', 'Nome, número de telemóvel, fotografia de perfil, data de nascimento', 'Criar a conta, autenticar por SMS, identificar-te perante a empresa do turno e confirmar que tens pelo menos 18 anos'],
          ['Fiscais e bancários', 'NIF, IBAN', 'O NIF é necessário para a empresa cumprir as suas obrigações de entidade empregadora; o IBAN serve para a empresa te pagar (ver secção 5)'],
          ['Rendimentos declarados', 'Rendimento mensal fora da Turnos, se o indicares (opcional)', 'Calcular o peso de cada empresa nos teus rendimentos, para prevenir situações de dependência económica'],
          ['Perfil profissional', 'Competências, idiomas, experiência, biografia, CV, disponibilidade', 'Mostrar-te turnos relevantes e permitir que a empresa avalie a tua candidatura'],
          ['Atividade', 'Candidaturas, turnos realizados, check-ins, avaliações, cancelamentos, faltas, suspensões', 'Fazer funcionar o mercado, calcular a tua reputação e aplicar as regras de fiabilidade (secção 6)'],
          ['Justificações', 'Motivo de um cancelamento tardio (doença, lesão, emergência, outro), a descrição que escreveres e, se o enviares ao suporte, um comprovativo', 'Avaliar se o cancelamento é justificado e, se for, retirá-lo do teu registo. Indicar doença ou lesão é um dado de saúde — ver secção 4'],
          ['Pagamentos', 'Estado do pagamento de cada turno, comprovativo carregado pela empresa, a tua confirmação de receção', 'Registar que foste pago e resolver disputas'],
          ['Localização', 'Coordenadas GPS no momento em que lês o QR code', 'Confirmar que estás no local do turno (raio de 200 m). A aplicação só pede acesso à localização enquanto está a ser usada; não recolhemos a tua localização em contínuo nem fora desse momento'],
          ['Técnicos', 'Token de notificações, identificadores de sessão, registos de acesso', 'Enviar-te avisos de turnos e manter a plataforma segura'],
        ],
      },
      bullets: [
        'Calendário: se escolheres adicionar um turno ao calendário do telemóvel, o evento é criado localmente no teu dispositivo. A Turnos não lê nem recebe o conteúdo do teu calendário.',
      ],
    },
    {
      heading: '4. Com que fundamento legal',
      bullets: [
        'Execução do contrato (art. 6.º/1/b RGPD) — criar a conta, apresentar turnos, gerir candidaturas, registar a assiduidade e aplicar as regras de fiabilidade dos Termos de Utilização.',
        'Obrigação legal (art. 6.º/1/c RGPD) — limites legais de dias de trabalho e de descanso, idade mínima, e o registo de auditoria destas verificações.',
        'Consentimento (art. 6.º/1/a RGPD) — partilha do teu IBAN com a empresa para a qual trabalhaste, rendimentos declarados fora da Turnos, e notificações. Podes retirar o consentimento a qualquer momento.',
        'Consentimento explícito (art. 9.º/2/a RGPD) — se indicares doença ou lesão como motivo de um cancelamento, ou nos enviares um comprovativo médico. Justificar é sempre opcional; sem justificação, o cancelamento conta como tardio.',
        'Interesse legítimo (art. 6.º/1/f RGPD) — prevenção de fraude na leitura do QR code, e segurança da plataforma.',
      ],
    },
    {
      heading: '5. Partilha do teu IBAN',
      paragraphs: [
        'O teu IBAN só é mostrado a uma empresa se tiveres dado consentimento expresso para isso, através da caixa própria no teu perfil, e apenas a empresas para as quais realizaste um turno com pagamento em falta.',
        'Podes retirar esse consentimento a qualquer momento no perfil, com efeito imediato: a partir desse momento a empresa deixa de ver o IBAN e passa a ter de te pagar pelo Turnos Pay Link ou por MB WAY. Registamos a data em que o consentimento foi dado, porque um consentimento sem data não é comprovável.',
      ],
    },
    {
      heading: '6. Decisões automáticas e reputação',
      paragraphs: [
        'Algumas decisões na Turnos são tomadas por regras automáticas. Queremos que saibas exatamente quais são:',
      ],
      table: {
        head: ['Regra', 'O que acontece'],
        rows: [
          ['Pontuação de perfil', 'Calculada a partir dos campos preenchidos (foto, NIF, IBAN, competências, nome, disponibilidade, CV). Abaixo de 80 pontos não te podes candidatar'],
          ['Idade', 'Sem data de nascimento, ou com menos de 18 anos na data do turno, não te podes candidatar nem aceitar convites'],
          ['Limites legais', 'Não te podes candidatar se o turno ultrapassar 70 dias por ano com a mesma empresa ou não respeitar 11 horas de descanso'],
          ['Ordem das notificações', 'Quando um turno é publicado, os trabalhadores com competências compatíveis são avisados por esta ordem: favoritos da empresa, trabalhadores com o selo TOP, restantes'],
          ['Cancelamento tardio', 'Cancelar um turno confirmado a menos de 24 h do início conta como cancelamento tardio. Dois em 30 dias suspendem as candidaturas durante 7 dias'],
          ['Falta', 'Quando a empresa regista uma falta: avaliação automática de 1 estrela e suspensão de 30 dias. Uma segunda falta bloqueia a conta'],
          ['Selos', 'TOP, FIÁVEL e VERIFICADO são atribuídos automaticamente a partir das avaliações, faltas e estado da conta'],
        ],
      },
      bullets: [
        'Tens o direito de pedir que uma pessoa da equipa Turnos reveja qualquer uma destas decisões, de apresentar o teu ponto de vista e de a contestar. Escreve para o email da secção 1; respondemos em até 48 horas.',
        'Uma justificação aceite (por exemplo, doença comprovada) retira o cancelamento tardio do teu registo.',
      ],
    },
    {
      heading: '7. Com quem partilhamos',
      paragraphs: [
        'Não vendemos dados pessoais. Partilhamos apenas o necessário, e apenas com:',
      ],
      table: {
        head: ['Quem', 'O quê', 'Para quê'],
        rows: [
          ['Empresas a que te candidatas', 'Nome, foto, biografia, CV, competências, idiomas, experiência, disponibilidade, avaliações, selos e número de faltas. Nunca o NIF, a data de nascimento ou os rendimentos declarados', 'Avaliar a tua candidatura'],
          ['A empresa do turno', 'O acima, mais o IBAN se consentires (secção 5) e, quando confirmas o turno, o teu NIF e os dados do turno (função, data, horário, local e valor/hora)', 'Pagar-te e cumprir as obrigações de entidade empregadora, incluindo comunicar a tua admissão à Segurança Social'],
          ['Stripe', 'Identificação, dados bancários e verificação de identidade dos trabalhadores que ativem o Pay Link', 'Processar o pagamento direto da empresa para o trabalhador'],
          ['Twilio', 'Número de telemóvel', 'Envio do código SMS de início de sessão'],
          ['Expo', 'Token de notificação', 'Envio de notificações'],
          ['Brevo (fornecedor de email)', 'Endereço de email e conteúdo das mensagens', 'Envio de emails transacionais'],
          ['Google', 'Dados da conta Google, se a usares para entrar', 'Início de sessão'],
          ['Cloudflare, Railway', 'Ficheiros e dados alojados', 'Alojamento e armazenamento da plataforma'],
          ['Autoridades', 'O que for legalmente exigido', 'ACT, Segurança Social, Autoridade Tributária, tribunais'],
        ],
      },
    },
    {
      heading: '8. Durante quanto tempo guardamos',
      bullets: [
        'Dados do perfil: enquanto a conta existir.',
        'Registo de auditoria das verificações legais e registos de contrato: pelo prazo legal de conservação aplicável à relação laboral, mesmo depois de eliminares a conta, associados a um identificador sem nome nem contactos.',
        'Comprovativos de pagamento: 24 meses após o pagamento, ou até ao fim de uma disputa em curso.',
        'Justificações de cancelamento e respetivos comprovativos: 6 meses após a decisão.',
        'Histórico de turnos e pagamentos: conservado de forma anonimizada após a eliminação da conta.',
        'Registos técnicos de acesso: 12 meses.',
      ],
    },
    {
      heading: '9. Eliminar a tua conta',
      paragraphs: [
        'Podes eliminar a conta a qualquer momento na aplicação, em Perfil → Eliminar a minha conta. Não precisas de nos contactar.',
        'Ao eliminares, apagamos o teu nome, telemóvel, data de nascimento, NIF, IBAN, fotografia, CV, biografia, competências, idiomas, experiência e disponibilidade, e deixas de receber qualquer notificação.',
        'Não podemos apagar os registos de contrato e o registo de auditoria das verificações legais: a lei obriga-nos a conservá-los (art. 17.º/3/b RGPD). Esses registos ficam associados a um identificador sem nome nem contactos.',
        'Não é possível eliminar a conta enquanto tiveres um turno confirmado por realizar ou um pagamento por receber — no segundo caso, para que não fiques sem prova do que te é devido.',
      ],
    },
    {
      heading: '10. Se representas uma empresa',
      paragraphs: [
        'Recolhemos a denominação social, NIPC, NIF, morada, setor, logótipo, o email e o nome de quem gere a conta. Servem para criar a conta e faturar a subscrição e as taxas. Os dados de cartão são recolhidos e guardados pela Stripe, não pela Turnos.',
        'Os dados de cada contratação que consultas ou exportas no painel servem para cumprires as tuas obrigações de entidade empregadora. A Turnos não os envia a terceiros em teu nome; a partir do momento em que os recebes, tratas esses dados como responsável.',
      ],
    },
    {
      heading: '11. Os teus direitos',
      paragraphs: [
        `Tens direito de acesso, retificação, apagamento, limitação, portabilidade e oposição, a retirar o consentimento a qualquer momento, e a não ficar sujeito a uma decisão exclusivamente automática sem poderes pedir revisão humana (secção 6). Exerce-os em ${EMAIL}; respondemos no prazo de 30 dias.`,
        'Se considerares que os teus dados não estão a ser tratados corretamente, podes apresentar reclamação à Comissão Nacional de Proteção de Dados (CNPD), www.cnpd.pt.',
      ],
    },
    {
      heading: '12. Segurança e onde estão os dados',
      paragraphs: [
        `As palavras-passe são guardadas com hash, as sessões usam tokens de curta duração e todo o tráfego é cifrado em trânsito. Os dados são alojados em ${REGION}.`,
        'Alguns subcontratantes (Stripe, Twilio, Expo, Google, Cloudflare) podem tratar dados fora do Espaço Económico Europeu, ao abrigo das cláusulas contratuais-tipo da Comissão Europeia ou de uma decisão de adequação.',
      ],
    },
    {
      heading: '13. Menores',
      paragraphs: [
        'A Turnos destina-se a maiores de 18 anos. Pedimos a data de nascimento no registo e confirmamos que tens pelo menos 18 anos na data de cada turno a que te candidatas. Se tomarmos conhecimento de uma conta de menor, eliminamo-la.',
      ],
    },
    {
      heading: '14. Alterações a esta política',
      paragraphs: [
        'Se alterarmos esta política de forma significativa, avisamos-te na aplicação antes de a alteração produzir efeitos. A data no topo indica sempre a versão em vigor.',
      ],
    },
  ],
};

const en: PolicyDoc = {
  back: '← Back',
  title: 'Privacy Policy',
  updated: 'Last updated: 5 October 2026',
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
        'Turnos is a labour marketplace: a platform where companies post short shifts and workers apply. The company is the employer — it defines the shift (location, hours, tasks, hourly rate), chooses who to hire and supervises the work. Turnos is neither a temporary work agency nor a placement agency.',
        'Wages are paid directly by the company to the worker, in full gross. Wage money never passes through Turnos, not even when the Turnos Pay Link is used — in that case payment goes straight to the worker’s Stripe account. Turnos invoices only its own fees, and only to companies.',
        'Turnos does not calculate, withhold or pay any tax or contribution on anyone’s behalf. The TSU figures shown in the app are an informative simulation.',
      ],
    },
    {
      heading: '3. What we collect about workers',
      table: {
        head: ['Category', 'Data', 'Why'],
        rows: [
          ['Identity', 'Name, mobile number, profile photo, date of birth', 'Create your account, authenticate by SMS, identify you to the company running the shift, and confirm you are at least 18'],
          ['Tax and banking', 'NIF, IBAN', 'The NIF is needed for the company to meet its duties as employer; the IBAN is how the company pays you (see section 5)'],
          ['Declared income', 'Monthly income outside Turnos, if you choose to give it (optional)', 'Work out each company’s share of your income, to prevent economic dependency'],
          ['Professional profile', 'Skills, languages, experience, bio, CV, availability', 'Show you relevant shifts and let a company assess your application'],
          ['Activity', 'Applications, completed shifts, check-ins, ratings, cancellations, no-shows, suspensions', 'Run the marketplace, calculate your reputation and apply the reliability rules (section 6)'],
          ['Justifications', 'Reason for a late cancellation (illness, injury, emergency, other), the description you write and, if you send it to support, a supporting document', 'Decide whether the cancellation is justified and, if so, remove it from your record. Stating illness or injury is health data — see section 4'],
          ['Payments', 'Payment status for each shift, proof uploaded by the company, your confirmation of receipt', 'Record that you were paid and resolve disputes'],
          ['Location', 'GPS coordinates at the moment you scan the QR code', 'Confirm you are at the shift location (200 m radius). The app only asks for location while it is in use; we do not track your location continuously or at any other time'],
          ['Technical', 'Notification token, session identifiers, access logs', 'Send you shift alerts and keep the platform secure'],
        ],
      },
      bullets: [
        'Calendar: if you choose to add a shift to your phone’s calendar, the event is created locally on your device. Turnos does not read or receive the contents of your calendar.',
      ],
    },
    {
      heading: '4. Legal bases',
      bullets: [
        'Performance of a contract (GDPR Art. 6(1)(b)) — creating your account, showing shifts, handling applications, recording attendance and applying the reliability rules in the Terms of Use.',
        'Legal obligation (Art. 6(1)(c)) — statutory limits on working days and rest, the minimum age, and the audit trail of those checks.',
        'Consent (Art. 6(1)(a)) — sharing your IBAN with a company you worked for, declared outside income, and notifications. You can withdraw consent at any time.',
        'Explicit consent (Art. 9(2)(a)) — if you give illness or injury as the reason for a cancellation, or send us a medical document. Justifying is always optional; without a justification the cancellation counts as late.',
        'Legitimate interest (Art. 6(1)(f)) — fraud prevention on QR check-in, and platform security.',
      ],
    },
    {
      heading: '5. Sharing your IBAN',
      paragraphs: [
        'Your IBAN is shown to a company only if you have given explicit consent through the checkbox in your profile, and only to companies where you worked a shift with a payment still outstanding.',
        'You can withdraw that consent at any time in your profile, with immediate effect: from then on the company can no longer see the IBAN and must pay you through the Turnos Pay Link or MB WAY. We record the date consent was given, because consent without a date cannot be evidenced.',
      ],
    },
    {
      heading: '6. Automated decisions and reputation',
      paragraphs: [
        'Some decisions on Turnos are made by automatic rules. We want you to know exactly which ones:',
      ],
      table: {
        head: ['Rule', 'What happens'],
        rows: [
          ['Profile score', 'Calculated from the fields you have filled in (photo, NIF, IBAN, skills, name, availability, CV). Below 80 points you cannot apply'],
          ['Age', 'Without a date of birth, or if you will be under 18 on the day of the shift, you cannot apply or accept invitations'],
          ['Legal limits', 'You cannot apply if the shift would take you over 70 days a year with the same company, or break the 11-hour rest period'],
          ['Notification order', 'When a shift is posted, workers with matching skills are notified in this order: the company’s favourites, workers with the TOP badge, everyone else'],
          ['Late cancellation', 'Cancelling a confirmed shift less than 24 h before it starts counts as a late cancellation. Two within 30 days suspend applications for 7 days'],
          ['No-show', 'When the company records a no-show: an automatic 1-star rating and a 30-day suspension. A second no-show blocks the account'],
          ['Badges', 'TOP, RELIABLE and VERIFIED are awarded automatically from ratings, no-shows and account status'],
        ],
      },
      bullets: [
        'You have the right to ask a person on the Turnos team to review any of these decisions, to give your side and to contest it. Write to the email in section 1; we reply within 48 hours.',
        'An accepted justification (for example, documented illness) removes the late cancellation from your record.',
      ],
    },
    {
      heading: '7. Who we share with',
      paragraphs: [
        'We do not sell personal data. We share only what is necessary, and only with:',
      ],
      table: {
        head: ['Who', 'What', 'Why'],
        rows: [
          ['Companies you apply to', 'Name, photo, bio, CV, skills, languages, experience, availability, ratings, badges and number of no-shows. Never your NIF, date of birth or declared income', 'Assess your application'],
          ['The company running the shift', 'The above, plus your IBAN if you consent (section 5) and, once you confirm the shift, your NIF and the shift details (role, date, hours, location and hourly rate)', 'Pay you and meet its duties as employer, including notifying Social Security of your hire'],
          ['Stripe', 'Identity, bank details and identity verification of workers who activate the Pay Link', 'Process the direct payment from company to worker'],
          ['Twilio', 'Mobile number', 'Send the SMS sign-in code'],
          ['Expo', 'Notification token', 'Send notifications'],
          ['Brevo (email provider)', 'Email address and message content', 'Send transactional emails'],
          ['Google', 'Google account details, if you use it to sign in', 'Sign-in'],
          ['Cloudflare, Railway', 'Hosted files and data', 'Platform hosting and storage'],
          ['Authorities', 'Whatever is legally required', 'ACT, Social Security, tax authority, courts'],
        ],
      },
    },
    {
      heading: '8. How long we keep it',
      bullets: [
        'Profile data: for as long as the account exists.',
        'Audit trail of legal checks and contract records: for the statutory retention period applicable to the employment relationship, even after you delete your account, attached to an identifier with no name or contact details.',
        'Payment proofs: 24 months after payment, or until an open dispute is resolved.',
        'Cancellation justifications and their supporting documents: 6 months after the decision.',
        'Shift and payment history: retained in anonymised form after account deletion.',
        'Technical access logs: 12 months.',
      ],
    },
    {
      heading: '9. Deleting your account',
      paragraphs: [
        'You can delete your account at any time in the app, under Profile → Delete my account. You do not need to contact us.',
        'When you do, we erase your name, phone number, date of birth, NIF, IBAN, photo, CV, bio, skills, languages, experience and availability, and you stop receiving any notification.',
        'We cannot erase contract records or the audit trail of legal checks: the law requires us to keep them (GDPR Art. 17(3)(b)). Those records remain attached to an identifier carrying no name and no contact details.',
        'You cannot delete your account while you have a confirmed shift still to work or a payment still outstanding — the second, so that you are not left without evidence of what you are owed.',
      ],
    },
    {
      heading: '10. If you represent a company',
      paragraphs: [
        'We collect the company name, NIPC, NIF, address, sector, logo, the name and email of the person managing the account. We use them to create the account and invoice the subscription and fees. Card details are collected and stored by Stripe, not by Turnos.',
        'The hire details you view or export in the dashboard are there so you can meet your duties as employer. Turnos does not send them to anyone on your behalf; once you receive them, you process them as controller.',
      ],
    },
    {
      heading: '11. Your rights',
      paragraphs: [
        `You have the right of access, rectification, erasure, restriction, portability and objection, to withdraw consent at any time, and not to be subject to a solely automated decision without being able to ask for human review (section 6). Exercise them at ${EMAIL}; we respond within 30 days.`,
        'If you believe your data is not being handled properly, you may complain to the Portuguese data protection authority, Comissão Nacional de Proteção de Dados (CNPD), www.cnpd.pt.',
      ],
    },
    {
      heading: '12. Security and where data lives',
      paragraphs: [
        `Passwords are hashed, sessions use short-lived tokens, and all traffic is encrypted in transit. Data is hosted in ${REGION}.`,
        'Some processors (Stripe, Twilio, Expo, Google, Cloudflare) may process data outside the European Economic Area under the European Commission’s standard contractual clauses or an adequacy decision.',
      ],
    },
    {
      heading: '13. Minors',
      paragraphs: [
        'Turnos is for people aged 18 and over. We ask for your date of birth when you sign up and check that you will be at least 18 on the day of every shift you apply to. If we learn of an account belonging to a minor, we delete it.',
      ],
    },
    {
      heading: '14. Changes to this policy',
      paragraphs: [
        'If we change this policy materially, we will tell you in the app before the change takes effect. The date at the top always identifies the version in force.',
      ],
    },
  ],
};

export const POLICY = { pt, en } as const;
