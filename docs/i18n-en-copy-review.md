# English copy for review

Portuguese is canonical; the English column is what I drafted and what you review.
Namespaces already signed off are excluded — see `APPROVED` in
`scripts/i18n-copy-review.js`.

Portuguese legal terms — **MCD**, **Recibo Verde**, **TSU**, **Segurança Social**,
**SS Direta**, **ACT**, **NIF**, **IBAN**, **Portal das Finanças**, **Agenda do
Trabalho Digno** — are kept verbatim in English and glossed on first use, per the
locked decision.

## public — landing nav

| key | 🇵🇹 Portuguese | 🇬🇧 English |
|---|---|---|
| `login` | Entrar | Sign in |
| `register` | Criar conta → | Create account → |

## public — landing hero

| key | 🇵🇹 Portuguese | 🇬🇧 English |
|---|---|---|
| `badge` | Lisboa Beta · Plataforma operacional | Lisbon Beta · Platform live |
| `titleLine1` | Work Today. | Work Today. |
| `titleAccent` | Staff Today. | Staff Today. |
| `sub` | O mercado de turnos para Portugal. Encontra trabalhadores verificados em minutos — com conformidade MCD automática, QR check-in e todos os dados prontos para pagares diretamente ao worker. | The shift marketplace for Portugal. Find verified workers in minutes — with automatic MCD compliance, QR check-in and every figure ready for you to pay the worker directly. |
| `ctaPrimary` | Publicar Turno → | Post a shift → |
| `ctaGhost` | Já tenho conta | I already have an account |

## public — landing demo card

| key | 🇵🇹 Portuguese | 🇬🇧 English |
|---|---|---|
| `role` | Cozinheiro | Cook |
| `workerName` | Carlos M. | Carlos M. |
| `workerMeta` | {{role}} · ⭐ 4.9 · Verificado | {{role}} · ⭐ 4.9 · Verified |
| `available` | Disponível | Available |
| `companyName` | Restaurante A Taberna | Restaurante A Taberna |
| `companyMeta` | {{role}} · Hoje 18h–02h · €10/hr | {{role}} · Today 18:00–02:00 · €10/hr |
| `match` | ✓ Match confirmado ·  | ✓ Match confirmed ·  |
| `matchBold` | Recebe o bruto por inteiro | They receive the full gross |
| `step1` | Turno publicado | Shift posted |
| `step2` | Candidatura recebida | Application received |
| `step3` | Worker confirmado ✓ | Worker confirmed ✓ |

## public — landing stats bar

| key | 🇵🇹 Portuguese | 🇬🇧 English |
|---|---|---|
| `feeValue` | 3€ | €3 |
| `fee` | Taxa fixa por turno concluído | Flat fee per completed shift |
| `speedValue` | <10s | <10s |
| `speed` | Para publicar um turno | To post a shift |
| `commissionValue` | 0% | 0% |
| `commission` | Comissões sobre salários | Commission on wages |
| `dataValue` | 100% | 100% |
| `data` | Dados prontos para a contabilidade | Accounting-ready data |

## public — landing "how it works"

| key | 🇵🇹 Portuguese | 🇬🇧 English |
|---|---|---|
| `title` | Como funciona | How it works |
| `sub` | De turno publicado a pagamento processado — tudo automático. | From shift posted to payment made — all automatic. |
| `publish.title` | Publicas o turno | You post the shift |
| `publish.desc` | Define função, horário, morada e valor/hora. O custo TSU é calculado automaticamente. | Set the role, hours, address and hourly rate. The TSU cost is calculated automatically. |
| `apply.title` | Workers candidatam-se | Workers apply |
| `apply.desc` | Notificação push automática aos 20 workers mais compatíveis por competência. Candidaturas chegam em minutos. | An automatic push notification reaches the 20 best-matched workers by skill. Applications arrive within minutes. |
| `select.title` | Selecionas o worker | You pick the worker |
| `select.desc` | Revês perfis, ratings e competências. Selecionar um worker envia-lhe um convite direto com 2h para aceitar. | Review profiles, ratings and skills. Selecting a worker sends them a direct invitation with 2h to accept. |
| `confirm.title` | Worker confirma | The worker confirms |
| `confirm.desc` | O worker aceita ou recusa. Se não responder em 2h, o turno reabre automaticamente — sem no-shows silenciosos. | They accept or decline. If they do not respond within 2h the shift reopens automatically — no silent no-shows. |
| `checkIn.title` | QR Check-in | QR check-in |
| `checkIn.desc` | O worker escaneia o teu QR fixo à chegada (geofence de 200m). O turno conclui automaticamente à hora de fim — sem passos extra. | The worker scans your fixed QR code on arrival (200m geofence). The shift completes automatically at its end time — no extra steps. |
| `pay.title` | Pagas diretamente ao worker | You pay the worker directly |
| `pay.desc` | No fim do turno pagas ao worker pelo método que escolheste — Pay Link (cartão ou MB WAY), transferência bancária ou MB WAY direto. A Turnos dá-te todos os valores prontos, incluindo TSU informativo. | At the end of the shift you pay the worker by the method you chose — Pay Link (card or MB WAY), bank transfer or MB WAY direct. Turnos hands you every figure ready, including the informative TSU. |

## public — landing features

| key | 🇵🇹 Portuguese | 🇬🇧 English |
|---|---|---|
| `title` | O que a plataforma faz por ti | What the platform does for you |
| `sub` | Construído para a realidade do mercado de trabalho português. Tudo o que precisas, nada do que não precisas. | Built for how the Portuguese labour market actually works. Everything you need, nothing you don’t. |
| `notifications.title` | Notificações inteligentes | Smart notifications |
| `notifications.body` | Push notification automático aos 20 workers mais compatíveis em segundos após publicação. Segunda vaga ao fim de 5h se sem candidatos. | An automatic push notification reaches the 20 best-matched workers within seconds of posting. A second wave goes out after 5h if there are no applicants. |
| `ratings.title` | Ratings & Reputação | Ratings & reputation |
| `ratings.body` | Avalia workers após cada turno. Badges TOP_RATED e FIÁVEL para os melhores. Motor de matching prioriza os mais bem avaliados. | Rate workers after every shift. TOP RATED and RELIABLE badges for the best. The matching engine prioritises the highest rated. |
| `confirmation.title` | Confirmação obrigatória | Mandatory confirmation |
| `confirmation.body` | Worker selecionado tem 2h para aceitar. Sem confirmação, o turno volta ao estado aberto automaticamente — fim dos no-shows. | The selected worker has 2h to accept. Without confirmation the shift returns to open automatically — the end of no-shows. |
| `qrCheckIn.title` | QR Check-in verificado | Verified QR check-in |
| `qrCheckIn.body` | QR fixo por empresa + geofence de 200m. Worker escaneia à chegada; o turno conclui sozinho à hora de fim. Podes ajustar horas antes de pagar. | A fixed QR code per company plus a 200m geofence. The worker scans on arrival; the shift completes on its own at its end time. You can adjust the hours before paying. |
| `compliance.title` | Conformidade MCD automática | Automatic MCD compliance |
| `compliance.body` | Contratos MCD gerados e enviados à SS. Cálculo de TSU 23,75% + 11%. Alertas de limite de 70 dias/ano e descanso de 11h. | MCD contracts generated and filed with Segurança Social. TSU calculated at 23.75% + 11%. Alerts for the 70-day annual cap and the 11-hour rest rule. |
| `directPay.title` | Pagamento direto, sem comissões | Direct payment, no commission |
| `directPay.body` | Pagas o salário diretamente ao worker — a Turnos nunca toca no dinheiro. Só uma taxa fixa de 3€ por turno concluído, faturada uma vez por mês. | You pay the wage straight to the worker — Turnos never touches the money. Just a flat €3 per completed shift, invoiced once a month. |
| `search.title` | Pesquisa de talento | Talent search |
| `search.body` | Procura workers por competência, idioma e disponibilidade. Convida diretamente para um turno — ele tem 2h para aceitar. | Search workers by skill, language and availability. Invite them directly to a shift — they have 2h to accept. |
| `applicants.title` | Candidatos comparáveis | Applicants side by side |
| `applicants.body` | Filtra candidatos por rating, perfil completo ou data de candidatura. Vê match de competências em destaque. Nota de apresentação do worker. | Filter applicants by rating, profile completeness or application date. Skill matches are highlighted, along with the worker’s cover note. |
| `dashboard.title` | Dashboard de conformidade | Compliance dashboard |
| `dashboard.body` | TSU calculado por turno. Log de auditoria ACT imutável. Relatórios exportáveis em CSV. Dependência económica monitorizada. | TSU calculated per shift. Immutable ACT audit log. Reports exportable to CSV. Economic dependency monitored. |
| `spending.title` | Controlo de gastos | Spending control |
| `spending.body` | Dashboard de gastos por período. Custo total por turno incluindo TSU. Subscrição mensal com faturação automática. | Spending dashboard by period. Total cost per shift including TSU. Monthly subscription with automatic invoicing. |

## public — landing trust bar

| key | 🇵🇹 Portuguese | 🇬🇧 English |
|---|---|---|
| `market` | Construído para o mercado português — MCD, TSU, SS Direta | Built for the Portuguese market — MCD, TSU, SS Direta |
| `security` | Dados seguros · RGPD · Contratos legais automáticos | Secure data · GDPR · Automatic legal contracts |
| `reports` | Relatórios TSU e contabilidade prontos a exportar | TSU and accounting reports ready to export |
| `app` | App nativa iOS & Android para os trabalhadores | Native iOS & Android app for workers |

## public — landing roadmap

| key | 🇵🇹 Portuguese | 🇬🇧 English |
|---|---|---|
| `title` | Roadmap de desenvolvimento | Development roadmap |
| `sub` | Transparência total — stints 0–7 completos. Stint 8 em progresso. | Full transparency — stints 0–7 complete. Stint 8 in progress. |
| `s0` | Foundation & Setup | Foundation & setup |
| `s1` | Auth & Identidade | Auth & identity |
| `s2` | Marketplace de Turnos | Shift marketplace |
| `s3` | Notificações & Real-Time | Notifications & real-time |
| `s4` | Conformidade Portugal | Portugal compliance |
| `s5` | QR Check-In automático | Automatic QR check-in |
| `s6` | Pagamentos & Payroll | Payments & payroll |
| `s7` | Ratings & Reputação | Ratings & reputation |
| `s8` | Produto & Operações | Product & operations |
| `s9` | Crescimento & Flywheel | Growth & flywheel |
| `statusDone` | ✅ Completo | ✅ Complete |
| `statusActive` | 🔄 Em progresso | 🔄 In progress |
| `statusPlanned` | Planeado | Planned |

## public — landing CTA banner

| key | 🇵🇹 Portuguese | 🇬🇧 English |
|---|---|---|
| `title` | Pronto para preencher o teu próximo turno? | Ready to fill your next shift? |
| `sub` | Junte-se à beta de Lisboa. Sem custos de setup. Primeiro turno grátis. | Join the Lisbon beta. No setup costs. Your first shift is free. |
| `primary` | Criar conta → | Create account → |
| `ghost` | Já tenho conta | I already have an account |

## public — landing footer

| key | 🇵🇹 Portuguese | 🇬🇧 English |
|---|---|---|
| `tagline` | Work Today. Staff Today. · Lisboa Beta 2026 | Work Today. Staff Today. · Lisbon Beta 2026 |
| `privacy` | Privacidade | Privacy |
| `terms` | Termos | Terms |
| `login` | Entrar | Sign in |
| `register` | Registar | Sign up |

## public — login/page.tsx

| key | 🇵🇹 Portuguese | 🇬🇧 English |
|---|---|---|
| `panelTitle1` | Gerencie os seus turnos. | Manage your shifts. |
| `panelTitle2` | Sem complicações. | Without the hassle. |
| `panelSub` | Publique um turno em 10 segundos. Conformidade MCD automática. Pagamento por turno concluído. | Post a shift in 10 seconds. Automatic MCD compliance. Pay per completed shift. |
| `panelFooter` | Beta fechada · Lisboa · 2026 | Closed beta · Lisbon · 2026 |
| `panelSpeed` | Preencha turnos em minutos | Fill shifts in minutes |
| `panelCompliance` | Contratos MCD automáticos | Automatic MCD contracts |
| `panelDirectPay` | Pagas direto ao worker, sem comissões | Pay the worker directly, no commission |
| `title` | Entrar na conta | Sign in |
| `noAccount` | Não tem conta? | Don't have an account? |
| `registerLink` | Registar empresa → | Register your company → |
| `email` | Email | Email |
| `emailPlaceholder` | empresa@exemplo.pt | company@example.pt |
| `password` | Password | Password |
| `showPassword` | Mostrar password | Show password |
| `hidePassword` | Ocultar password | Hide password |
| `forgot` | Esqueceu a password? | Forgot your password? |
| `submit` | Entrar → | Sign in → |
| `or` | ou | or |
| `google` | Continuar com Google | Continue with Google |
| `comingSoon` | Em breve | Coming soon |
| `devBypass` | 🛠 Dev: entrar sem API | 🛠 Dev: sign in without API |
| `connectionError` | Não foi possível ligar ao servidor. Tente novamente. | Couldn't reach the server. Please try again. |
| `legalPrefix` | Ao entrar, aceita os | By signing in you accept the |
| `legalTerms` | Termos de Serviço | Terms of Service |
| `legalAnd` | e a | and the |
| `legalPrivacy` | Política de Privacidade | Privacy Policy |

## public — register/page.tsx

| key | 🇵🇹 Portuguese | 🇬🇧 English |
|---|---|---|
| `panelTitle` | Registe a sua empresa gratuitamente | Register your company for free |
| `panelSub` | Beta fechada · Lisboa · Primeiros 50 empregadores sem custo de adesão. | Closed beta · Lisbon · First 50 employers join at no cost. |
| `panelFooter` | Ao registar-se, aceita os Termos de Serviço e a Política de Privacidade da Turnos. | By registering you accept the Terms of Service and Privacy Policy of Turnos. |
| `stepCompany` | Empresa | Company |
| `stepAccount` | Conta | Account |
| `stepReview` | Confirmação | Confirm |
| `companyTitle` | Dados da empresa | Company details |
| `haveAccount` | Já tem conta? | Already have an account? |
| `loginLink` | Entrar → | Sign in → |
| `labelName` | Nome da empresa * | Company name * |
| `placeholderName` | Ex: Restaurante A Taberna, Lda | E.g. Restaurante A Taberna, Lda |
| `labelNipc` | NIPC * | NIPC * |
| `hintNipc` | 9 dígitos | 9 digits |
| `labelNif` | NIF (opcional) | NIF (optional) |
| `hintNif` | Responsável | Person responsible |
| `labelSector` | Sector de actividade * | Business sector * |
| `pickSector` | Selecione o sector | Select a sector |
| `labelAddress` | Morada * | Address * |
| `placeholderAddress` | Rua do Ouro, 123 | Rua do Ouro, 123 |
| `labelPostal` | Código Postal * | Postcode * |
| `labelCity` | Cidade * | City * |
| `placeholderCity` | Lisboa | Lisbon |
| `continue` | Continuar → | Continue → |
| `adminTitle` | Conta de administrador | Administrator account |
| `adminSub` | O email e password para aceder ao dashboard. | The email and password you will use to sign in to the dashboard. |
| `labelEmail` | Email * | Email * |
| `placeholderEmail` | admin@empresa.pt | admin@company.pt |
| `labelPassword` | Password * | Password * |
| `hintPassword` | Mínimo 8 caracteres | Minimum 8 characters |
| `labelConfirm` | Confirmar Password * | Confirm password * |
| `back` | ← Voltar | ← Back |
| `reviewTitle` | Confirme os dados | Check your details |
| `reviewSub` | Verifique antes de submeter o registo. | Review everything before submitting your registration. |
| `rowCompany` | Empresa | Company |
| `rowNipc` | NIPC | NIPC |
| `rowSector` | Sector | Sector |
| `rowAddress` | Morada | Address |
| `rowEmail` | Email admin | Admin email |
| `submit` | Criar conta → | Create account → |
| `submitting` | A registar... | Registering... |
| `errName` | Nome da empresa obrigatório | Company name is required |
| `errSector` | Selecione o sector | Please select a sector |
| `errAddress` | Morada obrigatória | Address is required |
| `errPostal` | Formato: XXXX-XXX | Format: XXXX-XXX |
| `errCity` | Cidade obrigatória | City is required |
| `errEmail` | Email inválido | Invalid email |
| `errPassword` | Mínimo 8 caracteres | Minimum 8 characters |
| `errConfirm` | As passwords não coincidem | The passwords do not match |
| `errUnknown` | Erro desconhecido. Tente novamente. | Something went wrong. Please try again. |

---

Catalogue totals: **1216 keys** in each language, verified no drift.
