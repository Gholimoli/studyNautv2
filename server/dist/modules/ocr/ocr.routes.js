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
exports.ocrRoutes = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const zod_1 = require("zod");
const ocr_service_1 = require("./ocr.service");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ dest: '/tmp' });
const supportedImageTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const pdfSchema = zod_1.z.object({
    file: zod_1.z.instanceof(Object), // Multer file
});
const imageSchema = zod_1.z.object({
    file: zod_1.z.instanceof(Object),
});
router.post('/pdf', upload.single('file'), (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.file || req.file.mimetype !== 'application/pdf') {
            res.status(400).json({ message: 'Please upload a valid PDF file.' });
            return;
        }
        pdfSchema.parse({ file: req.file });
        // Explicit try...catch within the route
        try {
            const result = yield ocr_service_1.ocrService.processFile(req.file, 'pdf');
            res.status(200).json(result);
        }
        catch (serviceError) {
            console.error('[OCR PDF Route] Service error:', serviceError);
            res.status(500).json({
                message: serviceError.message || 'OCR processing failed in service',
                providerError: serviceError.cause, // Pass provider details if available
            });
        }
    }
    catch (validationOrSetupError) {
        // Catch errors from validation or multer setup
        next(validationOrSetupError); // Pass to global handler
    }
}));
router.post('/image', upload.single('file'), (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.file || !supportedImageTypes.includes(req.file.mimetype)) {
            res.status(400).json({ message: 'Please upload a valid image file.' });
            return;
        }
        imageSchema.parse({ file: req.file });
        // Explicit try...catch within the route
        try {
            const result = yield ocr_service_1.ocrService.processFile(req.file, 'image');
            res.status(200).json(result);
        }
        catch (serviceError) {
            console.error('[OCR Image Route] Service error:', serviceError);
            res.status(500).json({
                message: serviceError.message || 'OCR processing failed in service',
                providerError: serviceError.cause, // Pass provider details if available
            });
        }
    }
    catch (validationOrSetupError) {
        // Catch errors from validation or multer setup
        next(validationOrSetupError); // Pass to global handler
    }
}));
exports.ocrRoutes = router;
