import type { LibraryTool, ToolIconSpec, ToolRef } from './types'

export interface ToolPreset {
  id: string
  label: string
  url: string | null
  /** Recognisable brand-like tint for the icon. */
  color: string
  /** Hostnames that identify a pasted link as this tool. */
  hosts?: string[]
}

export const TOOL_PRESETS: ToolPreset[] = [
  { id: 'vscode', label: 'VS Code', url: 'vscode://', color: '#2f8fe0' },
  { id: 'netbeans', label: 'NetBeans', url: null, color: '#1b6ac6' },
  { id: 'terminal', label: 'Terminal', url: null, color: '#8a93a6' },
  { id: 'google', label: 'Google', url: 'https://www.google.com', color: '#4285f4', hosts: ['google.com'] },
  { id: 'youtube', label: 'YouTube', url: 'https://www.youtube.com', color: '#ff3b30', hosts: ['youtube.com', 'youtu.be'] },
  { id: 'docs', label: 'Google Docs', url: 'https://docs.google.com', color: '#3b82f6', hosts: ['docs.google.com', 'drive.google.com'] },
  { id: 'figma', label: 'Figma', url: 'https://www.figma.com', color: '#a259ff', hosts: ['figma.com'] },
  { id: 'github', label: 'GitHub', url: 'https://github.com', color: '#9aa4b8', hosts: ['github.com'] }
]

/** Library ids of the built-in tools are fixed so "Restore built-in tools" can find them. */
export const presetLibraryId = (presetId: string): string => `builtin-${presetId}`

export function defaultToolLibrary(): LibraryTool[] {
  return TOOL_PRESETS.map((p) => ({ id: presetLibraryId(p.id), label: p.label, url: p.url, preset: p.id, icon: null }))
}

/* ---------- icons ---------- */

/** Uploaded icons are re-encoded as small PNGs; anything larger than this is rejected. */
export const MAX_ICON_DATA_URL = 48_000

/** First user-perceived character, so "👨‍💻" or "🇮🇹" stay whole. */
export function firstGrapheme(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return ''
  const Segmenter = (Intl as unknown as { Segmenter?: typeof Intl.Segmenter }).Segmenter
  if (Segmenter) {
    for (const { segment } of new Segmenter(undefined, { granularity: 'grapheme' }).segment(trimmed)) return segment
  }
  return Array.from(trimmed)[0] ?? ''
}

export function sanitizeIcon(raw: unknown): ToolIconSpec | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (r.type === 'emoji' && typeof r.value === 'string') {
    const value = firstGrapheme(r.value).slice(0, 16)
    return value ? { type: 'emoji', value } : null
  }
  if (
    r.type === 'image' &&
    typeof r.src === 'string' &&
    /^data:image\/(png|webp);base64,[A-Za-z0-9+/=]+$/.test(r.src) &&
    r.src.length <= MAX_ICON_DATA_URL
  ) {
    return { type: 'image', src: r.src }
  }
  return null
}

/* ---------- links ---------- */

const ALLOWED_PROTOCOLS = ['http:', 'https:', 'vscode:', 'mailto:']

export function isSafeUrl(url: string): boolean {
  try {
    return ALLOWED_PROTOCOLS.includes(new URL(url).protocol)
  } catch {
    return false
  }
}

/** Normalise a link typed by the user: "www.x.com" gains https://; unsafe links become null. */
export function cleanUrl(input: string): string | null {
  const value = input.trim()
  if (!value) return null
  const withScheme = /^www\./i.test(value) ? `https://${value}` : value
  return isSafeUrl(withScheme) ? withScheme : null
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return ''
  }
}

const matchesHost = (host: string, candidate: string): boolean => host === candidate || host.endsWith(`.${candidate}`)

/** Most specific preset for a link: docs.google.com wins over google.com. */
function presetForUrl(url: string): ToolPreset | undefined {
  const host = hostOf(url)
  if (!host) return undefined
  let best: { preset: ToolPreset; length: number } | undefined
  for (const preset of TOOL_PRESETS) {
    for (const h of preset.hosts ?? []) {
      if (matchesHost(host, h) && (!best || h.length > best.length)) best = { preset, length: h.length }
    }
  }
  return best?.preset
}

export const presetById = (id: string | null): ToolPreset | undefined =>
  id ? TOOL_PRESETS.find((p) => p.id === id) : undefined

/**
 * Turn what the user typed into a tool. A library tool with that name (or link)
 * is reused; a pasted link becomes a clickable tool named after its site; a
 * built-in name picks that preset's icon; anything else is a custom label.
 */
export function toolFromInput(input: string, library: LibraryTool[] = []): ToolRef | null {
  const text = input.trim()
  if (!text) return null

  const looksLikeLink = /^(https?:\/\/|www\.|vscode:\/\/)\S*$/i.test(text)
  if (looksLikeLink) {
    const url = cleanUrl(text)
    if (!url) return null
    const known = library.find((t) => t.url === url)
    if (known) return { ...known }
    const preset = presetForUrl(url)
    return { id: null, label: preset?.label ?? (hostOf(url) || url), url, preset: preset?.id ?? null, icon: null }
  }

  const named = library.find((t) => t.label.toLowerCase() === text.toLowerCase())
  if (named) return { ...named }
  const preset = TOOL_PRESETS.find((p) => p.label.toLowerCase() === text.toLowerCase())
  if (preset) return { id: null, label: preset.label, url: preset.url, preset: preset.id, icon: null }
  return { id: null, label: text.slice(0, 60), url: null, preset: null, icon: null }
}

/** Library tools match by id; anything else by link, or by name when there is no link. */
export function sameTool(a: ToolRef, b: ToolRef): boolean {
  if (a.id && b.id) return a.id === b.id
  if (a.url || b.url) return a.url === b.url && a.label.toLowerCase() === b.label.toLowerCase()
  return a.label.toLowerCase() === b.label.toLowerCase()
}

/** What to show for a task's tool: the live library version, or the saved snapshot if it was deleted. */
export function resolveTool(ref: ToolRef, library: LibraryTool[]): ToolRef {
  if (!ref.id) return ref
  return library.find((t) => t.id === ref.id) ?? ref
}

/** Copy the library's current details into a task's tool, keeping the link to it. */
export function snapshotTool(ref: ToolRef, library: LibraryTool[]): ToolRef {
  const live = ref.id ? library.find((t) => t.id === ref.id) : undefined
  return live ? { ...live } : ref
}

/* ---------- validation of data from disk or IPC ---------- */

function sanitizeTool(item: unknown): ToolRef | null {
  if (!item || typeof item !== 'object') return null
  const r = item as Record<string, unknown>
  const label = typeof r.label === 'string' ? r.label.trim().slice(0, 60) : ''
  if (!label) return null
  return {
    id: typeof r.id === 'string' && r.id ? r.id.slice(0, 80) : null,
    label,
    url: typeof r.url === 'string' && isSafeUrl(r.url) ? r.url : null,
    preset: typeof r.preset === 'string' && presetById(r.preset) ? r.preset : null,
    icon: sanitizeIcon(r.icon)
  }
}

/** A task's tools: drop junk, unsafe links and duplicates. */
export function sanitizeTools(raw: unknown, max = 20): ToolRef[] {
  if (!Array.isArray(raw)) return []
  const out: ToolRef[] = []
  for (const item of raw) {
    const tool = sanitizeTool(item)
    if (tool && !out.some((t) => sameTool(t, tool))) out.push(tool)
    if (out.length >= max) break
  }
  return out
}

/** The tool library: every entry needs a unique id. */
export function sanitizeLibrary(raw: unknown, max = 60): LibraryTool[] {
  if (!Array.isArray(raw)) return []
  const out: LibraryTool[] = []
  for (const item of raw) {
    const tool = sanitizeTool(item)
    if (tool?.id && !out.some((t) => t.id === tool.id)) out.push(tool as LibraryTool)
    if (out.length >= max) break
  }
  return out
}
