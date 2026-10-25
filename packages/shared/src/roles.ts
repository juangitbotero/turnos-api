/**
 * Role catalogue — the ONE vocabulary a worker declares and a company asks for.
 *
 * Approved 2026-10-25 (docs/skills-matching-proposal.md). Every role has:
 *  - 1 to 3 levels, each described by what the person can DO (never years),
 *    read identically by the worker declaring it and the company requiring it;
 *  - 3–7 tasks: the worker ticks the ones they have done, the company ticks the
 *    ones the shift involves. Tasks replace the old "additional skills" picker;
 *  - optionally a legally required document (security card, forklift
 *    certificate, driving licence).
 *
 * ⚠️ Stored values: the role NAME (Portuguese, like before — `worker.roles[].role`,
 * `shift.subcategory`) and the task ID (`worker.roles[].tasks`,
 * `shift.tasksRequired`). Never rename a role or a task id without an entry in
 * LEGACY_SKILL_ALIASES / a migration — see the note in i18n/domain.ts.
 *
 * Grouped by role FAMILY, not by workplace: a hotel restaurant needs the same
 * waiter as a restaurant, so no role appears in two categories.
 */

export type RoleLevel = 1 | 2 | 3;

export interface Bilingual { pt: string; en: string }

export interface RoleTask extends Bilingual {
  /** Stable stored id — never change once released. */
  id: string;
}

export type RoleCertificate = 'SECURITY_CARD' | 'FORKLIFT' | 'DRIVING_LICENCE';

export interface RoleDefinition {
  en: string;
  /** Level descriptions, from level 1 upwards. Length = the role's top level. */
  levels: readonly Bilingual[];
  tasks: readonly RoleTask[];
  certificate?: RoleCertificate;
}

const lv = (pt: string, en: string): Bilingual => ({ pt, en });
const tk = (id: string, pt: string, en: string): RoleTask => ({ id, pt, en });

// ─── Shared task definitions (same id wherever they appear) ─────────────────

const HACCP = tk('haccp', 'Formação HACCP (higiene alimentar)', 'HACCP food-hygiene training');
const TILL  = tk('till', 'Caixa e pagamentos', 'Till & payments');

// ─── The catalogue ───────────────────────────────────────────────────────────

export const ROLE_CATALOGUE = {
  'Sala e Bar': {
    'Empregado/a de mesa': {
      en: 'Waiter / Waitress',
      levels: [
        lv('Leva pratos e bebidas, monta e levanta mesas, com supervisão',
           'Carries plates and drinks, sets and clears tables, under supervision'),
        lv('Gere sozinho/a uma secção de mesas — pedidos, recomendações e conta',
           'Runs a section of tables alone — orders, recommendations and the bill'),
        lv('Serviço de alto volume ou fine dining; coordena outros empregados',
           'High-volume or fine-dining service; coordinates other waiters'),
      ],
      tasks: [
        tk('take_orders', 'Anotar pedidos (papel ou POS)', 'Taking orders (paper or POS)'),
        tk('carry_three_plates', 'Transportar 3 pratos', 'Carrying 3 plates'),
        tk('wine_service', 'Serviço de vinhos', 'Wine service'),
        tk('fine_dining', 'Serviço formal (fine dining)', 'Formal service (fine dining)'),
        tk('banquets', 'Banquetes', 'Banquets'),
        tk('bill_payment', 'Pagamentos e fecho de conta', 'Payments and closing the bill'),
      ],
    },
    'Runner / Ajudante de sala': {
      en: 'Runner / Busser',
      levels: [
        lv('Função de entrada — sem experiência necessária',
           'Entry role — no experience needed'),
      ],
      tasks: [
        tk('run_plates', 'Levar pratos da cozinha às mesas', 'Running plates from the kitchen'),
        tk('clear_reset', 'Levantar e repor mesas', 'Clearing and resetting tables'),
        tk('polish', 'Polir loiça e talheres', 'Polishing glassware and cutlery'),
      ],
    },
    'Empregado/a de balcão': {
      en: 'Counter staff',
      levels: [
        lv('Serve cafés, imperiais, vinho a copo e refrigerantes; limpa e repõe o balcão',
           'Serves coffee, draught beer, wine by the glass and soft drinks; cleans and restocks the counter'),
        lv('Gere o balcão sozinho/a num serviço normal, incluindo a caixa',
           'Runs the counter alone in a normal service, including the till'),
        lv('Balcão de alto volume (esplanada cheia, discoteca, recinto); coordena outros',
           'High-volume counter (busy terrace, club, venue); coordinates others'),
      ],
      tasks: [
        tk('coffee_machine', 'Máquina de café', 'Coffee machine'),
        tk('draught_beer', 'Tirar imperial', 'Pulling draught beer'),
        TILL,
        tk('open_close_bar', 'Abrir e fechar o bar', 'Opening and closing the bar'),
        tk('terrace', 'Esplanada', 'Terrace service'),
      ],
    },
    'Barman / Bartender': {
      en: 'Bartender',
      levels: [
        lv('Prepara bebidas simples e apoia o barman (barback)',
           'Makes simple drinks and supports the bartender (barback)'),
        lv('Cocktails clássicos sem consultar receita; trabalha sozinho/a num serviço normal',
           'Classic cocktails without a recipe; works alone in a normal service'),
        lv('Chefe de bar / mixologia — carta própria, alto volume',
           'Head bartender / mixology — own menu, high volume'),
      ],
      tasks: [
        tk('classic_cocktails', 'Cocktails clássicos', 'Classic cocktails'),
        tk('signature_mixology', 'Mixologia de autor', 'Signature mixology'),
        tk('event_bar', 'Bar de eventos (alto volume)', 'Event bar (high volume)'),
        tk('bar_stock', 'Stock e inventário do bar', 'Bar stock and inventory'),
        tk('wine_sparkling', 'Vinhos e espumantes', 'Wine and sparkling wine'),
      ],
    },
    'Barista': {
      en: 'Barista',
      levels: [
        lv('Cafés base (expresso, galão, meia de leite) com apoio ou máquina automática',
           'Basic coffees (espresso, latte, flat white) with support or an automatic machine'),
        lv('Máquina manual e leite texturizado; aguenta a hora de ponta sozinho/a',
           'Manual machine and textured milk; handles the rush alone'),
        lv('Latte art, afinação do moinho e métodos de filtro; forma outros',
           'Latte art, grinder calibration and filter methods; trains others'),
      ],
      tasks: [
        tk('manual_espresso', 'Máquina manual', 'Manual espresso machine'),
        tk('latte_art', 'Leite texturizado / latte art', 'Textured milk / latte art'),
        tk('filter_methods', 'Métodos de filtro', 'Filter methods'),
        tk('grinder_calibration', 'Afinação do moinho', 'Grinder calibration'),
        TILL,
      ],
    },
  },

  'Cozinha': {
    'Cozinheiro/a': {
      en: 'Cook',
      levels: [
        lv('Pratos simples de uma carta definida (grelhados, fritos, saladas), com supervisão',
           'Simple dishes from a set menu (grill, fryer, salads), under supervision'),
        lv('Responsável por uma partida sozinho/a durante o serviço',
           'Runs a station alone during service'),
        lv('Chefe de partida / sous-chef — vários postos, equipa e encomendas',
           'Chef de partie / sous-chef — several stations, the team and orders'),
      ],
      tasks: [
        tk('grill', 'Grelhador', 'Grill'),
        tk('fryer', 'Fritos', 'Fryer'),
        tk('cold_kitchen', 'Cozinha fria', 'Cold kitchen'),
        tk('pizza_oven', 'Pizza (forno)', 'Pizza (oven)'),
        tk('sushi', 'Sushi', 'Sushi'),
        tk('banquet_kitchen', 'Cozinha de banquetes', 'Banquet kitchen'),
        HACCP,
      ],
    },
    'Ajudante de cozinha': {
      en: 'Kitchen assistant',
      levels: [
        lv('Lava, descasca, corta e prepara ingredientes, com supervisão',
           'Washes, peels, cuts and preps ingredients, under supervision'),
        lv('Faz a mise en place sozinho/a e apoia uma partida no serviço',
           'Does the mise en place alone and supports a station during service'),
      ],
      tasks: [
        tk('basic_cuts', 'Cortes básicos', 'Basic knife cuts'),
        tk('mise_en_place', 'Mise en place', 'Mise en place'),
        tk('cold_room_stock', 'Arrumação de câmaras e stock', 'Cold-room and stock organisation'),
        HACCP,
      ],
    },
    'Copeiro/a (lavagem de loiça)': {
      en: 'Dishwasher / Kitchen porter',
      levels: [
        lv('Função de entrada — sem experiência necessária',
           'Entry role — no experience needed'),
      ],
      tasks: [
        tk('industrial_dishwasher', 'Máquina de lavar industrial', 'Industrial dishwasher'),
        tk('kitchen_cleaning', 'Limpeza da cozinha', 'Kitchen cleaning'),
        tk('waste_recycling', 'Lixos e reciclagem', 'Waste and recycling'),
      ],
    },
    'Pasteleiro/a': {
      en: 'Pastry chef',
      levels: [
        lv('Apoia a produção (massas base, decoração simples)',
           'Supports production (basic doughs, simple decoration)'),
        lv('Executa a produção diária sozinho/a',
           'Runs the daily production alone'),
        lv('Responsável da pastelaria, com receitas próprias',
           'Head of pastry, with own recipes'),
      ],
      tasks: [
        tk('pastry_doughs', 'Massas (folhada, quebrada, levedada)', 'Doughs (puff, shortcrust, leavened)'),
        tk('portuguese_pastry', 'Pastelaria portuguesa', 'Portuguese pastries'),
        tk('cakes_decoration', 'Bolos de evento e decoração', 'Celebration cakes and decoration'),
        tk('plated_desserts', 'Sobremesas de restaurante', 'Plated desserts'),
        HACCP,
      ],
    },
    'Padeiro/a': {
      en: 'Baker',
      levels: [
        lv('Apoia a produção (pesagem, tender)',
           'Supports production (weighing, shaping)'),
        lv('Faz a produção sozinho/a, incluindo turno noturno',
           'Runs production alone, including night shifts'),
        lv('Responsável pela fornada e pelas receitas',
           'In charge of the bake and the recipes'),
      ],
      tasks: [
        tk('sourdough', 'Massa-mãe', 'Sourdough'),
        tk('traditional_bread', 'Pão tradicional', 'Traditional bread'),
        tk('wood_oven', 'Forno a lenha', 'Wood-fired oven'),
        tk('night_shift', 'Turno noturno', 'Night shift'),
      ],
    },
  },

  'Alojamento': {
    'Rececionista': {
      en: 'Hotel receptionist',
      levels: [
        lv('Acolhe hóspedes e responde a pedidos simples, com apoio',
           'Welcomes guests and handles simple requests, with support'),
        lv('Check-in/out, pagamentos e reservas no PMS; faz o turno sozinho/a',
           'Check-in/out, payments and bookings in the PMS; covers the shift alone'),
        lv('Chefe de turno / auditoria noturna — reclamações, overbooking',
           'Shift lead / night audit — complaints, overbooking'),
      ],
      tasks: [
        tk('pms', 'PMS (ex.: Opera, Host)', 'PMS (e.g. Opera, Host)'),
        tk('check_in_out', 'Check-in e check-out', 'Check-in and check-out'),
        tk('payments_invoicing', 'Pagamentos e faturação', 'Payments and invoicing'),
        tk('night_audit', 'Turno noturno', 'Night shift'),
        tk('complaints', 'Reclamações', 'Complaints'),
      ],
    },
    'Empregado/a de andares': {
      en: 'Housekeeper',
      levels: [
        lv('Limpa e arruma quartos com checklist, com supervisão',
           'Cleans and makes up rooms from a checklist, under supervision'),
        lv('Cumpre a quota de quartos do turno sozinho/a, ao padrão do hotel',
           'Completes the shift’s room quota alone, to the hotel’s standard'),
        lv('Governanta / supervisor/a de andares — inspeciona e distribui o trabalho',
           'Housekeeping supervisor — inspects rooms and assigns work'),
      ],
      tasks: [
        tk('checkout_stayover', 'Quartos de saída e de estadia', 'Checkout and stayover rooms'),
        tk('public_areas', 'Áreas públicas', 'Public areas'),
        tk('laundry_linen', 'Lavandaria e rouparia', 'Laundry and linen'),
        tk('luxury_hotel', 'Hotel 4–5★', '4–5★ hotel'),
      ],
    },
    'Bagageiro/a / Porteiro/a': {
      en: 'Porter / Doorman',
      levels: [
        lv('Bagagem e acompanhamento de hóspedes',
           'Luggage and escorting guests'),
        lv('Porta — receção, táxis e informações turísticas',
           'Door — welcome, taxis and tourist information'),
      ],
      tasks: [
        tk('luggage', 'Bagagem', 'Luggage'),
        tk('tourist_info', 'Informação turística', 'Tourist information'),
        tk('luggage_storage', 'Arrumação de bagagem', 'Luggage storage'),
      ],
    },
  },

  'Eventos': {
    'Staff de eventos': {
      en: 'Event staff',
      levels: [
        lv('Acolhimento, distribuição e apoio geral',
           'Welcoming, handing out and general support'),
        lv('Responsável por uma área (acreditação, bengaleiro, filas)',
           'In charge of an area (accreditation, cloakroom, queues)'),
        lv('Coordena uma equipa de staff',
           'Coordinates a team of staff'),
      ],
      tasks: [
        tk('accreditation', 'Acreditação', 'Accreditation'),
        tk('cloakroom', 'Bengaleiro', 'Cloakroom'),
        tk('entry_control', 'Controlo de entradas (sem funções de segurança)', 'Entry control (no security duties)'),
        tk('giveaways', 'Distribuição de brindes', 'Handing out giveaways'),
        tk('congress_fair', 'Congressos e feiras', 'Conferences and fairs'),
      ],
    },
    'Hospedeiro/a (receção e protocolo)': {
      en: 'Event host / hostess',
      levels: [
        lv('Receção e encaminhamento de convidados',
           'Welcoming and directing guests'),
        lv('Protocolo e convidados VIP',
           'Protocol and VIP guests'),
        lv('Chefe de hospedeiros/as',
           'Head of hosts'),
      ],
      tasks: [
        tk('protocol', 'Protocolo', 'Protocol'),
        tk('vip', 'Convidados VIP', 'VIP guests'),
        tk('fairs', 'Feiras', 'Trade fairs'),
        tk('congresses', 'Congressos', 'Conferences'),
      ],
    },
    'Montagem e desmontagem': {
      en: 'Set-up & breakdown',
      levels: [
        lv('Cargas, transporte e montagens simples',
           'Loading, carrying and simple set-ups'),
        lv('Montagem de stands e estruturas, com ferramentas elétricas',
           'Building stands and structures, with power tools'),
      ],
      tasks: [
        tk('loading', 'Cargas e descargas', 'Loading and unloading'),
        tk('stands', 'Stands', 'Stands'),
        tk('stages', 'Palcos', 'Stages'),
        tk('power_tools', 'Ferramentas elétricas', 'Power tools'),
      ],
    },
    'Animador/a': {
      en: 'Entertainer',
      levels: [
        lv('Apoia atividades (sobretudo infantis)',
           'Supports activities (mostly for children)'),
        lv('Conduz atividades sozinho/a',
           'Runs activities alone'),
        lv('Coordena o programa de animação',
           'Coordinates the entertainment programme'),
      ],
      tasks: [
        tk('kids_entertainment', 'Animação infantil', 'Children’s entertainment'),
        tk('resort', 'Hotel / resort', 'Hotel / resort'),
        tk('parties', 'Festas', 'Parties'),
        tk('face_paint_balloons', 'Pinturas faciais / balões', 'Face painting / balloons'),
      ],
    },
  },

  'Limpeza e Manutenção': {
    'Empregado/a de limpeza': {
      en: 'Cleaner',
      levels: [
        lv('Limpeza com checklist, com supervisão',
           'Cleaning from a checklist, under supervision'),
        lv('Trabalha sozinho/a ao padrão do cliente, com produtos e máquinas',
           'Works alone to the client’s standard, with products and machines'),
        lv('Chefe de equipa',
           'Team lead'),
      ],
      tasks: [
        tk('offices', 'Escritórios', 'Offices'),
        tk('post_construction', 'Pós-obra', 'Post-construction'),
        tk('industrial', 'Industrial', 'Industrial'),
        tk('cleaning_machines', 'Máquinas de limpeza', 'Cleaning machines'),
        tk('windows', 'Vidros (sem trabalho em altura)', 'Windows (no work at height)'),
      ],
    },
    'Técnico/a de manutenção': {
      en: 'Maintenance technician',
      levels: [
        lv('Pequenas reparações (lâmpadas, montagens)',
           'Small repairs (bulbs, assembly)'),
        lv('Eletricidade e canalização básicas, sozinho/a',
           'Basic electrical and plumbing work, alone'),
        lv('Responsável de manutenção (AVAC, piscinas)',
           'Maintenance lead (HVAC, pools)'),
      ],
      tasks: [
        tk('electrical', 'Eletricidade', 'Electrical'),
        tk('plumbing', 'Canalização', 'Plumbing'),
        tk('painting', 'Pintura', 'Painting'),
        tk('hvac', 'AVAC', 'HVAC'),
        tk('pools', 'Piscinas', 'Pools'),
      ],
    },
  },

  'Segurança': {
    'Vigilante (segurança privada)': {
      en: 'Security guard (licensed)',
      certificate: 'SECURITY_CARD',
      levels: [
        lv('Vigilante com cartão profissional válido (Lei 34/2013)',
           'Security guard with a valid professional card (Law 34/2013)'),
      ],
      tasks: [
        tk('events_venues', 'Eventos e recintos', 'Events and venues'),
        tk('front_desk_security', 'Portaria', 'Front-desk security'),
        tk('patrols', 'Rondas', 'Patrols'),
        tk('sports_steward', 'Assistente de recinto desportivo (cartão próprio)', 'Sports-ground steward (own card)'),
      ],
    },
  },

  'Retalho': {
    'Vendedor/a de loja': {
      en: 'Shop assistant',
      levels: [
        lv('Atende clientes e repõe, com apoio',
           'Serves customers and restocks, with support'),
        lv('Vende e faz caixa sozinho/a',
           'Sells and runs the till alone'),
        lv('Responsável de turno ou de loja',
           'Shift or store lead'),
      ],
      tasks: [
        TILL,
        tk('fashion', 'Moda', 'Fashion'),
        tk('electronics', 'Eletrónica', 'Electronics'),
        tk('grocery', 'Alimentar', 'Grocery'),
        tk('fitting_rooms', 'Provadores', 'Fitting rooms'),
        tk('inventory', 'Inventário', 'Stocktaking'),
      ],
    },
    'Operador/a de caixa': {
      en: 'Cashier',
      levels: [
        lv('Caixa com apoio',
           'Till work with support'),
        lv('Caixa sozinho/a a ritmo alto, incluindo devoluções',
           'Till alone at high pace, including returns'),
        lv('Chefe de caixas',
           'Head cashier'),
      ],
      tasks: [
        tk('supermarket', 'Supermercado', 'Supermarket'),
        tk('self_checkout', 'Self-checkout', 'Self-checkout'),
        tk('cash_up', 'Fecho de caixa', 'Cashing up'),
        tk('returns', 'Devoluções', 'Returns'),
      ],
    },
    'Repositor/a': {
      en: 'Shelf stacker',
      levels: [
        lv('Repõe produtos com orientação',
           'Restocks products with guidance'),
        lv('Repõe sozinho/a seguindo planogramas',
           'Restocks alone following planograms'),
      ],
      tasks: [
        tk('restocking', 'Reposição', 'Restocking'),
        tk('labelling', 'Etiquetagem', 'Labelling'),
        tk('planograms', 'Planogramas', 'Planograms'),
        tk('inventory', 'Inventário', 'Stocktaking'),
      ],
    },
    'Promotor/a de vendas': {
      en: 'Sales promoter',
      levels: [
        lv('Distribui amostras e informa',
           'Hands out samples and informs'),
        lv('Vende sozinho/a e cumpre objetivos',
           'Sells alone and meets targets'),
        lv('Coordena promotores',
           'Coordinates promoters'),
      ],
      tasks: [
        tk('tastings', 'Degustações', 'Tastings'),
        tk('fairs', 'Feiras', 'Trade fairs'),
        tk('supermarket', 'Supermercado', 'Supermarket'),
        tk('lead_capture', 'Recolha de contactos', 'Lead capture'),
      ],
    },
  },

  'Logística': {
    'Operador/a de armazém': {
      en: 'Warehouse operative',
      levels: [
        lv('Cargas, descargas e arrumação',
           'Loading, unloading and putting away'),
        lv('Receção de mercadoria, scanner/RF e inventário, sozinho/a',
           'Goods receiving, scanner/RF and stocktaking, alone'),
        lv('Chefe de equipa',
           'Team lead'),
      ],
      tasks: [
        tk('rf_scanner', 'Scanner / RF', 'Scanner / RF'),
        tk('inventory', 'Inventário', 'Stocktaking'),
        tk('goods_receiving', 'Receção de mercadoria', 'Goods receiving'),
        tk('pallet_truck', 'Porta-paletes manual', 'Manual pallet truck'),
        tk('cold_storage', 'Frio / câmaras', 'Cold storage'),
      ],
    },
    'Preparador/a de encomendas': {
      en: 'Order picker',
      levels: [
        lv('Picking com orientação',
           'Picking with guidance'),
        lv('Picking sozinho/a a ritmo alto',
           'Picking alone at high pace'),
      ],
      tasks: [
        tk('scanner_picking', 'Picking por scanner', 'Scanner picking'),
        tk('voice_picking', 'Picking por voz', 'Voice picking'),
        tk('packing', 'Embalagem', 'Packing'),
        tk('high_pace', 'Alto ritmo', 'High pace'),
      ],
    },
    'Operador/a de empilhador': {
      en: 'Forklift operator',
      certificate: 'FORKLIFT',
      levels: [
        lv('Operador/a com certificado de formação de empilhador',
           'Operator holding a forklift training certificate'),
      ],
      tasks: [
        tk('counterbalance', 'Empilhador frontal', 'Counterbalance forklift'),
        tk('reach_truck', 'Retráctil', 'Reach truck'),
        tk('electric_pallet', 'Porta-paletes elétrico', 'Electric pallet truck'),
      ],
    },
    'Motorista': {
      en: 'Driver',
      certificate: 'DRIVING_LICENCE',
      levels: [
        lv('Motorista com carta de condução válida',
           'Driver with a valid driving licence'),
      ],
      tasks: [
        tk('licence_b', 'Carta B', 'B licence (car)'),
        tk('licence_c', 'Carta C', 'C licence (truck)'),
        tk('urban_delivery', 'Entregas urbanas', 'Urban deliveries'),
        tk('van', 'Carrinha', 'Van'),
      ],
    },
  },

  'Apoio ao Cliente': {
    'Teleoperador/a': {
      en: 'Call centre agent',
      levels: [
        lv('Atende chamadas com guião',
           'Handles calls from a script'),
        lv('Resolve pedidos sozinho/a e usa CRM',
           'Resolves requests alone and uses a CRM'),
        lv('Reclamações complexas / supervisão',
           'Complex complaints / supervision'),
      ],
      tasks: [
        tk('inbound', 'Inbound', 'Inbound'),
        tk('outbound_sales', 'Outbound / vendas', 'Outbound / sales'),
        tk('complaints', 'Reclamações', 'Complaints'),
        tk('chat_email', 'Chat e email', 'Chat and email'),
        tk('crm', 'CRM', 'CRM'),
      ],
    },
    'Assistente de apoio ao cliente (presencial)': {
      en: 'Customer service assistant (in person)',
      levels: [
        lv('Informa e encaminha clientes',
           'Informs and directs customers'),
        lv('Resolve sozinho/a, incluindo devoluções',
           'Resolves issues alone, including returns'),
        lv('Responsável do balcão',
           'Desk lead'),
      ],
      tasks: [
        tk('info_desk', 'Balcão de informações', 'Information desk'),
        tk('returns', 'Devoluções', 'Returns'),
        tk('complaints', 'Reclamações', 'Complaints'),
      ],
    },
  },

  'Administração': {
    'Assistente administrativo/a': {
      en: 'Administrative assistant',
      levels: [
        lv('Arquivo, digitalização e introdução de dados',
           'Filing, scanning and data entry'),
        lv('Faturação, atendimento e agenda, sozinho/a',
           'Invoicing, reception and diary management, alone'),
        lv('Apoio a contabilidade ou RH',
           'Accounting or HR support'),
      ],
      tasks: [
        tk('data_entry', 'Introdução de dados', 'Data entry'),
        tk('excel', 'Excel', 'Excel'),
        tk('invoicing', 'Faturação', 'Invoicing'),
        tk('phone_reception', 'Atendimento telefónico', 'Phone reception'),
        tk('filing', 'Arquivo', 'Filing'),
      ],
    },
  },
} as const satisfies Record<string, Record<string, RoleDefinition>>;

export type RoleCategory = keyof typeof ROLE_CATALOGUE;
export type RoleName = { [C in RoleCategory]: keyof typeof ROLE_CATALOGUE[C] }[RoleCategory] & string;

/** English names of the role families. */
export const ROLE_CATEGORIES_EN: Record<RoleCategory, string> = {
  'Sala e Bar':           'Front of house & Bar',
  'Cozinha':              'Kitchen',
  'Alojamento':           'Hotel & Accommodation',
  'Eventos':              'Events',
  'Limpeza e Manutenção': 'Cleaning & Maintenance',
  'Segurança':            'Security',
  'Retalho':              'Retail',
  'Logística':            'Logistics',
  'Apoio ao Cliente':     'Customer Support',
  'Administração':        'Administration',
};

const ROLE_INDEX: Record<string, { category: RoleCategory; def: RoleDefinition }> = (() => {
  const out: Record<string, { category: RoleCategory; def: RoleDefinition }> = {};
  for (const category of Object.keys(ROLE_CATALOGUE) as RoleCategory[]) {
    const roles = ROLE_CATALOGUE[category] as Record<string, RoleDefinition>;
    for (const name of Object.keys(roles)) out[name] = { category, def: roles[name]! };
  }
  return out;
})();

/** Definition of a current role, or undefined for unknown / retired names. */
export function getRole(name: string | null | undefined): RoleDefinition | undefined {
  return name ? ROLE_INDEX[name]?.def : undefined;
}

/** Category a current role belongs to. */
export function roleCategory(name: string): RoleCategory | undefined {
  return ROLE_INDEX[name]?.category;
}

/** Highest level a role has (1–3). Unknown roles: 1. */
export function roleMaxLevel(name: string): RoleLevel {
  return (getRole(name)?.levels.length ?? 1) as RoleLevel;
}

/** The task ids valid for a role. */
export function roleTaskIds(name: string): string[] {
  return getRole(name)?.tasks.map(t => t.id) ?? [];
}

/** Display text for one level of a role, in the UI language. */
export function roleLevelText(name: string, level: number, lang: 'pt' | 'en'): string {
  const text = getRole(name)?.levels[level - 1];
  return text ? text[lang] : '';
}

/** Display label for a task of a role. Unknown ids pass through. */
export function roleTaskLabel(name: string, taskId: string, lang: 'pt' | 'en'): string {
  const task = getRole(name)?.tasks.find(t => t.id === taskId);
  return task ? task[lang] : taskId;
}

/**
 * Display label for a role's legally required document.
 */
export const ROLE_CERTIFICATE_LABELS: Record<RoleCertificate, Bilingual> = {
  SECURITY_CARD:   lv('Cartão profissional de segurança privada', 'Private security professional card'),
  FORKLIFT:        lv('Certificado de formação de operador de empilhador', 'Forklift operator training certificate'),
  DRIVING_LICENCE: lv('Carta de condução', 'Driving licence'),
};
