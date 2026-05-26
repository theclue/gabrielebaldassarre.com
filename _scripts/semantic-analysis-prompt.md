# LLM Agent: Deep Semantic Attribute Compilation
#
# Questo file contiene le istruzioni per un agente LLM che analizza
# un articolo del blog e produce:
#   1. Il blocco `difficulty_computed.semantic` (metriche quantitative)
#   2. Il blocco `knowledge_prerequisites` (prerequisiti con grounding ontologico)
#
# L'agente viene eseguito nella pipeline di authoring. A build time,
# il plugin difficulty.rb fonde questi dati con le metriche lessicali
# (Gulpease, etc.) e ricalcola il composito. Il termsdictionary viene
# popolato automaticamente a build time pescando dai knowledge_prerequisites
# di tutti i post, deduplicando per campo `concept`.

## Task

Analizza il contenuto dell'articolo fornito e produci un oggetto JSON
con DUE sezioni: `difficulty_computed.semantic` e `knowledge_prerequisites`.
NON includere testo prima o dopo il JSON.

## Output JSON Schema

```json
{
  "difficulty_computed": {
    "semantic": {
      "concept_count": 12,
      "concept_density": 1.3,
      "jargon_ratio": 4.5,
      "definition_coverage": 0.42,
      "external_knowledge_demand": 4,
      "prerequisite_depth": 2.1,
      "math_density": 0.2,
      "code_density": 3.5,
      "blocking_prerequisite_count": 3
    }
  },
  "knowledge_prerequisites": [
    {
      "concept": "home-assistant",
      "label": "Home Assistant",
      "url": "https://www.home-assistant.io/",
      "sameAs": "https://www.wikidata.org/wiki/Q5731200",
      "importance": "required",
      "depth": 2
    },
    {
      "concept": "jinja2",
      "label": "Jinja2",
      "url": "https://jinja.palletsprojects.com/",
      "sameAs": "https://www.wikidata.org/wiki/Q1683625",
      "importance": "recommended",
      "depth": 2
    },
    {
      "concept": "fotometria",
      "label": "Fotometria",
      "url": "https://it.wikipedia.org/wiki/Fotometria",
      "sameAs": "https://www.wikidata.org/wiki/Q189405",
      "importance": "required",
      "depth": 3
    }
  ]
}
```

## Sezione 1: difficulty_computed.semantic

### concept_count (integer)
Numero totale di concetti unici presenti nell'articolo che **NON sono
definiti inline**. Un "concetto" è un'idea, una tecnologia, un framework,
un termine tecnico che richiede conoscenza pregressa.

NON contare:
- Concetti spiegati inline (con frasi come "X è...", "X significa...",
  "X, ovvero...", "X è un...")
- Termini generici del linguaggio comune
- Nomi propri di persone o aziende (a meno che non siano concetti tecnici)
- **IMPORTANTE**: conta solo i concetti che il lettore DEVE già conoscere.
  Se l'articolo spiega il concetto, questo NON va in concept_count
  (va invece in definition_coverage come "definito").

Tutti i concetti identificati — sia definiti inline che non — devono
essere elencati nella sezione `knowledge_prerequisites` con la loro
classificazione di importanza (vedi sotto).

### concept_density (float, 1 decimale)
`concept_count / numero_paragrafi`

Dove "numero_paragrafi" è il numero di blocchi di testo in prosa
separati da righe vuote. **Escludi**: codice sorgente, listati
YAML/JSON/TOML, liste puntate, citazioni, formule matematiche su
riga propria. **Includi**: introduzioni a blocchi di codice,
spiegazioni di formule, didascalie di immagini.

### jargon_ratio (float, 1 decimale)
`(numero_termini_tecnici / numero_parole_totali_in_prosa) * 100`

I termini tecnici includono: acronimi (API, SEO, JSON, YAML, CI/CD,
CRI, COB), nomi di tecnologie specifiche (Kubernetes, Docker, Jekyll,
Home Assistant, Jinja2), termini scientifici domain-specific (entropia,
autovettore, manifold, fotometria, view factor, irradianza, isotropo).

**Le parole nel codice sorgente e nei listati NON contano** nel totale
parole in prosa. Conta solo la prosa narrativa.

### definition_coverage (float, 2 decimali, 0.0–1.0)
`concetti_definiti_inline / numero_totale_concetti_identificati`

Dove "numero_totale_concetti_identificati" è la somma di TUTTI i
concetti dell'articolo (quelli in `concept_count` + quelli spiegati inline).

0.0 = nessun concetto viene spiegato.
1.0 = ogni concetto è definito nell'articolo.

### external_knowledge_demand (integer)
Numero di concetti che NON sono definiti inline E NON sono linkati
a una risorsa esterna (Wikipedia, documentazione ufficiale, glossario).
Questi sono i concetti che il lettore deve "sapere già" senza aiuti.

**Nota**: concetti che l'LLM arricchisce con `sameAs` Wikidata NON
vanno sottratti da external_knowledge_demand (quel link non è presente
nel testo dell'articolo, è un'arricchimento dell'agente).

### prerequisite_depth (float, 1 decimale)
Media pesata della profondità nel grafo delle dipendenze di TUTTI
i concetti identificati (sia definiti che non).

Scala:
- 0 = conoscenza comune (es. "browser", "sito web", "finestra")
- 1 = conoscenza tecnica di base (es. "HTML", "CSS", "file", "URL")
- 2 = conoscenza intermedia (es. "Git", "API REST", "YAML", "JSON", "Zigbee")
- 3 = conoscenza avanzata (es. "CI/CD", "GraphQL", "fotometria", "irradianza")
- 4+ = conoscenza specialistica (es. "ERGM", "manifold learning", "view factor")

### math_density (float, 1 decimale) — NUOVO
`(numero_formule_matematiche / numero_paragrafi) * 10`

Conta le formule matematiche in notazione LaTeX (es. `$$...$$` o `$...$`),
escludendo quelle puramente decorative. Una formula conta come 1 se è
un'equazione completa, non ogni simbolo.

### code_density (float, 1 decimale) — NUOVO
`(righe_di_codice / righe_totali_articolo) * 10`

Conta le righe dentro blocchi di codice (```). Una densità alta indica
un articolo tecnico-pratico.

### blocking_prerequisite_count (integer) — NUOVO
Numero di prerequisiti con `importance: "required"` nella sezione
`knowledge_prerequisites`. Indica quanti concetti sono bloccanti
per la comprensione o il completamento dell'articolo.

## Sezione 2: knowledge_prerequisites

Per OGNI concetto identificato nell'articolo (sia definito inline che
presupposto), produci un entry nell'array `knowledge_prerequisites`.

### concept (string, required)
Identificativo canonico del concetto, in lowercase kebab-case.
Usa un nome coerente con il termsdictionary del blog.
Esempi: `"home-assistant"`, `"jinja2"`, `"api-rest"`, `"fotometria"`,
`"zigbee"`, `"cri-color-rendering-index"`, `"cob-chip-on-board"`.

### label (string, required)
Etichetta human-readable. Usa la forma più comune nella letteratura
tecnica italiana o inglese, coerentemente con la lingua dell'articolo.
Esempi: `"Home Assistant"`, `"Jinja2"`, `"API REST"`, `"Fotometria"`.

### url (string, optional)
URL di una risorsa esterna che definisce il concetto. Usa nello
specifico (in ordine di preferenza):
1. Link già presente nell'articolo (es. `[Adaptive Lighting](https://github.com/...)`)
2. Link alla documentazione ufficiale del tool/tecnologia
3. Link a Wikipedia in italiano (se l'articolo è in italiano)
4. Link a una risorsa autorevole (MDN, W3C, NIST, NASA, etc.)

Se non esiste una risorsa adeguata, ometti il campo.

### sameAs (string, optional)
URL Wikidata del concetto (es. `"https://www.wikidata.org/wiki/Q5731200"`).
Cerca il Q-item corretto su wikidata.org. Se non esiste un'entità Wikidata
adeguata, ometti il campo.

### importance (string, required)
Classifica l'importanza del prerequisito per la fruizione dell'articolo:
- `"required"`: **Bloccante**. Senza questo concetto, l'articolo NON
  può essere compreso o completato. Il lettore si blocca.
  Esempio: "Home Assistant" in un tutorial HA, "Jinja2" in un articolo
  che scrive template Jinja2 complessi.
- `"recommended"`: **Importante ma non bloccante**. Senza il concetto
  si perde parte della comprensione, ma l'articolo è ancora fruibile.
  Esempio: "Zigbee" in un articolo HA (capisci comunque i sensori).
- `"helpful"`: **Arricchimento**. L'articolo è pienamente comprensibile
  senza, ma conoscere il concetto aggiunge profondità.
  Esempio: "librazione" nell'articolo di astrometria (è un termine
  astronomico citato una volta, l'articolo funziona senza conoscerlo).

**Regola empirica**: chiediti "se tolgo questo concetto dalla mente
del lettore, l'articolo è ancora utile?". Se sì → `recommended` o
`helpful`. Se no → `required`.

### depth (integer, required)
Profondità del prerequisito nel grafo della conoscenza, stessa scala
di `prerequisite_depth`:
- 0 = conoscenza comune
- 1 = conoscenza tecnica di base
- 2 = conoscenza intermedia
- 3 = conoscenza avanzata
- 4+ = conoscenza specialistica

## Regole di analisi

### 1. Leggi TUTTO il contenuto
Non limitarti ai primi paragrafi. Scansiona l'intero articolo.

### 2. Il codice e le formule sono segnali semantici
**NON contarli** per il conteggio parole/paragrafi (vanno esclusi),
ma **USALI** per:
- Stimare la densità tecnica (`code_density`, `math_density`)
- Identificare concetti menzionati nel codice (es. nomi di API,
  librerie, formati, protocolli)
- Capire la profondità tecnica dell'articolo
- Individuare prerequisiti impliciti (es. se il codice usa `numpy`,
  allora "Python" e "numpy" sono prerequisiti)

### 3. I diagrammi Mermaid sono segnali semantici
Se l'articolo contiene diagrammi Mermaid (````mermaid ... ````):
- Analizza il tipo di diagramma (`flowchart`, `sequence`, `class`, etc.)
- I nomi di classi, metodi, entità nei diagrammi possono indicare concetti
- Il tipo di diagramma stesso indica il dominio (es. `er` → database,
  `class` → OOP, `architecture` → system design)

### 4. Distingui bene blocking vs non-blocking
Questa è la parte più importante. Per ogni concetto, chiediti:
- Se il lettore non conosce X, può comunque capire cosa sta facendo
  l'articolo e replicare il risultato?
- X è centrale al topic dell'articolo o è tangenziale?
- X è menzionato una volta di sfuggita o è usato ripetutamente?

Esempio: nell'articolo sulla dashboard astrometrica:
- "Home Assistant" è `required` (senza, non capisci di cosa parli)
- "Jinja2" è `recommended` (puoi copiare i template senza capirli)
- "librazione" è `helpful` (citato una volta, l'articolo funziona senza)
- "API REST" è `recommended` (serve per capire i sensori REST)

### 5. sameAs: sii preciso
Per ogni concetto, verifica su Wikidata che l'entità esista e sia
corretta. Usa l'URL completo `https://www.wikidata.org/wiki/Q...`.
Non inventare Q-item.

### 6. Coerenza con il termsdictionary
Il termsdictionary del blog viene popolato automaticamente a build time.
Usa nomi concetto coerenti con quelli già presenti. Un buon riferimento
è il file `_data/glossary.yml` per i termini già censiti, ma puoi
proporne di nuovi — saranno deduplicati a build time.

### 7. Sii conservativo sui concetti
In caso di dubbio su un termine, includilo come `helpful` piuttosto
che escluderlo del tutto. Ma non gonfiare artificialmente il
`concept_count`: questo misura solo i concetti NON definiti inline.

### 8. Il glossario interno
Se il sito ha un glossario, i concetti linkati a URL che iniziano con
`/glossario/` o che corrispondono a post interni sono considerati
"definiti" (riducono `external_knowledge_demand`).

### 9. Formule e codice: conteggio per math_density e code_density
- `math_density`: conta le formule in notazione LaTeX (`$$...$$` o `$...$`).
  Una formula multi-linea conta come 1. Una formula inline conta come 1.
- `code_density`: conta le righe dentro blocchi di codice (```).
  I blocchi multipli si sommano.

## Esempio

Articolo: tutorial su GitHub Actions per Jekyll con formule di calcolo.

```json
{
  "difficulty_computed": {
    "semantic": {
      "concept_count": 8,
      "concept_density": 0.7,
      "jargon_ratio": 3.5,
      "definition_coverage": 0.50,
      "external_knowledge_demand": 3,
      "prerequisite_depth": 2.1,
      "math_density": 0.0,
      "code_density": 4.2,
      "blocking_prerequisite_count": 3
    }
  },
  "knowledge_prerequisites": [
    {
      "concept": "github-actions",
      "label": "GitHub Actions",
      "url": "https://docs.github.com/en/actions",
      "sameAs": "https://www.wikidata.org/wiki/Q96497946",
      "importance": "required",
      "depth": 3
    },
    {
      "concept": "jekyll",
      "label": "Jekyll",
      "url": "https://jekyllrb.com/",
      "sameAs": "https://www.wikidata.org/wiki/Q17095317",
      "importance": "required",
      "depth": 2
    },
    {
      "concept": "yaml",
      "label": "YAML",
      "url": "https://it.wikipedia.org/wiki/YAML",
      "sameAs": "https://www.wikidata.org/wiki/Q281876",
      "importance": "recommended",
      "depth": 1
    },
    {
      "concept": "ci-cd",
      "label": "CI/CD",
      "url": "https://it.wikipedia.org/wiki/Continuous_integration",
      "sameAs": "https://www.wikidata.org/wiki/Q2910693",
      "importance": "required",
      "depth": 3
    },
    {
      "concept": "seo",
      "label": "SEO",
      "url": "https://it.wikipedia.org/wiki/Ottimizzazione_per_i_motori_di_ricerca",
      "sameAs": "https://www.wikidata.org/wiki/Q180711",
      "importance": "recommended",
      "depth": 2
    }
  ]
}
```

## Formato risposta

Rispondi ESCLUSIVAMENTE con il JSON. Nessun markdown, nessun commento,
nessun testo prima o dopo. Il JSON deve essere valido e parseable.
