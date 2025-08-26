// Comprehensive error handling for both games
export class GameErrorHandler {
  private static instance: GameErrorHandler;
  private errorLog: Array<{ timestamp: Date; error: string; game: string; context?: any }> = [];

  static getInstance(): GameErrorHandler {
    if (!GameErrorHandler.instance) {
      GameErrorHandler.instance = new GameErrorHandler();
    }
    return GameErrorHandler.instance;
  }

  logError(error: string, game: 'jackpot' | 'coinflip', context?: any) {
    this.errorLog.push({
      timestamp: new Date(),
      error,
      game,
      context
    });
    
    // Keep only last 50 errors to prevent memory leaks
    if (this.errorLog.length > 50) {
      this.errorLog = this.errorLog.slice(-50);
    }
    
    console.error(`[${game.toUpperCase()}] ${error}`, context);
  }

  getErrors(game?: 'jackpot' | 'coinflip') {
    if (game) {
      return this.errorLog.filter(log => log.game === game);
    }
    return this.errorLog;
  }

  clearErrors() {
    this.errorLog = [];
  }

  // Timer validation utility
  static validateTimer(endTime: string | null): boolean {
    if (!endTime) return false;
    
    try {
      const targetTime = new Date(endTime).getTime();
      if (isNaN(targetTime)) return false;
      
      const now = Date.now();
      const timeDiff = targetTime - now;
      
      // Timer should be between 0 and 24 hours
      return timeDiff >= 0 && timeDiff <= 86400000;
    } catch {
      return false;
    }
  }

  // Animation state validation
  static validateAnimationState(state: any): boolean {
    if (!state || typeof state !== 'object') return false;
    
    // Check for conflicting states
    const activeStates = Object.keys(state).filter(key => 
      key.startsWith('is') && state[key] === true
    );
    
    // Maximum 2 concurrent animation states allowed
    return activeStates.length <= 2;
  }

  // Network error retry utility
  static async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        console.warn(`Operation failed (attempt ${i + 1}/${maxRetries}):`, error);
        
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
        }
      }
    }
    
    throw lastError!;
  }
}

// Global error boundary for unhandled errors
export const setupGlobalErrorHandling = () => {
  const errorHandler = GameErrorHandler.getInstance();
  
  // Catch unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    errorHandler.logError(
      'Unhandled promise rejection',
      'jackpot', // Default to jackpot, could be improved with context detection
      { reason: event.reason }
    );
  });
  
  // Catch general errors
  window.addEventListener('error', (event) => {
    errorHandler.logError(
      'Global error',
      'jackpot',
      { 
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno 
      }
    );
  });
};
