export class AppError extends Error {
    public readonly statusCode: number;
    public readonly isOperational: boolean;
    public readonly metadata?: Record<string, any>;

    constructor(statusCode: number, message: string, metadata?: Record<string, any>) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        this.metadata = metadata;
        Error.captureStackTrace(this, this.constructor);
    }
}