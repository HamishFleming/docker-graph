import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { mkdtemp, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import http from 'node:http';
import { loadInput } from './input.mjs';
function request(value, json = true) {
  const stream = Readable.from([Buffer.from(json ? JSON.stringify(value) : value)]);
  stream.headers = { 'content-type': json ? 'application/json' : 'application/yaml' };
  return stream;
}
test('raw YAML and JSON validation', async () => {
  assert.equal(await loadInput(request('services: {}', false)), 'services: {}');
  await assert.rejects(loadInput(request({ path: 'x', url: 'x' })), { status: 400 });
  await assert.rejects(loadInput(request({ url: 'file:///etc/passwd' })), { status: 400 });
});
test('mounted files, traversal, symlinks and size limit', async () => {
  const dir = await mkdtemp(`${tmpdir()}/compose-input-`);
  try {
    await writeFile(`${dir}/compose.yaml`, 'services: {}');
    assert.equal(await loadInput(request({ path: 'compose.yaml' }), dir), 'services: {}');
    assert.equal(await loadInput(request({ path: `${dir}/compose.yaml` }), dir), 'services: {}');
    await symlink('/etc/passwd', `${dir}/escape`);
    await assert.rejects(loadInput(request({ path: 'escape' }), dir), { status: 400 });
    await assert.rejects(loadInput(request({ path: '../missing' }), dir), { status: 400 });
    await writeFile(`${dir}/large`, Buffer.alloc(1024 * 1024 + 1));
    await assert.rejects(loadInput(request({ path: 'large' }), dir), { status: 413 });
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('URL downloads, redirects and upstream errors', async () => {
  const server = http.createServer((req, res) => {
    if (req.url === '/redirect') { res.writeHead(302, { location: '/compose' }); res.end(); }
    else if (req.url === '/compose') res.end('services: {}');
    else { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}`;
    assert.equal(await loadInput(request({ url: `${url}/redirect` })), 'services: {}');
    await assert.rejects(loadInput(request({ url: `${url}/missing` })), { status: 502 });
  } finally { await new Promise(resolve => server.close(resolve)); }
});
