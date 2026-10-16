import assert from "node:assert/strict";
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

const REPO_ROOT = path.resolve(process.env.AUTHOR_EXTRACTION_TEST_ROOT ?? fileURLToPath(new URL("../../", import.meta.url)));
const AUTO_PLUGIN_DIR = path.join(REPO_ROOT, ".opencode", "plugins");
const EXPECTED_RECORDS_DIRECTORY = "docs/author-extraction-results/v1.2";
const DEFAULT_RECORDS_DIRECTORY = "docs/author-extraction-results/v1.1";
const PACKAGE_DIRECTORY_SPECIFIER = "./plugins/author-pattern-consolidator";

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

async function loadActualPlugin(entrypoint, coreCalls) {
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
  const url = syntheticModule(context, { fileURLToPath }, "node:url");
  const module = new vm.SourceTextModule(await readFile(entrypoint, "utf8"), {
    context,
    identifier: pathToFileURL(entrypoint).href,
    initializeImportMeta(meta) {
      meta.url = pathToFileURL(entrypoint).href;
    },
    importModuleDynamically: async (specifier) => {
      assert.equal(specifier, "../../_scripts/author-extraction/consolidator.mjs?contract=0.5");
      if (core.status === "unlinked") await core.link(() => { throw new Error("unexpected core import"); });
      if (core.status === "linked") await core.evaluate();
      return core;
    },
  });
  await module.link((specifier) => {
    if (specifier === "node:url") return url;
    if (specifier === "../../_scripts/author-extraction/consolidator-native.mjs?contract=0.5") return native;
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

  it("routes the active project plugin through the configured v1.2 corpus", async () => {
    const { entrypoint, options } = await currentPluginSetup();
    const coreCalls = [];
    const plugin = await loadActualPlugin(entrypoint, coreCalls);
    assert.equal(plugin.id, "author-pattern-consolidator");

    // Derive options only from the checked-in project configuration. No test-only v1.2 override.
    const { tools } = await startPlugin(plugin, options);
    assert.deepEqual([...tools.keys()].sort(), [
      "author_pattern_consolidation_prepare",
      "author_pattern_consolidation_submit",
    ]);
    assert.deepEqual(tools.get("author_pattern_consolidation_prepare").input, prepareInputSchema);
    assert.deepEqual(tools.get("author_pattern_consolidation_submit").input, submitInputSchema);
    assert.equal(tools.get("author_pattern_consolidation_prepare").options.codemode, false);
    assert.equal(tools.get("author_pattern_consolidation_submit").options.codemode, false);
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
    await cleanup();
    assert.equal(isDisposed(), true);
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
