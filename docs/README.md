# Scrittura assistita e profilo autoriale

Questa directory raccoglie la documentazione del sistema di scrittura assistita e del profilo autoriale usato in OpenCode.

## Flusso quotidiano per l'autore

Non occorre eseguire script manuali o preparare file JSON: i comandi OpenCode compilano e iniettano il profilo autoriale direttamente in memoria per la sessione attiva, senza lasciare file temporanei o ricevute sul filesystem.

1. **Creare un nuovo articolo o bozza Markdown:**
   ```text
   /create-post una bozza tutorial su come modellare una matita parametrica in OpenSCAD, per principianti
   ```
   Compila il runtime autoriale in memoria da `docs/author-pattern-results/v1.3/author-model.json`, crea il file tramite Rake (in `_drafts/` per impostazione predefinita), inietta le direttive nella sessione e scrive l'articolo.

2. **Revisionare un articolo esistente:**
   ```text
   /revise-post _drafts/mio-articolo.md Rivedi l'apertura e rendi più scorrevole la transizione verso il codice.
   ```
   Attiva il runtime autoriale in memoria sul file esistente senza creare snapshot o report intermedi su disco.

3. **Annotare semanticamente, gestire immagini e preparare il copy social:**
   ```text
   /annotate-post _drafts/mio-articolo.md
   ```
   Valida i prerequisiti concettuali tramite `wikidata_oracle`, converte link e immagini nei tag Liquid del sito (`{% xlink %}`, `{% post_link %}`, `{% cloudinary %}`), cattura eventuali screenshot in `assets/images/posts/<slug>/`, seleziona un'immagine hero da Unsplash se `master:` è assente e prepara le bozze social per LinkedIn e Mastodon.

4. **Creare un articolo R Markdown (`.Rmd`):**
   ```text
   /create-rmd un'analisi in bozza sulle reti scale-free nella categoria Reti Sociali
   ```
   Genera il file `.Rmd`, che può poi essere convertito in `.md` con `rake knit["<percorso>.Rmd"]` o `make knitr`.

## Organizzazione degli asset immagine

Tutte le immagini del sito seguono una struttura ordinata sotto `assets/`:
- `assets/images/site/`: asset globali del sito, avatar e copertine delle pagine di categoria.
- `assets/images/posts/<slug>.<ext>`: immagini di copertina (`master` / `overlay_image`) degli articoli.
- `assets/images/posts/<slug>/`: immagini del corpo articolo, screenshot e illustrazioni specifiche del post o della serie.
- `assets/images/diagrams/`: diagrammi SVG generati da script R (`R/diagrams/*.R`).
- `assets/images/3d/` e `assets/3d/<slug>/`: anteprime ed esportazioni STL/3MF generate da OpenSCAD (`_cad/<slug>/`).
- `assets/figures/`: grafici SVG generati dal knit dei file `.Rmd`.

## Verifiche automatiche

Dalla radice del repository:

```sh
npm --prefix _scripts/author-extraction test
npm --prefix _scripts/author-extraction run test:integration
node --test _scripts/wikidata-integration/index.test.mjs
python3 _scripts/ci/validate_assets.py --all
```

## Documentazione di riferimento

- [Guida ai comandi `/create-post` e `/revise-post`](post-authoring.md)
- [Compilatore runtime autoriale in memoria](author-runtime.md)
- [Convenzioni degli identificatori](author-identifiers.md)
- [Integrazione Wikidata Oracle](wikidata-oracle-e2e.md)
- [Modellazione CAD assistita](assisted-cad-modeling-method.md)
