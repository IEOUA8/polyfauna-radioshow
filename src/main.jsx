import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ background: '#0A0D1A', color: '#fff', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, fontFamily: 'monospace' }}>
          <div style={{ maxWidth: 600 }}>
            <p style={{ color: '#00CFFF', fontWeight: 'bold', marginBottom: 8 }}>Runtime Error</p>
            <pre style={{ color: '#ff6b6b', whiteSpace: 'pre-wrap', fontSize: 13 }}>
              {this.state.error?.message}
              {'\n'}
              {this.state.error?.stack}
            </pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
