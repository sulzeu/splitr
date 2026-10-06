import base64
import json
import os
import sys
import tempfile
from pathlib import Path
from typing import Any, Callable, cast

SYSTEM_PROMPT = (
    "Read the receipt image or images and extract each purchased line item. If "
    "multiple images are provided, they show the same receipt: use the full view "
    "for context and the close-up for reading details. Return only "
    "one complete, valid JSON object, with no markdown or explanation. Use this "
    "structure (the example values are not receipt data):\n"
    '{"items":[{"name":"item name","price":12.34,"quantity":1}],"total":12.34}\n'
    "Prices, quantities, and total must be JSON numbers, not strings. Do not "
    "include currency symbols. Use an empty items array if no items are legible."
)
MODEL_ID = "mlx-community/Qwen2-VL-2B-Instruct-4bit"


def parse_json(text: str) -> dict:
    text = text.strip().removeprefix("```json").removesuffix("```").strip()
    start = text.find("{")
    end = text.rfind("}")
    if start < 0:
        raise ValueError("Model did not return a JSON object")
    json_text = text[start : end + 1] if end >= start else text[start:]
    try:
        value = json.loads(json_text)
    except json.JSONDecodeError as error:
        raise ValueError(
            f"Model returned invalid or incomplete JSON at line {error.lineno}, "
            f"column {error.colno}; try scanning again or adjusting the crop"
        ) from error
    if not isinstance(value, dict):
        raise ValueError("Model output must be a JSON object")
    return value


def generate_receipt_result(
    generate: Callable[..., Any],
    model: Any,
    processor: Any,
    image_path: str | list[str],
    prompt: str,
) -> dict:
    for attempt in range(2):
        response = generate(
            model,
            cast(Any, processor),
            image=image_path,
            prompt=prompt,
            max_tokens=2048,
            temperature=0,
            verbose=False,
        )
        raw_text = response.text if hasattr(response, "text") else str(response)
        try:
            return parse_json(raw_text)
        except ValueError as error:
            if attempt == 0:
                prompt = (
                    f"{prompt}\nYour previous output was invalid JSON. Re-read "
                    "the image and return a complete, valid JSON object matching "
                    "the required structure. Do not copy example values."
                )
                continue

            finish_reason = getattr(response, "finish_reason", None)
            generation_tokens = getattr(response, "generation_tokens", None)
            diagnostics = []
            if finish_reason:
                diagnostics.append(f"finish_reason={finish_reason}")
            if isinstance(generation_tokens, int):
                diagnostics.append(f"generated_tokens={generation_tokens}")
            details = f" ({', '.join(diagnostics)})" if diagnostics else ""
            raise ValueError(f"{error}{details}") from error

    raise RuntimeError("Receipt generation ended without a result")


def main() -> None:
    request = json.load(sys.stdin)
    encoded_image = request.get("imageBase64")
    if not isinstance(encoded_image, str) or not encoded_image:
        raise ValueError("imageBase64 is required")

    suffixes = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
    image_inputs = []
    reference_image = request.get("referenceImageBase64")
    if reference_image is not None:
        if not isinstance(reference_image, str) or not reference_image:
            raise ValueError("referenceImageBase64 must be a non-empty string")
        image_inputs.append((reference_image, request.get("referenceMimeType")))
    image_inputs.append((encoded_image, request.get("mimeType")))

    image_paths: list[Path] = []
    try:
        for encoded, input_mime_type in image_inputs:
            image_bytes = base64.b64decode(encoded, validate=True)
            suffix = suffixes.get(input_mime_type, ".jpg")
            with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as image_file:
                image_file.write(image_bytes)
                image_paths.append(Path(image_file.name))

        from mlx_vlm.generate import generate
        from mlx_vlm.prompt_utils import apply_chat_template
        from mlx_vlm.utils import load, load_config

        adapter_path = os.environ.get(
            "SPLITRECEIPT_ADAPTER_PATH",
            str(Path(__file__).resolve().parent / "adapters2"),
        )
        model, processor = load(MODEL_ID, adapter_path=adapter_path)
        config = load_config(MODEL_ID)
        prompt = apply_chat_template(processor, config, SYSTEM_PROMPT, num_images=len(image_paths))
        result = generate_receipt_result(
            generate,
            model,
            processor,
            [str(image_path) for image_path in image_paths]
            if len(image_paths) > 1
            else str(image_paths[0]),
            cast(str, prompt),
        )
        if not isinstance(result.get("items"), list):
            raise ValueError("Model output has no items array")
        if not isinstance(result.get("total"), (int, float)):
            raise ValueError("Model output has no numeric total")
        print(json.dumps(result))
    finally:
        for image_path in image_paths:
            image_path.unlink(missing_ok=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"SPLITRECEIPT_ERROR: {json.dumps({'error': str(error)})}", file=sys.stderr)
        sys.exit(1)