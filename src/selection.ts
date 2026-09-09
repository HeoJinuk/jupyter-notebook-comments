import type { Cell, ICellModel, MarkdownCell } from '@jupyterlab/cells';
import type { NotebookPanel } from '@jupyterlab/notebook';
import { isTextAnchor, makeAnchor, reconcileAnchor, trackAnchor, type TextAnchor, type TextDelta } from './anchors';
import { readData, type CellComment } from './model';
import { projectMarkdown, sourceMathAt, mathPaintNode } from './markdown-dom';
import { cells, port, reveal, writable } from './notebook';

export function renderedRoot(widget: Cell): HTMLElement | null {
  return widget.model.type === 'markdown' && (widget as MarkdownCell).rendered
    ? (widget as MarkdownCell).renderer.node : null;
}

/** Snapshot before the context menu or sidebar takes focus. */
export function captureSelection(widget: Cell, target?: Element): TextAnchor | null {
  const root = renderedRoot(widget);
  if (root) {
    const formula = target && sourceMathAt(widget, target);
    if (formula) { return makeAnchor('source', widget.model.sharedModel.getSource(), formula.start, formula.end); }
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount !== 1) { return null; }
    const range = selection.getRangeAt(0);
    if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) { return null; }
    const before = document.createRange();
    before.selectNodeContents(root);
    before.setEnd(range.startContainer, range.startOffset);
    const start = before.toString().length;
    const end = start + range.toString().length;
    try { return makeAnchor('rendered', root.textContent ?? '', start, end); }
    catch { return null; }
  }
  const editor = widget.editor;
  if (!editor) { return null; }
  // Discontinuous multicursor selections are deliberately not combined.
  const selections = editor.getSelections().filter(range =>
    editor.getOffsetAt(range.start) !== editor.getOffsetAt(range.end));
  if (selections.length !== 1) { return null; }
  const selection = selections[0];
  const a = editor.getOffsetAt(selection.start);
  const b = editor.getOffsetAt(selection.end);
  try { return makeAnchor('source', widget.model.sharedModel.getSource(), Math.min(a, b), Math.max(a, b)); }
  catch { return null; }
}

export function prepareAnchor(panel: NotebookPanel, cell: ICellModel, anchor: CellComment['anchor']): CellComment['anchor'] {
  if (!isTextAnchor(anchor)) { return anchor; }
  let text: string;
  if (anchor.surface === 'source') { text = cell.sharedModel.getSource(); }
  else {
    const widget = panel.content.widgets.find(widget => widget.model === cell);
    const root = widget && renderedRoot(widget);
    if (!root) { throw new Error('마크다운을 다시 실행한 후 선택 영역을 확인해 주세요.'); }
    text = root.textContent ?? '';
  }
  const updated = reconcileAnchor(anchor, text);
  if (updated.status === 'detached') {
    throw new Error('선택한 원문이 삭제되었거나 위치가 불분명합니다. 내용을 복사하고 원문을 다시 선택해 주세요.');
  }
  return updated;
}

/** Source change listeners keep stored offsets in step with actual edits.
 * Rendered Markdown uses quote/context matching after rendering completes. */
export function watchAnchors(panel: NotebookPanel, onSource: (cell: ICellModel, delta: TextDelta, text: string) => void): () => void {
  const models = new Map<ICellModel, () => void>();
  const renderers = new Map<Cell, () => void>();
  let nativeSelection: { root: HTMLElement; anchor: Node; anchorOffset: number; focus: Node; focusOffset: number } | null = null;
  const rememberSelection = (): void => {
    const selection = window.getSelection();
    const anchor = selection?.anchorNode;
    const focus = selection?.focusNode;
    const root = anchor && focus && panel.content.widgets.map(renderedRoot).find(root => root?.contains(anchor) && root.contains(focus));
    nativeSelection = selection && !selection.isCollapsed && root && anchor && focus
      ? { root, anchor, anchorOffset: selection.anchorOffset, focus, focusOffset: selection.focusOffset } : null;
  };
  document.addEventListener('selectionchange', rememberSelection);
  const update = (cell: ICellModel, transform: (anchor: TextAnchor) => TextAnchor): void => {
    if (!writable(panel) || !cells(panel).includes(cell)) { return; }
    try {
      const metadata = port(panel, cell);
      const data = readData(metadata.get());
      let changed = false;
      const comments = data.comments.map(comment => {
        if (!isTextAnchor(comment.anchor)) { return comment; }
        const anchor = transform(comment.anchor);
        if (JSON.stringify(anchor) === JSON.stringify(comment.anchor)) { return comment; }
        changed = true;
        return { ...comment, anchor };
      });
      if (changed) { metadata.set({ ...data, comments }); }
    } catch { /* Malformed/unknown data are reported by the comments panel. */ }
  };
  const connect = (): void => {
    const current = new Set(cells(panel));
    for (const [cell, dispose] of models) {
      if (!current.has(cell)) { dispose(); models.delete(cell); }
    }
    for (const cell of current) {
      if (models.has(cell)) { continue; }
      const sourceChanged = (_sender: unknown, change: { sourceChange?: TextDelta }): void => {
        if (!change.sourceChange) { return; }
        const text = cell.sharedModel.getSource();
        onSource(cell, change.sourceChange, text);
        update(cell, anchor => anchor.surface === 'source' ? trackAnchor(anchor, change.sourceChange!, text) : anchor);
      };
      cell.sharedModel.changed.connect(sourceChanged);
      models.set(cell, () => cell.sharedModel.changed.disconnect(sourceChanged));
      update(cell, anchor => anchor.surface === 'source' ? reconcileAnchor(anchor, cell.sharedModel.getSource()) : anchor);
    }
    for (const [widget, dispose] of renderers) {
      if (widget.isDisposed || !current.has(widget.model)) { dispose(); renderers.delete(widget); }
    }
    for (const widget of panel.content.widgets) {
      if (widget.model.type !== 'markdown' || renderers.has(widget)) { continue; }
      const markdown = widget as MarkdownCell;
      const check = (): void => {
        const root = renderedRoot(widget);
        if (!root || !root.textContent) { return; }
        update(widget.model, anchor => anchor.surface === 'rendered' ? reconcileAnchor(anchor, root.textContent!) : anchor);
      };
      const observer = new MutationObserver(records => {
        // Notebook can detach and reinsert the same renderer during a drag.
        // Live DOM Ranges then jump to the cell start. Preserve node/offset
        // pairs only for a reparent of the unchanged renderer and text nodes.
        const saved = nativeSelection;
        if (saved?.root === markdown.renderer.node && saved.anchor.isConnected && saved.focus.isConnected &&
            records.some(record => Array.from(record.removedNodes).some(node => node === saved.root))) {
          window.getSelection()?.setBaseAndExtent(saved.anchor, saved.anchorOffset, saved.focus, saved.focusOffset);
        }
        check();
      });
      observer.observe(widget.node, { childList: true, subtree: true, characterData: true });
      markdown.renderedChanged.connect(check);
      renderers.set(widget, () => {
        observer.disconnect(); markdown.renderedChanged.disconnect(check);
      });
      if (!widget.isPlaceholder()) { check(); }
    }
  };
  panel.content.model?.cells.changed.connect(connect);
  panel.content.cellInViewportChanged.connect(connect);
  connect();
  return () => {
    document.removeEventListener('selectionchange', rememberSelection);
    panel.content.model?.cells.changed.disconnect(connect);
    panel.content.cellInViewportChanged.disconnect(connect);
    models.forEach(dispose => dispose()); renderers.forEach(dispose => dispose());
  };
}

async function renderMarkdown(widget: MarkdownCell, rendered: boolean): Promise<void> {
  if (widget.rendered === rendered) { return; }
  await new Promise<void>((resolve, reject) => {
    const done = (): void => { clearTimeout(timer); widget.renderedChanged.disconnect(done); resolve(); };
    const timer = setTimeout(() => { widget.renderedChanged.disconnect(done); reject(new Error('마크다운 표시를 기다리는 중입니다. 잠시 후 다시 눌러 주세요.')); }, 5000);
    widget.renderedChanged.connect(done);
    widget.rendered = rendered;
  });
}

export function domRange(root: HTMLElement, start: number, end: number): Range | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  let offset = 0;
  let began = false;
  const range = document.createRange();
  while ((node = walker.nextNode())) {
    const length = node.textContent?.length ?? 0;
    if (!began && start <= offset + length) { range.setStart(node, start - offset); began = true; }
    if (began && end <= offset + length) { range.setEnd(node, end - offset); return range; }
    offset += length;
  }
  return null;
}

export async function revealComment(panel: NotebookPanel, cell: ICellModel, anchor: CellComment['anchor']): Promise<boolean> {
  await reveal(panel, cell);
  if (!isTextAnchor(anchor)) { return true; }
  if (anchor.status === 'detached') { return false; }
  const widget = panel.content.widgets.find(widget => widget.model === cell);
  if (!widget) { return false; }
  await widget.ready;
  const projected = anchor.surface === 'source' && renderedRoot(widget)
    ? projectMarkdown(widget, anchor.start, anchor.end) : null;
  if (projected && (projected.ranges.length || projected.math.length)) {
    const selection = window.getSelection();
    selection?.removeAllRanges();
    if (projected.ranges.length) {
      const range = document.createRange();
      range.setStart(projected.ranges[0].startContainer, projected.ranges[0].startOffset);
      const last = projected.ranges[projected.ranges.length - 1];
      range.setEnd(last.endContainer, last.endOffset);
      selection?.addRange(range);
    }
    (projected.math[0] ? mathPaintNode(projected.math[0]) : projected.ranges[0].startContainer.parentElement)
      ?.scrollIntoView({ block: 'nearest' });
    return true;
  }
  if (cell.type === 'markdown') { await renderMarkdown(widget as MarkdownCell, anchor.surface === 'rendered'); }
  let current: TextAnchor;
  try { current = prepareAnchor(panel, cell, anchor) as TextAnchor; }
  catch { return false; }
  if (current.surface === 'source') {
    const editor = widget.editor;
    if (!editor) { return false; }
    const start = editor.getPositionAt(current.start);
    const end = editor.getPositionAt(current.end);
    if (!start || !end) { return false; }
    editor.focus();
    editor.setSelection({ start, end });
    editor.revealSelection({ start, end });
  } else {
    const root = renderedRoot(widget);
    const range = root && domRange(root, current.start, current.end);
    if (!range) { return false; }
    const selection = window.getSelection();
    selection?.removeAllRanges(); selection?.addRange(range);
    const node = range.startContainer.parentElement;
    node?.scrollIntoView({ block: 'nearest' });
  }
  return true;
}
