import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '100vh', padding: 24,
        fontFamily: 'sans-serif', textAlign: 'center',
      }}>
        <h1 style={{ fontSize: 24, marginBottom: 8, color: '#292524' }}>
          Une erreur est survenue
        </h1>
        <p style={{ color: '#78716c', marginBottom: 24 }}>
          L'application a rencontré un problème inattendu.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            background: '#f59e0b', color: 'white', border: 'none',
            padding: '10px 24px', borderRadius: 8, fontSize: 16,
            cursor: 'pointer', fontWeight: 600,
          }}
        >
          Recharger
        </button>
      </div>
    )
  }
}
