import { useState, type ComponentType, type KeyboardEvent, type MouseEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  BookmarkPlus,
  CodeXml,
  Coffee,
  ExternalLink,
  FileText,
  GitBranch,
  Link2,
  PenTool,
  Search,
  SquareTerminal,
  TvMinimalPlay,
  Wrench,
  X
} from 'lucide-react'
import { presetById, resolveTool, sameTool, toolFromInput } from '@shared/tools'
import type { ToolIconSpec, ToolRef } from '@shared/types'
import { useData, useT } from '@/lib/hooks'
import { newId, useApp } from '@/state/useApp'
import { cn, inputBase } from './ui'

type Icon = ComponentType<{ size?: number; strokeWidth?: number; className?: string; color?: string }>

const PRESET_ICONS: Record<string, Icon> = {
  vscode: CodeXml,
  netbeans: Coffee,
  terminal: SquareTerminal,
  google: Search,
  youtube: TvMinimalPlay,
  docs: FileText,
  figma: PenTool,
  github: GitBranch
}

/** The built-in glyph for a tool: its preset's icon, a link, or a wrench. */
export function DefaultToolIcon({ preset, hasUrl, size }: { preset: string | null; hasUrl: boolean; size: number }) {
  const p = presetById(preset)
  const Glyph = (p && PRESET_ICONS[p.id]) ?? (hasUrl ? Link2 : Wrench)
  return <Glyph size={size} strokeWidth={2.2} color={p?.color} className={p ? undefined : 'text-muted'} />
}

/** A custom icon (emoji or image) at an exact pixel size, or nothing if there is none. */
export function CustomIcon({ icon, size }: { icon: ToolIconSpec; size: number }) {
  if (icon.type === 'image') {
    return (
      <img
        src={icon.src}
        alt=""
        width={size}
        height={size}
        draggable={false}
        className="shrink-0 rounded-[3px] object-contain"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      className="inline-grid shrink-0 place-items-center leading-none"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.92),
        fontFamily: '"Segoe UI Emoji", "Segoe UI Symbol", "Apple Color Emoji", "Noto Color Emoji", sans-serif'
      }}
    >
      {icon.value}
    </span>
  )
}

/** Renders an already-resolved tool's icon. */
export function ToolIcon({ tool, size = 14 }: { tool: ToolRef; size?: number }) {
  if (tool.icon) return <CustomIcon icon={tool.icon} size={size} />
  return <DefaultToolIcon preset={tool.preset} hasUrl={!!tool.url} size={size} />
}

/** Library-aware: a tool on a task shows its current name, link and icon from Settings. */
export function useResolvedTool(ref: ToolRef): ToolRef {
  const library = useData().tools
  return resolveTool(ref, library)
}

export const openTool = (tool: ToolRef): void => {
  if (tool.url) window.api.openExternal(tool.url)
}

/**
 * A tool as a pill. Tools with a link open it on click; the rest are labels.
 * `size="lg"` is the prominent version used in the focus panel.
 */
export function ToolPill({ tool: ref, size = 'sm' }: { tool: ToolRef; size?: 'sm' | 'lg' }) {
  const t = useT()
  const tool = useResolvedTool(ref)
  const large = size === 'lg'
  const base = cn(
    'inline-flex min-w-0 items-center rounded-full border border-line bg-surface font-medium',
    large ? 'max-w-[240px]' : 'max-w-[150px]',
    large ? 'h-8 gap-2 px-3 text-[13px]' : 'h-[22px] gap-1.5 px-2 text-xs text-muted'
  )
  const body = (
    <>
      <ToolIcon tool={tool} size={large ? 16 : 13} />
      <span className="truncate">{tool.label}</span>
      {tool.url && large && <ExternalLink size={13} className="shrink-0 text-faint" />}
    </>
  )
  if (!tool.url) return <span className={base}>{body}</span>
  return (
    <button
      type="button"
      title={`${t('tools.open', { name: tool.label })}\n${tool.url}`}
      aria-label={t('tools.open', { name: tool.label })}
      onClick={(e: MouseEvent) => {
        e.stopPropagation()
        openTool(tool)
      }}
      className={cn(
        base,
        'transition-[color,border-color,transform] duration-150 hover:border-accent hover:text-ink active:scale-[0.96]'
      )}
    >
      {body}
    </button>
  )
}

const toolKey = (tool: ToolRef): string => tool.id ?? `${tool.label}|${tool.url}`

/** Compact row of pills for list rows; overflow collapses into "+N". */
export function ToolPills({ tools, max = 3 }: { tools: ToolRef[]; max?: number }) {
  const library = useData().tools
  if (tools.length === 0) return null
  const shown = tools.slice(0, max)
  const rest = tools.slice(max)
  return (
    <span className="flex min-w-0 max-w-full items-center gap-1">
      {shown.map((tool) => (
        <ToolPill key={toolKey(tool)} tool={tool} />
      ))}
      {rest.length > 0 && (
        <span
          className="text-xs tabular-nums text-faint"
          title={rest.map((x) => resolveTool(x, library).label).join(', ')}
        >
          +{rest.length}
        </span>
      )}
    </span>
  )
}

/** Pick tools from the library, or type a custom tool or paste a link. */
export function ToolsPicker({ value, onChange }: { value: ToolRef[]; onChange(next: ToolRef[]): void }) {
  const t = useT()
  const library = useData().tools
  const dispatch = useApp((s) => s.dispatch)
  const [text, setText] = useState('')
  const has = (tool: ToolRef): boolean => value.some((x) => sameTool(x, tool))
  const inLibrary = (tool: ToolRef): boolean => !!tool.id && library.some((l) => l.id === tool.id)

  const toggle = (tool: ToolRef): void =>
    onChange(has(tool) ? value.filter((x) => !sameTool(x, tool)) : [...value, tool])

  const add = (): void => {
    const tool = toolFromInput(text, library)
    if (!tool) return
    if (!has(tool)) onChange([...value, tool])
    setText('')
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      // Enter adds the tool; it must not submit the surrounding task form.
      e.preventDefault()
      add()
    } else if (e.key === 'Backspace' && !text && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  // Saving adds it to the library and links this task's copy to it.
  const saveTool = (tool: ToolRef): void => {
    const saved = { ...tool, id: newId() }
    dispatch({ type: 'tool/upsert', tool: saved })
    onChange(value.map((x) => (x === tool ? saved : x)))
  }

  return (
    <div className="space-y-2.5">
      {library.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {library.map((tool) => {
            const on = has(tool)
            return (
              <button
                key={tool.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(tool)}
                className={cn(
                  'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12.5px] font-medium transition-[color,background-color,border-color,transform] duration-150 active:scale-[0.95]',
                  on ? 'border-accent bg-accent-soft text-ink' : 'border-line text-muted hover:border-faint hover:text-ink'
                )}
              >
                <ToolIcon tool={tool} size={14} />
                {tool.label}
              </button>
            )
          })}
        </div>
      )}

      <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-line bg-bg px-2 py-1.5 transition-colors focus-within:border-accent">
        <AnimatePresence initial={false}>
          {value
            .filter((tool) => !inLibrary(tool))
            .map((tool) => (
              <motion.span
                key={toolKey(tool)}
                layout
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ duration: 0.15 }}
                className="inline-flex h-7 max-w-[260px] items-center gap-1.5 rounded-full bg-raised pl-2.5 pr-1 text-[12.5px] font-medium"
                title={tool.url ?? undefined}
              >
                <ToolIcon tool={tool} size={14} />
                <span className="truncate">{tool.label}</span>
                <button
                  type="button"
                  aria-label={t('tools.save', { name: tool.label })}
                  title={t('tools.save', { name: tool.label })}
                  onClick={() => saveTool(tool)}
                  className="grid size-5 place-items-center rounded-full text-faint hover:bg-line hover:text-ink"
                >
                  <BookmarkPlus size={12} />
                </button>
                <button
                  type="button"
                  aria-label={t('tools.remove', { name: tool.label })}
                  onClick={() => toggle(tool)}
                  className="grid size-5 place-items-center rounded-full text-faint hover:bg-line hover:text-ink"
                >
                  <X size={12} />
                </button>
              </motion.span>
            ))}
        </AnimatePresence>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          onBlur={add}
          placeholder={t('tools.placeholder')}
          aria-label={t('field.tools')}
          className={cn(inputBase, 'h-7 min-w-[220px] flex-1 border-0 bg-transparent px-1 focus:border-0')}
        />
      </div>
    </div>
  )
}
