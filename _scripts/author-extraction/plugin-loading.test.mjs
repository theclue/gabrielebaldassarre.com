import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  createConsolidationAdapter,
  loadPluginSDK,
  prepareInputSchema,
  submitInputSchema,
} from "./consolidator-native.mjs";
import { createReviewAdapter, reviewInputSchema, textToolResult } from "./review-native.mjs";
import { createModelAdapter, modelPrepareInputSchema, modelSubmitInputSchema, modelToolResult } from "./model-native.mjs";
import { prepareAuthorModelCandidate } from "./model-agent.mjs";

const REPO_ROOT = path.resolve(process.env.AUTHOR_EXTRACTION_TEST_ROOT ?? fileURLToPath(new URL("../../", import.meta.url)));
const AUTO_PLUGIN_DIR = path.join(REPO_ROOT, ".opencode", "plugins");
const EXPECTED_RECORDS_DIRECTORY = "docs/author-extraction-results/v1.3";
const DEFAULT_RECORDS_DIRECTORY = "docs/author-extraction-results/v1.1";
const PACKAGE_DIRECTORY_SPECIFIER = "./plugins/author-pattern-consolidator";
const modelSchema = JSON.parse(await readFile(new URL("./author-model.schema.json", import.meta.url), "utf8"));

function modelPreparation(include) {
  const canonical = (value) => Array.isArray(value) ? value.map(canonical) : value !== null && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
  const body = {
    schema_version: "author-model-preparation/1", status: "ready", source_review_hash: "a".repeat(64), include_semantic_context: include,
    method: { compiler_sha256: "b".repeat(64), schema_sha256: "c".repeat(64), instructions_sha256: "d".repeat(64), preparation_sha256: "e".repeat(64),
      reviewed_author_patterns_sha256: "1".repeat(64), reviewed_semantic_model_sha256: include ? "2".repeat(64) : null },
    author_patterns: ["EPC:A0001", "EPC:E0001"].map((id) => ({ source_pattern_id: id, dimension: "epistemic", label: "VM fixture", description: "VM fixture.",
      applicability: "Synthetic wiring fixture only.", review_notes: null, article_count: 1, observation_count: 2, author_relevance: "contextual", generative_utility: "usable", overuse_risk: "high" })),
    semantic_context_sources: [], candidate_schema: { ...modelSchema, $ref: "#/$defs/Composition" },
  };
  return { ...body, input_hash: createHash("sha256").update(JSON.stringify(canonical(body))).digest("hex") };
}

async function jsonFile(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
}

async function currentConfig() {
  const [root, nested] = await Promise.all([
    jsonFile(path.join(REPO_ROOT, "opencode.json")),
    jsonFile(path.join(REPO_ROOT, ".opencode", "opencode.json")),
  ]);
  return { root, nested };
}

async function currentPluginSetup() {
  const { root, nested } = await currentConfig();
  // Inspect both applicable V2 config arrays cumulatively, scoped to this
  // package; do not model general plugin loading or replacement semantics.
  const configuredFiles = [
    { config: root, filePath: path.join(REPO_ROOT, "opencode.json") },
    { config: nested, filePath: path.join(REPO_ROOT, ".opencode", "opencode.json") },
  ];
  const configuredEntries = [];
  for (const { config, filePath } of configuredFiles) {
    if (!Array.isArray(config.plugins)) continue;
    const configDirectory = path.dirname(filePath);
    const expectedPackageDirectory = path.resolve(configDirectory, PACKAGE_DIRECTORY_SPECIFIER);
    for (const entry of config.plugins) {
      const packagePath = typeof entry === "string" ? entry : entry?.package;
      if (typeof packagePath !== "string") continue;
      const configuredPath = path.resolve(configDirectory, packagePath);
      const isPackageDirectory = configuredPath === expectedPackageDirectory;
      const isPackageIndex = configuredPath === path.join(expectedPackageDirectory, "index.js");
      if (isPackageDirectory || isPackageIndex) {
        configuredEntries.push({ entry, configuredPath, filePath });
      }
    }
  }
  assert.ok(configuredEntries.length <= 1, "the consolidator package must have one targeted V2 config entry");
  if (configuredEntries.length === 1) {
    const [{ entry, configuredPath }] = configuredEntries;
    const packageStat = await stat(configuredPath);
    const entrypoint = packageStat.isDirectory()
      ? path.join(configuredPath, "index.js")
      : configuredPath;
    await access(entrypoint);
    return {
      entrypoint,
      configuredPackagePath: configuredPath,
      options: typeof entry === "object" ? entry.options ?? {} : {},
    };
  }

  // Before the explicit project entrypoint is configured, retain the current
  // repository's single auto-discovered plugin file as the active source.
  const entries = (await readdir(AUTO_PLUGIN_DIR, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name === "author-pattern-consolidator.js");
  assert.equal(entries.length, 1, "the actual auto-discovered consolidator entrypoint must be unique");
  return {
    entrypoint: path.join(AUTO_PLUGIN_DIR, entries[0].name),
    configuredPackagePath: undefined,
    options: root.pluginOptions?.["author-pattern-consolidator"] ?? nested.pluginOptions?.["author-pattern-consolidator"] ?? {},
  };
}

function syntheticModule(context, exports, identifier) {
  return new vm.SyntheticModule(Object.keys(exports), function initialize() {
    for (const [name, value] of Object.entries(exports)) this.setExport(name, value);
  }, { context, identifier });
}

async function loadActualPlugin(entrypoint, coreCalls, reviewCalls = [], modelCalls = [], modelPreparedOverride) {
  const pluginApi = await loadPluginSDK();
  const context = vm.createContext({ URL, console });
  const core = syntheticModule(context, {
    async prepareConsolidation(repoRoot, dimension, recordsDirectory) {
      coreCalls.push({ operation: "prepare", repoRoot, dimension, recordsDirectory });
      return {
        status: "blocked",
        schema_version: "author-pattern-preparation/0.1",
        corpus_hash: "a".repeat(64),
        diagnostics: [{ code: "PROCESSING_NOT_TRACKED", article_id: "A01" }],
      };
    },
    async acceptDimensionCandidate(...args) {
      coreCalls.push({ operation: "accept", args });
      throw new Error("blocked fixture must not reach candidate acceptance");
    },
  }, "test:consolidation-core");
  const native = syntheticModule(context, {
    createConsolidationAdapter,
    loadPluginSDK,
    prepareInputSchema,
    submitInputSchema,
  }, "test:consolidator-native");
  const reviewNative = syntheticModule(context, { createReviewAdapter, reviewInputSchema, textToolResult }, "test:review-native");
  const modelNative = syntheticModule(context, { createModelAdapter, modelPrepareInputSchema, modelSubmitInputSchema, modelToolResult }, "test:model-native");
  const modelCore = syntheticModule(context, {
    async prepareAuthorModelCandidate(root, include) {
      modelCalls.push({ operation: "prepare", root, include });
      return modelPreparedOverride ?? modelPreparation(include);
    },
    async submitAuthorModelCandidate(root, sourceReviewHash, inputHash, candidateJson, options) {
      modelCalls.push({ operation: "submit", root, sourceReviewHash, inputHash, candidateJson, include: options.includeSemanticContext, signal: options.signal });
      const hash = "f".repeat(64);
      const dir = `docs/author-pattern-results/v1.3/author-model-candidates/${inputHash}/${hash}`;
      return { schema_version: "author-model-candidate/1", status: "compiled_candidate", source_review_hash: sourceReviewHash, input_hash: inputHash,
        include_semantic_context: options.includeSemanticContext, candidate_dir: dir,
        composition_path: `${dir}/composition.json`, author_model_path: `${dir}/author-model.json`, preparation_path: `${dir}/preparation.json`,
        composition_sha256: "3".repeat(64), author_model_sha256: hash,
        counts: { source_patterns: 2, principles: 1, contextual_profiles: 1, devices: 0, guardrails: 1, semantic_context: 0 } };
    },
  }, "test:model-core");
  const reviewCore = syntheticModule(context, {
    async validateAuthorPatterns(root) {
      reviewCalls.push({ operation: "validate", root });
      return { schema_version: "author-pattern-validation/1", total_groups: 52 };
    },
    async prepareAuthorReview(root) {
      reviewCalls.push({ operation: "prepare", root });
      return '{\n  "schema_version": "author-pattern-review/1"\n}\n';
    },
    async applyAuthorReview(...args) {
      reviewCalls.push({ operation: "apply", args });
      throw new Error("apply must remain unavailable in this host");
    },
  }, "test:review-core");
  const url = syntheticModule(context, { fileURLToPath }, "node:url");
  const module = new vm.SourceTextModule(await readFile(entrypoint, "utf8"), {
    context,
    identifier: pathToFileURL(entrypoint).href,
    initializeImportMeta(meta) {
      meta.url = pathToFileURL(entrypoint).href;
    },
    importModuleDynamically: async (specifier) => {
      if (specifier === "../../_scripts/author-extraction/consolidator.mjs?contract=0.6") {
        if (core.status === "unlinked") await core.link(() => { throw new Error("unexpected core import"); });
        if (core.status === "linked") await core.evaluate();
        return core;
      }
      if (specifier === "../../_scripts/author-extraction/review.mjs") {
        if (reviewCore.status === "unlinked") await reviewCore.link(() => { throw new Error("unexpected review core import"); });
        if (reviewCore.status === "linked") await reviewCore.evaluate();
        return reviewCore;
      }
      if (specifier === "../../_scripts/author-extraction/model-agent.mjs") {
        if (modelCore.status === "unlinked") await modelCore.link(() => { throw new Error("unexpected model core import"); });
        if (modelCore.status === "linked") await modelCore.evaluate();
        return modelCore;
      }
      throw new Error(`unexpected dynamic plugin dependency: ${specifier}`);
    },
  });
  await module.link((specifier) => {
    if (specifier === "node:url") return url;
    if (specifier === "../../_scripts/author-extraction/consolidator-native.mjs?contract=0.6") return native;
    if (specifier === "../../_scripts/author-extraction/review-native.mjs") return reviewNative;
    if (specifier === "../../_scripts/author-extraction/model-native.mjs") return modelNative;
    throw new Error(`unexpected plugin dependency: ${specifier}`);
  });
  await module.evaluate();
  assert.equal(pluginApi.Plugin.define, (await loadPluginSDK()).Plugin.define);
  return module.namespace.default;
}

async function startPlugin(plugin, options = {}) {
  const tools = new Map();
  let disposed = false;
  const cleanup = await plugin.setup({
    options,
    tool: {
      async transform(callback) {
        callback({ add(tool) { tools.set(tool.name, tool); } });
        return { async dispose() { disposed = true; } };
      },
    },
  });
  return { tools, cleanup, isDisposed: () => disposed };
}

describe("author-pattern-consolidator project plugin loading", () => {
  it("configures the local consolidator package as a directory", async () => {
    const { configuredPackagePath } = await currentPluginSetup();
    if (!configuredPackagePath) return; // The provenance-verified baseline uses auto-discovery.
    const packageStat = await stat(configuredPackagePath);
    const actualType = packageStat.isDirectory() ? "directory" : packageStat.isFile() ? "regular file" : "other filesystem object";
    assert.equal(
      packageStat.isDirectory(),
      true,
      `configured local plugin package ${path.relative(REPO_ROOT, configuredPackagePath)} must be a directory (actual filesystem type: ${actualType})`,
    );
  });

  it("routes the active project plugin through the configured twenty-article v1.3 corpus", async () => {
    const { entrypoint, options } = await currentPluginSetup();
    const coreCalls = [];
    const reviewCalls = [];
    const plugin = await loadActualPlugin(entrypoint, coreCalls, reviewCalls);
    assert.equal(plugin.id, "author-pattern-consolidator");

    // Derive options only from the checked-in project configuration. No test-only v1.2 override.
    const { tools } = await startPlugin(plugin, options);
    assert.deepEqual([...tools.keys()].sort(), [
      "author_model_prepare",
      "author_model_submit",
      "author_pattern_consolidation_prepare",
      "author_pattern_consolidation_submit",
      "author_patterns_validate",
      "author_review_apply",
      "author_review_prepare",
    ]);
    assert.deepEqual(tools.get("author_pattern_consolidation_prepare").input, prepareInputSchema);
    assert.deepEqual(tools.get("author_pattern_consolidation_submit").input, submitInputSchema);
    assert.equal(tools.get("author_pattern_consolidation_prepare").options.codemode, false);
    assert.equal(tools.get("author_pattern_consolidation_submit").options.codemode, false);
    assert.deepEqual(tools.get("author_model_prepare").input, modelPrepareInputSchema);
    assert.deepEqual(tools.get("author_model_submit").input, modelSubmitInputSchema);
    for (const name of ["author_model_prepare", "author_model_submit"]) assert.equal(tools.get(name).options.codemode, false);
    for (const name of ["author_patterns_validate", "author_review_prepare", "author_review_apply"]) {
      assert.deepEqual(tools.get(name).input, reviewInputSchema);
      assert.equal(tools.get(name).options.codemode, false);
    }
    const prepared = await tools.get("author_pattern_consolidation_prepare").execute(
      { dimension: "rhetorical" },
      { sessionID: "configured-v1-2", agent: plugin.id },
    );
    assert.equal(JSON.parse(prepared.content[0].text).status, "blocked");
    assert.equal(coreCalls.length, 1);
    assert.equal(path.resolve(coreCalls[0].repoRoot), REPO_ROOT);
    assert.equal(
      coreCalls[0].recordsDirectory,
      EXPECTED_RECORDS_DIRECTORY,
      `the checked-in plugin configuration must route to ${EXPECTED_RECORDS_DIRECTORY}`,
    );
    const context = { sessionID: "configured-v1-3", agent: "plan", signal: new AbortController().signal };
    const report = await tools.get("author_patterns_validate").execute({}, context);
    assert.deepEqual(JSON.parse(report.content[0].text), { schema_version: "author-pattern-validation/1", total_groups: 52 });
    const sheet = await tools.get("author_review_prepare").execute({}, context);
    assert.equal(sheet.content[0].text, '{\n  "schema_version": "author-pattern-review/1"\n}\n');
    await assert.rejects(tools.get("author_review_apply").execute({}, context), { code: "AUTHORIZATION_UNAVAILABLE" });
    await assert.rejects(tools.get("author_patterns_validate").execute({ approved: true }, context), { code: "INPUT_INVALID" });
    await assert.rejects(tools.get("author_review_apply").execute({}, { ...context, agent: "author-pattern-consolidator" }), { code: "AGENT_DENIED" });
    assert.deepEqual(reviewCalls.map((call) => ({ ...call, root: path.resolve(call.root) })), [
      { operation: "validate", root: REPO_ROOT },
      { operation: "prepare", root: REPO_ROOT },
    ]);
  });

  it("routes model tools only through the compiler identity and preserves complete prepared text", async () => {
    const { entrypoint, options } = await currentPluginSetup();
    const modelCalls = [];
    const plugin = await loadActualPlugin(entrypoint, [], [], modelCalls);
    const { tools, cleanup } = await startPlugin(plugin, options);
    const prepare = tools.get("author_model_prepare");
    await assert.rejects(prepare.execute({}, { sessionID: "model-parent", agent: "build" }), { code: "AGENT_DENIED" });
    const context = { sessionID: "model-child", agent: "author-model-compiler", signal: new AbortController().signal };
    const result = await prepare.execute({ include_semantic_context: false }, context);
    const expected = modelPreparation(false);
    assert.equal(result.content[0].text, JSON.stringify(expected));
    assert.equal(result.metadata.truncated, false);
    const accepted = await tools.get("author_model_submit").execute({ source_review_hash: expected.source_review_hash, input_hash: expected.input_hash, candidate_json: "{}" }, context);
    assert.equal(JSON.parse(accepted.content[0].text).status, "compiled_candidate");
    assert.equal(modelCalls.length, 2);
    assert.ok(modelCalls.every((call) => path.resolve(call.root) === REPO_ROOT && call.include === false));
    assert.equal(modelCalls[1].candidateJson, "{}");
    assert.equal(modelCalls[1].signal.aborted, false);
    await assert.rejects(tools.get("author_review_apply").execute({}, context), { code: "AGENT_DENIED" });
    await cleanup();
    await assert.rejects(prepare.execute({}, { ...context, sessionID: "after-unload" }), { code: "CANCELLED" });
  });

  it("preserves the oversized current model preparation byte-for-byte through the VM executor, not a live host", async () => {
    const prepared = await prepareAuthorModelCandidate(REPO_ROOT);
    const text = JSON.stringify(prepared);
    assert.ok(Buffer.byteLength(text) > 51200, "exercise the ordinary native-output cap boundary");
    const { entrypoint, options } = await currentPluginSetup();
    const plugin = await loadActualPlugin(entrypoint, [], [], [], prepared);
    const { tools, cleanup } = await startPlugin(plugin, options);
    const result = await tools.get("author_model_prepare").execute({}, { sessionID: "oversized-model", agent: "author-model-compiler" });
    assert.equal(result.content[0].text, text);
    assert.equal(result.metadata.truncated, false);
    assert.equal(JSON.parse(result.content[0].text).author_patterns.length, 29);
    await cleanup();
  });

  it("preserves host identity, blocked behavior, and registration cleanup", async () => {
    const { entrypoint, options } = await currentPluginSetup();
    const coreCalls = [];
    const plugin = await loadActualPlugin(entrypoint, coreCalls);
    const { tools, cleanup, isDisposed } = await startPlugin(plugin, options);
    const prepare = tools.get("author_pattern_consolidation_prepare");
    assert.equal(prepare.options.codemode, false);
    await assert.rejects(prepare.execute({ dimension: "rhetorical" }, {
      sessionID: "wrong-agent-session", agent: "author-extractor",
    }), { code: "AGENT_DENIED" });

    const result = await prepare.execute({ dimension: "rhetorical" }, {
      sessionID: "integration-session",
      agent: "author-pattern-consolidator",
      signal: new AbortController().signal,
    });
    assert.equal(JSON.parse(result.content[0].text).status, "blocked");
    assert.equal(coreCalls.length, 1);
    assert.equal(path.resolve(coreCalls[0].repoRoot), REPO_ROOT);
    assert.equal(coreCalls[0].recordsDirectory, options.recordsDirectory ?? DEFAULT_RECORDS_DIRECTORY);
    const review = tools.get("author_review_apply");
    await assert.rejects(review.execute({}, {
      sessionID: "integration-session",
      agent: "build",
      signal: new AbortController().signal,
    }), { code: "AUTHORIZATION_UNAVAILABLE" });
    await cleanup();
    assert.equal(isDisposed(), true);
    await assert.rejects(tools.get("author_patterns_validate").execute({}, {
      sessionID: "integration-session",
      agent: "build",
    }), { code: "CANCELLED" });
    await assert.rejects(prepare.execute({ dimension: "rhetorical" }, {
      sessionID: "integration-session",
      agent: "author-pattern-consolidator",
    }), { code: "CANCELLED" });
  });

  it("allows only approved full result-directory names in the native adapter", async () => {
    const observed = [];
    const core = {
      async prepareConsolidation(_root, _dimension, recordsDirectory) {
        observed.push(recordsDirectory);
        return {
          status: "blocked",
          schema_version: "author-pattern-preparation/0.1",
          corpus_hash: "b".repeat(64),
          diagnostics: [{ code: "PROCESSING_NOT_TRACKED", article_id: "A01" }],
        };
      },
      async acceptDimensionCandidate() { throw new Error("not used"); },
    };
    const adapter = createConsolidationAdapter(core, REPO_ROOT, { recordsDirectory: EXPECTED_RECORDS_DIRECTORY });
    const result = await adapter.prepare({ dimension: "semantic" }, {
      sessionId: "approved-v1-2", agent: "author-pattern-consolidator",
    });
    assert.equal(result.status, "blocked");
    assert.deepEqual(observed, [EXPECTED_RECORDS_DIRECTORY]);
    const defaultAdapter = createConsolidationAdapter(core, REPO_ROOT);
    await defaultAdapter.prepare({ dimension: "semantic" }, {
      sessionId: "default-v1-1", agent: "author-pattern-consolidator",
    });
    assert.equal(observed[1], DEFAULT_RECORDS_DIRECTORY);
    for (const recordsDirectory of ["v1.2", "docs/author-extraction-results/v9.9", "../../private"]) {
      assert.throws(() => createConsolidationAdapter(core, REPO_ROOT, { recordsDirectory }), TypeError);
    }
  });
});
