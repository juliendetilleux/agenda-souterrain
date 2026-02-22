import { describe, it, expect } from 'vitest'
import {
  canReadLimited, canRead, canAdd, canModifyOwn, canModify, isAdmin,
  PERMISSION_LABELS,
} from '../utils/permissions'
import { formatDtstart, computeDuration } from '../utils/dateHelpers'
import type { Permission } from '../types'

// ─── Permission hierarchy ─────────────────────────────────────────────────

describe('permission utilities', () => {
  it('no_access cannot read', () => {
    expect(canReadLimited('no_access')).toBe(false)
    expect(canRead('no_access')).toBe(false)
    expect(canAdd('no_access')).toBe(false)
  })

  it('read_only_no_details can read limited but not full', () => {
    expect(canReadLimited('read_only_no_details')).toBe(true)
    expect(canRead('read_only_no_details')).toBe(false)
  })

  it('read_only can read but not add', () => {
    expect(canRead('read_only')).toBe(true)
    expect(canAdd('read_only')).toBe(false)
  })

  it('add_only can add but not modify', () => {
    expect(canAdd('add_only')).toBe(true)
    expect(canModifyOwn('add_only')).toBe(false)
  })

  it('modify_own can modify own but not all', () => {
    expect(canModifyOwn('modify_own')).toBe(true)
    expect(canModify('modify_own')).toBe(false)
  })

  it('modify can modify all', () => {
    expect(canModify('modify')).toBe(true)
  })

  it('administrator is admin', () => {
    expect(isAdmin('administrator')).toBe(true)
    expect(isAdmin('modify')).toBe(false)
  })

  it('all permissions have labels', () => {
    const perms: Permission[] = [
      'no_access', 'read_only_no_details', 'read_only',
      'add_only', 'modify_own', 'modify', 'administrator',
    ]
    for (const p of perms) {
      expect(PERMISSION_LABELS[p]).toBeTruthy()
    }
  })
})

// ─── Date helpers ────────────────────────────────────────────────────────

describe('formatDtstart', () => {
  it('formats timed event correctly', () => {
    expect(formatDtstart('2025-06-15T10:30:00', false)).toBe('20250615T103000')
  })

  it('formats all-day event correctly', () => {
    const result = formatDtstart('2025-06-15T00:00:00', true)
    expect(result).toBe('20250615')
  })

  it('formats midnight correctly', () => {
    expect(formatDtstart('2025-01-01T00:00:00', false)).toBe('20250101T000000')
  })
})

describe('computeDuration', () => {
  it('computes 1 hour duration', () => {
    expect(computeDuration('2025-06-15T10:00:00', '2025-06-15T11:00:00')).toBe('01:00')
  })

  it('computes 30 min duration', () => {
    expect(computeDuration('2025-06-15T10:00:00', '2025-06-15T10:30:00')).toBe('00:30')
  })

  it('computes zero duration for same start and end', () => {
    expect(computeDuration('2025-06-15T10:00:00', '2025-06-15T10:00:00')).toBe('00:00')
  })

  it('computes multi-hour duration', () => {
    expect(computeDuration('2025-06-15T09:00:00', '2025-06-15T12:30:00')).toBe('03:30')
  })
})

// ─── Auto timezone detection ──────────────────────────────────────────────

describe('auto timezone', () => {
  it('Intl.DateTimeFormat returns a non-empty timezone string', () => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    expect(typeof tz).toBe('string')
    expect(tz.length).toBeGreaterThan(0)
  })
})

// ─── File size formatting ────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

function isImage(mimeType: string): boolean {
  return mimeType.startsWith('image/')
}

function isPdf(mimeType: string): boolean {
  return mimeType === 'application/pdf'
}

describe('formatFileSize', () => {
  it('formats bytes', () => {
    expect(formatFileSize(500)).toBe('500 o')
  })

  it('formats kilobytes', () => {
    expect(formatFileSize(2048)).toBe('2.0 Ko')
  })

  it('formats megabytes', () => {
    expect(formatFileSize(5242880)).toBe('5.0 Mo')
  })

  it('formats zero', () => {
    expect(formatFileSize(0)).toBe('0 o')
  })
})

describe('file type detection', () => {
  it('isImage detects jpeg', () => {
    expect(isImage('image/jpeg')).toBe(true)
  })

  it('isImage rejects pdf', () => {
    expect(isImage('application/pdf')).toBe(false)
  })

  it('isPdf detects pdf', () => {
    expect(isPdf('application/pdf')).toBe(true)
  })

  it('isPdf rejects image', () => {
    expect(isPdf('image/png')).toBe(false)
  })
})

// ─── Chat translation helper ─────────────────────────────────────────────

interface MockComment {
  content: string
  translations: Record<string, { content: string }> | null
}

function getTranslatedContent(
  comment: MockComment,
  targetLang: string,
  sourceLang: string,
): string {
  if (targetLang === sourceLang) return comment.content
  return comment.translations?.[targetLang]?.content ?? comment.content
}

describe('getTranslatedContent', () => {
  it('returns original when same language', () => {
    const comment: MockComment = { content: 'Bonjour', translations: null }
    expect(getTranslatedContent(comment, 'fr', 'fr')).toBe('Bonjour')
  })

  it('returns translated when available', () => {
    const comment: MockComment = {
      content: 'Bonjour',
      translations: { en: { content: 'Hello' } },
    }
    expect(getTranslatedContent(comment, 'en', 'fr')).toBe('Hello')
  })

  it('returns original when translation not available', () => {
    const comment: MockComment = { content: 'Bonjour', translations: null }
    expect(getTranslatedContent(comment, 'en', 'fr')).toBe('Bonjour')
  })
})
