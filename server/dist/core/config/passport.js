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
exports.configurePassport = configurePassport;
const passport_1 = __importDefault(require("passport"));
const passport_local_1 = require("passport-local");
const index_1 = require("../db/index");
const schema_1 = require("../db/schema");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const drizzle_orm_1 = require("drizzle-orm");
function configurePassport() {
    // Local strategy for username/password login
    passport_1.default.use(new passport_local_1.Strategy((username, password, done) => __awaiter(this, void 0, void 0, function* () {
        try {
            console.log(`[Passport] Attempting login for username: ${username}`);
            // Find user by username or email
            const result = yield index_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.username, username)).limit(1);
            const user = result[0];
            if (!user) {
                console.log(`[Passport] User not found: ${username}`);
                return done(null, false, { message: 'Incorrect username or password.' });
            }
            // Compare password
            const isMatch = yield bcryptjs_1.default.compare(password, user.passwordHash);
            if (!isMatch) {
                console.log(`[Passport] Incorrect password for user: ${username}`);
                return done(null, false, { message: 'Incorrect username or password.' });
            }
            console.log(`[Passport] Login successful for user: ${username}, ID: ${user.id}`);
            return done(null, user);
        }
        catch (err) {
            console.error('[Passport] Error during authentication:', err);
            return done(err);
        }
    })));
    // Serialize user ID into the session
    passport_1.default.serializeUser((user, done) => {
        // console.log('[Passport] Serializing user:', user);
        done(null, user.id);
    });
    // Deserialize user from the session using the ID
    passport_1.default.deserializeUser((id, done) => __awaiter(this, void 0, void 0, function* () {
        try {
            // console.log(`[Passport] Deserializing user with ID: ${id}`);
            const result = yield index_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, id)).limit(1);
            const user = result[0];
            // console.log('[Passport] Deserialized user found:', user);
            done(null, user || null); // Pass null if user not found
        }
        catch (err) {
            console.error(`[Passport] Error during deserialization for ID: ${id}`, err);
            done(err);
        }
    }));
    console.log('[Passport] Passport configured.');
}
