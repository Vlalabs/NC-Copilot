import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assess, blankCase, canClose, captureReady, finalInspection, invalidateAnalysis,
  measurement, nextQuestion, parseObservation, restoreCase, scenarioCase,
  serializableCase, tasksFor,
} from '../src/domain.ts';

test('declaration requires an observation, a program, a valid MSN and an area', () => {
  const c = scenarioCase('scratch');
  assert.equal(captureReady(c.fields), true);
  for (const key of ['observation', 'program', 'msn', 'zone']) assert.equal(captureReady({ ...c.fields, [key]: ' ' }), false);
  assert.equal(captureReady({ ...c.fields, msn: 'aircraft-1' }), false);
  assert.equal(captureReady(blankCase().fields), false);
});

test('English conversation extracts facts, identifiers and measurements without inventing them', () => {
  const blank = blankCase().fields;
  const { fields, inferredCategory } = parseObservation(blank, 'A 28 mm scratch on the left-wing aluminium bracket, A320 MSN: 12084, PN SUP-7341, batch L-2026-041. Depth: 0.08 mm.', 'observation');
  assert.equal(fields.length, '28');
  assert.equal(fields.depth, '0.08');
  assert.equal(fields.zone, 'Left wing');
  assert.equal(fields.part, 'SUP-7341');
  assert.equal(fields.msn, '12084');
  assert.equal(fields.lot, 'L-2026-041');
  assert.equal(fields.category, 'surface');
  assert.equal(inferredCategory, true);
  assert.equal(captureReady(fields), true);
  assert.equal(parseObservation(blank, 'A mark on a panel', 'observation').fields.depth, '');
});

test('guided capture handles program, MSN and location in separate messages', () => {
  let f = parseObservation(blankCase().fields, 'A scratch on a bracket', 'observation').fields;
  assert.equal(nextQuestion(f).key, 'program');
  f = parseObservation(f, 'A320', nextQuestion(f).key).fields;
  assert.equal(nextQuestion(f).key, 'msn');
  f = parseObservation(f, 'MSN 12084', nextQuestion(f).key).fields;
  f = parseObservation(f, 'Right wing', nextQuestion(f).key).fields;
  assert.equal(captureReady(f), true);
  assert.equal(nextQuestion(f).key, 'ready');
});

test('French observations, comma decimals and centimetres remain supported', () => {
  const result = parseObservation(blankCase().fields, 'Rayure de 2,8 cm sur la voilure gauche A320 MSN 12084. Profondeur 0,08 mm. PN SUP-7341 aluminium.', 'observation');
  assert.equal(result.fields.length, '28');
  assert.equal(result.fields.depth, '0.08');
  assert.equal(result.fields.zone, 'Left wing');
});

test('invalid, absent and negative measurements never produce an acceptance', () => {
  for (const value of ['', ' ', '-0.01', '0.08 mm', 'NaN', 'Infinity', '1e3', '0..1']) assert.equal(measurement(value), null);
  assert.equal(measurement('0,05'), 0.05);
  const c = scenarioCase('scratch');
  for (const depth of ['', '-0.01', 'not measured']) assert.equal(assess({ ...c.fields, depth }, true).result, 'incomplete');
  assert.equal(assess(c.fields, false).requirement, null);
});

test('surface acceptance and repair boundaries check both length and depth', () => {
  const f = scenarioCase('scratch').fields;
  assert.equal(assess({ ...f, depth: '0.05', length: '30' }, true).result, 'accepted');
  assert.equal(assess({ ...f, depth: '0.05', length: '31' }, true).result, 'repairable');
  assert.equal(assess({ ...f, depth: '0.15', length: '40' }, true).result, 'repairable');
  assert.equal(assess({ ...f, depth: '0.151', length: '30' }, true).result, 'outside');
  assert.equal(assess({ ...f, depth: '0.01', length: '41' }, true).result, 'outside');
});

test('dimensional rule respects both tolerance boundaries and the rework envelope', () => {
  const f = scenarioCase('bore').fields;
  for (const diameter of ['5.9', '6.00', '6.1']) assert.equal(assess({ ...f, diameter }, true).result, 'accepted');
  for (const diameter of ['6.1001', '6.32', '6.5']) assert.equal(assess({ ...f, diameter }, true).result, 'repairable');
  for (const diameter of ['5.89', '6.51']) assert.equal(assess({ ...f, diameter }, true).result, 'outside');
  assert.equal(assess({ ...f, diameter: '0' }, true).result, 'incomplete');
});

test('criteria are scoped to program, material, part and defect type', () => {
  const f = scenarioCase('scratch').fields;
  for (const patch of [{ program: 'A350' }, { material: 'Composite' }, { part: 'UNKNOWN' }, { category: 'crack' as const }]) {
    const result = assess({ ...f, ...patch }, true);
    assert.equal(result.result, 'unmatched');
    assert.equal(result.requirement, null);
    assert.deepEqual(result.options, ['engineering']);
  }
  assert.equal(assess(scenarioCase('crack').fields, true).recommended, 'engineering');
});

test('final inspection rejects a still non-conforming repair and requires a record', () => {
  const c = scenarioCase('scratch');
  const a = assess(c.fields, true);
  assert.equal(finalInspection(c.fields, a, 'repair', { length: '28', depth: '0.08', diameter: '', note: 'INS-DEMO-001' }).valid, false);
  assert.equal(finalInspection(c.fields, a, 'repair', { length: '28', depth: '0.03', diameter: '', note: '' }).valid, false);
  assert.equal(finalInspection(c.fields, a, 'repair', { length: '28', depth: '0.03', diameter: '', note: 'INS-DEMO-001: conforming' }).valid, true);
  const b = scenarioCase('bore');
  assert.equal(finalInspection(b.fields, assess(b.fields, true), 'repair', { length: '', depth: '', diameter: '6.32', note: 'inspection' }).valid, false);
});

test('closure requires an approved disposition, completed actions and final inspection', () => {
  const c = scenarioCase('scratch');
  c.declared = true; c.disposition = 'repair'; c.tasks = tasksFor('repair');
  assert.equal(canClose(c), false);
  c.tasks = c.tasks.map(t => ({ ...t, done: true }));
  assert.equal(canClose(c), false);
  c.finalCheck = 'INS-DEMO-001: conforming';
  assert.equal(canClose(c), true);
  c.disposition = 'engineering';
  assert.equal(canClose(c), false);
  c.disposition = 'repair'; c.closed = true;
  assert.equal(canClose(c), false);
});

test('editing declared facts invalidates prior analysis and approval', () => {
  const c = scenarioCase('scratch'); c.declared = true; c.stage = 2; c.categoryConfirmed = true;
  c.assessment = assess(c.fields, true); c.disposition = 'repair'; c.tasks = tasksFor('repair');
  const edited = invalidateAnalysis(c, { ...c.fields, depth: '0.2' });
  assert.equal(edited.declared, false); assert.equal(edited.stage, 0);
  assert.equal(edited.assessment, null); assert.equal(edited.disposition, null);
  assert.deepEqual(edited.tasks, []);
  assert.equal(assess(edited.fields, true).result, 'outside');
});

test('local persistence preserves the case, strips preview URLs and rejects malformed or stale data', () => {
  const c = scenarioCase('scratch');
  c.attachments = [{ id: 'photo', name: 'defect.png', size: 500, image: true, url: 'blob:session-only', point: { x: 25, y: 50 } }];
  const saved = serializableCase(c);
  assert.equal(saved.attachments[0].url, undefined);
  assert.deepEqual(restoreCase(JSON.stringify(saved)), saved);
  for (const raw of ['{broken', '{}', JSON.stringify({ ...c, messages: [{}] }), JSON.stringify({ ...c, fields: { ...c.fields, msn: 12084 } })]) assert.equal(restoreCase(raw), null);
  c.assessment = assess(c.fields, true); c.categoryConfirmed = true;
  assert.ok(restoreCase(JSON.stringify(c)));
  c.fields.depth = '0.2';
  assert.equal(restoreCase(JSON.stringify(c)), null);
});

test('assessment links each criterion to a source and separates acceptance from repair eligibility', () => {
  const a = assess(scenarioCase('scratch').fields, true);
  assert.equal(a.documents.length, 4);
  assert.equal(a.criteria.length, 6);
  for (const row of a.criteria) assert.ok(a.documents.some(d => d.id === row.source));
  assert.equal(a.criteria.find(c => c.id === 'depth')?.status, 'fail');
  assert.equal(a.criteria.find(c => c.id === 'process')?.status, 'pass');
  assert.equal(a.recommended, 'repair');
  assert.equal(assess(scenarioCase('bore').fields, true).recommended, 'rework');
});

test('missing instructions and conflicting revisions prevent a final disposition even within acceptance limits', () => {
  const f = { ...scenarioCase('scratch').fields, depth: '0.03' };
  for (const state of ['missing', 'conflict'] as const) {
    const a = assess(f, true, state);
    assert.equal(a.result, 'incomplete');
    assert.equal(a.recommended, 'engineering');
    assert.deepEqual(a.options, ['engineering']);
    assert.ok(a.documents.some(d => d.status === state));
  }
});

test('reject, scrap and exchange have distinct plans and rework still requires conforming final geometry', () => {
  assert.ok(tasksFor('reject').some(t => /supplier return/.test(t.title)));
  assert.ok(tasksFor('scrap').some(t => /permanent withdrawal/.test(t.title)));
  assert.ok(tasksFor('exchange').some(t => /exchange unit/.test(t.title)));
  const c = scenarioCase('bore');
  const a = assess(c.fields, true);
  assert.equal(finalInspection(c.fields, a, 'rework', { length: '', depth: '', diameter: '6.32', note: 'INS-DEMO' }).valid, false);
  assert.equal(finalInspection(c.fields, a, 'rework', { length: '', depth: '', diameter: '6.02', note: 'INS-DEMO' }).valid, true);
});

test('older recorded cases gain document criteria without losing the approved decision or actions', () => {
  const c = scenarioCase('scratch');
  c.declared = true; c.categoryConfirmed = true; c.stage = 2;
  c.disposition = 'repair'; c.decisionReason = 'Legacy reviewed repair'; c.tasks = tasksFor('repair');
  c.tasks[0].done = true;
  const { criteria, documents, documentState, ...legacy } = assess(c.fields, true);
  const restored = restoreCase(JSON.stringify({ ...c, assessment: legacy }));
  assert.equal(restored?.assessment?.criteria.length, 6);
  assert.equal(restored?.disposition, 'repair');
  assert.deepEqual(restored?.tasks, c.tasks);
});
