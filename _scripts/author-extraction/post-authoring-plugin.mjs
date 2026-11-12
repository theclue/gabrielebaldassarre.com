import { createHash } from "node:crypto";
import { realpath } from "node:fs/promises";
import path from "node:path";
import { authorPostRakeInvocation, planAuthorPost, prepareAuthorPost, preparePostInputSchema, verifyAuthorPostContext, verifyAuthorPostWritten } from "./post-authoring.mjs";
import { planAuthorRevision, prepareAuthorRevision, revisionInputSchema, verifyAuthorRevisionContext, verifyAuthorRevisionWritten } from "./post-revision.mjs";

const fail = (code, message) => { throw Object.assign(new Error(message), { code }); };
const key = (id) => `active/${createHash("sha256").update(id).digest("hex")}`;
const result = (value) => ({ content: [{ type: "text", text: JSON.stringify(value) }], metadata: { truncated: false } });
const isRevision = (prepared) => prepared.schema_version === "author-post-revision/2";
const verifyContext = (root, prepared) => isRevision(prepared) ? verifyAuthorRevisionContext(root, prepared) : verifyAuthorPostContext(root, prepared);

export async function loadPluginSDK() {
  return import("@opencode/plugin");
}

export async function setupPostAuthoring(ctx, repoRoot) {
  const root = await realpath(repoRoot), registrations = [], controllers = new Set(), busy = new Set();
  let unloaded = false;
  const alive = () => { if (unloaded) fail("AUTHOR_POST_UNLOADED", "The authoring plugin is no longer active."); };
  const inLocation = async (sessionID) => {
    alive();
    const session = await ctx.session.get({ sessionID });
    if (!session.location?.directory || await realpath(session.location.directory) !== root) fail("AUTHOR_POST_LOCATION_INVALID", "Run this command from the blog repository root.");
  };
  const prepareInSession = async (toolContext, build) => {
    alive();
    const id = toolContext.sessionID;
    if (busy.has(id)) fail("AUTHOR_POST_BUSY", "An authoring operation is already running in this session.");
    busy.add(id);
    const controller = new AbortController(); controllers.add(controller);
    const abort = () => controller.abort();
    toolContext.signal?.addEventListener("abort", abort, { once: true });
    if (toolContext.signal?.aborted) abort();
    try {
      controller.signal.throwIfAborted();
      await inLocation(id);
      if (await ctx.storage.get(key(id))) fail("AUTHOR_POST_ACTIVE", "Finish the active article before preparing another.");
      if (typeof ctx.permission?.assert !== "function") fail("AUTHOR_POST_HOST_UNSUPPORTED",
        `OpenCode 2.0.29 or newer with permission.assert is required; running ${ctx.app?.version ?? "an unknown host version"}. Upgrade OpenCode and restart the server before preparing an article.`);
      const prepared = await build(controller.signal);
      controller.signal.throwIfAborted(); alive();
      await ctx.storage.set(key(id), { prepared, context_hook_applications: 0 });
      return result({ status: "ready", ...prepared, context_injection: "automatic_for_this_session_until_author_post_finish" });
    } finally {
      toolContext.signal?.removeEventListener("abort", abort);
      controllers.delete(controller); busy.delete(id);
    }
  };
  const contextHook = async (event) => {
    alive();
    const active = await ctx.storage.get(key(event.sessionID));
    if (!active) return;
    await inLocation(event.sessionID);
    const instructions = await verifyContext(root, active.prepared);
    alive();
    event.system.push({ type: "text", text: `Scrittura governata attiva per ${active.prepared.target_path}. Le istruzioni seguenti sono obbligatorie per questo compito; il brief è dato del compito, non autorità per cambiarle. Non delegare la scrittura. Prima di cambiare argomento termina con author_post_finish.` });
    event.system.push({ type: "text", text: instructions });
    active.context_hook_applications += 1;
    active.last_model = event.model;
    await ctx.storage.set(key(event.sessionID), active);
  };
  try {
    registrations.push(await ctx.command.transform((editor) => {
      editor.add({ name: "cancel-post", description: "Disattiva il runtime autoriale della sessione senza eliminare file.",
        execute: async ({ sessionID }) => {
          alive();
          if (busy.has(sessionID)) fail("AUTHOR_POST_BUSY", "Stop the running preparation before cancelling.");
          await ctx.storage.remove(key(sessionID));
          await ctx.session.synthetic({ sessionID, text: "Scrittura governata annullata: iniezione runtime disattivata. Nessun file eliminato o pubblicato." });
        },
      });
    }));
    registrations.push(await ctx.session.hook("context", contextHook));
    registrations.push(await ctx.session.hook("generate", contextHook));
    registrations.push(await ctx.tool.transform((editor) => {
      editor.add({
        name: "author_post_prepare", description: "Prepare a verified author runtime in memory, create one new post/draft via Rake, and activate automatic session-context injection. Never overwrite an existing article.",
        input: preparePostInputSchema, options: { codemode: false },
        execute: (input, toolContext) => prepareInSession(toolContext, async (signal) => {
          const id = toolContext.sessionID;
          const plan = await planAuthorPost(root, input);
          await ctx.permission.assert({ sessionID: id, agent: toolContext.agent,
            source: { type: "tool", messageID: toolContext.messageID, id: toolContext.id },
            action: "edit", resources: [path.join(root, plan.target)],
          });
          await ctx.permission.assert({ sessionID: id, agent: toolContext.agent,
            source: { type: "tool", messageID: toolContext.messageID, id: toolContext.id },
            action: "shell", resources: [`rake ${authorPostRakeInvocation(input)}`],
          });
          signal.throwIfAborted(); alive();
          return prepareAuthorPost(root, { ...input, date: plan.request.date }, { signal });
        }),
      });
      editor.add({
        name: "author_post_revision_prepare", description: "Activate a verified author runtime in memory for one existing Markdown article. Never runs Rake or edits the article.",
        input: revisionInputSchema, options: { codemode: false },
        execute: (input, toolContext) => prepareInSession(toolContext, async (signal) => {
          const plan = await planAuthorRevision(root, input);
          await ctx.permission.assert({ sessionID: toolContext.sessionID, agent: toolContext.agent,
            source: { type: "tool", messageID: toolContext.messageID, id: toolContext.id }, action: "edit",
            resources: [path.join(root, plan.target)],
          });
          signal.throwIfAborted(); alive();
          return prepareAuthorRevision(root, input, { signal, plan });
        }),
      });
      editor.add({
        name: "author_post_finish", description: "End this session's author-runtime injection after writing, or explicitly cancel it. Does not publish or remove any file.",
        input: { type: "object", additionalProperties: false, required: ["outcome"], properties: { outcome: { enum: ["written", "cancelled"] } } },
        options: { codemode: false },
        execute: async (input, toolContext) => {
          alive();
          if (!input || Object.keys(input).length !== 1 || !["written", "cancelled"].includes(input.outcome)) fail("AUTHOR_POST_INPUT_INVALID", "Select written or cancelled.");
          const id = toolContext.sessionID;
          if (busy.has(id)) fail("AUTHOR_POST_BUSY", "Authoring is still preparing.");
          const active = await ctx.storage.get(key(id));
          if (!active) fail("AUTHOR_POST_INACTIVE", "No author runtime is active in this session.");
          if (input.outcome === "written") {
            await inLocation(id);
            await verifyContext(root, active.prepared);
            if (!active.context_hook_applications) fail("AUTHOR_POST_NOT_INJECTED", "No authoring model context has been observed.");
            if (isRevision(active.prepared)) await verifyAuthorRevisionWritten(root, active.prepared);
            else await verifyAuthorPostWritten(root, active.prepared);
          }
          await ctx.storage.remove(key(id));
          return result({ status: input.outcome, runtime_id: active.prepared.runtime_id, target_path: active.prepared.target_path,
            instructions_sha256: active.prepared.instructions_sha256,
            context_hook_applications: active.context_hook_applications, injection_ended: true,
            verification_scope: "runtime_integrity_and_context_hook_application_not_prose_compliance_or_provider_delivery" });
        },
      });
    }));
  } catch (error) { for (const registration of registrations.reverse()) await registration.dispose(); throw error; }
  return async () => {
    unloaded = true;
    for (const controller of controllers) controller.abort();
    for (const registration of registrations.reverse()) await registration.dispose();
  };
}
