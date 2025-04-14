import 'express';
import { File as MulterFile } from 'multer';

// Augment the existing Request interface
declare namespace Express {
  export interface User {
    // Define the properties available on req.user based on your Passport setup
    id: number; // Assuming user ID is a number
    username: string;
    email: string;
    role: string;
    // Add other properties populated during deserialization
  }

  export interface Request {
    user?: User; // Add the optional user property
    file?: MulterFile; // Make it optional as it might not always be present
  }
}

// Export {} is needed to treat this file as a module
export {}; 