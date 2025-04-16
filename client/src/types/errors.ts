/**
 * Basic error class for application-specific errors, mirroring common structure.
 */
export class AppError extends Error {
    status: string | number; // HTTP status code or custom error code

    constructor(status: string | number, message: string) {
        super(message);
        this.status = status;
        this.name = 'AppError'; // Set the error name
    }
} 