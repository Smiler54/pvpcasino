import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Bug } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    errorId: ''
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null,
      errorId: Date.now().toString(36)
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
      errorId: Date.now().toString(36)
    });

    // Call the optional error handler
    this.props.onError?.(error, errorInfo);

    // Store error info globally for debugging
    (window as any).lastError = {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      errorInfo,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };
  }

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    });
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Card className="max-w-2xl mx-auto mt-8 border-destructive/20 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Something went wrong
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              <p>An unexpected error occurred. This might be due to:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Network connectivity issues</li>
                <li>Browser compatibility problems</li>
                <li>Temporary server issues</li>
                <li>Race conditions in game state</li>
              </ul>
            </div>

            {this.state.error && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  Technical Details (Error ID: {this.state.errorId})
                </summary>
                <div className="mt-2 p-3 bg-muted rounded-md font-mono text-xs">
                  <div className="text-destructive font-semibold">
                    {this.state.error.name}: {this.state.error.message}
                  </div>
                  {this.state.error.stack && (
                    <pre className="mt-2 text-xs overflow-auto max-h-40">
                      {this.state.error.stack}
                    </pre>
                  )}
                </div>
              </details>
            )}

            <div className="flex gap-3">
              <Button onClick={this.handleRetry} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
              <Button onClick={this.handleReload} variant="outline" size="sm">
                <Bug className="h-4 w-4 mr-2" />
                Reload Page
              </Button>
            </div>

            <div className="text-xs text-muted-foreground">
              If this problem persists, please try refreshing the page or clearing your browser cache.
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}