import type { Cell, MarkdownCell } from '@jupyterlab/cells';
import { removeMath } from '@jupyterlab/rendermime';
import { createMarkdownMap, type MarkdownMap, type Position } from './markdown';
import { locateMath } from './math';

interface Piece extends Position { node?: Text; math?: HTMLElement; source?: Position; }
interface Projection { mapping: MarkdownMap; pieces: Piece[]; }
const cache = new WeakMap<Cell, { source: string; text: string; mapping: MarkdownMap | null }>();
const mathSelector = 'mjx-container';
function projection(widget: Cell): Projection | null {
  if (widget.model.type !== 'markdown') { return null; }
  const root = (widget as MarkdownCell).renderer.node;
  const source = widget.model.sharedModel.getSource();
  const formulas = locateMath(source, removeMath(source).math);
  if (!formulas) { return null; }
  const elements = root.querySelectorAll<HTMLElement>(mathSelector);
  if (formulas.length !== elements.length) { return null; } // Wait for typesetting to finish.
  const pieces: Piece[] = [];
  let text = '';
  let index = 0;
  const visit = (node: Node): void => {
    if (node instanceof HTMLElement && node.matches('a.anchor-link, a.jp-InternalAnchorLink')) { return; }
    if (node instanceof HTMLElement && node.matches(mathSelector)) {
      pieces.push({ start: text.length, end: text.length + 1, math: node, source: formulas[index++] });
      text += '\uFFFC'; return;
    }
    if (node instanceof Text) {
      pieces.push({ start: text.length, end: text.length + node.length, node });
      text += node.data; return;
    }
    node.childNodes.forEach(visit);
  };
  visit(root);
  let mapping: MarkdownMap | null;
  const old = cache.get(widget);
  if (old?.source === source && old.text === text) { mapping = old.mapping; }
  else {
    const decoder = document.createElement('textarea');
    mapping = createMarkdownMap(source, text, entity => { decoder.innerHTML = entity; return decoder.value; }, formulas);
    cache.set(widget, { source, text, mapping });
  }
  return mapping ? { mapping, pieces } : null;
}

/** A partial TeX selection highlights its whole typeset formula. */
export function projectMarkdown(widget: Cell, start: number, end: number): { ranges: Range[]; math: HTMLElement[] } | null {
  const value = projection(widget);
  const mapped = value?.mapping.fromSource(start, end);
  if (!value || !mapped) { return null; }
  const ranges: Range[] = [];
  const math: HTMLElement[] = [];
  let current: Range | null = null;
  for (const piece of value.pieces) {
    if (piece.start >= mapped.end || piece.end <= mapped.start) { continue; }
    if (piece.math) { math.push(piece.math); current = null; }
    else if (piece.node && piece.end > piece.start) {
      const range = document.createRange();
      range.setStart(piece.node, Math.max(0, mapped.start - piece.start));
      range.setEnd(piece.node, Math.min(piece.node.length, mapped.end - piece.start));
      if (current) { current.setEnd(range.endContainer, range.endOffset); }
      else { ranges.push(range); current = range; }
    }
  }
  return { ranges, math };
}

export function sourceMathAt(widget: Cell, target: Element): Position | null {
  const element = target.closest(mathSelector);
  if (!element) { return null; }
  return projection(widget)?.pieces.find(piece => piece.math === element)?.source ?? null;
}

export function mathPaintNode(element: HTMLElement): HTMLElement {
  return element.querySelector<HTMLElement>('mjx-math, svg') ?? element;
}
