import os
import openai
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

api_key = os.getenv("OPENAI_API_KEY")

if not api_key:
    print("Error: OPENAI_API_KEY not found in .env file or environment.")
else:
    print(f"Found OPENAI_API_KEY starting with: {api_key[:5]}...")
    try:
        # Configure the OpenAI client
        # Use openai.OpenAI() if using openai library v1.0.0 or higher
        # Use openai.api_key = api_key if using older versions
        client = openai.OpenAI(api_key=api_key)

        print("Attempting to list OpenAI models...")
        # Attempt a basic, low-cost API call (e.g., list models)
        models = client.models.list()

        print("Successfully connected to OpenAI API and listed models.")
        # print("Available models (first few):")
        # for model in list(models)[:5]:
        #     print(f"- {model.id}")

    except openai.AuthenticationError:
        print("OpenAI Authentication Error: The API key is invalid or expired.")
    except openai.RateLimitError:
        print("OpenAI Rate Limit Error: You have exceeded your API quota.")
    except openai.APIConnectionError as e:
        print(f"OpenAI API Connection Error: {e}")
    except openai.APIStatusError as e:
         print(f"OpenAI API Status Error: Status Code: {e.status_code}, Response: {e.response}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}") 