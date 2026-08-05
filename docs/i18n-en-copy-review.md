# English copy for review

Portuguese is canonical; the English column is what I drafted and what you review.
Namespaces already signed off are excluded — see `APPROVED` in
`scripts/i18n-copy-review.js`.

Portuguese legal terms — **MCD**, **Recibo Verde**, **TSU**, **Segurança Social**,
**SS Direta**, **ACT**, **NIF**, **IBAN**, **Portal das Finanças**, **Agenda do
Trabalho Digno** — are kept verbatim in English and glossed on first use, per the
locked decision.

## admin — sidebar navigation

| key | 🇵🇹 Portuguese | 🇬🇧 English |
|---|---|---|
| `dashboard` | Dashboard | Dashboard |
| `workersSearch` | Procurar Workers | Find workers |
| `workers` | Trabalhadores | My workers |
| `shifts` | Turnos | Shifts |
| `qrCheckIn` | QR Check-in | QR check-in |
| `compliance` | Conformidade | Compliance |
| `spending` | Gastos | Spending |
| `billing` | Faturação | Billing |
| `settings` | Definições | Settings |

## admin — shared page chrome

| key | 🇵🇹 Portuguese | 🇬🇧 English |
|---|---|---|
| `soon` | breve | soon |
| `logout` | Sair → | Sign out → |
| `backDashboard` | ← Dashboard | ← Dashboard |
| `backToDashboard` | ← Voltar ao Dashboard | ← Back to dashboard |
| `myCompany` | A minha empresa | My company |
| `postShift` | + Publicar Turno | + Post a shift |

## admin — small-screen interstitial

| key | 🇵🇹 Portuguese | 🇬🇧 English |
|---|---|---|
| `title` | Melhor no computador | Better on a computer |
| `body` | O Turnos Web Admin foi desenhado para desktop ou tablet. Para gerir turnos, aprovar candidatos e aceder a todos os relatórios, abre este link num computador ou tablet. | Turnos Web Admin is designed for desktop or tablet. To manage shifts, approve applicants and reach all the reports, open this link on a computer or tablet. |
| `continue` | Continuar mesmo assim | Continue anyway |

## admin — dashboard/page.tsx

| key | 🇵🇹 Portuguese | 🇬🇧 English |
|---|---|---|
| `greeting` | Bem-vindo 👋 | Welcome 👋 |
| `greetingNamed` | Bem-vindo, {{company}} 👋 | Welcome, {{company}} 👋 |
| `kpiActive` | Turnos ativos | Active shifts |
| `kpiActiveSub` | {{open}} · {{filled}} | {{open}} · {{filled}} |
| `kpiActiveOpenOne` | 1 aberto | 1 open |
| `kpiActiveOpenOther` | {{count}} abertos | {{count}} open |
| `kpiActiveFilledOne` | 1 preenchido | 1 filled |
| `kpiActiveFilledOther` | {{count}} preenchidos | {{count}} filled |
| `kpiAwaiting` | A aguardar confirmação | Awaiting confirmation |
| `kpiAwaitingNone` | Nenhum trabalhador a confirmar | No worker to confirm |
| `kpiAwaitingSome` | Worker tem 2h para aceitar | The worker has 2h to accept |
| `kpiApplicants` | Candidatos pendentes | Pending applicants |
| `kpiApplicantsNone` | Sem turnos à espera | No shifts waiting |
| `kpiApplicantsSome` | Ver e selecionar candidatos | Review and select applicants |
| `kpiExpired` | Turnos caducados | Expired shifts |
| `kpiExpiredNone` | Tudo em dia | All up to date |
| `kpiExpiredSome` | Re-publicar ou eliminar | Re-post or delete |
| `actionPostTitle` | Publicar Turno | Post a shift |
| `actionPostDesc` | Define função, horário e morada. TSU calculado automaticamente. | Set the role, hours and address. TSU is calculated automatically. |
| `actionPostCta` | Publicar → | Post → |
| `actionSearchTitle` | Procurar Trabalhadores | Find workers |
| `actionSearchDesc` | Filtra por competência, idioma ou disponibilidade e convida diretamente. | Filter by skill, language or availability and invite them directly. |
| `actionSearchCta` | Procurar → | Search → |
| `actionWorkersTitle` | Os Meus Trabalhadores | My workers |
| `actionWorkersDesc` | Workers que já trabalharam contigo com ratings e histórico de turnos. | Workers who have worked with you, with ratings and shift history. |
| `actionWorkersCta` | Ver → | View → |
| `actionQrTitle` | QR Check-in | QR check-in |
| `actionQrDesc` | O teu código QR fixo de check-in. Imprime uma vez, usa sempre. | Your fixed check-in QR code. Print it once, use it always. |
| `actionQrCta` | Ver QR → | View QR → |

## admin — workers-search/page.tsx

| key | 🇵🇹 Portuguese | 🇬🇧 English |
|---|---|---|
| `title` | Procurar Trabalhadores | Find workers |
| `sub` | Workers com perfil ≥80% activos na plataforma | Workers with a profile ≥80% who are active on the platform |
| `search` | 🔍 Pesquisar | 🔍 Search |
| `searching` | A pesquisar... | Searching... |
| `searchPlaceholder` | Nome, competência ou bio... | Name, skill or bio... |
| `filterSkills` | 🎯 Competências | 🎯 Skills |
| `filterSkillsCount` | 🎯 Competências ({{count}}) | 🎯 Skills ({{count}}) |
| `applyFilters` | Aplicar filtros | Apply filters |
| `filterAvailable` | 🟢 Disponíveis | 🟢 Available |
| `filterAvailableOn` | 🟢 Disponíveis ✓ | 🟢 Available ✓ |
| `filterAvailableTitle` | Mostrar apenas trabalhadores que se declararam disponíveis | Show only workers who have marked themselves available |
| `filterLanguage` | 🌐 Idioma... | 🌐 Language... |
| `filterLanguageCount` | 🌐 Idioma ({{count}})... | 🌐 Language ({{count}})... |
| `ratingAny` | ⭐ Qualquer avaliação | ⭐ Any rating |
| `rating3` | ⭐⭐⭐ 3+ estrelas | ⭐⭐⭐ 3+ stars |
| `rating4` | ⭐⭐⭐⭐ 4+ estrelas | ⭐⭐⭐⭐ 4+ stars |
| `rating45` | ⭐⭐⭐⭐½ 4.5+ estrelas | ⭐⭐⭐⭐½ 4.5+ stars |
| `resultsOne` | 1 worker encontrado | 1 worker found |
| `resultsOther` | {{count}} workers encontrados | {{count}} workers found |
| `emptyTitle` | Nenhum worker encontrado | No workers found |
| `emptySub` | Tenta ajustar os filtros ou pesquisa por nome. | Try adjusting the filters or search by name. |
| `noName` | Nome não definido | Name not set |
| `ratings` | ({{count}} aval.) | ({{count}} reviews) |
| `badgeTop` | 🏆 Top Rated | 🏆 Top Rated |
| `badgeReliable` | ✅ Fiável | ✅ Reliable |
| `badgeVerified` | ✔️ Verificado | ✔️ Verified |
| `badgeTopShort` | 🏆 Top | 🏆 Top |
| `badgeReliableShort` | ✅ Fiável | ✅ Reliable |
| `badgeVerifiedShort` | ✔️ Verif. | ✔️ Verified |
| `availablePill` | 🟢 Disponível | 🟢 Available |
| `viewProfile` | Ver perfil & convidar → | View profile & invite → |
| `panelCompleteness` | Perfil Completo | Profile complete |
| `panelBio` | Apresentação | About |
| `panelCv` | Currículo | CV |
| `panelCvFallback` | Ver CV | View CV |
| `panelExperience` | Experiência | Experience |
| `panelSkills` | Competências | Skills |
| `panelLanguages` | Idiomas | Languages |
| `panelAvailability` | Disponibilidade | Availability |
| `availableOn` | 🟢 Disponível para trabalhar | 🟢 Available for work |
| `availableOff` | ⚪ Não disponível de momento | ⚪ Not available right now |
| `statNoShows` | faltas | no-shows |
| `statRatings` | avaliações | ratings |
| `statProfile` | perfil | profile |
| `inviteTitle` | Convidar para um turno | Invite to a shift |
| `inviteSuccess` | ✅ Convite enviado! O worker tem 2h para aceitar. | ✅ Invitation sent! The worker has 2h to accept. |
| `inviteNoShifts` | Não tens turnos abertos. | You have no open shifts. |
| `inviteNoShiftsCta` | Publicar turno → | Post a shift → |
| `invitePick` | Seleciona um turno... | Choose a shift... |
| `inviteBtn` | ⚡ Convidar | ⚡ Invite |
| `inviteFailed` | Erro ao convidar. | Couldn't send the invitation. |

## admin — workers/page.tsx

| key | 🇵🇹 Portuguese | 🇬🇧 English |
|---|---|---|
| `title` | Os Meus Trabalhadores | My workers |
| `subNone` | Nenhum trabalhador contratado ainda | No workers hired yet |
| `subOne` | 1 trabalhador contratado | 1 worker hired |
| `subOther` | {{count}} trabalhadores contratados | {{count}} workers hired |
| `loadError` | Erro ao carregar trabalhadores. | Couldn't load your workers. |
| `refresh` | ↻ Atualizar | ↻ Refresh |
| `emptyTitle` | Ainda não contratou nenhum trabalhador | You haven't hired any workers yet |
| `emptySub` | Os trabalhadores aprovados nos seus turnos aparecerão aqui. | Workers you approve for your shifts will appear here. |
| `emptyCta` | Ver os meus turnos → | View my shifts → |
| `noName` | Nome não definido | Name not set |
| `ratings` | · {{count}} aval. | · {{count}} reviews |
| `scoreLabel` | perfil completo | profile complete |
| `shiftsOne` | 1 turno realizado | 1 shift worked |
| `shiftsOther` | {{count}} turnos realizados | {{count}} shifts worked |
| `lastShift` |  · último {{date}} |  · last {{date}} |
| `noShowOne` | ⚠ 1 falta | ⚠ 1 no-show |
| `noShowOther` | ⚠ {{count}} faltas | ⚠ {{count}} no-shows |
| `skillsLabel` | Competências | Skills |
| `availabilityLabel` | Disponibilidade | Availability |

## admin — qr-codes/page.tsx

| key | 🇵🇹 Portuguese | 🇬🇧 English |
|---|---|---|
| `back` | ← Voltar aos Turnos | ← Back to shifts |
| `title` | Código QR de Check-in | Check-in QR code |
| `sub` | Imprima este QR code e afixe-o à entrada do seu local de trabalho. O trabalhador digitaliza-o na chegada — o turno conclui automaticamente à hora de fim. | Print this QR code and put it up at the entrance to your venue. The worker scans it on arrival — the shift completes automatically at its end time. |
| `print` | 🖨️ Imprimir | 🖨️ Print |
| `regenerate` | ↻ Regenerar | ↻ Regenerate |
| `loading` | A gerar QR codes... | Generating QR codes... |
| `loadError` | Erro ao carregar os QR codes. | Couldn't load your QR codes. |
| `infoLead` | Como funciona: | How it works: |
| `infoBody1` |  Este QR code é permanente — não expira. Imprima-o uma vez e afixe-o à entrada do seu espaço. O trabalhador abre a aplicação Turnos, toca em  |  This QR code is permanent — it never expires. Print it once and put it up at your entrance. The worker opens the Turnos app, taps  |
| `infoCheckIn` | Check-in | Check-in |
| `infoBody2` |  e aponta a câmara. No fim do horário, o turno  |  and points their camera at it. At the end of the scheduled hours the shift  |
| `infoAuto` | conclui automaticamente | completes automatically |
| `infoBody3` |  — não é preciso digitalizar à saída. Se algo correr mal (saída antecipada, problema no turno), pode ajustar as horas ou reportar o problema em  |  — there is nothing to scan on the way out. If something goes wrong (an early finish, a problem during the shift), you can adjust the hours or report the problem in  |
| `infoMyShifts` | Os Meus Turnos | My Shifts |
| `infoBody4` |  antes de pagar. |  before paying. |
| `printTitle` | Turnos — Check-in | Turnos — Check-in |
| `cardTitle` | CHECK-IN | CHECK-IN |
| `cardSub` | Digitalizar na chegada | Scan on arrival |
| `qrAlt` | QR Code Check-in | Check-in QR code |
| `instruction1` | 📱 Trabalhador abre a app → toca em  | 📱 The worker opens the app → taps  |
| `instructionBold` | Fazer Check-in | Check in |
| `instruction2` |  → aponta a câmara aqui |  → points the camera here |
| `download` | ⬇ Descarregar PNG | ⬇ Download PNG |
| `placementTitle` | 📌 Onde colocar o QR code | 📌 Where to put the QR code |
| `placementInLabel` | CHECK-IN | CHECK-IN |
| `placementInWhere` |  — Entrada / Receção |  — Entrance / Reception |
| `placementInDesc` | À entrada do espaço de trabalho, onde o trabalhador chega. | At the entrance to the workplace, where the worker arrives. |
| `placementEndLabel` | FIM DO TURNO | END OF SHIFT |
| `placementEndWhere` |  — Automático |  — Automatic |
| `placementEndDesc` | Não há QR de saída: o turno conclui sozinho à hora de fim agendada. | There is no check-out QR: the shift completes on its own at the scheduled end time. |
| `fallback1` | Se o trabalhador não conseguir digitalizar o QR (câmara com problemas, etc.), pode confirmar manualmente o turno na página  | If the worker can't scan the QR code (camera trouble, etc.), you can confirm the shift manually on the  |
| `fallbackLink` | Os Meus Turnos | My Shifts |
| `fallback2` |  com o botão  |  page with the  |
| `fallbackButton` | ✓ Confirmar | ✓ Confirm |
| `fallback3` | . |  button. |

## admin — compliance/page.tsx

| key | 🇵🇹 Portuguese | 🇬🇧 English |
|---|---|---|
| `title` | 📊 Conformidade Legal | 📊 Legal compliance |
| `sub` | TSU / SS Direta · Contratos MCD · Registo de auditoria ACT | TSU / SS Direta · MCD contracts · ACT audit trail |
| `tabTsu` | 💶 Relatório TSU | 💶 TSU report |
| `tabMcd` | 📄 Contratos MCD | 📄 MCD contracts |
| `tabAudit` | 🔒 Auditoria ACT | 🔒 ACT audit |
| `emptyTsu` | Sem turnos concluídos em {{month}} {{year}} | No completed shifts in {{month}} {{year}} |
| `emptyMcd` | Sem contratos MCD registados ainda | No MCD contracts recorded yet |
| `emptyAudit` | Sem eventos de auditoria | No audit events |
| `kpiGross` | Bruto Total | Total gross |
| `kpiEmployerTsu` | TSU Entidade (23.75%) | Employer TSU (23.75%) |
| `kpiTurnosFees` | Taxas Turnos | Turnos fees |
| `colShift` | Turno | Shift |
| `colDate` | Data | Date |
| `colWorker` | Trabalhador | Worker |
| `colGross` | Bruto | Gross |
| `colTurnosFee` | Taxa Turnos | Turnos fee |
| `colEmployerTsu` | TSU Emp. | Employer TSU |
| `colWorkerNet` | Líquido Trabalh. | Worker net |
| `legalNote` | ℹ️ SS Trabalhador (11%) é entregue pelo próprio trabalhador via SS Direta — não incluído acima. TSU Entidade (23.75%) deve ser pago mensalmente pelo empregador. | ℹ️ Worker SS (11%) is paid by the worker themselves via SS Direta — not included above. Employer TSU (23.75%) must be paid monthly by the employer. |
| `colWorkerNif` | Trabalhador / NIF | Worker / NIF |
| `colShiftDate` | Data do Turno | Shift date |
| `colSchedule` | Horário | Hours |
| `colRole` | Função | Role |
| `colRate` | Valor/hora | Rate/hour |
| `colSsDireta` | SS Direta | SS Direta |
| `auditNote` | 🔒 Registo imutável de todos os eventos de conformidade. Usado em inspeções da ACT. | 🔒 Immutable record of every compliance event. Used in ACT inspections. |
| `colDateTime` | Data/Hora | Date/time |
| `colEvent` | Evento | Event |
| `colShiftShort` | Turno | Shift |
| `colDetails` | Detalhes | Details |
| `ssStatus.PENDING` | Pendente | Pending |
| `ssStatus.EMAIL_SENT` | Email enviado | Email sent |
| `ssStatus.SUBMITTED` | Submetido | Submitted |
| `ssStatus.FAILED` | Falhou | Failed |

## admin — spending/page.tsx

| key | 🇵🇹 Portuguese | 🇬🇧 English |
|---|---|---|
| `title` | Gastos | Spending |
| `sub` | Análise de custos por turno e relatório TSU para contabilidade | Cost analysis per shift and TSU report for your accountant |
| `exportCsv` | ⬇ Exportar CSV | ⬇ Export CSV |
| `csvFilename` | turnos-gastos | turnos-spending |
| `csvHeader` | Data,Turno ID,Bruto (€),Taxa Turnos (€),TSU Entidade (€),TSU Trabalhador (€),Horas,Líquido Trabalhador (€) | Date,Shift ID,Gross (€),Turnos fee (€),Employer TSU (€),Worker TSU (€),Hours,Worker net (€) |
| `periodMonth` | Mês | Month |
| `periodYear` | Ano | Year |
| `loading` | A carregar dados de {{period}}… | Loading data for {{period}}… |
| `loadError` | Erro ao carregar dados. | Couldn't load your data. |
| `emptyTitle` | Sem turnos pagos em {{period}} | No paid shifts in {{period}} |
| `emptySub` | Os dados aparecem aqui quando os turnos são concluídos (automaticamente à hora de fim). | Data appears here once shifts complete (automatically at their end time). |
| `emptyCta` | Ver Turnos → | View shifts → |
| `kpiWages` | Salários a pagar (informativo) | Wages to pay (informative) |
| `kpiWagesSubOne` | 1 turno — pagas diretamente aos workers | 1 shift — you pay workers directly |
| `kpiWagesSubOther` | {{count}} turnos — pagas diretamente aos workers | {{count}} shifts — you pay workers directly |
| `kpiTsu` | TSU a pagar ao Estado | TSU to pay the State |
| `kpiTsuSub` | 23.75% do bruto — valor informativo | 23.75% of gross — informative only |
| `kpiFees` | Taxas Turnos | Turnos fees |
| `kpiFeesSubOne` | 1 turno × 3€ — na próxima fatura mensal | 1 shift × €3 — on your next monthly invoice |
| `kpiFeesSubOther` | {{count}} turnos × 3€ — na próxima fatura mensal | {{count}} shifts × €3 — on your next monthly invoice |
| `kpiAvg` | Custo médio por turno | Average cost per shift |
| `kpiAvgSub` | Bruto + TSU entidade | Gross + employer TSU |
| `tsuReminderTitle` | Lembra-te: TSU da entidade empregadora | Remember: employer TSU |
| `tsuReminder1` | Deves entregar  | You must pay  |
| `tsuReminder2` |  à Segurança Social referente a {{period}}. A taxa é de 23,75% sobre o total dos salários brutos. Prazo de entrega: até ao dia 20 do mês seguinte. |  to Segurança Social for {{period}}. The rate is 23.75% of total gross wages. Deadline: the 20th of the following month. |
| `monthlyTitle` | Detalhe mensal — {{year}} | Monthly breakdown — {{year}} |
| `tableTitle` | Turnos — {{period}} | Shifts — {{period}} |
| `recordsCount` | {{count}} registos | {{count}} records |
| `colDate` | Data | Date |
| `colGross` | Bruto | Gross |
| `colFee` | Taxa Turnos | Turnos fee |
| `colEmployerTsu` | TSU Entidade | Employer TSU |
| `colWorkerTsu` | TSU Trabalhador | Worker TSU |
| `colHours` | Horas | Hours |
| `colNet` | Líquido Trabalhador | Worker net |
| `totalLabel` | Total | Total |
| `navBilling` | Ver Faturação → | View billing → |

## admin — billing/page.tsx

| key | 🇵🇹 Portuguese | 🇬🇧 English |
|---|---|---|
| `title` | Faturação | Billing |
| `sub` | Gerir o teu plano de subscrição Turnos | Manage your Turnos subscription plan |
| `loading` | A carregar informação de faturação… | Loading your billing information… |
| `loadError` | Não foi possível carregar a informação de faturação. Tenta novamente. | Couldn't load your billing information. Please try again. |
| `status.active` | Ativo | Active |
| `status.past_due` | Pagamento em falta | Payment overdue |
| `status.cancelled` | Cancelado | Cancelled |
| `status.inactive` | Inativo | Inactive |
| `currentPlan` | Plano atual | Current plan |
| `planName` | Turnos Starter | Turnos Starter |
| `planPrice` | €45 | €45 |
| `planPriceSub` | /mês por empresa + 3€ por turno concluído | /month per company + €3 per completed shift |
| `features.f1` | Publicar até 15 turnos em simultâneo | Post up to 15 shifts at a time |
| `features.f2` | Procurar e convidar trabalhadores por competência e idioma | Search and invite workers by skill and language |
| `features.f3` | Gestão de candidaturas e aprovação de trabalhadores | Application management and worker approval |
| `features.f4` | QR Check-in no local + conclusão automática do turno | On-site QR check-in + automatic shift completion |
| `features.f5` | Conformidade MCD — contratos e SS Direta automáticos | MCD compliance — automatic contracts and SS Direta |
| `features.f6` | Relatório TSU mensal pronto para a contabilidade | Monthly TSU report ready for your accountant |
| `features.f7` | Notificações push em tempo real | Real-time push notifications |
| `ctaNote` | Para ativar a subscrição, precisas primeiro de adicionar um cartão de crédito. Usa o painel de pagamentos Stripe para guardar o teu método de pagamento. | To activate your subscription you first need to add a credit card. Use the Stripe payments panel to save your payment method. |
| `ctaSubNote` | Nota: Se ainda não tens cartão guardado, a ativação irá falhar com uma mensagem clara. Fala com o suporte Turnos para adicionar o cartão via Stripe Dashboard. | Note: if you haven't saved a card yet, activation will fail with a clear message. Talk to Turnos support to add your card via the Stripe Dashboard. |
| `activate` | 🚀 Ativar subscrição — €45/mês | 🚀 Activate subscription — €45/month |
| `processing` | A processar… | Processing… |
| `cancel` | Cancelar subscrição | Cancel subscription |
| `pastDueBanner` | ⚠️ O pagamento do teu plano falhou. Por favor atualiza o método de pagamento no Stripe Dashboard ou contacta o suporte Turnos. | ⚠️ Your plan payment failed. Please update your payment method in the Stripe Dashboard or contact Turnos support. |
| `activated` | ✅ Subscrição ativada com sucesso! Podes agora publicar turnos. | ✅ Subscription activated! You can now post shifts. |
| `activateStatus` | Estado da subscrição: {{status}} | Subscription status: {{status}} |
| `activateError` | Erro ao ativar a subscrição. | Couldn't activate the subscription. |
| `cancelConfirm` | Tens a certeza que queres cancelar a subscrição? Perderás o acesso no final do período atual. | Are you sure you want to cancel your subscription? You will lose access at the end of the current period. |
| `cancelled` | Subscrição cancelada. O acesso mantém-se até ao fim do período atual. | Subscription cancelled. Your access continues until the end of the current period. |
| `cancelError` | Erro ao cancelar a subscrição. | Couldn't cancel the subscription. |
| `aboutTitle` | Sobre o plano Starter | About the Starter plan |
| `rowShifts` | Turnos simultâneos | Concurrent shifts |
| `rowShiftsVal` | Até 15 turnos ativos | Up to 15 active shifts |
| `rowWorkers` | Trabalhadores | Workers |
| `rowWorkersVal` | Ilimitados | Unlimited |
| `rowQr` | QR Check-in | QR check-in |
| `rowQrVal` | Incluído | Included |
| `rowTsu` | Relatório TSU | TSU report |
| `rowTsuVal` | Incluído (informativo) | Included (informative) |
| `rowSs` | SS Direta (MCD) | SS Direta (MCD) |
| `rowSsVal` | Automático | Automatic |
| `rowFee` | Taxa por turno concluído | Fee per completed shift |
| `rowFeeVal` | 3€ fixos — faturados 1×/mês | €3 flat — invoiced once a month |
| `rowWage` | Salário do trabalhador | Worker's wage |
| `rowWageVal` | Pagas diretamente — 0% de comissão | You pay them directly — 0% commission |
| `cancelPolicyTitle` | Política de cancelamento de turnos | Shift cancellation policy |
| `cancelPolicy1` | Cancelar um turno preenchido com menos de  | Cancelling a filled shift less than  |
| `cancelPolicyBold1` | 3 horas | 3 hours |
| `cancelPolicy2` |  de antecedência, sem justificação, obriga ao pagamento de um  |  before it starts, without a justification, means paying the worker a  |
| `cancelPolicyBold2` | mínimo de 2 horas | minimum of 2 hours |
| `cancelPolicy3` |  ao trabalhador (via Pay Link) + a taxa normal de 3€. Entre 24h e 3h o cancelamento é gratuito mas fica registado na fiabilidade da empresa. Cancelamentos justificados (atraso do trabalhador, força maior, etc.) e com mais de 24h são  |  (via Pay Link) plus the usual €3 fee. Between 24h and 3h cancelling is free but is recorded against your company reliability. Justified cancellations (worker running late, force majeure, etc.) and anything more than 24h ahead are  |
| `cancelPolicyBold3` | gratuitos | free |
| `cancelPolicy4` | . | . |
| `proTitle` | Turnos Pro — brevemente 🚀 | Turnos Pro — coming soon 🚀 |
| `proBody1` | Turnos ilimitados em simultâneo, 5 utilizadores, taxa de 2€/turno, filtros avançados de pesquisa e convite direto de trabalhadores, relatórios de contabilidade —  | Unlimited concurrent shifts, 5 users, a €2/shift fee, advanced search filters and direct worker invites, accounting reports —  |
| `proPrice` | €99/mês | €99/month |
| `proBody2` | . Fala connosco para saber mais. | . Talk to us to find out more. |
| `navSpending` | Ver Gastos → | View spending → |

## admin — ratings/page.tsx

| key | 🇵🇹 Portuguese | 🇬🇧 English |
|---|---|---|
| `title` | Reputação | Reputation |
| `sub` | Avaliações e histórico de desempenho dos trabalhadores | Worker ratings and performance history |
| `searchPlaceholder` | Pesquisar trabalhador... | Search worker... |
| `refresh` | ↻ Atualizar | ↻ Refresh |
| `loadError` | Erro ao carregar dados. | Couldn't load your data. |
| `emptyTitle` | Ainda sem avaliações | No ratings yet |
| `emptySub` | As avaliações aparecem aqui após a conclusão dos turnos com trabalhadores contratados. | Ratings appear here once shifts with hired workers are completed. |
| `emptyCta` | Ver os meus turnos → | View my shifts → |
| `noName` | Nome não definido | Name not set |
| `workerFallback` | Trabalhador | Worker |
| `totalRatings` | · {{count}} aval. | · {{count}} reviews |
| `statShifts` | turnos | shifts |
| `statNoShowOne` | falta | no-show |
| `statNoShowOther` | faltas | no-shows |
| `statProfile` | perfil | profile |
| `rateBtn` | ⭐ Avaliar | ⭐ Rate |
| `noShowBtn` | ⚠ Reportar falta | ⚠ Report no-show |
| `rateTitle` | Avaliar trabalhador | Rate worker |
| `rateLoading` | A carregar turnos... | Loading shifts... |
| `rateAllDone` | Todos os turnos já foram avaliados | Every shift has been rated |
| `rateAllDoneSub` | Não há turnos concluídos pendentes de avaliação com este trabalhador. | There are no completed shifts with this worker left to rate. |
| `pickShift` | Seleciona o turno | Choose the shift |
| `rateQuestion` | Como foi o desempenho? | How did they perform? |
| `scores.1` | Mau 😞 | Poor 😞 |
| `scores.2` | Razoável 😐 | Fair 😐 |
| `scores.3` | Bom 😊 | Good 😊 |
| `scores.4` | Muito bom 😄 | Very good 😄 |
| `scores.5` | Excelente 🤩 | Excellent 🤩 |
| `tagsLabel` | O que destacas? (opcional) | What stood out? (optional) |
| `reviewLabel` | Avaliação escrita | Written review |
| `reviewHint` | (opcional · visível a outros empregadores) | (optional · visible to other employers) |
| `reviewPlaceholder` | Ex: Muito pontual e profissional. Recomendo para turnos de eventos... | E.g. Very punctual and professional. Recommended for event shifts... |
| `rateSubmit` | Enviar avaliação | Send rating |
| `rateSubmitting` | A enviar... | Sending... |
| `rateError` | Erro ao enviar avaliação. | Couldn't send the rating. |
| `noShowTitle` | Reportar falta | Report a no-show |
| `noShowNoShifts` | Não há turnos confirmados associados a este trabalhador para reportar falta. | There are no confirmed shifts with this worker to report a no-show for. |
| `noShowNoteLabel` | Nota (opcional) | Note (optional) |
| `noShowPlaceholder` | Descreve o que aconteceu... | Describe what happened... |
| `noShowSubmit` | Reportar falta | Report no-show |
| `noShowSubmitting` | A reportar... | Reporting... |
| `noShowError` | Erro ao reportar falta. | Couldn't report the no-show. |

## admin — new-shift/page.tsx

| key | 🇵🇹 Portuguese | 🇬🇧 English |
|---|---|---|
| `title` | Publicar Turno | Post a shift |
| `sub` | Preencha os detalhes do turno. O valor bruto e o custo TSU são calculados automaticamente. | Fill in the shift details. The gross rate and TSU cost are calculated automatically. |
| `back` | ← Voltar | ← Back |
| `optional` | opcional | optional |
| `roleSection` | Função & Categoria | Role & category |
| `labelCategory` | Categoria | Category |
| `labelRole` | Função | Role |
| `labelTitle` | Título personalizado | Custom title |
| `titlePlaceholder` | Ex: Bartender Sénior, Chef de Linha... | E.g. Senior Bartender, Line Chef... |
| `labelDescription` | Descrição | Description |
| `descPlaceholder` | Descreva o turno, ambiente de trabalho, requisitos específicos... | Describe the shift, the working environment, any specific requirements... |
| `skillsSection` | Competências necessárias | Skills required |
| `skillsHint` | Selecione as competências mais relevantes para este turno. Pode também adicionar competências personalizadas. | Select the skills most relevant to this shift. You can also add custom skills. |
| `customSkillPlaceholder` | Adicionar competência personalizada... | Add a custom skill... |
| `addSkill` | + Adicionar | + Add |
| `selectedLabel` | Selecionadas: | Selected: |
| `languagesSection` | Idiomas necessários | Languages required |
| `languagesHint` | Selecione os idiomas necessários para este turno. Apenas trabalhadores com esses idiomas serão notificados. | Select the languages needed for this shift. Only workers who speak them will be notified. |
| `languagesPickedOne` | 1 idioma selecionado: {{list}} | 1 language selected: {{list}} |
| `languagesPickedOther` | {{count}} idiomas selecionados: {{list}} | {{count}} languages selected: {{list}} |
| `paymentSection` | Como vais pagar ao trabalhador? | How will you pay the worker? |
| `paymentHint` | O pagamento é feito diretamente por ti ao trabalhador após o turno — não passa pela Turnos. O método escolhido é mostrado ao trabalhador antes de se candidatar. | You pay the worker directly after the shift — the money never passes through Turnos. The method you choose is shown to the worker before they apply. |
| `recommended` | Recomendado | Recommended |
| `payLinkNote` | 💳 Recebes um link após o turno e pagas por cartão ou MB WAY. O dinheiro vai direto para a conta do trabalhador e o pagamento fica confirmado automaticamente. | 💳 You get a link after the shift and pay by card or MB WAY. The money goes straight to the worker's account and the payment is confirmed automatically. |
| `manualPayNote` | 💡 Depois de pagares, anexa o comprovativo no dashboard. É o que resolve a disputa se o trabalhador reportar que não recebeu. | 💡 After paying, attach the proof in the dashboard. That is what settles the dispute if the worker reports they were not paid. |
| `dateSection` | Data & Horário | Date & hours |
| `minBadge` | ⏱ Mínimo 2 horas | ⏱ Minimum 2 hours |
| `labelFirstDay` | Primeiro dia | First day |
| `labelDate` | Data do turno | Shift date |
| `labelStart` | Hora de início | Start time |
| `pickTime` | Selecionar hora... | Select a time... |
| `labelDuration` | Duração | Duration |
| `durationMin` | (mínimo) | (minimum) |
| `multiDayLabel` | Trabalho de vários dias | Multi-day job |
| `multiDayHint` |  — o mesmo horário em várias datas. O trabalhador candidata-se uma vez e compromete-se com todos os dias. |  — the same hours across several dates. The worker applies once and commits to every day. |
| `addDay` | + Adicionar dia | + Add a day |
| `removeDay` | Remover {{date}} | Remove {{date}} |
| `maxDays` | Um trabalho de vários dias pode ter no máximo {{max}} dias. | A multi-day job can span at most {{max}} days. |
| `daysOne` | 1 dia | 1 day |
| `daysOther` | {{count}} dias | {{count}} days |
| `totalHours` | {{hours}}h no total | {{hours}}h in total |
| `grossEstimate` | ≈ €{{amount}} bruto | ≈ €{{amount}} gross |
| `feeNote1` | A taxa Turnos é de  | The Turnos fee is  |
| `feeNoteBold1` | €{{fee}} por trabalho | €{{fee}} per job |
| `feeNote2` | , não por dia. O pagamento ao trabalhador é feito  | , not per day. The worker is paid  |
| `feeNoteBold2` | uma vez, no fim | once, at the end |
| `feeNote3` |  de todos os dias. |  of all the days. |
| `endLabel` | Fim do turno: | Shift ends: |
| `endDuration` | · {{hours}}h de trabalho | · {{hours}}h of work |
| `nextDay` | +1 dia | +1 day |
| `law8h` | ⚠️ Turno ≥ 8h: o trabalhador tem direito a pausa de 1h e subsídio de refeição (~€6,00/dia). Certifica-te de que o valor/hora reflecte este custo. | ⚠️ Shift ≥ 8h: the worker is entitled to a 1h break and a meal allowance (~€6.00/day). Make sure your hourly rate covers this cost. |
| `law4h` | ℹ️ Turno ≥ 4h: o trabalhador tem direito a pausa obrigatória de 15–30 min (não computada no horário de trabalho). | ℹ️ Shift ≥ 4h: the worker is entitled to a mandatory 15–30 min break (not counted as working time). |
| `locationSection` | Localização | Location |
| `labelAddress` | Morada completa | Full address |
| `addressPlaceholder` | Ex: Rua Augusta 1, 1100-048 Lisboa | E.g. Rua Augusta 1, 1100-048 Lisbon |
| `verifyAddress` | 📍 Verificar | 📍 Verify |
| `addressNotFound` | Morada não encontrada. Tente ser mais específico (ex: "Rua Augusta 1, Lisboa"). | Address not found. Try being more specific (e.g. "Rua Augusta 1, Lisbon"). |
| `paySection` | Remuneração & Custos | Pay & costs |
| `labelRate` | Valor bruto/hora (€) para o trabalhador | Gross rate/hour (€) for the worker |
| `minWageHint` | Salário mínimo em Portugal: €5,41/hr (2024) | Minimum wage in Portugal: €5.41/hr (2024) |
| `tsuGross` | Bruto trabalhador | Worker gross |
| `tsuEmployer` | TSU entidade (23,75%) | Employer TSU (23.75%) |
| `tsuTotal` | Custo total empregador | Total employer cost |
| `tsuShiftCost` | Custo total do turno ({{hours}}h) | Total cost of the shift ({{hours}}h) |
| `submit` | ✓ Publicar Turno | ✓ Post shift |
| `submitting` | A publicar... | Posting... |
| `errGeo` | Por favor verifique a localização antes de publicar. | Please verify the location before posting. |
| `errDuration` | A duração mínima de um turno é 2 horas. | The minimum shift duration is 2 hours. |
| `errStart` | Por favor selecione a hora de início. | Please select a start time. |
| `errSubmit` | Erro ao publicar turno. | Couldn't post the shift. |

## admin — shifts/page.tsx

| key | 🇵🇹 Portuguese | 🇬🇧 English |
|---|---|---|
| `title` | Os Meus Turnos | My shifts |
| `refresh` | ↻ Atualizar | ↻ Refresh |
| `qrCodes` | 📲 Códigos QR | 📲 QR codes |
| `newShift` | + Publicar Turno | + Post a shift |
| `loadError` | Erro ao carregar turnos. | Couldn't load your shifts. |
| `subCount` | {{total}} turnos no total · {{active}} ativos | {{total}} shifts in total · {{active}} active |
| `emptyText` | Ainda não publicou nenhum turno. | You haven't posted any shifts yet. |
| `emptyCta` | Publicar primeiro turno → | Post your first shift → |
| `sectionActive` | Turnos Ativos | Active shifts |
| `sectionHistory` | Histórico | History |
| `expiredToggle` | Caducados ({{count}}) — Turnos sem trabalhador confirmado | Expired ({{count}}) — shifts with no confirmed worker |
| `expiredClose` | ▲ Fechar | ▲ Close |
| `expiredOpen` | ▼ Ver | ▼ View |
| `expiredPill` | Caducado | Expired |
| `repost` | 🔁 Re-publicar | 🔁 Re-post |
| `deleteExpired` | 🗑 Eliminar | 🗑 Delete |
| `deleteConfirm` | Eliminar este turno caducado? | Delete this expired shift? |
| `deleteError` | Erro ao eliminar. | Couldn't delete it. |
| `colShift` | Turno | Shift |
| `colDate` | Data | Date |
| `colTime` | Horário | Hours |
| `colRate` | Valor bruto | Gross rate |
| `colStatus` | Estado | Status |
| `colActions` | Ações | Actions |
| `multiDayTag` | 🔁 {{count}} dias | 🔁 {{count}} days |
| `viewApps` | 👥 Candidatos | 👥 Applicants |
| `manualDone` | 🏁 Concluído | 🏁 Completed |
| `manualDoneTitle` | Marcar como concluído (sem QR) — usar quando o turno não concluiu automaticamente | Mark as completed (no QR) — use when the shift did not complete automatically |
| `cancelBtn` | Cancelar | Cancel |
| `cancelConfirmSimple` | Tem a certeza que quer cancelar este turno? | Are you sure you want to cancel this shift? |
| `cancelError` | Erro ao cancelar. | Couldn't cancel the shift. |
| `confirmError` | Erro ao confirmar. | Couldn't confirm the shift. |
| `manualConfirmBody` | Marcar como concluído: "{{shift}}"<br><br>O turno será encerrado e o pagamento será desencadeado automaticamente. Esta ação não pode ser desfeita.<br><br>Usa esta opção apenas se o turno não concluiu automaticamente (ex.: check-in falhou). | Mark as completed: "{{shift}}"<br><br>The shift will be closed and payment triggered automatically. This cannot be undone.<br><br>Only use this if the shift did not complete automatically (e.g. the check-in failed). |
| `qrTip1` | Tem turnos confirmados hoje. Certifique-se de que os  | You have confirmed shifts today. Make sure your  |
| `qrTipLink` | códigos QR | QR codes |
| `qrTip2` |  estão visíveis no seu local de trabalho. |  are visible at your workplace. |
| `appsTitle` | Candidatos — {{shift}} | Applicants — {{shift}} |
| `appsSubOne` | {{date}} · {{time}} · 1 candidato | {{date}} · {{time}} · 1 applicant |
| `appsSubOther` | {{date}} · {{time}} · {{count}} candidatos | {{date}} · {{time}} · {{count}} applicants |
| `appsLoading` | A carregar candidatos... | Loading applicants... |
| `appsEmpty` | Nenhum candidato ainda. | No applicants yet. |
| `sortLabel` | Ordenar: | Sort: |
| `sortRating` | ⭐ Melhor avaliação | ⭐ Best rated |
| `sortScore` | 📋 Perfil mais completo | 📋 Most complete profile |
| `sortDate` | 🕐 Mais antigo | 🕐 Oldest first |
| `matchBadge` | ✓ Match total | ✓ Full match |
| `matchCount` | {{matched}}/{{total}} competências | {{matched}}/{{total}} skills |
| `appProfile` | Perfil: {{score}}% | Profile: {{score}}% |
| `viewProfile` | Ver perfil → | View profile → |
| `approved` | ✓ Aprovado | ✓ Approved |
| `rejected` | ✕ Rejeitado | ✕ Rejected |
| `select` | Selecionar | Select |
| `approveError` | Erro ao aprovar. | Couldn't approve this applicant. |
| `backToList` | ← Voltar à lista | ← Back to the list |
| `noName` | Nome não definido | Name not set |
| `ratingsCount` | ({{count}} aval.) | ({{count}} reviews) |
| `coverNoteTitle` | 💬 Mensagem do candidato | 💬 Message from the applicant |
| `panelBio` | Apresentação | About |
| `panelScore` | Perfil completo | Profile complete |
| `panelSkills` | Competências | Skills |
| `panelExperience` | Experiência | Experience |
| `panelCv` | Currículo | CV |
| `panelCvFallback` | Ver CV | View CV |
| `panelLanguages` | Idiomas | Languages |
| `panelAvailability` | Disponibilidade | Availability |
| `availableOn` | 🟢 Disponível para trabalhar | 🟢 Available for work |
| `availableOff` | ⚪ Não disponível de momento | ⚪ Not available right now |
| `profileIncomplete` | Este candidato ainda não preencheu o perfil completo. | This applicant hasn't completed their profile yet. |
| `pendingTitle` | 💶 Pagamentos pendentes a trabalhadores ({{count}}) | 💶 Wage payments due to workers ({{count}}) |
| `cancellationMin` | ⚠️ Mínimo 2h (cancelamento) —  | ⚠️ 2h minimum (cancellation) —  |
| `awaitingWorker` |  · aguarda confirmação do trabalhador |  · awaiting the worker’s confirmation |
| `disputed` |  · 🚩 trabalhador reporta não ter recebido |  · 🚩 the worker reports not being paid |
| `workerFallback` | Trabalhador | Worker |
| `ibanLabel` | IBAN: | IBAN: |
| `referenceLabel` | Referência: | Reference: |
| `ibanWithheld` | O trabalhador não autorizou a partilha do IBAN. Combina outro método (MB WAY) diretamente com ele, ou pede-lhe que ative o Turnos Pay Link. | The worker has not consented to sharing their IBAN. Agree another method (MB WAY) directly with them, or ask them to activate Turnos Pay Link. |
| `viewProof` | 📎 Ver comprovativo | 📎 View proof |
| `noProofDeclared` | ⚠️ Declarado sem comprovativo | ⚠️ Declared without proof |
| `payNow` | 💳 Pagar agora | 💳 Pay now |
| `markPaid` | ✓ Marcar como pago | ✓ Mark as paid |
| `adjustHours` | ✏️ Ajustar horas | ✏️ Adjust hours |
| `reportProblem` | ⚠️ Reportar problema | ⚠️ Report a problem |
| `underReview` | ⚖️ Em análise pela Turnos (48h) | ⚖️ Under review by Turnos (48h) |
| `pendingFooter` | Pagamentos em falta há mais de 72h suspendem a publicação de novos turnos. | Payments outstanding for more than 72h block you from posting new shifts. |
| `markPaidTitle` | Confirmar pagamento ao trabalhador | Confirm payment to the worker |
| `markPaidSub` | {{shift}} · {{date}} ·  | {{shift}} · {{date}} ·  |
| `markPaidVia` |  via {{method}} |  via {{method}} |
| `ibanWithheldShort` | O trabalhador não autorizou a partilha do IBAN. | The worker has not consented to sharing their IBAN. |
| `proofLead` | Anexa o  | Attach the  |
| `proofBold` | comprovativo | proof of payment |
| `proofRest` |  (recibo do banco ou captura do MB WAY). Fica associado a este turno e é o que resolve a disputa se o trabalhador reportar que não recebeu. |  (bank receipt or MB WAY screenshot). It is attached to this shift and is what settles the dispute if the worker reports they were not paid. |
| `noProofPrompt` | Sem comprovativo? Explica porquê — fica registado e visível em caso de disputa. | No proof? Explain why — it is recorded and visible if there is a dispute. |
| `noProofPlaceholder` | Ex.: pagamento feito por terceiro, recibo indisponível | E.g. paid by a third party, receipt unavailable |
| `markPaidSubmit` | ✓ Confirmar pagamento | ✓ Confirm payment |
| `sending` | A enviar… | Sending… |
| `genericRetry` | Erro — tenta novamente. | Something went wrong — please try again. |
| `adjustTitle` | Ajustar horas trabalhadas | Adjust hours worked |
| `problemTitle` | Reportar problema no turno | Report a problem with this shift |
| `wageModalSub` | {{shift}} · {{date}} · atual: €{{amount}} | {{shift}} · {{date}} · current: €{{amount}} |
| `adjustLead` | Quantas horas trabalhou realmente?  | How many hours did they actually work?  |
| `adjustBold` | Mínimo 2 horas | Minimum 2 hours |
| `adjustRest` |  (política de turno terminado antecipadamente). O valor e o Pay Link são recalculados e o trabalhador é notificado. |  (early-finish policy). The amount and the Pay Link are recalculated and the worker is notified. |
| `adjustPlaceholder` | Ex.: 3.5 | E.g. 3.5 |
| `problemLead` | Descreve o que aconteceu (ex.: o trabalhador abandonou o turno a meio). O ciclo de lembretes de pagamento fica  | Describe what happened (e.g. the worker left halfway through). The payment reminder cycle is  |
| `problemBold` | pausado | paused |
| `problemRest` |  enquanto a equipa Turnos analisa (até 48h). |  while the Turnos team reviews it (up to 48h). |
| `adjustNotePlaceholder` | Motivo (opcional) | Reason (optional) |
| `problemNotePlaceholder` | Descrição do problema (obrigatório) | Description of the problem (required) |
| `adjustSubmit` | Ajustar e recalcular | Adjust and recalculate |
| `problemSubmit` | Reportar problema | Report problem |
| `cancelTitle` | Cancelar turno preenchido | Cancel a filled shift |
| `cancelSub` | {{shift}} · {{date}} · {{time}} | {{shift}} · {{date}} · {{time}} |
| `under3h1` | ⚠️ Faltam menos de  | ⚠️ Less than  |
| `under3hBold1` | 3 horas | 3 hours |
| `under3h2` |  para o início. Se o cancelamento for por erro/decisão da empresa, deves pagar o  |  until it starts. If you are cancelling because of a company error or decision, you must pay the  |
| `under3hBold2` | mínimo de 2 horas (€{{amount}}) | minimum of 2 hours (€{{amount}}) |
| `under3h3` |  ao trabalhador + a taxa normal de 3€. Motivos justificados são avaliados pela Turnos em até 48h. |  to the worker plus the usual €3 fee. Justified reasons are reviewed by Turnos within 48h. |
| `reasonLabel` | Motivo do cancelamento | Reason for cancelling |
| `erroEmpresaTag` | 2h mín. + 3€ | 2h min. + €3 |
| `cancelNotePlaceholder` | Descrição (opcional, recomendado para motivos justificados) | Description (optional, recommended for justified reasons) |
| `under24h` | ⏳ Faltam menos de 24 horas. O cancelamento é gratuito mas fica registado na fiabilidade da empresa. O trabalhador será notificado com um pedido de desculpas. | ⏳ Less than 24 hours to go. Cancelling is free but is recorded against your company reliability. The worker will be notified with an apology. |
| `over24h` | ✓ Faltam mais de 24 horas — cancelamento gratuito. O trabalhador será notificado com um pedido de desculpas e o turno reabre para outros workers. | ✓ More than 24 hours to go — cancelling is free. The worker will be notified with an apology and the shift reopens to other workers. |
| `cancelSubmit` | Cancelar turno | Cancel shift |
| `cancelling` | A cancelar… | Cancelling… |

---

Catalogue totals: **1050 keys** in each language, verified no drift.
