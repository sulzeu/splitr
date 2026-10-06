import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cropImagePerspective, detectReceiptCorners } from "@/utils/receiptCrop";
import { ReceiptCropDialog } from "./ReceiptCropDialog";

vi.mock("@/utils/receiptCrop", () => ({
  cropImagePerspective: vi.fn(),
  detectReceiptCorners: vi.fn(),
}));

const initialCorners = [
  { x: 0.1, y: 0.1 },
  { x: 0.9, y: 0.1 },
  { x: 0.9, y: 0.9 },
  { x: 0.1, y: 0.9 },
];

describe("ReceiptCropDialog", () => {
  beforeEach(() => {
    vi.mocked(detectReceiptCorners).mockResolvedValue(initialCorners);
    vi.mocked(cropImagePerspective).mockResolvedValue({
      imageBase64: "cropped-image",
      mimeType: "image/jpeg",
    });
  });

  it("detects a crop and lets the user adjust a corner before scanning", async () => {
    const onConfirm = vi.fn();
    render(
      <ReceiptCropDialog
        imageSrc="data:image/png;base64,original-image"
        mimeType="image/png"
        isProcessing={false}
        error={null}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
        onUseOriginal={vi.fn()}
      />
    );

    const image = screen.getByRole("img", { name: "Receipt crop preview" });
    fireEvent.load(image);
    await screen.findByText("Check the outline. Drag the four corners if needed.");

    const frame = image.parentElement as HTMLElement;
    Object.defineProperty(frame, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        left: 10,
        top: 20,
        right: 210,
        bottom: 420,
        width: 200,
        height: 400,
        x: 10,
        y: 20,
        toJSON: () => ({}),
      }),
    });
    fireEvent.pointerDown(screen.getByRole("button", { name: "Move top-left receipt corner" }), {
      pointerId: 1,
      clientX: 30,
      clientY: 60,
    });
    fireEvent.pointerMove(frame, { pointerId: 1, clientX: 50, clientY: 100 });
    fireEvent.pointerUp(frame, { pointerId: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Scan selected area" }));

    await waitFor(() =>
      expect(cropImagePerspective).toHaveBeenCalledWith(image, [
        { x: 0.2, y: 0.2 },
        ...initialCorners.slice(1),
      ])
    );
    expect(onConfirm).toHaveBeenCalledWith(
      "cropped-image",
      "image/jpeg",
      "original-image",
      "image/png"
    );
  });

  it("lets the user scan the unmodified image", () => {
    const onUseOriginal = vi.fn();
    render(
      <ReceiptCropDialog
        imageSrc="data:image/png;base64,original-image"
        mimeType="image/png"
        isProcessing={false}
        error={null}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        onUseOriginal={onUseOriginal}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Scan full image" }));

    expect(onUseOriginal).toHaveBeenCalledWith("original-image", "image/png");
  });

  it("offers the full image when automatic detection finds no boundary", async () => {
    vi.mocked(detectReceiptCorners).mockResolvedValue(null);
    const onUseOriginal = vi.fn();
    render(
      <ReceiptCropDialog
        imageSrc="data:image/png;base64,original-image"
        mimeType="image/png"
        isProcessing={false}
        error={null}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        onUseOriginal={onUseOriginal}
      />
    );

    const preview = screen.getByRole("img", { name: "Receipt crop preview" });
    fireEvent.load(preview);

    expect(
      await screen.findByText("Could not find the receipt edges automatically. Adjust the corners.")
    ).toBeInTheDocument();
    const frame = preview.parentElement as HTMLElement;
    Object.defineProperty(frame, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        left: 10,
        top: 20,
        right: 210,
        bottom: 420,
        width: 200,
        height: 400,
        x: 10,
        y: 20,
        toJSON: () => ({}),
      }),
    });
    fireEvent.pointerDown(screen.getByRole("button", { name: "Move top-left receipt corner" }), {
      pointerId: 1,
      clientX: 26,
      clientY: 52,
    });
    fireEvent.pointerMove(frame, { pointerId: 1, clientX: 50, clientY: 100 });
    fireEvent.pointerUp(frame, { pointerId: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Scan selected area" }));
    await waitFor(() =>
      expect(cropImagePerspective).toHaveBeenCalledWith(preview, [
        { x: 0.2, y: 0.2 },
        { x: 0.92, y: 0.08 },
        { x: 0.92, y: 0.92 },
        { x: 0.08, y: 0.92 },
      ])
    );

    fireEvent.click(screen.getByRole("button", { name: "Scan full image" }));
    expect(onUseOriginal).toHaveBeenCalledWith("original-image", "image/png");
  });
});
