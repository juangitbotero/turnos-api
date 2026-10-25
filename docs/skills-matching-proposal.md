# Skills & experience matching: proposal

**Date:** 2026-10-25
**Status:** **Approved 2026-10-25** with the recommended answer to every decision in §5
(D1–D8). Steps 1–3 of §2.9 built the same day (not deployed); status lives in
`docs/pre-flight.md`. The catalogue in §3 now lives in `packages/shared/src/roles.ts`,
which is the source of truth — this document is the record of the decision.

**The question this answers:** how does a company that posts a shift know, at a glance,
that the worker in front of them can do *that* job, at *that* level?

---

## 1. What is wrong today (from the code)

| Piece | What it does today | Problem |
|---|---|---|
| **Role** (company picks category → role) | Stored as `shift.subcategory`, copied into `skillsRequired` | Fine, but the only real signal we have |
| **"Additional skills"** (company) | Picker offering the **other job titles** (the same 35-role list) + free-text "custom skill" | Means nothing. A waiter shift can "require" Barista; a custom skill can never match a worker |
| **Skills** (worker) | Any number of the same 35 titles; onboarding shows all 35 as one flat chip list | No limit and no cost to ticking, so "Barman" is ticked by anyone who has poured a beer |
| **Experience** (worker) | Separate list: job title + years bucket (none / 0–1 / 1–5 / 5+) | Not used anywhere except 20 points in the applicant sort. Years say nothing about *what* the person can do |
| **Notifications** | `worker.skills LIKE '%role%'` | Substring match, no level |
| **Applying** | No check at all | Any worker can apply to any shift |
| **Verification** | None per role | A rating is a general star average, not "can do this role" |

So the company today sees: a role name the worker ticked, and maybe a years bucket. Neither
is evidence.

---

## 2. The proposal

### 2.1 One vocabulary for both sides

Everything the worker declares and everything the company asks for comes from **one catalogue**
(§3). There are no free-text skills on either side, so every field is matchable.

| Concept | Worker profile | Shift posting |
|---|---|---|
| **Função** (role) | Up to **3** roles | Exactly 1 role (unchanged) |
| **Nível** (level 1–3) | Declares their level **per role** | Sets the **minimum level** required |
| **Tarefas** (role tasks) | Ticks the tasks they have actually done | Ticks the tasks the shift involves |
| **Tempo de experiência** | Years bucket per role (kept, as supporting evidence) | Not asked |
| **Idiomas** | Unchanged | Unchanged |

### 2.2 Levels describe what someone can do, not how long they've done it

Every role has three levels written as concrete descriptions, and both sides read the same
words. A worker can't misread "Barman level 2 — classic cocktails without a recipe, runs the
bar alone in a normal service" the way they can misread "Barman".

| Level | Generic meaning |
|---|---|
| **1 — Iniciante** | Little or no experience; works with supervision |
| **2 — Autónomo** | Works alone in a normal service |
| **3 — Experiente** | High volume, harder service, or leads others |

Entry roles (runner, dishwasher, picker…) have one or two levels only.

### 2.3 Tasks replace "additional skills"

Each role has 4–6 tasks (e.g. Barista: manual machine · textured milk / latte art · filter
methods · grinder calibration · till). The company ticks the ones the shift needs; the worker
ticks the ones they've done. This is what the "Additional skills" box was trying to be.

### 2.4 How a match works

1. **Gate (blocks the application):** the worker has the role **and** their declared level ≥ the
   shift's minimum level. Below that, the shift shows *"Requer nível 2"* and Apply is disabled.
   Level-1 shifts: see decision D3.
2. **Score (orders the candidates)**, replacing today's `skillMatch()`:
   level meets requirement · tasks matched (x of y) · languages · confirmed in this role.
3. **Shown as a reason line** on every candidate, in the applicant list and in worker search:
   > **Barman · Nível 2 ✓ · 4/5 tarefas · Confirmado em 3 turnos · ★4.8**

4. **Notifications** target workers with the exact role at the right level, not `LIKE '%…%'`.
5. **While posting**, the company sees a live count: *"23 trabalhadores correspondem"*. If it
   is low, the form suggests lowering the level or the tasks.

### 2.5 Verification: let completed shifts prove the level

Self-declared is where everyone starts. Turnos then confirms or corrects it from real work:

- **One new question in the company's review:** *"O nível de Barman correspondeu ao declarado?"*
  → Sim / Abaixo.
- **"Confirmado em N turnos"** per role, once the worker has ≥ **2** completed shifts in that
  role rated ≥ 4★ with "Sim". Companies can filter to confirmed workers only (off by default —
  in the beta almost nobody is confirmed yet).
- **Two "Abaixo" answers in the same role** → the worker is asked to review their level and the
  case goes to ops. **No automatic downgrade**: it is a decision about a worker and needs a human
  and a stated reason (Platform Work Directive; same path as `restriction-notice.ts`).

This is the cheapest verification there is, and it is the claim we want to sell: *"o nível foi
confirmado por empresas que o contrataram"*.

### 2.6 Certificates where the law requires them

Three roles cannot legally be done without a document, and companies are liable: **Vigilante**
(cartão profissional, Lei 34/2013), **Operador/a de empilhador** (training certificate) and
**Motorista** (driving licence). For these the role asks for the document and stays hidden from
companies until it is provided. Food-hygiene training (HACCP) is a task, not a gate, in kitchen roles.

### 2.7 Worker experience in the app

**Onboarding:** "O que sabes fazer?" → choose up to 3 roles (grouped, searchable) → for each:
pick the level from the three described cards → tick tasks → years. It is the same component as
in edit-profile. It takes about a minute, and it is the step that most improves how they get matched.

**Profile score:** the 10 "skills" points require ≥ 1 role with a level and ≥ 1 task. Weights unchanged.

**Feed:** "Para ti" shows shifts in your roles at or below your level first. A shift you're below
the level for shows why ("Requer nível 2 — o teu nível em Barman é 1").

### 2.8 Data model

| Where | Change |
|---|---|
| `packages/shared` | `ROLE_CATALOGUE` (category → role → levels, tasks, certificate). `SHIFT_CATEGORIES`, `ALL_SKILLS`, `JOB_TITLES` are **derived** from it, so existing consumers keep working. PT + EN texts in `i18n/domain.ts`. `LEGACY_SKILL_ALIASES` extended with every rename (§4) |
| `Worker` | New `roles` jsonb `[{ role, level, tasks[], years, confirmedShifts }]`, max 3. `skills` kept as a derived list of role names during the transition. `experiences` becomes legacy |
| `Shift` | New `requiredLevel` (1–3, default 1) and `tasksRequired` (from the role's list). `skillsRequired` becomes just `[role]`. Custom free-text skill removed |
| `Rating` | New `levelMatched` (bool, nullable) |
| API | Exact role + level filter in notifications, applicant ranking, worker search and the apply gate. **Old APKs keep working:** if an app sends only `skills`, roles it doesn't know yet are added at level 1 and existing levels are untouched |
| Migration | One TypeORM migration. Old skill names → new roles via aliases. Old years buckets give a **provisional** level (none/0–1 → 1, 1–5 → 2, 5+ → 3), and the app asks the worker to confirm once ("Confirma as tuas funções"). Open shifts default to level 1. Production has mostly test data, so the risk is low |

### 2.9 Execution order

| Step | What | Ships as |
|---|---|---|
| **0** | **You approve the catalogue in §3 and the decisions in §5** | This document |
| 1 | Shared catalogue + i18n, migration, API (roles, levels, tasks, gate, exact-match notifications, compatibility with old app) | API deploy |
| 2 | Web-admin: new-shift (role → level cards → tasks → live match count; "Additional skills" removed), reason line in Applicants and worker search, "confirmed only" filter | Dashboard deploy |
| 3 | Mobile: roles step in onboarding + edit-profile, level shown on shift detail, apply gate message, one-time "confirm your roles" prompt | **New EAS build** |
| 4 | Verification loop: review question, "Confirmado em N turnos", two-"Abaixo" ops case | API + dashboard + app |
| 5 | Docs: privacy policy (level confirmations are profile data), worker terms ("declare truthfully"), FAQ, `CLAUDE.md`, pre-flight | With step 4 |

Bulk posting (point 3) comes after step 2. Each line of a multi-role request will simply be
role + level + tasks.

---

## 3. Role catalogue: please verify

Grouped by **role family** rather than by workplace (see D4): a hotel's restaurant needs the same
waiter as a restaurant does, so Barista or Rececionista no longer have to appear in two
categories. 31 roles (today 35 entries, with duplicates). **NEW** = not in today's list.
*Renamed* = keeps working for old data through the alias table in §4.

### Sala e Bar

**Empregado/a de mesa**
- N1: leva pratos e bebidas, monta e levanta mesas, com supervisão
- N2: gere sozinho/a uma secção de mesas — pedidos, recomendações, conta
- N3: serviço de alto volume ou fine dining; coordena outros empregados
- Tarefas: anotar pedidos (papel/POS) · transportar 3 pratos · serviço de vinhos · serviço formal (fine dining) · banquetes · pagamentos e fecho de conta

**Runner / Ajudante de sala** — *renamed from "Assistente de sala"*; entry role (N1 only)
- Tarefas: levar pratos da cozinha · levantar e repor mesas · polir loiça e talheres

**Empregado/a de balcão** — **NEW**
- N1: serve cafés, imperiais, vinho a copo e refrigerantes; limpa e repõe o balcão
- N2: gere o balcão sozinho/a num serviço normal, incluindo a caixa
- N3: balcão de alto volume (esplanada cheia, discoteca, recinto); coordena outros
- Tarefas: máquina de café · tirar imperial · caixa e pagamentos · abrir/fechar o bar · esplanada

**Barman / Bartender** — *renamed from "Barman/Barmaid"* (cocktails)
- N1: prepara bebidas simples e apoia o barman (barback)
- N2: cocktails clássicos sem consultar receita; trabalha sozinho/a num serviço normal
- N3: chefe de bar / mixologia; carta própria, alto volume
- Tarefas: cocktails clássicos · mixologia de autor · bar de eventos (volume) · stock e inventário do bar · vinhos e espumantes

**Barista**
- N1: cafés base (expresso, galão, meia de leite) com apoio ou máquina automática
- N2: máquina manual, leite texturizado, hora de ponta sozinho/a
- N3: latte art, afinação do moinho, métodos de filtro; forma outros
- Tarefas: máquina manual · leite texturizado / latte art · métodos de filtro · afinação do moinho · caixa

### Cozinha

**Cozinheiro/a**
- N1: pratos simples de uma carta definida (grelhados, fritos, saladas), com supervisão
- N2: responsável por uma partida sozinho/a durante o serviço
- N3: chefe de partida / sous-chef — vários postos, equipa, encomendas
- Tarefas: grelhador · fritos · cozinha fria · pizza (forno) · sushi · cozinha de banquetes · formação HACCP

**Ajudante de cozinha** — *renamed from "Assistente de cozinha"*; N1–N2
- N1: lavar, descascar, cortar e preparar ingredientes, com supervisão
- N2: mise en place sozinho/a e apoio a uma partida no serviço
- Tarefas: cortes básicos · mise en place · arrumação de câmaras e stock · formação HACCP

**Copeiro/a (lavagem de loiça)** — *renamed from "Lavador/a de loiça"*; entry role
- Tarefas: máquina de lavar industrial · limpeza da cozinha · lixos e reciclagem

**Pasteleiro/a**
- N1: apoia a produção (massas base, decoração simples)
- N2: executa a produção diária sozinho/a
- N3: responsável da pastelaria, receitas próprias
- Tarefas: massas (folhada, quebrada, levedada) · pastelaria portuguesa · bolos de evento / decoração · sobremesas de restaurante · formação HACCP

**Padeiro/a**
- N1: apoia a produção (pesagem, tender)
- N2: faz a produção (incl. noturna) sozinho/a
- N3: responsável pela fornada e pelas receitas
- Tarefas: massa-mãe · pão tradicional · forno a lenha · turno noturno

### Alojamento

**Rececionista** (hotel)
- N1: acolhe hóspedes e responde a pedidos simples, com apoio
- N2: check-in/out, pagamentos e reservas no PMS; faz o turno sozinho/a
- N3: chefe de turno / auditoria noturna; reclamações, overbooking
- Tarefas: PMS (ex.: Opera, Host) · check-in/out · pagamentos e faturação · turno noturno · reclamações

**Empregado/a de andares** — *renamed from "Serviço de quarto"* (that name usually means room-service F&B; the job asked for here is housekeeping)
- N1: limpa e arruma quartos com checklist, com supervisão
- N2: cumpre a quota de quartos do turno sozinho/a, ao padrão do hotel
- N3: governanta / supervisor/a de andares — inspeciona e distribui o trabalho
- Tarefas: quartos de saída e de estadia · áreas públicas · lavandaria e rouparia · hotel 4–5★

**Bagageiro/a / Porteiro/a** — **NEW**; N1–N2
- N1: bagagem e acompanhamento de hóspedes
- N2: porta — receção, táxis, informações turísticas
- Tarefas: bagagem · informação turística · arrumação de bagagem

### Eventos

**Staff de eventos** — *renamed from "Assistente de eventos"*
- N1: acolhimento, distribuição, apoio geral
- N2: responsável por uma área (acreditação, bengaleiro, filas)
- N3: coordena uma equipa de staff
- Tarefas: acreditação · bengaleiro · controlo de entradas (sem funções de segurança) · distribuição de brindes · congressos e feiras

**Hospedeiro/a (receção e protocolo)** — **NEW**, see D6
- N1: receção e encaminhamento de convidados
- N2: protocolo e convidados VIP
- N3: chefe de hospedeiros/as
- Tarefas: protocolo · VIP · feiras · congressos

**Montagem e desmontagem** — N1–N2
- N1: cargas, transporte, montagens simples
- N2: montagem de stands e estruturas, ferramentas elétricas
- Tarefas: cargas e descargas · stands · palcos · ferramentas elétricas

**Animador/a**
- N1: apoia atividades (sobretudo infantis)
- N2: conduz atividades sozinho/a
- N3: coordena o programa de animação
- Tarefas: animação infantil · hotel / resort · festas · pinturas faciais / balões

### Limpeza e Manutenção

**Empregado/a de limpeza**
- N1: limpeza com checklist, com supervisão
- N2: sozinho/a ao padrão do cliente, produtos e máquinas
- N3: chefe de equipa
- Tarefas: escritórios · pós-obra · industrial · máquinas de limpeza · vidros (sem trabalho em altura)

**Técnico/a de manutenção**
- N1: pequenas reparações (lâmpadas, montagens)
- N2: eletricidade e canalização básicas sozinho/a
- N3: responsável de manutenção (AVAC, piscinas)
- Tarefas: eletricidade · canalização · pintura · AVAC · piscinas

### Segurança

**Vigilante (segurança privada)** — *merges "Segurança de eventos" + "Segurança/Vigilante"*; **cartão profissional obrigatório** (Lei 34/2013); no levels
- Tarefas: eventos e recintos · portaria · rondas · assistente de recinto desportivo (cartão próprio)

### Retalho

**Vendedor/a de loja**
- N1: atende e repõe, com apoio
- N2: vende e faz caixa sozinho/a
- N3: responsável de turno / loja
- Tarefas: caixa · moda · eletrónica · alimentar · provadores · inventário

**Operador/a de caixa**
- N1: caixa com apoio
- N2: sozinho/a a ritmo alto, devoluções
- N3: chefe de caixas
- Tarefas: supermercado · self-checkout · fecho de caixa · devoluções

**Repositor/a** — *renamed from "Merchandising"*; N1–N2
- Tarefas: reposição · etiquetagem · planogramas · inventário

**Promotor/a de vendas**
- N1: distribui amostras e informa
- N2: vende sozinho/a e cumpre objetivos
- N3: coordena promotores
- Tarefas: degustações · feiras · supermercado · recolha de contactos

### Logística

**Operador/a de armazém** — *merges "Assistente de armazém" + "Gestão de stock"*
- N1: cargas, descargas e arrumação
- N2: receção de mercadoria, scanner/RF, inventário sozinho/a
- N3: chefe de equipa
- Tarefas: scanner / RF · inventário · receção de mercadoria · porta-paletes manual · frio / câmaras

**Preparador/a de encomendas** — *renamed from "Preparação de encomendas"*; N1–N2
- Tarefas: picking por scanner · picking por voz · embalagem · alto ritmo

**Operador/a de empilhador** — **NEW**; **certificado de formação obrigatório**; no levels
- Tarefas: empilhador frontal · retráctil · porta-paletes elétrico

**Motorista** — *renamed from "Estafeta/Motorista"*; **carta obrigatória**. "Estafeta" is dropped on purpose: it is the word the art. 12.º-A platform cases are about
- Tarefas: carta B · carta C · entregas urbanas · carrinha

### Apoio ao Cliente

**Teleoperador/a** — *merges "Atendimento telefónico" + "Teleoperador/a" + "Gestão de reclamações"* (three names for one job)
- N1: atende chamadas com guião
- N2: resolve pedidos sozinho/a, usa CRM
- N3: reclamações complexas / supervisão
- Tarefas: inbound · outbound / vendas · reclamações · chat e email · CRM

**Assistente de apoio ao cliente (presencial)**
- N1: informa e encaminha
- N2: resolve sozinho/a, incluindo devoluções
- N3: responsável do balcão
- Tarefas: balcão de informações · devoluções · reclamações

### Administração

**Assistente administrativo/a**
- N1: arquivo, digitalização, introdução de dados
- N2: faturação, atendimento, agenda — sozinho/a
- N3: apoio a contabilidade ou RH
- Tarefas: introdução de dados · Excel · faturação · atendimento telefónico · arquivo

**Proposed for removal:** Community manager, Assistente de RH, Gestão de escritório. These are
not short-shift jobs and nobody posts them as an MCD shift (see D5).

---

## 4. Old → new names (for the migration)

| Today | Becomes |
|---|---|
| Assistente de sala | Runner / Ajudante de sala |
| Barman/Barmaid | Barman / Bartender |
| Assistente de cozinha | Ajudante de cozinha |
| Lavador/a de loiça | Copeiro/a (lavagem de loiça) |
| Serviço de quarto | Empregado/a de andares |
| Assistente de eventos | Staff de eventos |
| Segurança de eventos, Segurança/Vigilante | Vigilante (segurança privada) |
| Merchandising | Repositor/a |
| Assistente de armazém, Gestão de stock | Operador/a de armazém |
| Preparação de encomendas | Preparador/a de encomendas |
| Estafeta/Motorista | Motorista |
| Atendimento telefónico, Teleoperador/a, Gestão de reclamações | Teleoperador/a |
| Apoio ao cliente presencial | Assistente de apoio ao cliente (presencial) |
| Community manager, Assistente de RH, Gestão de escritório | removed (if D5 approved); existing rows keep displaying but can't be chosen |
| Rececionista (Eventos) | Hospedeiro/a (if D6 approved) |

Unchanged: Empregado/a de mesa, Barista, Cozinheiro/a, Pasteleiro/a, Padeiro/a, Rececionista
(hotel), Montagem e desmontagem, Animador/a, Empregado/a de limpeza, Técnico/a de manutenção,
Vendedor/a de loja, Operador/a de caixa, Promotor/a de vendas, Assistente administrativo/a.

---

## 5. Decisions needed from you

| # | Decision | My recommendation |
|---|---|---|
| D1 | Max roles per worker | **3**. Few people are genuinely good at more, and the limit is what makes each declaration mean something |
| D2 | Level below the minimum: block or warn? | **Block** the application (declared level is the worker's own statement, so blocking on it is not a judgement about them) |
| D3 | Level-1 shifts: open to workers who don't list the role? | **Yes**, shown as "Sem experiência necessária". Grows supply for entry jobs (runner, copeiro, picking) without weakening skilled roles |
| D4 | Categories by role family (Sala e Bar, Cozinha, Alojamento…) instead of workplace | **Yes**. Removes the duplicates and matches how workers describe themselves |
| D5 | Remove Community manager, Assistente de RH, Gestão de escritório | **Yes** |
| D6 | Event receptionist: split back out as Hospedeiro/a? | **Yes**. Hotel front desk (PMS, check-in) and event hosting are different skills; the 2026-08-04 merge put them together |
| D7 | Pizzaiolo, sushiman: roles or cook tasks? | **Tasks** of Cozinheiro/a (as above). Promote to roles if companies ask |
| D8 | "Confirmed" threshold | **2** shifts ≥ 4★ with "Sim" in that role |
