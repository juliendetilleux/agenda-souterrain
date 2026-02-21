import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

const LANGUAGES = [
  { code: 'fr', label: 'FR' },
  { code: 'en', label: 'EN' },
  { code: 'nl', label: 'NL' },
  { code: 'de', label: 'DE' },
]

interface Props {
  variant?: 'light' | 'dark'
}

export default function LanguageSwitcher({ variant = 'light' }: Props) {
  const { i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const currentLang = LANGUAGES.find((l) => i18n.language.startsWith(l.code))?.label ?? 'FR'

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const baseBtn = variant === 'dark'
    ? 'text-cave-text hover:text-cave-text-active hover:bg-cave-800'
    : 'text-stone-500 hover:text-stone-700 hover:bg-stone-100'

  const dropdownBg = variant === 'dark' ? 'bg-cave-800 border-cave-700' : 'bg-white border-stone-200'
  const dropdownItem = variant === 'dark'
    ? 'text-cave-text hover:bg-cave-700 hover:text-cave-text-active'
    : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
  const activeItem = variant === 'dark'
    ? 'bg-lamp-500/20 text-lamp-400 font-semibold'
    : 'bg-lamp-50 text-lamp-600 font-semibold'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`px-2 py-1 text-xs font-medium rounded-lg border transition-colors ${
          variant === 'dark' ? 'border-cave-700' : 'border-stone-200'
        } ${baseBtn}`}
      >
        {currentLang}
      </button>
      {open && (
        <div className={`absolute right-0 top-full mt-1 rounded-lg border shadow-lg z-50 overflow-hidden ${dropdownBg}`}>
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => { i18n.changeLanguage(lang.code); setOpen(false) }}
              className={`block w-full px-4 py-1.5 text-xs text-left transition-colors ${
                i18n.language.startsWith(lang.code) ? activeItem : dropdownItem
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
