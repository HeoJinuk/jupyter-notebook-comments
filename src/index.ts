import { JupyterFrontEnd, JupyterFrontEndPlugin } from '@jupyterlab/application';
import { ICommandPalette, ToolbarButton } from '@jupyterlab/apputils';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { LabIcon } from '@jupyterlab/ui-components';
import { CommentsPanel } from './panel';
import { readData } from './model';
import { port, writable } from './notebook';
import { captureSelection, watchAnchors } from './selection';
import { trackAnchor, type TextAnchor } from './anchors';
import type { ICellModel } from '@jupyterlab/cells';
import { Highlights } from './highlights';

const commentIcon = new LabIcon({
  name: 'notebook-cell-comments:comment',
  svgstr: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path class="jp-icon3" fill="#616161" d="M5 3h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H9l-6 4V5a2 2 0 0 1 2-2zm0 2v13.3L8.4 16H19V5H5zm3 3h8v2H8V8zm0 4h6v2H8v-2z"/></svg>'
});

const plugin: JupyterFrontEndPlugin<void> = {
  id: 'notebook-cell-comments:plugin',
  description: '셀에 검토 메모를 달고 노트북 안에 저장합니다.',
  autoStart: true,
  requires: [INotebookTracker],
  optional: [ICommandPalette],
  activate: (app: JupyterFrontEnd, tracker: INotebookTracker, palette: ICommandPalette | null) => {
    const close = (): void => {
      if (!view.isVisible) { return; }
      const shell = app.shell as typeof app.shell & { collapseRight?: () => void };
      if (shell.collapseRight) { shell.collapseRight(); }
      else { view.hide(); }
      tracker.currentWidget?.content.activate();
    };
    const view = new CommentsPanel(close);
    let selected: { cell: ICellModel; anchor: TextAnchor } | null = null;
    // Capture the range before menu focus can collapse the browser selection.
    document.addEventListener('contextmenu', event => {
      const panel = tracker.currentWidget;
      const target = event.target instanceof Element ? event.target.closest('.jp-Cell') : null;
      const widget = panel?.content.widgets.find(widget => widget.node === target);
      const anchor = widget ? captureSelection(widget, event.target instanceof Element ? event.target : undefined) : null;
      selected = widget && anchor ? { cell: widget.model, anchor } : null;
      app.commands.notifyCommandChanged('notebook-cell-comments:add-selection');
    }, true);
    view.title.icon = commentIcon;
    // The shared shell API works in Notebook 7 without requiring ILabShell.
    app.shell.add(view, 'right', { rank: 600 });
    const show = (panel: NotebookPanel): void => {
      view.setNotebook(panel);
      // Notebook 7 toggles an already-open sidebar in activateById.
      // An add/edit command must keep the composer visible.
      if (!view.isVisible) { app.shell.activateById(view.id); }
    };
    app.commands.addCommand('notebook-cell-comments:open', {
      label: '셀 메모 패널 열기', icon: commentIcon,
      execute: () => { const panel = tracker.currentWidget; if (panel) { show(panel); } }
    });
    app.commands.addCommand('notebook-cell-comments:add', {
      label: 'Add Cell Comment', icon: commentIcon,
      isEnabled: () => !!tracker.currentWidget && writable(tracker.currentWidget),
      execute: args => {
        const panel = tracker.currentWidget;
        if (!panel) { return; }
        let cell = panel.content.activeCell?.model;
        if (args.context) {
          const target = app.contextMenuHitTest(node => node.classList.contains('jp-Cell'));
          // The right-clicked cell may differ from the previously active one.
          cell = panel.content.widgets.find(widget => widget.node === target)?.model;
          if (!cell) { return; }
        }
        if (cell) { show(panel); return view.start(cell); }
      }
    });
    app.commands.addCommand('notebook-cell-comments:add-selection', {
      label: 'Add Comment to Selection', icon: commentIcon,
      isEnabled: () => !!selected && !!tracker.currentWidget && writable(tracker.currentWidget),
      execute: () => {
        const panel = tracker.currentWidget;
        if (!panel || !selected) { return; }
        const { cell, anchor } = selected;
        if (!panel.content.widgets.some(widget => widget.model === cell)) { return; }
        show(panel);
        return view.start(cell, undefined, anchor);
      }
    });
    app.contextMenu.addItem({
      command: 'notebook-cell-comments:add', selector: '.jp-Notebook .jp-Cell',
      args: { context: true }, rank: 20
    });
    app.contextMenu.addItem({
      command: 'notebook-cell-comments:add-selection', selector: '.jp-Notebook .jp-Cell', rank: 21
    });
    palette?.addItem({ command: 'notebook-cell-comments:open', category: '셀 메모' });
    palette?.addItem({ command: 'notebook-cell-comments:add', category: '셀 메모' });

    const installed = new WeakSet<NotebookPanel>();
    const attach = async (panel: NotebookPanel): Promise<void> => {
      if (installed.has(panel)) { return; }
      installed.add(panel);
      await panel.context.ready;
      if (panel.isDisposed) { return; }
      const model = panel.content.model;
      const highlights = new Highlights(panel, (cell, id) => {
        show(panel); view.focusComment(cell, id);
      });
      const unwatch = watchAnchors(panel, (cell, delta, text) => {
        view.trackDraft(cell, delta, text);
        if (selected?.cell === cell && selected.anchor.surface === 'source') {
          selected.anchor = trackAnchor(selected.anchor, delta, text);
        }
      });
      const toolbar = new ToolbarButton({
        icon: commentIcon, tooltip: 'Toggle Comments',
        onClick: () => { if (view.isVisible) { close(); } else { show(panel); } }
      });
      panel.toolbar.addItem('cell-comments', toolbar);

      const refresh = (): void => {
        if (panel.isDisposed) { return; }
        for (const widget of panel.content.widgets) {
          let badge = widget.node.querySelector<HTMLButtonElement>(':scope > .ncc-cell-badge');
          let total = 0;
          let open = 0;
          try {
            const comments = readData(port(panel, widget.model).get()).comments;
            total = comments.length;
            open = comments.filter(comment => !comment.resolved).length;
          } catch { /* The panel shows the error; do not modify malformed data. */ }
          widget.node.classList.toggle('ncc-has-comments', total > 0);
          if (!total) { badge?.remove(); continue; }
          if (!badge) {
            badge = document.createElement('button');
            badge.type = 'button';
            badge.className = 'ncc-cell-badge';
            badge.addEventListener('mousedown', event => event.stopPropagation());
            badge.addEventListener('click', event => {
              event.preventDefault(); event.stopPropagation();
              show(panel); view.focusCell(widget.model);
            });
            widget.node.append(badge);
          }
          badge.textContent = `▤ ${total}`;
          badge.title = `메모 ${total}개 · 미해결 ${open}개`;
          badge.setAttribute('aria-label', badge.title);
          badge.classList.toggle('ncc-all-resolved', open === 0);
        }
        if (tracker.currentWidget === panel) { view.setNotebook(panel); }
        app.commands.notifyCommandChanged('notebook-cell-comments:add');
      };
      model?.contentChanged.connect(refresh);
      model?.stateChanged.connect(refresh);
      panel.content.activeCellChanged.connect(refresh);
      panel.content.cellInViewportChanged.connect(refresh);
      panel.context.pathChanged.connect(refresh);
      panel.context.fileChanged.connect(refresh);
      panel.disposed.connect(() => {
        unwatch();
        highlights.dispose();
        model?.contentChanged.disconnect(refresh);
        model?.stateChanged.disconnect(refresh);
        panel.content.activeCellChanged.disconnect(refresh);
        panel.content.cellInViewportChanged.disconnect(refresh);
        panel.context.pathChanged.disconnect(refresh);
        panel.context.fileChanged.disconnect(refresh);
        view.forgetNotebook(panel);
      });
      refresh();
    };
    tracker.widgetAdded.connect((_sender, panel) => { void attach(panel); });
    tracker.currentChanged.connect((_sender, panel) => { view.setNotebook(panel); });
    tracker.forEach(panel => { void attach(panel); });
    window.addEventListener('beforeunload', event => {
      if (view.hasUnsavedDraft) { event.preventDefault(); event.returnValue = ''; }
    });
  }
};

export default plugin;
