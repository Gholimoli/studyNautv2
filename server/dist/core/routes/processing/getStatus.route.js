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
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const db_1 = require("../../db");
const schema_1 = require("../../db/schema");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const drizzle_orm_1 = require("drizzle-orm");
const router = (0, express_1.Router)();
/**
 * GET /api/processing/status/:sourceId
 * Retrieves the processing status of a specific source for the authenticated user.
 */
router.get('/status/:sourceId', auth_middleware_1.ensureAuthenticated, (0, express_validator_1.param)('sourceId').isInt({ min: 1 }).withMessage('Source ID must be a positive integer.'), (req, res, next) => {
    (() => __awaiter(void 0, void 0, void 0, function* () {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            res.status(400).json({ errors: errors.array() });
            return;
        }
        const authReq = req;
        if (!authReq.user || !authReq.user.id) {
            res.status(401).json({ message: 'User not properly authenticated.' });
            return;
        }
        const sourceId = parseInt(req.params.sourceId, 10);
        const userId = authReq.user.id;
        try {
            const sourceStatus = yield db_1.db
                .select({
                sourceId: schema_1.sources.id,
                processingStatus: schema_1.sources.processingStatus,
                processingStage: schema_1.sources.processingStage,
                processingError: schema_1.sources.processingError,
            })
                .from(schema_1.sources)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.sources.id, sourceId), (0, drizzle_orm_1.eq)(schema_1.sources.userId, userId)))
                .limit(1);
            if (sourceStatus.length === 0) {
                res.status(404).json({ message: 'Source not found or access denied.' });
                return;
            }
            res.status(200).json(sourceStatus[0]);
        }
        catch (error) {
            console.error(`Error fetching status for source ${sourceId}:`, error);
            res.status(500).json({ message: 'Failed to retrieve processing status due to a server error.' });
        }
    }))().catch(next);
});
exports.default = router;
