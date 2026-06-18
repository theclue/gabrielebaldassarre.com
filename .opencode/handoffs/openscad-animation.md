# Handoff — OpenSCAD Animation System

## Stato
Discusso e approvato a livello di design. Implementazione non ancora iniziata.
Il `.scad` archetipico (`_cad/customizable-cable-grommet/`) non è stato ancora modificato.
I file `_scripts/cad/animate.py`, le regole Makefile e l'aggiornamento agent instructions
non esistono ancora.

## Decisioni prese

### Separazione GIF / MP4
- **GIF** → `assets/images/3d/<slug>-animate.gif`, build locale via `make cad`, committata.
  Referenziabile nei post con `{% cloudinary %}`.
- **MP4 anteprima** → `assets/images/3d/<slug>-animate.mp4`, build locale, gitignorata.
- **MP4 broadcast** → generato on-the-fly in CI dal workflow `broadcast-social.yml`,
  mai committato. Upload nativo su Mastodon/Bluesky.

### Convenzione `assembly(t)`
- Deprecare `assembly(explode=0, explode_distance=25)`.
- Nuova firma: `assembly(t=0, explode_distance=25)` dove `t` ∈ [0,1] è la variabile
  di animazione (iniettata da OpenSCAD via `$t`).
- Retrocompatibilità: `build.py` chiama `assembly(t=0)` per vista assemblata,
  `assembly(t=1)` per esplosa.

### Easing functions (da aggiungere al `.scad`)
```openscad
function ease_in_out(t)  = t < 0.5 ? 2*t*t : 1 - pow(-2*t + 2, 2)/2;
function ease_out(t)     = 1 - pow(1 - t, 3);
function ease_in(t)      = t * t * t;
```
Queste permettono animazioni multi-fase con curve di velocità non lineari,
gestibili interamente in OpenSCAD senza dipendenze esterne.

### Animazione multi-fase
La variabile `t` 0→1 viene suddivisa in segmenti temporali:
- Fase 1 (0→0.4): inserimento assiale con ease-out
- Fase 2 (0.4→0.5): pausa
- Fase 3 (0.5→0.85): rotazione baionetta con ease-in-out
- Fase 4 (0.85→1.0): drop nella tacca con ease-in
Ogni fase usa `min((t - start) / duration, 1)` per normalizzare il proprio
intervallo, poi una `ease_*()` per la curva di velocità.

### Regola Makefile (GIF)
```makefile
assets/images/3d/%-animate.gif: _cad/%/%.scad _scripts/cad/animate.py _scripts/cad/preview.py Makefile.common
	@mkdir -p $(dir $@)
	$(PYTHON3_BIN) _scripts/cad/animate.py --slug $* --format gif
```
Regola a dipendenza, non PHONY: make skippa se `.scad` non è cambiato.

### Qualità rendering
- `--preview` (OpenCSG, ~0.3s/frame, ~30s per 90 frame) — sufficiente per GIF/MP4
- `--render` (CGAL, ~60s/frame) — inutilizzabile per animazioni, tenuto solo per STL

## In sospeso (da decidere)

1. **Easing di default**: unico `ease_in_out` per tutte le fasi, o diversificato per tipo
   di movimento (ease-out per inserimento, ease-in-out per twist, ease-in per drop)?

2. **Frame count**: 90 (4s a 24fps) o 120 (5s)?

3. **YouTube Shorts**: richiede OAuth2 + YouTube Data API v3. Rimandare, iniziare
   con Mastodon e Bluesky?

4. **Colorscheme per GIF animate**: blueprint lineart (stesso schema dei PNG statici)
   o colorscheme nativo OpenSCAD con i colori dell'assembly?

5. **Agent instructions**: da aggiornare in `.opencode/agents/cad-author.md`
   con la nuova convenzione `assembly(t)` e le easing functions.

## Da fare (ordine)

1. Aggiornare `_scripts/cad/animate.py` (nuovo file)
2. Aggiungere regola Makefile per GIF
3. Aggiornare `cad-author.md` con `assembly(t)` + easing functions
4. Modificare `.scad` archetipico (`customizable-cable-grommet.scad`) con `assembly(t)`
5. Aggiornare `build.py` per usare `assembly(t=0/1)` invece di `explode=0/1`
6. Aggiungere step di generazione MP4 in `broadcast-social.yml`
7. Aggiungere task VS Code `CAD: Animate Current`
