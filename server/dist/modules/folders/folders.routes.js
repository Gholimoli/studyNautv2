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
Object.defineProperty(exports, "__esModule", { value: true });
exports.folderRoutes = void 0;
const express_1 = require("express");
const folders_service_1 = require("./folders.service");
const auth_middleware_1 = require("../../core/middleware/auth.middleware");
const folders_validation_1 = require("./folders.validation");
const router = (0, express_1.Router)();
exports.folderRoutes = router;
// GET /api/folders - Fetch folders for the authenticated user
router.get('/', auth_middleware_1.ensureAuthenticated, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Cast req.user after ensureAuthenticated has run
        const user = req.user;
        // Double-check the id just in case, though middleware should handle absence
        if (typeof (user === null || user === void 0 ? void 0 : user.id) !== 'number') {
            console.error('User ID is not a number after authentication middleware:', user);
            res.status(401).json({ message: 'Invalid user authentication data.' });
            return; // Explicitly return void
        }
        const userId = user.id;
        const folders = yield (0, folders_service_1.getUserFolders)(userId);
        res.status(200).json({ folders });
        // No explicit return needed here as res.json() ends the response
    }
    catch (error) {
        next(error); // Pass errors to the global error handler
    }
}));
// GET /api/folders/:folderId - Fetch a specific folder by ID
router.get('/:folderId', auth_middleware_1.ensureAuthenticated, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = req.user;
        const folderId = parseInt(req.params.folderId, 10);
        if (isNaN(folderId)) {
            res.status(400).json({ message: 'Invalid folder ID.' });
            return;
        }
        if (typeof (user === null || user === void 0 ? void 0 : user.id) !== 'number') {
            res.status(401).json({ message: 'Invalid user authentication data.' });
            return;
        }
        const folder = yield (0, folders_service_1.getFolderById)(user.id, folderId);
        if (!folder) {
            res.status(404).json({ message: 'Folder not found.' });
            return;
        }
        res.status(200).json(folder);
    }
    catch (error) {
        next(error); // Pass errors to the global error handler
    }
}));
// POST /api/folders - Create a new folder
router.post('/', auth_middleware_1.ensureAuthenticated, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = req.user;
        const validatedInput = folders_validation_1.createFolderSchema.parse(req.body); // Validate input
        if (typeof (user === null || user === void 0 ? void 0 : user.id) !== 'number') {
            res.status(401).json({ message: 'Invalid user authentication data.' });
            return;
        }
        const newFolder = yield (0, folders_service_1.createFolder)(user.id, validatedInput);
        res.status(201).json(newFolder);
    }
    catch (error) {
        next(error); // Pass validation or service errors to global handler
    }
}));
// PATCH /api/folders/:folderId - Update a folder (rename, move)
router.patch('/:folderId', auth_middleware_1.ensureAuthenticated, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = req.user;
        const folderId = parseInt(req.params.folderId, 10);
        const validatedInput = folders_validation_1.updateFolderSchema.parse(req.body); // Validate input
        if (isNaN(folderId)) {
            res.status(400).json({ message: 'Invalid folder ID.' });
            return;
        }
        if (typeof (user === null || user === void 0 ? void 0 : user.id) !== 'number') {
            res.status(401).json({ message: 'Invalid user authentication data.' });
            return;
        }
        const updatedFolder = yield (0, folders_service_1.updateFolder)(user.id, folderId, validatedInput);
        res.status(200).json(updatedFolder);
    }
    catch (error) {
        next(error); // Pass validation or service errors to global handler
    }
}));
// DELETE /api/folders/:folderId - Delete a folder
router.delete('/:folderId', auth_middleware_1.ensureAuthenticated, (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = req.user;
        const folderId = parseInt(req.params.folderId, 10);
        if (isNaN(folderId)) {
            res.status(400).json({ message: 'Invalid folder ID.' });
            return;
        }
        if (typeof (user === null || user === void 0 ? void 0 : user.id) !== 'number') {
            res.status(401).json({ message: 'Invalid user authentication data.' });
            return;
        }
        yield (0, folders_service_1.deleteFolder)(user.id, folderId);
        res.status(204).send(); // Send No Content on successful deletion
    }
    catch (error) {
        next(error); // Pass service errors to global handler
    }
}));
