import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
  ArrowDownToLine, ArrowRight, ArrowUp, BookOpen, Check, CheckCheck,
  CheckCircle2, ChevronDown, ChevronRight, ClipboardCheck,
  FileText, FolderOpen, HelpCircle, Layers3, MapPin, MessageSquare,
  MoreHorizontal, Paperclip, Pencil, Plane, Plus, Search,
  ShieldCheck, Sparkles, Target, X, AlertCircle, Wrench, Database,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AssessmentWorkspace, ExecutionWorkspace } from './Workspaces.tsx';
import {
  assess, assessmentReply, blankCase, canClose, captureReady, CATEGORY_NAMES, DISPOSITION_NAMES,
  event, finalInspection, invalidateAnalysis, LABELS, message, measurement,
  nextQuestion, parseObservation, REFERENCES, REQUIRED, restoreCase, scenarioCase,
  SCENARIOS, serializableCase, STORAGE_KEY, tasksFor, uid, ZONES,
} from './domain.ts';
import type { Attachment, CaseState, Disposition, DocumentState, FieldKey, ReviewDocument } from './domain.ts';

type Modal = { kind: 'scenarios' | 'declare' | 'record' | 'sources' | 'reset' | 'help' | 'map' | 'close' }
  | { kind: 'decision'; disposition?: Disposition }
  | { kind: 'document'; doc: ReviewDocument }
  | { kind: 'edit'; field: FieldKey }
  | { kind: 'reference'; reference: 'surface' | 'dimensional' }
  | { kind: 'attachment'; id: string }
  | { kind: 'inspection' | 'opinion'; task: string };
const time = (iso: string) => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }).format(new Date(iso));
const STAGES = [{ name: 'Capture & declare', detail: 'Build a clear picture' }, { name: 'Assess & decide', detail: 'Find the right disposition' }, { name: 'Resolve & close', detail: 'Follow through on the actions' }];

function Dialog({ title, eyebrow, onClose, children, wide = false }: { title: string; eyebrow?: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const root = ref.current;
    root?.focus();
    const keydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current();
      if (e.key !== 'Tab' || !root) return;
      const elements = Array.from(root.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex="0"]'));
      const first = elements[0], last = elements.at(-1);
      if (!first || !last) { e.preventDefault(); return; }
      if (e.shiftKey && (document.activeElement === first || document.activeElement === root)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || document.activeElement === root)) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, []);
  return <div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className={`dialog ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="dialog-title" tabIndex={-1} ref={ref}>
      <div className="dialog-top"><span className="eyebrow">{eyebrow ?? 'NC COPILOT · DEMONSTRATION'}</span><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={19} /></button></div>
      <h2 id="dialog-title">{title}</h2>{children}
    </div>
  </div>;
}

function AircraftMap({ zone, select, mini = false }: { zone: string; select?: (zone: string) => void; mini?: boolean }) {
  const shape = (name: string) => ({
    fill: zone === name ? '#9ad8c3' : '#e7ecee', stroke: zone === name ? '#368974' : '#bac7cc', strokeWidth: 1.4,
    ...(select ? { role: 'button', tabIndex: 0, 'aria-label': name, onClick: () => select(name), onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(name); } }, style: { cursor: 'pointer' } } : {}),
  });
  return <svg className={`aircraft-map ${mini ? 'mini' : ''}`} viewBox="0 0 380 280" aria-label={`Aircraft schematic${zone ? `, ${zone} selected` : ''}`} role={select ? 'group' : 'img'}>
    <defs><pattern id={mini ? 'grid-mini' : 'grid-large'} width="22" height="22" patternUnits="userSpaceOnUse"><path d="M22 0H0V22" fill="none" stroke="#dfe7e9" strokeWidth=".6" /></pattern></defs>
    <rect width="380" height="280" fill={`url(#${mini ? 'grid-mini' : 'grid-large'})`} />
    <line x1="190" x2="190" y1="15" y2="260" stroke="#c9d6d9" strokeDasharray="3 5" />
    <path d="M180 108L39 177L39 192L180 154Z" {...shape('Left wing')} />
    <path d="M200 108L341 177L341 192L200 154Z" {...shape('Right wing')} />
    <path d="M182 209L134 244L134 254L185 242L195 242L246 254L246 244L198 209Z" {...shape('Empennage')} />
    <path d="M180 64Q190 57 200 64L201 184L197 229Q190 257 183 229L179 184Z" {...shape('Fuselage')} />
    <path d="M180 64Q180 34 190 20Q200 34 200 64Z" {...shape('Nose / cockpit')} />
    <path d="M184 49Q190 42 196 49" stroke="#94afb6" strokeWidth="3" fill="none" />
    <rect x="129" y="142" width="13" height="34" rx="6" fill="#d3dfe3" stroke="#b1c4ca" /><rect x="238" y="142" width="13" height="34" rx="6" fill="#d3dfe3" stroke="#b1c4ca" />
    <text x="45" y="86" fontSize="9" fill="#80949e">LEFT</text><text x="305" y="86" fontSize="9" fill="#80949e">RIGHT</text>
    <text x="12" y="268" fontSize="7" fill="#91a2a8">TOP VIEW · SCHEMATIC · NOT TO SCALE</text>
    {zone === 'Left wing' && <><circle cx="117" cy="145" r="12" fill="#fff" opacity=".85" /><circle cx="117" cy="145" r="5" fill="#2b8e72" /></>}
  </svg>;
}

function FieldEditor({ field, value, onSave, onCancel }: { field: FieldKey; value: string; onSave: (v: string) => void; onCancel: () => void }) {
  const [input, setInput] = useState(value), [error, setError] = useState('');
  function submit(e: FormEvent) {
    e.preventDefault();
    if (field === 'msn' && input && !/^\d{3,8}$/.test(input.trim())) { setError('Enter an MSN with 3 to 8 digits.'); return; }
    if (['length', 'depth', 'diameter'].includes(field) && input && measurement(input) === null) { setError('Enter a valid measurement, zero or greater, in millimetres.'); return; }
    onSave(['part', 'lot'].includes(field) ? input.trim().toUpperCase() : input.trim());
  }
  return <form onSubmit={submit}>
    <p className="dialog-description">Update the consolidated record. Changing a declared case requires a fresh declaration and assessment.</p>
    <label className="form-label" htmlFor="edit-value">{LABELS[field]}</label>
    {field === 'observation' ? <textarea autoFocus className="input large-textarea" id="edit-value" value={input} onChange={e => setInput(e.target.value)} />
      : field === 'category' ? <select autoFocus className="input" id="edit-value" value={input} onChange={e => setInput(e.target.value)}>{Object.entries(CATEGORY_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        : field === 'zone' || field === 'material' || field === 'program' ? <select autoFocus className="input" id="edit-value" value={input} onChange={e => setInput(e.target.value)}><option value="">Select a value</option>{(field === 'zone' ? ZONES : field === 'material' ? ['Aluminium', 'Composite', 'Other'] : ['A220', 'A320', 'A330', 'A350', 'A380', 'Other']).map(v => <option key={v} value={v}>{v}</option>)}</select>
          : <input autoFocus className="input" id="edit-value" value={input} inputMode={['length', 'depth', 'diameter'].includes(field) ? 'decimal' : field === 'msn' ? 'numeric' : 'text'} onChange={e => setInput(e.target.value)} />}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="dialog-actions"><button type="button" className="button" onClick={onCancel}>Cancel</button><button className="button primary" type="submit">Save & confirm <Check size={15} /></button></div>
  </form>;
}

function InspectionForm({ c, onSave, onCancel }: { c: CaseState; onSave: (summary: string) => void; onCancel: () => void }) {
  const [values, setValues] = useState({ length: '', depth: '', diameter: '', note: '' });
  const [error, setError] = useState('');
  const requirement = c.disposition === 'repair' || c.disposition === 'rework' ? c.assessment?.requirement : null;
  const update = (key: keyof typeof values, v: string) => setValues(p => ({ ...p, [key]: v }));
  return <form onSubmit={e => { e.preventDefault(); const result = finalInspection(c.fields, c.assessment, c.disposition!, values); if (result.valid) onSave(result.summary); else setError(result.summary); }}>
    <p className="dialog-description">Record the simulated inspection. {requirement ? 'Final measurements are checked against the original acceptance limits.' : 'Include the inspection reference and the verified result.'}</p>
    {requirement && <div className="note"><Target size={16} /><span>{REFERENCES[requirement].acceptance}</span></div>}
    <div className="form-grid">{(requirement === 'surface' ? ['length', 'depth'] : requirement === 'dimensional' ? ['diameter'] : []).map(key => <label className="form-label" key={key}>{LABELS[key as FieldKey]}<input autoFocus={key === 'length' || key === 'diameter'} className="input" inputMode="decimal" value={values[key as 'length' | 'depth' | 'diameter']} onChange={e => update(key as 'length' | 'depth' | 'diameter', e.target.value)} placeholder={key === 'depth' ? 'e.g. 0.03' : key === 'length' ? 'e.g. 28' : 'e.g. 6.02'} /></label>)}</div>
    <label className="form-label" htmlFor="inspection-note">Inspection reference & result<textarea autoFocus={!requirement} id="inspection-note" className="input" required value={values.note} onChange={e => update('note', e.target.value)} placeholder="e.g. INS-DEMO-004 — final inspection conforming" /></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="dialog-actions"><button type="button" className="button" onClick={onCancel}>Cancel</button><button type="submit" className="button primary">Record final inspection <Check size={15} /></button></div>
  </form>;
}

function DecisionForm({ c, initialDisposition, onSave, onCancel }: { c: CaseState; initialDisposition?: Disposition; onSave: (d: Disposition, reason: string) => void; onCancel: () => void }) {
  const [selected, setSelected] = useState(initialDisposition ?? c.assessment!.recommended), [reason, setReason] = useState(''), [reviewed, setReviewed] = useState(false);
  return <form onSubmit={e => { e.preventDefault(); if (reviewed && reason.trim()) onSave(selected, reason.trim()); }}>
    <p className="dialog-description">{selected === 'engineering' ? 'Prepare an engineering referral with a clear reason. A final disposition will be recorded after the opinion is received.' : 'Review the document-based recommendation and select a disposition. The decision and its rationale will be added to the case history.'}</p>
    <div className="decision-options">{c.assessment!.options.map(d => <label key={d} className={`decision-option ${selected === d ? 'selected' : ''}`}><input type="radio" name="disposition" value={d} checked={selected === d} onChange={() => setSelected(d)} /><span>{DISPOSITION_NAMES[d]}</span>{d === c.assessment!.recommended && <span className="badge green">Recommended</span>}</label>)}</div>
    <label className="form-label" htmlFor="decision-reason">Decision rationale<textarea id="decision-reason" className="input" required value={reason} onChange={e => setReason(e.target.value)} placeholder="Explain the decision, with any applicable instruction or reference." /></label>
    <label className="checkbox-label"><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)} />I have reviewed the case and the simulated reference.</label>
    <div className="reviewer"><span className="avatar small">ML</span><span>Marie Laurent <small>Demo reviewer · recorded locally</small></span></div>
    <div className="dialog-actions"><button type="button" className="button" onClick={onCancel}>Cancel</button><button type="submit" className="button primary" disabled={!reviewed || !reason.trim()}>{selected === 'engineering' ? 'Send engineering request' : 'Confirm disposition'} <ArrowRight size={15} /></button></div>
  </form>;
}

function OpinionForm({ onSave, onCancel }: { onSave: (d: Disposition, text: string) => void; onCancel: () => void }) {
  const [d, setD] = useState<Disposition>('replace'), [ref, setRef] = useState(''), [note, setNote] = useState('');
  return <form onSubmit={e => { e.preventDefault(); if (ref.trim() && note.trim()) onSave(d, `${ref.trim()} — ${note.trim()}`); }}>
    <p className="dialog-description">Simulate the engineering response and approve a disposition. Record the chosen action and its engineering basis.</p>
    <label className="form-label" htmlFor="opinion-ref">Engineering opinion reference<input autoFocus className="input" id="opinion-ref" required value={ref} onChange={e => setRef(e.target.value)} placeholder="e.g. ENG-DEMO-008" /></label>
    <label className="form-label" htmlFor="opinion-disposition">Approved disposition<select className="input" id="opinion-disposition" value={d} onChange={e => setD(e.target.value as Disposition)}><option value="replace">Replace</option><option value="exchange">Exchange</option><option value="reject">Reject</option><option value="scrap">Scrap</option></select></label>
    <label className="form-label" htmlFor="opinion-note">Engineering rationale<textarea id="opinion-note" className="input" required value={note} onChange={e => setNote(e.target.value)} placeholder="Describe the simulated decision and its basis." /></label>
    <div className="dialog-actions"><button type="button" className="button" onClick={onCancel}>Cancel</button><button className="button primary" disabled={!ref.trim() || !note.trim()}>Record opinion & disposition <Check size={15} /></button></div>
  </form>;
}

function Group({ title, icon: Icon, children, defaultOpen = true, hint }: { title: string; icon: LucideIcon; children: ReactNode; defaultOpen?: boolean; hint?: string }) {
  return <details className="field-group" open={defaultOpen}><summary><span className="group-icon"><Icon size={15} /></span><span>{title}{hint && <small>{hint}</small>}</span><ChevronDown size={14} className="chevron" /></summary><div className="group-content">{children}</div></details>;
}

export default function App() {
  const [c, setCase] = useState<CaseState>(() => { try { return restoreCase(localStorage.getItem(STORAGE_KEY)) ?? blankCase(); } catch { return blankCase(); } });
  const [input, setInput] = useState(''), [modal, setModal] = useState<Modal | null>(null), [toast, setToast] = useState('');
  const [tab, setTab] = useState<'record' | 'sources' | 'history'>('record'), [storageOK, setStorageOK] = useState(true);
  const [dragging, setDragging] = useState(false);
  const bottom = useRef<HTMLDivElement>(null), inputRef = useRef<HTMLTextAreaElement>(null), fileRef = useRef<HTMLInputElement>(null);
  const fileURLs = useRef<string[]>([]), toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progress = REQUIRED.filter(k => Boolean(c.fields[k].trim()) && (k !== 'msn' || /^\d{3,8}$/.test(c.fields.msn))).length;
  const question = nextQuestion(c.fields), reference = c.assessment?.requirement ? REFERENCES[c.assessment.requirement] : null;
  const locked = c.disposition !== null || c.closed;
  const doneTasks = c.tasks.filter(t => t.done).length;
  const status = c.closed ? 'Closed' : c.disposition ? c.disposition === 'engineering' ? 'Awaiting engineering' : 'In resolution' : c.declared ? 'To assess' : 'Draft';

  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(serializableCase(c))); setStorageOK(true); } catch { setStorageOK(false); } }, [c]);
  useEffect(() => { if (!c.messages.length) return; bottom.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' }); }, [c.messages.length, c.stage]);
  useEffect(() => () => { fileURLs.current.forEach(URL.revokeObjectURL); if (toastTimer.current) clearTimeout(toastTimer.current); }, []);
  function notify(text: string) { setToast(text); if (toastTimer.current) clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 5000); }
  function changeField(field: FieldKey, value: string) {
    if (locked) return;
    setCase(p => invalidateAnalysis(p, { ...p.fields, [field]: value }, { ...p.origins, [field]: 'Operator · confirmed' }, field === 'category' ? Boolean(value) : p.categoryConfirmed));
    setModal(null); notify('Record updated.');
  }
  function loadScenario(id: string) {
    const next = scenarioCase(id);
    setCase(next); setInput(''); setTab('record'); setModal(null); notify('Demo scenario loaded. Review the details on the right.');
  }
  function restart() {
    setCase(blankCase()); setInput(''); setTab('record'); setModal(null);
    fileURLs.current.forEach(URL.revokeObjectURL); fileURLs.current = [];
    notify('A new draft is ready.');
  }
  function evaluate() {
    if (!c.declared || c.disposition) return;
    const assessment = assess(c.fields, c.categoryConfirmed, c.documentState ?? 'aligned');
    setCase(p => ({ ...p, stage: 1, assessment, messages: [...p.messages, message('assistant', assessmentReply(assessment))], audit: [...p.audit, event(`Multi-criteria assessment: ${assessment.title}; ${assessment.documents.length} sources, ${assessment.criteria.length} criteria`)] }));
    setTab('record');
  }
  function setDocumentation(documentState: DocumentState) {
    if (locked) return;
    setCase(p => ({ ...p, documentState, assessment: null, audit: [...p.audit, event(`Demo document set changed: ${documentState}`)], messages: [...p.messages, message('assistant', documentState === 'aligned' ? 'The demo revisions are aligned. Re-run the multi-criteria review to refresh the recommendation.' : documentState === 'conflict' ? 'A DAC revision conflict is reported. The dimensional result alone is insufficient; the next review will route the case to engineering.' : 'The applicable repair / rework instruction is unavailable. I will flag that gap separately from the dimensional assessment.')] }));
  }
  function send(text = input) {
    const value = text.trim(); if (!value || c.closed) return;
    setInput('');
    if (c.stage === 0 && !locked) {
      const parsed = parseObservation(c.fields, value, question.key);
      const origins = { ...c.origins };
      parsed.changed.forEach(k => { origins[k] = k === 'category' ? 'Suggested · to confirm' : 'Operator · conversation'; });
      const next = parsed.changed.length ? invalidateAnalysis(c, parsed.fields, origins, parsed.inferredCategory ? false : c.categoryConfirmed) : c;
      const response = parsed.changed.length ? `I’ve captured ${parsed.changed.length === 1 ? LABELS[parsed.changed[0]].toLowerCase() : `${parsed.changed.length} details`} in the case record. ${nextQuestion(parsed.fields).text}` : `I couldn’t extract a new case detail from that message. ${question.text} You can also edit any field on the right.`;
      setCase({ ...next, messages: [...c.messages, message('user', value), message('assistant', response)] });
    } else {
      if (c.stage === 1 && !locked && /(?:missing|unavailable|conflict|contradict)/i.test(value) && /(?:document|instruction|revision|DAC)/i.test(value)) {
        const documentState: DocumentState = /conflict|contradict/i.test(value) ? 'conflict' : 'missing';
        const assessment = assess(c.fields, c.categoryConfirmed, documentState);
        setCase(p => ({ ...p, documentState, assessment, messages: [...p.messages, message('user', value), message('assistant', assessmentReply(assessment))], audit: [...p.audit, event(`Documentation gap reported in conversation: ${documentState}`)] }));
        return;
      }
      if (c.stage === 1 && !locked && /^(?:set|update|record|measured)|(?:measured depth|depth\s*[:=]|length\s*[:=]|diameter\s*[:=])/i.test(value)) {
        const parsed = parseObservation(c.fields, value, 'ready');
        const measurements = parsed.changed.filter(k => ['depth', 'length', 'diameter'].includes(k));
        if (measurements.length) {
          const fields = { ...c.fields }, origins = { ...c.origins };
          measurements.forEach(k => { if (k !== 'category') fields[k] = parsed.fields[k]; origins[k] = 'Operator · assessment conversation'; });
          const assessment = c.assessment ? assess(fields, c.categoryConfirmed, c.documentState ?? 'aligned') : null;
          setCase(p => ({ ...p, fields, origins, assessment, messages: [...p.messages, message('user', value), message('assistant', `Measurements updated: ${measurements.map(k => `${LABELS[k]} = ${fields[k]}`).join('; ')}. ${assessment ? assessmentReply(assessment) : 'Run the document review to evaluate the revised evidence.'}`)], audit: [...p.audit, event(`Assessment measurements updated: ${measurements.map(k => `${k}=${fields[k]}`).join(', ')}`)] }));
          return;
        }
      }
      if (c.stage === 1 && !locked && c.assessment && /request|send|demander/i.test(value) && /engineering/i.test(value)) {
        setCase(p => ({ ...p, messages: [...p.messages, message('user', value), message('assistant', 'Prepare the referral with the documented assessment and the reason for the request. The final disposition will wait for the engineering opinion.')] }));
        setModal({ kind: 'decision', disposition: 'engineering' });
        return;
      }
      if (c.stage === 1 && /assess|evaluat|analy[sz]|requirement|criteria|rule/i.test(value) && !locked) {
        const assessment = assess(c.fields, c.categoryConfirmed, c.documentState ?? 'aligned');
        setCase(p => ({ ...p, assessment, messages: [...p.messages, message('user', value), message('assistant', assessmentReply(assessment))], audit: [...p.audit, event(`Assessment performed: ${assessment.title}`)] }));
      } else {
        const response = c.stage === 1 ? c.assessment ? assessmentReply(c.assessment) : 'Start the assessment to compare the recorded measurements with the demo design requirements. Confirm the defect type in the case record first.' : `${doneTasks} of ${c.tasks.length} actions are complete. ${canClose(c) ? 'The final inspection is recorded. You can now close the case.' : `Next action: ${c.tasks.find(t => !t.done)?.title ?? 'review the final record'}. Use the action list to simulate progress.`}`;
        setCase(p => ({ ...p, messages: [...p.messages, message('user', value), message('assistant', response)] }));
      }
    }
  }
  function exportCase() {
    const payload = { ...serializableCase(c), simulation: true, exportedAt: new Date().toISOString(), references: c.assessment?.documents ?? [], attachmentNotice: 'Attachment metadata and annotations only; original files are not included.' };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `${c.id}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('Case record exported as JSON, including its audit trail.');
  }
  async function attach(files: FileList | File[]) {
    if (locked) return;
    const accepted: Attachment[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain'].includes(file.type)) { notify('Use JPG, PNG, WebP, PDF or TXT files up to 10 MB each.'); continue; }
      const image = file.type.startsWith('image/'), url = image ? URL.createObjectURL(file) : undefined;
      if (url) fileURLs.current.push(url);
      accepted.push({ id: uid(), name: file.name, size: file.size, image, url });
    }
    if (accepted.length) {
      setCase(p => ({ ...p, attachments: [...p.attachments, ...accepted], audit: [...p.audit, event(`${accepted.length} evidence file(s) attached`)], messages: [...p.messages, message('assistant', `${accepted.length} evidence file(s) added. ${accepted.some(a => a.image) ? 'Open a photo to mark the defect. A photo is evidence, not a dimensional measurement.' : 'File metadata is recorded; this mockup does not read the document content.'}`)] }));
    }
    if (fileRef.current) fileRef.current.value = '';
  }
  function declare() {
    if (!captureReady(c.fields) || locked) return;
    setCase(p => ({ ...p, declared: true, stage: 1, messages: [...p.messages, message('assistant', `${p.id} has been declared. Next, confirm the defect type and assess the case against the design requirements. The original observation remains available in the case record.`)], audit: [...p.audit, event('Non-conformance declared by Marie Laurent (demo)')] }));
    setModal(null); notify('Non-conformance declared. Ready for assessment.');
  }
  function decision(d: Disposition, reason: string) {
    if (!c.assessment?.options.includes(d)) return;
    setCase(p => ({ ...p, stage: 2, disposition: d, decisionReason: reason, tasks: tasksFor(d), audit: [...p.audit, event(d === 'engineering' ? `Engineering review requested by Marie Laurent (demo): ${reason}` : `Disposition approved by Marie Laurent (demo): ${DISPOSITION_NAMES[d]}. ${reason}`)], messages: [...p.messages, message('assistant', `${d === 'engineering' ? 'Engineering review requested' : `Disposition recorded: ${DISPOSITION_NAMES[d]}`}. ${d === 'engineering' ? 'The case is routed for further engineering review. Record the opinion before continuing.' : 'I’ve prepared the resolution actions with their responsible teams. Work orders and status updates are simulated locally.'}`)] }));
    setModal(null); notify(d === 'engineering' ? 'Engineering referral prepared. Track the request and opinion.' : 'Disposition confirmed. Resolution plan created.');
  }
  function completeTask(id: string, finalCheck?: string) {
    const index = c.tasks.findIndex(t => t.id === id);
    if (index < 0 || c.closed || c.tasks[index].done || c.tasks.slice(0, index).some(t => !t.done)) return;
    setCase(p => ({ ...p, tasks: p.tasks.map(t => t.id === id ? { ...t, done: true } : t), finalCheck: finalCheck ?? p.finalCheck, audit: [...p.audit, event(`${p.tasks[index].title} completed (simulation)${finalCheck ? `: ${finalCheck}` : ''}`)], messages: [...p.messages, message('assistant', `${p.tasks[index].title}: complete.${finalCheck ? `\nInspection record: ${finalCheck}` : '\nThe simulated action is recorded in the case history.'}`)] }));
    setModal(null);
  }
  function closeCase() {
    if (!canClose(c)) return;
    setCase(p => ({ ...p, closed: true, audit: [...p.audit, event('Case closed by Marie Laurent (demo)')], messages: [...p.messages, message('assistant', 'The case is closed. All resolution actions and the final inspection are recorded. You can export the complete record or start a new non-conformance.')] }));
    setModal(null); notify('Case closed. The full record is ready to export.');
  }
  function field(key: FieldKey) {
    const value = key === 'category' ? CATEGORY_NAMES[c.fields.category] : c.fields[key];
    return <div className="field" key={key}><div className="field-label">{LABELS[key]}{REQUIRED.includes(key) && <span className="required-dot" title="Required for declaration" />}{!locked && <button className="field-edit" aria-label={`Edit ${LABELS[key]}`} onClick={() => setModal({ kind: 'edit', field: key })}><Pencil size={12} /></button>}</div>
      <div className={`field-value ${!c.fields[key] ? 'empty' : ''}`}>{c.fields[key] ? value : key === 'category' ? 'Not yet classified' : 'Not provided'}{key === 'category' && c.fields.category && !c.categoryConfirmed && <span className="badge amber">To confirm</span>}</div>
      {c.fields[key] && <div className="field-source"><span className={`source-dot ${c.origins[key]?.includes('Suggested') ? 'amber' : ''}`} />{c.origins[key] ?? 'Operator'}</div>}
      {key === 'category' && c.fields.category && !c.categoryConfirmed && !locked && <button className="text-button confirm-type" onClick={() => { setCase(p => p.declared ? { ...p, categoryConfirmed: true, assessment: null, origins: { ...p.origins, category: 'Operator · confirmed' }, audit: [...p.audit, event('Defect type confirmed for assessment')] } : invalidateAnalysis(p, p.fields, { ...p.origins, category: 'Operator · confirmed' }, true)); notify('Defect type confirmed.'); }}><Check size={13} />Confirm this type</button>}
    </div>;
  }
  const selectedAttachment = modal?.kind === 'attachment' ? c.attachments.find(a => a.id === modal.id) : undefined;

  return <div className="app-shell">
    <aside className="rail" aria-label="Main navigation"><button className="brand-mark" aria-label="NC Copilot help" onClick={() => setModal({ kind: 'help' })}><span>N</span><i /></button><div className="rail-divider" />
      <button className="rail-button active" aria-label="Case workspace" title="Case workspace" onClick={() => { setTab('record'); setModal(c.stage > 0 ? { kind: 'record' } : null); }}><MessageSquare size={20} /><span /></button>
      <button className="rail-button" aria-label="Demo case library" title="Demo case library" onClick={() => setModal({ kind: 'scenarios' })}><FolderOpen size={20} /></button>
      <button className="rail-button" aria-label="Source systems" title="Source systems" onClick={() => setModal({ kind: 'sources' })}><Layers3 size={20} /></button>
      <div className="rail-bottom"><button className="rail-button" aria-label="How this demo works" title="How this demo works" onClick={() => setModal({ kind: 'help' })}><HelpCircle size={20} /></button><span className="rail-avatar">ML</span></div>
    </aside>
    <div className="app-main"><header className="topbar"><div className="brand">NC <span>Copilot</span><span className="brand-divider" /><span className="workspace-name">Quality workspace <ChevronDown size={12} /></span></div>
      <div className="topbar-right"><span className="demo-label"><span />Interactive demo</span><span className="topbar-divider" /><div className="person"><span className="avatar">ML</span><span>Marie Laurent<small>Production quality</small></span></div></div>
    </header>
    <main className={`main-content phase-${c.stage}`}><div className="breadcrumb"><span>Workspace</span><ChevronRight size={12} /><span>Non-conformances</span><ChevronRight size={12} /><strong>{c.declared ? c.id : 'New case'}</strong></div>
      <div className="page-heading"><div><div className="heading-kicker">{c.stage === 0 ? 'QUALITY, IN CONVERSATION' : c.stage === 1 ? 'EVIDENCE, INTO DECISIONS' : 'DECISIONS, INTO ACTIONS'}</div><h1>{c.stage === 0 ? 'From observation to resolution' : c.stage === 1 ? 'Assess the evidence. Decide the next step' : 'Follow the resolution through'}<span>.</span></h1><p>{c.stage === 0 ? 'Capture the facts. Make informed decisions. Keep things moving.' : c.stage === 1 ? 'A conversation supported by the right documents, criteria and sources.' : 'A clear execution plan, responsible teams and evidence for closure.'}</p></div><div className="heading-actions"><button className="button export-button" onClick={exportCase}><ArrowDownToLine size={15} />Export record</button><button className="button" onClick={() => c.messages.length || c.attachments.length || c.fields.observation ? setModal({ kind: 'reset' }) : restart()}><Plus size={15} />New case</button></div></div>
      <nav className="stepper" aria-label="Case workflow">{STAGES.map((s, index) => <button key={s.name} className={`step ${c.stage === index ? 'current' : ''} ${(index === 0 ? c.declared : index === 1 ? Boolean(c.disposition) : c.closed) ? 'done' : ''}`} aria-current={c.stage === index ? 'step' : undefined} disabled={index === 1 ? !c.declared : index === 2 ? !c.disposition : false} onClick={() => setCase(p => ({ ...p, stage: index as 0 | 1 | 2 }))}><span className="step-number">{(index === 0 ? c.declared : index === 1 ? Boolean(c.disposition) : c.closed) ? <Check size={16} /> : `0${index + 1}`}</span><span><strong>{s.name}</strong><small>{s.detail}</small></span>{index < 2 && <ChevronRight className="step-arrow" size={17} />}{c.stage === index && <span className="step-active-dot" />}</button>)}</nav>
      {c.closed && <div className="closed-banner"><CheckCircle2 size={18} /><span><strong>Case resolved.</strong> All actions and the final inspection are recorded.</span><button className="text-button" onClick={exportCase}>Export the record <ArrowRight size={14} /></button></div>}
      <div className={`workspace-grid ${c.stage > 0 ? 'phase-grid' : ''}`}>
        <section className={`conversation card ${dragging ? 'dragging' : ''}`} aria-label="Case conversation" onDragOver={e => { e.preventDefault(); if (!locked) setDragging(true); }} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }} onDrop={e => { e.preventDefault(); setDragging(false); void attach(e.dataTransfer.files); }}>
          <div className="card-heading"><div className="card-heading-title"><MessageSquare size={16} /><h2>{c.stage === 1 ? 'Assessment conversation' : c.stage === 2 ? 'Execution conversation' : 'Your quality copilot'}</h2></div><span className="conversation-presence"><span />Here to help</span></div>
          <div className="chat-scroll">
            {c.stage > 0 && <div className="phase-chat-guide"><span className="section-eyebrow">{c.stage === 1 ? 'YOUR COPILOT, WITH THE EVIDENCE' : 'YOUR COPILOT, THROUGH EXECUTION'}</span><p>{c.stage === 1 ? 'Explore the criteria, ask why an option is recommended, or identify a documentation gap.' : 'Ask what comes next or how the resolution is progressing. Track the actions alongside the conversation.'}</p>{c.stage === 1 && !locked && <div><button onClick={() => send('Assess the case against the documentation')}><Search size={12} />Run document review</button><button disabled={!c.assessment} onClick={() => send('Why this disposition?')}><Sparkles size={12} />Explain the recommendation</button></div>}</div>}

            {c.messages.length === 0 ? <div className="welcome"><div className="welcome-art"><span className="orbit orbit-one" /><span className="orbit orbit-two" /><span className="spark-mark"><Sparkles size={27} strokeWidth={1.5} /></span><span className="art-dot dot-one" /><span className="art-dot dot-two" /><span className="art-plus">+</span></div><div className="eyebrow">LET’S GET THE FULL PICTURE</div><h2>Something doesn’t look right?<br /><span>Let’s work through it.</span></h2><p>Describe what you’ve noticed. I’ll help you capture the details<br className="desktop-break" /> and bring the right information together.</p>
              <div className="entry-cards"><button className="entry-card" onClick={() => { inputRef.current?.focus(); setInput(''); }}><span className="entry-icon mint"><MessageSquare size={19} /></span><strong>Describe an issue</strong><small>Start with your observation</small><ArrowRight size={13} /></button><button className="entry-card" onClick={() => fileRef.current?.click()}><span className="entry-icon blue"><Paperclip size={19} /></span><strong>Add evidence</strong><small>A photo or inspection report</small><ArrowRight size={13} /></button><button className="entry-card" onClick={() => setModal({ kind: 'map' })}><span className="entry-icon lavender"><MapPin size={19} /></span><strong>Locate the defect</strong><small>Choose an aircraft area</small><ArrowRight size={13} /></button></div>
              <button className="example-button" onClick={() => setModal({ kind: 'scenarios' })}><Sparkles size={13} />Just exploring? Try a sample case <ArrowRight size={13} /></button>
            </div> : <div className="messages">{c.messages.map(m => <div key={m.id} className={`message ${m.role}`}>
              {m.role === 'assistant' && <span className="assistant-avatar"><Sparkles size={15} /></span>}
              <div className="message-copy">{m.role === 'assistant' && <span className="message-name">NC Copilot</span>}<p>{m.text}</p>{m.role === 'assistant' && c.assessment && <div className="chat-citations">{c.assessment.documents.filter(d => m.text.includes(d.id)).map(d => <button key={d.id} onClick={() => setModal({ kind: 'document', doc: d })}><FileText size={11} />{d.id}</button>)}</div>}</div>{m.role === 'user' && <span className="avatar message-avatar">ML</span>}
            </div>)}</div>}
            {c.messages.length > 0 && c.stage === 0 && !locked && <div className="guided-block"><div className="guided-label"><span />{captureReady(c.fields) ? 'READY WHEN YOU ARE' : 'ONE DETAIL AT A TIME'}</div>{!captureReady(c.fields) && <p>{question.text}</p>}<div className="quick-replies">{question.chips.map(text => <button className="quick" key={text} onClick={() => send(text)}>{text}<ArrowRight size={12} /></button>)}{captureReady(c.fields) && <button className="button primary" onClick={() => setModal({ kind: 'declare' })}>Review & declare NC <ArrowRight size={15} /></button>}<button className="quick" onClick={() => fileRef.current?.click()}><Paperclip size={13} />Add evidence</button></div></div>}
            <div ref={bottom} />
          </div>
          <div className="composer-zone">{c.attachments.length > 0 && <div className="attachment-tray">{c.attachments.map(a => <div className="attachment-chip" key={a.id}><button onClick={() => setModal({ kind: 'attachment', id: a.id })}>{a.image && a.url ? <img src={a.url} alt="" /> : <FileText size={17} />}<span>{a.name}{a.point && <small>Annotated</small>}</span></button>{!locked && <button className="attachment-remove" aria-label={`Remove ${a.name}`} onClick={() => { if (a.url) URL.revokeObjectURL(a.url); setCase(p => ({ ...p, attachments: p.attachments.filter(f => f.id !== a.id), audit: [...p.audit, event(`Evidence removed: ${a.name}`)] })); }}><X size={12} /></button>}</div>)}</div>}
            <form className={`composer ${c.closed ? 'disabled' : ''}`} onSubmit={e => { e.preventDefault(); send(); }}><label className="sr-only" htmlFor="chat-input">Message your copilot</label><textarea id="chat-input" ref={inputRef} rows={2} maxLength={4000} disabled={c.closed} value={input} onChange={e => setInput(e.target.value)} placeholder={c.closed ? 'Case closed. Start a new case to continue.' : c.stage === 0 ? 'Describe the issue, or drop a photo here…' : c.stage === 1 ? 'Ask to assess the case or explain the recommendation…' : 'Ask about the resolution status…'} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} /><div className="composer-tools"><div><button type="button" className="icon-button" disabled={locked} aria-label="Attach evidence" title="Attach evidence" onClick={() => fileRef.current?.click()}><Paperclip size={17} /></button><span className="composer-hint">{c.stage === 0 ? 'A description, a photo, a starting point.' : 'Your next step, in conversation.'}</span></div><button type="submit" className="send-button" aria-label="Send message" disabled={!input.trim() || c.closed}><ArrowUp size={18} /></button></div></form>
            <input className="sr-only" tabIndex={-1} ref={fileRef} type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf,text/plain" onChange={e => { if (e.target.files) void attach(e.target.files); }} />
            <div className="composer-footer"><span><ShieldCheck size={11} />You stay in control of every decision.</span><span>Simulated assistant · no live AI</span></div>
          </div>
          {dragging && <div className="drop-overlay"><Paperclip size={28} /><strong>Drop your evidence here</strong><span>Images, PDF or text · up to 10 MB each</span></div>}
        </section>
        {c.stage === 1 && <AssessmentWorkspace c={c} onAssess={evaluate} onReview={d => setModal({ kind: 'decision', disposition: d })} onDocument={doc => setModal({ kind: 'document', doc })} onRecord={() => setModal({ kind: 'record' })} onDocumentState={setDocumentation} onContinue={() => setCase(p => ({ ...p, stage: 2 }))} />}
        {c.stage === 2 && <ExecutionWorkspace c={c} onRecord={() => setModal({ kind: 'record' })} onTask={task => task.kind === 'inspection' || task.kind === 'opinion' ? setModal({ kind: task.kind, task: task.id }) : completeTask(task.id)} onClose={() => setModal({ kind: 'close' })} onExport={exportCase} onDocument={doc => setModal({ kind: 'document', doc })} />}
        {c.stage === 0 &&         <aside className="consolidation card" aria-label="Consolidated case record"><div className="card-heading"><div className="card-heading-title"><Layers3 size={16} /><h2>The full picture</h2></div><span className={`badge ${c.closed ? 'green' : c.declared ? 'blue' : ''}`}><span className="badge-dot" />{status}</span></div>
          <div className="panel-tabs" role="tablist" aria-label="Case panel">{(['record', 'sources', 'history'] as const).map(t => <button key={t} id={`tab-${t}`} role="tab" aria-selected={tab === t} aria-controls={`panel-${t}`} tabIndex={tab === t ? 0 : -1} onKeyDown={e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const tabs = ['record', 'sources', 'history'] as const; const next = tabs[(tabs.indexOf(t) + (e.key === 'ArrowRight' ? 1 : 2)) % 3]; setTab(next); document.getElementById(`tab-${next}`)?.focus(); } }} className={tab === t ? 'selected' : ''} onClick={() => setTab(t)}>{t === 'record' ? 'Case record' : t === 'sources' ? 'Sources' : 'History'}{t === 'sources' && <span className="tab-count">3</span>}</button>)}</div>
          <div className="panel-body" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
            {tab === 'record' && <><div className="capture-progress"><div><strong>{c.closed ? 'Resolution complete' : c.declared ? c.id : 'Building your case'}</strong><span>{c.closed ? <CheckCheck size={15} /> : `${progress}/4`}</span></div><p>{c.declared ? 'Declared facts, sources and decisions in one place.' : 'Essential details for a clear declaration.'}</p><div className="progress-track" aria-label={`${progress} of 4 essential details captured`}>{REQUIRED.map(k => <i className={c.fields[k] && (k !== 'msn' || /^\d{3,8}$/.test(c.fields.msn)) ? 'filled' : ''} key={k} />)}</div></div>
              <div className="field-groups"><Group title="The observation" icon={Target}>{field('observation')}{field('category')}</Group><Group title="Product & traceability" icon={Plane} hint={c.fields.program ? `${c.fields.program}${c.fields.msn ? ` · MSN ${c.fields.msn}` : ''}` : undefined}><div className="fields-grid">{field('program')}{field('msn')}{field('part')}{field('lot')}</div>{field('material')}</Group><Group title="Location" icon={MapPin} defaultOpen={Boolean(c.fields.zone)} hint={!c.fields.zone ? 'Where on the aircraft?' : undefined}>{field('zone')}{c.fields.zone && <div className="map-preview"><AircraftMap zone={c.fields.zone} mini /><div><span><MapPin size={11} />{c.fields.zone}</span>{!locked && <button className="text-button" onClick={() => setModal({ kind: 'map' })}>Change <ArrowRight size={11} /></button>}</div></div>}</Group><Group title="Measurements & evidence" icon={ClipboardCheck} defaultOpen={Boolean(c.fields.depth || c.fields.diameter || c.attachments.length)} hint={`${c.attachments.length} file${c.attachments.length === 1 ? '' : 's'} attached`}><div className="fields-grid">{c.fields.category === 'dimensional' ? field('diameter') : <>{field('length')}{field('depth')}</>}</div>{c.attachments.map(a => <button className="evidence-row" key={a.id} onClick={() => setModal({ kind: 'attachment', id: a.id })}><FileText size={14} /><span>{a.name}</span><ChevronRight size={13} /></button>)}{!locked && <button className="text-button" onClick={() => fileRef.current?.click()}><Plus size={13} />Add evidence</button>}</Group>
              {c.assessment && <Group title="Assessment & disposition" icon={ShieldCheck}><div className="assessment-mini"><span className={`badge ${c.assessment.result === 'accepted' ? 'green' : 'amber'}`}>{c.assessment.title}</span>{reference && <button className="text-button" onClick={() => setModal({ kind: 'reference', reference: c.assessment!.requirement! })}><BookOpen size={13} />{reference.id} · Rev. {reference.revision}<ArrowRight size={12} /></button>}<strong>{DISPOSITION_NAMES[c.disposition ?? c.assessment.recommended]}</strong><small>{c.disposition ? 'Approved disposition · demo reviewer' : 'Recommendation · awaiting your decision'}</small>{c.decisionReason && <p>{c.decisionReason}</p>}</div></Group>}</div>
            </>}
            {tab === 'sources' && <div className="sources-panel"><div className="section-eyebrow">CONNECTED CONTEXT, SIMULATED</div><h3>Information with a source.</h3><p>Explore the information the platform would bring together from your systems.</p>{[{ title: 'Manufacturing context', system: 'MES', icon: Plane, detail: c.fields.part ? `${c.fields.program} · MSN ${c.fields.msn} · ${c.fields.part}` : 'Aircraft, part and batch identification', status: c.fields.part ? 'Context available' : 'Not selected' }, { title: 'Design requirements', system: 'PLM', icon: BookOpen, detail: reference ? `${reference.id} · Revision ${reference.revision}` : '2 fictional engineering requirements', status: reference ? 'Requirement matched' : 'Demo library' }, { title: 'Related quality cases', system: 'QMS', icon: FolderOpen, detail: 'Historical example NC-SIM-017 · similar surface defect', status: 'Illustrative example' }].map(s => <button className="source-card" key={s.system} onClick={() => setModal({ kind: 'sources' })}><span className="group-icon"><s.icon size={17} /></span><div><span className="source-system">{s.system}</span><strong>{s.title}</strong><small>{s.detail}</small><span className="source-status"><span />{s.status}</span></div><ChevronRight size={14} /></button>)}<div className="note"><Database size={15} /><span>No external systems are connected. All source data in this demo is fictional.</span></div></div>}
            {tab === 'history' && <div className="history-panel"><div className="section-eyebrow">CASE AUDIT TRAIL</div><h3>Every step, in context.</h3><p>Recorded locally · times shown in Paris time.</p><ol className="history-list">{[...c.audit].reverse().map((e, i) => <li key={e.id}><span className={`history-dot ${i === 0 ? 'latest' : ''}`} /><time dateTime={e.time}>{time(e.time)}</time><p>{e.text}</p></li>)}</ol></div>}
          </div>
          <div className="panel-footer">{!locked ? <><button className="button primary full" disabled={!captureReady(c.fields)} onClick={() => setModal({ kind: 'declare' })}>Review & declare NC <ArrowRight size={15} /></button><p>{captureReady(c.fields) ? 'Ready for your review.' : 'Capture the 4 essential details to continue.'}</p></> : <><button className="button full" onClick={exportCase}><ArrowDownToLine size={14} />Export case record</button><p>{c.closed ? 'Resolved · complete audit trail retained.' : `${doneTasks} of ${c.tasks.length} resolution actions complete.`}</p></>}</div>
        </aside>}
      </div>
      <div className="context-strip"><div className="context-title"><span className="context-spark"><Sparkles size={14} /></span><span>Bringing the context together</span></div><div className="context-agents"><span className={c.fields.part ? 'ready' : ''}><span />Product context<small>MES</small></span><span className={reference ? 'ready' : ''}><span />Design requirements<small>PLM</small></span><span><span />Related cases<small>QMS</small></span></div><button onClick={() => setModal({ kind: 'sources' })} className="icon-button" aria-label="Explore simulated source systems"><MoreHorizontal size={18} /></button></div>
      <footer className="page-footer"><span>NC Copilot <span className="footer-dot">·</span> A clearer path to quality.</span><span>{storageOK ? 'Saved in this browser' : 'Storage unavailable · export to keep your work'}<span className="footer-dot">·</span>Fictional demo data</span></footer>
    </main></div>
    {toast && <div className="toast" role="status"><CheckCircle2 size={17} /><span>{toast}</span><button aria-label="Dismiss notification" onClick={() => setToast('')}><X size={15} /></button></div>}
    {modal && <Dialog title={modal.kind === 'document' ? modal.doc.title : modal.kind === 'record' ? 'Declared facts & case history' : modal.kind === 'edit' ? `Edit ${LABELS[modal.field].toLowerCase()}` : modal.kind === 'scenarios' ? 'A few ways to start.' : modal.kind === 'declare' ? 'Ready to declare the non-conformance?' : modal.kind === 'decision' ? c.assessment?.recommended === 'engineering' ? 'Prepare the engineering referral.' : 'Choose the next right step.' : modal.kind === 'reference' ? REFERENCES[modal.reference].title : modal.kind === 'map' ? 'Where did you notice it?' : modal.kind === 'inspection' ? 'Record the final inspection.' : modal.kind === 'opinion' ? 'Record the engineering opinion.' : modal.kind === 'reset' ? 'Start a new case?' : modal.kind === 'close' ? 'Close the non-conformance?' : modal.kind === 'attachment' ? selectedAttachment?.name ?? 'Evidence' : modal.kind === 'help' ? 'Quality, in conversation.' : 'A connected picture of the case.'} eyebrow={modal.kind === 'document' ? `${modal.doc.kind.toUpperCase()} · FICTIONAL DEMO DOCUMENT` : modal.kind === 'reference' ? 'ENGINEERING REFERENCE · FICTIONAL DEMO DOCUMENT' : undefined} onClose={() => setModal(null)} wide={modal.kind === 'sources' || modal.kind === 'map' || modal.kind === 'record'}>
      {modal.kind === 'record' && <><p className="dialog-description">Captured facts and their provenance remain available throughout assessment and execution.</p><div className="record-dialog-grid">{(Object.keys(LABELS) as FieldKey[]).map(k => field(k))}</div><h3 className="record-history-heading">Case history</h3><ol className="record-history">{[...c.audit].reverse().map(e => <li key={e.id}><time>{time(e.time)}</time><p>{e.text}</p></li>)}</ol><div className="dialog-actions"><button className="button" onClick={exportCase}><ArrowDownToLine size={14} />Export record</button><button className="button primary" onClick={() => setModal(null)}>Back to the workspace</button></div></>}
      {modal.kind === 'document' && <><div className="reference-meta"><span className="badge blue">{modal.doc.id}</span><span>Revision {modal.doc.revision}</span><span>{modal.doc.section}</span></div><div className="reference-section"><span className="section-eyebrow">APPLICABILITY</span><p>{modal.doc.scope}</p></div>{modal.doc.status === 'missing' ? <div className="note amber"><AlertCircle size={16} /><span>This instruction is unavailable in the selected demo document set. Its content has not been consulted; an engineering opinion is required.</span></div> : <><div className="reference-section"><span className="section-eyebrow">RELEVANT EXTRACT</span><p className="document-extract">{modal.doc.extract}</p></div>{modal.doc.status === 'conflict' && <div className="note amber"><AlertCircle size={16} /><span>A revision conflict is reported for this DAC. This extract cannot establish a disposition until engineering reconciles the document set.</span></div>}</>}<div className="note"><FileText size={16} /><span>Fictional document and limits, used only to simulate the documentation review.</span></div><div className="dialog-actions"><button className="button primary" onClick={() => setModal(null)}>Back to the case</button></div></>}
      {modal.kind === 'edit' && <FieldEditor field={modal.field} value={c.fields[modal.field]} onSave={v => changeField(modal.field, v)} onCancel={() => setModal(null)} />}
      {modal.kind === 'scenarios' && <><p className="dialog-description">Choose a fictional scenario to explore the full workflow. {c.messages.length > 0 && 'Loading a scenario replaces the current case. Export it first if you want to keep a copy.'}</p><div className="scenario-list">{SCENARIOS.map((s, i) => <button key={s.id} className="scenario-card" onClick={() => loadScenario(s.id)}><span className={`entry-icon ${i === 0 ? 'mint' : i === 1 ? 'blue' : 'lavender'}`}>{i === 0 ? <Wrench size={20} /> : i === 1 ? <Target size={20} /> : <Search size={20} />}</span><span><strong>{s.title}</strong><small>{s.subtitle}</small></span><span className="badge">{s.tag}</span><ArrowRight size={16} /></button>)}</div><div className="dialog-actions">{c.messages.length > 0 && <button className="button" onClick={exportCase}><ArrowDownToLine size={14} />Export current case</button>}<button className="button" onClick={() => setModal(null)}>Cancel</button></div></>}
      {modal.kind === 'declare' && <><p className="dialog-description">Review the essential facts below. Technical acceptability and the disposition are assessed in the next step.</p><div className="declaration-summary">{REQUIRED.map(k => <div key={k}><small>{LABELS[k]}</small><strong>{c.fields[k]}</strong></div>)}</div><div className="note"><FileText size={16} /><span>{c.attachments.length} evidence file(s) · {c.fields.part || 'Part Number not provided'} · {c.fields.category ? CATEGORY_NAMES[c.fields.category] : 'Type not yet classified'}</span></div><div className="dialog-actions"><button className="button" onClick={() => setModal(null)}>Keep editing</button><button className="button primary" disabled={!captureReady(c.fields)} onClick={declare}>Declare NC <ArrowRight size={15} /></button></div></>}
      {modal.kind === 'decision' && c.assessment && <DecisionForm c={c} initialDisposition={modal.disposition} onSave={decision} onCancel={() => setModal(null)} />}
      {modal.kind === 'reference' && <><div className="reference-meta"><span className="badge green">{REFERENCES[modal.reference].id}</span><span>Revision {REFERENCES[modal.reference].revision}</span><span>{REFERENCES[modal.reference].section}</span></div><div className="reference-section"><span className="section-eyebrow">APPLICABILITY</span><p>{REFERENCES[modal.reference].scope}</p></div><div className="reference-section"><span className="section-eyebrow">ACCEPTANCE CRITERIA</span><p>{REFERENCES[modal.reference].acceptance}</p></div><div className="reference-section"><span className="section-eyebrow">REPAIR ENVELOPE & INSTRUCTION</span><p>{REFERENCES[modal.reference].repair}</p></div><div className="reference-section"><span className="section-eyebrow">ESCALATION</span><p>{REFERENCES[modal.reference].outside}</p></div><div className="note amber"><AlertCircle size={16} /><span>This document and its limits are fictional, created for this prototype. No live engineering document is being retrieved.</span></div><div className="dialog-actions"><button className="button primary" onClick={() => setModal(null)}>Back to the case</button></div></>}
      {modal.kind === 'map' && <><p className="dialog-description">Select a broad aircraft area. This schematic locates the observation; a photo annotation is stored separately.</p><div className="map-dialog"><AircraftMap zone={c.fields.zone} select={z => changeField('zone', z)} /><div className="zone-options">{ZONES.map(z => <button className={`zone-option ${c.fields.zone === z ? 'selected' : ''}`} key={z} onClick={() => changeField('zone', z)}><MapPin size={15} />{z}{c.fields.zone === z && <Check size={15} />}</button>)}</div></div></>}
      {modal.kind === 'sources' && <><p className="dialog-description">These illustrative records show how source information could support the conversation. All data is local and simulated.</p><div className="system-grid"><div><span className="badge blue">MES · SIMULATED</span><h3>Manufacturing context</h3><dl><dt>Program / MSN</dt><dd>{c.fields.program || 'A320'} / {c.fields.msn || '12084'}{!c.fields.msn && ' (example)'}</dd><dt>Part Number</dt><dd>{c.fields.part || 'SUP-7341 (example)'}</dd><dt>Batch</dt><dd>{c.fields.lot || 'L-2026-041 (example)'}</dd></dl><button className="button small" disabled={locked} onClick={() => { setCase(p => invalidateAnalysis(p, { ...p.fields, program: 'A320', msn: '12084', part: p.fields.category === 'dimensional' ? 'BRK-6210' : 'SUP-7341', material: 'Aluminium', lot: 'L-2026-041' }, { ...p.origins, program: 'MES · simulated context', msn: 'MES · simulated context', part: 'MES · simulated context', material: 'MES · simulated context', lot: 'MES · simulated context' })); setModal(null); setTab('record'); notify('A320 demo product context imported. Review it before declaration.'); }}>Import A320 demo context <ArrowRight size={13} /></button></div><div><span className="badge green">PLM · SIMULATED</span><h3>Design requirements</h3><div className="library-list">{(['surface', 'dimensional'] as const).map(k => <button className="reference-link" key={k} onClick={() => setModal({ kind: 'reference', reference: k })}><FileText size={17} /><span><strong>{REFERENCES[k].id} · Rev. {REFERENCES[k].revision}</strong><small>{REFERENCES[k].title}</small></span><ChevronRight size={14} /></button>)}</div></div><div className="related-case"><span className="badge">QMS · HISTORICAL EXAMPLE</span><h3>NC-SIM-017 · Surface defect</h3><p>A separate fictional A320 bracket case with a surface scratch was repaired and inspected. Similarity does not establish that the same disposition applies to the current case.</p><span className="related-case-result"><CheckCircle2 size={14} />Example status: closed after repair</span></div></div></>}
      {modal.kind === 'attachment' && selectedAttachment && <><p className="dialog-description">{Math.max(1, Math.round(selectedAttachment.size / 1024))} KB · {selectedAttachment.image ? 'Photo evidence' : 'Document metadata'}. {selectedAttachment.url ? 'Click the photo to mark the defect.' : 'Original files are not retained after a page reload. Reattach the file to restore its preview.'}</p>{selectedAttachment.url ? <button className="annotation-image" disabled={locked} aria-label="Mark defect on photo" onClick={e => { const rect = e.currentTarget.getBoundingClientRect(); const point = { x: e.detail === 0 ? 50 : Math.max(0, Math.min(100, (e.clientX - rect.left) / rect.width * 100)), y: e.detail === 0 ? 50 : Math.max(0, Math.min(100, (e.clientY - rect.top) / rect.height * 100)) }; setCase(p => ({ ...p, attachments: p.attachments.map(a => a.id === selectedAttachment.id ? { ...a, point } : a), audit: [...p.audit, event(`Photo annotated: ${selectedAttachment.name}`)] })); }}><img src={selectedAttachment.url} alt={selectedAttachment.name} />{selectedAttachment.point && <span className="annotation-point" style={{ left: `${selectedAttachment.point.x}%`, top: `${selectedAttachment.point.y}%` }} />}</button> : <div className="file-placeholder"><FileText size={36} /><strong>{selectedAttachment.name}</strong><span>{selectedAttachment.image ? 'Preview unavailable in this session' : 'Document content is not analysed in this demo'}</span></div>}{selectedAttachment.point && <div className="note"><MapPin size={15} /><span>Photo marker: {selectedAttachment.point.x.toFixed(1)}% across, {selectedAttachment.point.y.toFixed(1)}% down. Not an aircraft position.</span></div>}<div className="dialog-actions"><button className="button primary" onClick={() => setModal(null)}>Done</button></div></>}
      {modal.kind === 'inspection' && <InspectionForm c={c} onSave={summary => completeTask(modal.task, summary)} onCancel={() => setModal(null)} />}
      {modal.kind === 'opinion' && <OpinionForm onCancel={() => setModal(null)} onSave={(d, text) => { setCase(p => ({ ...p, disposition: d, decisionReason: text, tasks: [...p.tasks.map(t => ({ ...t, done: true })), ...tasksFor(d)], audit: [...p.audit, event(`Engineering opinion received and disposition approved (demo): ${DISPOSITION_NAMES[d]}. ${text}`)], messages: [...p.messages, message('assistant', `Engineering opinion recorded: ${text}. Disposition: ${DISPOSITION_NAMES[d]}. The resolution plan has been updated.`)] })); setModal(null); }} />}
      {modal.kind === 'reset' && <><p className="dialog-description">This replaces the current case in this browser. Export the record first if you want to keep a copy.</p><div className="dialog-actions"><button className="button" onClick={() => setModal(null)}>Cancel</button><button className="button" onClick={exportCase}><ArrowDownToLine size={14} />Export first</button><button className="button primary" onClick={restart}>Start new case <Plus size={15} /></button></div></>}
      {modal.kind === 'close' && <><p className="dialog-description">All {c.tasks.length} resolution actions are complete and the final inspection is recorded. Closing preserves the case history and locks the record.</p><div className="note"><ClipboardCheck size={17} /><span>{c.finalCheck}</span></div><div className="dialog-actions"><button className="button" onClick={() => setModal(null)}>Keep open</button><button className="button primary" disabled={!canClose(c)} onClick={closeCase}>Confirm closure <CheckCheck size={15} /></button></div></>}
      {modal.kind === 'help' && <><p className="dialog-description">An interactive prototype for managing aerospace non-conformances, from the first observation to a traceable resolution.</p><ol className="help-steps">{STAGES.map((s, i) => <li key={s.name}><span className="step-number">0{i + 1}</span><div><strong>{s.name}</strong><p>{i === 0 ? 'Describe the issue, add evidence, and confirm the consolidated facts.' : i === 1 ? 'Compare measurements with a fictional design requirement and review the proposed disposition.' : 'Simulate work orders, record an inspection, and close the case.'}</p></div></li>)}</ol><div className="note"><Sparkles size={17} /><span>Scripted conversation, fictional references and local storage. No live LLM, PLM, MES or QMS connection. Export contains evidence metadata, not original files.</span></div><div className="dialog-actions"><button className="button" onClick={() => setModal(null)}>Back to workspace</button><button className="button primary" onClick={() => setModal({ kind: 'scenarios' })}>Try a sample case <ArrowRight size={15} /></button></div></>}
    </Dialog>}
  </div>;
}
