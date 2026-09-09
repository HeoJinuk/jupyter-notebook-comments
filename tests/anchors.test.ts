import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeAnchor, reconcileAnchor, trackAnchor } from '../src/anchors';

test('inserting text before an anchor shifts it without changing its target', () => {
  const anchor = makeAnchor('source', 'abcTARGETdef', 3, 9);
  const next = trackAnchor(anchor, [{ insert: 'prefix\n' }], 'prefix\nabcTARGETdef');
  assert.equal(next.start, 10); assert.equal(next.end, 16);
  assert.equal(next.currentQuote, 'TARGET'); assert.equal(next.status, 'attached');
});

test('insertions at either boundary are outside the original range', () => {
  const anchor = makeAnchor('source', 'abcTARGETdef', 3, 9);
  const next = trackAnchor(anchor, [{ retain: 3 }, { insert: 'A' }, { retain: 6 }, { insert: 'B' }], 'abcATARGETBdef');
  assert.equal(next.start, 4); assert.equal(next.end, 10);
  assert.equal(next.currentQuote, 'TARGET');
});

test('replacement inside a range follows new text and undo restores the original quote', () => {
  const anchor = makeAnchor('source', 'abcTARGETdef', 3, 9);
  const changed = trackAnchor(anchor, [{ retain: 3 }, { delete: 6 }, { insert: 'OTHER' }], 'abcOTHERdef');
  assert.equal(changed.currentQuote, 'OTHER'); assert.equal(changed.quote, 'TARGET');
  assert.equal(changed.status, 'changed');
  const undo = trackAnchor(changed, [{ retain: 3 }, { delete: 5 }, { insert: 'TARGET' }], 'abcTARGETdef');
  assert.equal(undo.currentQuote, 'TARGET'); assert.equal(undo.status, 'attached');
});

test('multiple edits in one transaction are mapped without merging unrelated text', () => {
  const anchor = makeAnchor('source', 'abcTARGETdef', 3, 9);
  const next = trackAnchor(anchor, [{ retain: 1 }, { delete: 1 }, { retain: 9 }, { insert: 'ZZ' }], 'acTARGETdeZZf');
  assert.equal(next.start, 2); assert.equal(next.end, 8); assert.equal(next.currentQuote, 'TARGET');
});

test('deleting the entire target preserves the comment but detaches its position', () => {
  const anchor = makeAnchor('source', 'abcTARGETdef', 3, 9);
  const next = trackAnchor(anchor, [{ retain: 3 }, { delete: 6 }], 'abcdef');
  assert.equal(next.status, 'detached'); assert.equal(next.quote, 'TARGET');
  assert.equal(next.start, next.end);
});

test('reopening a notebook or rerendering can relocate a unique quote', () => {
  const anchor = makeAnchor('rendered', '앞 중요한 조건 뒤', 2, 8);
  const next = reconcileAnchor(JSON.parse(JSON.stringify(anchor)), '새 문장. 앞 중요한 조건 뒤');
  assert.equal(next.start, 8); assert.equal(next.currentQuote, '중요한 조건');
  assert.equal(next.status, 'attached');
});

test('ambiguous repeated phrases never silently attach to the wrong occurrence', () => {
  const anchor = makeAnchor('rendered', 'same', 0, 4);
  const next = reconcileAnchor(anchor, 'same / same');
  assert.equal(next.status, 'detached');
});

test('context disambiguates repeated text and UTF-16 offsets include emoji correctly', () => {
  const anchor = makeAnchor('source', '😀 앞 target 뒤', 5, 11);
  assert.equal(anchor.quote, 'target');
  const next = reconcileAnchor(anchor, 'target 다른 곳. 😀 앞 target 뒤');
  assert.equal(next.currentQuote, 'target'); assert.equal(next.status, 'attached');
  assert.ok(next.start > anchor.start);
});
