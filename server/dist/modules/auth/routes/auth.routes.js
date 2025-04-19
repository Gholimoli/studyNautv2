"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = void 0;
const express_1 = require("express");
const passport_1 = __importDefault(require("passport"));
const auth_controller_1 = require("../controllers/auth.controller");
const auth_middleware_1 = require("../../../core/middleware/auth.middleware");
const router = (0, express_1.Router)();
// Public routes (no ensureAuthenticated)
router.post('/register', /* validateRequest(registerUserSchema), */ auth_controller_1.authController.register);
// Use passport.authenticate middleware for the login route
router.post('/login', 
// Optional: Add validation middleware here first if needed
// validateRequest(loginSchema), 
passport_1.default.authenticate('local', {
// Optional: failureRedirect: '/login', // Can redirect, but API usually sends 401
// failureMessage: true // Can add failure messages to session if desired
}), auth_controller_1.authController.login // This only runs if passport.authenticate succeeds
);
// Routes requiring authentication
router.post('/logout', auth_middleware_1.ensureAuthenticated, auth_controller_1.authController.logout);
router.get('/status', auth_middleware_1.ensureAuthenticated, auth_controller_1.authController.status);
exports.authRoutes = router;
