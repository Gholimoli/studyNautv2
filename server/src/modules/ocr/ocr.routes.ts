import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { ocrService } from './ocr.service';

const router: Router = Router();
const upload = multer({ dest: '/tmp' });

const supportedImageTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

const pdfSchema = z.object({
  file: z.instanceof(Object), // Multer file
});
const imageSchema = z.object({
  file: z.instanceof(Object),
});

router.post('/pdf', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file || req.file.mimetype !== 'application/pdf') {
      res.status(400).json({ message: 'Please upload a valid PDF file.' });
      return;
    }
    pdfSchema.parse({ file: req.file });
    
    // Explicit try...catch within the route
    try {
      const result = await ocrService.processFile(req.file, 'pdf');
      res.status(200).json(result);
    } catch (serviceError: any) {
      console.error('[OCR PDF Route] Service error:', serviceError);
      res.status(500).json({
        message: serviceError.message || 'OCR processing failed in service',
        providerError: serviceError.cause, // Pass provider details if available
      });
    }
  } catch (validationOrSetupError) {
    // Catch errors from validation or multer setup
    next(validationOrSetupError); // Pass to global handler
  }
});

router.post('/image', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file || !supportedImageTypes.includes(req.file.mimetype)) {
      res.status(400).json({ message: 'Please upload a valid image file.' });
      return;
    }
    imageSchema.parse({ file: req.file });
    
    // Explicit try...catch within the route
    try {
      const result = await ocrService.processFile(req.file, 'image');
      res.status(200).json(result);
    } catch (serviceError: any) {
      console.error('[OCR Image Route] Service error:', serviceError);
      res.status(500).json({
        message: serviceError.message || 'OCR processing failed in service',
        providerError: serviceError.cause, // Pass provider details if available
      });
    }
  } catch (validationOrSetupError) {
    // Catch errors from validation or multer setup
    next(validationOrSetupError); // Pass to global handler
  }
});

export const ocrRoutes = router; 