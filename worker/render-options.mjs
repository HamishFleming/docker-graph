import { InputError } from './input.mjs';
export function renderOptions(params) {
  const width = Number(params.get('width') ?? 1600);
  const height = Number(params.get('height') ?? 1000);
  const pixelRatio = Number(params.get('pixelRatio') ?? 2);
  if (![width, height].every(n => Number.isInteger(n) && n >= 128 && n <= 4096)) {
    throw new InputError(400, 'Dimensions must be integers from 128 to 4096');
  }
  if (!Number.isFinite(pixelRatio) || pixelRatio < 1 || pixelRatio > 3) {
    throw new InputError(400, 'pixelRatio must be between 1 and 3');
  }
  if (Math.ceil(width * pixelRatio) * Math.ceil(height * pixelRatio) > 36000000) {
    throw new InputError(400, 'Output exceeds 36 million pixels; reduce dimensions or pixelRatio');
  }
  return { viewport: { width, height }, deviceScaleFactor: pixelRatio };
}
