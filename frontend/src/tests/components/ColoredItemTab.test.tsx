import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ColoredItemTab from '../../components/Settings/ColoredItemTab'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'fr' },
  }),
}))

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('../../hooks/useConfirm', () => ({
  useConfirm: () => ({
    confirmState: null,
    confirm: vi.fn(),
    handleConfirm: vi.fn(),
    handleCancel: vi.fn(),
  }),
}))

const mockItems = [
  { id: '1', name: 'Item A', color: '#e17055' },
  { id: '2', name: 'Item B', color: '#00b894' },
]

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

describe('ColoredItemTab', () => {
  it('renders items from fetch', async () => {
    const fetchItems = vi.fn().mockResolvedValue(mockItems)

    renderWithQuery(
      <ColoredItemTab
        calendar={{ id: 'cal-1' } as any}
        queryKey="test-items"
        i18nPrefix="test"
        fetchItems={fetchItems}
        createItem={vi.fn()}
        updateItem={vi.fn()}
        deleteItem={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Item A')).toBeInTheDocument()
      expect(screen.getByText('Item B')).toBeInTheDocument()
    })
  })

  it('shows empty message when no items', async () => {
    const fetchItems = vi.fn().mockResolvedValue([])

    renderWithQuery(
      <ColoredItemTab
        calendar={{ id: 'cal-1' } as any}
        queryKey="test-empty"
        i18nPrefix="test"
        fetchItems={fetchItems}
        createItem={vi.fn()}
        updateItem={vi.fn()}
        deleteItem={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('test.empty')).toBeInTheDocument()
    })
  })

  it('creates item on form submit', async () => {
    const fetchItems = vi.fn().mockResolvedValue([])
    const createItem = vi.fn().mockResolvedValue({ id: '3', name: 'New', color: '#e17055' })

    renderWithQuery(
      <ColoredItemTab
        calendar={{ id: 'cal-1' } as any}
        queryKey="test-create"
        i18nPrefix="test"
        fetchItems={fetchItems}
        createItem={createItem}
        updateItem={vi.fn()}
        deleteItem={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('test.empty')).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText('test.namePlaceholder')
    fireEvent.change(input, { target: { value: 'New Item' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => {
      expect(createItem).toHaveBeenCalledWith('cal-1', { name: 'New Item', color: '#e17055' })
    })
  })
})
