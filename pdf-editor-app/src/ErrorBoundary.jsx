import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
    this.setState({ info });
  }
  render() {
    const { error, info } = this.state;
    if (error) {
      return (
        <div style={{ padding: 24, color: '#b71c1c', background: '#fff8f8', height: '100vh', overflow: 'auto' }}>
          <h2>앱에서 오류가 발생했습니다</h2>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#b71c1c' }}>{String(error && (error.message || error))}</pre>
          {info && <details style={{ whiteSpace: 'pre-wrap' }}><summary>stack</summary><pre>{info.componentStack}</pre></details>}
        </div>
      );
    }
    return this.props.children;
  }
}
