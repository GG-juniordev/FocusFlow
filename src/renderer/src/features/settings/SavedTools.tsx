import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Plus, RotateCcw, Trash2 } from 'lucide-react'
import { cleanUrl, defaultToolLibrary, sameTool, toolFromInput } from '@shared/tools'
import type { LibraryTool, ToolIconSpec } from '@shared/types'
import { ToolIcon } from '@/components/tools'
import { Button, IconButton, cn, inputBase, inputClass } from '@/components/ui'
import { useData, useT } from '@/lib/hooks'
import { newId, useApp } from '@/state/useApp'
import { IconEditor } from './IconEditor'

const fold = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: 'auto' },
  exit: { opacity: 0, height: 0 },
  transition: { duration: 0.2, ease: [0.2, 0.8, 0.2, 1] as const }
}

/** The tool library: edit names, links and icons, delete tools, add new ones. */
export function SavedTools() {
  const data = useData()
  const t = useT()
  const dispatch = useApp((s) => s.dispatch)
  const tools = data.tools
  const missingBuiltIns = defaultToolLibrary().some((d) => !tools.some((x) => x.id === d.id))

  return (
    <div className="py-3">
      <p className="text-[13px] text-muted">{tools.length > 0 ? t('set.toolsHint') : t('set.toolsEmpty')}</p>
      <ul className="mt-2">
        {/* Keyed by the tool's id, so deleting one row removes exactly that row. */}
        <AnimatePresence initial={false}>
          {tools.map((tool) => (
            <motion.li key={tool.id} {...fold} className="overflow-hidden">
              <ToolRow tool={tool} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      <NewTool />
      {missingBuiltIns && (
        <Button size="sm" variant="ghost" className="mt-2" onClick={() => dispatch({ type: 'tool/restoreDefaults' })}>
          <RotateCcw size={14} />
          {t('set.restoreTools')}
        </Button>
      )}
    </div>
  )
}

function IconButtonFor({
  tool,
  open,
  label,
  onClick
}: {
  tool: Pick<LibraryTool, 'icon' | 'preset' | 'url' | 'label'> & { id: string | null }
  open: boolean
  label: string
  onClick(): void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-expanded={open}
      onClick={onClick}
      className={cn(
        'grid size-9 shrink-0 place-items-center rounded-lg border transition-[border-color,background-color,transform] duration-150 active:scale-90',
        open ? 'border-accent bg-accent-soft' : 'border-transparent bg-raised hover:border-faint'
      )}
    >
      <ToolIcon tool={tool} size={20} />
    </button>
  )
}

function ToolRow({ tool }: { tool: LibraryTool }) {
  const t = useT()
  const dispatch = useApp((s) => s.dispatch)
  const [label, setLabel] = useState(tool.label)
  const [url, setUrl] = useState(tool.url ?? '')
  const [editingIcon, setEditingIcon] = useState(false)
  useEffect(() => setLabel(tool.label), [tool.label])
  useEffect(() => setUrl(tool.url ?? ''), [tool.url])

  const save = (patch: Partial<LibraryTool>): void => dispatch({ type: 'tool/upsert', tool: { ...tool, ...patch } })

  const commitLabel = (): void => {
    const next = label.trim()
    if (!next) setLabel(tool.label)
    else if (next !== tool.label) save({ label: next })
  }

  const commitUrl = (): void => {
    if (!url.trim()) {
      if (tool.url !== null) save({ url: null })
      return
    }
    const next = cleanUrl(url)
    if (next && next !== tool.url) save({ url: next })
    else if (!next) setUrl(tool.url ?? '')
  }

  return (
    <div>
      <div className="flex items-center gap-2 py-1.5">
        <IconButtonFor
          tool={tool}
          open={editingIcon}
          label={t('set.toolIcon', { name: tool.label })}
          onClick={() => setEditingIcon((v) => !v)}
        />
        <input
          value={label}
          aria-label={t('set.toolName')}
          placeholder={t('set.toolName')}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className={`${inputBase} w-40 shrink-0`}
        />
        <input
          value={url}
          aria-label={t('set.toolUrl')}
          placeholder={t('set.toolUrl')}
          spellCheck={false}
          onChange={(e) => setUrl(e.target.value)}
          onBlur={commitUrl}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className={`${inputBase} min-w-0 flex-1 text-[13px]`}
        />
        <IconButton
          label={t('set.deleteTool', { name: tool.label })}
          tone="danger"
          // Keep focus where it is: a blur-save racing the delete would be pointless work.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => dispatch({ type: 'tool/remove', id: tool.id })}
        >
          <Trash2 size={15} />
        </IconButton>
      </div>
      <AnimatePresence initial={false}>
        {editingIcon && (
          <motion.div key="icon" {...fold} className="overflow-hidden pl-11">
            <IconEditor
              value={tool.icon}
              preset={tool.preset}
              hasUrl={!!tool.url}
              onChange={(icon) => save({ icon })}
              onDone={() => setEditingIcon(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Add a tool by name or link, optionally choosing its icon first. */
function NewTool() {
  const t = useT()
  const library = useData().tools
  const dispatch = useApp((s) => s.dispatch)
  const [text, setText] = useState('')
  const [icon, setIcon] = useState<ToolIconSpec | null>(null)
  const [editingIcon, setEditingIcon] = useState(false)
  const draft = toolFromInput(text, [])

  const add = (): void => {
    const tool = toolFromInput(text, [])
    if (!tool) return
    const existing = library.find((x) => sameTool({ ...x, id: null }, tool))
    if (existing) {
      // Already in the library: just apply the chosen icon to it.
      if (icon) dispatch({ type: 'tool/upsert', tool: { ...existing, icon } })
    } else {
      dispatch({ type: 'tool/upsert', tool: { ...tool, id: newId(), icon } })
    }
    setText('')
    setIcon(null)
    setEditingIcon(false)
  }

  return (
    <div className="mt-2">
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <IconButtonFor
          tool={{ id: null, label: draft?.label ?? '', url: draft?.url ?? null, preset: draft?.preset ?? null, icon }}
          open={editingIcon}
          label={t('set.newToolIcon')}
          onClick={() => setEditingIcon((v) => !v)}
        />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('set.toolAdd')}
          aria-label={t('set.toolAdd')}
          className={inputClass}
        />
        <Button type="submit" size="md" disabled={!draft}>
          <Plus size={15} />
          {t('common.add')}
        </Button>
      </form>
      <AnimatePresence initial={false}>
        {editingIcon && (
          <motion.div key="icon" {...fold} className="overflow-hidden pl-11">
            <IconEditor
              value={icon}
              preset={draft?.preset ?? null}
              hasUrl={!!draft?.url}
              onChange={setIcon}
              onDone={() => setEditingIcon(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
