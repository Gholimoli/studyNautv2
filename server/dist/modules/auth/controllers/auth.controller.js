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
exports.authController = exports.AuthController = void 0;
const auth_service_1 = require("../services/auth.service");
const auth_schemas_1 = require("../types/auth.schemas");
const passport_1 = __importDefault(require("passport"));
class AuthController {
    register(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Validate request body
                const validatedData = auth_schemas_1.registerUserSchema.parse(req.body);
                // Call service
                const newUser = yield auth_service_1.authService.register(validatedData);
                // Log the user in automatically after registration
                req.logIn(newUser, (err) => {
                    if (err) {
                        console.error('[AuthController Register Login Error]:', err);
                        // Even if login fails, registration succeeded, so we don't throw here
                        // Might want to return a specific message indicating login failed post-registration
                    }
                    // Send response (Created)
                    const _a = newUser, { passwordHash } = _a, userResponse = __rest(_a, ["passwordHash"]); // Temporary any
                    res.status(201).json(userResponse);
                });
            }
            catch (error) {
                // Basic error handling for now
                // In a real app, use a centralized error handler middleware
                console.error('[AuthController Register Error]:', error);
                if (error instanceof Error) {
                    // Handle validation errors (Zod) or service errors (e.g., duplicate user)
                    res.status(400).json({ message: error.message });
                }
                else {
                    res.status(500).json({ message: 'Internal Server Error' });
                }
                // next(error); // Pass to error handling middleware later
            }
        });
    }
    // Login method using passport.authenticate
    login(req, res, next) {
        passport_1.default.authenticate('local', (err, user, info) => {
            if (err) {
                console.error('[AuthController Login Error - Strategy]:', err);
                return res.status(500).json({ message: 'Authentication error' });
                // return next(err); 
            }
            if (!user) {
                // Authentication failed (incorrect username/password)
                return res.status(401).json({ message: (info === null || info === void 0 ? void 0 : info.message) || 'Invalid credentials' });
            }
            // Authentication successful, establish a session
            req.logIn(user, (loginErr) => {
                if (loginErr) {
                    console.error('[AuthController Login Error - req.logIn]:', loginErr);
                    return res.status(500).json({ message: 'Session establishment failed' });
                    // return next(loginErr);
                }
                // Session established, send back user info (without password hash)
                // The user object here comes from deserializeUser, which already excludes the hash
                return res.status(200).json(user);
            });
        })(req, res, next); // Invoke the middleware returned by passport.authenticate
    }
    // Logout method
    logout(req, res, next) {
        req.logout((err) => {
            if (err) {
                console.error('[AuthController Logout Error]:', err);
                return res.status(500).json({ message: 'Logout failed' });
                // return next(err);
            }
            // Successful logout - destroy session
            req.session.destroy((destroyErr) => {
                if (destroyErr) {
                    console.error('[AuthController Session Destroy Error]:', destroyErr);
                    // Even if session destroy fails, logout conceptually succeeded
                }
                res.clearCookie('connect.sid'); // Ensure the session cookie is cleared
                res.status(204).send(); // Send No Content response
            });
        });
    }
    // Get authentication status
    status(req, res) {
        if (req.isAuthenticated()) {
            // User is authenticated, send back user data
            // req.user comes from deserializeUser and already excludes password hash
            res.status(200).json({ authenticated: true, user: req.user });
        }
        else {
            // User is not authenticated
            res.status(200).json({ authenticated: false, user: null });
        }
    }
}
exports.AuthController = AuthController;
exports.authController = new AuthController();
