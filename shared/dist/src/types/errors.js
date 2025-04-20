"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
/**
 * Basic error class for application-specific errors, mirroring common structure.
 */
class AppError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
        this.name = 'AppError'; // Set the error name
    }
}
exports.AppError = AppError;
