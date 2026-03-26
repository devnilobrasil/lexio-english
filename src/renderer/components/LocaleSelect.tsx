// src/renderer/components/LocaleSelect.tsx
import React from 'react'
import * as Select from '@radix-ui/react-select'
import 'flag-icons/css/flag-icons.min.css'
import { useLocale } from '../hooks/useLocale'
import type { Locale } from '../../types'

const LOCALE_OPTIONS: { value: Locale; countryCode: string; label: string }[] = [
  { value: 'pt-BR', countryCode: 'br', label: 'Português' },
  { value: 'es',    countryCode: 'es', label: 'Español'   },
]

export function LocaleSelect() {
  const { locale, setLocale } = useLocale()
  const active = LOCALE_OPTIONS.find(o => o.value === locale) ?? LOCALE_OPTIONS[0]

  return (
    <Select.Root value={locale} onValueChange={(v) => setLocale(v as Locale)}>
      <Select.Trigger
        aria-label="Interface language"
        data-testid="locale-trigger"
        className="flex items-center justify-center w-7 h-7 rounded-sm bg-transparent border border-transparent hover:border-border-subtle hover:bg-surface-hover transition-colors cursor-pointer focus:outline-none"
      >
        <Select.Value asChild>
          <span className={`fi fi-${active.countryCode} fis text-lg leading-none rounded-full`} />
        </Select.Value>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={6}
          className="bg-surface-raised border border-border-subtle rounded-md py-1 z-50 w-10"
        >
          <Select.Viewport>
            {LOCALE_OPTIONS.map(opt => (
              <Select.Item
                key={opt.value}
                value={opt.value}
                data-testid={`locale-option-${opt.value}`}
                className="flex items-center justify-center px-2 py-2 cursor-pointer hover:bg-surface-hover focus:bg-surface-hover focus:outline-none transition-colors"
              >
                <span className={`fi fi-${opt.countryCode} fis text-lg leading-none rounded-full`} />
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}
