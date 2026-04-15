import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[AppErrorBoundary] Runtime error captured.', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
          <div className="flex items-center gap-3 text-red-600">
            <AlertTriangle className="h-6 w-6" />
            <h1 className="text-lg font-semibold">Ocorreu um erro inesperado</h1>
          </div>
          <p className="mt-4 text-sm text-slate-600">
            A aplicacao interrompeu este fluxo para evitar dados inconsistentes. Recarregue a pagina e tente novamente.
          </p>
          {this.state.error?.message && (
            <div className="mt-4 rounded-lg bg-slate-100 p-3 text-xs text-slate-700">
              {this.state.error.message}
            </div>
          )}
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#07593f] px-4 py-2 text-sm font-medium text-white hover:bg-[#064b35]"
          >
            <RefreshCw className="h-4 w-4" />
            Recarregar aplicacao
          </button>
        </div>
      </div>
    );
  }
}