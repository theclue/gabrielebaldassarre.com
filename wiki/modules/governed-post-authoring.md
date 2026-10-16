---
title: "Governed Post Authoring"
description: "Create-only Markdown authoring with a verified runtime, permission-gated Rake preparation, and session-local instruction injection."
category: "modules"
source_files:
  - "_scripts/author-extraction/post-authoring.mjs"
  - "_scripts/author-extraction/post-authoring-plugin.mjs"
  - ".opencode/plugins/post-authoring.js"
  - ".opencode/commands/create-post.md"
  - "Rakefile"
  - "docs/post-authoring.md"
created: "2026-10-15"
last_updated: "2026-10-15"
---

# Governed Post Authoring

## Purpose

The `/create-post` command turns a natural-language brief into one new Markdown draft or post, prepared against a [task-specific author runtime](./author-runtime.md). It hides the operational complexity of Step 5, profile names such as C01/C02, scripts, and hashes: the command supplies the workflow instructions even in a fresh session without prior chat history. The plugin prepares and injects instructions; the current session's agent writes the article. It does not select another provider or model or delegate generation.

This integration covers **new `.md` files only**. R Markdown creation, revisions of existing articles, and draft publication remain separate workflows. Creating a file under `_posts/` does not itself commit, push, build, deploy, or broadcast it. Sources: `docs/post-authoring.md`, `.opencode/commands/create-post.md`.

## Key Files

| File | Role |
|------|------|
| `.opencode/commands/create-post.md` | Natural-language interface, metadata interpretation, editorial instructions, and required prepare/write/finish sequence; sets `subagent: false`. |
| `.opencode/plugins/post-authoring.js` | Defines the `post-authoring` plugin and binds its root to this checkout using the entrypoint location. |
| `_scripts/author-extraction/post-authoring-plugin.mjs` | Registers tools, permission checks, session hooks, durable activation, and `/cancel-post`. |
| `_scripts/author-extraction/post-authoring.mjs` | Validates and plans requests, prepares runtime evidence and Rake scaffolds, and verifies context and written-body prerequisites. |
| `Rakefile` | Implements create-only `post` and `draft` scaffolds; also contains separate publishing and R Markdown tasks. |
| `docs/post-authoring.md` | Operator guidance, guarantees, recovery limits, and verification boundaries. |

## Public API

### Session-facing tools and command

| Interface | Contract |
|-----------|----------|
| [`author_post_prepare`](../api/native-author-tools.md) | Requires `request`, `title`, `category`, `slug`, `destination`, and `task`; optionally accepts `date`. On success returns `status: ready`, target and receipt paths, runtime identifiers and hashes, full instruction Markdown, and session-injection status. |
| `author_post_finish` | Accepts only `outcome: written` or `outcome: cancelled`. Ends activation without publishing or removing files. `written` performs additional checks. |
| `/cancel-post` | Plugin-registered command that removes activation directly, without a model call or runtime-integrity check. Leaves all files intact. |

The prepare input is closed against unknown properties. Although it shares the runtime task schema, planning accepts only `task.mode: generate`. Categories are `3D Printing`, `DevOps`, `Fisica`, `Home Assistant`, `Meccanica`, and `Reti Sociali`; slugs must be lowercase kebab-case, at most 100 characters. Dates must be real calendar dates in `YYYY-MM-DD` form. Sources: `preparePostInputSchema` and `planAuthorPost` in `post-authoring.mjs`; tool registration in `post-authoring-plugin.mjs`.

### Core exports

| Export | Responsibility |
|--------|----------------|
| `planAuthorPost(root, input)` | Validate, compile the runtime profile, normalize the request, derive its hash and destination, and reject existing targets without creating output directories. |
| `authorPostRakeInvocation(input)` | Produce the `post[...]` or `draft[...]` task argument with Rake-specific escaping. |
| `prepareAuthorPost(root, input, { signal })` | Save evidence, materialize and check the runtime, invoke Rake, and return the preparation receipt and instructions. |
| `verifyAuthorPostContext(root, prepared)` | Recheck saved evidence, runtime identity and hashes, exact instruction text, and target-file safety. |
| `verifyAuthorPostWritten(root, prepared)` | Reject an unchanged scaffold or an empty body after YAML frontmatter. |
| `setupPostAuthoring(ctx, repoRoot)` | Install tools, hooks, cancellation command, and lifecycle cleanup; return an unload callback. |

## Dependencies

```mermaid
graph LR
    Command["/create-post"] --> Plugin["Local plugin and session tools"]
    Plugin --> Core["Preparation and verification core"]
    Core --> Runtime["Runtime compiler and materializer"]
    Core --> Rake["Host Rake post or draft"]
    Rake --> Target["New Markdown target"]
    Core --> Evidence["Request, task, and receipt"]
    Plugin --> Storage["Durable session storage"]
    Plugin --> Hooks["Context and generate hooks"]
    Storage --> Hooks
    Hooks --> Core
```

The core imports runtime compilation and input-reading helpers from `runtime.mjs`, materialization from `compile-author-runtime.mjs`, the runtime schema, Ajv 2020, and Node filesystem, crypto, path, and child-process APIs. The entrypoint loads the plugin SDK through `native.mjs`. Host Rake and its Ruby dependencies must already be available; the plugin does not install them. Sources: imports in the three implementation files; `docs/post-authoring.md`.

## Authoring Flow

### Interpret the request

The command derives editorial metadata and a structured task brief rather than asking users for JSON or hashes. **Draft is the command's default** when the destination is unspecified; the tool itself requires an explicit `destination`. An explicitly requested non-draft article may use `post`, while later series parts are directed to drafts by the command instructions.

The task language defaults to Italian unless requested otherwise. Content type is inferred independently of category, using `tutorial`, `project_article`, `scientific_explainer`, or explicitly declared mixed types. The agent must not invent experience, measurements, dependencies, or series plans. Runtime features should reflect the actual brief, not genre-based obligations. Source: `.opencode/commands/create-post.md`.

### Prepare before creating the scaffold

The plugin requires the session's resolved directory to equal the repository root and allows only one active authoring task per session. It first plans the request, then explicitly asserts **both host edit and shell permissions**. Edit resources cover the target, authoring-run evidence, and runtime outputs; the shell permission covers the intended Rake task. Native filesystem and process work therefore does not silently bypass host permission rules.

Preparation then proceeds in this order:

1. Save the normalized request and task as immutable evidence.
2. Materialize the task runtime, run a check-only materialization, and compare profile and instruction hashes with the planned compilation.
3. Read the instructions and Rakefile, validate destination directories, and recheck that the target is absent.
4. Execute Rake through Node `execFile`, with an argument array and no shell. Backslashes, commas, and brackets are separately escaped for Rake's own argument parser; shell quoting alone would not solve that parser boundary.
5. Read the scaffold, persist the immutable preparation receipt, and only then activate injection in session storage.

The process invocation in `post-authoring.mjs` is:

```javascript
await run("rake", ["--rakefile", "Rakefile", invocation], {
  cwd: root, env: { ...process.env, date: plan.request.date }, signal, timeout: 30_000, maxBuffer: 64 * 1024,
});
```

Targets are `_drafts/<slug>.md` or `_posts/<normalized-category>/<date>-<slug>.md`. Core checks reject existing targets and unsafe destination ancestors; Rake additionally creates both types with `File.open(filename, "wx")`. The scaffold contains YAML metadata, an empty excerpt, image defaults, audience and proficiency defaults, and `broadcast.sent: false`, but no article body. Sources: `post-authoring.mjs`, `post-authoring-plugin.mjs`, `Rakefile`.

### Inject and write in the same session

Activation is stored under a hash of the session ID. Both V2 `context` and `generate` hooks retrieve that activation, check the session location, and reverify the receipt, request, task, runtime, and exact instruction Markdown before appending the complete Markdown as a system-context text block. An additional instruction identifies the target, prohibits delegating the writing, and requires finishing before changing topic.

Storage preserves activation across reloads, and subsequent hook applications do not depend on earlier conversation content surviving compaction. Activation is **not inherited by child sessions**, shared with unrelated sessions, or valid from a different checkout directory. The command requires writing only to the newly returned target. Hooks do not switch provider/model or generation parameters; recording `last_model` is observation, not selection. Sources: `post-authoring-plugin.mjs`, `.opencode/commands/create-post.md`, `docs/post-authoring.md`.

## Saved Evidence

| Location | Contents |
|----------|----------|
| `docs/authoring-runs/<request-sha256>/request.json` | Original natural-language request plus normalized metadata, resolved date, and compiled task context. |
| Same directory, `task.json` | The task used for runtime materialization and subsequent checks. |
| Same directory, `preparation.json` | Request and target references; Rake task; Rakefile and initial-scaffold hashes; runtime, manifest, profile, instruction, and source-author-model bindings. |
| `docs/author-pattern-results/v1.3/author-runtimes/` | Hash-addressed runtime artifacts used by this flow. |

Evidence writes are create-only; an existing identical file can be reused, but differing content produces a collision error rather than an overwrite. The article remains editable, while context verification requires it to remain a safe regular file inside the repository. Hook-application counts live in session storage and the finish result, not in the preparation receipt. The receipt binds preparation, not the final prose or human approval. Sources: `immutable`, `prepareAuthorPost`, and `verifyAuthorPostContext` in `post-authoring.mjs`; `post-authoring-plugin.mjs`; `docs/post-authoring.md`.

## Completion, Cancellation, and Failures

- **Written:** `author_post_finish` revalidates context, requires at least one observed hook application, and rejects an unchanged scaffold or empty body. It then clears activation and returns identifiers, hashes, and the hook count. This does not establish factual correctness, editorial quality, or prose compliance.
- **Cancelled:** `author_post_finish` with `cancelled` clears activation without requiring written-body or runtime checks. The registered `/cancel-post` also works without a model call, including when invalid runtime evidence prevents further model requests. Neither mechanism deletes or publishes anything.
- **Preparation in progress:** finish and cancellation reject a busy session. Stop preparation through normal host controls before cancelling. Unloading the plugin aborts running preparation and disposes registrations, but deliberately retains durable activation.
- **Interrupted or failed preparation:** evidence, directories, or a newly created scaffold may remain. There is no automatic rollback, cleanup, overwrite, or fallback. Retrying preparation for an existing target fails, even if the target is only a scaffold from an interrupted attempt.
- **Unavailable or failing tool:** the command instructs the agent to stop and report the problem, not bypass preparation through direct shell/Rake or generic-style generation. Merely changing topic does not clear activation.

Sources: `post-authoring-plugin.mjs`, `post-authoring.mjs`, `.opencode/commands/create-post.md`, `docs/post-authoring.md`.

## Usage Example

The operator guide supplies this natural-language request for a fresh session at the repository root:

```text
/create-post una bozza tutorial su come modellare una matita parametrica in OpenSCAD, per principianti, con corpo esagonale, punta in legno e mina. Includi il codice completo e spiega i parametri.
```

The command requires preparation before writing, then a finish call after filling the returned target. Its final summary includes the runtime ID, receipt path, instruction hash, and an explicit distinction between completed checks and remaining TODOs. Review, annotation, image generation, publication, commits, and deployment are not automatically performed. Sources: `docs/post-authoring.md`, `.opencode/commands/create-post.md`.

## Assurance Boundaries

This is a permission-aware preparation gate and session-context integration, **not a global editorial sandbox**. Generic edit or shell tools can technically bypass the procedural command; the plugin does not revoke them or govern unrelated edits. The no-fallback and no-delegation rules are command instructions, not proof that every possible agent action is confined.

[Successful hooks](../concepts/governance-and-verification.md) establish that verified instructions were inserted into the host-assembled context. They do not prove byte-for-byte provider delivery, model attention, or prose compliance; another plugin may also alter context afterward. Hashes and `written` completion are not content certification.

The operator guide describes offline verification, including temporary-directory Rake execution and plugin lifecycle checks, separately from live generation. **No live end-to-end generation is verified by the evidence described here.** Source: `docs/post-authoring.md`; the finish result explicitly reports `runtime_integrity_and_context_hook_application_not_prose_compliance_or_provider_delivery` in `post-authoring-plugin.mjs`.
