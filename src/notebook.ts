import type { ICellModel } from '@jupyterlab/cells';
import type { NotebookPanel } from '@jupyterlab/notebook';
import { METADATA_KEY, type MetadataPort } from './model';

export function cells(panel: NotebookPanel): ICellModel[] {
  const list = panel.content.model?.cells;
  return list ? Array.from({ length: list.length }, (_, i) => list.get(i)) : [];
}

export function writable(panel: NotebookPanel): boolean {
  return !panel.isDisposed && !!panel.content.model &&
    !panel.content.model.readOnly && panel.context.contentsModel?.writable !== false;
}

export function port(panel: NotebookPanel, cell: ICellModel): MetadataPort {
  return {
    get: () => cell.getMetadata(METADATA_KEY),
    set: data => {
      if (!writable(panel)) {
        throw new Error('읽기 전용 노트북에서는 메모를 변경할 수 없습니다.');
      }
      // Use model identity rather than a cell index: moving a cell is safe.
      if (!cells(panel).includes(cell)) {
        throw new Error('메모를 작성하던 셀이 삭제되었습니다.');
      }
      // Serialization ensures that only JSON crosses the notebook boundary.
      cell.setMetadata(METADATA_KEY, JSON.parse(JSON.stringify(data)));
    }
  };
}

export function label(panel: NotebookPanel, cell: ICellModel): string {
  const index = cells(panel).indexOf(cell);
  const type = cell.type === 'code' ? '코드' : cell.type === 'markdown' ? '마크다운' : 'Raw';
  return index < 0 ? '삭제된 셀' : `셀 ${index + 1} · ${type}`;
}

export async function reveal(panel: NotebookPanel, cell: ICellModel): Promise<void> {
  const index = cells(panel).indexOf(cell);
  if (index < 0 || panel.isDisposed) {
    return;
  }
  panel.content.activeCellIndex = index;
  await panel.content.scrollToItem(index);
}
