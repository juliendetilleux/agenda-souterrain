import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MessageSquare, Send, Trash2, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatDistanceToNow } from 'date-fns'
import { fr, enUS, nl, de } from 'date-fns/locale'
import type { Locale } from 'date-fns'
import toast from 'react-hot-toast'
import { calendarApi } from '../../api/calendars'
import { useAuthStore } from '../../store/authStore'
import type { EventComment } from '../../types'

interface Props {
  calendarId: string
  eventId: string
  sourceLang: string
  canPost: boolean
  canModerate: boolean
}

const DATE_LOCALES: Record<string, Locale> = { fr, en: enUS, nl, de }

function getTranslatedContent(
  comment: EventComment,
  targetLang: string,
  sourceLang: string,
): string {
  if (targetLang === sourceLang) return comment.content
  return comment.translations?.[targetLang]?.content ?? comment.content
}

export default function ChatSection({
  calendarId, eventId, sourceLang, canPost, canModerate,
}: Props) {
  const { t, i18n } = useTranslation('events')
  const targetLang = i18n.language.slice(0, 2)
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [newMessage, setNewMessage] = useState('')
  const translatingRef = useRef(new Set<string>())

  const queryKey = ['comments', calendarId, eventId]

  const { data: comments = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => calendarApi.getComments(calendarId, eventId),
    refetchInterval: 30_000,
  })

  // Auto-scroll to bottom when new comments arrive
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [comments.length])

  // Auto-translate comments
  useEffect(() => {
    if (targetLang === sourceLang) return
    const untranslated = comments.filter(
      (c) => !c.translations?.[targetLang] && !translatingRef.current.has(c.id)
    )
    untranslated.forEach((comment) => {
      translatingRef.current.add(comment.id)
      calendarApi
        .translateComment(calendarId, eventId, comment.id, targetLang, sourceLang)
        .then((data) => {
          qc.setQueryData<EventComment[]>(queryKey, (old) => {
            if (!old) return old
            return old.map((c) =>
              c.id !== comment.id
                ? c
                : { ...c, translations: { ...c.translations, [targetLang]: data } }
            )
          })
        })
        .catch(() => {})
        .finally(() => translatingRef.current.delete(comment.id))
    })
  }, [targetLang, comments, sourceLang, calendarId, eventId, qc]) // eslint-disable-line react-hooks/exhaustive-deps

  const createMutation = useMutation({
    mutationFn: (content: string) =>
      calendarApi.createComment(calendarId, eventId, content),
    onSuccess: () => {
      setNewMessage('')
      qc.invalidateQueries({ queryKey })
    },
    onError: () => toast.error(t('chat.sendError')),
  })

  const deleteMutation = useMutation({
    mutationFn: (commentId: string) =>
      calendarApi.deleteComment(calendarId, eventId, commentId),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
    onError: () => toast.error(t('chat.deleteError')),
  })

  const handleSend = () => {
    if (!newMessage.trim()) return
    createMutation.mutate(newMessage.trim())
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const dateLocale = DATE_LOCALES[targetLang] || fr

  return (
    <div className="bg-stone-50 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <MessageSquare size={15} className="text-stone-400 flex-shrink-0" />
        <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
          {t('chat.title')}
        </span>
        {comments.length > 0 && (
          <span className="text-[10px] font-medium text-stone-300 ml-auto">
            {comments.length}
          </span>
        )}
      </div>

      {/* Messages list */}
      <div
        ref={scrollRef}
        className="max-h-48 overflow-y-auto space-y-2 pr-1"
      >
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 size={16} className="animate-spin text-stone-300" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-xs text-stone-300 text-center py-2">
            {t('chat.empty')}
          </p>
        ) : (
          comments.map((comment) => {
            const isOwn = user?.id === comment.user_id
            const canDelete = canModerate || isOwn
            return (
              <div key={comment.id} className="group bg-white rounded-lg px-3 py-2 border border-stone-100">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-stone-700">
                    {comment.user_name}
                  </span>
                  <span className="text-[10px] text-stone-300">
                    {formatDistanceToNow(new Date(comment.created_at), {
                      addSuffix: true,
                      locale: dateLocale,
                    })}
                  </span>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => deleteMutation.mutate(comment.id)}
                      className="ml-auto opacity-0 group-hover:opacity-100 p-0.5 text-stone-300
                                 hover:text-red-400 transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
                <p className="text-sm text-stone-600 mt-0.5 whitespace-pre-wrap">
                  {getTranslatedContent(comment, targetLang, sourceLang)}
                </p>
              </div>
            )
          })
        )}
      </div>

      {/* Input */}
      {canPost && (
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('chat.placeholder')}
            className="flex-1 text-sm rounded-lg border border-stone-200 px-3 py-2
                       bg-white focus:outline-none focus:ring-2 focus:ring-lamp-500/20
                       focus:border-lamp-500 transition-all"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={createMutation.isPending || !newMessage.trim()}
            className="p-2 rounded-lg bg-lamp-500 text-white hover:bg-lamp-600
                       disabled:opacity-50 transition-all flex-shrink-0"
          >
            {createMutation.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>
      )}
    </div>
  )
}
