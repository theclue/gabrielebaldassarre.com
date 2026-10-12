---
agent: cad-author
description: Create or update a blog CAD asset through the global CAD pipeline.
---

# /create_cad

Forward `$ARGUMENTS` to the global `cad-orchestrator`, the sole CAD executor.
Do not author, edit, validate, export, or build CAD directly. Wait for the
complete pipeline gates, release verdict, and user Gate C before reporting the
CAD result. Report only outputs and evidence the orchestrator verifies.

## Request brief

- Determine whether this is a new asset or an update. For a new asset derive a
  unique kebab-case slug for `_cad/<slug>/` and an Italian project title; use
  English for product names, Italian for generic concepts, put the primary
  keyword first, remove stopwords, and keep 4–5 keywords. For an existing asset,
  preserve its slug and metadata unless the user requests a change.
- Forward the design, intended use, important dimensions, fit/tolerance
  constraints, parameter/range requirements, material/manufacturing constraints,
  and user-specified backend constraints. Do not invent a model backend.
- Preserve blog context: post frontmatter `3d_model` is the metadata source
  consumed by `_layouts/asset-3d.html` and the Thingiverse broadcast pipeline.
  The blog content license is MIT; surface attribution requirements and do not
  silently change terms. Reader-facing descriptions are in Italian unless
  requested otherwise. Retain source paths and metadata from the verified
  handoff; never infer a source or create a README.

## Optional site package

After successful global CAD release and user Gate C, offer the existing blog
site bundle separately. Ask for separate explicit consent before packaging, and
then delegate to `cad-site-packager` with the exact verified canonical source,
slug, and release evidence. The package may include only the user's selected
existing bundle outputs: STL, 3MF, isometric/orthographic previews, and/or
overlay. Do not request additional final renders or dimensioned drawings; those
are out of scope. Never run the builder directly.

The package is separate from CAD release evidence and verdict. The site's
builder STL may differ from the inspected `_cad/<slug>/stl` STL; do not claim
geometric review of site outputs without separate inspection/comparison.

Do not create a post draft unless separately requested and explicitly approved.
Do not publish, upload, or commit assets.

## User-facing result

Summarize title, slug/path, whether new or updated, the orchestrator's complete
CAD release verdict and Gate C result, and verified source paths/metadata.
Report the site package status separately (`not requested`, `awaiting consent`,
`complete`, or `hold`) with only verified artifact paths and warnings. Include
parameters/modules and estimated print material, dimensions, supports, or infill
only when available from verified evidence.
