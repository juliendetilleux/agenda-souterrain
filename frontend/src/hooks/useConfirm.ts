import { useState, useCallback } from 'react'

interface ConfirmState {
  title: string
  message: string
  onConfirm: () => void
}

export function useConfirm() {
  const [state, setState] = useState<ConfirmState | null>(null)

  const confirm = useCallback(
    (title: string, message: string, onConfirm: () => void) => {
      setState({ title, message, onConfirm })
    },
    []
  )

  const handleConfirm = useCallback(() => {
    state?.onConfirm()
    setState(null)
  }, [state])

  const handleCancel = useCallback(() => {
    setState(null)
  }, [])

  return { confirmState: state, confirm, handleConfirm, handleCancel }
}
