// Rasterises resources/icon.svg into the icons the app and installer need:
//   resources/icon.png  (512px, notifications)
//   resources/icon.ico  (multi-size, window + tray)
//   build/icon.ico      (installer and .exe icon)
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const svg = await readFile(resolve(root, 'resources/icon.svg'))
// Tray and taskbar sizes get their own drawing: heavier strokes, no gradients,
// and less padding, so the ring still reads at 16px.
const smallSvg = await readFile(resolve(root, 'resources/icon-small.svg'))

const render = (size) => sharp(size <= 24 ? smallSvg : svg, { density: 384 }).resize(size, size)

/** Classic BMP-style icon entry (BGRA + empty AND mask): the most widely compatible form. */
async function bmpEntry(size) {
  const rgba = await render(size).ensureAlpha().raw().toBuffer()
  const header = Buffer.alloc(40)
  header.writeUInt32LE(40, 0)
  header.writeInt32LE(size, 4)
  header.writeInt32LE(size * 2, 8) // XOR + AND bitmaps stacked
  header.writeUInt16LE(1, 12)
  header.writeUInt16LE(32, 14)
  header.writeUInt32LE(size * size * 4, 20)

  const pixels = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    const src = (size - 1 - y) * size * 4 // bottom-up rows
    for (let x = 0; x < size; x++) {
      const s = src + x * 4
      const d = (y * size + x) * 4
      pixels[d] = rgba[s + 2]
      pixels[d + 1] = rgba[s + 1]
      pixels[d + 2] = rgba[s]
      pixels[d + 3] = rgba[s + 3]
    }
  }
  const maskRow = Math.ceil(size / 32) * 4
  return Buffer.concat([header, pixels, Buffer.alloc(maskRow * size)])
}

async function buildIco(sizes) {
  const images = await Promise.all(
    sizes.map(async (size) => ({
      size,
      data: size >= 256 ? await render(size).png().toBuffer() : await bmpEntry(size)
    }))
  )
  const head = Buffer.alloc(6)
  head.writeUInt16LE(1, 2)
  head.writeUInt16LE(images.length, 4)

  const directory = Buffer.alloc(16 * images.length)
  let offset = 6 + directory.length
  images.forEach(({ size, data }, i) => {
    const at = i * 16
    directory.writeUInt8(size >= 256 ? 0 : size, at)
    directory.writeUInt8(size >= 256 ? 0 : size, at + 1)
    directory.writeUInt16LE(1, at + 4)
    directory.writeUInt16LE(32, at + 6)
    directory.writeUInt32LE(data.length, at + 8)
    directory.writeUInt32LE(offset, at + 12)
    offset += data.length
  })
  return Buffer.concat([head, directory, ...images.map((i) => i.data)])
}

await mkdir(resolve(root, 'build'), { recursive: true })
const ico = await buildIco([16, 20, 24, 32, 40, 48, 64, 256])
await writeFile(resolve(root, 'resources/icon.ico'), ico)
await writeFile(resolve(root, 'build/icon.ico'), ico)
await writeFile(resolve(root, 'resources/icon.png'), await render(512).png().toBuffer())
console.log('Icons written: resources/icon.ico, resources/icon.png, build/icon.ico')
