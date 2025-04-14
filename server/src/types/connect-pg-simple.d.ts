declare module 'connect-pg-simple' {
  import { Store } from 'express-session';
  import { Pool } from 'pg';

  interface PGStoreOptions {
    pool?: Pool;
    conString?: string;
    tableName?: string;
    schemaName?: string;
    pruneSessionInterval?: number | false;
    errorLog?: (...args: any[]) => void;
    ttl?: number;
    createTableIfMissing?: boolean;
    disableTouch?: boolean;
  }

  // Define the main export as a function that returns the Store class constructor
  function connectPgSimple(session: any): typeof PGStore;

  // Define the Store class that will be returned
  class PGStore extends Store {
    constructor(options?: PGStoreOptions);
    // Add any specific methods of PGStore if known, e.g.:
    // close(): void;
    // pruneSessions(callback?: (err: any) => void): void;
  }

  export = connectPgSimple;
} 