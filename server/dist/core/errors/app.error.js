"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
class AppError extends Error {
    constructor(name, message) {
        super(message);
        this.name = name;
        this.message = message;
        this.name = name;
    }
}
exports.AppError = AppError;
