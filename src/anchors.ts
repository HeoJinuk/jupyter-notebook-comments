/** Text anchors use UTF-16 offsets, matching CodeMirror and DOM Range. */
export interface TextAnchor {
  type: 'text';
  surface: 'source' | 'rendered';
  start: number;
  end: number;
  quote: string;
  currentQuote: string;
  prefix: string;
  suffix: string;
  textHash: string;
  status: 'attached' | 'changed' | 'detached';
  [key: string]: unknown;
}

export type TextDelta = Array<{ retain?: number; insert?: string; delete?: number }>;

export function isTextAnchor(value: { type: string; [key: string]: unknown }): value is TextAnchor {
  return value.type === 'text' && (value.surface === 'source' || value.surface === 'rendered') &&
    Number.isInteger(value.start) && Number.isInteger(value.end) &&
    typeof value.quote === 'string' && typeof value.currentQuote === 'string' &&
    typeof value.prefix === 'string' && typeof value.suffix === 'string' &&
    typeof value.textHash === 'string' &&
    ['attached', 'changed', 'detached'].includes(String(value.status));
}

function hash(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h = Math.imul(h ^ text.charCodeAt(i), 16777619); }
  return `${text.length}:${h >>> 0}`;
}

function located(anchor: TextAnchor, text: string, start: number, end: number): TextAnchor {
  const currentQuote = text.slice(start, end);
  return {
    ...anchor, start, end, currentQuote,
    prefix: text.slice(Math.max(0, start - 40), start),
    suffix: text.slice(end, end + 40), textHash: hash(text),
    status: !currentQuote ? 'detached' : currentQuote === anchor.quote ? 'attached' : 'changed'
  };
}

export function makeAnchor(surface: TextAnchor['surface'], text: string, start: number, end: number): TextAnchor {
  if (start < 0 || end > text.length || end <= start || !text.slice(start, end).trim()) {
    throw new Error('메모를 달 문장이나 코드를 먼저 선택해 주세요.');
  }
  return located({ type: 'text', surface, start, end, quote: text.slice(start, end),
    currentQuote: '', prefix: '', suffix: '', textHash: '', status: 'attached' }, text, start, end);
}

/** Reopen/external edits: require a unique quote or unambiguous surrounding context.
 * Never guess based on proximity when the same phrase occurs more than once. */
export function reconcileAnchor(anchor: TextAnchor, text: string): TextAnchor {
  if (anchor.status === 'detached') { return anchor; }
  if (anchor.textHash === hash(text) && text.slice(anchor.start, anchor.end) === anchor.currentQuote) {
    return anchor;
  }
  const quote = anchor.currentQuote;
  if (!quote) { return { ...anchor, status: 'detached' }; }
  const candidates: number[] = [];
  for (let i = text.indexOf(quote); i >= 0; i = text.indexOf(quote, i + 1)) { candidates.push(i); }
  const contextual = candidates.filter(start =>
    (!anchor.prefix || text.slice(Math.max(0, start - anchor.prefix.length), start) === anchor.prefix) &&
    (!anchor.suffix || text.slice(start + quote.length, start + quote.length + anchor.suffix.length) === anchor.suffix));
  const matches = contextual.length === 1 ? contextual : candidates;
  return matches.length === 1
    ? located(anchor, text, matches[0], matches[0] + quote.length)
    : { ...anchor, status: 'detached' };
}

/** Map positions through actual Y.Text deltas (including multiple edits per transaction). */
export function trackAnchor(anchor: TextAnchor, delta: TextDelta, text: string): TextAnchor {
  if (anchor.status === 'detached') { return anchor; }
  const edits: Array<{ from: number; to: number; insert: string }> = [];
  let position = 0;
  let pending: { from: number; to: number; insert: string } | null = null;
  for (const op of delta) {
    if (op.retain !== undefined) {
      if (pending) { edits.push(pending); pending = null; }
      position += op.retain;
    }
    if (op.insert !== undefined || op.delete !== undefined) {
      pending ??= { from: position, to: position, insert: '' };
      if (op.insert !== undefined) { pending.insert += op.insert; }
      if (op.delete !== undefined) { position += op.delete; pending.to = position; }
    }
  }
  if (pending) { edits.push(pending); }
  const map = (offset: number, end: boolean): number => {
    let shift = 0;
    for (const edit of edits) {
      if (edit.from === edit.to) {
        if (offset > edit.from || (!end && offset === edit.from)) { shift += edit.insert.length; }
      } else if (end ? offset > edit.to : offset >= edit.to) {
        shift += edit.insert.length - (edit.to - edit.from);
      } else if (end ? offset > edit.from : offset >= edit.from) {
        return edit.from + shift + (end ? edit.insert.length : 0);
      }
    }
    return offset + shift;
  };
  const start = Math.min(text.length, Math.max(0, map(anchor.start, false)));
  const end = Math.min(text.length, Math.max(start, map(anchor.end, true)));
  return located(anchor, text, start, end);
}
