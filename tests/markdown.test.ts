import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMarkdownMap } from '../src/markdown';

test('source ranges cross emphasis markers and headings without including markup', () => {
  const source = '# 제목\n\n앞 **중요한 조건** 뒤';
  const rendered = '제목\n앞 중요한 조건 뒤\n';
  const map = createMarkdownMap(source, rendered)!;
  const range = map.fromSource(source.indexOf('**'), source.lastIndexOf('**') + 2)!;
  assert.equal(rendered.slice(range.start, range.end), '중요한 조건');
  const partial = map.fromSource(source.indexOf('요한'), source.indexOf('요한') + 2)!;
  assert.equal(rendered.slice(partial.start, partial.end), '요한');
  assert.equal(map.fromSource(0, 1), null);
});

test('repeated phrases map to their actual source occurrence', () => {
  const source = '같은 말, **같은 말**.';
  const rendered = '같은 말, 같은 말.\n';
  const range = createMarkdownMap(source, rendered)!.fromSource(source.lastIndexOf('같은'), source.lastIndexOf('같은') + 4)!;
  assert.equal(range.start, rendered.lastIndexOf('같은'));
  assert.equal(rendered.slice(range.start, range.end), '같은 말');
});

test('links hide destinations, escapes/entities decode, code keeps literal syntax', () => {
  const source = '[링크](https://example.com) &amp; \\* `a_b`\n\n```python\nx = "**값**"\n```';
  const rendered = '링크 & * a_b\nx = "**값**"\n';
  const map = createMarkdownMap(source, rendered)!;
  assert.ok(map);
  assert.equal(map.fromSource(source.indexOf('https'), source.indexOf('https') + 5), null);
  const amp = map.fromSource(source.indexOf('&amp;'), source.indexOf('&amp;') + 5)!;
  assert.equal(rendered.slice(amp.start, amp.end), '&');
  const code = map.fromSource(source.indexOf('**값**'), source.indexOf('**값**') + 5)!;
  assert.equal(rendered.slice(code.start, code.end), '**값**');
});

test('lists, quotes and tables preserve order across whitespace and syntax', () => {
  const source = '> 인용\n\n- 하나\n- 둘\n\n| A | B |\n|---|---|\n| x | y |';
  const rendered = '\n인용\n\n하나\n둘\n\nA\nB\nx\ny\n';
  const map = createMarkdownMap(source, rendered)!;
  assert.ok(map);
  const range = map.fromSource(source.indexOf('x'), source.indexOf('y') + 1)!;
  assert.equal(rendered.slice(range.start, range.end), 'x\ny');
});

test('unexpected generated content never guesses a matching duplicate', () => {
  assert.equal(createMarkdownMap('같은 말 $x$ 같은 말', '같은 말 generated same 같은 말'), null);
});
