interface ErrorInfo {
  componentStack: string
  errorBoundary?: string
  errorBoundaryStack?: string
}

interface ErrorReport {
  error: Error
  errorInfo: ErrorInfo
  timestamp: string
  userAgent: string
  url: string
  userId?: string
}

class ErrorReporter {
  private static instance: ErrorReporter
  private errors: ErrorReport[] = []
  private maxErrors = 50

  static getInstance(): ErrorReporter {
    if (!ErrorReporter.instance) {
      ErrorReporter.instance = new ErrorReporter()
    }
    return ErrorReporter.instance
  }

  reportError(error: Error, errorInfo: ErrorInfo): void {
    const report: ErrorReport = {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack || "",
      } as Error,
      errorInfo,
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      url: typeof window !== "undefined" ? window.location.href : "",
    }

    this.errors.push(report)

    // Keep only recent errors
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors)
    }

    // Log to console in development
    if (process.env.NODE_ENV === "development") {
      console.error("Error reported:", report)
    }

    // In production, you would send this to an error tracking service
    this.sendToErrorService(report)
  }

  private async sendToErrorService(report: ErrorReport): Promise<void> {
    try {
      // In a real app, send to Sentry, LogRocket, etc.
      console.log("Error report:", report)
    } catch (error) {
      console.error("Failed to send error report:", error)
    }
  }

  getErrors(): ErrorReport[] {
    return [...this.errors]
  }

  clearErrors(): void {
    this.errors = []
  }
}

export const errorReporter = ErrorReporter.getInstance()
