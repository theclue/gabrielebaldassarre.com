---
category: Home Assistant
title: "Illuminanza intelligente per lo smartworking: fisica, modelli e controllo in Home Assistant"
excerpt: Come stimare l'illuminamento di un ambiente senza sensori fisici, usando la posizione del sole e la fotometria delle finestre, e come usare questa stima per automatizzare la luce ottimale quando si lavora da casa.
master: /assets/images/homeassistant-illuminanza.png
broadcast:
  channels: [linkedin, mastodon]
header:
  overlay_filter: 0.5
---

Chi lavora da casa conosce il problema: la luce cambia continuamente durante la giornata, e spesso ci si ritrova a lavorare al computer con una illuminazione inadeguata senza rendersene conto. Troppa luce crea abbagliamento sullo schermo, troppa poca affatica gli occhi. La soluzione ideale è un sistema che compensi automaticamente la luce naturale con quella artificiale, mantenendo l'illuminamento costante.

In questo articolo descrivo come ho costruito questo sistema in Home Assistant, partendo da zero sensori di luminosità fisici — che non ho — fino a una automazione che stabilizza l'illuminamento del soggiorno durante le ore di lavoro.

## Il problema: non ho sensori di luce

I sensori di illuminanza fisici esistono, costano poco e funzionano bene. Ma non mi andava di acquistarli e di aggiungere altri dispositivi alla mia già piuttosto affollata costellazione Zigbee. Ho provato, allora, a volevo capire se fosse possibile stimare l'illuminamento con quello che già avevo: la posizione geografica della mia casa, le caratteristiche geometriche delle finestre, e le integrazioni meteo già presenti in Home Assistant.

La risposta è sì, con qualche compromesso.

## Il modello fisico: soleggiamento

Il punto di partenza è `sun.sun`, l'entità built-in di Home Assistant che espone in ogni momento l'elevazione e l'azimuth del sole. A questi aggiungo un sensore di illuminanza esterna (`sensor.luminanza_esterna`) che viene da un'[integrazione](https://github.com/pnbruckner/ha-illuminance/) che ha esattamente questo scopo e misura i lux al suolo nelle condizioni meteo attuali — già corretta per la copertura nuvolosa la cui misura proviene tipicamente dall'integrazione meteo.

Il contributo della luce solare all'interno di una stanza dipende da tre fattori geometrici:

1. **L'angolo di incidenza** della luce sulla finestra
2. **La trasmittanza del vetro** ($\tau_g$)
3. **Il rapporto tra area finestra e area stanza** ($A_f / A_{room}$)

La formula per il componente diretto è quella standard della fotometria degli interni:

$$E_{dir} = E_{ext} \cdot \tau_g \cdot \cos\theta \cdot \frac{A_f}{A_{room}}$$

dove:
- $E_{ext}$ è l'illuminanza esterna al suolo in condizioni di cielo sereno (in lux, da sensore meteo)
- $\tau_g$ è la trasmittanza del vetro, ovvero la frazione di luce che attraversa il vetro (tipicamente 0.15–0.30 per doppi vetri con trattamento)
- $A_f$ è l'area della finestra in m²
- $A_{room}$ è l'area della stanza in m²
- $\cos\theta$ è l'angolo di incidenza del raggio solare sulla superficie della finestra, calcolato a partire da elevazione e azimuth del sole:

$$\cos\theta = \sin(\alpha) \cdot \cos(\beta) + \cos(\alpha) \cdot \sin(\beta) \cdot \cos(\Delta\phi)$$

con $\alpha$ = elevazione solare, $\beta$ = inclinazione della finestra (90° per una finestra verticale), $\Delta\phi$ = differenza di azimuth tra sole e normale alla finestra.

**Correzione per la copertura nuvolosa.** Il modello appena descritto assume implicitamente che la luce solare sia **direzionale**: tutti i raggi arrivano dalla stessa direzione (quella del sole) e $\cos\theta$ cattura correttamente quanto di quella luce passa attraverso la finestra. Questa ipotesi è buona sotto cielo sereno.

Sotto cielo coperto, invece, la situazione cambia radicalmente. Le nuvole diffondono la radiazione solare in tutte le direzioni: la luce non ha più una provenienza privilegiata ma arriva **isotropicamente** da tutta la volta celeste, con intensità approssimativamente uniforme su ogni direzione. Questo è il **modello di cielo diffuso isotropo** ([Liu e Jordan](https://sci-hub.mk/10.1016/0038-092x%2860%2990062-1), 1960), la formulazione più semplice e più usata per la componente diffusa: si assume che la luminanza del cielo sia la stessa in ogni punto dell'emisfero. In questo regime, il fattore geometrico rilevante non è più $\cos\theta$ — che descrive l'angolo tra il raggio direzionale e la normale alla finestra — ma il **view factor** della finestra verso il cielo: la frazione dell'emisfero celeste che la finestra "vede".

Per una finestra piana verticale con inclinazione $\beta$ rispetto all'orizzontale, il view factor verso la metà superiore dell'emisfero è un risultato standard della radiometria:

$$FV = \frac{1 + \cos\beta}{2}$$

Per una finestra verticale ($\beta = 90°$) questo vale esattamente $0.5$: la finestra vede metà cielo, e con luce isotropa raccoglie esattamente la metà dell'irradianza disponibile. Non è un'approssimazione né una costante empirica — è pura geometria.

Ora, nella realtà quotidiana il cielo è raramente completamente sereno o completamente coperto: si trova quasi sempre in uno stato intermedio. Molte integrazioni meteo, però, come dicevo offrono una stima sulla presenza di nubi. Io, per esempio, posso avvalermi del `sensor.tomorrow_io_casa_cloud_cover`, che fornisce in tempo reale la copertura nuvolosa $f_c \in [0,1]$ (0 = sereno, 1 = coperto). È naturale usarlo come peso per interpolare linearmente tra i due regimi:

$$\cos\theta_{eff} = (1 - f_c)\cdot\cos\theta + f_c \cdot 0.5$$

Quando $f_c = 0$ si recupera la formula originale, puramente direzionale. Quando $f_c = 1$ il termine $\cos\theta$ scompare del tutto e rimane solo il view factor isotropo. Per valori intermedi si ottiene una transizione continua tra i due comportamenti limite. Sempre che ci accontentiamo, come al solito, di una semplificazione lineare.

Il guadagno pratico è più evidente nelle situazioni in cui i due regimi producono risultati molto diversi: tipicamente al mattino presto o in inverno, quando il sole è basso ($\cos\theta$ piccolo) ma il cielo è parzialmente coperto — il modello senza correzione sottostimerebbe sensibilmente la luce disponibile. Al contrario, a mezzogiorno estivo con sole alto ma cielo coperto, il modello originale sovrastimerebbe. La correzione riduce l'errore in entrambe le direzioni, senza aggiungere nessun parametro da calibrare.

A questo si aggiunge un componente indiretto (luce diffusa dal cielo e riflessa dalle superfici):

$$E_{ind} = E_{ext} \cdot DF_{ind}$$

dove $DF_{ind}$ è un fattore di daylight indiretto, calibrato empiricamente in base all'ambiente.

In Jinja2 per Home Assistant, per la finestra del mio soggiorno orientata a sud (azimuth 180°), nel mio appartamento a Milano:

```jinja
{% raw %}
{% set lux_ext = states('sensor.luminanza_esterna') | float / 10 %}
{% set elev_deg = state_attr('sun.sun','elevation') | float %}
{% set azimut_sun = state_attr('sun.sun','azimuth') | float %}

{% set azimut_window = 180 %}
{% set tilt_deg = 90 %}

{% set elev_rad = elev_deg * 3.14159 / 180 %}
{% set tilt_rad = tilt_deg * 3.14159 / 180 %}
{% set delta_raw = (azimut_sun - azimut_window) | abs %}
{% set delta_azimut = [delta_raw, 360 - delta_raw] | min %}
{% set delta_azimut_rad = delta_azimut * 3.14159 / 180 %}

{% set cos_theta =
  (sin(elev_rad) * cos(tilt_rad)) +
  (cos(elev_rad) * sin(tilt_rad) * cos(delta_azimut_rad)) %}
{% set cos_theta = [cos_theta, 0] | max %}
{% set fc = states('sensor.tomorrow_io_casa_cloud_cover') | float / 100 %}
{% set cos_theta = (1 - fc) * cos_theta + fc * 0.5 %}

{% set tau_g = 0.18 %}
{% set Af = 2.7 %}
{% set A_room = 25 %}
{% set DF_indiretto = 0.005 %}

{% set lux_diretto = lux_ext * tau_g * cos_theta * (Af / A_room) %}
{% set lux_indiretto = lux_ext * DF_indiretto %}
{{ (lux_diretto + lux_indiretto) | round(0) }}
{% endraw %}
```

Un dettaglio non banale: il calcolo di `delta_azimut` deve usare la distanza angolare minima sul cerchio, non il valore assoluto della differenza. Senza questa correzione, una finestra orientata a nord (azimuth 0°) con il sole a 350° calcolerebbe un delta di 350° invece di 10°, producendo un coseno quasi nullo e un soleggiamento falsamente azzerato.

La correzione è sintetizzata in questa parte di codice:
```jinja
{% raw %}
{% set delta_raw = (azimut_sun - azimut_window) | abs %}
{% set delta_azimut = [delta_raw, 360 - delta_raw] | min %}
{% endraw %}
```

## L'illuminamento totale della stanza

Il soleggiamento è solo metà dell'equazione. L'altra metà è la luce prodotta dalle sorgenti artificiali. Io ho diverse lampadine Philips Hue dimmerabili che dichiarano esplicitamente 806 lm, quindi:

$$E_{lamp} = \frac{lm \cdot (brightness / 255)}{A_{room}}$$

La linearità brightness → lumen è un'approssimazione (i LED non sono perfettamente lineari), ma sufficiente per questo scopo. 

Per le striscie LED prese su Aliexpress, invece, ho usato un modello linearizzato che tiene conto delle caratteristiche (approssimate a dir poco) del dispositivo. A titolo d'esempio, per la striscia LED che illumina la mia zona pranzo (2 m di COB, per un totale di 960 LED CRI90, alimentati a 24VDC → ~15 W/m) la stima del flusso luminoso sarà:

$$\Phi_{LED} = 2 \, m \times 15 \, W/m \times 93 \, lm/W \approx 2800 \, lm$$

In generale e per qualsiasi tipologia di striscia LED, una volta ricavata la potenza assorbita dal dispositivo, non dovrebbe essere difficile risalire al flusso luminoso emesso (purché, ripeto, ci si accontenti della semplificazione lineare).

Il sensore finale `sensor.illuminamento_soggiorno` somma tutti i contributi:

```jinja
{% raw %}
{% set area_stanza = 25 %}
{% set lumen_per_lampadina = 806 %}
{% set lumen_led_tavolo = 2800 %}

{% set lux_sol = states('sensor.soleggiamento_soggiorno') | float %}

{% set lux_lamp_1 = (lumen_per_lampadina * (state_attr('light.lampadina_soggiorno_1', 'brightness') | float / 255) / area_stanza) if is_state('light.lampadina_soggiorno_1', 'on') and state_attr('light.lampadina_soggiorno_1', 'brightness') is not none else 0 %}
{% set lux_lamp_2 = (lumen_per_lampadina * (state_attr('light.lampadina_soggiorno_2', 'brightness') | float / 255) / area_stanza) if is_state('light.lampadina_soggiorno_2', 'on') and state_attr('light.lampadina_soggiorno_2', 'brightness') is not none else 0 %}
{% set lux_lamp_3 = (lumen_per_lampadina * (state_attr('light.lampadina_soggiorno_3', 'brightness') | float / 255) / area_stanza) if is_state('light.lampadina_soggiorno_3', 'on') and state_attr('light.lampadina_soggiorno_3', 'brightness') is not none else 0 %}
{% set lux_lamp_4 = (lumen_per_lampadina * (state_attr('light.lampadina_soggiorno_4', 'brightness') | float / 255) / area_stanza) if is_state('light.lampadina_soggiorno_4', 'on') and state_attr('light.lampadina_soggiorno_4', 'brightness') is not none else 0 %}
{% set lux_lamp_ingresso = (lumen_per_lampadina * (state_attr('light.lampadina_ingresso', 'brightness') | float / 255) / area_stanza * 0.75) if is_state('light.lampadina_ingresso', 'on') and state_attr('light.lampadina_ingresso', 'brightness') is not none else 0 %}
{% set lux_led_tavolo = (lumen_led_tavolo * (state_attr('light.led_tavolo', 'brightness') | float / 255) / area_stanza) if is_state('light.led_tavolo', 'on') and state_attr('light.led_tavolo', 'brightness') is not none else 0 %}

{{ (lux_sol + lux_lamp_1 + lux_lamp_2 + lux_lamp_3 + lux_lamp_4 + lux_lamp_ingresso + lux_led_tavolo) | round(0) }}
{% endraw %}
```

La lampadina dell'ingresso ha una particolarità: riceve, infatti, un coefficiente di abbattimento (spillover) di 0.75 perché illumina un'area attigua e non contribuisce esclusivamente al soggiorno.

## Quanta luce artificiale serve? Un controllo feedforward

La letteratura ergonomica indica 300–500 lux come range ottimale per il lavoro al videoterminale (norma [UNI EN 12464-1](https://biblus.acca.it/uni-en-12464-1-illuminazione-dei-posti-di-lavoro-interni/), che, tra le altre cose, è una vera miniera di idee per possibili espansioni di questo modello). Ho scelto 400 lux come target default, regolabile tramite un helper `input_number`, così da facilitare eventuali fine tuning successivi.

Dirò una ovvieta, ma ci tengo a far notare che questo **non è un sistema retroazionato** in senso stretto. In un vero sistema a ciclo chiuso si misurerebbe l'illuminamento effettivo della stanza con un sensore fisico, si calcolerebbe l'errore rispetto al target, e si userebbe quell'errore per correggere l'intensità delle sorgenti luminose. Qui invece l'illuminamento reale non è mai misurato e non entra mai nel calcolo (che, poi, era la premessa dell'articolo!): si misura solo la **perturbazione** (la luce naturale stimata), e si usa un **modello del processo** (i lumen noti delle lampade) per calcolare preventivamente l'azione correttiva. È un controllo **feedforward**: efficiente e senza oscillazioni, ma che non si autocorregge se il modello è impreciso.

Qui c'è solo algebra: se la luce naturale copre già 200 lx, ho bisogno di altri 200 lx artificiali. Conoscendo il flusso massimo producibile dalle sorgenti disponibili ($E_{max,art} \approx 249 \, lx$ a piena potenza), la brightness necessaria è:

$$brightness\% = \min\!\left(100, \frac{\max(0,\; E_{target} - E_{naturale})}{E_{max,art}} \times 100\right)$$

A questo punto nond dovrebbe essere complicato realizzare una automazione che si adatti alle specifiche esigenze di ognuno. Il mio consiglio è, però, quello di utilizzare, all'interno dell'automazione delle `variables`, per praticità:

{% raw %}
```yaml
variables:
  lux_target:   "{{ states('input_number.smartworking_target_illuminamento') | float }}"
  lux_naturale: "{{ states('sensor.soleggiamento_soggiorno') | float }}"
  lux_gap:      "{{ [lux_target - lux_naturale, 0] | max }}"
  lux_max_art:  "{{ (4 * 806 + 2800 + 806 * 0.25) / 25 }}"
  brightness_pct: "{{ ([lux_gap / lux_max_art * 100, 100] | min) | round(0) | int }}"
```
{% endraw %}

Ad oggi l'aggiunta delle variables è, credo, ancora prerogativa del codice Yaml. Bisogna, quindi, passare a questa modalità durante la stesura dell'automazione per inserirle. Poi, si puòà tranquillamente tornare in modalità visuale e riprendere il lavoro.

## Convivenza con Adaptive Lighting

Ho già [Adaptive Lighting](https://github.com/basnijholt/adaptive-lighting) attivo sul soggiorno, che gestisce la temperatura colore in funzione della posizione del sole, e ti consiglio di fare lo stesso...è davvero divertente! Il fatto, però, è che l'integrazione può gestire anche la brightness, ma per lo smartworking questo crea un conflitto: AL vuole abbassare la luminosità al mattino presto o alla sera, mentre il compensatore feedforward vuole alzarla.

La soluzione è disabilitare temporaneamente il controllo brightness di AL durante le ore di smartworking, lasciandogli solo il controllo della temperatura colore:

```yaml
sequence:
  - action: switch.turn_off
    target:
      entity_id: switch.adaptive_lighting_adapt_brightness_adaptive_zona_giorno
  - action: light.turn_on
    data:
      brightness_pct: "{{ brightness_pct }}"
    target:
      entity_id:
        - light.luci_soggiorno
        - light.led_tavolo
        - light.lampadina_ingresso
```

Al termine dell'orario di lavoro, o se la luce naturale diventa sufficiente, AL riprende il controllo completo. Anche questo può essere fatto tramite una automazione che viene invocata al cambiamento di stato di una entità di tipo Scheduler.

## Limiti del modello e sviluppi futuri

Il sistema funziona bene, ma ci sono alcune approssimazioni di cui è bene essere consapevoli:

- **Ombreggiamento da edifici**: la formula non considera edifici o ostacoli che bloccano il sole a certe ore. Se il palazzo di fronte proietta ombra sulla finestra dal primo pomeriggio, il modello sovrastima il soleggiamento. In linea di principio è possibile costruire un modello di occlusione degli ostacoli a partire dai dati di OpenStreetMaps, ma più come curiosità scientifica. I dati cartografici OSM, infatti, pur avendo quasi sempre i dati planimetrici degli edifici, mancano spesso dei dati di altezza, quindi il modello risultante avrebbe scarsa utilità pratica. Il modello di _ray tracing_ sarebbe, quindi, bidimensionale: basterebbe, se le sorgenti luminose fossero basse sull'orizzonte, ma chiaramente avendo a che fare con il sole l'approssimazione non regge più.
- **Latenza meteo**: `sensor.luminanza_esterna` potrebbe aggiornarsi con frequenza limitata. L'integrazione Tomorrow.io che utilizzo cattura i cambi di copertura nuvolosa esplicitamente da un sensore del tipo `sensor.tomorrow_io_casa_cloud_cover`, che si aggiorna più spesso, ma un ritardo residuo rimane durante i transitori veloci — per esempio, una nuvola solitaria che transita davanti al sole nel giro di pochi minuti.
- **Linearità brightness/lumen**: i LED dimmerabili non hanno una curva perfettamente lineare. Per una stima più precisa si potrebbe usare una curva gamma, ma la differenza pratica è trascurabile per questo scopo.
- E, ovviamente, parte dall'assunto (super semplicistico) che la volta celeste sia isotropa.

Nonostante questi limiti, il risultato è un sistema che si comporta in modo fisicamente coerente e che migliora misurabilmente il comfort visivo durante le ore di lavoro, senza richiedere alcun intervento manuale o un sensore esterno.
