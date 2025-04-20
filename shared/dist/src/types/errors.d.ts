/**
 * Basic error class for application-specific errors, mirroring common structure.
 */
export declare class AppError extends Error {
    status: string | number;
    constructor(status: string | number, message: string);
}
//# sourceMappingURL=errors.d.ts.map