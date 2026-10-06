import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CV } from "@techstark/opencv-js";
import { cropImagePerspective, detectReceiptCorners } from "./receiptCrop";

class StubMat {
  rows = 0;
  data32S = new Int32Array(8);
  data32F = new Float32Array(8);
  delete = vi.fn();
  copyTo = vi.fn();
}

class StubMatVector {
  contours: StubMat[] = [];
  delete = vi.fn();

  size() {
    return this.contours.length;
  }

  get(index: number) {
    return this.contours[index];
  }
}

const corners = [100, 50, 300, 60, 280, 450, 80, 430];

function makeCv(withContour: boolean) {
  const contour = new StubMat();
  const cv = {
    Mat: StubMat,
    MatVector: class extends StubMatVector {
      constructor() {
        super();
        this.contours = withContour ? [contour] : [];
      }
    },
    Size: class {
      constructor(
        public width: number,
        public height: number
      ) {}
    },
    MORPH_RECT: 0,
    MORPH_CLOSE: 1,
    COLOR_RGBA2GRAY: 2,
    BORDER_DEFAULT: 3,
    THRESH_BINARY: 4,
    THRESH_OTSU: 8,
    THRESH_BINARY_INV: 16,
    ADAPTIVE_THRESH_GAUSSIAN_C: 17,
    RETR_EXTERNAL: 5,
    CHAIN_APPROX_SIMPLE: 6,
    CV_32FC2: 7,
    INTER_CUBIC: 8,
    BORDER_REPLICATE: 9,
    imread: vi.fn(() => new StubMat()),
    getStructuringElement: vi.fn(() => new StubMat()),
    cvtColor: vi.fn(),
    createCLAHE: vi.fn(() => ({ apply: vi.fn(), delete: vi.fn() })),
    GaussianBlur: vi.fn(),
    Canny: vi.fn(),
    morphologyEx: vi.fn(),
    threshold: vi.fn(),
    adaptiveThreshold: vi.fn(),
    findContours: vi.fn(),
    contourArea: vi.fn(() => 30_000),
    arcLength: vi.fn(() => 1000),
    approxPolyDP: vi.fn((_contour: StubMat, output: StubMat) => {
      output.rows = 4;
      output.data32S.set(corners);
    }),
    isContourConvex: vi.fn(() => true),
    getPerspectiveTransform: vi.fn(() => new StubMat()),
    warpPerspective: vi.fn(),
    imshow: vi.fn(),
  };

  return cv;
}

describe("receipt crop utilities", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, "cv", {
      configurable: true,
      value: Promise.resolve(makeCv(true) as unknown as CV),
    });
  });

  it("finds and returns normalized editable corners", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);

    const result = await detectReceiptCorners({
      naturalWidth: 400,
      naturalHeight: 500,
    } as HTMLImageElement);

    const cv = await window.cv;
    expect(cv?.createCLAHE).toHaveBeenCalled();
    expect(cv?.adaptiveThreshold).toHaveBeenCalledTimes(2);
    expect(result).toEqual([
      { x: 0.25, y: 0.1 },
      { x: 0.75, y: 0.12 },
      { x: 0.7, y: 0.9 },
      { x: 0.2, y: 0.86 },
    ]);
  });

  it("returns no automatic crop when no qualifying contour exists", async () => {
    const cv = makeCv(false);
    Object.defineProperty(window, "cv", {
      configurable: true,
      value: Promise.resolve(cv as unknown as CV),
    });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);

    expect(
      await detectReceiptCorners({
        naturalWidth: 400,
        naturalHeight: 500,
      } as HTMLImageElement)
    ).toBeNull();
  });

  it("perspective-crops the selected quadrilateral to a JPEG data payload", async () => {
    const cv = makeCv(false);
    Object.defineProperty(window, "cv", {
      configurable: true,
      value: Promise.resolve(cv as unknown as CV),
    });
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
      "data:image/jpeg;base64,cropped-receipt"
    );

    const result = await cropImagePerspective(
      { naturalWidth: 1000, naturalHeight: 2000 } as HTMLImageElement,
      [
        { x: 0.1, y: 0.1 },
        { x: 0.9, y: 0.1 },
        { x: 0.9, y: 0.9 },
        { x: 0.1, y: 0.9 },
      ]
    );

    expect(cv.warpPerspective).toHaveBeenCalled();
    expect(result).toEqual({
      imageBase64: "cropped-receipt",
      mimeType: "image/jpeg",
    });
  });
});
