import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { parse as parseYaml } from 'yaml';
import { applyAuthorReview, prepareAuthorReview, validateAuthorPatterns } from './review.mjs';

const PACKAGE_DIR = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const APPROVED_TEMP = tmpdir();
const SOURCE_DIRECTORY = 'docs/author-pattern-results/v1.3';
const DIMENSIONS = ['rhetorical', 'epistemic', 'decisional', 'semantic'];
const HASH = (bytes) => createHash('sha256').update(bytes).digest('hex');

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(canonical(value));
}

async function copyFileIntoFixture(root, relative) {
  const destination = join(root, relative);
  await mkdir(dirname(destination), { recursive: true });
  await cp(join(REPO_ROOT, relative), destination);
}

// These fixtures are byte-for-byte copies of the frozen corpus inputs. All
// synthetic review decisions below exist only in a temporary scratch root.
async function makeFixture(t) {
  const root = await mkdtemp(join(APPROVED_TEMP, 'author-review-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));

  for (const relative of [
    'docs/corpus.yaml',
    'docs/author-extraction-results/v1.3',
    '_scripts/author-extraction/extraction.v1.3.schema.json',
    '_scripts/author-extraction/patterns.v0.6.schema.json',
    '_scripts/author-extraction/author-review.schema.json',
    '.opencode/agents/author-extractor.md',
    '.opencode/agents/author-pattern-consolidator.md',
    `${SOURCE_DIRECTORY}/decisional.json`,
    `${SOURCE_DIRECTORY}/epistemic.json`,
    `${SOURCE_DIRECTORY}/rhetorical.json`,
    `${SOURCE_DIRECTORY}/semantic.json`,
    `${SOURCE_DIRECTORY}/consolidated-candidates.json`,
  ]) {
    const source = join(REPO_ROOT, relative);
    const destination = join(root, relative);
    await mkdir(dirname(destination), { recursive: true });
    await cp(source, destination, { recursive: true });
  }

  const corpus = parseYaml(await readFile(join(root, 'docs/corpus.yaml'), 'utf8'));
  for (const entry of corpus.fonti) await copyFileIntoFixture(root, entry.percorso);
  return root;
}

function setAuthorDecision(review, decision, { correctness = 'yes', risk = 'low' } = {}) {
  review.decision = decision;
  review.correctness = correctness;
  review.notes = null;
  if (decision === 'accept' || decision === 'revise') {
    review.applicability = 'Usable only in the locally evidenced contexts represented by this group.';
    review.author_relevance = 'contextual';
    review.generative_utility = 'descriptive_only';
    review.overuse_risk = risk;
  } else {
    review.applicability = null;
    review.author_relevance = null;
    review.generative_utility = null;
    review.overuse_risk = null;
  }
  if (decision === 'revise') {
    const revision = {
      label: `Reviewed ${review.source_pattern_id}`,
      description: `A bounded human revision of ${review.source_pattern_id}.`,
      abstraction_kind: null,
    };
    if (review.dimension === 'rhetorical') revision.pattern_scope = null;
    else revision.classification = null;
    review.revision = revision;
  } else {
    review.revision = null;
  }
}

function completeSheet(sheet, { mergeSemantic = false } = {}) {
  const semanticToMerge = mergeSemantic
    ? sheet.reviews.filter((review) => review.dimension === 'semantic').slice(0, 2)
    : [];
  for (const review of sheet.reviews) {
    if (review.dimension === 'semantic') {
      review.correctness = 'yes';
      review.notes = null;
      if (semanticToMerge.includes(review)) {
        review.decision = 'merge';
        review.applicability = null;
        review.revision = null;
        review.merge_key = 'semantic-whole-group-fixture';
      } else if (review.source_pattern_id === sheet.reviews.find((entry) => entry.dimension === 'semantic')?.source_pattern_id) {
        review.decision = 'revise';
        review.applicability = 'The revised semantic formulation applies only where the cited concepts occur.';
        review.revision = {
          label: `Reframed ${review.source_pattern_id}`,
          description: `A corrected semantic formulation for ${review.source_pattern_id}.`,
          semantic_kind: null,
          abstraction_kind: null,
        };
        review.merge_key = null;
      } else if (sheet.reviews.filter((entry) => entry.dimension === 'semantic').indexOf(review) === 1) {
        review.decision = 'discard';
        review.applicability = null;
        review.revision = null;
        review.merge_key = null;
      } else {
        review.decision = 'retain';
        review.applicability = 'Only in the observed local source contexts.';
        review.revision = null;
        review.merge_key = null;
      }
      continue;
    }

    const index = sheet.reviews.filter((entry) => entry.dimension === review.dimension).indexOf(review);
    const authorDecisions = ['accept', 'revise', 'reject', 'defer'];
    let decision = authorDecisions[index % authorDecisions.length];
    const candidate = sheet.candidates.find((entry) => entry.dimension === review.dimension
      && entry.source_pattern_id === review.source_pattern_id)?.candidate;
    if (review.dimension === 'decisional' && candidate?.classification === 'thematic' && decision === 'accept') {
      decision = 'reject';
    }
    setAuthorDecision(review, decision, {
      correctness: ['yes', 'partial', 'no'][index % 3],
      risk: index % 2 === 0 ? 'high' : 'medium',
    });
    if (review.dimension === 'decisional' && decision === 'revise' && candidate?.classification === 'thematic') {
      review.revision.classification = 'author_candidate';
    }
  }

  if (mergeSemantic) {
    const participants = semanticToMerge.map((review) => review.source_pattern_id);
    sheet.semantic_merges = [{
      merge_key: 'semantic-whole-group-fixture',
      source_pattern_ids: participants,
      label: 'Fixture-only combined semantic concept',
      description: 'A human-authored synthesis of exactly the listed source groups.',
      semantic_kind: 'concept',
      abstraction_kind: 'inferred_generalization',
      applicability: 'Only within the local contexts evidenced by the union of both groups.',
      notes: 'Synthetic completed-review fixture; not an actual author decision.',
    }];
  }
  return sheet;
}

async function pendingSheet(root) {
  return JSON.parse(await prepareAuthorReview(root));
}

async function completedReview(root, options) {
  return JSON.stringify(completeSheet(await pendingSheet(root), options));
}

async function rejection(promise) {
  let error;
  try { await promise; } catch (caught) { error = caught; }
  assert.ok(error instanceof Error, 'expected a structured review rejection');
  assert.equal(typeof error.code, 'string');
  assert.ok(error.code.length > 0);
  assert.ok(error.message.length <= 240, 'error message must be bounded');
  assert.ok(Array.isArray(error.details));
  assert.ok(error.details.length <= 5);
  return error;
}

async function sourceBytes(root) {
  return Promise.all(DIMENSIONS.map(async (dimension) => {
    const path = join(root, SOURCE_DIRECTORY, `${dimension}.json`);
    return [path, await readFile(path)];
  }));
}

describe('offline author-review contract', () => {
  it('validates the frozen corpus and prepares a deterministic, complete pending sheet without persisting it', async (t) => {
    const root = await makeFixture(t);
    const originalSources = await sourceBytes(root);
    const beforeNames = (await readdir(join(root, SOURCE_DIRECTORY))).sort();

    const report = await validateAuthorPatterns(root);
    assert.equal(report.schema_version, 'author-pattern-validation/1');
    assert.equal(report.total_groups, 52);
    assert.equal(report.total_observations, 217);
    assert.equal(report.total_evidence, 246);
    assert.deepEqual(report.per_dimension.map(({ dimension, groups }) => [dimension, groups]), [
      ['rhetorical', 13], ['epistemic', 16], ['semantic', 9], ['decisional', 14],
    ]);

    const first = await prepareAuthorReview(root);
    const second = await prepareAuthorReview(root);
    assert.equal(first, second);
    assert.equal(first, `${JSON.stringify(JSON.parse(first), null, 2)}\n`);
    const sheet = JSON.parse(first);
    assert.equal(sheet.schema_version, 'author-pattern-review/1');
    assert.equal(sheet.reviews.length, 52);
    assert.equal(sheet.observation_index.length, 217);
    assert.equal(sheet.reviews.filter((entry) => entry.dimension === 'semantic').length, 9);
    assert.ok(sheet.reviews.every((review) => Object.entries(review)
      .filter(([key]) => key !== 'dimension' && key !== 'source_pattern_id')
      .every(([, value]) => value === null)));
    assert.equal(sheet.semantic_merges.length, 0);
    assert.equal(sheet.candidates.reduce((sum, item) => sum + item.candidate.support.length, 0), 131);
    assert.equal(sheet.passage_context_index.length, 229);
    assert.equal(sheet.unclustered_coverage.reduce((sum, dimension) => sum + dimension.observations.length, 0), 86);

    const rawGroups = [];
    for (const dimension of DIMENSIONS) {
      const source = JSON.parse(await readFile(join(root, SOURCE_DIRECTORY, `${dimension}.json`), 'utf8'));
      for (const candidate of source.groups) rawGroups.push({ dimension, source_pattern_id: candidate.id, candidate });
    }
    const sortSnapshots = (entries) => [...entries].sort((left, right) => left.source_pattern_id.localeCompare(right.source_pattern_id));
    assert.deepEqual(sortSnapshots(sheet.candidates), sortSnapshots(rawGroups.map((entry) => ({
      dimension: entry.dimension,
      source_pattern_id: entry.source_pattern_id,
      candidate: entry.candidate,
    }))));

    const sourceObservations = new Map();
    for (let index = 1; index <= 20; index += 1) {
      const articleId = `A${String(index).padStart(2, '0')}`;
      const record = JSON.parse(await readFile(join(root, 'docs/author-extraction-results/v1.3', `${articleId}.json`), 'utf8'));
      for (const observation of record.observations) sourceObservations.set(observation.id, { articleId, observation });
    }
    assert.ok(sheet.observation_index.every((entry) => {
      const original = sourceObservations.get(entry.observation_id);
      return original !== undefined && entry.source_article_id === original.articleId
        && entry.dimension === original.observation.dimension
        && canonicalJson(entry.observation) === canonicalJson(original.observation);
    }));
    const bindingForHash = structuredClone(sheet.binding);
    delete bindingForHash.review_source_hash;
    assert.equal(sheet.binding.review_source_hash, HASH(canonicalJson(bindingForHash)));

    for (const [path, expected] of originalSources) assert.deepEqual(await readFile(path), expected);
    assert.deepEqual((await readdir(join(root, SOURCE_DIRECTORY))).sort(), beforeNames);
    assert.equal(await exists(join(root, SOURCE_DIRECTORY, 'reviewed-author-patterns.json')), false);
    assert.equal(await exists(join(root, SOURCE_DIRECTORY, 'reviewed-semantic-model.json')), false);
  });

  it('applies explicit accept/revise/reject/defer and retain/revise/discard judgments without hidden value filtering', async (t) => {
    const root = await makeFixture(t);
    const input = await completedReview(root);
    const result = await applyAuthorReview(root, input);
    assert.equal(result.schema_version, 'author-review-transformation/1');
    assert.match(result.review_source_hash, /^[a-f0-9]{64}$/);
    assert.match(result.completed_review_hash, /^[a-f0-9]{64}$/);
    assert.equal(result.completed_review_hash, HASH(canonicalJson(JSON.parse(input))));
    assert.equal(result.reviewed_author_patterns_sha256, HASH(result.reviewed_author_patterns_json));
    assert.equal(result.reviewed_semantic_model_sha256, HASH(result.reviewed_semantic_model_json));

    const authors = JSON.parse(result.reviewed_author_patterns_json);
    const semantic = JSON.parse(result.reviewed_semantic_model_json);
    assert.equal(authors.schema_version, 'reviewed-author-patterns/1');
    assert.equal(semantic.schema_version, 'reviewed-semantic-model/1');
    assert.equal(authors.observation_index.length, 217);
    assert.equal(semantic.observation_index.length, 217);
    const pending = await pendingSheet(root);
    assert.equal(authors.passage_context_index.length, pending.passage_context_index.length);
    assert.equal(authors.passage_context_index.length, 229);
    assert.equal(authors.audit.length, 52);
    assert.equal(semantic.audit.length, 9);

    const decisions = new Set(authors.audit.filter(({ dimension }) => dimension !== 'semantic')
      .map(({ review }) => review.decision));
    assert.deepEqual(decisions, new Set(['accept', 'revise', 'reject', 'defer']));
    assert.ok(authors.audit.filter(({ review }) => ['reject', 'defer'].includes(review.decision))
      .every(({ review }) => review.applicability === null && review.revision === null
        && review.author_relevance === null && review.generative_utility === null && review.overuse_risk === null));
    assert.ok(authors.reviewed_entries.some((entry) => entry.author_relevance === 'contextual'
      && entry.generative_utility === 'descriptive_only' && entry.overuse_risk === 'high'));
    assert.ok(authors.reviewed_entries.some((entry) => entry.author_relevance === 'contextual'
      && entry.generative_utility === 'descriptive_only' && entry.overuse_risk === 'medium'));
    assert.equal(authors.reviewed_entries.length,
      authors.audit.filter(({ dimension, review }) => dimension !== 'semantic' && ['accept', 'revise'].includes(review.decision)).length,
      'only explicit accept/revise decisions promote, regardless of assessment values');
    assert.equal(semantic.reviewed_entries.length, 8, 'semantic discards are audited but not promoted');
    assert.ok(authors.audit.every((entry) => entry.candidate.candidate.id === entry.source_pattern_id
      || entry.candidate.source_pattern_id === entry.source_pattern_id));
  });

  it('allows local-only candidates and partial/no correctness when explicitly approved', async (t) => {
    const root = await makeFixture(t);
    const sheet = completeSheet(await pendingSheet(root));
    const rhetorical = sheet.reviews.find((review) => review.dimension === 'rhetorical');
    setAuthorDecision(rhetorical, 'accept', { correctness: 'partial' });
    rhetorical.author_relevance = 'none';
    rhetorical.generative_utility = 'none';
    rhetorical.overuse_risk = 'high';
    rhetorical.applicability = 'Only as a local pattern in the cited articles.';
    const epistemic = sheet.reviews.find((review) => review.dimension === 'epistemic');
    setAuthorDecision(epistemic, 'revise', { correctness: 'no' });

    const output = await applyAuthorReview(root, JSON.stringify(sheet));
    const authors = JSON.parse(output.reviewed_author_patterns_json);
    assert.ok(authors.reviewed_entries.some((entry) => entry.source_pattern_id === rhetorical.source_pattern_id
      && entry.author_relevance === 'none' && entry.generative_utility === 'none' && entry.overuse_risk === 'high'));
    assert.ok(authors.audit.some((entry) => entry.source_pattern_id === rhetorical.source_pattern_id
      && entry.review.correctness === 'partial'));
    assert.ok(authors.audit.some((entry) => entry.source_pattern_id === epistemic.source_pattern_id
      && entry.review.correctness === 'no'));
  });

  it('applies revised author classification and abstraction while preserving source identities', async (t) => {
    const root = await makeFixture(t);
    const sheet = completeSheet(await pendingSheet(root));
    const original = sheet.reviews.find((review) => review.dimension === 'decisional');
    const snapshot = sheet.candidates.find((entry) => entry.dimension === 'decisional'
      && entry.source_pattern_id === original.source_pattern_id).candidate;
    setAuthorDecision(original, 'revise', { correctness: 'partial' });
    original.revision.label = `${snapshot.label} revised`;
    original.revision.description = `${snapshot.description} Corrected for the reviewed interpretation.`;
    original.revision.classification = snapshot.classification === 'author_candidate' ? 'editorial_format' : 'author_candidate';
    original.revision.abstraction_kind = snapshot.abstraction_kind === 'observed_regularities'
      ? 'inferred_generalization' : 'observed_regularities';

    const output = await applyAuthorReview(root, JSON.stringify(sheet));
    const authors = JSON.parse(output.reviewed_author_patterns_json);
    const changed = authors.reviewed_entries.find((entry) => entry.source_pattern_id === original.source_pattern_id);
    assert.equal(changed.source_pattern_id, snapshot.id);
    assert.notEqual(changed.label, snapshot.label);
    assert.notEqual(changed.abstraction_kind, snapshot.abstraction_kind);
    assert.notEqual(changed.type, snapshot.classification);
    assert.ok(changed.support.length > 0);
    assert.equal(changed.observation_count, snapshot.observation_count);
  });

  it('rejects a thematic decisional acceptance but accepts an explicit corrective revision', async (t) => {
    const root = await makeFixture(t);
    const bad = completeSheet(await pendingSheet(root));
    const target = bad.reviews.find((review) => review.dimension === 'decisional'
      && bad.candidates.find((entry) => entry.source_pattern_id === review.source_pattern_id).candidate.classification === 'thematic');
    const candidate = bad.candidates.find((entry) => entry.source_pattern_id === target.source_pattern_id).candidate;
    assert.equal(candidate.classification, 'thematic');
    setAuthorDecision(target, 'accept');
    await rejection(applyAuthorReview(root, JSON.stringify(bad)));

    const good = completeSheet(await pendingSheet(root));
    const revised = good.reviews.find((review) => review.dimension === 'decisional'
      && good.candidates.find((entry) => entry.source_pattern_id === review.source_pattern_id).candidate.classification === 'thematic');
    setAuthorDecision(revised, 'revise');
    revised.revision.classification = 'author_candidate';
    const output = await applyAuthorReview(root, JSON.stringify(good));
    const authors = JSON.parse(output.reviewed_author_patterns_json);
    assert.ok(authors.reviewed_entries.some((entry) => entry.source_pattern_id === revised.source_pattern_id
      && entry.type === 'author_candidate'));
  });

  it('applies an explicit semantic-kind correction without changing the source pattern ID', async (t) => {
    const root = await makeFixture(t);
    const sheet = await pendingSheet(root);
    const review = sheet.reviews.find((entry) => entry.dimension === 'semantic');
    const snapshot = sheet.candidates.find((entry) => entry.dimension === 'semantic'
      && entry.source_pattern_id === review.source_pattern_id).candidate;
    review.decision = 'revise';
    review.correctness = 'partial';
    review.applicability = 'The corrected relation formulation is limited to its cited contexts.';
    review.revision = {
      label: `${snapshot.label} (relazione)`,
      description: `${snapshot.description} The reviewed formulation is relational.`,
      semantic_kind: snapshot.semantic_kind === 'concept' ? 'relation' : 'concept',
      abstraction_kind: null,
    };

    const completed = completeSheet(sheet);
    const completedReviewEntry = completed.reviews.find((entry) => entry.source_pattern_id === review.source_pattern_id);
    completedReviewEntry.decision = 'revise';
    completedReviewEntry.correctness = 'partial';
    completedReviewEntry.applicability = 'The corrected relation formulation is limited to its cited contexts.';
    completedReviewEntry.revision = {
      label: `${snapshot.label} (relazione)`,
      description: `${snapshot.description} The reviewed formulation is relational.`,
      semantic_kind: snapshot.semantic_kind === 'concept' ? 'relation' : 'concept',
      abstraction_kind: null,
    };
    const output = await applyAuthorReview(root, JSON.stringify(completed));
    const model = JSON.parse(output.reviewed_semantic_model_json);
    const entry = model.reviewed_entries.find((candidate) => candidate.source_pattern_ids.includes(review.source_pattern_id));
    assert.equal(entry.source_pattern_ids[0], snapshot.id);
    assert.notEqual(entry.semantic_kind, snapshot.semantic_kind);
    assert.equal(entry.role, entry.semantic_kind === 'concept' ? 'corpus_concept' : 'corpus_relation');
  });

  it('supports explicit whole-group semantic merges across kinds with union support and no synthetic identity', async (t) => {
    const root = await makeFixture(t);
    const sheet = completeSheet(await pendingSheet(root), { mergeSemantic: true });
    const participants = sheet.semantic_merges[0].source_pattern_ids;
    const sources = sheet.candidates.filter((entry) => entry.dimension === 'semantic'
      && participants.includes(entry.source_pattern_id));
    assert.equal(sources.length, 2);
    const kinds = new Set(sources.map(({ candidate }) => candidate.semantic_kind));
    if (kinds.size === 1) {
      const different = sheet.candidates.find((entry) => entry.dimension === 'semantic'
        && !participants.includes(entry.source_pattern_id) && entry.candidate.semantic_kind !== sources[0].candidate.semantic_kind);
      if (different) {
        const extra = sheet.reviews.find((review) => review.dimension === 'semantic'
          && review.source_pattern_id === different.source_pattern_id);
        const nextMerge = sheet.reviews.find((review) => review.dimension === 'semantic'
          && review.source_pattern_id === participants[1]);
        nextMerge.decision = 'retain';
        nextMerge.applicability = 'Only within its local source contexts.';
        nextMerge.merge_key = null;
        extra.decision = 'merge';
        extra.applicability = null;
        extra.merge_key = sheet.semantic_merges[0].merge_key;
        sheet.semantic_merges[0].source_pattern_ids = [participants[0], different.source_pattern_id];
      }
    }
    const merge = sheet.semantic_merges[0];
    const union = sheet.candidates.filter((entry) => entry.dimension === 'semantic'
      && merge.source_pattern_ids.includes(entry.source_pattern_id))
      .flatMap((entry) => entry.candidate.support)
      .filter((item, index, all) => all.findIndex((entry) => entry.observation_id === item.observation_id) === index);
    const result = await applyAuthorReview(root, JSON.stringify(sheet));
    const model = JSON.parse(result.reviewed_semantic_model_json);
    assert.deepEqual(model.semantic_merges[0].source_pattern_ids, merge.source_pattern_ids);
    const mergedEntry = model.reviewed_entries.find((entry) => entry.decision === 'merge');
    assert.deepEqual(mergedEntry.source_pattern_ids, merge.source_pattern_ids);
    assert.equal(mergedEntry.observation_count, union.length);
    assert.deepEqual(new Set(mergedEntry.support.map(({ observation_id }) => observation_id)),
      new Set(union.map(({ observation_id }) => observation_id)));
    assert.ok(!model.reviewed_entries.some((entry) => entry.source_pattern_ids.length === 1
      && entry.source_pattern_ids[0].startsWith('MERGED')));
    assert.equal(mergedEntry.semantic_kind, merge.semantic_kind);
  });

  it('rejects incomplete, duplicated, unknown, or invalid review entries and malformed/oversized JSON', async (t) => {
    const root = await makeFixture(t);
    const base = await pendingSheet(root);

    const incomplete = structuredClone(base);
    incomplete.reviews[0].decision = 'accept';
    await rejection(applyAuthorReview(root, JSON.stringify(incomplete)));

    const missing = structuredClone(completeSheet(structuredClone(base)));
    missing.reviews.pop();
    await rejection(applyAuthorReview(root, JSON.stringify(missing)));

    const duplicate = structuredClone(completeSheet(structuredClone(base)));
    duplicate.reviews[1] = structuredClone(duplicate.reviews[0]);
    await rejection(applyAuthorReview(root, JSON.stringify(duplicate)));

    const unknown = structuredClone(completeSheet(structuredClone(base)));
    unknown.unrecognized_review_field = true;
    await rejection(applyAuthorReview(root, JSON.stringify(unknown)));

    const invalidEnum = structuredClone(completeSheet(structuredClone(base)));
    invalidEnum.reviews[0].decision = 'automatically_promote';
    await rejection(applyAuthorReview(root, JSON.stringify(invalidEnum)));

    await rejection(applyAuthorReview(root, '{"schema_version":"x","schema_version":"y"}'));
    await rejection(applyAuthorReview(root, 'x'.repeat(8 * 1024 * 1024 + 1)));
  });

  it('rejects no-op revisions, edited immutable snapshots/evidence/contexts/counts, and fabricated source IDs', async (t) => {
    const root = await makeFixture(t);
    const pending = await pendingSheet(root);
    const target = pending.reviews.find((review) => review.dimension === 'rhetorical');

    const noop = structuredClone(completeSheet(structuredClone(pending)));
    const noopReview = noop.reviews.find((review) => review.source_pattern_id === target.source_pattern_id);
    const original = noop.candidates.find((entry) => entry.source_pattern_id === target.source_pattern_id).candidate;
    setAuthorDecision(noopReview, 'revise');
    Object.assign(noopReview.revision, { label: original.label, description: original.description });
    await rejection(applyAuthorReview(root, JSON.stringify(noop)));

    for (const edit of [
      (sheet) => { sheet.candidates[0].candidate.label += ' altered'; },
      (sheet) => { sheet.candidates[0].candidate.observation_count += 1; },
      (sheet) => { sheet.candidates[0].candidate.support[0].observation_id = 'A01::O9999'; },
      (sheet) => { sheet.candidates[0].candidate.variation_notes[0] += ' altered'; },
      (sheet) => { sheet.observation_index[0].observation.evidence[0].quote += ' altered'; },
      (sheet) => { sheet.passage_context_index[0].text += ' altered'; },
      (sheet) => { sheet.candidates[0].candidate.id = 'APC::R9999'; },
    ]) {
      const changed = structuredClone(completeSheet(structuredClone(pending)));
      edit(changed);
      await rejection(applyAuthorReview(root, JSON.stringify(changed)));
    }

    const fabricated = structuredClone(completeSheet(structuredClone(pending)));
    const selected = fabricated.reviews.find((review) => review.dimension === 'semantic');
    selected.decision = 'merge';
    selected.applicability = null;
    selected.merge_key = 'fabricated-id';
    fabricated.semantic_merges = [{
      merge_key: 'fabricated-id', source_pattern_ids: [selected.source_pattern_id, 'SPC::C9999'],
      label: 'Invalid fabricated group', description: 'Must refer only to existing complete groups.',
      semantic_kind: 'concept', abstraction_kind: 'observed_regularities',
      applicability: 'Not valid.', notes: null,
    }];
    await rejection(applyAuthorReview(root, JSON.stringify(fabricated)));
  });

  it('rejects partial, overlapping, chained, dangling, or inconsistent semantic merges', async (t) => {
    const root = await makeFixture(t);
    const pending = await pendingSheet(root);
    const valid = completeSheet(structuredClone(pending), { mergeSemantic: true });
    const variants = [
      (sheet) => { sheet.semantic_merges[0].source_pattern_ids.pop(); },
      (sheet) => { sheet.semantic_merges[0].source_pattern_ids[1] = 'SPC::C9999'; },
      (sheet) => { sheet.semantic_merges[0].semantic_kind = 'not-a-kind'; },
      (sheet) => { sheet.semantic_merges.push({ ...sheet.semantic_merges[0], merge_key: 'other-key' }); },
      (sheet) => { sheet.reviews.find((review) => review.merge_key === sheet.semantic_merges[0].merge_key).merge_key = 'other-key'; },
      (sheet) => { sheet.reviews.find((review) => review.merge_key === sheet.semantic_merges[0].merge_key).correctness = null; },
      (sheet) => {
        const reviews = sheet.reviews.filter((review) => review.dimension === 'semantic');
        reviews[2].decision = 'merge';
        reviews[2].applicability = null;
        reviews[2].merge_key = 'overlapping-key';
        sheet.semantic_merges.push({ ...sheet.semantic_merges[0], merge_key: 'overlapping-key', source_pattern_ids: [reviews[0].source_pattern_id, reviews[2].source_pattern_id] });
      },
    ];
    for (const mutate of variants) {
      const changed = structuredClone(valid);
      mutate(changed);
      await rejection(applyAuthorReview(root, JSON.stringify(changed)));
    }
  });

  it('invalidates prepared review bindings on source or schema byte changes, including whitespace-only source changes', async (t) => {
    const root = await makeFixture(t);
    const sheet = await pendingSheet(root);
    const sourcePath = join(root, SOURCE_DIRECTORY, 'rhetorical.json');
    const rawSource = await readFile(sourcePath, 'utf8');
    const originalInputHash = JSON.parse(rawSource).input_hash;
    await writeFile(sourcePath, `${rawSource} \n`);
    assert.equal(JSON.parse(await readFile(sourcePath, 'utf8')).input_hash, originalInputHash);
    await rejection(validateAuthorPatterns(root));
    await rejection(applyAuthorReview(root, JSON.stringify(completeSheet(structuredClone(sheet)))));

    const fresh = await makeFixture(t);
    const prepared = await pendingSheet(fresh);
    const schemaPath = join(fresh, '_scripts/author-extraction/author-review.schema.json');
    await writeFile(schemaPath, `${await readFile(schemaPath, 'utf8')} \n`);
    await rejection(prepareAuthorReview(fresh));
    await rejection(applyAuthorReview(fresh, JSON.stringify(completeSheet(structuredClone(prepared)))));
  });

  it('returns the same canonical hashes and output bytes for semantically equivalent completed JSON', async (t) => {
    const root = await makeFixture(t);
    const completed = await completedReview(root);
    const reordered = JSON.stringify(canonical(JSON.parse(completed)), null, 4);
    const first = await applyAuthorReview(root, completed);
    const second = await applyAuthorReview(root, reordered);
    assert.equal(first.completed_review_hash, second.completed_review_hash);
    assert.equal(first.review_source_hash, second.review_source_hash);
    assert.equal(first.reviewed_author_patterns_json, second.reviewed_author_patterns_json);
    assert.equal(first.reviewed_semantic_model_json, second.reviewed_semantic_model_json);
  });

  it('keeps fixture application offline and read-only: no final artifact writes and no changes to copied source bytes', async (t) => {
    const root = await makeFixture(t);
    const originals = await sourceBytes(root);
    const before = await listFiles(root);
    const result = await applyAuthorReview(root, await completedReview(root));
    assert.equal(typeof result.reviewed_author_patterns_json, 'string');
    assert.equal(typeof result.reviewed_semantic_model_json, 'string');
    assert.deepEqual(await listFiles(root), before);
    for (const [path, expected] of originals) assert.deepEqual(await readFile(path), expected);
  });
});

async function exists(path) {
  try { await readFile(path); return true; } catch { return false; }
}

async function listFiles(directory, prefix = '') {
  const result = [];
  for (const entry of (await readdir(join(directory, prefix), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = join(prefix, entry.name);
    if (entry.isDirectory()) result.push(...await listFiles(directory, relative));
    else result.push(relative);
  }
  return result.sort();
}
