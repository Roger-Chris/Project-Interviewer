import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, errorMessage: error?.message || 'Unknown error' };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Caught render error:', error, info?.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false, errorMessage: '' });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-dark-950 flex items-center justify-center px-6">
          <div className="max-w-md w-full bg-dark-900 border border-rose-500/30 rounded-2xl p-8 flex flex-col items-center text-center gap-4 shadow-[0_0_40px_rgba(239,68,68,0.1)]">
            <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-extrabold text-white font-sans">Something went wrong</h2>
            <p className="text-sm text-dark-300 leading-relaxed">
              An unexpected error occurred in the application. Your session data may be preserved.
            </p>
            {this.state.errorMessage && (
              <div className="w-full text-left bg-dark-950 border border-dark-700 rounded-xl px-4 py-3">
                <span className="text-[10px] font-bold text-dark-400 uppercase tracking-widest block mb-1">Error Detail</span>
                <code className="text-xs text-rose-400 font-mono break-all">{this.state.errorMessage}</code>
              </div>
            )}
            <button
              onClick={this.handleReload}
              className="mt-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-brand-600 hover:bg-brand-500 transition-all duration-300"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
