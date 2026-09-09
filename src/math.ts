import { parser, GFM } from '@lezer/markdown';
import type { Position } from './markdown';

/** Locate exactly the math extracted by Jupyter, excluding literal code. */
export function locateMath(source: string, extracted: string[]): Position[] | null {
  const code: Position[] = [];
  parser.configure(GFM).parse(source).iterate({ enter(node) {
    if (['InlineCode', 'FencedCode', 'CodeBlock'].includes(node.name)) {
      code.push({ start: node.from, end: node.to }); return false;
    }
  } });
  const positions: Position[] = [];
  let cursor = 0;
  for (const escaped of extracted) {
    if (/^@@\d+@@$/.test(escaped)) { continue; }
    const raw = escaped.replace(/&(amp|lt|gt);/g, (_, name: string) => ({ amp: '&', lt: '<', gt: '>' })[name]!);
    let start = source.indexOf(raw, cursor);
    while (start >= 0 && code.some(range => start < range.end && start + raw.length > range.start)) {
      start = source.indexOf(raw, start + 1);
    }
    if (start < 0) { return null; }
    positions.push({ start, end: start + raw.length }); cursor = start + raw.length;
  }
  return positions;
}
