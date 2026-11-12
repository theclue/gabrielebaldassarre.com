---
title: "La matematica dietro le misure della centralità"
excerpt: "Lorem ipsum dolor sic amet"
header:
  overlay_image: /assets/images/posts/centrality-overlay.png
  overlay_filter: 0.5
graph_bare: "graphs/smallworld-example-bare.html"
graph_degree: "graphs/smallworld-example-degree.html"
graph_betweeness: "graphs/smallworld-example-betweeness.html"
---


Per chi si trova a suo agio con la matematica, esprimiamo la degree centrality totale per il nodo \\( i \\) come

$$ C_D(n_i) = d(n_i) = \sum_{j}^{g - 1} x_{ij} = \sum_{j}^{g - 1} x_{ji} $$

Con \\( g \\) il numero dei nodi della rete e \\( j \ne i \\) e \\( n_i \\) parametro dipendente da \\( i \\). Essa è pari alla somma dei pesi di tutti i collegamenti \\( x_{ij} \\) tra il nodo \\( i \\) e tutti gli altri nodi \\( j \\) della rete (se non è presente un collegamento tra \\( i \\) e \\( j \\), \\( x_{ij} = 0 \\)).

I due membri dell'equazione a destra non sono uguali nelle reti direzionate e rappresentano la out-degree e la in-degree centrality rispettivamente. In caso, infine, di collegamenti pesati, parliamo di __weighted degree centrality__ in quanto potrebbe essere che \\( x_{ij} \ge 1 \\).

Talvolta, si preferisce utilizzare una misura _normalizzata_ della centralità, in modo che assuma un valore (compreso tra zero e uno) che non sia dipendente dalle dimensioni della rete. In tal caso, la formula va semplicemente divisa per \\( g - 1 \\).

$$ C_D(n_i) = \frac{d(n_i)}{g - 1} $$
