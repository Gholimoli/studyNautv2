"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = void 0;
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const auth_middleware_1 = require("../../../core/middleware/auth.middleware");
const router = (0, express_1.Router)();
// Public routes (no ensureAuthenticated)
router.post('/register', /* validateRequest(registerUserSchema), */ auth_controller_1.authController.register);
// router.post('/login', /* validateRequest(loginSchema), */ authController.login);
// Routes requiring authentication
router.post('/logout', auth_middleware_1.ensureAuthenticated, auth_controller_1.authController.logout);
router.get('/status', auth_middleware_1.ensureAuthenticated, auth_controller_1.authController.status);
exports.authRoutes = router;
