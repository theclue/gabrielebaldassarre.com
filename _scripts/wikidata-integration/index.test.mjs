import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { test } from "node:test";

const entryPath = path.join(path.dirname(new URL(import.meta.url).pathname), "index.mjs");
const repositoryRoot = path.resolve(path.dirname(entryPath), "../..");
const integration = existsSync(entryPath) ? await import(pathToFileURL(entryPath).href) : undefined;
const bridgeTest = (name, body) => test(name, { skip: integration ? false : "feature pending: index.mjs not implemented" }, body);
const scratchParent = tmpdir();
const projectID = "wikidata-integration-fixture-project";
const sourceDocument = [
  "---", "title: \"Offline bridge fixture\"", "tags:", "  - shell", "knowledge_prerequisites:",
  "  - concept: zsh", "    label: Z shell", "    sameAs: https://www.wikidata.org/wiki/Q999999",
  "    importance: required", "    depth: 1", "---", "Z shell helps manage commands.", ""
].join("\n");
const concept = { concept_id: "zsh", label: "Z shell", language: "en", context: "Z shell helps manage commands." };

async function withScratchRoot(body) {
  await mkdir(scratchParent, { recursive: true });
  const root = await mkdtemp(path.join(scratchParent, "wikidata-integration-test-"));
  await mkdir(path.join(root, ".git"));
  await mkdir(path.join(root, "_posts"));
  await writeFile(path.join(root, ".wikidata-test-limits.json"), JSON.stringify({
    retrieval_ms: 30_000,
    state_ttl_ms: 10_000,
    http_requests: 10,
    retries_per_request: 0,
    concepts: 1,
    concepts_per_discover: 1,
    candidates_per_concept: 1,
    entities: 2,
    hops: 1,
    arcs: 2,
    document_bytes: 16_384,
    input_line_bytes: 65_536,
    output_bytes: 262_144,
    terminal_reserve_bytes: 65_536,
    validation_ms: 1_000
  }));
  const postPath = path.join(root, "_posts", "fixture.md");
  await writeFile(postPath, sourceDocument, "utf8");
  try {
    return await body({ root, postPath, source: Buffer.from(sourceDocument) });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function createFakeWikidata({ stallSearch = false } = {}) {
  const requests = [];
  let resolveSearch;
  let resolveSearchClosed;
  let searchSeen = false;
  let searchClosed = false;
  const searchObserved = new Promise((resolve) => { resolveSearch = resolve; });
  const searchConnectionClosed = new Promise((resolve) => { resolveSearchClosed = resolve; });
  const server = createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    requests.push({ path: url.pathname, action: url.searchParams.get("action") });
    if (url.pathname === "/sparql") {
      const query = url.searchParams.get("query") ?? "";
      const seed = query.match(/VALUES \?item \{ <([^>]+)>/)?.[1];
      const term = { type: "uri", value: seed ?? "http://www.wikidata.org/entity/Q227308" };
      return sendJson(response, {
        head: { vars: ["item", "property", "value", "subject", "object"] },
        results: { bindings: seed ? [{
          item: term,
          property: { type: "uri", value: "http://www.wikidata.org/prop/direct/P279" },
          value: term, subject: term, object: term
        }] : [] }
      });
    }
    if (url.pathname !== "/w/api.php") return sendJson(response, { error: { code: "unknown_path" } }, 404);
    if (url.searchParams.get("action") === "wbsearchentities") {
      if (stallSearch) {
        if (!searchSeen) { searchSeen = true; resolveSearch(); }
        response.once("close", () => {
          if (!searchClosed) { searchClosed = true; resolveSearchClosed(); }
        });
        return;
      }
      return sendJson(response, { search: [{
        id: "Q227308", label: "Z shell", description: "Unix shell and command language",
        match: { language: "en", text: "Z shell" }
      }] });
    }
    if (url.searchParams.get("action") === "wbgetentities") {
      return sendJson(response, { entities: { Q227308: {
        id: "Q227308",
        labels: { en: { language: "en", value: "Z shell" } },
        descriptions: { en: { language: "en", value: "Unix shell and command language" } },
        aliases: { en: [] }, sitelinks: {}, claims: {}
      } } });
    }
    return sendJson(response, { error: { code: "unknown_action" } }, 400);
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  return {
    requests,
    apiEndpoint: `http://127.0.0.1:${port}/w/api.php`,
    sparqlEndpoint: `http://127.0.0.1:${port}/sparql`,
    waitForSearch: () => searchObserved,
    waitForSearchClose: () => searchConnectionClosed,
    async close() {
      server.closeAllConnections?.();
      await new Promise((resolve) => server.close(resolve));
    }
  };
}

function sendJson(response, payload, status = 200) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function bridgeOptions(root, fake, overrides = {}) {
  return {
    repositoryRoot: root,
    projectID,
    rubyExecutable: process.env.RUBY_EXECUTABLE ?? "ruby",
    userAgent: "Wikidata integration offline test https://gabrielebaldassarre.com",
    apiEndpoint: fake.apiEndpoint,
    sparqlEndpoint: fake.sparqlEndpoint,
    limitsFile: path.join(root, ".wikidata-test-limits.json"),
    ...overrides
  };
}

function callerContext(root, overrides = {}) {
  return { sessionID: "i1-session-fixture", projectID, sessionDirectory: root, signal: new AbortController().signal, ...overrides };
}

function coreRequest(operation, input, run_id) {
  return { operation, input, ...(run_id ? { run_id } : {}) };
}

function withTimeout(promise, milliseconds, message) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), milliseconds); })
  ]).finally(() => clearTimeout(timer));
}

test("annotate-post documents the required decision discriminators and saved responses", async () => {
  const command = await readFile(path.join(repositoryRoot, ".opencode", "commands", "annotate-post.md"), "utf8");
  for (const type of ["select", "abstain", "preserve_existing"]) {
    assert.match(command, new RegExp(`type:\\s*"${type}"`), `${type} must include its wire discriminator`);
  }
  assert.match(command, /managed\s+tool-output file/);
  assert.match(command, /without selecting unseen evidence or writing/);
});

bridgeTest("plugin executor uses the V2 session API and returns the real core receipt", async () => {
  const fixtureDirectory = await mkdtemp(path.join(repositoryRoot, "_drafts", "wikidata-plugin-test-"));
  const postPath = path.join(fixtureDirectory, "fixture.md");
  const sessionID = "ses_wikidata_plugin_contract_test";
  const tools = new Map();
  let registrationDisposed = false;
  let cleanup;
  await writeFile(postPath, sourceDocument, "utf8");
  try {
    const plugin = await integration.createWikidataOraclePlugin();
    assert.equal(plugin.id, "wikidata-oracle");
    cleanup = await plugin.setup({
      tool: {
        async transform(callback) {
          callback({ add(tool) { tools.set(tool.name, tool); } });
          return { async dispose() { registrationDisposed = true; } };
        },
      },
      session: {
        async get(input) {
          assert.deepEqual(input, { sessionID }, "V2 session.get takes a named input object");
          return { id: sessionID, projectID, location: { directory: fixtureDirectory } };
        },
      },
    });
    assert.equal(tools.size, 1);
    const tool = tools.get("wikidata_oracle");
    assert.equal(tool.options.codemode, false);
    assert.equal(tool.input.additionalProperties, false);
    assert.deepEqual(Object.keys(tool.input.properties).sort(), ["input", "operation", "run_id"]);
    const context = { sessionID, signal: new AbortController().signal };
    const execute = async (request) => {
      const result = await tool.execute(request, context);
      const text = typeof result.content === "string" ? result.content : result.content[0].text;
      return JSON.parse(text);
    };
    const opened = await execute(coreRequest("open", {
      post_path: path.relative(repositoryRoot, postPath), concepts: [concept],
    }));
    assert.equal(opened.status, "ok");
    const validated = await execute(coreRequest("validate", {
      proposed_document: sourceDocument,
      acknowledged_snapshot_id: opened.result.snapshot_id,
      decisions: [{ concept_id: "zsh", type: "preserve_existing" }],
    }, opened.run_id));
    assert.equal(validated.status, "ok");
    assert.equal(validated.result.accepted, true);
    assert.equal(validated.result.proposed_sha256, createHash("sha256").update(sourceDocument).digest("hex"));
    const closed = await execute(coreRequest("close", {}, opened.run_id));
    assert.equal(closed.result.closed, true);
    assert.equal(closed.result.validation_outcome, "accepted");
    assert.equal(closed.result.http_requests_used, 0, "plugin contract test is entirely offline");
    assert.equal(await readFile(postPath, "utf8"), sourceDocument, "plugin remains read-only");
    await cleanup();
    assert.equal(registrationDisposed, true);
    await assert.rejects(tool.execute(coreRequest("open", {}), context), /no longer active/);
  } finally {
    await cleanup?.();
    await rm(fixtureDirectory, { recursive: true, force: true });
  }
});

bridgeTest("offline child lifecycle serializes calls and validates without writing", async () => {
  await withScratchRoot(async ({ root, postPath, source }) => {
    const fake = await createFakeWikidata();
    const bridge = integration.createWikidataOracleBridge(bridgeOptions(root, fake));
    const context = callerContext(root);
    try {
      assert.equal(typeof integration.createWikidataOraclePlugin, "function");
      const opened = await bridge.execute(coreRequest("open", { post_path: "_posts/fixture.md", concepts: [concept] }), context);
      assert.equal(opened.status, "ok");
      assert.ok(opened.run_id);
      const request = coreRequest("discover", { concept_ids: ["zsh"] }, opened.run_id);
      const [first, second] = await Promise.all([bridge.execute(request, context), bridge.execute(request, context)]);
      assert.equal(first.status, "ok");
      assert.equal(second.status, "ok");
      assert.notEqual(first.request_id, second.request_id);
      const candidate = first.result.concept_results[0].candidates[0];
      const expanded = await bridge.execute(coreRequest("expand", { selections: [{
        concept_id: "zsh", candidate_id: candidate.candidate_id, evidence_ids: candidate.evidence_ids,
        rationale: "Selected the delivered fake candidate in this offline integration test.", hop: 1
      }] }, opened.run_id), context);
      assert.equal(expanded.status, "ok");
      assert.equal(expanded.result.arcs.length, 1);
      assert.ok(expanded.result.evidence.some((entry) => entry.source === "wdqs"));
      const proposed = source.toString("utf8").replace(
        "sameAs: https://www.wikidata.org/wiki/Q999999", "sameAs: https://www.wikidata.org/wiki/Q227308"
      );
      const validated = await bridge.execute(coreRequest("validate", {
        proposed_document: proposed,
        acknowledged_snapshot_id: opened.result.snapshot_id,
        decisions: [{
          concept_id: "zsh", candidate_id: candidate.candidate_id, evidence_ids: candidate.evidence_ids,
          rationale: "Selected the candidate delivered by this run.",
          proposed_sameAs: "https://www.wikidata.org/wiki/Q227308", type: "select"
        }]
      }, opened.run_id), context);
      assert.equal(validated.status, "ok");
      assert.equal(validated.result.accepted, true);
      assert.equal(validated.result.proposed_sha256, createHash("sha256").update(proposed).digest("hex"));
      assert.equal(validated.result.proposed_size_bytes, Buffer.byteLength(proposed));
      const closed = await bridge.execute(coreRequest("close", {}, opened.run_id), context);
      assert.equal(closed.result.closed, true);
      assert.equal(closed.result.validation_outcome, "accepted");
      await bridge.dispose();
      assert.deepEqual(await readFile(postPath), source, "bridge requests must not write the target");
      assert.equal(fake.requests.filter((entry) => entry.path === "/w/api.php").length, 4);
      assert.equal(fake.requests.filter((entry) => entry.path === "/sparql").length, 1);
    } finally {
      await bridge.dispose();
      await fake.close();
    }
  });
});

bridgeTest("foreign project/session and model launcher overrides are refused before spawn", async () => {
  await withScratchRoot(async ({ root }) => {
    const fake = await createFakeWikidata();
    const marker = path.join(root, "unexpected-child-start.txt");
    const sentinelRuby = path.join(root, "ruby-sentinel.mjs");
    const sentinel = ["#!/usr/bin/env node", "import { writeFileSync } from 'node:fs';",
      `writeFileSync(${JSON.stringify(marker)}, 'spawned');`, "process.exit(93);", ""].join("\n");
    await writeFile(sentinelRuby, sentinel);
    await chmod(sentinelRuby, 0o755);
    const bridge = integration.createWikidataOracleBridge(bridgeOptions(root, fake, { rubyExecutable: sentinelRuby }));
    const input = { post_path: "_posts/fixture.md", concepts: [concept] };
    try {
      await assert.rejects(bridge.execute({
        ...coreRequest("open", input),
        repositoryRoot: path.dirname(root),
        rubyExecutable: "model-selected-ruby",
        userAgent: "model-selected-agent",
        apiEndpoint: "https://model.invalid/api",
        sparqlEndpoint: "https://model.invalid/sparql",
        limitsFile: "/model/selected-limits.json"
      }, callerContext(root)));
      await assert.rejects(bridge.execute(coreRequest("open", input), callerContext(root, { projectID: "foreign-project" })));
      const outsideSession = path.join(path.dirname(root), `${path.basename(root)}-outside`);
      await mkdir(outsideSession);
      try {
        await assert.rejects(bridge.execute(coreRequest("open", input), callerContext(root, { sessionDirectory: outsideSession })));
      } finally {
        await rm(outsideSession, { recursive: true, force: true });
      }
      assert.equal(await readFile(marker).then(() => true, () => false), false);
      assert.equal(fake.requests.length, 0);
    } finally {
      await bridge.dispose();
      await fake.close();
    }
  });
});

bridgeTest("an unexpected idle child exit does not reuse its run ID with a replacement child", async () => {
  await withScratchRoot(async ({ root }) => {
    const fake = await createFakeWikidata();
    const eventsPath = path.join(root, "child-events.jsonl");
    const fixtureRuby = path.join(root, "controlled-child.mjs");
    const fixture = [
      "#!/usr/bin/env node",
      "import { appendFileSync, existsSync } from 'node:fs';",
      "import { createInterface } from 'node:readline';",
      `const eventsPath = ${JSON.stringify(eventsPath)};`,
      "const append = (event) => appendFileSync(eventsPath, JSON.stringify(event) + '\\n');",
      "append({ event: 'spawn', pid: process.pid });",
      "const input = createInterface({ input: process.stdin });",
      "input.on('line', (line) => {",
      "  const request = JSON.parse(line);",
      "  append({ event: 'request', pid: process.pid, operation: request.operation, run_id: request.run_id });",
      "  const response = { request_id: request.request_id, status: 'ok' };",
      "  if (request.operation === 'open') response.run_id = 'fixture-run-id';",
      "  process.stdout.write(JSON.stringify(response) + '\\n');",
      "});",
      `const exitFile = ${JSON.stringify(root)} + '/exit-' + process.pid;`,
      "const exitCheck = setInterval(() => {",
      "  if (!existsSync(exitFile)) return;",
      "  clearInterval(exitCheck);",
      "  append({ event: 'exit', pid: process.pid });",
      "  process.exit(0);",
      "}, 5);",
      ""
    ].join("\n");
    await writeFile(fixtureRuby, fixture);
    await chmod(fixtureRuby, 0o755);
    const bridge = integration.createWikidataOracleBridge(bridgeOptions(root, fake, { rubyExecutable: fixtureRuby }));
    try {
      const opened = await bridge.execute(
        coreRequest("open", { post_path: "_posts/fixture.md", concepts: [concept] }),
        callerContext(root)
      );
      assert.equal(opened.status, "ok");
      assert.equal(opened.run_id, "fixture-run-id");

      const initialEvents = (await readFile(eventsPath, "utf8")).trim().split("\n").map((line) => JSON.parse(line));
      const originalChild = initialEvents.find((event) => event.event === "spawn");
      assert.ok(originalChild, "the controlled child should have started");
      await writeFile(path.join(root, `exit-${originalChild.pid}`), "exit");
      await withTimeout((async () => {
        while (true) {
          const events = (await readFile(eventsPath, "utf8")).trim().split("\n").map((line) => JSON.parse(line));
          if (events.some((event) => event.event === "exit" && event.pid === originalChild.pid)) return;
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
      })(), 1_500, "controlled idle child did not exit");
      // Allow the bridge's child-close event to run before issuing the next request.
      await new Promise((resolve) => setTimeout(resolve, 50));

      const outcome = await bridge.execute(
        coreRequest("discover", { concept_ids: ["zsh"] }, opened.run_id),
        callerContext(root)
      ).then((response) => ({ response }), (error) => ({ error }));
      const events = (await readFile(eventsPath, "utf8")).trim().split("\n").map((line) => JSON.parse(line));
      const staleRequests = events.filter((event) => event.event === "request" &&
        event.operation === "discover" && event.run_id === opened.run_id);
      assert.equal(staleRequests.length, 0,
        `unexpected idle exit sent the stale run ID to a replacement child: ${JSON.stringify(staleRequests)}`);
      assert.equal(events.filter((event) => event.event === "spawn").length, 1,
        "unexpected idle exit should invalidate the bridge before another child is spawned");
      assert.equal(events.filter((event) => event.event === "request" && event.operation === "discover").length, 0,
        "the stale run ID must not be sent to a replacement child");
      assert.ok(outcome.error, "a dead child must not be silently replaced while retaining its run ID");
    } finally {
      await bridge.dispose();
      await fake.close();
    }
  });
});

bridgeTest("aborting retrieval closes the fake exchange and dispose settles", async () => {
  await withScratchRoot(async ({ root }) => {
    const fake = await createFakeWikidata({ stallSearch: true });
    const bridge = integration.createWikidataOracleBridge(bridgeOptions(root, fake));
    try {
      const opened = await bridge.execute(coreRequest("open", { post_path: "_posts/fixture.md", concepts: [concept] }), callerContext(root));
      const controller = new AbortController();
      const pending = bridge.execute(
        coreRequest("discover", { concept_ids: ["zsh"] }, opened.run_id),
        callerContext(root, { signal: controller.signal })
      );
      await withTimeout(fake.waitForSearch(), 1_500, "fake retrieval was never started");
      controller.abort(new Error("offline cancellation test"));
      const outcome = await withTimeout(pending.then((response) => ({ response }), (error) => ({ error })), 2_000, "cancelled call did not settle");
      assert.ok(outcome.error || outcome.response?.status === "invalidated", "cancellation may not deliver a late success");
      await withTimeout(fake.waitForSearchClose(), 2_000, "aborted child left its HTTP exchange open");
      await withTimeout(bridge.dispose(), 2_000, "dispose did not settle after cancellation");
    } finally {
      await bridge.dispose();
      await fake.close();
    }
  });
});
