import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-900 text-white p-6 flex items-center justify-center">
          <div className="max-w-md w-full space-y-4">
            <div className="card bg-red-900/20 animate-fadeIn">
              <h2 className="text-2xl font-bold text-red-400 mb-4">Something went wrong</h2>
              <p className="text-zinc-300 mb-4">
                We apologize for the inconvenience. Please try refreshing the page.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="w-full py-2 px-4 bg-red-600 hover:bg-red-700 rounded-md transition-colors"
              >
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary; 