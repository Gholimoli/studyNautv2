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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.configurePassport = configurePassport;
const passport_1 = __importDefault(require("passport"));
const passport_local_1 = require("passport-local");
const db_1 = require("../../core/db");
const schema_1 = require("../../core/db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const bcrypt = __importStar(require("bcryptjs"));
function configurePassport() {
    // Local Strategy for username/password login
    passport_1.default.use(new passport_local_1.Strategy((username, password, done) => __awaiter(this, void 0, void 0, function* () {
        try {
            // Find user by username
            const userRecord = yield db_1.db.query.users.findFirst({
                where: (0, drizzle_orm_1.eq)(schema_1.users.username, username),
            });
            if (!userRecord) {
                return done(null, false, { message: 'Incorrect username.' });
            }
            // Compare password hash
            const isMatch = yield bcrypt.compare(password, userRecord.passwordHash);
            if (!isMatch) {
                return done(null, false, { message: 'Incorrect password.' });
            }
            // Successful login - return user data (excluding password)
            const { passwordHash } = userRecord, user = __rest(userRecord, ["passwordHash"]);
            return done(null, user);
        }
        catch (err) {
            return done(err);
        }
    })));
    // Serialize user ID into the session
    passport_1.default.serializeUser((user, done) => {
        process.nextTick(() => {
            done(null, user.id);
        });
    });
    // Deserialize user from the session using the ID
    passport_1.default.deserializeUser((id, done) => __awaiter(this, void 0, void 0, function* () {
        try {
            const userRecord = yield db_1.db.query.users.findFirst({
                where: (0, drizzle_orm_1.eq)(schema_1.users.id, id),
                columns: {
                    passwordHash: false
                }
            });
            if (!userRecord) {
                return done(new Error('User not found'));
            }
            done(null, userRecord);
        }
        catch (err) {
            done(err);
        }
    }));
    console.log('[Passport] Configured successfully.');
}
