/**
 * Portuguese catalogue — the CANONICAL shape. `en.ts` is typed against this,
 * so any key added here must be translated there or the build fails.
 *
 * Namespaces: common (shared widgets/actions) · domain (label maps for stored
 * enums) · mobile · admin · home · api (messages the NestJS API throws). Keep
 * keys grouped by screen so a translator can work through one screen at a time.
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
    company: 'Empresa',
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

    login: {
      tagline: 'Work Today. Staff Today.',   // brand line — same in both languages
      sheetTitle: 'Entrar ou criar conta',
      sheetSub: 'Introduza o seu número de telemóvel. Vamos enviar-lhe um código.',
      phonePlaceholder: '912 345 678',
      continue: 'Continuar →',
      sending: 'A enviar...',
      or: 'ou',
      google: 'Continuar com Google',
      comingSoon: 'Em breve',
      devBypass: '🛠 Dev: entrar sem API',
      invalidPhoneTitle: 'Número inválido',
      invalidPhoneBody: 'Por favor introduza um número de telemóvel válido.',
      sendFailed: 'Não foi possível enviar o código.',
      googleFailed: 'Login com Google falhou.',
      legalPrefix: 'Ao continuar, aceita os',
      legalTerms: 'Termos de Serviço',
      legalAnd: 'e a',
      legalPrivacy: 'Política de Privacidade',
      legalSuffix: 'da Turnos.',
    },

    verify: {
      title: 'Confirma o teu número',
      subtitle: 'Enviámos um código de 6 dígitos para',
      changeNumber: 'Alterar número',
      verify: 'Verificar',
      verifying: 'A verificar...',
      resend: 'Reenviar código',
      resendIn: 'Reenviar em {{seconds}}s',
      resent: 'Código reenviado',
      invalidCode: 'Código inválido. Verifica e tenta novamente.',
      resendFailed: 'Não foi possível reenviar o código.',
      titleAlt: 'Verifique o seu número',
      verifyCode: 'Verificar Código',
      noCode: 'Não recebeu o código?',
      devHint: '🧪 Dev: use o código 123456',
      invalidTryAgain: 'Código inválido. Tente novamente.',
      verifyError: 'Erro ao verificar o código. Tente novamente.',
    },

    feed: {
      greeting: 'Olá, {{name}} 👋',
      greetingNoName: 'Olá 👋',
      subtitle: 'Lisboa · {{count}} turnos disponíveis',
      loading: 'A carregar turnos...',
      searchPlaceholder: 'Pesquisar turnos ou empresa...',
      allCategories: 'Todas',
      profileBanner: 'Perfil {{score}}% completo · Completa para te candidatares →',
      emptyTitle: 'Nenhum turno disponível',
      emptySub: 'Tente outra categoria ou verifique mais tarde',
      urgent: '⚡ Urgente',
      fullGross: 'Recebes o bruto por inteiro',
      multiDayChip: '{{count}} dias',
      company: 'Empresa',
    },

    profile: {
      title: 'O Meu Perfil',
      loadError: 'Não foi possível carregar o perfil.',
      noName: 'Nome não definido',
      ratingsCount: '({{count}} aval.)',

      availabilityOn:  '🟢 Disponível para trabalhar',
      availabilityOff: '⚪ Não disponível',
      // Employer reviews shown on the worker's own profile
      reviewsTitle: 'Avaliações de empresas',
      reviewsEmpty: 'Ainda não recebeste avaliações. Aparecem aqui depois dos teus primeiros turnos.',
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

    /** Phone-calendar sync — shared by the my-shifts hero card and shift detail. */
    calendar: {
      add:           'Adicionar ao calendário',
      addDays:       'Adicionar {{count}} dias ao calendário',
      inCalendar:    'No teu calendário',
      inCalendarTap: 'No teu calendário · tocar para atualizar',
      added:         'Adicionado ao calendário 📅',
      updated:       'Calendário atualizado',
      bodyDays:      '{{count}} dias adicionados, com lembretes 1 dia e 2 horas antes de cada um.',
      bodyOne:       'Com lembretes 1 dia e 2 horas antes do turno.',
      failTitle:     'Não foi possível adicionar',
      failPermission:'A Turnos precisa de permissão para aceder ao teu calendário. Podes ativá-la nas definições do telemóvel.',
      failNoCalendar:'Não encontrámos um calendário onde possamos escrever neste telemóvel.',
      failOther:     'Ocorreu um erro ao aceder ao calendário. Tenta novamente.',
    },

    schedule: {
      list:     'Lista',
      calendar: 'Calendário',
    },

    myShifts: {
      title: 'Os Meus Turnos',
      // Explicit singular/plural pair rather than i18next plural suffixes —
      // Intl.PluralRules is not guaranteed on every Hermes build.
      countOne:   '1 candidatura',
      countOther: '{{count}} candidaturas',
      loading: 'A carregar candidaturas...',

      emptyTitle: 'Ainda sem candidaturas',
      emptySub:   'Explore os turnos disponíveis e candidate-se ao primeiro!',
      emptyCta:   'Ver Turnos',

      sectionActionNeeded: '⚡ Ação necessária',
      sectionActive:       '🟢 Em curso',
      sectionConfirmed:    '✅ Confirmados',
      sectionPending:      '⏳ Pendentes',
      sectionConcluded:    '🏁 Concluídos',
      sectionHistory:      'Histórico',

      badgeActive:    'Em curso',
      badgeCompleted: 'Concluído',

      // Próximo turno hero card
      nextBanner:    'PRÓXIMO TURNO',
      countdownDays: 'Faltam {{count}} dias',
      seriesPill:    'Trabalho de {{count}} dias · {{range}}',
      multiDayChip:  '🔁 {{count}} dias',

      // Pré-selecionado
      preBanner:     'Tens 2h para aceitar este turno',
      accept:        '✓ Aceitar',
      accepting:     'A confirmar...',
      decline:       'Recusar',
      declineTitle:  'Recusar turno?',
      declineBody:   'Tens a certeza que queres recusar este turno? Ele voltará a ficar disponível para outros trabalhadores.',
      confirmFailed: 'Não foi possível confirmar.',
      declineFailed: 'Não foi possível recusar.',

      appliedAt: 'Candidatou-se em {{date}}',
      rate:      '⭐ Avaliar',
      rated:     '✓ Avaliado',

      cancelShift:     'Cancelar turno',
      cancelJob:       'Cancelar trabalho',
      cancelLateBody:  'Faltam menos de 24h para o início. Cancelar agora conta como cancelamento tardio e afeta a tua fiabilidade (2 em 30 dias = suspensão de 7 dias). Queres continuar?',
      cancelFreeBody:  'Tens a certeza que queres cancelar este turno confirmado? Como faltam mais de 24h, não há penalização.',
      cancelAnyway:    'Cancelar mesmo assim',
      cancelYes:       'Sim, cancelar',
      reasonTitle:     'Tens um motivo válido?',
      reasonBody:      'Doença, lesão ou emergência com comprovativo são avaliados pela Turnos — se aceites, o cancelamento tardio é removido do teu registo. Envia o comprovativo para suporte@turnos.pt.',
      reasonIllness:   '🤒 Doença / Lesão',
      reasonEmergency: '🚨 Emergência',
      reasonNone:      'Sem justificação',
      cancelledTitle:  'Turno cancelado',
      cancelFailed:    'Não foi possível cancelar o turno.',

      support:         'Contactar suporte',
      seriesLockTitle: 'Compromisso de vários dias',
      seriesLockBody:  'Aceitaste um trabalho de vários dias que já começou, por isso não podes cancelá-lo aqui. Se tiveres um imprevisto sério, fala com o suporte: suporte@turnos.pt',

      // Trust loop de pagamento
      wageConfirmTitle:  'Confirmar pagamento',
      wageConfirmBody:   'Recebeste €{{amount}} pelo turno "{{shift}}"?',
      wageNotReceived:   '🚩 Não recebi',
      wageReceived:      '✓ Recebi',
      wageFlaggedTitle:  'Registado',
      wageFlaggedBody:   'A equipa Turnos foi notificada e vai acompanhar o caso.',
      wageFlagFailed:    'Não foi possível registar. Tenta novamente.',
      wageConfirmFailed: 'Não foi possível confirmar. Tenta novamente.',
      wagePaidChip:      '💶 €{{amount}} pago via Pay Link ✅',
      wageReceivedChip:  '💶 €{{amount}} recebido ✓',
      wageDisputedChip:  '🚩 Não-pagamento reportado — em análise pela Turnos',
      wagePendingChip:   '💳 €{{amount}} — a aguardar pagamento da empresa via Pay Link',
      wageMarkedChip:    '💶 €{{amount}} — a empresa diz que pagou. Recebeste? →',
      wageAskChip:       '💶 €{{amount}} — já recebeste? Confirma aqui →',
      wageProof:         '📎 Ver comprovativo da empresa',
    },

    shiftDetail: {
      loadError: 'Não foi possível carregar o turno.',

      multiDayTitle:    'Trabalho de vários dias',
      multiDayBody:     'Este trabalho tem {{count}} dias ({{range}}).\n\nAo candidatares-te, comprometes-te a trabalhar TODOS os dias. Não é possível aceitar apenas alguns.',
      multiDayContinue: 'Compreendo, continuar',
      multiDayBanner:   'Este é um trabalho de vários dias. Ao candidatares-te, comprometes-te a trabalhar todos os dias do horário.',

      bannerDone:   '✅ Turno concluído — a empresa paga-te diretamente',
      bannerActive: '🟢 Em curso — conclui automaticamente às {{time}}',
      bannerFilled: '📋 Confirmado — faça check-in ao chegar',

      payGrossHour: 'Bruto/hora',
      payNetHour:   'Recebes/hora (sem taxas)',
      // TSU is Portugal's social-security contribution — informative only, the
      // worker settles it directly with the State.
      tsuNote:      'ℹ️ SS Trabalhador (11%): €{{amount}}/hora — valor informativo, a entregar por ti ao Estado',
      payViaMethod: '💳 Pago pela empresa via {{method}}',
      payDirect:    '💳 Pago diretamente pela empresa',

      labelDays:      'Dias',
      labelDate:      'Data',
      labelSchedule:  'Horário',
      labelDuration:  'Duração',
      labelTotal:     'Total estimado',
      labelAddress:   'Morada',
      valueDays:      '{{count}} dias',
      valueTotalHours:'{{hours}}h no total',
      valueHours:     '{{hours}}h',
      valueGrossTotal:'€{{amount}} bruto',
      mapHint:        'Toque para abrir no mapa →',

      periodTitle:    'Período do trabalho',
      periodShow:     'Ver horário',
      periodHide:     'Ocultar',

      skillsTitle: 'Competências necessárias',
      aboutTitle:  'Sobre o turno',

      doneTitle:     'Turno concluído',
      doneSubHours:  '{{hours}}h concluídas · a empresa paga-te diretamente',
      doneSub:       'A empresa paga-te diretamente',
      checkIn:       '📷 Fazer Check-in',
      inProgress:    'Em curso',
      inProgressSub: 'Conclui automaticamente às {{time}} — não precisas de digitalizar nada à saída',

      estimatedTotal: 'Total estimado',
      apply:          'Candidatar-me',
      applying:       'A candidatar...',
      applyError:     'Erro ao candidatar-se.',
      restTitle:      'Precisas de descansar 😴',
      appliedTitle:   'Candidatura enviada! 🎉',
      appliedBody:    'A tua candidatura foi enviada. Serás notificado quando a empresa responder.',

      chipPending:   'Candidatura enviada — a aguardar confirmação',
      chipRejected:  'Candidatura não selecionada',
      chipCancelled: 'Este turno foi cancelado',

      gateTitle:  'Completa o teu perfil',
      gateSub:    'Precisas de pelo menos 80% de perfil completo para te candidatares a turnos.',
      gateScore:  '{{score}}% / 80% necessário',
      gateCta:    'Completar Perfil',
      gateLater:  'Agora não',

      coverTitle:       'Candidatar-me',
      coverSub:         'Podes deixar uma mensagem curta para o empregador (opcional).',
      coverPlaceholder: 'Ex: Tenho experiência nesta área e estou disponível...',
      coverSend:        'Enviar candidatura 🚀',
      coverSending:     'A enviar...',
    },

    editProfile: {
      title:      'Editar perfil',
      saveAll:    'Guardar alterações',
      saveError:  'Não foi possível guardar as alterações. Tenta novamente.',
      savedTitle: 'Perfil guardado!',
      savedBody:  'As tuas alterações foram guardadas com sucesso.',
      nameRequiredTitle: 'Nome obrigatório',
      nameRequiredBody:  'Por favor introduz o teu nome completo.',

      photoHint:       'Toca para alterar a foto',
      photoPermTitle:  'Permissão necessária',
      photoPermBody:   'Precisamos de acesso à galeria para alterar a foto.',
      photoSavedTitle: 'Foto atualizada!',
      photoSavedBody:  'A tua foto de perfil foi guardada.',
      photoFailed:     'Não foi possível fazer upload da foto. Tenta novamente.',

      nameTitle:       'NOME COMPLETO',
      namePlaceholder: 'O teu nome completo',

      bioTitle:       'INTRODUÇÃO',
      bioSub:         'Uma breve apresentação para os empregadores (máx. 200 caracteres)',
      bioPlaceholder: 'Ex: Tenho 3 anos de experiência em restauração e sou pontual e proativo...',

      cvTitle:      'CURRÍCULO (CV)',
      cvSub:        'PDF ou Word, até 10 MB. As empresas veem-no quando escolhem candidatos. Vale +10pts no perfil.',
      cvFallback:   'CV carregado',
      cvView:       'Ver',
      cvReplace:    'Substituir',
      cvUpload:     'Carregar o meu CV',
      cvTooBigTitle:'Ficheiro demasiado grande',
      cvTooBigBody: 'O CV não pode exceder 10 MB.',
      cvDoneTitle:  'CV carregado!',
      cvDoneBody:   'O teu perfil está agora {{score}}% completo.',
      cvFailed:     'Não foi possível carregar o CV. Tenta novamente.',
      cvRemoveTitle:'Remover CV',
      cvRemoveBody: 'Tens a certeza? Vais perder 10 pontos no perfil.',
      cvRemoveFailed:'Não foi possível remover o CV.',

      experiencesTitle: 'AS MINHAS EXPERIÊNCIAS',
      experiencesSub:   'Quantos anos já trabalhaste em cada função. As empresas veem isto ao escolher candidatos.',
      experienceAdd:    'Adicionar experiência',
      experiencePickJob:   'Escolhe a função',
      experiencePickYears: 'Quantos anos?',

      legalTitle: 'DADOS LEGAIS & BANCÁRIOS',
      // MCD = Contrato de Muito Curta Duração, the Portuguese short-shift contract
      legalSub:   'Necessários para contratos MCD e receber pagamentos. Valem +20pts cada no perfil.',
      nifValid:   '✓ NIF válido',
      nifInvalid: 'NIF inválido — deve ter 9 dígitos válidos.',
      nifHint:    'Número de Identificação Fiscal português (9 dígitos).',
      nifLocked:  'O NIF não pode ser alterado. Para o corrigir contacta o suporte.',
      ibanValid:  '✓ IBAN válido',
      ibanInvalid:'IBAN inválido — verifica o formato PT50...',
      ibanHint:   'Necessário para receberes o pagamento por transferência.',
      ibanConsent:'Autorizo a partilha do meu nome e IBAN com as empresas onde fiz turnos, para que me possam pagar por transferência. Podes retirar esta autorização aqui a qualquer momento.',
      ibanConsentWarn: 'Sem esta autorização, as empresas só te podem pagar por Turnos Pay Link ou MB WAY.',

      skillsTitle: 'COMPETÊNCIAS',
      skillsSub:   'Toca numa categoria para expandir e selecionar',
      skillsCountOne:   '1 selecionada',
      skillsCountOther: '{{count}} selecionadas',

      languagesTitle: 'IDIOMAS',
      languagesSub:   'Idiomas em que és fluente',
      languagesCountOne:   '1 selecionado',
      languagesCountOther: '{{count}} selecionados',

      availabilityTitle: 'DISPONIBILIDADE',
      availabilitySwitch:  'Estou disponível para trabalhar',
      availabilityOnSub:   'As empresas podem encontrar-te na pesquisa de trabalhadores.',
      availabilityOffSub:  'Ficas oculto na pesquisa das empresas. Não afeta a tua pontuação de perfil.',

      emailTitle:       'EMAIL DE CONTACTO',
      emailSub:         'O teu acesso usa SMS — este email é só para recibos e comunicações.',
      emailPlaceholder: 'o.teu@email.com',
    },

    onboarding: {
      title:    'Criar Perfil',
      stepOf:   'Passo {{current}} de {{total}} · {{name}}',
      skip:     'Saltar',
      continue: 'Continuar →',

      steps: {
        identity:     'Identidade',
        legal:        'Legal',
        availability: 'Disponibilidade',
        summary:      'Resumo',
      },

      // Step 0 — identity
      nameTitle:       'O seu nome completo',
      nameSub:         'Como aparece no seu documento de identificação.',
      namePlaceholder: 'Ex: Carlos Manuel Silva',
      nameRequiredTitle: 'Nome obrigatório',
      nameRequiredBody:  'Por favor introduza o seu nome completo.',
      photoTitle:      'Foto de perfil (+20 pts)',
      photoSub:        'Uma boa foto aumenta as suas hipóteses de aprovação.',
      photoAdd:        'Adicionar foto',
      photoRemove:     'Remover foto',
      photoPermTitle:  'Permissão necessária',
      photoPermBody:   'Precisamos de acesso às suas fotos para adicionar uma foto de perfil.',
      photoUploadError:'Erro ao enviar foto.',
      photoSkipped:    '{{message}} O perfil será submetido sem foto.',

      // Step 1 — legal
      legalTitle: 'Dados legais',
      legalSub:   'Podes preencher agora ou mais tarde no perfil. O NIF e IBAN são necessários antes do teu primeiro turno.',
      nifInvalid: 'NIF inválido (9 dígitos)',
      nifValid:   '✓ NIF válido',
      ibanInvalid:'IBAN inválido (formato PT50... com 25 caracteres)',
      ibanValid:  '✓ IBAN válido',
      ibanHint:   'A empresa paga-te diretamente o valor bruto. Se pagar por transferência, precisa do teu IBAN.',
      ibanConsent:'Autorizo a partilha do meu nome e IBAN com as empresas onde fiz turnos, para que me possam pagar por transferência. Posso retirar esta autorização no meu perfil a qualquer momento.',
      ibanConsentWarn: 'Sem esta autorização, as empresas só te podem pagar por Turnos Pay Link ou MB WAY.',
      incomeLabel:       'Outros rendimentos mensais (opcional)',
      incomePlaceholder: 'Ex: 800 (€ por mês)',
      // Agenda do Trabalho Digno (Lei 13/2023) — Portuguese labour law, named verbatim
      incomeInfo: '💡 Inclua rendimentos de emprego, freelance ou outras fontes fora da Turnos. Deixe em branco se não tiver outros rendimentos.\n\nEsta informação é usada para calcular a sua dependência económica por empregador, conforme exigido pela Agenda do Trabalho Digno (Lei 13/2023). Não é partilhada com empregadores.',

      // Step 2 — skills, availability, CV
      skillsTitle:   'Competências',
      skillsSub:     'Selecione as suas competências (escolha todas as aplicáveis).',
      skillsRequiredTitle: 'Competências',
      skillsRequiredBody:  'Selecione pelo menos 1 competência.',
      availabilityTitle: 'Disponibilidade semanal',
      availabilitySub:   'Quais os dias em que está habitualmente disponível?',
      cvTitle:      'Currículo (CV)',
      cvSub:        'Opcional, mas vale +10 pontos. PDF ou Word, até 10 MB. As empresas veem-no ao escolher candidatos.',
      cvPick:       '＋ Escolher ficheiro',
      cvRemove:     'Remover CV',
      cvTooBigTitle:'Ficheiro demasiado grande',
      cvTooBigBody: 'O CV não pode exceder 10 MB.',
      cvUploadError:'Erro ao enviar o CV.',
      cvSkipped:    '{{message}} O perfil será submetido sem CV.',

      // Step 3 — summary
      summaryTitle: 'Resumo do perfil',
      summarySub:   'Verifique os dados antes de submeter.',
      scoreTitle:   'Perfil Completo',
      scoreReady:   '✅ Pronto para submeter',
      scoreIncomplete: '⚠️ Perfil incompleto',
      scoreNote:    'O seu perfil será analisado pela equipa Turnos em 24h.',
      scoreMissing: 'Em falta: {{items}}',
      missing: {
        photo:        'Fotografia de perfil',
        nif:          'NIF válido',
        iban:         'IBAN válido (conta bancária)',
        skills:       'Pelo menos 1 competência selecionada',
        fullName:     'Nome completo',
        availability: 'Disponibilidade semanal',
        cv:           'Currículo (CV)',
      },
      summaryName:         'Nome',
      summarySkills:       'Competências',
      summaryAvailability: 'Disponibilidade',
      summaryCv:           'CV',
      // Post-pivot: the company pays the worker directly — Turnos never holds wages
      payNote: '💳 Após aprovação, a empresa paga-te o valor bruto diretamente após cada turno concluído.',

      warningTitle: 'Aviso',
      submitting:   'A submeter...',
      uploadingPhoto: 'A enviar foto...',
      submitReady:  '✅ Submeter para aprovação',
      submitLater:  'Guardar e continuar depois',
      submitError:  'Não foi possível submeter o perfil.',
    },

    earnings: {
      title: 'Os Meus Ganhos',
      periods: {
        day:   'Hoje',
        month: 'Este mês',
        year:  'Este ano',
      },
      loading:   'A carregar ganhos…',
      loadError: 'Erro ao carregar ganhos.',

      // Pay Link activation card
      payLinkTitleVerifying: 'Pay Link quase ativo — verificação em curso',
      payLinkTitleContinue:  'Continua a ativação do Pay Link',
      payLinkTitleStart:     'Recebe por Turnos Pay Link',
      payLinkBodyVerifying:  'A Stripe está a verificar os teus dados. Normalmente demora minutos — volta em breve.',
      payLinkBodyStart:      'Ativa em ~3 minutos: verificas a identidade e o IBAN com a Stripe, uma única vez. Depois, quando a empresa paga o link, o dinheiro cai na tua conta em 1–2 dias úteis.',
      payLinkOpening:  'A abrir…',
      payLinkContinue: 'Continuar ativação →',
      payLinkActivate: 'Ativar Pay Link →',
      payLinkFailed:   'Não foi possível iniciar a ativação. Tenta novamente.',
      payLinkActive:      '✅ Pay Link ativo — os pagamentos das empresas caem diretamente na tua conta bancária.',
      payLinkActiveMbWay: 'A empresa pode pagar-te por cartão ou MB WAY. Recebes sempre o valor bruto completo — a taxa de processamento é suportada pela empresa.',
      payLinkActiveCard:  'A empresa paga por cartão. Recebes sempre o valor bruto completo — a taxa de processamento é suportada pela empresa.',

      // Quarterly Segurança Social reminder
      ssReminderTitle: 'Lembrete SS trimestral',
      ssReminderBody:  '{{month}} é mês de declaração. Não te esqueças de submeter os teus rendimentos na Segurança Social antes do fim do mês.',
      ssReminderLink:  'Abrir SS Direta →',
      ssCtaTitle: 'Segurança Social Direta',
      ssCtaText:  'Declara os teus rendimentos trimestralmente no portal SS.',
      ssAlertBody: 'Será redireccionado para o portal da Segurança Social para submeter a tua declaração trimestral.',
      ssAlertOpen: 'Abrir',

      kpiGross:    'Bruto',
      kpiShifts:   'Turnos',

      breakdownTitle: 'Simulador de TSU (se aplicável)',
      rowGross:   'Valor bruto (pago pela empresa)',
      rowTsu:     'TSU a entregar ao Estado (11%)',
      rowAfterTsu:'Estimativa após TSU',
      tsuNote:      '⚠️ Recebes o valor bruto por inteiro, diretamente da empresa — a Turnos não cobra qualquer taxa aos trabalhadores. Como trabalhador és responsável por declarar e pagar ',
      tsuNoteBold:  '11% do teu valor bruto',
      tsuNoteEnd:   ' à Segurança Social (valor informativo acima).',

      listTitle:  'Turnos concluídos — {{period}}',
      emptyTitle: 'Sem turnos pagos {{period}}',
      // Post-ADR-008: there is no check-out scan; shifts auto-complete
      emptySub:   'Os teus ganhos aparecem aqui depois de o turno terminar e o pagamento ser registado.',
      rowNet:     'Líq.',
    },

    scan: {
      title:      'Check-in',
      permTitle:  'Câmara necessária',
      permBody:   'Para ler o QR code do empregador, precisamos de acesso à câmara.',
      permAllow:  'Permitir câmara',
      hint:       'Aponta para o QR code afixado no local para fazer check-in',
      subHint:    'O QR code do empregador é permanente — não precisa de atualizar. Peça ao empregador para abrir o ecrã de QR codes.',
      okTitle:    '✅ Check-in registado!',
      okBody:     'O teu turno começou. No fim do horário, o turno conclui automaticamente — não precisas de digitalizar nada à saída. Boa sorte!',
      failed:     'Erro ao processar QR code.',
    },

    rate: {
      title:      'Avaliar turno',
      loadError:  'Não foi possível carregar os dados do turno.',
      question:   'Como correu o turno?',
      incompleteTitle: 'Avaliação incompleta',
      incompleteBody:  'Por favor seleciona pelo menos 1 estrela.',
      thanksTitle: 'Obrigado!',
      thanksBody:  'A tua avaliação foi registada com sucesso.',
      submitError: 'Não foi possível enviar a avaliação. Tenta novamente.',
      submit:      'Enviar avaliação',
      alreadyTitle: 'Já avaliaste este turno',
      alreadySub:   'A tua avaliação foi registada. Obrigado pelo feedback!',
      scores: {
        1: 'Mau 😞',
        2: 'Razoável 😐',
        3: 'Bom 😊',
        4: 'Muito bom 😄',
        5: 'Excelente 🤩',
      },
    },

    // Recibo Verde is the Portuguese self-employed invoice — never translated
    reciboVerde: {
      title:     'Recibo Verde',
      headerSub: 'Turno concluído — submete o teu recibo ao Estado',
      shiftFallback: 'Turno',

      whatTitle: 'O que é o Recibo Verde?',
      whatBody1: 'Como trabalhador independente em Contrato de Muito Curta Duração (MCD), tens de emitir um ',
      whatBoldReceipt: 'Recibo Verde',
      whatBody2: ' no Portal das Finanças para cada turno concluído.\n\nO prazo legal é de ',
      whatBoldDeadline: '5 dias úteis',
      whatBody3: ' após a conclusão do turno. Guardar o comprovativo é obrigatório para declaração de IRS.',

      valuesTitle: 'Valores para o teu recibo',
      valuesHint:  'Copia estes valores para o Portal das Finanças',
      valueGross:  'Valor bruto do turno',
      valueReceived: 'Valor que recebes da empresa',
      valueTsu:    'ℹ️  SS Trabalhador (11% do bruto)',
      tsuNote:     'Este valor é entregue por ti ao Estado via Segurança Social Direta — não é deduzido pela Turnos.',

      howTitle: 'Como submeter',
      steps: {
        s1: 'Acede ao Portal das Finanças com o teu NIF e senha.',
        s2: 'Vai a "Recibos Verdes" → "Emitir Recibo".',
        s3: 'Seleciona "Prestação de Serviços" e preenche com o valor bruto do turno.',
        s4: 'Indica o NIF do empregador (encontras na proposta do turno).',
        s5: 'Emite o recibo e guarda o comprovativo em PDF.',
      },

      openPortal:   '🌐  Abrir Portal das Finanças',
      portalError:  'Não foi possível abrir o Portal das Finanças. Acede em: irs.portaldasfinancas.gov.pt',
      confirm:      'Já submeti o meu recibo',
      confirmed:    '✅  Recibo já submetido',
      confirmTitle: 'Recibo submetido! ✅',
      confirmBody:  'Obrigado por confirmares. Ficamos à tua disposição caso precises de ajuda.',
    },
  },

  /** Employer dashboard (web-admin). */
  admin: {
    nav: {
      dashboard:     'Dashboard',
      workersSearch: 'Procurar Workers',
      workers:       'Quem já trabalhou',
      shifts:        'Turnos',
      qrCheckIn:     'QR Check-in',
      compliance:    'Conformidade',
      spending:      'Gastos',
      billing:       'A minha subscrição',
      settings:      'Definições',
    },

    /** Chrome repeated on every dashboard page. */
    chrome: {
      soon:          'breve',
      logout:        'Sair →',
      backDashboard: '← Dashboard',
      backToDashboard: '← Voltar ao Dashboard',
      myCompany:     'A minha empresa',
      postShift:     '+ Publicar Turno',
    },

    /** Small-screen interstitial — the dashboard is built for desktop/tablet. */
    mobileOverlay: {
      title: 'Melhor no computador',
      body:  'O Turnos Web Admin foi desenhado para desktop ou tablet. Para gerir turnos, aprovar candidatos e aceder a todos os relatórios, abre este link num computador ou tablet.',
      continue: 'Continuar mesmo assim',
    },

    home: {
      greeting:       'Bem-vindo',
      greetingNamed:  'Bem-vindo, {{company}}',

      kpiActive:        'Turnos ativos',
      kpiActiveSub:     '{{open}} · {{filled}}',
      kpiActiveOpenOne:    '1 aberto',
      kpiActiveOpenOther:  '{{count}} abertos',
      kpiActiveFilledOne:  '1 preenchido',
      kpiActiveFilledOther:'{{count}} preenchidos',

      kpiAwaiting:      'A aguardar confirmação',
      kpiAwaitingNone:  'Nenhum trabalhador a confirmar',
      kpiAwaitingSome:  'Worker tem 2h para aceitar',

      kpiApplicants:     'Candidatos pendentes',
      kpiApplicantsNone: 'Sem turnos à espera',
      kpiApplicantsSome: 'Ver e selecionar candidatos',

      kpiExpired:     'Turnos caducados',
      kpiExpiredNone: 'Tudo em dia',
      kpiExpiredSome: 'Re-publicar ou eliminar',

      actionPostTitle: 'Publicar Turno',
      actionPostDesc:  'Define função, horário e morada. TSU calculado automaticamente.',
      actionPostCta:   'Publicar →',
      actionSearchTitle: 'Procurar Trabalhadores',
      actionSearchDesc:  'Filtra por competência, idioma ou disponibilidade e convida diretamente.',
      actionSearchCta:   'Procurar →',
      actionWorkersTitle: 'Os Meus Trabalhadores',
      actionWorkersDesc:  'Workers que já trabalharam contigo com ratings e histórico de turnos.',
      actionWorkersCta:   'Ver →',
      actionQrTitle: 'QR Check-in',
      // Post-ADR-008: a single check-in code, no check-out
      actionQrDesc:  'O teu código QR fixo de check-in. Imprime uma vez, usa sempre.',
      actionQrCta:   'Ver QR →',
    },

    workersSearch: {
      title: 'Procurar Trabalhadores',
      sub:   'Workers com perfil ≥80% activos na plataforma',
      search:     'Pesquisar',
      searching:  'A pesquisar...',

      searchPlaceholder: 'Nome, competência ou bio...',
      filterDays:        'Dias',
      filterDaysCount:   '{{count}} dias',
      resetFilters:      'Limpar filtros',
      cvDownload:        'Descarregar CV',
      filterSkills:      'Competências',
      filterSkillsCount: 'Competências ({{count}})',
      applyFilters:      'Aplicar filtros',
      filterAvailable:   'Disponíveis agora',
      filterAvailableOn: 'Disponíveis agora',
      filterAvailableTitle: 'Mostrar apenas trabalhadores que se declararam disponíveis',
      filterLanguage:    'Idiomas',
      filterLanguageCount: 'Idiomas ({{count}})',
      ratingAny:         'Qualquer avaliação',
      rating3:           '3+ estrelas',
      rating4:           '4+ estrelas',
      rating45:          '4,5+ estrelas',

      resultsOne:   '1 worker encontrado',
      resultsOther: '{{count}} workers encontrados',
      emptyTitle:   'Nenhum worker encontrado',
      emptySub:     'Tenta ajustar os filtros ou pesquisa por nome.',

      noName:    'Nome não definido',
      ratings:   '({{count}} aval.)',
      badgeTop:      'Top Rated',
      badgeReliable: 'Fiável',
      badgeVerified: 'Verificado',
      badgeTopShort:      'Top',
      badgeReliableShort: 'Fiável',
      badgeVerifiedShort: 'Verif.',
      availablePill: 'Disponível',
      viewProfile:   'Ver perfil & convidar →',

      panelCompleteness: 'Perfil Completo',
      panelBio:          'Apresentação',
      panelCv:           'Currículo',
      panelCvFallback:   'Ver CV',
      panelExperience:   'Experiência',
      panelSkills:       'Competências',
      panelLanguages:    'Idiomas',
      panelAvailability: 'Disponibilidade',
      availableOn:  'Disponível para trabalhar',
      availableOff: 'Não disponível de momento',
      statNoShows: 'faltas',
      statRatings: 'avaliações',
      statProfile: 'perfil',

      inviteTitle:   'Convidar para um turno',
      inviteSuccess: 'Convite enviado! O worker tem 2h para aceitar.',
      inviteNoShifts: 'Não tens turnos abertos.',
      inviteNoShiftsCta: 'Publicar turno →',
      invitePick:    'Seleciona um turno...',
      inviteBtn:     'Convidar',
      inviteFailed:  'Erro ao convidar.',
    },

    workers: {
      title: 'Os Meus Trabalhadores',
      subNone:  'Nenhum trabalhador contratado ainda',
      subOne:   '1 trabalhador contratado',
      subOther: '{{count}} trabalhadores contratados',
      loadError: 'Erro ao carregar trabalhadores.',
      refresh:   '↻ Atualizar',

      emptyTitle: 'Ainda não contratou nenhum trabalhador',
      emptySub:   'Os trabalhadores aprovados nos seus turnos aparecerão aqui.',
      emptyCta:   'Ver os meus turnos →',

      noName:  'Nome não definido',
      ratings: '· {{count}} aval.',
      scoreLabel: 'perfil completo',
      shiftsOne:   '1 turno realizado',
      shiftsOther: '{{count}} turnos realizados',
      lastShift:   ' · último {{date}}',
      noShowOne:   '1 falta',
      noShowOther: '{{count}} faltas',

      skillsLabel:       'Competências',
      availabilityLabel: 'Disponibilidade',
    },

    qrCodes: {
      back:  '← Voltar aos Turnos',
      title: 'Código QR de Check-in',
      sub:   'Imprima este QR code e afixe-o à entrada do seu local de trabalho. O trabalhador digitaliza-o na chegada — o turno conclui automaticamente à hora de fim.',
      print:     'Imprimir',
      regenerate:'↻ Regenerar',
      loading:   'A gerar QR codes...',
      loadError: 'Erro ao carregar os QR codes.',

      // Split so the <strong>/<em> emphasis survives translation
      infoLead:   'Como funciona:',
      infoBody1:  ' Este QR code é permanente — não expira. Imprima-o uma vez e afixe-o à entrada do seu espaço. O trabalhador abre a aplicação Turnos, toca em ',
      infoCheckIn:'Check-in',
      infoBody2:  ' e aponta a câmara. No fim do horário, o turno ',
      infoAuto:   'conclui automaticamente',
      infoBody3:  ' — não é preciso digitalizar à saída. Se algo correr mal (saída antecipada, problema no turno), pode ajustar as horas ou reportar o problema em ',
      infoMyShifts:'Os Meus Turnos',
      infoBody4:  ' antes de pagar.',

      printTitle:  'Turnos — Check-in',
      cardTitle:   'CHECK-IN',
      cardSub:     'Digitalizar na chegada',
      qrAlt:       'QR Code Check-in',
      instruction1:'Trabalhador abre a app → toca em',
      instructionBold:'Fazer Check-in',
      instruction2:'→ aponta a câmara aqui',
      download:    'Descarregar PNG',

      placementTitle: 'Onde colocar o QR code',
      placementInLabel: 'CHECK-IN',
      placementInWhere: ' — Entrada / Receção',
      placementInDesc:  'À entrada do espaço de trabalho, onde o trabalhador chega.',
      placementEndLabel:'FIM DO TURNO',
      placementEndWhere:' — Automático',
      placementEndDesc: 'Não há QR de saída: o turno conclui sozinho à hora de fim agendada.',

      fallback1:      'Se o trabalhador não conseguir digitalizar o QR (câmara com problemas, etc.), pode confirmar manualmente o turno na página ',
      fallbackLink:   'Os Meus Turnos',
      fallback2:      ' com o botão ',
      fallbackButton: 'Confirmar',
      fallback3:      '.',
    },

    // TSU, MCD, SS Direta and ACT are Portuguese legal instruments/bodies —
    // kept verbatim in both languages.
    compliance: {
      title: 'Conformidade Legal',
      sub:   'TSU / SS Direta · Contratos MCD · Registo de auditoria ACT',

      tabTsu:   'Relatório TSU',
      tabMcd:   'Contratos MCD',
      tabAudit: 'Auditoria ACT',

      emptyTsu:    'Sem turnos concluídos em {{month}} {{year}}',
      emptyMcd:    'Sem contratos MCD registados ainda',
      emptyAudit:  'Sem eventos de auditoria',

      kpiGross:       'Bruto Total',
      kpiEmployerTsu: 'TSU Entidade (23.75%)',
      // Post-ADR-007 the fee is a fixed €3 per completed shift, not a percentage
      kpiTurnosFees:  'Taxas Turnos',

      colShift:      'Turno',
      colDate:       'Data',
      colWorker:     'Trabalhador',
      colGross:      'Bruto',
      colTurnosFee:  'Taxa Turnos',
      colEmployerTsu:'TSU Emp.',
      colWorkerNet:  'Líquido Trabalh.',
      legalNote:     'ℹ️ SS Trabalhador (11%) é entregue pelo próprio trabalhador via SS Direta — não incluído acima. TSU Entidade (23.75%) deve ser pago mensalmente pelo empregador.',

      colWorkerNif: 'Trabalhador / NIF',
      colShiftDate: 'Data do Turno',
      colSchedule:  'Horário',
      colRole:      'Função',
      colRate:      'Valor/hora',
      colSsDireta:  'SS Direta',

      auditNote:    'Registo imutável de todos os eventos de conformidade. Usado em inspeções da ACT.',
      colDateTime:  'Data/Hora',
      colEvent:     'Evento',
      colShiftShort:'Turno',
      colDetails:   'Detalhes',

      ssStatus: {
        PENDING:    'Pendente',
        EMAIL_SENT: 'Email enviado',
        SUBMITTED:  'Submetido',
        FAILED:     'Falhou',
      },
    },

    spending: {
      title: 'Gastos',
      sub:   'Análise de custos por turno e relatório TSU para contabilidade',
      exportCsv: 'Exportar CSV',
      csvFilename: 'turnos-gastos',
      csvHeader: 'Data,Turno ID,Bruto (€),Taxa Turnos (€),TSU Entidade (€),TSU Trabalhador (€),Horas,Líquido Trabalhador (€)',

      periodMonth: 'Mês',
      periodYear:  'Ano',
      loading:     'A carregar dados de {{period}}…',
      loadError:   'Erro ao carregar dados.',

      emptyTitle: 'Sem turnos pagos em {{period}}',
      emptySub:   'Os dados aparecem aqui quando os turnos são concluídos (automaticamente à hora de fim).',
      emptyCta:   'Ver Turnos →',

      kpiWages:      'Salários a pagar (informativo)',
      kpiWagesSubOne:   '1 turno — pagas diretamente aos workers',
      kpiWagesSubOther: '{{count}} turnos — pagas diretamente aos workers',
      kpiTsu:        'TSU a pagar ao Estado',
      kpiTsuSub:     '23.75% do bruto — valor informativo',
      kpiFees:       'Taxas Turnos',
      kpiFeesSubOne:   '1 turno × 3€ — na próxima fatura mensal',
      kpiFeesSubOther: '{{count}} turnos × 3€ — na próxima fatura mensal',
      kpiAvg:        'Custo médio por turno',
      kpiAvgSub:     'Bruto + TSU entidade',

      tsuReminderTitle: 'Lembra-te: TSU da entidade empregadora',
      tsuReminder1:     'Deves entregar ',
      tsuReminder2:     ' à Segurança Social referente a {{period}}. A taxa é de 23,75% sobre o total dos salários brutos. Prazo de entrega: até ao dia 20 do mês seguinte.',

      monthlyTitle: 'Detalhe mensal — {{year}}',
      tableTitle:   'Turnos — {{period}}',
      recordsCount: '{{count}} registos',

      colDate:      'Data',
      colGross:     'Bruto',
      colFee:       'Taxa Turnos',
      colEmployerTsu:'TSU Entidade',
      colWorkerTsu: 'TSU Trabalhador',
      colHours:     'Horas',
      colNet:       'Líquido Trabalhador',
      totalLabel:   'Total',

      navBilling: 'Ver Faturação →',
    },

    // Employer-facing reviews written about a worker (WorkerReviews component)
    reviews: {
      title: 'O que outras empresas dizem',
      empty: 'Ainda sem avaliações escritas.',
    },

    settings: {
      title: 'Definições',
      sub:   'A tua conta, os teus dados e o teu plano.',

      // ── Account details ──
      accountTitle: 'Dados da conta',
      accountSub:   'Estes dados aparecem nos contratos MCD e nas comunicações à Segurança Social.',
      labelCompany:    'Nome da empresa',
      labelSector:     'Sector',
      labelNipc:       'NIPC',
      nipcLocked:      'O NIPC identifica legalmente a empresa e não pode ser alterado aqui. Contacta o suporte se estiver errado.',
      labelNif:        'NIF do representante',
      labelAddress:    'Morada',
      labelPostal:     'Código postal',
      labelCity:       'Cidade',
      labelAdminEmail: 'Email de acesso',
      adminEmailLocked:'É com este email que entras na Turnos. Contacta o suporte para o alterar.',
      labelAccountant: 'Email do contabilista',
      accountantHint:  'Para onde enviamos a notificação de Segurança Social antes de cada turno. Se ficar vazio, enviamos para o email de acesso.',
      save:            'Guardar alterações',
      saving:          'A guardar...',
      saved:           'Alterações guardadas.',
      saveError:       'Não foi possível guardar. Tenta novamente.',

      // ── Password ──
      passwordTitle:   'Palavra-passe',
      passwordSub:     'Ao alterares a palavra-passe, as sessões noutros dispositivos terminam.',
      labelCurrent:    'Palavra-passe atual',
      labelNew:        'Nova palavra-passe',
      labelConfirm:    'Confirmar nova palavra-passe',
      passwordHint:    'Mínimo 8 caracteres.',
      changePassword:  'Alterar palavra-passe',
      changing:        'A alterar...',
      passwordChanged: 'Palavra-passe alterada. Vais precisar de entrar de novo nos outros dispositivos.',
      passwordMismatch:'As palavras-passe não coincidem.',

      // ── Plan ──
      planTitle:    'O teu plano',
      planStarter:  'Turnos Starter',
      planNone:     'Sem plano ativo',
      planActive:   'Ativo',
      planInactive: 'Inativo',
      planPrice:    '45€/mês + 3€ por turno concluído',
      planManage:   'Gerir subscrição →',
      benefit1:     'Até 15 turnos abertos em simultâneo',
      benefit2:     'Pesquisa de trabalhadores e convites diretos',
      benefit3:     'Contratos MCD e comunicação à Segurança Social automáticas',
      benefit4:     'Check-in por QR e conclusão automática do turno',
      benefit5:     'Relatórios prontos para a contabilidade',

      // ── Support ──
      supportTitle: 'Suporte',
      supportSub:   'Respondemos em dias úteis, normalmente no próprio dia.',
      supportEmail: 'Escrever ao suporte',
      supportNote:  'Para alterar o NIPC, o email de acesso ou cancelar a conta, fala connosco.',

      // ── Legal ──
      legalTitle:   'Conta e privacidade',
      legalTerms:   'Termos de utilização',
      legalPrivacy: 'Política de privacidade e RGPD',
      legalFaq:     'Perguntas frequentes',
      legalData:    'Pedir uma cópia dos meus dados',
      legalDelete:  'Pedir a eliminação da conta',
      legalNote:    'O RGPD dá-te direito de acesso e de eliminação dos teus dados. Tratamos qualquer pedido em 30 dias.',
    },

    billing: {
      title: 'Faturação',
      sub:   'Gerir o teu plano de subscrição Turnos',
      loading:   'A carregar informação de faturação…',
      loadError: 'Não foi possível carregar a informação de faturação. Tenta novamente.',

      status: {
        active:    'Ativo',
        past_due:  'Pagamento em falta',
        cancelled: 'Cancelado',
        inactive:  'Inativo',
      },

      currentPlan: 'Plano atual',
      planName:    'Turnos Starter',
      planPrice:   '€45',
      planPriceSub:'/mês por empresa + 3€ por turno concluído',

      features: {
        f1: 'Publicar até 15 turnos em simultâneo',
        f2: 'Procurar e convidar trabalhadores por competência e idioma',
        f3: 'Gestão de candidaturas e aprovação de trabalhadores',
        f4: 'QR Check-in no local + conclusão automática do turno',
        f5: 'Conformidade MCD — contratos e SS Direta automáticos',
        f6: 'Relatório TSU mensal pronto para a contabilidade',
        f7: 'Notificações push em tempo real',
      },

      ctaNote:     'Para ativar a subscrição, precisas primeiro de adicionar um cartão de crédito. Usa o painel de pagamentos Stripe para guardar o teu método de pagamento.',
      ctaSubNote:  'Nota: Se ainda não tens cartão guardado, a ativação irá falhar com uma mensagem clara. Fala com o suporte Turnos para adicionar o cartão via Stripe Dashboard.',
      activate:    'Ativar subscrição — €45/mês',
      processing:  'A processar…',
      cancel:      'Cancelar subscrição',
      pastDueBanner: 'O pagamento do teu plano falhou. Por favor atualiza o método de pagamento no Stripe Dashboard ou contacta o suporte Turnos.',

      activated:      'Subscrição ativada com sucesso! Podes agora publicar turnos.',
      activateStatus: 'Estado da subscrição: {{status}}',
      activateError:  'Erro ao ativar a subscrição.',
      cancelConfirm:  'Tens a certeza que queres cancelar a subscrição? Perderás o acesso no final do período atual.',
      cancelled:      'Subscrição cancelada. O acesso mantém-se até ao fim do período atual.',
      cancelError:    'Erro ao cancelar a subscrição.',

      aboutTitle: 'Sobre o plano Starter',
      rowShifts:      'Turnos simultâneos',
      rowShiftsVal:   'Até 15 turnos ativos',
      rowWorkers:     'Trabalhadores',
      rowWorkersVal:  'Ilimitados',
      // Post-ADR-008 there is no check-out scan
      rowQr:          'QR Check-in',
      rowQrVal:       'Incluído',
      rowTsu:         'Relatório TSU',
      rowTsuVal:      'Incluído (informativo)',
      rowSs:          'SS Direta (MCD)',
      rowSsVal:       'Automático',
      rowFee:         'Taxa por turno concluído',
      rowFeeVal:      '3€ fixos — faturados 1×/mês',
      rowWage:        'Salário do trabalhador',
      rowWageVal:     'Pagas diretamente — 0% de comissão',

      cancelPolicyTitle: 'Política de cancelamento de turnos',
      cancelPolicy1: 'Cancelar um turno preenchido com menos de ',
      cancelPolicyBold1: '3 horas',
      cancelPolicy2: ' de antecedência, sem justificação, obriga ao pagamento de um ',
      cancelPolicyBold2: 'mínimo de 2 horas',
      cancelPolicy3: ' ao trabalhador (via Pay Link) + a taxa normal de 3€. Entre 24h e 3h o cancelamento é gratuito mas fica registado na fiabilidade da empresa. Cancelamentos justificados (atraso do trabalhador, força maior, etc.) e com mais de 24h são ',
      cancelPolicyBold3: 'gratuitos',
      cancelPolicy4: '.',

      proTitle: 'Turnos Pro — brevemente',
      proBody1: 'Turnos ilimitados em simultâneo, 5 utilizadores, taxa de 2€/turno, filtros avançados de pesquisa e convite direto de trabalhadores, relatórios de contabilidade — ',
      proPrice: '€99/mês',
      proBody2: '. Fala connosco para saber mais.',

      navSpending: 'Ver Gastos →',
    },

    ratings: {
      title: 'Reputação',
      sub:   'Avaliações e histórico de desempenho dos trabalhadores',
      searchPlaceholder: 'Pesquisar trabalhador...',
      refresh:   '↻ Atualizar',
      loadError: 'Erro ao carregar dados.',

      emptyTitle: 'Ainda sem avaliações',
      emptySub:   'As avaliações aparecem aqui após a conclusão dos turnos com trabalhadores contratados.',
      emptyCta:   'Ver os meus turnos →',

      noName:      'Nome não definido',
      workerFallback: 'Trabalhador',
      totalRatings: '· {{count}} aval.',
      statShifts:   'turnos',
      statNoShowOne:   'falta',
      statNoShowOther: 'faltas',
      statProfile:  'perfil',
      rateBtn:      'Avaliar',
      noShowBtn:    'Reportar falta',

      // Rating modal
      rateTitle:      'Avaliar trabalhador',
      rateLoading:    'A carregar turnos...',
      rateAllDone:    'Todos os turnos já foram avaliados',
      rateAllDoneSub: 'Não há turnos concluídos pendentes de avaliação com este trabalhador.',
      pickShift:      'Seleciona o turno',
      rateQuestion:   'Como foi o desempenho?',
      scores: {
        1: 'Mau',
        2: 'Razoável',
        3: 'Bom',
        4: 'Muito bom',
        5: 'Excelente',
      },
      tagsLabel:      'O que destacas? (opcional)',
      reviewLabel:    'Avaliação escrita',
      reviewHint:     '(opcional · visível a outros empregadores)',
      reviewPlaceholder: 'Ex: Muito pontual e profissional. Recomendo para turnos de eventos...',
      rateSubmit:     'Enviar avaliação',
      rateSubmitting: 'A enviar...',
      rateError:      'Erro ao enviar avaliação.',

      // No-show modal
      noShowTitle:      'Reportar falta',
      noShowNoShifts:   'Não há turnos confirmados associados a este trabalhador para reportar falta.',
      noShowNoteLabel:  'Nota (opcional)',
      noShowPlaceholder:'Descreve o que aconteceu...',
      noShowSubmit:     'Reportar falta',
      noShowSubmitting: 'A reportar...',
      noShowError:      'Erro ao reportar falta.',
    },

    newShift: {
      title: 'Publicar Turno',
      sub:   'Preencha os detalhes do turno. O valor bruto e o custo TSU são calculados automaticamente.',
      back:  '← Voltar',
      optional: 'opcional',

      // Role & category
      roleSection:      'Função & Categoria',
      labelCategory:    'Categoria',
      labelRole:        'Função',
      labelTitle:       'Título personalizado',
      titlePlaceholder: 'Ex: Bartender Sénior, Chef de Linha...',
      labelDescription: 'Descrição',
      descPlaceholder:  'Descreva o turno, ambiente de trabalho, requisitos específicos...',

      // Skills
      skillsSection: 'Competências adicionais',
      skillsHint:    'A função que escolheste acima já é usada para encontrar trabalhadores. Acrescenta aqui só o que for além disso.',
      customSkillPlaceholder: 'Adicionar competência personalizada...',
      addSkill:      '+ Adicionar',
      selectedLabel: 'Selecionadas:',

      // Languages
      languagesSection: 'Idiomas necessários',      languagesPlaceholder: 'Selecionar idiomas',
      languagesCount:       '{{count}} idiomas selecionados',

      languagesHint:    'Só os trabalhadores que falam estes idiomas serão notificados. Deixa vazio se for indiferente.',
      languagesPickedOne:   '1 idioma selecionado: {{list}}',
      languagesPickedOther: '{{count}} idiomas selecionados: {{list}}',

      // Payment
      paymentSection: 'Como vais pagar ao trabalhador?',
      paymentHint:    'O pagamento é feito diretamente por ti ao trabalhador após o turno — não passa pela Turnos. O método escolhido é mostrado ao trabalhador antes de se candidatar.',
      recommended:    'Recomendado',
      payLinkNote:    'Recebes um link após o turno e pagas por cartão ou MB WAY. O dinheiro vai direto para a conta do trabalhador e o pagamento fica confirmado automaticamente.',
      manualPayNote:  'Depois de pagares, anexa o comprovativo no dashboard. É o que resolve a disputa se o trabalhador reportar que não recebeu.',

      // Date & time
      dateSection:  'Data & Horário',
      minBadge:     '⏱ Mínimo 2 horas',
      labelFirstDay:'Primeiro dia',
      labelDate:    'Data do turno',
      labelStart:   'Hora de início',
      pickTime:     'Selecionar hora...',
      labelDuration:'Duração',
      durationMin:  '(mínimo)',

      multiDayLabel: 'Trabalho de vários dias',
      multiDayHint:  ' — o mesmo horário em várias datas. O trabalhador candidata-se uma vez e compromete-se com todos os dias.',
      addDay:        '+ Adicionar dia',
      removeDay:     'Remover {{date}}',
      maxDays:       'Um trabalho de vários dias pode ter no máximo {{max}} dias.',
      daysOne:       '1 dia',
      daysOther:     '{{count}} dias',
      totalHours:    '{{hours}}h no total',
      grossEstimate: '≈ €{{amount}} bruto',
      feeNote1:      'A taxa Turnos é de ',
      feeNoteBold1:  '€{{fee}} por trabalho',
      feeNote2:      ', não por dia. O pagamento ao trabalhador é feito ',
      feeNoteBold2:  'uma vez, no fim',
      feeNote3:      ' de todos os dias.',

      endLabel:    'Fim do turno:',
      endDuration: '· {{hours}}h de trabalho',
      nextDay:     '+1 dia',

      // Portuguese labour-law alerts
      law8h: 'Turno ≥ 8h: o trabalhador tem direito a pausa de 1h e subsídio de refeição (~€6,00/dia). Certifica-te de que o valor/hora reflecte este custo.',
      law4h: 'ℹ️ Turno ≥ 4h: o trabalhador tem direito a pausa obrigatória de 15–30 min (não computada no horário de trabalho).',

      // Location
      locationSection:    'Localização',
      labelAddress:       'Morada completa',
      addressPlaceholder: 'Ex: Rua Augusta 1, 1100-048 Lisboa',
      verifyAddress:      'Verificar',
      addressNotFound:    'Morada não encontrada. Tente ser mais específico (ex: "Rua Augusta 1, Lisboa").',

      // Pay & TSU
      paySection:   'Remuneração & Custos',
      labelRate:    'Valor bruto/hora (€) para o trabalhador',
      minWageHint:  'Salário mínimo em Portugal: €5,41/hr (2024)',
      tsuGross:     'Bruto trabalhador',
      tsuEmployer:  'TSU entidade (23,75%)',
      tsuTotal:     'Custo total empregador',
      tsuShiftCost: 'Custo total do turno ({{hours}}h)',

      // Actions & validation
      submit:     'Publicar Turno',
      submitting: 'A publicar...',
      errGeo:      'Por favor verifique a localização antes de publicar.',
      errDuration: 'A duração mínima de um turno é 2 horas.',
      errStart:    'Por favor selecione a hora de início.',
      errSubmit:   'Erro ao publicar turno.',
    },

    shifts: {
      title: 'Os Meus Turnos',
      refresh:   '↻ Atualizar',
      qrCodes:   'Códigos QR',
      newShift:  '+ Publicar Turno',
      loadError: 'Erro ao carregar turnos.',

      subCount:  '{{total}} turnos no total · {{active}} ativos',
      emptyText: 'Ainda não publicou nenhum turno.',
      emptyCta:  'Publicar primeiro turno →',

      sectionActive:  'Turnos Ativos',
      sectionHistory: 'Histórico',
      expiredToggle:  'Caducados ({{count}}) — Turnos sem trabalhador confirmado',
      expiredClose:   '▲ Fechar',
      expiredOpen:    '▼ Ver',
      expiredPill:    'Caducado',
      repost:         'Re-publicar',
      deleteExpired:  'Eliminar',
      deleteConfirm:  'Eliminar este turno caducado?',
      deleteError:    'Erro ao eliminar.',

      colShift:  'Turno',
      colDate:   'Data',
      colTime:   'Horário',
      colRate:   'Valor bruto',
      colStatus: 'Estado',
      colActions:'Ações',

      multiDayTag:  '{{count}} dias',
      viewApps:     'Candidatos',
      manualDone:   'Concluído',
      manualDoneTitle: 'Marcar como concluído (sem QR) — usar quando o turno não concluiu automaticamente',
      cancelBtn:    'Cancelar',
      cancelConfirmSimple: 'Tem a certeza que quer cancelar este turno?',
      cancelError:  'Erro ao cancelar.',
      confirmError: 'Erro ao confirmar.',
      manualConfirmBody: 'Marcar como concluído: "{{shift}}"\n\nO turno será encerrado e o pagamento será desencadeado automaticamente. Esta ação não pode ser desfeita.\n\nUsa esta opção apenas se o turno não concluiu automaticamente (ex.: check-in falhou).',

      qrTip1:   'Tem turnos confirmados hoje. Certifique-se de que os ',
      qrTipLink:'códigos QR',
      qrTip2:   ' estão visíveis no seu local de trabalho.',

      // Applicants modal
      appsTitle:   'Candidatos — {{shift}}',
      appsSubOne:  '{{date}} · {{time}} · 1 candidato',
      appsSubOther:'{{date}} · {{time}} · {{count}} candidatos',
      appsLoading: 'A carregar candidatos...',
      appsEmpty:   'Nenhum candidato ainda.',
      sortLabel:   'Ordenar:',
      sortRating:  'Melhor avaliação',
      sortScore:   'Perfil mais completo',
      sortDate:    'Mais antigo',
      matchBadge:  'Match total',
      matchCount:  '{{matched}}/{{total}} competências',
      appProfile:  'Perfil: {{score}}%',
      viewProfile: 'Ver perfil →',
      approved:    'Aprovado',
      rejected:    'Rejeitado',
      select:      'Selecionar',
      approveError:'Erro ao aprovar.',

      // Worker profile panel
      backToList:      '← Voltar à lista',
      noName:          'Nome não definido',
      ratingsCount:    '({{count}} aval.)',
      coverNoteTitle:  'Mensagem do candidato',
      panelBio:        'Apresentação',
      panelScore:      'Perfil completo',
      panelSkills:     'Competências',
      panelExperience: 'Experiência',
      panelCv:         'Currículo',
      panelCvFallback: 'Ver CV',
      panelLanguages:  'Idiomas',
      panelAvailability:'Disponibilidade',
      availableOn:     'Disponível para trabalhar',
      availableOff:    'Não disponível de momento',
      profileIncomplete:'Este candidato ainda não preencheu o perfil completo.',

      // Pending wages strip
      pendingTitle:    'Pagamentos pendentes a trabalhadores ({{count}})',
      cancellationMin: 'Mínimo 2h (cancelamento) —',
      awaitingWorker:  ' · aguarda confirmação do trabalhador',
      disputed:        '· trabalhador reporta não ter recebido',
      workerFallback:  'Trabalhador',
      ibanLabel:       'IBAN:',
      referenceLabel:  'Referência:',
      ibanWithheld:    'O trabalhador não autorizou a partilha do IBAN. Combina outro método (MB WAY) diretamente com ele, ou pede-lhe que ative o Turnos Pay Link.',
      viewProof:       'Ver comprovativo',
      noProofDeclared: 'Declarado sem comprovativo',
      payNow:          'Pagar agora',
      markPaid:        'Marcar como pago',
      adjustHours:     'Ajustar horas',
      reportProblem:   'Reportar problema',
      underReview:     'Em análise pela Turnos (48h)',
      pendingFooter:   'Pagamentos em falta há mais de 72h suspendem a publicação de novos turnos.',

      // Mark-as-paid modal
      markPaidTitle: 'Confirmar pagamento ao trabalhador',
      markPaidSub:   '{{shift}} · {{date}} · ',
      markPaidVia:   ' via {{method}}',
      ibanWithheldShort: 'O trabalhador não autorizou a partilha do IBAN.',
      proofLead:     'Anexa o ',
      proofBold:     'comprovativo',
      proofRest:     ' (recibo do banco ou captura do MB WAY). Fica associado a este turno e é o que resolve a disputa se o trabalhador reportar que não recebeu.',
      noProofPrompt: 'Sem comprovativo? Explica porquê — fica registado e visível em caso de disputa.',
      noProofPlaceholder: 'Ex.: pagamento feito por terceiro, recibo indisponível',
      markPaidSubmit:'Confirmar pagamento',
      sending:       'A enviar…',
      genericRetry:  'Erro — tenta novamente.',

      // Adjust-hours / report-problem modal
      adjustTitle:   'Ajustar horas trabalhadas',
      problemTitle:  'Reportar problema no turno',
      wageModalSub:  '{{shift}} · {{date}} · atual: €{{amount}}',
      adjustLead:    'Quantas horas trabalhou realmente? ',
      adjustBold:    'Mínimo 2 horas',
      adjustRest:    ' (política de turno terminado antecipadamente). O valor e o Pay Link são recalculados e o trabalhador é notificado.',
      adjustPlaceholder: 'Ex.: 3.5',
      problemLead:   'Descreve o que aconteceu (ex.: o trabalhador abandonou o turno a meio). O ciclo de lembretes de pagamento fica ',
      problemBold:   'pausado',
      problemRest:   ' enquanto a equipa Turnos analisa (até 48h).',
      adjustNotePlaceholder:  'Motivo (opcional)',
      problemNotePlaceholder: 'Descrição do problema (obrigatório)',
      adjustSubmit:  'Ajustar e recalcular',
      problemSubmit: 'Reportar problema',

      // Cancel-shift modal
      cancelTitle:  'Cancelar turno preenchido',
      cancelSub:    '{{shift}} · {{date}} · {{time}}',
      under3h1:     'Faltam menos de',
      under3hBold1: '3 horas',
      under3h2:     ' para o início. Se o cancelamento for por erro/decisão da empresa, deves pagar o ',
      under3hBold2: 'mínimo de 2 horas (€{{amount}})',
      under3h3:     ' ao trabalhador + a taxa normal de 3€. Motivos justificados são avaliados pela Turnos em até 48h.',
      reasonLabel:  'Motivo do cancelamento',
      erroEmpresaTag: '2h mín. + 3€',
      cancelNotePlaceholder: 'Descrição (opcional, recomendado para motivos justificados)',
      under24h:     '⏳ Faltam menos de 24 horas. O cancelamento é gratuito mas fica registado na fiabilidade da empresa. O trabalhador será notificado com um pedido de desculpas.',
      over24h:      'Faltam mais de 24 horas — cancelamento gratuito. O trabalhador será notificado com um pedido de desculpas e o turno reabre para outros workers.',
      cancelSubmit: 'Cancelar turno',
      cancelling:   'A cancelar…',
    },
  },

  /** Public marketing pages — landing, login, register. */
  home: {
    nav: {
      forCompanies: 'Para empresas',
      login:    'Entrar',
      register: 'Criar conta →',
    },

    hero: {
      badge:       'Lisboa Beta · Plataforma operacional',
      titleLine1:  'Work Today.',        // brand line — same in both languages
      titleAccent: 'Staff Today.',
      sub:         'O mercado de turnos para Portugal. Encontra trabalhadores verificados em minutos — com conformidade MCD automática, QR check-in e todos os dados prontos para pagares diretamente ao worker.',
      ctaPrimary:  'Publicar Turno →',
      ctaGhost:    'Já tenho conta',
    },

    /**
     * The decorative "match" card floating in the hero.
     *
     * `role` is plain copy, NOT tSkill(). This card is a mock, not stored data:
     * the real job title is 'Cozinheiro/a' and rendering that slash in a
     * marketing hero reads badly, so the masculine form is used to agree with
     * "Carlos M.". Keep it in step with SKILLS_EN['Cozinheiro/a'] by hand.
     */
    heroCard: {
      role:        'Cozinheiro',
      workerName:  'Carlos M.',
      workerMeta:  '{{role}} · ⭐ 4.9 · Verificado',
      available:   'Disponível',
      companyName: 'Restaurante A Taberna',
      companyMeta: '{{role}} · Hoje 18h–02h · €10/hr',
      match:       '✓ Match confirmado',      step1:       'Turno publicado',
      step2:       'Candidatura recebida',
      step3:       'Worker confirmado ✓',
    },

    stats: {
      feeValue:        '3€',
      fee:             'Taxa fixa por turno concluído',
      speedValue:      '~5 min',
      speed:           'Para publicar um turno',
      commissionValue: '0%',
      commission:      'Comissões sobre salários',
      dataValue:       '100%',
      data:            'Dados prontos para a contabilidade',
    },

    howItWorks: {
      title: 'Como funciona',
      sub:   'Do turno publicado ao pagamento — sem papelada pelo meio.',
      publish:  { title: 'Publicas o turno',     desc: 'Função, horário, morada e valor/hora. Menos de cinco minutos.' },
      apply:    { title: 'Chegam candidaturas',  desc: 'Avisamos quem tem as competências certas. As candidaturas chegam em minutos.' },
      select:   { title: 'Escolhes quem queres', desc: 'Vês perfis, avaliações e competências antes de decidir.' },
      confirm:  { title: 'O trabalhador aceita', desc: 'Tem 2 horas para confirmar. Sem resposta, o turno reabre sozinho.' },
      checkIn:  { title: 'Check-in por QR',      desc: 'Digitaliza o teu QR à chegada. O turno fecha sozinho à hora de fim.' },
      pay:      { title: 'Pagas diretamente',    desc: 'Pagas o bruto ao trabalhador pelo método que escolheste.' },
    },

    features: {
      title: 'O que a plataforma faz por ti',
      sub:   'Tudo o que precisas para preencher um turno. Nada do que não precisas.',
      notifications:  { title: 'Notificações inteligentes', body: 'Quem tem as competências certas é avisado em segundos. Segunda vaga ao fim de 5 horas se ninguém se candidatar.' },
      ratings:        { title: 'Avaliações e reputação',    body: 'Avalias cada turno. Os melhores ganham distintivos e aparecem primeiro.' },
      confirmation:   { title: 'Confirmação obrigatória',   body: 'Quem escolheres tem 2 horas para aceitar. Sem resposta, o turno reabre.' },
      qrCheckIn:      { title: 'Check-in verificado',       body: 'QR fixo e geofence de 200 m. O turno fecha sozinho — podes ajustar horas antes de pagar.' },
      directPay:      { title: 'Pagamento direto',          body: 'Pagas ao trabalhador diretamente. A nós pagas só 3€ por turno concluído.' },
      search:         { title: 'Pesquisa de talento',       body: 'Procura por competência, idioma e disponibilidade. Convida direto para um turno.' },
      applicants:     { title: 'Candidatos comparáveis',    body: 'Compara candidaturas por avaliação, perfil e competências, lado a lado.' },
      dashboard:      { title: 'Painel de conformidade',    body: 'Valores por turno, registo de auditoria e exportação em CSV.' },
      spending:       { title: 'Controlo de gastos',        body: 'Gastos por período e custo total por turno, com faturação automática.' },
    },


    roadmap: {
      title: 'Roadmap de desenvolvimento',
      sub:   'Transparência total — stints 0–7 completos. Stint 8 em progresso.',
      s0: 'Foundation & Setup',
      s1: 'Auth & Identidade',
      s2: 'Marketplace de Turnos',
      s3: 'Notificações & Real-Time',
      s4: 'Conformidade Portugal',
      s5: 'QR Check-In automático',
      s6: 'Pagamentos & Payroll',
      s7: 'Ratings & Reputação',
      s8: 'Produto & Operações',
      s9: 'Crescimento & Flywheel',
      statusDone:    '✅ Completo',
      statusActive:  '🔄 Em progresso',
      statusPlanned: 'Planeado',
    },

    cta: {
      title:   'Pronto para preencher o teu próximo turno?',
      sub:     'Junte-se à beta de Lisboa. Sem custos de setup. Primeiro turno grátis.',
      primary: 'Criar conta →',
      ghost:   'Já tenho conta',
    },

    footer: {
      tagline:  'Work Today. Staff Today. · Lisboa Beta 2026',
      privacy:  'Privacidade',
      terms:    'Termos',
      login:    'Entrar',
      register: 'Registar',
    },

    // ── Sectors (the eight real SHIFT_CATEGORIES; names come from the domain
    //    catalogue, only these blurbs live here) ──
    sectors: {
      eyebrow: 'Faz sentido para ti?',
      title:   'O sector que for. O perfil de que precisas.',
      sub:     'Publica um turno e escolhe quem entra na tua equipa. Sem agência, sem cedência de trabalhadores.',
      restaurants: 'Tens a tua equipa de sempre para o dia a dia. Para a sexta cheia, o evento privado de sábado ou agosto inteiro, ativas a camada flexível — profissionais que já conheces e que voltam quando precisas.',
      hospitality: 'Check-ins em cascata, um andar inteiro por preparar, um grupo que chega sem aviso. Reforça a receção e os quartos ao dia, com pessoas que já sabem como trabalham.',
      events:      'Montagem, serviço e desmontagem no mesmo fim de semana. Contrata a equipa toda para os dias exatos do evento e fecha tudo num só trabalho.',
      sales:       'Campanhas, saldos, inventário, época alta. Reforça a loja nos dias que contam sem aumentar o quadro permanente.',
      logistics:   'Picos de encomendas, inventários, cargas e descargas. Gente disponível para os dias em que o armazém não pára.',
      facilities:  'Limpeza entre turnos, manutenção pontual, vigilância de um evento. Cobre o que a equipa fixa não chega a fazer.',
      support:     'Picos de chamadas, lançamentos, campanhas sazonais. Reforça o atendimento sem contratar para o ano inteiro.',
      admin:       'Substituições, back-office em época alta, apoio a um projeto. Perfis administrativos para períodos curtos.',
    },


    // ── FAQ, companies. Sourced from docs/faq-turnos.md; the answers marked 🔵
    //    there (ETT status, who the employer is) are deliberately NOT here —
    //    they need the attorney's sign-off before going on a public page. ──
    faq: {
      eyebrow:  'Perguntas frequentes',
      title:    'O que as empresas perguntam',
      q1: 'Quanto custa?',
      a1: 'Uma subscrição mensal (Starter 45€/mês) mais uma taxa fixa de 3€ por turno concluído, faturada uma vez por mês. Não há comissão sobre o salário.',
      q2: 'A Turnos fica com uma parte do salário do trabalhador?',
      a2: 'Nunca. O trabalhador recebe o bruto por inteiro. A nossa receita vem da empresa, não de quem trabalha.',
      q3: 'Quem paga ao trabalhador?',
      a3: 'A tua empresa, diretamente. Escolhes o método ao publicar o turno: Turnos Pay Link, transferência bancária ou MB WAY. O dinheiro nunca passa pela Turnos.',
      q4: 'Em quanto tempo preencho um turno?',
      a4: 'Ao publicares, notificamos os trabalhadores cujas competências correspondem ao turno. Recebes candidaturas e escolhes. Se ninguém se candidatar em 5 horas, uma segunda vaga de notificações sai automaticamente.',
      q5: 'E a papelada legal?',
      a5: 'O contrato MCD (Muito Curta Duração) é gerado automaticamente quando confirmas o trabalhador, e a comunicação à Segurança Social é preparada para as 24h anteriores ao turno. Também bloqueamos candidaturas que ultrapassem os limites legais — 70 dias/ano com o mesmo empregador, 11h de descanso entre turnos.',
      q6: 'E se um trabalhador faltar?',
      a6: 'Podes registar a falta. O trabalhador recebe 1 estrela automática e fica suspenso 30 dias; à segunda falta, é bloqueado permanentemente. O turno volta a abrir e notificamos de novo.',
      q7: 'Posso cancelar um turno?',
      a7: 'Com mais de 24h de antecedência, sem custo. Entre 24h e 3h, fica registado. A menos de 3h, deves ao trabalhador um mínimo de 2 horas — a menos que o motivo se enquadre nas exceções justificadas, que a nossa equipa analisa.',
      q8: 'Trabalho em vários dias conta como quantos turnos?',
      a8: 'Um. Um trabalho de vários dias é uma única candidatura, um único pagamento e uma única taxa de 3€, seja de dois dias ou de cinco.',
    },

    // ── Workers page ──
    workers: {
      navLink:  'Para trabalhadores',
      metaTitle: 'Turnos — trabalho flexível em Portugal',

      heroEyebrow: 'Trabalho flexível, a sério',
      heroTitle1:  'Escolhes tu',
      heroTitle2:  'onde e quando trabalhas.',
      heroBody:    'A Turnos é onde encontras turnos pagos perto de ti, te candidatas aos que te servem e constróis um perfil com avaliações reais de quem já trabalhou contigo.',
      heroCta:     'Descarregar a app',
      heroCtaSoon: 'Em breve',
      heroNote:    'Grátis para sempre · Recebes o bruto por inteiro · Contrato MCD legal',

      // Example shift cards in the hero
      cardsTitle: 'Turnos como estes, perto de ti',
      card1Role: 'Empregado/a de mesa',  card1Place: 'Baixa · Lisboa',        card1When: 'Amanhã',
      card2Role: 'Barista',              card2Place: 'Cais do Sodré · Lisboa', card2When: 'Sáb',
      card3Role: 'Assistente de eventos', card3Place: 'Parque das Nações',     card3When: 'Sex',
      card4Role: 'Rececionista',         card4Place: 'Avenida · Lisboa',       card4When: 'Hoje',

      stepsTitle: 'Como funciona',
      step1Title: 'Cria o teu perfil',
      step1Body:  'Nome, NIF, IBAN, as tuas competências e os dias em que podes trabalhar. Leva minutos. A nossa equipa aprova o perfil, normalmente no mesmo dia útil.',
      step2Title: 'Candidata-te aos turnos que queres',
      step2Body:  'Vês o valor à hora, a morada, o horário e quem é a empresa antes de te candidatares. Sem obrigação: candidatas-te só ao que te serve.',
      step3Title: 'Trabalha e recebe',
      step3Body:  'Digitalizas o QR à chegada. No fim, a empresa paga-te o bruto por inteiro — diretamente, pelo método combinado. A Turnos não fica com nada.',

      whyTitle: 'Porquê a Turnos',
      why1Title: 'Recebes o bruto por inteiro',
      why1Body:  'Não cobramos nada aos trabalhadores. Nem comissão, nem subscrição, nem taxa por turno.',
      why2Title: 'Contrato legal em cada turno',
      why2Body:  'Cada turno gera um contrato MCD e é comunicado à Segurança Social. Trabalho declarado, sempre.',
      why3Title: 'A tua reputação viaja contigo',
      why3Body:  'As avaliações das empresas ficam no teu perfil. Quanto melhor trabalhas, mais convites recebes.',
      why4Title: 'Tu decides',
      why4Body:  'Sem horários impostos e sem penalização por recusares. Trabalhas nos dias que escolheres.',

      faqTitle: 'Perguntas frequentes',
      q1: 'A Turnos é gratuita?',
      a1: 'Sim, e para sempre. Não cobramos nada aos trabalhadores — nem inscrição, nem comissão, nem taxa por turno.',
      q2: 'Quanto recebo?',
      a2: 'O valor bruto à hora que aparece no turno, multiplicado pelas horas. É o valor que combinaste, sem descontos da nossa parte.',
      q3: 'Quem me paga, e quando?',
      a3: 'A empresa paga-te diretamente, depois do turno terminar, pelo método indicado no anúncio (Turnos Pay Link, transferência ou MB WAY). Se não receberes, marcas "Não recebi" na app e a nossa equipa trata do assunto.',
      q4: 'Que contrato tenho?',
      a4: 'Um contrato MCD (Muito Curta Duração), gerado automaticamente e comunicado à Segurança Social pela empresa. É trabalho declarado.',
      q5: 'E os descontos para a Segurança Social?',
      a5: 'Recebes o bruto por inteiro e és tu que declaras. A app calcula os 11% para te ajudar a saber quanto separar — mas esse dinheiro fica contigo até o entregares.',
      q6: 'Como me inscrevo?',
      a6: 'Descarregas a app, confirmas o teu número de telemóvel e preenches o perfil: nome, NIF, IBAN, competências e disponibilidade. Precisas de 80% de perfil completo para te candidatares.',
      q7: 'Quanto tempo demora a aprovação?',
      a7: 'Normalmente no mesmo dia útil. Revemos cada perfil à mão antes de o ativar — é isso que faz as empresas confiarem em quem se candidata.',
      q8: 'Posso cancelar um turno que aceitei?',
      a8: 'Com mais de 24 horas de antecedência, sem penalização. Com menos, fica um aviso no teu perfil; dois avisos em 30 dias suspendem-te durante 7 dias. Se foi doença ou emergência, podes justificar.',
      q9: 'Há limite de dias que posso trabalhar?',
      a9: 'Sim: 70 dias por ano com a mesma empresa, por lei. A app bloqueia automaticamente antes de ultrapassares o limite.',
      q10: 'As empresas veem as minhas avaliações?',
      a10: 'Veem. A média, o número de turnos e o que outras empresas escreveram sobre o teu trabalho. É o teu melhor argumento.',

      ctaTitle: 'Pronto para começar?',
      ctaBody:  'Cria o teu perfil e candidata-te ao primeiro turno esta semana.',
      ctaBtn:   'Descarregar a app',
      ctaSoon:  'A app chega em breve. Deixa o teu contacto e avisamos-te.',
    },
    login: {
      panelTitle1: 'Gerencie os seus turnos.',
      panelTitle2: 'Sem complicações.',
      panelSub:    'Publique um turno em 10 segundos. Conformidade MCD automática. Pagamento por turno concluído.',
      panelFooter: 'Beta fechada · Lisboa · 2026',
      panelSpeed:      'Preencha turnos em minutos',
      panelCompliance: 'Contratos MCD automáticos',
      panelDirectPay:  'Pagas direto ao worker, sem comissões',

      title:        'Entrar na conta',
      noAccount:    'Não tem conta?',
      registerLink: 'Registar empresa →',

      email:            'Email',
      emailPlaceholder: 'empresa@exemplo.pt',
      password:         'Password',
      showPassword:     'Mostrar password',
      hidePassword:     'Ocultar password',
      forgot:           'Esqueceu a password?',
      submit:           'Entrar →',

      or:         'ou',
      google:     'Continuar com Google',
      comingSoon: 'Em breve',
      devBypass:  '🛠 Dev: entrar sem API',

      connectionError: 'Não foi possível ligar ao servidor. Tente novamente.',

      legalPrefix:  'Ao entrar, aceita os',
      legalTerms:   'Termos de Serviço',
      legalAnd:     'e a',
      legalPrivacy: 'Política de Privacidade',
    },

    register: {
      panelTitle:  'Registe a sua empresa gratuitamente',
      panelSub:    'Beta fechada · Lisboa · Primeiros 50 empregadores sem custo de adesão.',
      panelFooter: 'Ao registar-se, aceita os Termos de Serviço e a Política de Privacidade da Turnos.',
      stepCompany: 'Empresa',
      stepAccount: 'Conta',
      stepReview:  'Confirmação',

      // Step 1 — company
      companyTitle:   'Dados da empresa',
      haveAccount:    'Já tem conta?',
      loginLink:      'Entrar →',
      labelName:      'Nome da empresa *',
      placeholderName:'Ex: Restaurante A Taberna, Lda',
      labelNipc:      'NIPC *',
      hintNipc:       '9 dígitos',
      labelNif:       'NIF (opcional)',
      hintNif:        'Responsável',
      labelSector:    'Sector de actividade *',
      pickSector:     'Selecione o sector',
      labelAddress:   'Morada *',
      placeholderAddress: 'Rua do Ouro, 123',
      labelPostal:    'Código Postal *',
      labelCity:      'Cidade *',
      placeholderCity:'Lisboa',
      continue:       'Continuar →',

      // Step 2 — admin account
      adminTitle:  'Conta de administrador',
      adminSub:    'O email e password para aceder ao dashboard.',
      labelEmail:  'Email *',
      placeholderEmail: 'admin@empresa.pt',
      labelPassword: 'Password *',
      hintPassword:  'Mínimo 8 caracteres',
      labelConfirm:  'Confirmar Password *',
      back:          '← Voltar',

      // Step 3 — review
      reviewTitle: 'Confirme os dados',
      reviewSub:   'Verifique antes de submeter o registo.',
      rowCompany:  'Empresa',
      rowNipc:     'NIPC',
      rowSector:   'Sector',
      rowAddress:  'Morada',
      rowEmail:    'Email admin',
      submit:      'Criar conta →',
      submitting:  'A registar...',

      // Validation
      errName:     'Nome da empresa obrigatório',
      errNipc:     'NIPC deve ter 9 dígitos',
      errSector:   'Selecione o sector',
      errAddress:  'Morada obrigatória',
      errPostal:   'Formato: XXXX-XXX',
      errCity:     'Cidade obrigatória',
      errEmail:    'Email inválido',
      errPassword: 'Mínimo 8 caracteres',
      errConfirm:  'As passwords não coincidem',
      errUnknown:  'Erro desconhecido. Tente novamente.',
    },
  },

  /**
   * Server-thrown messages. The API resolves these per request from the
   * `Accept-Language` header — see apps/api/src/i18n/request-language.ts.
   *
   * Only messages a real user can actually hit live here. Internal/defensive
   * throws ("Not your shift", "Employer not found") stay in English on purpose:
   * a correct client never reaches them, and an English string is more useful
   * in a log than a translated one. Ops and accountant emails are NOT
   * translated either — locked decision.
   */
  api: {
    common: {
      shiftNotFound: 'Turno não encontrado.',
    },

    auth: {
      nipcInvalid:        'NIPC inválido.',
      nifInvalid:         'NIF inválido.',
      postalCodeInvalid:  'Código postal inválido. Formato: XXXX-XXX',
      emailTaken:         'Este email já está registado.',
      invalidCredentials: 'Credenciais inválidas.',
      ibanInvalid:        'IBAN inválido. Formato: PT50... (25 caracteres).',
      verifyLinkInvalid:  'Token de verificação inválido ou expirado.',
      imagesOnly:         'Apenas imagens são permitidas.',
      noImage:            'Nenhuma imagem fornecida.',
      cvFormat:           'O CV tem de ser um ficheiro PDF ou Word (.doc/.docx).',
      noFile:             'Nenhum ficheiro fornecido.',
      emailInvalid:        'Email inválido.',
      passwordTooShort:    'A palavra-passe deve ter pelo menos 8 caracteres.',
      currentPasswordWrong:'A palavra-passe atual está incorreta.',
      pushTokenMissing:   'Token inválido.',
    },

    shifts: {
      minDuration:           'A duração mínima de um turno é 2 horas.',
      noDates:               'Indica pelo menos uma data para o turno.',
      maxSeriesDays:         'Um turno de vários dias pode ter no máximo {{max}} dias (limite do contrato MCD).',
      paymentMethodRequired: 'Indica como vais pagar ao trabalhador (Turnos Pay Link, transferência bancária ou MB WAY).',
      cancelReasonRequired:  'Cancelamentos a menos de 3 horas do início exigem um motivo (erro da empresa ou uma das exceções justificadas).',
      cancelConsequence:     'Cancelamento a menos de 3h do início: deves pagar o mínimo de 2 horas (€{{amount}}) ao trabalhador + taxa de 3€.',

      // Apply gate
      notOpen:            'Este turno já não está aberto a candidaturas.',
      alreadyApplied:     'Já te candidataste a este turno.',
      accountBlocked:     'A tua conta foi bloqueada por faltas repetidas a turnos confirmados. Contacta o suporte Turnos.',
      accountSuspended:   'A tua conta está suspensa até {{date}} devido a cancelamentos tardios ou faltas.',
      profileIncomplete:  'O teu perfil está {{score}}% completo. Precisas de pelo menos 80% para te candidatares.',

      // Worker cancellation
      cancelOnlyConfirmed: 'Só podes cancelar turnos confirmados que ainda não começaram.',
      seriesStarted:       'Este é um trabalho de vários dias que já começou. Ao aceitares, comprometeste-te com todos os dias — contacta o suporte (suporte@turnos.pt) se tiveres um imprevisto.',
      alreadyStarted:      'O turno já começou — cancela junto do empregador.',
      cancelledSuspended:  'Turno cancelado. Por teres 2 cancelamentos tardios em 30 dias, não podes candidatar-te a turnos durante 7 dias.',
      cancelledLate:       'Turno cancelado. Atenção: cancelar a menos de 24h do início afeta a tua fiabilidade na plataforma.',
      cancelledFree:       'Turno cancelado sem penalização. O turno voltou ao estado aberto.',
      declined:            'Turno recusado. O turno voltou ao estado aberto.',
      deleted:             'Turno eliminado.',
    },

    attendance: {
      checkOutQrRetired: 'Este QR já não é utilizado. Digitaliza o QR de check-in à entrada.',
      alreadyCheckedIn:  'Já fez check-in neste turno.',
      notOpenForCheckIn: 'O turno não está disponível para check-in.',
      shiftClosed:       'Turno já concluído ou cancelado.',
      disputeExists:     'Já existe uma disputa registada neste turno.',
      noShiftHere:       'Não tem nenhum turno confirmado neste local para hoje. Verifique se está no local correto ou contacte o empregador.',
      qrInvalid:         'QR code inválido.',
      qrTampered:        'QR code inválido ou adulterado.',
      checkInTooEarly:   'Check-in disponível a partir das {{from}}. O turno começa às {{start}}.',
      checkInWindowOver: 'A janela de check-in expirou (mais de 1h após o início do turno). Contacte o empregador para confirmação manual.',
      tooFarAway:        'Está a {{distance}}m do local do turno. Deve estar a menos de {{radius}}m para fazer check-in.',
    },

    compliance: {
      restPeriod:        'Mínimo {{hours}}h de descanso obrigatório entre turnos (Diretiva Europeia do Tempo de Trabalho). Disponível a partir de {{availableAt}}.',
      mcdLimitSeries:    'Limite MCD: já tens {{used}}/{{limit}} dias com este empregador em {{year}} e este trabalho tem {{days}} dias — excede o limite legal. A Lei 93/2019 não permite mais de {{limit}} dias/ano com o mesmo empregador.',
      mcdLimitReached:   'Limite MCD atingido: {{used}}/{{limit}} dias com este empregador em {{year}}. Legislação portuguesa (Lei 93/2019) não permite mais de {{limit}} dias/ano com o mesmo empregador.',
      dependencyBlock:   'Limite de dependência económica atingido: {{percent}}% dos seus rendimentos anuais declarados provêm deste empregador. A Agenda do Trabalho Digno (Lei 13/2023) impede mais de {{limit}}% de dependência de um único empregador.',
      dependencyWarning: 'Atenção: {{percent}}% dos seus rendimentos anuais declarados provêm deste empregador. O limite legal é {{limit}}%. Considere diversificar.',
    },

    payments: {
      cardRequired:         'Adiciona um cartão antes de subscrever o plano.',
      subscriptionRequired: 'Precisas de uma subscrição ativa para publicar turnos. Ativa o teu plano em Faturação.',
      overdueWages:         'Tens pagamentos a trabalhadores em falta há mais de 72 horas. Regulariza-os em Turnos → Pagamentos pendentes para voltares a publicar.',
      maxActiveShifts:      'O plano atual permite até {{max}} turnos ativos em simultâneo. Cancela ou conclui turnos existentes primeiro.',
      connectRequired:      'Completa o registo bancário primeiro.',
    },

    wages: {
      notFound:                  'Pagamento não encontrado.',
      cancellationNotAdjustable: 'O mínimo de cancelamento não pode ser ajustado.',
      onlyPendingAdjustable:     'Só podes ajustar pagamentos ainda pendentes.',
      cannotReport:              'Este pagamento já não pode ser reportado.',
      stripeConfirmed:           'Este pagamento foi confirmado pelo Stripe — contacta o suporte se não o recebeste.',
    },
  },
} as const;

export type TranslationCatalogue = typeof pt;
