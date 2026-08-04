# Perguntas Frequentes — Turnos

> Rascunho para o site e para a app. Redigido 2026-07-29 a partir do comportamento real
> do código (ADR 007, ADR 008, política de cancelamento v1.1) — não de intenções.
> **Antes de publicar:** as respostas marcadas 🔵 tocam no enquadramento jurídico e devem
> passar pelo advogado com o brief `docs/legal/pay-link-legal-brief.md`.
>
> Nota de manutenção: sempre que a política mudar, esta página muda. Um FAQ desatualizado
> num produto de conformidade é pior do que não ter FAQ.

---

## Para empresas

### O modelo

**A Turnos é uma empresa de trabalho temporário (ETT)?** 🔵
Não. A Turnos é uma plataforma tecnológica onde a sua empresa publica turnos e escolhe
diretamente quem quer contratar. Não cedemos trabalhadores, não somos a entidade
empregadora e não intermediamos a relação laboral. O contrato é entre a sua empresa e o
trabalhador.

**Então quem é o empregador?** 🔵
A sua empresa. É a sua empresa que contrata em regime MCD (Muito Curta Duração), que
comunica à Segurança Social e que paga o salário. A Turnos gera o contrato MCD
automaticamente e calcula os valores, mas a relação laboral e a responsabilidade são suas.

**A Turnos fica com uma parte do salário do trabalhador?**
Não, nunca. O trabalhador recebe o bruto por inteiro. A nossa receita é a subscrição mensal
e uma taxa fixa de 3€ por turno concluído, cobrada à empresa e faturada uma vez por mês.

**Porque é que a taxa é fixa e não uma percentagem?**
Por duas razões. A primeira é jurídica: uma comissão indexada à remuneração do trabalhador
faria a Turnos parecer um intermediário laboral, que não somos. A segunda é de incentivos:
com uma percentagem, a plataforma ganha mais quando a empresa paga mais — e a empresa acaba
por ser penalizada por pagar bem. Com uma taxa fixa, o que decide pagar ao trabalhador não
nos diz respeito.

**A Turnos chega a receber o dinheiro do salário?**
Não, em momento nenhum — nem sequer em trânsito. Mesmo quando usa o Turnos Pay Link, o
pagamento é processado diretamente na conta do trabalhador. Nunca passa por contas nossas.

### Preço

**Quanto custa?**
Turnos Starter, 45€/mês, inclui até 15 turnos ativos em simultâneo e 1 utilizador. Acresce
3€ por cada turno concluído, agregados na fatura mensal. O plano Pro (99€/mês) traz turnos
ilimitados, 5 utilizadores e baixa a taxa para 2€ por turno.

**Há período de fidelização?**
Não. Cancela quando quiser, com efeito no fim do período pago.

**Quando é que a taxa de 3€ é cobrada?**
Só quando um turno é efetivamente concluído. Turnos publicados que não sejam preenchidos,
ou cancelados com mais de 24h de antecedência, não geram taxa.

**Como recebo a fatura?**
Uma fatura mensal, emitida pela Stripe, com a subscrição e todas as taxas de turno
discriminadas linha a linha.

**Preciso de cartão para começar?**
Sim, para ativar a subscrição. Não é possível publicar turnos sem subscrição ativa.

### Publicar e preencher turnos

**Como publico um turno?**
No painel web: categoria e função, morada (geocodificada automaticamente), data e horário,
valor/hora bruto, competências e idiomas exigidos, número de vagas e método de pagamento.
O custo TSU é calculado à medida que preenche.

**Qual é a duração mínima de um turno?**
Duas horas. É também o mínimo que serve de base a qualquer pagamento devido por
cancelamento tardio.

**Como é que os trabalhadores encontram o meu turno?**
Ao publicar, enviamos notificação push aos 20 trabalhadores com melhor correspondência de
competências, por proximidade. Trabalhadores marcados como favoritos e os que têm distintivo
TOP_RATED aparecem primeiro. Se ao fim de 5 horas não houver candidaturas, é enviada uma
segunda vaga de notificações.

**Como escolho quem fica com o turno?**
Vê a lista de candidatos com perfil, avaliação, competências e a nota de apresentação que
cada um escreveu. Escolhe um. Essa pessoa recebe um convite e tem **2 horas** para aceitar.
Se não aceitar, o turno reabre automaticamente e é notificado.

**Posso pesquisar trabalhadores em vez de esperar por candidaturas?**
Sim. A pesquisa de trabalhadores permite filtrar por competência, idioma e disponibilidade.

**Posso trabalhar sempre com as mesmas pessoas?**
Sim. Adicione-as a favoritos e passam a ter prioridade nas notificações dos seus turnos.

### Pagar ao trabalhador

**Como pago ao trabalhador?**
Escolhe o método ao publicar o turno, e o trabalhador vê-o antes de se candidatar. Há três:
**Turnos Pay Link** (recomendado), **transferência bancária** e **MB WAY**.

**O que é o Turnos Pay Link?**
No fim do turno recebe um link de pagamento. Paga por cartão ou MB WAY e o dinheiro entra
diretamente na conta do trabalhador, que o recebe no IBAN em 1–2 dias úteis. O pagamento
fica confirmado automaticamente — não tem de declarar nada nem o trabalhador tem de
confirmar.

**Porque é que o valor do Pay Link é superior ao salário?**
Porque inclui a taxa de processamento do pagamento, suportada pela empresa, para que o
trabalhador receba o bruto por inteiro. O valor aparece discriminado no link.

**E se eu pagar por transferência ou MB WAY?**
Paga fora da plataforma e depois marca como pago no painel, anexando o comprovativo (recibo
do banco ou captura do MB WAY). O trabalhador é notificado e confirma que recebeu. Se não
tiver comprovativo pode declarar na mesma, mas tem de indicar o motivo — e essa ausência
fica registada, o que conta contra si numa disputa.

**Porque é que já não posso pagar em numerário?**
Um salário MCD deve deixar rasto documental. Um pagamento em numerário não deixa nada que
possa ser analisado se houver desacordo, e nesse cenário a palavra da empresa e a do
trabalhador valem o mesmo. Foi retirado em julho de 2026.

**Onde vejo o IBAN do trabalhador?**
No painel, na tira de pagamentos pendentes, se o trabalhador tiver autorizado a partilha.
Mostramos nome, IBAN e uma referência de pagamento. Se não tiver autorizado, verá uma nota a
indicá-lo — nesse caso use o Pay Link ou combine MB WAY diretamente com ele.

**Quando tenho de pagar?**
Assim que o turno termina. Enviamos lembretes às 8h, 24h e 48h. Ao fim de **72 horas** com um
salário por pagar, **a publicação de novos turnos é suspensa** até regularizar.

**O trabalhador saiu mais cedo. Tenho de pagar o turno todo?**
Não. Antes de pagar pode usar «Ajustar horas» e indicar as horas realmente trabalhadas, com
um mínimo de 2 horas. O valor e o Pay Link são recalculados e o trabalhador é notificado —
e pode contestar, por isso ajuste apenas o que corresponde à realidade.

**E se correu mal — abandono, má conduta?**
Use «Reportar problema». O ciclo de lembretes fica pausado e a equipa Turnos analisa o caso
em até 48 horas.

### Presença

**Como registo a presença?**
A sua empresa tem um código QR fixo, que imprime e afixa no local. O trabalhador lê-o à
chegada, com validação de geolocalização num raio de 200 metros.

**E o check-out?**
Não existe. O turno conclui-se automaticamente à hora agendada de fim. Foi uma decisão
deliberada: o scan de saída era esquecido com frequência e deixava turnos por fechar. Se as
horas reais foram outras, ajusta-as antes de pagar.

**E se o trabalhador não fizer o check-in?**
Pode confirmar a presença manualmente no painel. A confirmação manual fica registada no
histórico de auditoria.

### Cancelamentos e faltas

**Posso cancelar um turno?**
Sim, com regras que dependem da antecedência. Com **mais de 24h** não há qualquer penalização.
Entre **24h e 3h**, o cancelamento é registado no histórico da empresa. Com **menos de 3h**
tem de indicar um motivo: se for erro ou decisão da empresa, deve ao trabalhador o mínimo de
2 horas de salário; se for um motivo justificado, o caso vai para análise da equipa Turnos.

**Porquê pagar 2 horas por um cancelamento em cima da hora?**
Porque a essa distância do início a pessoa já organizou o dia, recusou outros turnos e
provavelmente já está a caminho. É a mesma lógica das 2 horas de duração mínima.

**E se o trabalhador faltar?**
É marcado como falta, recebe automaticamente 1 estrela e fica suspenso 30 dias. À segunda
falta é bloqueado permanentemente. Não paga a taxa de 3€ num turno em que houve falta.

**Posso avaliar o trabalhador?**
Sim, de 1 a 5 estrelas, com comentário escrito opcional visível a outras empresas. A
avaliação afeta a reputação e a prioridade nas notificações.

### Conformidade

**A Turnos trata da papelada legal?**
Geramos o contrato MCD automaticamente na aprovação do turno, calculamos a TSU e enviamos a
comunicação à Segurança Social com 24h de antecedência. A responsabilidade legal continua a
ser da sua empresa — nós automatizamos, não substituímos.

**O que é a TSU e quem a paga?**
A Taxa Social Única: 23,75% a cargo da empresa e 11% descontados ao trabalhador. A Turnos
calcula e mostra estes valores para efeitos informativos e de contabilidade, mas não retém
nem encaminha nada — a sua empresa liquida-os diretamente.

**Há limites de dias por trabalhador?**
Sim, e são bloqueantes. O regime MCD permite no máximo 35 dias por contrato e 70 dias por ano
com o mesmo empregador. Ao atingir o limite, o trabalhador deixa de se poder candidatar aos
seus turnos.

**Há limite de horas entre turnos?**
Sim: 11 horas de descanso mínimo entre turnos do mesmo trabalhador, conforme a diretiva
europeia. Também é bloqueante na candidatura.

**O que é o alerta de dependência económica?**
Se uma parte demasiado grande do rendimento de um trabalhador vier da sua empresa, sinalizamos
aos 40% e bloqueamos novas candidaturas aos 50%. Serve para evitar situações que possam ser
requalificadas como contrato de trabalho encoberto — é uma proteção para si.

---

## Para trabalhadores

**A Turnos é gratuita?**
Sim, e para sempre. Não cobramos nada ao trabalhador, não descontamos nada do salário e não
temos comissões. Quem paga a Turnos é a empresa.

**Quanto recebo?**
O valor bruto por hora que está anunciado no turno, por inteiro. Cada anúncio mostra sempre o
valor bruto/hora, como manda a Agenda do Trabalho Digno.

**Quem me paga?**
A empresa, diretamente. A Turnos nunca fica com o teu dinheiro nem o encaminha.

**Quando recebo?**
Depende do método que a empresa escolheu, e vês qual é antes de te candidatares. Com o Turnos
Pay Link o dinheiro entra na tua conta em 1–2 dias úteis depois de a empresa pagar. Por
transferência ou MB WAY, depende da empresa — mas se não pagar, nós insistimos com ela.

**E se a empresa não me pagar?**
Marcas «Não recebi» na app. O caso é sinalizado à equipa Turnos, que acompanha. Em paralelo,
a empresa recebe lembretes automáticos às 8h, 24h e 48h, e ao fim de 72 horas fica impedida
de publicar novos turnos até te pagar.

**Porque é que me pedem autorização para partilhar o IBAN?**
Porque para te pagar por transferência a empresa precisa dele. Só o mostramos às empresas
onde fizeste turnos e que ainda te devem dinheiro, e só se tiveres autorizado. Podes retirar
a autorização no teu perfil a qualquer momento — nesse caso as empresas terão de te pagar por
Pay Link ou MB WAY.

**O que é o Turnos Pay Link e tenho de o ativar?**
É a forma mais rápida e segura de receberes: a empresa paga por link e o dinheiro entra
diretamente na tua conta bancária. Ativas uma vez, em cerca de 3 minutos, verificando a
identidade e o IBAN com a Stripe. Não é obrigatório, mas turnos com Pay Link pagam-te sem
teres de andar atrás da empresa.

**Que contrato tenho?**
Contrato MCD — Muito Curta Duração — com a empresa onde fazes o turno. É gerado
automaticamente e comunicado à Segurança Social.

**Tenho de passar recibo verde?**
Não. O MCD é um contrato de trabalho, não prestação de serviços.

**E os descontos para a Segurança Social?**
São 11% sobre o bruto, descontados pela empresa. Mostramos-te sempre o cálculo para saberes o
que esperar. A empresa contribui ainda com 23,75% por cima.

**Há limite de dias que posso trabalhar?**
Sim: 35 dias por contrato e 70 dias por ano com a mesma empresa, e 11 horas de descanso entre
turnos. Avisamos-te antes de chegares ao limite, e a partir daí não te podes candidatar a
turnos dessa empresa.

**Como me inscrevo?**
Descarregas a app, entras com o teu número de telemóvel e preenches o perfil em 4 passos:
identidade e foto, dados legais (NIF e IBAN), competências e idiomas, e disponibilidade. O
perfil tem uma pontuação de qualidade e precisa de pelo menos 80 pontos para ir a aprovação.

**Quanto tempo demora a aprovação?**
A equipa Turnos revê o teu perfil manualmente. Quanto mais completo estiver — foto, NIF, IBAN,
pelo menos 3 competências e disponibilidade — mais rápido é.

**Como me candidato a um turno?**
Vês o turno no feed ou no mapa, com a distância, o horário e o valor bruto/hora. Candidatas-te
com um toque e podes juntar uma nota curta de apresentação.

**Fui escolhido. E agora?**
Recebes uma notificação e tens **2 horas** para aceitar ou recusar. Se não responderes, o
turno reabre para outros.

**Como marco presença?**
Lês o código QR da empresa quando chegas. Tens de estar a menos de 200 metros do local. Não há
leitura de saída — o turno fecha sozinho à hora prevista.

**Posso cancelar um turno que aceitei?**
Podes, mas com consequências. Com **mais de 24h** de antecedência não há penalização. Com
**24h ou menos** recebes um aviso; dois avisos em 30 dias suspendem-te por 7 dias. Se tiveres
um motivo sério — doença, emergência — indica-o, e a equipa analisa.

**O que acontece se eu faltar?**
Recebes 1 estrela automaticamente e ficas suspenso 30 dias. À segunda falta, a conta é
bloqueada. Se não vais conseguir ir, cancela — cancelar é sempre melhor do que faltar.

**A empresa reduziu as minhas horas. Posso contestar?**
Sim. Recebes uma notificação com o valor antigo e o novo. Se não concordas, contesta na app ou
escreve para o suporte. A empresa não pode descer abaixo de 2 horas.

**As empresas veem as minhas avaliações?**
Sim — a média, o número de avaliações, os distintivos e os comentários escritos. As tuas
avaliações às empresas são internas e nunca são mostradas a ninguém.

**O que são os distintivos?**
TOP_RATED (média igual ou superior a 4,5 com pelo menos 10 avaliações), FIÁVEL (nenhuma falta,
mais de 90% de turnos concluídos e pelo menos 20 avaliações) e VERIFICADO (perfil aprovado).
Dão-te prioridade nas notificações de novos turnos.

**Onde vejo o que já ganhei?**
No separador Ganhos, por dia, mês ou ano, com o histórico de todos os turnos e o estado de
pagamento de cada um.
