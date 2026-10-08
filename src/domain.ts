// All references, rules and records in this prototype are fictional fixtures.
export type Category = '' | 'surface' | 'dimensional' | 'crack' | 'other';
export type Disposition = 'accept' | 'repair' | 'replace' | 'scrap' | 'engineering';
export type Fields = {
  observation: string; category: Category; program: string; msn: string;
  part: string; zone: string; material: string; lot: string;
  length: string; depth: string; diameter: string;
};
export type FieldKey = keyof Fields;
export type Attachment = { id: string; name: string; size: number; image: boolean; url?: string; point?: { x: number; y: number } };
export type Message = { id: string; role: 'user' | 'assistant'; text: string };
export type Audit = { id: string; time: string; text: string };
export type Task = { id: string; title: string; owner: string; done: boolean; kind: 'action' | 'inspection' | 'opinion' };
export type Assessment = {
  result: 'accepted' | 'repairable' | 'outside' | 'incomplete' | 'unmatched';
  title: string; explanation: string; requirement: 'surface' | 'dimensional' | null;
  recommended: Disposition; options: Disposition[];
};
export type CaseState = {
  version: 1; id: string; stage: 0 | 1 | 2; declared: boolean; closed: boolean;
  fields: Fields; origins: Partial<Record<FieldKey, string>>; categoryConfirmed: boolean;
  messages: Message[]; attachments: Attachment[]; audit: Audit[];
  assessment: Assessment | null; disposition: Disposition | null;
  decisionReason: string; tasks: Task[]; finalCheck: string;
};
export const LABELS: Record<FieldKey, string> = {
  observation: 'Observation', category: 'Defect type', program: 'Program', msn: 'MSN',
  part: 'Part Number', zone: 'Affected area', material: 'Material', lot: 'Batch',
  length: 'Length (mm)', depth: 'Depth (mm)', diameter: 'Diameter (mm)',
};
export const CATEGORY_NAMES: Record<Category, string> = {
  '': 'To classify', surface: 'Surface defect', dimensional: 'Dimensional deviation', crack: 'Suspected crack', other: 'Other defect',
};
export const DISPOSITION_NAMES: Record<Disposition, string> = {
  accept: 'Use as is', repair: 'Repair / rework', replace: 'Replace', scrap: 'Reject / scrap', engineering: 'Engineering review',
};
export const ZONES = ['Left wing', 'Right wing', 'Fuselage', 'Empennage', 'Nose / cockpit', 'Other area'];
export const uid = () => crypto.randomUUID();
export const event = (text: string): Audit => ({ id: uid(), time: new Date().toISOString(), text });
export const message = (role: Message['role'], text: string): Message => ({ id: uid(), role, text });
export function blankCase(): CaseState {
  return {
    version: 1, id: `NC-DEMO-${uid().slice(0, 6).toUpperCase()}`, stage: 0, declared: false, closed: false,
    fields: { observation: '', category: '', program: '', msn: '', part: '', zone: '', material: '', lot: '', length: '', depth: '', diameter: '' },
    origins: {}, categoryConfirmed: false, messages: [], attachments: [], audit: [event('Draft opened')],
    assessment: null, disposition: null, decisionReason: '', tasks: [], finalCheck: '',
  };
}
export const REQUIRED: FieldKey[] = ['observation', 'program', 'msn', 'zone'];
export const captureReady = (f: Fields) => REQUIRED.every(k => f[k].trim().length > 0) && /^\d{3,8}$/.test(f.msn);
export function nextQuestion(f: Fields): { key: FieldKey | 'ready'; text: string; chips: string[] } {
  if (!f.observation) return { key: 'observation', text: 'What have you noticed? A sentence is enough to begin. I’ll help you capture the details, one step at a time.', chips: [] };
  if (!f.program) return { key: 'program', text: 'Which aircraft program does this concern?', chips: ['A320', 'A350', 'A220'] };
  if (!/^\d{3,8}$/.test(f.msn)) return { key: 'msn', text: 'What is the aircraft MSN? Enter a serial number with 3 to 8 digits.', chips: ['MSN 12084'] };
  if (!f.zone) return { key: 'zone', text: 'Where on the aircraft did you observe the defect?', chips: ['Left wing', 'Right wing', 'Fuselage'] };
  return { key: 'ready', text: 'The essential details are captured. You can add evidence or measurements, then review and declare the non-conformance.', chips: [] };
}
function normalize(text: string) { return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
export function parseObservation(fields: Fields, text: string, key: FieldKey | 'ready'): { fields: Fields; changed: FieldKey[]; inferredCategory: boolean } {
  const next = { ...fields };
  const low = normalize(text);
  const assign = (k: FieldKey, value: string) => { if (k !== 'category') next[k] = value; };
  const program = text.match(/\bA(?:220|320|330|350|380)\b/i);
  if (program) next.program = program[0].toUpperCase();
  const msn = text.match(/\bMSN\s*[:#-]?\s*(\d{3,8})\b/i);
  if (msn) next.msn = msn[1];
  else if (key === 'msn' && /^\d{3,8}$/.test(text.trim())) next.msn = text.trim();
  const part = text.match(/\b(?:PN|P\/N|part number)\s*[:#]?\s*([A-Z0-9][A-Z0-9-]+)/i);
  if (part) next.part = part[1].toUpperCase();
  const lot = text.match(/\b(?:lot|batch)\s*[:#]?\s*([A-Z0-9][A-Z0-9-]+)/i);
  if (lot) next.lot = lot[1].toUpperCase();
  if (/(?:voilure|aile|cote)\s+gauche|left[ -]+wing/.test(low)) next.zone = 'Left wing';
  else if (/(?:voilure|aile|cote)\s+droite?|right[ -]+wing/.test(low)) next.zone = 'Right wing';
  else if (/fuselage/.test(low)) next.zone = 'Fuselage';
  else if (/empennage|stabilisateur|tail/.test(low)) next.zone = 'Empennage';
  else if (/cockpit|\bnez\b|nose/.test(low)) next.zone = 'Nose / cockpit';
  if (/aluminium|aluminum/.test(low)) next.material = 'Aluminium';
  else if (/composite|carbone|carbon/.test(low)) next.material = 'Composite';
  const inferredCategory = /rayure|fissure|percage|diametre|delaminage|scratch|crack|bore|diameter|delamination/.test(low);
  if (/fissure|delaminage|crack|delamination/.test(low)) next.category = 'crack';
  else if (/percage|diametre|bore|diameter/.test(low)) next.category = 'dimensional';
  else if (/rayure|scratch/.test(low)) next.category = 'surface';
  const number = '(-?\\d+(?:[.,]\\d+)?)';
  const readMeasure = (label: string, k: FieldKey) => {
    const match = low.match(new RegExp(`${label}\\s*(?:(?:measured\\s*)?(?:at|de|of|:|=))?\\s*${number}\\s*(mm|cm)\\b`));
    if (match) assign(k, String(Number(match[1].replace(',', '.')) * (match[2] === 'cm' ? 10 : 1)));
  };
  readMeasure('(?:profondeur|profond(?:e)?|depth)', 'depth');
  readMeasure('(?:longueur|long(?:ue)?|length)', 'length');
  readMeasure('(?:diametre|diameter|Ø)', 'diameter');
  const length = low.match(/(?:rayure|scratch)\s+(?:(?:de|of)\s+)?(-?\d+(?:[.,]\d+)?)\s*(mm|cm)\b/);
  if (length) next.length = String(Number(length[1].replace(',', '.')) * (length[2] === 'cm' ? 10 : 1));
  const prefixLength = low.match(/(-?\d+(?:[.,]\d+)?)\s*(mm|cm)\s+scratch\b/);
  if (prefixLength) next.length = String(Number(prefixLength[1].replace(',', '.')) * (prefixLength[2] === 'cm' ? 10 : 1));
  const depth = low.match(/(-?\d+(?:[.,]\d+)?)\s*(mm|cm)\s+(?:(?:de|in)\s+)?(?:profondeur|depth)/);
  if (depth) next.depth = String(Number(depth[1].replace(',', '.')) * (depth[2] === 'cm' ? 10 : 1));
  if (key === 'observation') next.observation = text;
  else if (/rayure|fissure|defaut|choc|percage|fuite|corrosion|delaminage|scratch|crack|defect|bore|leak|delamination/.test(low)) next.observation = [fields.observation, text].filter(Boolean).join('\n');
  const changed = (Object.keys(next) as FieldKey[]).filter(k => next[k] !== fields[k]);
  if (changed.length === 0 && key !== 'ready' && key !== 'category' && key !== 'msn') {
    assign(key, text.trim());
    changed.push(key);
  }
  return { fields: next, changed, inferredCategory };
}
export function measurement(value: string): number | null {
  if (!/^\d+(?:[.,]\d+)?$/.test(value.trim())) return null;
  const n = Number(value.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
}
export const REFERENCES = {
  surface: {
    id: 'DR-SIM-021', revision: 'C', section: '§ 4.2 · Surface defects', title: 'Aluminium bracket — surface requirements',
    scope: 'A320 · PN SUP-7341 · Aluminium',
    acceptance: 'Depth ≤ 0.05 mm AND length ≤ 30 mm.',
    repair: 'Depth ≤ 0.15 mm AND length ≤ 40 mm: repair to instruction RI-SIM-014, followed by inspection against acceptance limits.',
    outside: 'Beyond repair limits: engineering review is required.',
  },
  dimensional: {
    id: 'DR-SIM-034', revision: 'B', section: '§ 3.1 · Bore diameter', title: 'Aluminium fitting — dimensional requirements',
    scope: 'A320 · PN BRK-6210 · Aluminium',
    acceptance: 'Nominal diameter 6.00 mm; tolerance ± 0.10 mm (5.90 to 6.10 mm).',
    repair: 'Diameter > 6.10 and ≤ 6.50 mm: rework to instruction RI-SIM-022, followed by inspection between 5.90 and 6.10 mm.',
    outside: 'Any other out-of-tolerance measurement requires engineering review.',
  },
};
export function assess(fields: Fields, categoryConfirmed: boolean): Assessment {
  const engineering: Disposition[] = ['engineering'];
  if (!categoryConfirmed || !fields.category) return { result: 'incomplete', title: 'Confirm the defect type', explanation: 'Confirm the suggested defect type before looking up an applicable requirement.', requirement: null, recommended: 'engineering', options: engineering };
  let requirement: Assessment['requirement'] = null;
  if (fields.program === 'A320' && fields.material === 'Aluminium') {
    if (fields.category === 'surface' && fields.part.toUpperCase() === 'SUP-7341') requirement = 'surface';
    if (fields.category === 'dimensional' && fields.part.toUpperCase() === 'BRK-6210') requirement = 'dimensional';
  }
  if (!requirement) return { result: 'unmatched', title: 'Engineering review needed', explanation: 'No requirement in the demo library matches this program, part, material and defect type. Route the case to engineering for further assessment.', requirement: null, recommended: 'engineering', options: engineering };
  let acceptable = false, repairable = false;
  if (requirement === 'surface') {
    const d = measurement(fields.depth), l = measurement(fields.length);
    if (d === null || l === null) return { result: 'incomplete', title: 'Measurements needed', explanation: 'Documented length and depth measurements, zero or greater, are required. A photo does not supply these measurements.', requirement, recommended: 'engineering', options: engineering };
    acceptable = d <= 0.05 && l <= 30;
    repairable = d <= 0.15 && l <= 40;
  } else {
    const d = measurement(fields.diameter);
    if (d === null || d === 0) return { result: 'incomplete', title: 'Bore diameter needed', explanation: 'A measured diameter greater than zero is needed to check the tolerance.', requirement, recommended: 'engineering', options: engineering };
    acceptable = d >= 5.9 && d <= 6.1;
    repairable = d > 6.1 && d <= 6.5;
  }
  if (acceptable) return { result: 'accepted', title: 'Within acceptance limits', explanation: 'The measurements meet every criterion in the simulated requirement. Use as is can be proposed for review.', requirement, recommended: 'accept', options: ['accept', 'engineering'] };
  if (repairable) return { result: 'repairable', title: 'Repair is possible', explanation: 'The defect exceeds acceptance limits but remains within the repair envelope of the simulated requirement. Repair instructions and a final inspection are required.', requirement, recommended: 'repair', options: ['repair', 'replace', 'scrap', 'engineering'] };
  return { result: 'outside', title: 'Outside the repair envelope', explanation: 'The measurements exceed the range covered by this requirement. Further engineering review is needed before choosing a disposition.', requirement, recommended: 'engineering', options: engineering };
}
export function tasksFor(disposition: Disposition): Task[] {
  const task = (id: string, title: string, owner: string, kind: Task['kind'] = 'action'): Task => ({ id, title, owner, kind, done: false });
  switch (disposition) {
    case 'repair': return [task('order', 'Issue a repair work order', 'Manufacturing engineering'), task('perform', 'Carry out the repair / rework', 'Production'), task('inspect', 'Inspect the result and record measurements', 'Quality', 'inspection')];
    case 'replace': return [task('order', 'Issue a replacement work order', 'Supply chain'), task('perform', 'Replace and trace the new part', 'Production'), task('inspect', 'Inspect the replacement part', 'Quality', 'inspection')];
    case 'scrap': return [task('isolate', 'Quarantine and identify the rejected part', 'Production'), task('scrap', 'Record the part rejection', 'Quality'), task('inspect', 'Verify rejection traceability', 'Quality', 'inspection')];
    case 'accept': return [task('decision', 'Record the acceptance decision', 'Engineering'), task('inspect', 'Verify the release record', 'Quality', 'inspection')];
    case 'engineering': return [task('send', 'Send the case to engineering', 'Quality'), task('opinion', 'Receive and record the engineering opinion', 'Engineering', 'opinion')];
  }
}
export const SCENARIOS = [
  { id: 'scratch', title: 'A scratch on a bracket', tag: 'Repair', subtitle: 'Aluminium bracket · A320', fields: { observation: 'A 28 mm scratch on the left-wing aluminium bracket. Measured depth: 0.08 mm. One part affected.', category: 'surface', program: 'A320', msn: '12084', part: 'SUP-7341', zone: 'Left wing', material: 'Aluminium', lot: 'L-2026-041', length: '28', depth: '0.08', diameter: '' } },
  { id: 'bore', title: 'An out-of-tolerance bore', tag: 'Rework', subtitle: 'Aluminium fitting · A320', fields: { observation: 'Bore diameter measured at 6.32 mm on an aluminium fuselage fitting. One part affected.', category: 'dimensional', program: 'A320', msn: '12084', part: 'BRK-6210', zone: 'Fuselage', material: 'Aluminium', lot: 'L-2026-052', length: '', depth: '', diameter: '6.32' } },
  { id: 'crack', title: 'A suspected crack', tag: 'Engineering', subtitle: 'Composite panel · A350', fields: { observation: 'Suspected crack on a composite empennage panel, to be confirmed by further inspection. No documented measurements available.', category: 'crack', program: 'A350', msn: '00672', part: 'PNL-8820', zone: 'Empennage', material: 'Composite', lot: 'L-2026-063', length: '', depth: '', diameter: '' } },
] satisfies { id: string; title: string; tag: string; subtitle: string; fields: Fields }[];
export function scenarioCase(id: string): CaseState {
  const s = SCENARIOS.find(s => s.id === id) ?? SCENARIOS[0];
  const c = blankCase();
  c.fields = { ...s.fields };
  c.origins = Object.fromEntries(Object.keys(s.fields).map(k => [k, ['program', 'msn', 'part', 'lot', 'material'].includes(k) ? 'MES · simulated context' : k === 'category' ? 'Suggested · to confirm' : 'Demo observation']));
  c.messages = [message('user', s.fields.observation), message('assistant', `I’ve captured the observation and the simulated product context. Please confirm the suggested type, “${CATEGORY_NAMES[s.fields.category]}”. You can edit any detail in the panel on the right.`)];
  c.audit.push(event(`Scenario loaded: ${s.title}`));
  return c;
}
export function invalidateAnalysis(c: CaseState, fields: Fields, origins = c.origins, categoryConfirmed = c.categoryConfirmed): CaseState {
  return { ...c, fields, origins, categoryConfirmed, assessment: null, disposition: null, tasks: [], decisionReason: '', finalCheck: '', stage: 0, declared: false, closed: false, audit: [...c.audit, event(c.declared ? 'Case changed: declaration and assessment need to be repeated' : 'Draft information updated')] };
}
export function finalInspection(fields: Fields, a: Assessment | null, disposition: Disposition, values: { length: string; depth: string; diameter: string; note: string }): { valid: boolean; summary: string } {
  if (!values.note.trim()) return { valid: false, summary: 'Record an inspection result or reference.' };
  if (disposition === 'repair' && a?.requirement) {
    const f = { ...fields, length: values.length, depth: values.depth, diameter: values.diameter };
    const check = assess(f, true);
    if (check.result !== 'accepted') return { valid: false, summary: 'Final measurements do not meet acceptance limits. Correct the measurement or continue the resolution.' };
    return { valid: true, summary: `${a.requirement === 'surface' ? `Length ${values.length} mm · depth ${values.depth} mm` : `Diameter ${values.diameter} mm`} · ${values.note.trim()}` };
  }
  return { valid: true, summary: values.note.trim() };
}
export function canClose(c: CaseState) { return c.declared && c.disposition !== null && c.disposition !== 'engineering' && c.tasks.length > 0 && c.tasks.every(t => t.done) && Boolean(c.finalCheck) && !c.closed; }
export const STORAGE_KEY = 'nc-copilot-demo-v1';
export function serializableCase(c: CaseState): CaseState { return { ...c, attachments: c.attachments.map(({ url: _url, ...a }) => a) }; }
export function restoreCase(raw: string | null): CaseState | null {
  if (!raw) return null;
  try {
    const c = JSON.parse(raw) as CaseState;
    if (c.version !== 1 || !c.fields || (Object.keys(LABELS) as FieldKey[]).some(k => typeof c.fields[k] !== 'string') || !Object.hasOwn(CATEGORY_NAMES, c.fields.category)) return null;
    if (![0, 1, 2].includes(c.stage) || typeof c.id !== 'string' || typeof c.declared !== 'boolean' || typeof c.closed !== 'boolean' || typeof c.categoryConfirmed !== 'boolean') return null;
    if (!c.origins || typeof c.origins !== 'object' || Object.values(c.origins).some(v => typeof v !== 'string')) return null;
    if (!Array.isArray(c.messages) || c.messages.some(m => !m || typeof m.id !== 'string' || !['user', 'assistant'].includes(m.role) || typeof m.text !== 'string')) return null;
    if (!Array.isArray(c.audit) || c.audit.some(e => !e || typeof e.id !== 'string' || typeof e.time !== 'string' || !Number.isFinite(Date.parse(e.time)) || typeof e.text !== 'string')) return null;
    if (!Array.isArray(c.attachments) || c.attachments.some(a => !a || typeof a.id !== 'string' || typeof a.name !== 'string' || typeof a.size !== 'number' || typeof a.image !== 'boolean' || (a.point && (![a.point.x, a.point.y].every(n => typeof n === 'number' && n >= 0 && n <= 100))))) return null;
    if (!Array.isArray(c.tasks) || c.tasks.some(t => !t || typeof t.id !== 'string' || typeof t.title !== 'string' || typeof t.owner !== 'string' || typeof t.done !== 'boolean' || !['action', 'inspection', 'opinion'].includes(t.kind))) return null;
    if (c.disposition !== null && !Object.hasOwn(DISPOSITION_NAMES, c.disposition)) return null;
    if (typeof c.decisionReason !== 'string' || typeof c.finalCheck !== 'string') return null;
    if (c.assessment !== null) {
      const recomputed = assess(c.fields, c.categoryConfirmed);
      if (JSON.stringify(c.assessment) !== JSON.stringify(recomputed)) return null;
    }
    if (c.stage > 0 && (!c.declared || !captureReady(c.fields))) return null;
    if (c.stage === 2 && (!c.assessment || !c.disposition || c.tasks.length === 0)) return null;
    // Persist metadata only. Local attachments must be reselected for their preview.
    return { ...c, attachments: c.attachments.map(({ url: _url, ...a }) => a) };
  } catch { return null; }
}
