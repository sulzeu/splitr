import { useRef, useState, type PointerEvent } from "react";
import { Button } from "@/components/Button";
import { cropImagePerspective, detectReceiptCorners, type CropPoint } from "@/utils/receiptCrop";

type ReceiptCropDialogProps = {
  imageSrc: string;
  mimeType: string;
  isProcessing: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (
    imageBase64: string,
    mimeType: string,
    referenceImageBase64: string,
    referenceMimeType: string
  ) => void;
  onUseOriginal: (imageBase64: string, mimeType: string) => void;
};

const FULL_IMAGE_CORNERS: CropPoint[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

const MANUAL_CROP_CORNERS: CropPoint[] = [
  { x: 0.08, y: 0.08 },
  { x: 0.92, y: 0.08 },
  { x: 0.92, y: 0.92 },
  { x: 0.08, y: 0.92 },
];

function originalImageData(imageSrc: string, fallbackMimeType: string) {
  const separator = imageSrc.indexOf(",");
  const mimeType = /^data:([^;,]+)/.exec(imageSrc)?.[1] ?? fallbackMimeType;
  return {
    imageBase64: separator < 0 ? imageSrc : imageSrc.slice(separator + 1),
    mimeType,
  };
}

export function ReceiptCropDialog({
  imageSrc,
  mimeType,
  isProcessing,
  error,
  onCancel,
  onConfirm,
  onUseOriginal,
}: ReceiptCropDialogProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const draggedCornerRef = useRef<number | null>(null);
  const [corners, setCorners] = useState(FULL_IMAGE_CORNERS);
  const [detecting, setDetecting] = useState(true);
  const [detected, setDetected] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  const [cropError, setCropError] = useState<string | null>(null);

  const handleImageLoad = async () => {
    const image = imageRef.current;
    if (!image) return;
    setImageReady(true);
    setDetecting(true);
    setCropError(null);
    try {
      const result = await detectReceiptCorners(image);
      if (result) {
        setCorners(result);
        setDetected(true);
      } else {
        setCorners(MANUAL_CROP_CORNERS);
        setCropError("Could not find the receipt edges automatically. Adjust the corners.");
      }
    } catch {
      setCorners(MANUAL_CROP_CORNERS);
      setCropError(
        "Automatic edge detection is unavailable. Adjust the corners or use the full image."
      );
    } finally {
      setDetecting(false);
    }
  };

  const pointFromEvent = (event: PointerEvent<HTMLDivElement>): CropPoint | null => {
    const frame = frameRef.current;
    if (!frame) return null;
    const bounds = frame.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return null;
    return {
      x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)),
      y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)),
    };
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.dataset.cornerIndex) return;
    draggedCornerRef.current = Number(target.dataset.cornerIndex);
    if (event.currentTarget.setPointerCapture) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const index = draggedCornerRef.current;
    if (index === null) return;
    const point = pointFromEvent(event);
    if (!point) return;
    setCorners((current) =>
      current.map((corner, cornerIndex) => (cornerIndex === index ? point : corner))
    );
    setDetected(false);
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    draggedCornerRef.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const moveCornerByKeyboard = (index: number, event: React.KeyboardEvent<HTMLButtonElement>) => {
    const offsets: Record<string, CropPoint> = {
      ArrowUp: { x: 0, y: -0.01 },
      ArrowDown: { x: 0, y: 0.01 },
      ArrowLeft: { x: -0.01, y: 0 },
      ArrowRight: { x: 0.01, y: 0 },
    };
    const offset = offsets[event.key];
    if (!offset) return;
    event.preventDefault();
    const scale = event.shiftKey ? 5 : 1;
    setCorners((current) =>
      current.map((corner, cornerIndex) =>
        cornerIndex === index
          ? {
              x: Math.min(1, Math.max(0, corner.x + offset.x * scale)),
              y: Math.min(1, Math.max(0, corner.y + offset.y * scale)),
            }
          : corner
      )
    );
    setDetected(false);
  };

  const scanSelectedArea = async () => {
    const image = imageRef.current;
    if (!image) return;
    setCropError(null);
    try {
      const result = await cropImagePerspective(image, corners);
      const original = originalImageData(imageSrc, mimeType);
      onConfirm(result.imageBase64, result.mimeType, original.imageBase64, original.mimeType);
    } catch (cropFailure) {
      setCropError(
        cropFailure instanceof Error ? cropFailure.message : "Could not crop this receipt image."
      );
    }
  };

  const polygonPoints = corners.map(({ x, y }) => `${x * 1000},${y * 1000}`).join(" ");
  const original = originalImageData(imageSrc, mimeType);

  return (
    <div className="receipt-crop-backdrop">
      <section
        className="receipt-crop-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-crop-title"
      >
        <h2 id="receipt-crop-title" className="h2">
          Check receipt crop
        </h2>
        <p className="body-faint">
          {detecting
            ? "Finding receipt edges..."
            : detected
              ? "Check the outline. Drag the four corners if needed."
              : "Adjust the four corners to fit the receipt."}
        </p>

        <div className="receipt-crop-viewport">
          <div
            ref={frameRef}
            className="receipt-crop-frame"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <img
              ref={imageRef}
              src={imageSrc}
              alt="Receipt crop preview"
              onLoad={() => void handleImageLoad()}
              onError={() => {
                setImageReady(false);
                setDetecting(false);
                setCropError("Could not display this image. You can still scan the original.");
              }}
            />
            <svg
              className="receipt-crop-outline"
              viewBox="0 0 1000 1000"
              preserveAspectRatio="none"
            >
              <polygon points={polygonPoints} />
            </svg>
            {corners.map((corner, index) => (
              <button
                key={index}
                type="button"
                className="receipt-crop-handle"
                data-corner-index={index}
                aria-label={`Move ${["top-left", "top-right", "bottom-right", "bottom-left"][index]} receipt corner`}
                onKeyDown={(event) => moveCornerByKeyboard(index, event)}
                style={{ left: `${corner.x * 100}%`, top: `${corner.y * 100}%` }}
              />
            ))}
          </div>
        </div>

        {(cropError || error) && (
          <p className="body-faint" role="alert" style={{ color: "var(--outstanding)" }}>
            {error ?? cropError}
          </p>
        )}

        <div className="receipt-crop-actions">
          <Button label="Cancel" onClick={onCancel} variant="secondary" disabled={isProcessing} />
          <Button
            label="Scan full image"
            onClick={() => onUseOriginal(original.imageBase64, original.mimeType)}
            variant="secondary"
            disabled={isProcessing}
          />
          <Button
            label={isProcessing ? "Extracting..." : "Scan selected area"}
            onClick={() => void scanSelectedArea()}
            disabled={!imageReady || detecting || isProcessing}
          />
        </div>
      </section>
    </div>
  );
}
