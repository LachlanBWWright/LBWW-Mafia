/**
 * Error handling utilities for MERN Mafia
 */

/**
 * Custom error classes for different error types
 */

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTH_REQUIRED');
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'AuthorizationError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public fields?: Record<string, string>) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource already exists') {
    super(message, 409, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter?: number) {
    super('Too many requests. Please try again later.', 429, 'RATE_LIMIT');
    this.name = 'RateLimitError';
    if (retryAfter) {
      (this as any).retryAfter = retryAfter;
    }
  }
}

/**
 * Error handler for API routes
 */
export function handleApiError(error: unknown): {
  message: string;
  statusCode: number;
  code?: string;
  fields?: Record<string, string>;
} {
  // Handle AppError instances
  if (error instanceof AppError) {
    return {
      message: error.message,
      statusCode: error.statusCode,
      code: error.code,
      ...(error instanceof ValidationError && error.fields ? { fields: error.fields } : {}),
    };
  }

  // Handle Prisma errors
  if (error && typeof error === 'object' && 'code' in error) {
    const prismaError = error as { code: string; meta?: any };
    
    switch (prismaError.code) {
      case 'P2002':
        return {
          message: 'A record with this value already exists',
          statusCode: 409,
          code: 'UNIQUE_CONSTRAINT',
        };
      case 'P2025':
        return {
          message: 'Record not found',
          statusCode: 404,
          code: 'NOT_FOUND',
        };
      case 'P2003':
        return {
          message: 'Foreign key constraint failed',
          statusCode: 400,
          code: 'FOREIGN_KEY_CONSTRAINT',
        };
      default:
        return {
          message: 'Database error occurred',
          statusCode: 500,
          code: 'DATABASE_ERROR',
        };
    }
  }

  // Handle generic errors
  if (error instanceof Error) {
    return {
      message: error.message,
      statusCode: 500,
      code: 'INTERNAL_ERROR',
    };
  }

  // Unknown error
  return {
    message: 'An unexpected error occurred',
    statusCode: 500,
    code: 'UNKNOWN_ERROR',
  };
}

/**
 * Async error wrapper for route handlers
 */
export function asyncHandler<T extends (...args: any[]) => Promise<any>>(
  fn: T
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    try {
      return await fn(...args);
    } catch (error) {
      throw handleApiError(error);
    }
  };
}

/**
 * Error logger
 */
export function logError(error: unknown, context?: Record<string, any>): void {
  const errorInfo = {
    timestamp: new Date().toISOString(),
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : error,
    context,
  };

  // In production, send to error tracking service (Sentry, etc.)
  if (process.env.NODE_ENV === 'production') {
    // TODO: Integrate with error tracking service
    console.error('[Production Error]', JSON.stringify(errorInfo, null, 2));
  } else {
    console.error('[Development Error]', errorInfo);
  }
}

/**
 * User-friendly error messages
 */
export const ERROR_MESSAGES = {
  AUTH_REQUIRED: 'Please sign in to continue',
  AUTH_EXPIRED: 'Your session has expired. Please sign in again',
  AUTH_INVALID: 'Invalid credentials',
  FORBIDDEN: 'You do not have permission to perform this action',
  NOT_FOUND: 'The requested resource was not found',
  VALIDATION_ERROR: 'Please check your input and try again',
  RATE_LIMIT: 'Too many requests. Please slow down',
  NETWORK_ERROR: 'Network error. Please check your connection',
  SERVER_ERROR: 'Something went wrong on our end. Please try again',
  ROOM_FULL: 'This game room is full',
  ROOM_NOT_FOUND: 'Game room not found',
  ALREADY_IN_GAME: 'You are already in a game',
  GAME_IN_PROGRESS: 'This game is already in progress',
  INVALID_ROOM_CODE: 'Invalid room code',
};

/**
 * Get user-friendly error message
 */
export function getUserFriendlyError(error: unknown): string {
  if (error instanceof AppError && error.code) {
    return ERROR_MESSAGES[error.code as keyof typeof ERROR_MESSAGES] || error.message;
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return ERROR_MESSAGES.SERVER_ERROR;
}

/**
 * Retry utility for failed operations
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    delay?: number;
    backoff?: boolean;
  } = {}
): Promise<T> {
  const { maxAttempts = 3, delay = 1000, backoff = true } = options;
  
  let lastError: unknown;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxAttempts) {
        const waitTime = backoff ? delay * Math.pow(2, attempt - 1) : delay;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  throw lastError;
}
