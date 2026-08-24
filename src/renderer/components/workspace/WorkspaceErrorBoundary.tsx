import {
  Component,
} from 'react';

import type {
  ErrorInfo,
  ReactNode,
} from 'react';

type WorkspaceErrorBoundaryProps = {
  children: ReactNode;
};

type WorkspaceErrorBoundaryState = {
  error: Error | null;
};

export class WorkspaceErrorBoundary extends Component<
  WorkspaceErrorBoundaryProps,
  WorkspaceErrorBoundaryState
> {
  state: WorkspaceErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(
    unknownError: unknown,
  ): WorkspaceErrorBoundaryState {
    return {
      error:
        unknownError instanceof Error
          ? unknownError
          : new Error(
            'Falha desconhecida no workspace.',
          ),
    };
  }

  componentDidCatch(
    error: Error,
    errorInfo: ErrorInfo,
  ): void {
    console.error(
      '[Workspace] Exceção contida pelo Error Boundary.',
      error,
      errorInfo.componentStack,
    );
  }

  private retry = (): void => {
    this.setState({
      error: null,
    });
  };

  render(): ReactNode {
    const {
      error,
    } = this.state;

    if (!error) {
      return this.props.children;
    }

    return (
      <section
        className="workspaceErrorFallback"
        role="alert"
      >
        <span>WORKSPACE PROTEGIDO</span>
        <strong>
          O mapa encontrou uma falha inesperada.
        </strong>
        <p>{error.message}</p>
        <button
          type="button"
          onClick={this.retry}
        >
          Reabrir mapa
        </button>
      </section>
    );
  }
}
