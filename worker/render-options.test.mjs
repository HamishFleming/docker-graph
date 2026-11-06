import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderOptions } from './render-options.mjs';
test('defaults to double resolution without changing layout', () => {
  assert.deepEqual(renderOptions(new URLSearchParams()), {
    viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2,
  });
});
test('allows explicit resolution and rejects invalid or excessive output', () => {
  assert.equal(renderOptions(new URLSearchParams('pixelRatio=3')).deviceScaleFactor, 3);
  assert.equal(renderOptions(new URLSearchParams('pixelRatio=1')).deviceScaleFactor, 1);
  for (const query of ['pixelRatio=0', 'pixelRatio=NaN', 'pixelRatio=4', 'width=4096&height=4096&pixelRatio=3', 'width=0']) {
    assert.throws(() => renderOptions(new URLSearchParams(query)), { status: 400 });
  }
});
