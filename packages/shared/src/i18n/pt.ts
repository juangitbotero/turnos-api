/**
 * Portuguese catalogue — the CANONICAL shape. `en.ts` is typed against this,
 * so any key added here must be translated there or the build fails.
 *
 * Namespaces: common (shared widgets/actions) · domain (label maps for stored
 * enums) · mobile · admin · home. Keep keys grouped by screen so a translator
 * can work through one screen at a time.
 *
 * Portuguese legal terms — MCD, Recibo Verde, TSU, Segurança Social — are kept
 * verbatim in BOTH languages and glossed in English on first use. They name
 * specific Portuguese legal instruments; translating them literally would make
 * them unrecognisable to anyone dealing with Portuguese payroll.
 */
export const pt = {
  common: {
    save: 'Guardar',
    saving: 'A guardar...',
    cancel: 'Cancelar',
    back: 'Voltar',
    close: 'Fechar',
    confirm: 'Confirmar',
    continue: 'Continuar',
    remove: 'Remover',
    edit: 'Editar',
    delete: 'Eliminar',
    retry: 'Tentar novamente',
    loading: 'A carregar...',
    search: 'Pesquisar',
    filter: 'Filtrar',
    apply: 'Aplicar',
    seeDetails: 'Ver detalhes',
    seeAll: 'Ver todos',
    yes: 'Sim',
    no: 'Não',
    optional: '(opcional)',
    required: 'obrigatório',
    error: 'Erro',
    success: 'Sucesso',
    warning: 'Atenção',
    today: 'Hoje',
    tomorrow: 'Amanhã',
    day: 'dia',
    days: 'dias',
    hour: 'hora',
    hours: 'horas',
    perHour: '/hora',
    gross: 'bruto',
    net: 'líquido',
    from: 'de',
    to: 'até',
    sessionExpired: 'Sessão expirada',
    sessionExpiredBody: 'A tua sessão expirou. Por favor inicia sessão novamente.',
    signIn: 'Iniciar sessão',
    genericError: 'Ocorreu um erro. Tenta novamente.',
    language: 'Idioma',
  },

  domain: {
    experienceLevels: {
      NONE:      'Sem experiência',
      ZERO_ONE:  '0–1 anos de experiência',
      ONE_FIVE:  '1–5 anos de experiência',
      FIVE_PLUS: '5+ anos de experiência',
    },
    experienceLevelsShort: {
      NONE:      'Sem exp.',
      ZERO_ONE:  '0–1 anos',
      ONE_FIVE:  '1–5 anos',
      FIVE_PLUS: '5+ anos',
    },
    paymentMethods: {
      TURNOS_PAY_LINK: 'Turnos Pay Link',
      TRANSFERENCIA:   'Transferência bancária',
      MBWAY:           'MB WAY',
    },
    shiftStatus: {
      DRAFT:              'Rascunho',
      OPEN:               'Aberto',
      PENDING_ACCEPTANCE: 'A aguardar trabalhador',
      FILLED:             'Preenchido',
      ACTIVE:             'Ativo',
      COMPLETED:          'Concluído',
      CANCELLED:          'Cancelado',
      EXPIRED:            'Caducado',
    },
    applicationStatus: {
      PENDING:   'Pendente',
      APPROVED:  'Confirmado',
      REJECTED:  'Rejeitado',
      WITHDRAWN: 'Retirado',
    },
    workerStatus: {
      INCOMPLETE:     'Perfil incompleto',
      PENDING_REVIEW: 'A aguardar aprovação',
      ACTIVE:         'Ativo',
      SUSPENDED:      'Suspenso',
      REJECTED:       'Rejeitado',
    },
    badges: {
      TOP_RATED: 'Top Rated',
      RELIABLE:  'Fiável',
      VERIFIED:  'Verificado',
    },
    ratingTags: {
      pontual:      'Pontual',
      profissional: 'Profissional',
      comunicativo: 'Comunicativo',
      boa_atitude:  'Boa atitude',
    },
    companyCancelReasons: {
      ERRO_EMPRESA:             'Erro / decisão da empresa',
      TRABALHADOR_ATRASADO:     'Trabalhador chegou atrasado',
      TRABALHADOR_INDISPONIVEL: 'Trabalhador incapaz ou indisponível para a função',
      CODIGO_VESTUARIO:         'Incumprimento do código de vestuário/requisitos',
      SAUDE_SEGURANCA:          'Razões de saúde e segurança',
      AVARIA_EQUIPAMENTO:       'Avaria de equipamento essencial',
      EVENTO_CANCELADO:         'Evento cancelado por terceiros',
    },
    workerCancelReasons: {
      DOENCA:     'Doença',
      LESAO:      'Lesão',
      EMERGENCIA: 'Emergência',
      OUTRO:      'Outro',
    },
    weekdaysShort: {
      mon: 'Seg', tue: 'Ter', wed: 'Qua', thu: 'Qui', fri: 'Sex', sat: 'Sáb', sun: 'Dom',
    },
  },

  mobile: {
    nav: {
      shifts:  'Turnos',
      myShifts: 'Os Meus',
      profile: 'Perfil',
    },

    profile: {
      title: 'O Meu Perfil',
      loadError: 'Não foi possível carregar o perfil.',
      noName: 'Nome não definido',
      ratingsCount: '({{count}} aval.)',

      availabilityOn:  '🟢 Disponível para trabalhar',
      availabilityOff: '⚪ Não disponível',
      availabilityOnSub:  'As empresas podem encontrar-te quando procuram trabalhadores.',
      availabilityOffSub: 'Estás oculto na pesquisa das empresas. Podes voltar a ativar quando quiseres.',
      availabilityError: 'Não foi possível atualizar a disponibilidade. Tenta novamente.',
      onDays: 'Nos dias:',

      experiencesTitle: 'AS MINHAS EXPERIÊNCIAS',
      cvTitle: 'CURRÍCULO',
      cvView: 'Ver CV',
      cvUpload: 'Carregar o meu CV · +10pts',

      skills: 'Competências',
      languages: 'Idiomas',

      completenessTitle: 'PERFIL COMPLETO',
      completenessHintLow:  'Completa o perfil para chegares a 80% e seres aprovado.',
      completenessHintHigh: 'Adiciona pelo menos 3 competências para atingires 100%.',

      skillsTitle: 'COMPETÊNCIAS',
      personalDataTitle: 'DADOS PESSOAIS',

      earningsCta:    'Os Meus Ganhos',
      earningsCtaSub: 'Bruto, líquido e TSU por período',
      editCta:        'Editar Perfil',
      editCtaSub:     'Nome, competências, disponibilidade, foto',

      languageTitle: 'IDIOMA DA APLICAÇÃO',
      languageSub:   'Escolhe o idioma em que queres usar a Turnos.',

      logout: 'Terminar sessão',
      logoutConfirmTitle: 'Terminar sessão',
      logoutConfirmBody:  'Tem a certeza que quer sair?',
      logoutConfirmYes:   'Sair',
    },
  },
} as const;

export type TranslationCatalogue = typeof pt;
