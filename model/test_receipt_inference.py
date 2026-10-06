from types import SimpleNamespace
import unittest
from unittest.mock import Mock

from receipt_inference import SYSTEM_PROMPT, generate_receipt_result, parse_json


class ReceiptInferenceParsingTests(unittest.TestCase):
    def test_parses_receipt_json(self) -> None:
        self.assertEqual(
            parse_json(
                '{"items":[{"name":"Noodles","price":12.5,"quantity":1}],"total":12.5}'
            ),
            {
                "items": [{"name": "Noodles", "price": 12.5, "quantity": 1}],
                "total": 12.5,
            },
        )

    def test_parses_json_in_a_markdown_fence(self) -> None:
        self.assertEqual(parse_json('```json\n{"items":[],"total":0}\n```'), {
            "items": [],
            "total": 0,
        })

    def test_reports_malformed_or_truncated_json_without_echoing_receipt_data(self) -> None:
        malformed_outputs = (
            '{"items":[{"name":"Secret receipt item" "price":1}],"total":1}',
            '{"items":[{"name":"Secret receipt item"',
        )
        for output in malformed_outputs:
            with self.subTest(output=output), self.assertRaises(ValueError) as error:
                parse_json(output)
            self.assertIn("invalid or incomplete JSON", str(error.exception))
            self.assertNotIn("Secret receipt item", str(error.exception))

    def test_rejects_non_object_json(self) -> None:
        with self.assertRaisesRegex(ValueError, "did not return a JSON object"):
            parse_json('["not", "an", "object"]')

    def test_prompt_uses_valid_json_example(self) -> None:
        self.assertIn('{"items":[{"name":"item name","price":12.34,"quantity":1}]', SYSTEM_PROMPT)
        self.assertIn("price is the amount for one unit", SYSTEM_PROMPT)
        self.assertNotIn('"price": number', SYSTEM_PROMPT)

    def test_retries_once_after_invalid_model_json(self) -> None:
        responses = [
            SimpleNamespace(text='{"items":[{"name":"secret', finish_reason="length"),
            SimpleNamespace(text='{"items":[],"total":0}', finish_reason="stop"),
        ]
        fake_generate = Mock(side_effect=responses)
        result = generate_receipt_result(
            fake_generate, object(), object(), "receipt.jpg", "extract receipt"
        )

        self.assertEqual(result, {"items": [], "total": 0})
        self.assertEqual(fake_generate.call_count, 2)
        self.assertIn("previous output was invalid JSON", fake_generate.call_args_list[1].kwargs["prompt"])

    def test_passes_full_and_cropped_views_together(self) -> None:
        fake_generate = Mock(
            return_value=SimpleNamespace(text='{"items":[],"total":0}', finish_reason="stop")
        )
        image_paths = ["full.jpg", "crop.jpg"]

        generate_receipt_result(fake_generate, object(), object(), image_paths, "extract receipt")

        self.assertEqual(fake_generate.call_args.kwargs["image"], image_paths)
        self.assertIn("full view", SYSTEM_PROMPT)
        self.assertIn("close-up", SYSTEM_PROMPT)

    def test_reports_safe_generation_metadata_after_retry_fails(self) -> None:
        responses = [
            SimpleNamespace(text='{"items":[{"name":"private receipt', finish_reason="length"),
            SimpleNamespace(
                text='{"items":[{"name":"private receipt',
                finish_reason="length",
                generation_tokens=2048,
            ),
        ]

        with self.assertRaises(ValueError) as error:
            generate_receipt_result(
                Mock(side_effect=responses),
                object(),
                object(),
                "receipt.jpg",
                "extract receipt",
            )

        self.assertIn("finish_reason=length", str(error.exception))
        self.assertIn("generated_tokens=2048", str(error.exception))
        self.assertNotIn("private receipt", str(error.exception))


if __name__ == "__main__":
    unittest.main()
