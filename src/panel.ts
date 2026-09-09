import type { ICellModel } from '@jupyterlab/cells';
import { Dialog, showDialog } from '@jupyterlab/apputils';
import { closeIcon } from '@jupyterlab/ui-components';
import type { NotebookPanel } from '@jupyterlab/notebook';
import { Widget } from '@lumino/widgets';
import {
  addComment, deleteComment, editComment, MAX_BODY_LENGTH, readData,
  resolveComment, type CellComment
} from './model';
import { cells, label, port, writable } from './notebook';
import { isTextAnchor, trackAnchor, type TextDelta } from './anchors';
import { prepareAnchor, revealComment } from './selection';
import { selectHighlight } from './highlights';

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K, className: string, text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) { node.textContent = text; }
  return node;
}

function button(text: string, action: () => void, className = ''): HTMLButtonElement {
  const node = element('button', `ncc-button ${className}`, text);
  node.type = 'button';
  node.addEventListener('click', action);
  return node;
}

interface Draft {
  cell: ICellModel;
  id?: string;
  originalBody: string;
  body: string;
  anchor: CellComment['anchor'];
}

/** The panel renders text as textContent, never as HTML or Markdown. */
export class CommentsPanel extends Widget {
  private notebook: NotebookPanel | null = null;
  private drafts = new Map<NotebookPanel, Draft>();
  private filter = 'open';
  private subtitle = element('p', 'ncc-subtitle');
  private count = element('span', 'ncc-total', '0');
  private addButton = button('+ Add Cell Comment', () => {
    const cell = this.notebook?.content.activeCell?.model;
    if (cell) { void this.start(cell); }
  }, 'ncc-primary');
  private notice = element('p', 'ncc-notice');
  private editor = element('div', 'ncc-composer');
  private list = element('div', 'ncc-list');
  private feedback = element('p', 'ncc-feedback');
  private filterButtons: HTMLButtonElement[] = [];
  private selected: { cell: ICellModel; id: string } | null = null;

  constructor(onClose: () => void) {
    super();
    this.id = 'jupyter-notebook-comments-panel';
    this.addClass('ncc-panel');
    this.title.caption = '셀 메모';
    this.title.label = '메모';
    this.node.setAttribute('aria-label', '셀 메모 패널');
    const header = element('header', 'ncc-header');
    const heading = element('div', 'ncc-heading');
    const closeButton = button('', onClose, 'ncc-close');
    closeButton.title = '셀 메모 닫기';
    closeButton.setAttribute('aria-label', '셀 메모 닫기');
    closeIcon.element({ container: closeButton, width: '20px', height: '20px' });
    heading.append(element('h2', '', '셀 메모'), this.count, closeButton);
    header.append(heading, this.subtitle, this.addButton);
    const filters = element('div', 'ncc-filters');
    filters.setAttribute('aria-label', '메모 필터');
    for (const [value, text] of [['open', '미해결'], ['resolved', '해결됨'], ['all', '전체']]) {
      const tab = button(text, () => { this.filter = value; this.refresh(); });
      tab.dataset.filter = value;
      this.filterButtons.push(tab);
      filters.append(tab);
    }
    this.feedback.setAttribute('role', 'status');
    this.feedback.setAttribute('aria-live', 'polite');
    const footer = element('footer', 'ncc-footer', '메모 등록 후 노트북을 저장해 주세요.');
    this.node.append(header, this.notice, filters, this.editor, this.feedback, this.list, footer);
    this.refresh();
  }

  setNotebook(panel: NotebookPanel | null): void {
    if (this.notebook === panel) { this.refresh(); return; }
    this.notebook = panel;
    this.feedback.textContent = '';
    this.renderEditor();
    this.refresh();
  }

  forgetNotebook(panel: NotebookPanel): void {
    this.drafts.delete(panel);
    if (this.notebook === panel) { this.setNotebook(null); }
  }

  get hasUnsavedDraft(): boolean {
    return [...this.drafts.values()].some(draft => draft.body !== draft.originalBody);
  }

  trackDraft(cell: ICellModel, delta: TextDelta, text: string): void {
    for (const draft of this.drafts.values()) {
      if (draft.cell === cell && isTextAnchor(draft.anchor) && draft.anchor.surface === 'source') {
        draft.anchor = trackAnchor(draft.anchor, delta, text);
      }
    }
  }

  async start(cell: ICellModel, comment?: CellComment, anchor: CellComment['anchor'] = { type: 'cell' }): Promise<void> {
    const panel = this.notebook;
    if (!panel || !writable(panel)) { return; }
    const current = this.drafts.get(panel);
    if (current && current.cell === cell && current.id === comment?.id &&
        (comment || JSON.stringify(current.anchor) === JSON.stringify(anchor))) {
      this.editor.querySelector('textarea')?.focus();
      return;
    }
    if (current && current.body !== current.originalBody) {
      const result = await showDialog({
        title: '작성 중인 메모를 버릴까요?',
        body: '아직 등록하지 않은 내용이 있습니다.',
        buttons: [Dialog.cancelButton({ label: '계속 작성' }), Dialog.warnButton({ label: '버리기' })]
      });
      if (!result.button.accept || this.notebook !== panel) { return; }
    }
    try { readData(port(panel, cell).get()); } catch (error) { this.error(error); return; }
    this.drafts.set(panel, {
      cell, id: comment?.id, originalBody: comment?.body ?? '', body: comment?.body ?? '',
      anchor: JSON.parse(JSON.stringify(comment?.anchor ?? anchor))
    });
    this.feedback.textContent = '';
    this.renderEditor();
    this.editor.querySelector('textarea')?.focus();
  }

  refresh(): void {
    const panel = this.notebook;
    this.subtitle.textContent = panel ? panel.context.path.split('/').pop() ?? '' : '노트북을 열어 주세요';
    this.addButton.disabled = !panel || !writable(panel) || !panel.content.activeCell;
    this.notice.textContent = panel && !writable(panel) ? '읽기 전용 · 메모를 볼 수만 있습니다.' : '';
    for (const tab of this.filterButtons) {
      tab.setAttribute('aria-pressed', String(tab.dataset.filter === this.filter));
    }
    this.list.replaceChildren();
    let total = 0;
    let visible = 0;
    if (panel) {
      for (const cell of cells(panel)) {
        let comments: CellComment[];
        try { comments = readData(port(panel, cell).get()).comments; }
        catch (error) {
          this.list.append(element('p', 'ncc-error', `${label(panel, cell)}: ${String((error as Error).message)}`));
          continue;
        }
        total += comments.length;
        for (const comment of comments) {
          if ((this.filter === 'open' && comment.resolved) ||
              (this.filter === 'resolved' && !comment.resolved)) { continue; }
          visible++;
          this.list.append(this.card(panel, cell, comment));
        }
      }
      const draft = this.drafts.get(panel);
      if (draft) {
        const title = this.editor.querySelector('.ncc-composer-title');
        if (title) { title.textContent = `${label(panel, draft.cell)} · ${draft.id ? '메모 수정' : '새 메모'}`; }
        const submit = this.editor.querySelector<HTMLButtonElement>('[type=submit]');
        if (submit) { submit.disabled = !writable(panel) || !cells(panel).includes(draft.cell); }
      }
    }
    this.count.textContent = String(total);
    if (visible === 0 && this.list.childElementCount === 0) {
      const empty = element('div', 'ncc-empty');
      empty.append(element('strong', '', panel ? '표시할 메모가 없어요' : '노트북을 열어 주세요'));
      empty.append(element('p', '', panel
        ? '셀을 우클릭하거나, 문장·코드를 드래그한 뒤 우클릭하세요.'
        : '코드와 마크다운 셀에 검토 메모를 남길 수 있어요.'));
      this.list.append(empty);
    }
  }

  focusCell(cell: ICellModel): void {
    this.filter = 'all';
    this.refresh();
    const card = Array.from(this.list.querySelectorAll<HTMLElement>('.ncc-card'))
      .find(node => node.dataset.cellId === cell.id);
    card?.scrollIntoView({ block: 'nearest' });
    card?.focus();
  }

  focusComment(cell: ICellModel, id: string): void {
    this.selected = { cell, id };
    this.filter = 'all';
    if (this.notebook) { selectHighlight(this.notebook, cell, id); }
    this.refresh();
    Array.from(this.list.querySelectorAll<HTMLElement>('.ncc-card'))
      .find(node => node.dataset.cellId === cell.id && node.dataset.commentId === id)
      ?.scrollIntoView({ block: 'nearest' });
  }

  private card(panel: NotebookPanel, cell: ICellModel, comment: CellComment): HTMLElement {
    const card = element('article', `ncc-card${comment.resolved ? ' ncc-resolved' : ''}`);
    card.tabIndex = -1;
    card.dataset.commentId = comment.id;
    card.dataset.cellId = cell.id;
    card.classList.toggle('ncc-current', panel.content.activeCell?.model === cell);
    card.classList.toggle('ncc-selected', this.selected?.cell === cell && this.selected.id === comment.id);
    const navigate = (): void => {
      this.focusComment(cell, comment.id);
      void revealComment(panel, cell, comment.anchor).then(found => {
        if (!found) { this.error(new Error('원문이 삭제되었거나 위치를 확인할 수 없습니다. 메모는 보관되어 있습니다.')); }
      }).catch(error => this.error(error));
    };
    const textAnchor = isTextAnchor(comment.anchor) ? comment.anchor : null;
    const jump = button(label(panel, cell), navigate, 'ncc-location');
    jump.title = textAnchor ? '선택 영역으로 이동' : '이 셀로 이동';
    const top = element('div', 'ncc-card-top');
    top.append(jump);
    if (comment.resolved) { top.append(element('span', 'ncc-status', '해결됨')); }
    const preview = element('p', 'ncc-source', cell.sharedModel.getSource().replace(/\s+/g, ' ').slice(0, 100) || '(빈 셀)');
    const body = element('p', 'ncc-body', comment.body);
    // Clicking the comment body also locates its cell; keyboard users use jump.
    body.addEventListener('click', navigate);
    const time = element('time', 'ncc-time');
    time.dateTime = comment.updatedAt;
    const date = new Date(comment.updatedAt);
    time.textContent = Number.isNaN(date.getTime()) ? comment.updatedAt : date.toLocaleString('ko-KR', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    time.title = `작성: ${comment.createdAt}\n수정: ${comment.updatedAt}`;
    const actions = element('div', 'ncc-actions');
    const edit = button('수정', () => { void this.start(cell, comment); });
    const resolve = button(comment.resolved ? '다시 열기' : '해결', () => {
      try { resolveComment(port(panel, cell), comment.id, !comment.resolved); }
      catch (error) { this.error(error); }
    });
    const remove = button('삭제', () => { void this.remove(panel, cell, comment); }, 'ncc-danger');
    for (const action of [edit, resolve, remove]) { action.disabled = !writable(panel); }
    actions.append(edit, resolve, remove);
    card.append(top, preview);
    if (textAnchor) {
      const quote = button(textAnchor.quote, navigate, 'ncc-quote');
      quote.setAttribute('aria-label', '선택 영역으로 이동');
      quote.title = textAnchor.quote;
      card.append(element('span', 'ncc-anchor-kind', '선택 영역'), quote);
      if (textAnchor.status !== 'attached') {
        card.append(element('p', 'ncc-anchor-warning', textAnchor.status === 'changed'
          ? '원문 변경됨 · 현재 위치로 이동할 수 있어요.'
          : '위치 확인 필요 · 원문이 삭제되거나 변경되었어요.'));
      }
    } else { card.append(element('span', 'ncc-anchor-kind', '셀 전체')); }
    card.append(body, time, actions);
    return card;
  }

  private renderEditor(): void {
    this.editor.replaceChildren();
    const panel = this.notebook;
    const draft = panel ? this.drafts.get(panel) : undefined;
    this.editor.hidden = !draft;
    if (!panel || !draft) { return; }
    const form = element('form', 'ncc-form');
    const title = element('label', 'ncc-composer-title', `${label(panel, draft.cell)} · ${draft.id ? '메모 수정' : '새 메모'}`);
    const textarea = element('textarea', 'ncc-input');
    textarea.id = 'ncc-comment-input';
    title.htmlFor = textarea.id;
    textarea.value = draft.body;
    textarea.rows = 4;
    textarea.maxLength = MAX_BODY_LENGTH;
    textarea.placeholder = '검토할 내용이나 질문을 적어 주세요.';
    textarea.setAttribute('aria-label', '메모 내용');
    textarea.addEventListener('input', () => { draft.body = textarea.value; });
    textarea.addEventListener('keydown', event => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !event.isComposing) {
        event.preventDefault(); form.requestSubmit();
      }
    });
    const actions = element('div', 'ncc-actions');
    const cancel = button('취소', () => {
      this.drafts.delete(panel); this.renderEditor(); this.feedback.textContent = '';
    });
    const submit = button(draft.id ? '수정 완료' : '등록', () => {}, 'ncc-primary');
    submit.type = 'submit';
    submit.disabled = !writable(panel) || !cells(panel).includes(draft.cell);
    actions.append(cancel, submit);
    form.append(title);
    if (isTextAnchor(draft.anchor)) {
      form.append(element('blockquote', 'ncc-anchor-preview', draft.anchor.quote));
    } else { form.append(element('p', 'ncc-hint', '이 셀 전체에 메모를 남깁니다.')); }
    form.append(textarea, element('p', 'ncc-hint', 'Ctrl / ⌘ + Enter로 등록'), actions);
    form.addEventListener('submit', event => {
      event.preventDefault();
      try {
        const metadata = port(panel, draft.cell);
        if (draft.id) {
          const current = readData(metadata.get()).comments.find(item => item.id === draft.id);
          if (!current || current.body !== draft.originalBody) {
            throw new Error('작성 중 원본 메모가 변경되거나 삭제되었습니다. 내용을 복사한 뒤 다시 열어 주세요.');
          }
          editComment(metadata, draft.id, draft.body);
        } else { addComment(metadata, draft.body, prepareAnchor(panel, draft.cell, draft.anchor)); }
        this.drafts.delete(panel);
        this.renderEditor();
        this.refresh();
        this.feedback.textContent = '메모가 반영되었습니다. 노트북을 저장해 주세요.';
      } catch (error) { this.error(error); }
    });
    this.editor.append(form);
  }

  private async remove(panel: NotebookPanel, cell: ICellModel, comment: CellComment): Promise<void> {
    const result = await showDialog({
      title: '메모를 삭제할까요?', body: comment.body.slice(0, 160),
      buttons: [Dialog.cancelButton({ label: '취소' }), Dialog.warnButton({ label: '삭제' })]
    });
    if (!result.button.accept) { return; }
    try {
      deleteComment(port(panel, cell), comment.id);
      const draft = this.drafts.get(panel);
      if (draft?.cell === cell && draft.id === comment.id) {
        this.drafts.delete(panel); this.renderEditor();
      }
    } catch (error) { this.error(error); }
  }

  private error(error: unknown): void {
    this.feedback.textContent = error instanceof Error ? error.message : String(error);
  }
}
