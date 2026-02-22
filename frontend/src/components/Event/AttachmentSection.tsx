import { useState, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Paperclip, Upload, Trash2, FileText, Image, File as FileIcon, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { calendarApi } from '../../api/calendars'
import { useAuthStore } from '../../store/authStore'
import type { EventAttachment } from '../../types'

interface Props {
  calendarId: string
  eventId: string
  canUpload: boolean
  canModerate: boolean
}

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

function getFileIcon(mimeType: string) {
  if (isImage(mimeType)) return Image
  if (isPdf(mimeType)) return FileText
  return FileIcon
}

export default function AttachmentSection({
  calendarId, eventId, canUpload, canModerate,
}: Props) {
  const { t } = useTranslation('events')
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const queryKey = ['attachments', calendarId, eventId]

  const { data: attachments = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => calendarApi.getAttachments(calendarId, eventId),
  })

  const uploadMutation = useMutation({
    mutationFn: (file: File) =>
      calendarApi.uploadAttachment(calendarId, eventId, file),
    onSuccess: () => {
      toast.success(t('attachments.uploaded'))
      qc.invalidateQueries({ queryKey })
    },
    onError: () => toast.error(t('attachments.uploadError')),
  })

  const deleteMutation = useMutation({
    mutationFn: (attachmentId: string) =>
      calendarApi.deleteAttachment(calendarId, eventId, attachmentId),
    onSuccess: () => {
      toast.success(t('attachments.deleted'))
      qc.invalidateQueries({ queryKey })
    },
    onError: () => toast.error(t('attachments.deleteError')),
  })

  const handleFiles = useCallback((files: FileList | File[]) => {
    Array.from(files).forEach((file) => {
      uploadMutation.mutate(file)
    })
  }, [uploadMutation])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (canUpload) setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    if (!canUpload) return
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files)
    }
  }

  const fileUrl = (storedFilename: string) => `/v1/uploads/${storedFilename}`

  return (
    <div
      className={`bg-stone-50 rounded-xl p-4 space-y-3 transition-all ${
        isDragOver ? 'ring-2 ring-lamp-400 ring-offset-2 bg-lamp-50' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex items-center gap-2">
        <Paperclip size={15} className="text-stone-400 flex-shrink-0" />
        <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
          {t('attachments.title')}
        </span>
        {attachments.length > 0 && (
          <span className="text-[10px] font-medium text-stone-300 ml-auto">
            {attachments.length}
          </span>
        )}
      </div>

      {/* File list */}
      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 size={16} className="animate-spin text-stone-300" />
        </div>
      ) : attachments.length > 0 ? (
        <div className="space-y-2">
          {attachments.map((att) => {
            const isOwn = user?.id === att.user_id
            const canDelete = canModerate || isOwn
            const IconComponent = getFileIcon(att.mime_type)

            return (
              <div key={att.id} className="group flex items-center gap-3 bg-white rounded-lg px-3 py-2 border border-stone-100">
                {/* Thumbnail or icon */}
                {isImage(att.mime_type) ? (
                  <a href={fileUrl(att.stored_filename)} target="_blank" rel="noopener noreferrer">
                    <img
                      src={fileUrl(att.stored_filename)}
                      alt={att.original_filename}
                      className="w-10 h-10 rounded object-cover flex-shrink-0 cursor-pointer
                                 hover:opacity-80 transition-opacity"
                    />
                  </a>
                ) : (
                  <a
                    href={fileUrl(att.stored_filename)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0"
                  >
                    <IconComponent size={20} className="text-stone-400" />
                  </a>
                )}

                {/* File info */}
                <div className="flex-1 min-w-0">
                  <a
                    href={fileUrl(att.stored_filename)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-stone-700 truncate block
                               hover:text-lamp-600 transition-colors"
                  >
                    {att.original_filename}
                  </a>
                  <span className="text-[10px] text-stone-300">
                    {formatFileSize(att.file_size)} &middot; {att.user_name}
                  </span>
                </div>

                {/* Delete button */}
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate(att.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-stone-300
                               hover:text-red-400 transition-all flex-shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      ) : null}

      {/* Upload zone */}
      {canUpload && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
            className={`w-full py-3 border-2 border-dashed rounded-lg text-xs text-stone-400
                       hover:border-lamp-400 hover:text-lamp-600 hover:bg-lamp-50
                       transition-all flex items-center justify-center gap-2 ${
                         isDragOver ? 'border-lamp-400 text-lamp-600 bg-lamp-50' : 'border-stone-200'
                       }`}
          >
            {uploadMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Upload size={14} />
            )}
            {t('attachments.dropOrClick')}
          </button>
        </>
      )}
    </div>
  )
}
