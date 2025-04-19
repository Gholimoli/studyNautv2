"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
dotenv_1.default.config();
// Define the schema for environment variables
const envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    PORT: zod_1.z.coerce.number().optional().default(3001),
    CORS_ORIGIN: zod_1.z.string().url().optional().default('http://localhost:5173'),
    DATABASE_URL: zod_1.z.string().url().min(1, 'DATABASE_URL is required'),
    REDIS_URL: zod_1.z.string().url().min(1, 'REDIS_URL is required'),
    SESSION_SECRET: zod_1.z.string().min(1, 'SESSION_SECRET is required'),
    // AI Provider Configuration (Use specific model names/identifiers as strings)
    PRIMARY_AI_PROVIDER: zod_1.z.string().min(1, 'PRIMARY_AI_PROVIDER is required'),
    FALLBACK_AI_PROVIDER: zod_1.z.string().optional(), // Optional fallback, allow specific model name
    VISUAL_AI_PROVIDER: zod_1.z.enum(['gemini', 'serpapi']).optional().default('serpapi'), // Keep enum for this one for now
    // API Keys (Marked as optional here, but specific services might require them)
    // Use GEMINI_API_KEY instead of GOOGLE_API_KEY
    GEMINI_API_KEY: zod_1.z.string().optional(),
    OPENAI_API_KEY: zod_1.z.string().optional(),
    MISTRAL_API_KEY: zod_1.z.string().optional(),
    SERPAPI_API_KEY: zod_1.z.string().optional(),
    ELEVENLABS_API_KEY: zod_1.z.string().optional(),
    // Add Serper API Key
    SERPER_API_KEY: zod_1.z.string().optional(),
    // Supabase (Optional, if used for storage)
    SUPABASE_URL: zod_1.z.string().url().optional(),
    SUPABASE_SERVICE_KEY: zod_1.z.string().optional(),
    // Add other necessary environment variables here...
});
// Validate process.env against the schema
let validatedEnv;
try {
    validatedEnv = envSchema.parse(process.env);
}
catch (error) {
    if (error instanceof zod_1.z.ZodError) {
        console.error('❌ Invalid environment variables:', error.flatten().fieldErrors);
    }
    else {
        console.error('❌ Error parsing environment variables:', error);
    }
    // Throwing the error ensures the application won't start with invalid config
    throw new Error('Invalid environment configuration. Please check your .env file or environment variables.');
}
// Export the validated configuration
exports.config = {
    nodeEnv: validatedEnv.NODE_ENV,
    port: validatedEnv.PORT,
    corsOrigin: validatedEnv.CORS_ORIGIN,
    databaseUrl: validatedEnv.DATABASE_URL,
    redisUrl: validatedEnv.REDIS_URL,
    sessionSecret: validatedEnv.SESSION_SECRET,
    ai: {
        primaryProvider: validatedEnv.PRIMARY_AI_PROVIDER,
        fallbackProvider: validatedEnv.FALLBACK_AI_PROVIDER,
        visualProvider: validatedEnv.VISUAL_AI_PROVIDER,
        geminiApiKey: validatedEnv.GEMINI_API_KEY,
        openaiApiKey: validatedEnv.OPENAI_API_KEY,
        mistralApiKey: validatedEnv.MISTRAL_API_KEY,
        serpapiKey: validatedEnv.SERPAPI_API_KEY,
        elevenlabsApiKey: validatedEnv.ELEVENLABS_API_KEY,
        serperApiKey: validatedEnv.SERPER_API_KEY,
    },
    supabase: {
        url: validatedEnv.SUPABASE_URL,
        serviceKey: validatedEnv.SUPABASE_SERVICE_KEY,
    },
    // Add other config properties based on validatedEnv...
};
// Log successful configuration loading (optional, but helpful)
console.log('✅ Environment configuration loaded and validated successfully.');
