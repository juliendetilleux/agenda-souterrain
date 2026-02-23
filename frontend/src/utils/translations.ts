import type { EventComment } from '../types'

export function getTranslatedContent(
  comment: EventComment,
  targetLang: string,
  sourceLang: string,
): string {
  if (targetLang === sourceLang) return comment.content
  return comment.translations?.[targetLang]?.content ?? comment.content
}
