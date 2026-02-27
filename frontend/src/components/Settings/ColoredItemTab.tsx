import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2, Pencil, Check, X } from 'lucide-react'
import { useConfirm } from '../../hooks/useConfirm'
import ConfirmModal from '../ui/ConfirmModal'
import type { CalendarConfig } from '../../types'
import toast from 'react-hot-toast'

const COLORS = [
  '#e17055', '#00b894', '#fdcb6e', '#6c5ce7',
  '#fd79a8', '#00cec9', '#a29bfe', '#3788d8',
  '#e84393', '#55efc4', '#fab1a0', '#74b9ff',
]

const inputClass =
  'w-full text-sm rounded-lg border border-stone-200 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-lamp-500/20 focus:border-lamp-500 transition-all placeholder:text-stone-300'

export interface ColoredItem {
  id: string
  name: string
  color: string
}

interface ColoredItemTabProps<T extends ColoredItem> {
  calendar: CalendarConfig
  queryKey: string
  i18nPrefix: string
  fetchItems: (calId: string) => Promise<T[]>
  createItem: (calId: string, data: { name: string; color: string }) => Promise<T>
  updateItem: (calId: string, itemId: string, data: { name?: string; color?: string }) => Promise<T>
  deleteItem: (calId: string, itemId: string) => Promise<unknown>
}

export default function ColoredItemTab<T extends ColoredItem>({
  calendar,
  queryKey,
  i18nPrefix,
  fetchItems,
  createItem,
  updateItem,
  deleteItem,
}: ColoredItemTabProps<T>) {
  const { t } = useTranslation('settings')
  const { t: tc } = useTranslation('common')
  const qc = useQueryClient()
  const { confirmState, confirm, handleConfirm, handleCancel } = useConfirm()
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(COLORS[0])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')

  const { data: items = [], isLoading } = useQuery({
    queryKey: [queryKey, calendar.id],
    queryFn: () => fetchItems(calendar.id),
  })

  const createMutation = useMutation({
    mutationFn: () => createItem(calendar.id, { name: newName, color: newColor }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [queryKey, calendar.id] })
      setNewName('')
      toast.success(t(`${i18nPrefix}.toast.created`))
    },
    onError: () => toast.error(t(`${i18nPrefix}.toast.createError`)),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; color?: string } }) =>
      updateItem(calendar.id, id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [queryKey, calendar.id] })
      setEditingId(null)
      toast.success(t(`${i18nPrefix}.toast.updated`))
    },
    onError: () => toast.error(t(`${i18nPrefix}.toast.updateError`)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteItem(calendar.id, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [queryKey, calendar.id] })
      toast.success(t(`${i18nPrefix}.toast.deleted`))
    },
    onError: () => toast.error(t(`${i18nPrefix}.toast.deleteError`)),
  })

  const startEdit = (item: ColoredItem) => {
    setEditingId(item.id)
    setEditName(item.name)
    setEditColor(item.color)
  }

  const saveEdit = () => {
    if (!editingId || !editName.trim()) return
    updateMutation.mutate({ id: editingId, data: { name: editName.trim(), color: editColor } })
  }

  if (isLoading) {
    return <p className="text-sm text-stone-400 py-8 text-center">{tc('loading')}</p>
  }

  return (
    <>
      {confirmState && (
        <ConfirmModal
          title={confirmState.title}
          message={confirmState.message}
          danger
          confirmLabel={tc('delete')}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}

      <div className="space-y-4">
        {items.length === 0 ? (
          <p className="text-sm text-stone-400 py-4 text-center">{t(`${i18nPrefix}.empty`)}</p>
        ) : (
          <div className="space-y-1">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-stone-50 group transition-colors"
              >
                {editingId === item.id ? (
                  <>
                    <div className="flex gap-1 flex-shrink-0">
                      {COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => setEditColor(c)}
                          className={`w-5 h-5 rounded-full transition-all ${
                            editColor === c ? 'ring-2 ring-offset-1 ring-stone-400 scale-110' : ''
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <input
                      autoFocus
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                      className={`${inputClass} flex-1`}
                    />
                    <button
                      onClick={saveEdit}
                      disabled={!editName.trim()}
                      className="p-1 rounded hover:bg-green-50 text-green-500 disabled:opacity-40"
                    >
                      <Check size={15} />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-1 rounded hover:bg-stone-100 text-stone-400"
                    >
                      <X size={15} />
                    </button>
                  </>
                ) : (
                  <>
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm text-stone-700 flex-1 font-medium">{item.name}</span>
                    <button
                      onClick={() => startEdit(item)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-stone-100 text-stone-400 transition-all"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() =>
                        confirm(
                          t(`${i18nPrefix}.deleteTitle`),
                          t(`${i18nPrefix}.deleteMsg`, { name: item.name }),
                          () => deleteMutation.mutate(item.id)
                        )
                      }
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-red-400 transition-all"
                    >
                      <Trash2 size={13} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="bg-stone-50 rounded-xl p-4 space-y-3">
          <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
            {t(`${i18nPrefix}.newItem`)}
          </h4>
          <div className="flex gap-1.5 flex-wrap">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className={`w-6 h-6 rounded-full transition-all ${
                  newColor === c ? 'ring-2 ring-offset-1 ring-stone-400 scale-110' : 'hover:scale-105'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (newName.trim()) createMutation.mutate()
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t(`${i18nPrefix}.namePlaceholder`)}
              className={`${inputClass} flex-1`}
            />
            <button
              type="submit"
              disabled={!newName.trim() || createMutation.isPending}
              className="px-4 py-2 text-sm bg-lamp-500 text-white rounded-lg hover:bg-lamp-600
                         font-semibold disabled:opacity-50 transition-all"
            >
              {tc('create')}
            </button>
          </form>
        </div>
      </div>
    </>
  )
}
