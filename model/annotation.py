import json
import os
from dotenv import load_dotenv
import time
from pathlib import Path
from typing import Optional
from google import genai
from google.genai import types
from PIL import Image
from pydantic import BaseModel, Field
from tqdm import tqdm

# 1. Define strict JSON schema using Pydantic
class ReceiptItem(BaseModel):
    name: str = Field(description="Exact item name or dish description")
    quantity: int = Field(default=1, description="Quantity purchased")
    price: float = Field(description="Line item price")


class ReceiptAnnotation(BaseModel):
    items: list[ReceiptItem]
    subtotal: Optional[float] = Field(default=None, description="Subtotal before tax/tip")
    tax: Optional[float] = Field(default=None, description="Tax amount (e.g. GST)")
    total: float = Field(description="Grand total on the receipt")


def is_math_valid(annotation: ReceiptAnnotation, tolerance: float = 0.05) -> bool:
    """Validates math: sum of item prices vs. final total."""
    calculated_items_sum = sum(item.price for item in annotation.items)

    # Check if item sum roughly equals subtotal or total
    target_amount = annotation.subtotal if annotation.subtotal else annotation.total
    if abs(calculated_items_sum - target_amount) <= tolerance:
        return True

    # Check if (items_sum + tax) equals total
    if annotation.tax:
        if abs((calculated_items_sum + annotation.tax) - annotation.total) <= tolerance:
            return True

    return False


def annotate_receipt_folder(
    image_dir: str,
    output_jsonl: str,
    api_key: str | None = None,
    filter_bad_math: bool = True,
):
    load_dotenv()
    """Processes a folder of receipt images and exports auto-labeled JSONL dataset."""
    client = genai.Client(api_key=api_key or os.environ.get("GEMINI_API_KEY"))
    image_paths = list(Path(image_dir).glob("*.[jJ][pP][gG]")) + list(
        Path(image_dir).glob("*.[pP][nN][gG]")
    )

    valid_count = 0
    discarded_count = 0

    with open(output_jsonl, "w", encoding="utf-8") as outfile:
        for img_path in tqdm(image_paths, desc="Auto-labeling receipts"):
            # Retry logic for rate-limit errors
            annotation = None
            max_retries = 5

            for attempt in range(max_retries):
                try:
                    img = Image.open(img_path)

                    response = client.models.generate_content(
                        model="gemini-3.6-flash",
                        contents=[
                            img,
                            "Extract all line items, quantity, prices, tax, and total from this receipt accurately.",
                        ],
                        config=types.GenerateContentConfig(
                            response_mime_type="application/json",
                            response_schema=ReceiptAnnotation,
                            temperature=0.0,
                        ),
                    )

                    response_text = response.text
                    if response_text is None:
                        raise ValueError("Gemini response did not contain text")

                    raw_json = json.loads(response_text)
                    annotation = ReceiptAnnotation(**raw_json)
                    break  # Success, exit retry loop

                except Exception as e:
                    err_msg = str(e)
                    if "429" in err_msg or "RESOURCE_EXHAUSTED" in err_msg:
                        wait_sec = 12 * (attempt + 1)
                        print(
                            f"\nRate limit hit on {img_path.name}. Waiting {wait_sec}s..."
                        )
                        time.sleep(wait_sec)
                    else:
                        print(f"\nSkipping {img_path.name}: {e}")
                        discarded_count += 1
                        break

            if annotation is None:
                continue

            # Quality Filter: Verify arithmetic integrity
            if filter_bad_math and not is_math_valid(annotation):
                discarded_count += 1
                continue

            # Format record for VLM training
            record = {
                "image_path": str(img_path),
                "ground_truth": json.dumps(annotation.model_dump()),
            }

            outfile.write(json.dumps(record) + "\n")
            valid_count += 1

            # Enforce max 5 requests per minute (60s / 5 = 12s per call)
            time.sleep(12)

    print("\n--- Auto-Labeling Complete ---")
    print(f"✅ Valid dataset records saved: {valid_count}")
    print(f"❌ Discarded / Failed records: {discarded_count}")

if __name__ == "__main__":
    # Ensure GEMINI_API_KEY is set in your environment variables

    annotate_receipt_folder(
        image_dir="./raw_receipts",
        output_jsonl="auto_labeled_dataset.jsonl",
        filter_bad_math=True,
    )