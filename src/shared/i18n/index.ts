import type { Language } from '../types'
import { en, type MessageKey } from './en'
import { it } from './it'

const dictionaries = { en, it } as const

export type { MessageKey }
export type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string

export function translator(language: Language): Translate {
  const dict = dictionaries[language] ?? en
  return (key, vars) => {
    let text: string = dict[key] ?? en[key] ?? key
    if (vars) {
      for (const [name, value] of Object.entries(vars)) text = text.replaceAll(`{${name}}`, String(value))
    }
    return text
  }
}

export const LANGUAGES: { id: Language; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'it', label: 'Italiano' }
]
