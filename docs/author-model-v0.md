# Modello descrittivo dello stile — v0

## Scopo e stato

Questo documento raccoglie ipotesi descrittive emerse da una lettura bottom-up del corpus approvato, come base da discutere per un eventuale avatar futuro. Non è un prompt, una specifica normativa né un modello già approvato dall'utente. I tratti sotto sono osservazioni qualitative: le citazioni documentano esempi presenti, non dimostrano che siano invarianti o esclusivi.

Il corpus e l'ambito dell'approvazione editoriale sono registrati in [`corpus.yaml`](corpus.yaml). Comprendono dodici markdown in `_posts`, indicati dall'utente come rappresentativi del proprio stile. Questo consenso editoriale non attesta autorialità umana esclusiva, assenza di AI o coautorialità. La revisione utente del modello generato è **pending**.

## Ipotesi descrittive candidate

### 1. Spiegazione che può partire da intuizione, domanda o esempio

**Osservazione.** In alcuni testi l'apertura orienta il lettore verso un'intuizione, pone una domanda concreta o introduce un esempio prima dello sviluppo formale.

- **A01** — `_posts/reti-sociali/2018-07-13-introduzione-autovettori-autovalori.md`, introduzione, r. 15:

  > Senza la pretesa di fornire una trattazione rigorosa sull'argomento come se dovessimo preparare un esame di algebra lineare, qui ci concentreremo sull'intuizione dei concetti fondamentali

- **A04** — `_posts/fisica/2019-09-18-logica-quantistica.md`, introduzione, r. 15:

  > Supponiamo di avere il sistema _Lancio di un dado_. Questo sistema può trovarsi in uno di sei possibili stati:

- **A10** — `_posts/home-assistant/2026-05-10-dashboard-astrometria-parte-1.md`, introduzione, r. 36:

  > Tutto è partito da una domanda banale: *posso sapere dalla mia dashboard di Home Assistant in che fase è la Luna stasera?*

**Variante / limite.** L'avvio può anche essere definitorio e diretto, come in **A08**, `_posts/fisica/2021-05-06-elettronvolt.md`, introduzione, r. 11:

> L'elettronvolt (simbolo eV) è un'unità di misura dell'energia particolarmente adatta, per via del suo valore, a misurarne i valori su scale atomiche e subatomiche.

Quindi l'apertura intuitiva è una possibilità osservata, non una regola per ogni testo.

### 2. Voce personale e conversazionale; ironia ricorrente secondo il feedback autoriale

**Osservazione nel corpus.** I passaggi già citati mostrano una voce personale o conversazionale; in **A12** compare un richiamo ironico. Questi esempi sono compatibili con il feedback autoriale riportato sotto, ma da soli non ne misurano la frequenza.

- **A05** — `_posts/fisica/2019-10-04-spazio-stati-quantistici.md`, introduzione, r. 17:

  > Gli elettroni fanno quello che gli elettroni fanno. Ed è del tutto logico e normale (dal loro punto di vista).

- **A11** — `_posts/devops/2026-05-16-seo-automatico-jekyll.md`, introduzione, r. 43:

  > Così, oggi mi sono detto: perché non automatizziamo anche la componente SEO?

- **A12** — `_posts/devops/2026-05-27-una-shell-history-per-ogni-progetto.md`, introduzione, r. 112:

  > Sull'entropia dell'Universo ci stiamo ancora lavorando, ma riguardo l'history della shell qualcosa in più possiamo farla.

**Integrazione dal feedback dell'autore.** L'autore descrive l'ironia come ricorrente ma non onnipresente né sfacciata: delicata, non da social network né da memeficazione. Indica i richiami alla cultura di genere (fantasy, fantascienza, comics e *Il Signore degli Anelli*) come modo per creare empatia con chi visita il blog per studiare. Spiega inoltre «buon, vecchio...» come richiamo, in tono leggero, divertito, metaforico e affettuoso, alla genuinità della vecchia scuola e dei bei tempi, e cita «il buon vecchio elettrone», «la nostra vecchia amica meccanica razionale» e Linus/Charlie Brown. Queste sono precisazioni autoriali, non frequenze calcolate né tratti dimostrati dalle citazioni del corpus già riportate; non implicano un obbligo di inserire ironia o richiami culturali in ogni testo.

### 3. Qualificazioni e limiti espliciti

**Osservazione.** In alcuni passaggi le affermazioni vengono circoscritte o accompagnate da un limite; i limiti possono riguardare la portata di una generalizzazione o il comportamento di una soluzione.

- **A03** — `_posts/reti-sociali/2018-08-12-legge-potenza-powerlaw.md`, r. 47:

  > Tuttavia, molto raramente una grandezza segue una power law sull'_interezza_ delle misure che assume.

- **A03**, stesso testo, r. 49:

  > Non è quindi una affermazione da fare alla leggera!

- **A09** — `_posts/home-assistant/2026-05-09-illuminanza-smartworking-home-assistant.md`, § «Quanta luce artificiale serve? Un controllo feedforward», r. 337:

  > È un controllo **feedforward**: efficiente e senza oscillazioni, ma che non si autocorregge se il modello è impreciso.

- **A11** — `_posts/devops/2026-05-16-seo-automatico-jekyll.md`, r. 337:

  > L'audit pre-deploy soffrirebbe di falsi positivi.

**Interpretazione prudente.** Esplicitare condizioni o limiti è un tratto candidato quando serve a delimitare il ragionamento; queste occorrenze non ne provano la presenza in ogni articolo né la correttezza fattuale delle affermazioni citate.

### 4. Nei tutorial tecnici, motivare dettagli e casi limite

**Osservazione circoscritta.** In alcuni testi tecnici del corpus, un dettaglio implementativo è accompagnato dalla ragione pratica o dall'effetto del caso limite.

- **A09** — `_posts/home-assistant/2026-05-09-illuminanza-smartworking-home-assistant.md`, § «Il modello fisico: soleggiamento», r. 286:

  > Un dettaglio non banale: il calcolo di `delta_azimut` deve usare la distanza angolare minima sul cerchio, non il valore assoluto della differenza.

- **A10** — `_posts/home-assistant/2026-05-10-dashboard-astrometria-parte-1.md`, § «Il REST sensor per il disco lunare», r. 126:

  > Questo evita che il sensore vada in `unavailable` durante l'avvio di HA, sporcando il log di avvio.

- **A12** — `_posts/devops/2026-05-27-una-shell-history-per-ogni-progetto.md`, § «Lo switch: il cambio di history al volo», r. 241:

  > **`touch "$histfile"`** è necessario perché `fc -W` di ZSH non crea file inesistenti — se il progetto è nuovo di zecca, senza `touch` la prima scrittura andrebbe persa.

È un'osservazione legata agli esempi pratici citati, non una generalizzazione su tutti i generi del corpus.

### 5. Rendere espliciti alcuni passaggi tra concetto, modello e conseguenza

**Osservazione.** In esempi di argomentazione teorica e applicata, il testo collega esplicitamente un elemento a ciò che descrive o permette di concludere. Il nesso è qui considerato una caratteristica dell'organizzazione del discorso, non una tassonomia formale.

- **A07** — `_posts/meccanica/2019-10-31-spazio-degli-stati.md`, introduzione, r. 23:

  > Lo spazio generato da questo prodotto cartesiano descrive ogni possibile stato dinamico del sistema e prende il nome, per l'appunto, di spazio degli stati o __spazio delle fasi__.

- **A01** — `_posts/reti-sociali/2018-07-13-introduzione-autovettori-autovalori.md`, § «Autovettori e Social Network Analysis», r. 181:

  > E questa matrice è, tipicamente, _non singolare_ quindi ammette un'inversa e, quindi, _su di essa è possibile calcolare gli autovalori e gli autovettori_.

- **A09** — `_posts/home-assistant/2026-05-09-illuminanza-smartworking-home-assistant.md`, § «Quanta luce artificiale serve? Un controllo feedforward», r. 337:

  > Qui invece l'illuminamento reale non è mai misurato e non entra mai nel calcolo (che, poi, era la premessa dell'articolo!): si misura solo la **perturbazione** (la luce naturale stimata), e si usa un **modello del processo** (i lumen noti delle lampade) per calcolare preventivamente l'azione correttiva.

Questo tratto può dipendere dall'argomento e dalla necessità di spiegare una derivazione; non è assunto come segnale distintivo o sempre presente. Le citazioni riportano il testo come scritto e non costituiscono verifica indipendente delle sue affermazioni tecniche o scientifiche.

## Pattern confermati dall'autore

I due pattern seguenti sono stati confermati esplicitamente dall'autore. Le citazioni sono passaggi osservabili compatibili con ciascun pattern; non attestano che sia presente in ogni testo e non costituiscono verifica indipendente delle affermazioni tecniche.

### Giustificare un intervento: problema → effetto → intervento

**Passaggi osservati.** In **A03** il rumore statistico sulla coda è collegato a una sottostima e viene poi descritto un modo diverso di costruire e normalizzare gli intervalli. In **A12** una sequenza di comandi è motivata attraverso l'effetto indesiderato che risolve.

- **A03** — `_posts/reti-sociali/2018-08-12-legge-potenza-powerlaw.md`, § «Individuare una distribuzione _power law_», rr. 60–62:

  > Il problema è serio: andando a costruire su quel campione un modello di regressione per stimare il modulo di \\( \alpha \\), il rumore statistico sulla coda interverrà negativamente su di esso, introducendo una forte sottostima nel coefficiente.
  >
  > Un modo più accurato consiste allora nel _variare la dimensione degli intervalli dell'istogramma con uno schema costante e normalizzare i risultati_, in modo da ottenere un conteggio _per unità di grandezza di x_. Questa operazione si chiama _non-linear binning_.

- **A12** — `_posts/devops/2026-05-27-una-shell-history-per-ogni-progetto.md`, § «Lo switch: il cambio di history al volo», r. 240:

  > La sequenza pop+push azzera la lista in-memory, risolvendo un leak subdolo per cui `fc -R`, in ZSH, **appende** i comandi a quelli già in memoria invece di sostituirli.

**Pattern confermato.** Nel descrivere un intervento, il nesso problema → effetto → intervento rende leggibile perché si cambia procedura o rappresentazione. È la formulazione del predicato confermato, non una regola universale né una valutazione dell'accuratezza tecnica degli esempi.

### Giustificare una rappresentazione rispetto a scopo, compromessi e costi

**Passaggi osservati.** **A09** esplicita che un'approssimazione è sufficiente in relazione allo scopo; **A03** nomina la perdita d'informazione associata alla scelta di intervalli ampi per ridurre il rumore.

- **A09** — `_posts/home-assistant/2026-05-09-illuminanza-smartworking-home-assistant.md`, § «L'illuminamento totale della stanza», r. 302:

  > La linearità brightness → lumen è un'approssimazione (i LED non sono perfettamente lineari), ma sufficiente per questo scopo.

- **A03** — `_posts/reti-sociali/2018-08-12-legge-potenza-powerlaw.md`, § «Individuare una distribuzione _power law_», r. 71:

  > In effetti, per eliminare il rumore si è reso necessario creare degli intervalli molto ampi e questo ha comportato una notevole perdita di informazioni.

**Pattern confermato.** Esplicitare scopo e compromessi aiuta a motivare una rappresentazione o semplificazione senza presentarla come priva di costi o ottimale in assoluto. Questa è una formulazione descrittiva circoscritta ai due esempi e al predicato confermato, non una gerarchia generale tra semplicità e precisione.

**Conferma dell'autore:**

> si, ti confermo questi due predicati aggiungiamo nel file di registro autoriale

## Limiti della v0

- La lettura è qualitativa: non sono state calcolate frequenze, n-grammi, metriche stilometriche o punteggi.
- Il corpus attraversa periodi e generi diversi; periodo e argomento possono essere confusi, perciò non si inferisce un'evoluzione causale dello stile.
- Ogni citazione prova una presenza locale, non un'invariante né una caratteristica esclusiva. Le citazioni non sostituiscono il giudizio editoriale.
- Il documento descrive esempi di scrittura, ma non valuta indipendentemente l'accuratezza delle affermazioni di fisica, matematica o codice citate.
- Queste ipotesi non sono istruzioni prescrittive per generare testo e non sono un prompt per un avatar.

## Revisione umana e stato

L'autore aveva dato un riscontro complessivamente positivo:

> ok in generale ci siamo, ti segnalo che il mio stile autoriale usa piuttosto spesso il registro dell'ironia, del "buon, vecchio...", dei richiami alla cultura di genere

Ha poi contestualizzato l'ipotesi 2 con questo chiarimento, riportato integralmente:

> ok fermo ti contestualizzo. l'ironia e' ricorrente, ma non onnipresente e non è mai sfacciata. non è ironia da social network, e nemmeno memeficazione. e' in genere delicata e sfrutta citazioni alla cultura di genere (fantasy, fantascienza, comics, signore degli anelli...) per costruire empatia con il lettore, che e' sul blog per studiare. il pattern del "buon, vecchio..." riassume l'archetipo della genuinità di ciò che rappresenta la vecchia scuola, i bei tempi, ma usato con un registro leggero, divertito, metaforico es. "il buon vecchio elettrone", "la nostra vecchia amica meccanica razionale". è affettuoso, sullo stile di linus e "buon vecchio charlie brown, il più charlie brown di tutti".

I due pattern nella sezione precedente sono confermati esplicitamente dall'autore. La revisione utente complessiva del modello generato resta **pending**: questa conferma mirata non equivale all'approvazione delle cinque ipotesi candidate in blocco.
