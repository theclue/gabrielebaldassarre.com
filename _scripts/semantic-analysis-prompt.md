# LLM Agent: Deep Semantic Attribute Compilation
#
# Questo file contiene le istruzioni per un agente LLM che analizza
# un articolo del blog e produce il blocco `difficulty_computed.semantic`
# da iniettare nel front matter YAML a tempo di authoring.
#
# L'agente viene eseguito come parte della pipeline di authoring
# (non a build time — a build time si calcolano solo le metriche lessicali).

## Task

Analizza il contenuto dell'articolo fornito e produci un oggetto JSON
con le seguenti metriche semantiche. NON includere testo prima o dopo il JSON.

## Output JSON Schema

```json
{
  "difficulty_computed": {
    "semantic": {
      "concept_count": 14,
      "concept_density": 1.75,
      "jargon_ratio": 4.2,
      "definition_coverage": 0.64,
      "external_knowledge_demand": 5,
      "prerequisite_depth": 2.1
    }
  }
}
```

## Definizione delle metriche

### concept_count (integer)
Numero totale di concetti unici presenti nell'articolo che appartengono
al dominio di conoscenza specialistico. Un "concetto" è un'idea, una
tecnologia, un framework, un termine tecnico che richiede conoscenza
pregressa per essere compreso.

Esempi: "Schema.org", "GitHub Actions", "Lighthouse CI", "JSON-LD",
"web vitals", "PageSpeed Insights", "IndexNow", "microformati".

NON contare:
- Concetti spiegati inline nell'articolo stesso (sono definiti, non presupposti)
- Termini generici del linguaggio comune
- Nomi propri di persone o aziende (a meno che non siano concetti tecnici)

### concept_density (float, 1 decimale)
`concept_count / numero_paragrafi`

Dove "numero_paragrafi" è il numero di blocchi di testo separati da
righe vuote (escludendo codice, liste, citazioni).

### jargon_ratio (float, 1 decimale)
`(numero_termini_tecnici / numero_parole_totali) * 100`

I termini tecnici includono: acronimi (API, SEO, JSON, YAML, CI/CD),
nomi di tecnologie specifiche (Kubernetes, Docker, Jekyll), termini
scientifici domain-specific (entropia, autovettore, manifold).

### definition_coverage (float, 2 decimali, 0.0–1.0)
`concetti_definiti_inline / concept_count`

Dove "concetti definiti inline" sono i concetti che l'articolo
spiega o definisce nel proprio corpo testo (con una frase come
"X è...", "X significa...", "X, ovvero...", "X è un...").

0.0 = nessun concetto viene spiegato (il lettore deve già sapere tutto).
1.0 = ogni concetto è definito nell'articolo.

### external_knowledge_demand (integer)
Numero di concetti che NON sono definiti inline E NON sono linkati
a una risorsa esterna (glossario, Wikipedia, documentazione).
Questi sono i concetti che il lettore deve "sapere già" senza alcun aiuto.

### prerequisite_depth (float, 1 decimale)
Profondità media stimata nel grafo delle dipendenze dei concetti.
Per ogni concetto, stima quanti "salti" di conoscenza servono per
arrivare a un fondamento accessibile a un principiante.

Scala:
- 0 = conoscenza comune (es. "browser", "sito web")
- 1 = conoscenza tecnica di base (es. "HTML", "CSS")
- 2 = conoscenza intermedia (es. "Git", "API REST")
- 3 = conoscenza avanzata (es. "CI/CD", "GraphQL")
- 4+ = conoscenza specialistica (es. "ERGM", "manifold learning")

La prerequisite_depth è la media di questi valori per tutti i concetti.

## Regole di analisi

1. **Leggi TUTTO il contenuto** — non limitarti ai primi paragrafi.
2. **Il codice e i listati YAML/JSON NON contano come testo** per il
   conteggio parole e paragrafi. Saltali.
3. **I link esterni sono un segnale**: se un concetto è linkato a
   Wikipedia o a documentazione ufficiale, è meno probabile che sia
   "external_knowledge_demand".
4. **Il glossario interno**: se il sito ha un glossario (URL che
   iniziano con `/glossario/`), i concetti linkati al glossario sono
   considerati "definiti".
5. **Sii conservativo**: in caso di dubbio su un termine, non contarlo
   come concetto. Meglio sottostimare che sovrastimare.

## Esempio

Articolo: tutorial su GitHub Actions per Jekyll.
- concept_count: 8 (GitHub Actions, Jekyll, YAML, CI/CD, workflow,
  deployment, Cloudflare Pages, SEO)
- concept_density: 8/12 = 0.67
- jargon_ratio: ~3.5
- definition_coverage: 5/8 = 0.63 (5 spiegati inline, 3 presupposti)
- external_knowledge_demand: 2 (CI/CD e SEO non spiegati né linkati)
- prerequisite_depth: 2.1 (media tra concetti intermediate e advanced)

## Formato risposta

Rispondi ESCLUSIVAMENTE con il JSON. Nessun markdown, nessun commento,
nessun testo prima o dopo. Il JSON deve essere valido e parseable.
