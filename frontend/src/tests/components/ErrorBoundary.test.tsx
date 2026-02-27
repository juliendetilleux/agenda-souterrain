import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ErrorBoundary from '../../components/ui/ErrorBoundary'

vi.mock('../../i18n', () => ({
  default: {
    t: (key: string) => {
      const translations: Record<string, string> = {
        'errorBoundary.title': 'Something went wrong',
        'errorBoundary.message': 'The application encountered an unexpected error.',
        'errorBoundary.retry': 'Try again',
        'errorBoundary.reload': 'Reload page',
      }
      return translations[key] ?? key
    },
  },
}))

function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Test error')
  return <div>Content works</div>
}

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <div>Hello</div>
      </ErrorBoundary>
    )
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('shows error UI when child throws', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('Try again')).toBeInTheDocument()
    expect(screen.getByText('Reload page')).toBeInTheDocument()
    consoleSpy.mockRestore()
  })

  it('recovers when retry is clicked and error is fixed', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const errorControl = { shouldThrow: true }

    function ThrowOnDemand() {
      if (errorControl.shouldThrow) throw new Error('Test error')
      return <div>Content works</div>
    }

    render(
      <ErrorBoundary>
        <ThrowOnDemand />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()

    errorControl.shouldThrow = false
    fireEvent.click(screen.getByText('Try again'))

    expect(screen.getByText('Content works')).toBeInTheDocument()
    consoleSpy.mockRestore()
  })
})
