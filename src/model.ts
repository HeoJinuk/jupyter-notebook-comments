/** Versioned cell-local metadata. UI and Jupyter adapters live elsewhere. */
export const METADATA_KEY = 'notebook_cell_comments';
export const MAX_BODY_LENGTH = 20000;

export interface CellComment {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  resolved: boolean;
  anchor: { type: string; [key: string]: unknown };
  [key: string]: unknown;
}

export interface CommentData {
  schemaVersion: 1;
  comments: CellComment[];
  [key: string]: unknown;
}

export interface MetadataPort {
  get(): unknown;
  set(value: CommentData): void;
}

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function readData(value: unknown): CommentData {
  if (value === undefined) {
    return { schemaVersion: 1, comments: [] };
  }
  if (!object(value) || value.schemaVersion !== 1 || !Array.isArray(value.comments)) {
    throw new Error('지원하지 않는 메모 데이터입니다. 원본을 보호하기 위해 수정하지 않습니다.');
  }
  const ids = new Set<string>();
  for (const item of value.comments) {
    if (
      !object(item) || typeof item.id !== 'string' || !item.id || ids.has(item.id) ||
      typeof item.body !== 'string' || typeof item.createdAt !== 'string' ||
      typeof item.updatedAt !== 'string' || typeof item.resolved !== 'boolean' ||
      !object(item.anchor) || typeof item.anchor.type !== 'string'
    ) {
      throw new Error('메모 데이터 형식에 문제가 있습니다. 원본을 보호하기 위해 수정하지 않습니다.');
    }
    ids.add(item.id);
  }
  return value as unknown as CommentData;
}

function bodyText(body: string): string {
  const text = body.trim();
  if (!text) {
    throw new Error('메모 내용을 입력해 주세요.');
  }
  if (text.length > MAX_BODY_LENGTH) {
    throw new Error(`메모는 ${MAX_BODY_LENGTH.toLocaleString()}자까지 입력할 수 있습니다.`);
  }
  return text;
}

/** getRandomValues also works on remote HTTP origins without randomUUID. */
function newId(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function addComment(port: MetadataPort, body: string, anchor: CellComment['anchor'] = { type: 'cell' }): string {
  const data = readData(port.get());
  const text = bodyText(body);
  const now = new Date().toISOString();
  const comment: CellComment = {
    id: newId(), body: text, createdAt: now, updatedAt: now,
    resolved: false, anchor: { ...anchor }
  };
  port.set({ ...data, comments: [...data.comments, comment] });
  return comment.id;
}

export function editComment(port: MetadataPort, id: string, body: string): void {
  updateComment(port, id, { body: bodyText(body) });
}

export function resolveComment(port: MetadataPort, id: string, resolved: boolean): void {
  updateComment(port, id, { resolved });
}

function updateComment(port: MetadataPort, id: string, patch: Partial<CellComment>): void {
  const data = readData(port.get());
  if (!data.comments.some(comment => comment.id === id)) {
    throw new Error('메모가 이미 삭제되었습니다.');
  }
  port.set({
    ...data,
    comments: data.comments.map(comment => comment.id === id
      ? { ...comment, ...patch, updatedAt: new Date().toISOString() }
      : comment)
  });
}

export function deleteComment(port: MetadataPort, id: string): void {
  const data = readData(port.get());
  port.set({ ...data, comments: data.comments.filter(comment => comment.id !== id) });
}
