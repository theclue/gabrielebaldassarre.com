######################
# REQUIREMENTS       #
######################
if (!require("pacman")) install.packages("pacman"); invisible(library(pacman))
tryCatch({
  p_load("tidyverse", "igraph", "sna", "poweRlaw", "intergraph", "qgraph", "RColorBrewer", "centiserve")
}, warning=function(w){
  stop(conditionMessage(w))
})

#################################
# LOAD NETWORK DATA
# -
# 
##

italian.music.graph <- read_graph(file = "italian-music.graphml", format = "graphml")

# Connected and giant component subgraphs
italian.music.graph <- igraph::delete.vertices(simplify(italian.music.graph), igraph::degree(italian.music.graph)==0)
italian.music.sna <- intergraph::asNetwork(italian.connected.graph)

#italian.giant.graph <- giant.component(italian.music.graph)
#italian.giant.sna <- intergraph::asNetwork(italian.giant.graph)

##############
# Centrality
##

italian.music.stats <- data.frame(name = V(italian.music.graph)$name,
                                  membership = igraph::components(italian.music.graph)$membership,
                                  degree.std = sna::degree(italian.music.sna, gmode = "digraph"),
                                  degree.norm = sna::degree(italian.music.sna, gmode = "digraph", rescale = TRUE),
                                  degree.in = sna::degree(italian.music.sna, gmode = "digraph", cmode="indegree"),
                                  degree.out = sna::degree(italian.music.sna, gmode = "digraph", cmode = "outdegree"),
                                  betweeness.std = sna::betweenness(italian.music.sna, gmode = "digraph", cmode = "undirected"),
                                  betweeness.linear = sna::betweenness(italian.music.sna, gmode = "digraph", cmode = "linearscaled"),
                                  betweeness.proximal = sna::betweenness(italian.music.sna, gmode = "digraph", cmode = "proximalsrc"),
                                  closeness.std = sna::closeness(italian.music.sna, gmode = "digraph", cmode = "directed", rescale = TRUE),
                                  closeness.gil = sna::closeness(italian.music.sna, gmode = "graph", cmode = "gil-schmidt", rescale = TRUE),
                                  closeness.igraph.in = igraph::closeness(italian.music.graph, mode = "in", normalized = TRUE),
                                  closeness.igraph.out = igraph::closeness(italian.music.graph, mode = "out", normalized = TRUE),
                                  core.all = coreness(italian.music.graph, mode = "all"),
                                  power.igraph = igraph::power_centrality(italian.music.graph, rescale = TRUE),
                                  clustering = igraph::transitivity(italian.music.graph, type = "local", isolates = "zero"),
                                  #centroid.in = centiserve::centroid(italian.music.graph,  mode = "in"),
                                  #community.centrality = centiserve::communitycent(italian.music.graph, type = "commconn", normalise = TRUE),
                                  #bonpow.std = sna::bonpow(italian.giant.sna),
                                  stringsAsFactors = FALSE)


#italian.music.brokerage <- brokerage(italian.music.sna, cl = V(italian.music.graph)$affiliation)

# Minimum cuts
italian.music.min_cut <- min_cut(italian.music.graph, value.only = FALSE)

# articulation points
italian.music.biconnected <- biconnected_components(italian.music.graph)

################
# Attribute enrichment
##

#edge.colors <- brewer.pal(9, "Spectral")
#names(edge.colors) <- unique(V(italian.music.graph)$affiliation)

#V(italian.music.graph)$color <- edge.colors[V(italian.music.graph)$affiliation]

V(italian.music.graph)$id <- V(italian.music.graph)$label

#V(italian.music.graph)$color[ends(italian.music.graph, es=E(italian.music.graph), names=F)[,1]]


################
# Network Plots
##

# cfr. http://kateto.net/network-visualization
italian.music.graph.layout <- layout_with_lgl(italian.music.graph)

#V(italian.music.graph)$x <- italian.music.graph.layout[,1]
#V(italian.music.graph)$y <- italian.music.graph.layout[,2]

par(mar=c(0,0,0,0))

plot(italian.music.graph,
     #layout=italian.music.graph.layout,
     #edge.width=E(italian.music.graph)$weight/8,
     #edge.color=V(italian.music.graph)$color[ends(italian.music.graph, es=E(italian.music.graph), names=F)[,1]],
     vertex.frame.color="#ffffff",
     vertex.label= ifelse(italian.music.stats$name %in% head(italian.music.stats %>% mutate(index = degree.in * betweeness.std) %>% arrange(desc(index)), 5)$name, italian.music.stats$name, NA),
     vertex.color = as.integer(as.factor(V(italian.music.graph)$genre)),
     vertex.size = .7,
     vertex.label.cex = .8,
     vertex.label.color = "black",
     edge.arrow.size = .01,
     edge.width = .1
     )

legend(x=-1.5,
       y=-1.1,
       unique(V(italian.music.graph)$affiliation),
       pch=21,
       col="#777777",
       pt.bg=edge.colors,
       pt.cex=2,
       cex=.8,
       bty="n",
       ncol=3)

plot.degree.distribution(italian.music.graph.layout)

# it definitively look like a scale-free
italian.pl <- conpl$new((italian.music.stats %>% filter(degree.in > 0))$degree.in)
italian.pl$setXmin(estimate_xmin(italian.pl))
italian.pl$setPars(estimate_pars(italian.pl))

italian.exp <- conexp$new((italian.music.stats %>% filter(degree.in >  0))$degree.in)
italian.exp$setXmin(estimate_xmin(italian.exp))
italian.exp$setPars(estimate_pars(italian.exp))

par(mar=c(4, 4, 2, 1),
    mgp=c(3, 0.4, 0),
    tck=-.01,
    oma=c(0,1,2,0),
    cex.axis=0.9,
    las=1)

plot(italian.pl, pch = 16, cex = .2, col = "darkblue", bg=2, panel.first=grid(col="grey80"),
     xlab="In Degree", ylab="CDF", main = "Musica Italiana - Grado")
lines(italian.pl, col=2, lwd = 1.4)
lines(italian.exp, col=3, lwd = 1.4)

write.graph(italian.music.graph, file = "../../data/harry-potter/harrypotter.01.layout.graphml", format=c("graphml"))
