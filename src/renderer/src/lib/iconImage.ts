import { MAX_ICON_DATA_URL } from '@shared/tools'

/** Stored icon size: 64px stays sharp at 16–20px badges on screens scaled up to 300%. */
const ICON_PX = 64

export const ICON_ACCEPT = '.png,.jpg,.jpeg,.svg,.webp,.ico,image/png,image/jpeg,image/svg+xml,image/webp,image/x-icon'
const MAX_FILE_BYTES = 5 * 1024 * 1024

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('not an image'))
    img.src = src
  })
}

/** Draw `source` into a size×size canvas, scaled to fit and centred. */
function drawFit(source: CanvasImageSource, w: number, h: number, size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no canvas')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  const scale = Math.min(size / w, size / h)
  const dw = w * scale
  const dh = h * scale
  ctx.drawImage(source, (size - dw) / 2, (size - dh) / 2, dw, dh)
  return canvas
}

/**
 * Turn a picked image file (PNG, JPG, SVG, WebP or ICO) into a small square PNG
 * data URL. Large photos are halved step by step first, which keeps the result
 * sharp instead of grainy; SVGs are rasterised directly at the target size.
 */
export async function fileToIcon(file: File): Promise<string> {
  if (file.size > MAX_FILE_BYTES) throw new Error('too large')
  const img = await loadImage(await readAsDataUrl(file))
  // SVGs without width/height report 0; give them a square canvas to fill.
  let w = img.naturalWidth || ICON_PX * 4
  let h = img.naturalHeight || ICON_PX * 4

  let source: CanvasImageSource = img
  while (Math.max(w, h) > ICON_PX * 2) {
    const nw = Math.max(1, Math.round(w / 2))
    const nh = Math.max(1, Math.round(h / 2))
    const step = document.createElement('canvas')
    step.width = nw
    step.height = nh
    const ctx = step.getContext('2d')
    if (!ctx) throw new Error('no canvas')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(source, 0, 0, nw, nh)
    source = step
    w = nw
    h = nh
  }

  const url = drawFit(source, w, h, ICON_PX).toDataURL('image/png')
  if (url.length > MAX_ICON_DATA_URL) throw new Error('too large')
  return url
}
