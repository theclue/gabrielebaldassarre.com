---
category: Fisica
title: Che cos'è l'elettronvolt
excerpt: In questo breve articolo ci concentreremo sull'elettronvolt, una delle unità di misura più utilizzate in fisica delle particelle e ai cui i fisici sono così affezionati da usarlo per misurare praticamente tutto.
header:
  overlay_image: /assets/images/elettronvolt-overlay.jpg
  teaser: /assets/images/elettronvolt-teaser.jpg
  overlay_filter: 0.5
---

L'elettronvolt (simbolo eV) è un'unità di misura dell'energia particolarmente adatta, per via del suo valore, a misurarne i valori su scale atomiche e subatomiche. In pratica, esso coincide con il lavoro compiuto dalla forza elettrostatica agente su un elettrone che si muove nel vuoto in un campo elettromagnetico quando la particella si sposta da un punto iniziale e finale aventi differenza di potenziale di 1 Volt. È, quindi, l'energia cinetica guadagnata (o persa) dall'elettrone accelerato dal campo caratterizzato da quel potenziale.

Poiché il lavoro del campo elettromagnetico è dato dal prodotto del potenziale per la carica e la carica dell'elettrone è pari a $$ e = 1,602\times10^{-19}C $$:

$$ 1V = \frac{1J}{1C} \Rightarrow 1eV = \frac{1J}{1C}(1,602\times10^{-19}C) = \boxed{1{,}602\times10^{-19}\,\text{J}} $$

Ricordando come 1 J sia il lavoro compiuto da una forza per spostare una massa di 1kg per un metro (o in alternativa di sollevare a 1m di altezza una massa di poco più di 100gr soggetta alla gravità terrestre), ne consegue che un elettronvolt sia una quantità di energia molto piccola. Per questo motivo, spesso si utilizza uno dei suoi multipli come il megaelettronvolt (MeV) o il gigaelettronvolt (GeV), soprattutto quando si utilizzà l'elettronvolt come unità di misura per la massa.

Ciò che, infatti, genera più spesso confusione nell'uso dell'elettronvolt è il fatto che, soprattutto in fisica delle alte energia, questo sia utilizzato anche come unità di misura per la massa. Ricorderete, infatti, che quando fu scoperto il Bosone di Higgs, i ricercatori dichiararono di averlo "trovato" all'incirca dove si aspettavano che fosse, ovvero avente una massa di circa $$ 125 GeV/c^2 $$. Cosa significa questo?

Per rispondere alla domanda, vediamo la definizione dimensionale dell'energia:

$$ [J] = \frac{[kg][m]^2}{[s]^2} $$

se si divide per la dimensione della velocità $$ [m]/[s] $$ si ottiene:

$$ [J] = \frac{[kg][m]}{[s]} $$

che è la dimensione della [quantità di moto]({% post_url fisica/2021-05-08-quantita-moto %}). Quindi, dividendo l'energia espressa in eV per _c_, quello che otteniamo è effettivamente una quantità di moto espressa in _eV/c_.

Andando ora a dividere l'espressione ancora una volta per la velocità. Nell'equazione dimensionale rimane solo la misura della _m_
massa. Quindi, per misurare la massa si può usare come unità di misura $$ eV/c^2 $$.

Ma perché proprio _c_?

Per rispondere a questa domanda, basti ricordare l'equazione dell'equivalenza di massa-energia, ovvero la famosissima $$ E = mc^2 $$ della relatività ristretta, che esprime il legame tra la massa a riposo e l'energia, attraverso la costante rappresentata dalla velocità della luce nel vuoto. Dimensionalmente, i conti tornano: $$ eV/c^2 $$ è una massa.

Facciamo un esempio. L'equivalente in massa di 1eV è:

$$ 1eV/c^2 = \frac{1eV}{c^2} = \frac{1{,}602 \times 10^{-19}}{(2{,}99 \times 10^8)^2} = \boxed{1{,}78 \times 10^{-36}\,\text{kg}} $$

Ad esempio, la massa dell'elettrone:

$$ m_e = 9,109 \times 10^{-31} kg = \frac{9,109 \times 10^{-31}}{1,78 \times 10^{-36}} = 0,511 \times 10^6 eV/c^2 = 0,511 MeV/c^2 $$

Per creare un elettrone è quindi necessario spendere $$ 0,511 MeV $$ di energia, o, in altri termini, l'annichilimento dell'elettrone provoca l'emissione di $$ 0,511 MeV $$ di energia).

C'è da dire, infine, che soprattutto in fisica teorica, per semplificare la notazione (e i calcoli) i fisici usano un sistema di riferimento in cui la velocità della luce del vuoto _c_ è adimensionale e pari a 1. In questi sistemi, chiaramente, l'unità di misura della massa diventa semplicemente l'eV. Quando anche la costante di Plank ridotta _ħ_ è adimensionale e pari ad uno, anche spazio e tempo sono esprimibili con l'inverso dell'energia, cioè $$ eV^{-1} $$, e quindi l'elettronvolt, in questi sistemi, può esprimere anche distanze e intervalli di tempo.