import { open, realpath } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
const limit = 1024 * 1024;
export class InputError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
async function collect(stream) {
  const chunks = []; let size = 0;
  for await (const chunk of stream) {
    size += chunk.length;
    if (size > limit) throw new InputError(413, 'Compose file exceeds 1 MiB');
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}
export async function loadInput(req, inputRoot = process.env.COMPOSE_ROOT || '/compose') {
  const body = await collect(req);
  if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') return body;
  let input;
  try { input = JSON.parse(body); } catch { throw new InputError(400, 'Invalid JSON'); }
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).length !== 1 ||
      !['path', 'url'].some(key => typeof input[key] === 'string' && input[key].trim())) {
    throw new InputError(400, 'Provide exactly one JSON field: path or url');
  }
  if (input.path) {
    let handle;
    try {
      const base = await realpath(inputRoot);
      const file = await realpath(resolve(base, input.path));
      const rel = relative(base, file);
      if (rel === '..' || rel.startsWith('../') || isAbsolute(rel)) throw new InputError(400, 'Path must be inside COMPOSE_ROOT');
      handle = await open(file, 'r');
      const stat = await handle.stat();
      if (!stat.isFile()) throw new InputError(400, 'Path must reference a regular file');
      if (stat.size > limit) throw new InputError(413, 'Compose file exceeds 1 MiB');
      return await collect(handle.createReadStream({ autoClose: false }));
    } catch (error) {
      if (error instanceof InputError) throw error;
      throw new InputError(400, 'Cannot read Compose path');
    } finally { await handle?.close(); }
  }
  try {
    let target = new URL(input.url);
    const signal = AbortSignal.timeout(10000);
    for (let redirects = 0; redirects <= 5; redirects++) {
      if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) throw new InputError(400, 'URL must use HTTP or HTTPS without credentials');
      const response = await fetch(target, { redirect: 'manual', signal });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        await response.body?.cancel();
        const location = response.headers.get('location');
        if (!location || redirects === 5) throw new InputError(502, 'Invalid or excessive URL redirects');
        target = new URL(location, target);
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new InputError(502, `Compose URL returned HTTP ${response.status}`);
      }
      return response.body ? await collect(response.body) : '';
    }
  } catch (error) {
    if (error instanceof InputError) throw error;
    throw new InputError(502, 'Could not download Compose URL within 10 seconds');
  }
}
