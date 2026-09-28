import React from 'react';

interface State { hasError: boolean; error: Error | null }

export class ErrorBoundary extends React.Component<React.PropsWithChildren<object>, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 gap-4 p-8">
          <div className="text-rose-500 text-6xl">⚠</div>
          <h1 className="text-2xl font-bold text-slate-800">Что-то пошло не так</h1>
          <p className="text-slate-500 text-sm max-w-md text-center">{this.state.error?.message}</p>
          <button
            onClick={() => { window.location.href = '/'; }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            На главную
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
