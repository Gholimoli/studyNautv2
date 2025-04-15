export const config = {
  mistralApiKey: process.env.MISTRAL_API_KEY || '',
  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceKey: process.env.SUPABASE_SERVICE_KEY || '',
  },
}; 