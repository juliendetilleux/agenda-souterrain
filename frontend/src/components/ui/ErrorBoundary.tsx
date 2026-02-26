import { Component, type ErrorInfo, type ReactNode } from 'react'
import i18n from '../../i18n'

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

  handleRetry = () => {
    this.setState({ hasError: false })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const t = (key: string) => i18n.t(`errorBoundary.${key}`, { ns: 'common' })

    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '100vh', padding: 24,
        fontFamily: 'sans-serif', textAlign: 'center',
      }}>
        <h1 style={{ fontSize: 24, marginBottom: 8, color: '#292524' }}>
          {t('title')}
        </h1>
        <p style={{ color: '#78716c', marginBottom: 24 }}>
          {t('message')}
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={this.handleRetry}
            style={{
              background: '#f59e0b', color: 'white', border: 'none',
              padding: '10px 24px', borderRadius: 8, fontSize: 16,
              cursor: 'pointer', fontWeight: 600,
            }}
          >
            {t('retry')}
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: 'transparent', color: '#78716c', border: '1px solid #d6d3d1',
              padding: '10px 24px', borderRadius: 8, fontSize: 16,
              cursor: 'pointer', fontWeight: 500,
            }}
          >
            {t('reload')}
          </button>
        </div>
      </div>
    )
  }
}
