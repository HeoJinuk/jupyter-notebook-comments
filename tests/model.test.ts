import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addComment, deleteComment, editComment, readData, resolveComment,
  MAX_BODY_LENGTH, type CommentData, type MetadataPort
} from '../src/model';

function memory(initial?: unknown): MetadataPort & { raw: unknown; writes: number } {
  return {
    raw: initial, writes: 0,
    get() { return this.raw === undefined ? undefined : JSON.parse(JSON.stringify(this.raw)); },
    set(value: CommentData) { this.raw = JSON.parse(JSON.stringify(value)); this.writes++; }
  };
}

test('multiple comments survive JSON save/reopen, edit, resolve, reopen and delete', () => {
  const data = memory();
  const first = addComment(data, '  이 보상 범위를 다시 확인하자.  ');
  const second = addComment(data, '온도 단위는 °C인가?\n한글 줄바꿈도 보존.');
  assert.notEqual(first, second);
  assert.equal(readData(data.get()).comments[0].body, '이 보상 범위를 다시 확인하자.');
  editComment(data, first, '확인 완료 — 범위 수정 필요');
  resolveComment(data, first, true);
  const reopened = memory(JSON.parse(JSON.stringify(data.raw)));
  assert.equal(readData(reopened.get()).comments[0].resolved, true);
  resolveComment(reopened, first, false);
  deleteComment(reopened, second);
  const [comment] = readData(reopened.get()).comments;
  assert.equal(comment.id, first);
  assert.equal(comment.resolved, false);
  assert.deepEqual(comment.anchor, { type: 'cell' });
});

test('unknown fields and future text anchors are preserved by targeted updates', () => {
  const data = memory();
  const id = addComment(data, '원문');
  const raw = readData(data.get());
  raw.extensionSetting = { future: true };
  raw.comments[0].anchor = { type: 'text', start: 3, end: 8, quote: 'hello' };
  raw.comments[0].replies = [{ body: '나중에 추가할 답글' }];
  data.raw = raw;
  editComment(data, id, '수정');
  resolveComment(data, id, true);
  const result = readData(data.get());
  assert.deepEqual(result.extensionSetting, { future: true });
  assert.deepEqual(result.comments[0].anchor, raw.comments[0].anchor);
  assert.deepEqual(result.comments[0].replies, raw.comments[0].replies);
});

test('malformed and future schema data are never overwritten', () => {
  for (const bad of [null, [], { schemaVersion: 2, comments: [] },
    { schemaVersion: 1, comments: [{}] }]) {
    const data = memory(bad);
    assert.throws(() => addComment(data, 'test'));
    assert.throws(() => deleteComment(data, 'missing'));
    assert.deepEqual(data.raw, bad);
    assert.equal(data.writes, 0);
  }
});

test('edits read latest metadata and do not discard another newly added comment', () => {
  const data = memory();
  const first = addComment(data, 'first');
  const second = addComment(data, 'added later');
  editComment(data, first, 'changed');
  assert.equal(readData(data.get()).comments[1].id, second);
  assert.equal(readData(data.get()).comments.length, 2);
});

test('invalid content and stale edit IDs cannot write metadata', () => {
  const data = memory();
  assert.throws(() => addComment(data, '  \n '));
  assert.throws(() => addComment(data, 'x'.repeat(MAX_BODY_LENGTH + 1)));
  assert.throws(() => editComment(data, 'deleted', 'new text'));
  assert.equal(data.writes, 0);
});

test('duplicate comment identifiers fail closed', () => {
  const data = memory();
  addComment(data, 'original');
  const raw = readData(data.get());
  raw.comments.push({ ...raw.comments[0] });
  assert.throws(() => readData(raw));
});
