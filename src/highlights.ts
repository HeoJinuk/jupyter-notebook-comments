import { StateEffect, StateField, type Extension } from '@codemirror/state';
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view';
import type { Cell, ICellModel } from '@jupyterlab/cells';
import type { NotebookPanel } from '@jupyterlab/notebook';
import { isTextAnchor, reconcileAnchor } from './anchors';
import { readData, type CellComment } from './model';
import { port } from './notebook';
import { projectMarkdown, mathPaintNode } from './markdown-dom';
import { domRange, renderedRoot } from './selection';

interface Mark { id: string; start: number; end: number; active: boolean; }
interface Target extends Mark { cell: ICellModel; widget: Cell; range?: Range; math?: HTMLElement; }
interface CMEditor { editor: EditorView; injectExtension(extension: Extension): void; isDisposed: boolean; focus(): void; }
const replaceMarks = StateEffect.define<Mark[]>();
const marks = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, transaction) {
    value = value.map(transaction.changes);
    for (const effect of transaction.effects) {
      if (effect.is(replaceMarks)) {
        value = Decoration.set(effect.value.map(mark => Decoration.mark({
          class: `ncc-text-highlight${mark.active ? ' ncc-text-highlight-active' : ''}`,
          attributes: { 'data-ncc-comment': mark.id, title: '클릭하여 메모 보기' }
        }).range(mark.start, mark.end)), true);
      }
    }
    return value;
  },
  provide: field => EditorView.decorations.from(field)
});

interface HighlightLike { priority: number; }
const api = globalThis as typeof globalThis & {
  Highlight?: new (...ranges: Range[]) => HighlightLike;
  CSS: typeof CSS & { highlights?: Map<string, HighlightLike> };
};
const controllers = new WeakMap<NotebookPanel, Highlights>();
const rendered = new Map<Highlights, Target[]>();
function publishRendered(): void {
  if (!api.Highlight || !api.CSS.highlights) { return; }
  const targets = [...rendered.values()].flat().filter(target => target.range?.startContainer.isConnected);
  for (const [name, active] of [['ncc-comment', false], ['ncc-comment-active', true]] as const) {
    const ranges = targets.filter(target => active ? target.active : true).map(target => target.range!);
    if (!ranges.length) { api.CSS.highlights.delete(name); continue; }
    const highlight = new api.Highlight(...ranges);
    highlight.priority = active ? 2 : 1;
    api.CSS.highlights.set(name, highlight);
  }
}

export function selectHighlight(panel: NotebookPanel, cell: ICellModel, id: string): void {
  controllers.get(panel)?.select(cell, id);
}

/** Decorations never change notebook text or insert markup into rendered Markdown. */
export class Highlights {
  private editors = new Map<CMEditor, string>();
  private targets: Target[] = [];
  private mathNodes = new Set<HTMLElement>();
  private active: { cell: ICellModel; id: string } | null = null;
  private frame = 0;
  private disposed = false;
  private press: { x: number; y: number; moved: boolean } | null = null;
  private observer: MutationObserver;

  constructor(private panel: NotebookPanel, private open: (cell: ICellModel, id: string) => void) {
    controllers.set(panel, this);
    this.observer = new MutationObserver(this.schedule);
    this.observer.observe(panel.content.node, { childList: true, subtree: true, characterData: true });
    panel.content.model?.contentChanged.connect(this.schedule);
    panel.content.cellInViewportChanged.connect(this.schedule);
    panel.content.node.addEventListener('pointerdown', this.down, true);
    panel.content.node.addEventListener('pointermove', this.move, true);
    panel.content.node.addEventListener('click', this.click);
    this.schedule();
  }

  select(cell: ICellModel, id: string): void { this.active = { cell, id }; this.schedule(); }

  private schedule = (): void => {
    if (!this.disposed && !this.frame) {
      this.frame = requestAnimationFrame(() => { this.frame = 0; this.paint(); });
    }
  };

  private paint(): void {
    const current = new Set<CMEditor>();
    const targets: Target[] = [];
    for (const widget of this.panel.content.widgets) {
      if (widget.isDisposed || widget.isPlaceholder()) { continue; }
      const root = renderedRoot(widget);
      const editor = widget.editor as unknown as CMEditor | null;
      const source = widget.model.sharedModel.getSource();
      let comments: CellComment[];
      try { comments = readData(port(this.panel, widget.model).get()).comments; }
      catch { comments = []; }
      const sourceMarks: Mark[] = [];
      for (const comment of comments) {
        if (comment.resolved || !isTextAnchor(comment.anchor) || comment.anchor.status === 'detached') { continue; }
        if (comment.anchor.surface === 'rendered' && !root) { continue; }
        const anchor = reconcileAnchor(comment.anchor, comment.anchor.surface === 'source' ? source : root!.textContent ?? '');
        if (anchor.status === 'detached' || anchor.end <= anchor.start) { continue; }
        const mark: Target = { id: comment.id, start: anchor.start, end: anchor.end,
          active: this.active?.cell === widget.model && this.active.id === comment.id,
          cell: widget.model, widget };
        if (anchor.surface === 'source') {
          sourceMarks.push(mark);
          if (!root) { targets.push(mark); }
          else {
            const projected = projectMarkdown(widget, anchor.start, anchor.end);
            for (const range of projected?.ranges ?? []) { targets.push({ ...mark, range }); }
            for (const math of projected?.math ?? []) { targets.push({ ...mark, math: mathPaintNode(math) }); }
          }
        } else {
          const range = domRange(root!, anchor.start, anchor.end);
          if (range) { targets.push({ ...mark, range }); }
        }
      }
      if (editor && !editor.isDisposed && editor.injectExtension && editor.editor) {
        current.add(editor);
        if (!this.editors.has(editor)) {
          editor.injectExtension(marks);
          this.editors.set(editor, '');
        }
        const signature = JSON.stringify(sourceMarks.map(({ id, start, end, active }) => ({ id, start, end, active })));
        // A shared-model event can precede the editor transaction. Paint after it catches up.
        if (editor.editor.state.doc.toString() !== source) { this.schedule(); continue; }
        if (this.editors.get(editor) !== signature) {
          editor.editor.dispatch({ effects: replaceMarks.of(sourceMarks) });
          this.editors.set(editor, signature);
        }
      }
    }
    for (const editor of this.editors.keys()) {
      if (!current.has(editor)) {
        if (!editor.isDisposed) { editor.editor.dispatch({ effects: replaceMarks.of([]) }); }
        this.editors.delete(editor);
      }
    }
    const mathNodes = new Set(targets.flatMap(target => target.math ? [target.math] : []));
    for (const node of this.mathNodes) {
      if (!mathNodes.has(node)) { node.classList.remove('ncc-math-highlight', 'ncc-math-highlight-active'); }
    }
    for (const node of mathNodes) {
      node.classList.add('ncc-math-highlight');
      node.classList.toggle('ncc-math-highlight-active', targets.some(target => target.math === node && target.active));
    }
    this.mathNodes = mathNodes;
    this.targets = targets;
    rendered.set(this, targets.filter(target => target.range));
    publishRendered();
  }

  private down = (event: PointerEvent): void => {
    this.press = event.button === 0 ? { x: event.clientX, y: event.clientY, moved: false } : null;
  };
  private move = (event: PointerEvent): void => {
    if (this.press && Math.hypot(event.clientX - this.press.x, event.clientY - this.press.y) > 4) { this.press.moved = true; }
  };
  private click = (event: MouseEvent): void => {
    const press = this.press;
    this.press = null;
    if (!press || press.moved || event.button !== 0 || event.detail > 1 || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) { return; }
    const node = event.target instanceof Element ? event.target : null;
    if (!node || node.closest('a, button, input, textarea, select')) { return; }
    const widget = this.panel.content.widgets.find(widget => widget.node.contains(node));
    if (!widget) { return; }
    const root = renderedRoot(widget);
    const editor = widget.editor as unknown as CMEditor | null;
    if (root ? !window.getSelection()?.isCollapsed : widget.editor?.getSelections().some(range =>
      range.start.line !== range.end.line || range.start.column !== range.end.column)) { return; }
    let matches = this.targets.filter(target => target.widget === widget);
    if (root) {
      matches = matches.filter(target => (target.range || target.math) && Array.from((target.range ?? target.math)!.getClientRects()).some(rect =>
        event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom));
    } else {
      if (!node.closest('.ncc-text-highlight') || !editor) { return; }
      const offset = editor.editor.posAtCoords({ x: event.clientX, y: event.clientY });
      matches = matches.filter(target => !target.range && offset !== null && offset >= target.start && offset <= target.end);
    }
    matches = [...new Map(matches.map(target => [target.id, target])).values()];
    matches.sort((a, b) => (a.end - a.start) - (b.end - b.start) || a.id.localeCompare(b.id));
    if (!matches.length) { return; }
    // Repeated clicks cycle through overlapping comments.
    const previous = matches.findIndex(target => target.cell === this.active?.cell && target.id === this.active.id);
    const target = matches[(previous + 1) % matches.length];
    this.select(target.cell, target.id);
    this.open(target.cell, target.id);
    if (!root) { editor?.focus(); } // Preserve the caret established by the normal editor click.
  };

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.panel.content.model?.contentChanged.disconnect(this.schedule);
    this.panel.content.cellInViewportChanged.disconnect(this.schedule);
    this.panel.content.node.removeEventListener('pointerdown', this.down, true);
    this.panel.content.node.removeEventListener('pointermove', this.move, true);
    this.panel.content.node.removeEventListener('click', this.click);
    for (const editor of this.editors.keys()) {
      if (!editor.isDisposed) { editor.editor.dispatch({ effects: replaceMarks.of([]) }); }
    }
    for (const node of this.mathNodes) { node.classList.remove('ncc-math-highlight', 'ncc-math-highlight-active'); }
    this.mathNodes.clear();
    this.editors.clear();
    controllers.delete(this.panel);
    rendered.delete(this);
    publishRendered();
  }
}
