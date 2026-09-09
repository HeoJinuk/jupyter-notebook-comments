import { test } from 'node:test';
import assert from 'node:assert/strict';
import { locateMath } from '../src/math';
import { createMarkdownMap } from '../src/markdown';

test('inline, display, repeated formulas follow source order, skipping literal code', () => {
  const source = '`$x^2$` and $x^2$ then $$x^2$$ and $x^2$';
  const ranges = locateMath(source, ['$x^2$', '$$x^2$$', '$x^2$'])!;
  assert.equal(ranges[0].start, source.indexOf('$x^2$', 7));
  assert.equal(ranges[2].start, source.lastIndexOf('$x^2$'));
  assert.deepEqual(ranges.map(r => source.slice(r.start, r.end)), ['$x^2$', '$$x^2$$', '$x^2$']);
});

test('escaped Jupyter math data map back to the original source', () => {
  const source = '$x < y & z > 0$';
  assert.deepEqual(locateMath(source, ['$x &lt; y &amp; z &gt; 0$']), [{ start: 0, end: source.length }]);
  assert.equal(locateMath('no formula', ['$x$']), null);
});

test('math is atomic while surrounding Markdown and duplicates keep exact positions', () => {
  const source = '앞 **조건** $x^2$ 뒤 $x^2$';
  const atoms = locateMath(source, ['$x^2$', '$x^2$'])!;
  const displayed = '앞 조건 \uFFFC 뒤 \uFFFC';
  const map = createMarkdownMap(source, displayed, undefined, atoms)!;
  assert.ok(map);
  assert.deepEqual(map.fromSource(source.lastIndexOf('x'), source.lastIndexOf('x') + 1), { start: displayed.lastIndexOf('\uFFFC'), end: displayed.length });
  const text = map.fromSource(source.indexOf('조건'), source.indexOf('조건') + 2)!;
  assert.equal(displayed.slice(text.start, text.end), '조건');
});

test('TeX braces, subscripts and Markdown-like syntax do not alter nearby parsing', () => {
  const source = '# 값\n\n$$\\frac{a_b}{c} + x_*$$\n\n**설명**';
  const atoms = locateMath(source, ['$$\\frac{a_b}{c} + x_*$$'])!;
  const displayed = '값\n\uFFFC\n설명';
  const map = createMarkdownMap(source, displayed, undefined, atoms)!;
  assert.ok(map);
  const all = map.fromSource(0, source.length)!;
  assert.equal(displayed.slice(all.start, all.end), displayed);
});
