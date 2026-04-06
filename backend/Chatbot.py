import os
import requests
from dotenv import load_dotenv

load_dotenv()

def get_therapist_response_simple(user_input, medical_context):
    # We are using hugging face as an interface provider to excess the ai model.
    BASE_URL = "https://router.huggingface.co/v1/chat/completions"
    # Here we are using meta-llama ai model's api because it have a very good accuracy and testing results.
    MODEL    = "meta-llama/Llama-3.1-8B-Instruct"
    
    hf_token = os.environ.get("HF_TOKEN")
    if not hf_token:
        raise Exception("HF_TOKEN not found in environment variables.")

    headers = {
        "Authorization": f"Bearer {hf_token}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": MODEL,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a compassionate medical assistant that explains medical information "
                    "in simple, easy-to-understand language. Be clear, concise, and reassuring,"
                    "use the simple Emojis which will make user feel more formal and friendly"
                    "Don't give any other output for other than the medical questions "
                )#Clear and presice prebuilt prompt built with my prompt framework
            },
            {
                "role": "user",
                "content": f"Medical context: {medical_context}\n\nUser question: {user_input}"
            }
        ],
        # Here token limit is set to the 200 to maintain the size of the output.
        "max_tokens": 200,
        # Here I kept temperature as 0.7 to keep output more balanced neither too complex nor too simple and predictable.
        "temperature": 0.7
    }
    response = requests.post(BASE_URL, headers=headers, json=payload)
    if response.status_code != 200:
        raise Exception(f"API Error {response.status_code}: {response.text}")
    result = response.json()
    try:
        return result["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError) as e:
        raise Exception(f"Unexpected response format: {result}") from e
if __name__ == "__main__":
    medical_context = "blood sugar level is 120mg/dL and patient have stage 3 cancer"#We will give the medical contex Here.
    user_question   = "Do i have a normal blood sugar?"
    response = get_therapist_response_simple(user_input=user_question, medical_context=medical_context)
    print("YourHealthBuddy🤖:", response)
