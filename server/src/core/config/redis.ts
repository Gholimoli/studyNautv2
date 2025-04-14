import { ConnectionOptions } from 'bullmq';
import * as dotenv from 'dotenv';

dotenv.config({ path: '../../.env' }); // Adjust path relative to dist/

export const redisConnectionOptions: ConnectionOptions = {
  host: process.env.REDIS_HOST || 'localhost', 
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  // Add other options like db number if needed
};

// Log connection details (optional, careful with password in logs)
console.log(`[Redis Config] Connecting to Redis at ${redisConnectionOptions.host}:${redisConnectionOptions.port}`); 