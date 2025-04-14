"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mediaRoutes = void 0;
const express_1 = require("express");
const media_controller_1 = require("../controllers/media.controller");
const auth_middleware_1 = require("../../../core/middleware/auth.middleware");
const router = (0, express_1.Router)();
// All media routes require authentication
router.use(auth_middleware_1.ensureAuthenticated);
// With processText as an arrow function in the controller, this should work
router.post('/text', (req, res, next) => media_controller_1.mediaController.processText(req, res, next));
// Add routes for /youtube, /upload later
exports.mediaRoutes = router;
