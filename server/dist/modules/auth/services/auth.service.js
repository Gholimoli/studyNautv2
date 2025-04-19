"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = exports.AuthService = void 0;
const index_1 = require("../../../core/db/index");
const schema_1 = require("../../../core/db/schema");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const SALT_ROUNDS = 10; // Define salt rounds
class AuthService {
    // NOTE: This is a placeholder. Password hashing and proper error handling will be added later.
    register(userData) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('[AuthService] Registering user:', userData.username);
            // 1. Check if user already exists (by username or email)
            const existingUser = yield index_1.db.query.users.findFirst({
                where: (users, { or, eq }) => or(eq(users.username, userData.username), eq(users.email, userData.email)),
            });
            if (existingUser) {
                if (existingUser.username === userData.username) {
                    throw new Error('Username already exists'); // Use custom error classes later
                }
                if (existingUser.email === userData.email) {
                    throw new Error('Email already exists'); // Use custom error classes later
                }
            }
            // 2. Hash password
            const hashedPassword = yield bcryptjs_1.default.hash(userData.password, SALT_ROUNDS);
            // 3. Insert user into database
            const newUserResult = yield index_1.db.insert(schema_1.users).values({
                username: userData.username,
                email: userData.email,
                passwordHash: hashedPassword,
                displayName: userData.displayName,
                // role, createdAt, updatedAt have defaults
            }).returning({
                id: schema_1.users.id,
                username: schema_1.users.username,
                email: schema_1.users.email,
                displayName: schema_1.users.displayName,
                role: schema_1.users.role
            });
            if (!newUserResult || newUserResult.length === 0) {
                throw new Error('Failed to create user');
            }
            const newUser = newUserResult[0];
            console.log('[AuthService] User registered successfully:', newUser.username);
            // 4. Return the created user data (excluding password)
            return newUser;
        });
    }
}
exports.AuthService = AuthService;
exports.authService = new AuthService();
