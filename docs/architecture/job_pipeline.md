## YouTube Pipeline (2024)
- Users submit YouTube URLs via dashboard or API.
- Transcript is extracted using youtube-transcript (with timestamps).
- Source is updated in DB; job enqueues Gemini note generation.
- Gemini model is selected via PRIMARY_AI_PROVIDER in .env.
- Visuals are generated and integrated as with other sources.
- Robust error handling and detailed logging for large/complex jobs. 