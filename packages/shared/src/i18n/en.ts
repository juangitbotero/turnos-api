/**
 * English catalogue. Typed as `Translated<TranslationCatalogue>`, so it must
 * mirror `pt.ts` key for key — a missing key is a compile error.
 *
 * Portuguese legal terms are deliberately NOT translated: MCD, Recibo Verde,
 * TSU and Segurança Social name specific Portuguese legal instruments, and an
 * English worker or accountant will encounter them in that form on every
 * official document. They are kept verbatim and glossed on first use.
 */
import type { Translated } from './types';
import type { TranslationCatalogue } from './pt';

export const en: Translated<TranslationCatalogue> = {
  common: {
    save: 'Save',
    saving: 'Saving...',
    cancel: 'Cancel',
    back: 'Back',
    close: 'Close',
    confirm: 'Confirm',
    continue: 'Continue',
    remove: 'Remove',
    edit: 'Edit',
    delete: 'Delete',
    retry: 'Try again',
    loading: 'Loading...',
    search: 'Search',
    filter: 'Filter',
    apply: 'Apply',
    seeDetails: 'See details',
    seeAll: 'See all',
    yes: 'Yes',
    no: 'No',
    optional: '(optional)',
    required: 'required',
    error: 'Error',
    success: 'Success',
    warning: 'Heads up',
    today: 'Today',
    tomorrow: 'Tomorrow',
    day: 'day',
    days: 'days',
    hour: 'hour',
    hours: 'hours',
    perHour: '/hour',
    gross: 'gross',
    net: 'net',
    from: 'from',
    to: 'to',
    sessionExpired: 'Session expired',
    sessionExpiredBody: 'Your session has expired. Please sign in again.',
    signIn: 'Sign in',
    genericError: 'Something went wrong. Please try again.',
    language: 'Language',
  },

  domain: {
    experienceLevels: {
      NONE:      'No experience',
      ZERO_ONE:  '0–1 years of experience',
      ONE_FIVE:  '1–5 years of experience',
      FIVE_PLUS: '5+ years of experience',
    },
    experienceLevelsShort: {
      NONE:      'No exp.',
      ZERO_ONE:  '0–1 yrs',
      ONE_FIVE:  '1–5 yrs',
      FIVE_PLUS: '5+ yrs',
    },
    paymentMethods: {
      // Brand name and Portuguese payment rails — kept as-is
      TURNOS_PAY_LINK: 'Turnos Pay Link',
      TRANSFERENCIA:   'Bank transfer',
      MBWAY:           'MB WAY',
    },
    shiftStatus: {
      DRAFT:              'Draft',
      OPEN:               'Open',
      PENDING_ACCEPTANCE: 'Awaiting worker',
      FILLED:             'Filled',
      ACTIVE:             'In progress',
      COMPLETED:          'Completed',
      CANCELLED:          'Cancelled',
      EXPIRED:            'Expired',
    },
    applicationStatus: {
      PENDING:   'Pending',
      APPROVED:  'Confirmed',
      REJECTED:  'Rejected',
      WITHDRAWN: 'Withdrawn',
    },
    workerStatus: {
      INCOMPLETE:     'Profile incomplete',
      PENDING_REVIEW: 'Awaiting approval',
      ACTIVE:         'Active',
      SUSPENDED:      'Suspended',
      REJECTED:       'Rejected',
    },
    badges: {
      TOP_RATED: 'Top Rated',
      RELIABLE:  'Reliable',
      VERIFIED:  'Verified',
    },
    ratingTags: {
      pontual:      'Punctual',
      profissional: 'Professional',
      comunicativo: 'Communicative',
      boa_atitude:  'Good attitude',
    },
    companyCancelReasons: {
      ERRO_EMPRESA:             'Company error / decision',
      TRABALHADOR_ATRASADO:     'Worker arrived late',
      TRABALHADOR_INDISPONIVEL: 'Worker unable or unavailable for the role',
      CODIGO_VESTUARIO:         'Dress code / requirements not met',
      SAUDE_SEGURANCA:          'Health and safety reasons',
      AVARIA_EQUIPAMENTO:       'Essential equipment failure',
      EVENTO_CANCELADO:         'Event cancelled by a third party',
    },
    workerCancelReasons: {
      DOENCA:     'Illness',
      LESAO:      'Injury',
      EMERGENCIA: 'Emergency',
      OUTRO:      'Other',
    },
    weekdaysShort: {
      mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
    },
  },

  mobile: {
    nav: {
      shifts:   'Shifts',
      myShifts: 'My shifts',
      profile:  'Profile',
    },

    profile: {
      title: 'My Profile',
      loadError: "Couldn't load your profile.",
      noName: 'Name not set',
      ratingsCount: '({{count}} reviews)',

      availabilityOn:  '🟢 Available for work',
      availabilityOff: '⚪ Not available',
      availabilityOnSub:  'Companies can find you when they search for workers.',
      availabilityOffSub: "You're hidden from company searches. You can switch back on any time.",
      availabilityError: "Couldn't update your availability. Please try again.",
      onDays: 'On these days:',

      experiencesTitle: 'MY EXPERIENCE',
      cvTitle: 'CV',
      cvView: 'View CV',
      cvUpload: 'Upload my CV · +10pts',

      skills: 'Skills',
      languages: 'Languages',

      completenessTitle: 'PROFILE COMPLETE',
      completenessHintLow:  'Complete your profile to reach 80% and get approved.',
      completenessHintHigh: 'Add at least 3 skills to reach 100%.',

      skillsTitle: 'SKILLS',
      personalDataTitle: 'PERSONAL DETAILS',

      earningsCta:    'My Earnings',
      // TSU is Portugal's social-security contribution — kept, not translated
      earningsCtaSub: 'Gross, net and TSU by period',
      editCta:        'Edit Profile',
      editCtaSub:     'Name, skills, availability, photo',

      languageTitle: 'APP LANGUAGE',
      languageSub:   'Choose the language you want to use Turnos in.',

      logout: 'Sign out',
      logoutConfirmTitle: 'Sign out',
      logoutConfirmBody:  'Are you sure you want to sign out?',
      logoutConfirmYes:   'Sign out',
    },
  },
};
