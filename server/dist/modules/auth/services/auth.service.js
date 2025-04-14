"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = exports.AuthService = void 0;
const db_1 = require("../../../core/db");
const schema_1 = require("../../../core/db/schema");
const bcrypt = __importStar(require("bcryptjs")); // Import bcryptjs
const SALT_ROUNDS = 10; // Define salt rounds
class AuthService {
    // NOTE: This is a placeholder. Password hashing and proper error handling will be added later.
    register(userData) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('[AuthService] Registering user:', userData.username);
            // 1. Check if user already exists (by username or email)
            const existingUser = yield db_1.db.query.users.findFirst({
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
            const hashedPassword = yield bcrypt.hash(userData.password, SALT_ROUNDS);
            // 3. Insert user into database
            const newUserResult = yield db_1.db.insert(schema_1.users).values({
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
