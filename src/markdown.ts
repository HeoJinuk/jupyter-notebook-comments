import { parser, GFM } from '@lezer/markdown';
const markdown = parser.configure(GFM);
export interface Position { start: number; end: number; }
export interface MarkdownMap {
  fromSource(start: number, end: number): Position | null;
  fromRendered(start: number, end: number): Position | null;
}

/** Match visible text in document order, never the first occurrence of a quote.
 * Exact non-whitespace agreement prevents guessing when a custom renderer
 * produces different text (for example, generated math or HTML widgets).
 */
export function createMarkdownMap(source: string, rendered: string,
  decode: (entity: string) => string = basicEntity, atoms: Position[] = []): MarkdownMap | null {
  const hidden = new Uint8Array(source.length);
  const replacements = new Map<number, { end: number; text: string }>();
  const hide = (from: number, to: number): void => { hidden.fill(1, from, to); };
  const parsed = source.split('');
  for (const atom of atoms) {
    for (let i = atom.start; i < atom.end; i++) { if (parsed[i] !== '\n') { parsed[i] = ' '; } }
    parsed[atom.start] = '\uFFFC';
    replacements.set(atom.start, { end: atom.end, text: '\uFFFC' });
  }
  markdown.parse(parsed.join('')).iterate({ enter(node) {
    if (['Image', 'LinkReference', 'HorizontalRule', 'HTMLBlock'].includes(node.name)) {
      hide(node.from, node.to); return false;
    }
    if (['HeaderMark', 'EmphasisMark', 'StrikethroughMark', 'LinkMark', 'LinkTitle',
      'LinkLabel', 'CodeMark', 'CodeInfo', 'QuoteMark', 'ListMark', 'TableDelimiter',
      'TaskMarker', 'HTMLTag'].includes(node.name) || (node.name === 'URL' && node.node.parent?.name !== 'Autolink')) {
      hide(node.from, node.to); return false;
    }
    if (node.name === 'Escape') { hide(node.from, node.from + 1); }
    if (node.name === 'Entity') {
      replacements.set(node.from, { end: node.to, text: decode(source.slice(node.from, node.to)) });
    }
  } });
  let visible = '';
  const sourcePositions: Position[] = [];
  for (let i = 0; i < source.length;) {
    const replacement = replacements.get(i);
    const end = replacement?.end ?? i + 1;
    const text = hidden[i] ? '' : replacement?.text ?? source[i];
    for (let j = 0; j < text.length; j++) {
      if (!/\s/.test(text[j])) { visible += text[j]; sourcePositions.push({ start: i, end }); }
    }
    i = end;
  }
  let displayed = '';
  const renderedPositions: Position[] = [];
  for (let i = 0; i < rendered.length; i++) {
    if (!/\s/.test(rendered[i])) { displayed += rendered[i]; renderedPositions.push({ start: i, end: i + 1 }); }
  }
  if (visible !== displayed) { return null; }
  const project = (from: Position[], to: Position[], start: number, end: number): Position | null => {
    const indices = from.map((position, index) => position.end > start && position.start < end ? index : -1).filter(index => index >= 0);
    return indices.length ? { start: to[indices[0]].start, end: to[indices[indices.length - 1]].end } : null;
  };
  return { fromSource: (start, end) => project(sourcePositions, renderedPositions, start, end),
    fromRendered: (start, end) => project(renderedPositions, sourcePositions, start, end) };
}
function basicEntity(entity: string): string {
  const known: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ' };
  if (entity in known) { return known[entity]; }
  const match = /^&#(x[0-9a-f]+|[0-9]+);$/i.exec(entity);
  if (match) {
    const code = match[1][0].toLowerCase() === 'x' ? parseInt(match[1].slice(1), 16) : Number(match[1]);
    if (code > 0 && code <= 0x10ffff) { return String.fromCodePoint(code); }
  }
  return entity;
}
