import base64
import json
import os
import sys
import tempfile
from pathlib import Path
from typing import Any, cast


SYSTEM_PROMPT = (
    "Extract every line item from this receipt. Respond with ONLY a JSON "
    "object in exactly this schema, no other text:\n"
    '{"items": [{"name": string, "price": number, "quantity": number}], "total": number}'
)
MODEL_ID = "mlx-community/Qwen2-VL-2B-Instruct-4bit"


def parse_json(text: str) -> dict:
    text = text.strip().removeprefix("```json").removesuffix("```").strip()
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end < start:
        raise ValueError("Model did not return a JSON object")
    value = json.loads(text[start : end + 1])
    if not isinstance(value, dict):
        raise ValueError("Model output must be a JSON object")
    return value


def main() -> None:
    request = json.load(sys.stdin)
    encoded_image = request.get("imageBase64")
    if not isinstance(encoded_image, str) or not encoded_image:
        raise ValueError("imageBase64 is required")

    image_bytes = base64.b64decode(encoded_image, validate=True)
    suffixes = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
    suffix = suffixes.get(request.get("mimeType"), ".jpg")
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as image_file:
        image_file.write(image_bytes)
        image_path = Path(image_file.name)

    try:
        from mlx_vlm.generate import generate
        from mlx_vlm.prompt_utils import apply_chat_template
        from mlx_vlm.utils import load, load_config

        adapter_path = os.environ.get(
            "SPLITRECEIPT_ADAPTER_PATH",
            str(Path(__file__).resolve().parent / "adapters2"),
        )
        model, processor = load(MODEL_ID, adapter_path=adapter_path)
        config = load_config(MODEL_ID)
        prompt = apply_chat_template(processor, config, SYSTEM_PROMPT, num_images=1)
        response = generate(
            model,
            cast(Any, processor),
            image=str(image_path),
            prompt=cast(str, prompt),
            verbose=False,
        )
        raw_text = response.text if hasattr(response, "text") else str(response)
        result = parse_json(raw_text)
        if not isinstance(result.get("items"), list):
            raise ValueError("Model output has no items array")
        if not isinstance(result.get("total"), (int, float)):
            raise ValueError("Model output has no numeric total")
        print(json.dumps(result))
    finally:
        image_path.unlink(missing_ok=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(json.dumps({"error": str(error)}))
        sys.exit(1)