import React, { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('OrbitGuard UI Error caught by boundary:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full min-h-[300px] flex items-center justify-center p-6 bg-space-950/90 text-slate-200">
          <div className="glass-panel p-6 rounded-xl max-w-md w-full border border-rose-500/30 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-4 border border-rose-500/40">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-rose-300 font-mono mb-2">
              Viewport Rendering Interrupted
            </h3>
            <p className="text-xs text-slate-400 font-mono mb-4">
              An unexpected error occurred during graphical rendering or telemetry evaluation.
            </p>
            {this.state.error && (
              <pre className="text-[10px] text-rose-400 bg-space-950/80 p-2.5 rounded border border-rose-900/50 text-left overflow-x-auto mb-4 font-mono max-h-24">
                {String(this.state.error.message || this.state.error)}
              </pre>
            )}
            <button
              onClick={this.handleReload}
              className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-semibold flex items-center gap-2 mx-auto transition shadow-glow-cyan"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reload OrbitGuard</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
