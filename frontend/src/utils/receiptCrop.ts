import openCvScriptUrl from "@techstark/opencv-js/dist/opencv.js?url";
import type { CV } from "@techstark/opencv-js";

export type CropPoint = { x: number; y: number };
type Point = { x: number; y: number };

declare global {
  interface Window {
    cv?: PromiseLike<CV>;
  }
}

const MAX_DETECTION_DIMENSION = 1000;
let openCvPromise: Promise<CV> | undefined;

function loadOpenCv(): Promise<CV> {
  if (window.cv) return Promise.resolve(window.cv);
  if (openCvPromise) return openCvPromise;

  openCvPromise = new Promise<CV>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = openCvScriptUrl;
    script.async = true;
    script.onload = () => {
      const runtime = window.cv;
      if (!runtime) {
        script.remove();
        openCvPromise = undefined;
        reject(new Error("OpenCV.js loaded without initializing."));
        return;
      }
      Promise.resolve(runtime).then(resolve, (error) => {
        script.remove();
        openCvPromise = undefined;
        reject(error);
      });
    };
    script.onerror = () => {
      script.remove();
      openCvPromise = undefined;
      reject(new Error("Could not load local receipt boundary detection."));
    };
    document.head.appendChild(script);
  });

  return openCvPromise;
}

function orderCorners(points: Point[]): Point[] {
  const center = points.reduce(
    (sum, point) => ({ x: sum.x + point.x / points.length, y: sum.y + point.y / points.length }),
    { x: 0, y: 0 }
  );
  const ordered = [...points].sort(
    (left, right) =>
      Math.atan2(left.y - center.y, left.x - center.x) -
      Math.atan2(right.y - center.y, right.x - center.x)
  );
  const topLeftIndex = ordered.reduce(
    (bestIndex, point, index) =>
      point.x + point.y < ordered[bestIndex].x + ordered[bestIndex].y ? index : bestIndex,
    0
  );
  return [...ordered.slice(topLeftIndex), ...ordered.slice(0, topLeftIndex)];
}

export async function detectReceiptCorners(image: HTMLImageElement): Promise<CropPoint[] | null> {
  const cv = await loadOpenCv();
  const scale = Math.min(
    1,
    MAX_DETECTION_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight)
  );
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare the photo for receipt detection.");
  context.drawImage(image, 0, 0, width, height);

  const source = cv.imread(canvas);
  const gray = new cv.Mat();
  const enhanced = new cv.Mat();
  const blurred = new cv.Mat();
  const edges = new cv.Mat();
  const closedEdges = new cv.Mat();
  const thresholded = new cv.Mat();
  const closedThreshold = new cv.Mat();
  const invertedThreshold = new cv.Mat();
  const closedInverted = new cv.Mat();
  const adaptiveThreshold = new cv.Mat();
  const closedAdaptive = new cv.Mat();
  const adaptiveInverted = new cv.Mat();
  const closedAdaptiveInverted = new cv.Mat();
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
  const clahe = cv.createCLAHE(2, new cv.Size(8, 8));
  const masks: Array<InstanceType<CV["Mat"]>> = [];
  const candidates: Array<{ area: number; points: Point[] }> = [];

  try {
    cv.cvtColor(source, gray, cv.COLOR_RGBA2GRAY);
    clahe.apply(gray, enhanced);
    cv.GaussianBlur(enhanced, blurred, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
    cv.Canny(blurred, edges, 40, 120);
    cv.morphologyEx(edges, closedEdges, cv.MORPH_CLOSE, kernel);
    cv.threshold(blurred, thresholded, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
    cv.morphologyEx(thresholded, closedThreshold, cv.MORPH_CLOSE, kernel);
    cv.threshold(blurred, invertedThreshold, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);
    cv.morphologyEx(invertedThreshold, closedInverted, cv.MORPH_CLOSE, kernel);
    const adaptiveBlockSize = Math.min(
      51,
      Math.max(3, Math.floor(Math.min(width, height) / 12) | 1)
    );
    cv.adaptiveThreshold(
      blurred,
      adaptiveThreshold,
      255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C,
      cv.THRESH_BINARY,
      adaptiveBlockSize,
      7
    );
    cv.morphologyEx(adaptiveThreshold, closedAdaptive, cv.MORPH_CLOSE, kernel);
    cv.adaptiveThreshold(
      blurred,
      adaptiveInverted,
      255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C,
      cv.THRESH_BINARY_INV,
      adaptiveBlockSize,
      7
    );
    cv.morphologyEx(adaptiveInverted, closedAdaptiveInverted, cv.MORPH_CLOSE, kernel);
    masks.push(
      closedEdges,
      closedThreshold,
      closedInverted,
      closedAdaptive,
      closedAdaptiveInverted
    );

    for (const mask of masks) {
      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();
      try {
        cv.findContours(mask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
        for (let index = 0; index < contours.size(); index++) {
          const contour = contours.get(index);
          const approximation = new cv.Mat();
          try {
            const area = cv.contourArea(contour);
            if (area < width * height * 0.025 || area > width * height * 0.97) continue;
            cv.approxPolyDP(contour, approximation, 0.02 * cv.arcLength(contour, true), true);
            if (approximation.rows !== 4 || !cv.isContourConvex(approximation)) continue;

            const points = Array.from({ length: 4 }, (_, pointIndex) => ({
              x: approximation.data32S[pointIndex * 2],
              y: approximation.data32S[pointIndex * 2 + 1],
            }));
            const ordered = orderCorners(points);
            const edgeLengths = ordered.map((point, pointIndex) => {
              const next = ordered[(pointIndex + 1) % ordered.length];
              return Math.hypot(next.x - point.x, next.y - point.y);
            });
            const shortSide = Math.min(...edgeLengths);
            const longSide = Math.max(...edgeLengths);
            if (shortSide < Math.min(width, height) * 0.12 || longSide / shortSide > 8) continue;
            candidates.push({ area, points: ordered });
          } finally {
            approximation.delete();
            contour.delete();
          }
        }
      } finally {
        contours.delete();
        hierarchy.delete();
      }
    }
  } finally {
    source.delete();
    gray.delete();
    enhanced.delete();
    blurred.delete();
    edges.delete();
    closedEdges.delete();
    thresholded.delete();
    closedThreshold.delete();
    invertedThreshold.delete();
    closedInverted.delete();
    adaptiveThreshold.delete();
    closedAdaptive.delete();
    adaptiveInverted.delete();
    closedAdaptiveInverted.delete();
    kernel.delete();
    clahe.delete();
  }

  const best = candidates.sort((left, right) => right.area - left.area)[0];
  if (!best) return null;
  return best.points.map((point) => ({
    x: Math.min(1, Math.max(0, point.x / width)),
    y: Math.min(1, Math.max(0, point.y / height)),
  }));
}

export async function cropImagePerspective(
  image: HTMLImageElement,
  corners: CropPoint[]
): Promise<{ imageBase64: string; mimeType: string }> {
  if (corners.length !== 4) throw new Error("Select all four receipt corners.");

  const cv = await loadOpenCv();
  const points = orderCorners(
    corners.map((point) => ({
      x: point.x * image.naturalWidth,
      y: point.y * image.naturalHeight,
    }))
  );
  const width = Math.max(
    1,
    Math.ceil(
      Math.max(
        Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y),
        Math.hypot(points[2].x - points[3].x, points[2].y - points[3].y)
      )
    )
  );
  const height = Math.max(
    1,
    Math.ceil(
      Math.max(
        Math.hypot(points[3].x - points[0].x, points[3].y - points[0].y),
        Math.hypot(points[2].x - points[1].x, points[2].y - points[1].y)
      )
    )
  );
  const sourcePoints = new cv.Mat(4, 1, cv.CV_32FC2);
  const destinationPoints = new cv.Mat(4, 1, cv.CV_32FC2);
  const transform = new cv.Mat();
  const source = cv.imread(image);
  const output = new cv.Mat();
  const canvas = document.createElement("canvas");

  try {
    sourcePoints.data32F.set(points.flatMap((point) => [point.x, point.y]));
    destinationPoints.data32F.set([0, 0, width - 1, 0, width - 1, height - 1, 0, height - 1]);
    const perspective = cv.getPerspectiveTransform(sourcePoints, destinationPoints);
    perspective.copyTo(transform);
    perspective.delete();
    cv.warpPerspective(
      source,
      output,
      transform,
      new cv.Size(width, height),
      cv.INTER_CUBIC,
      cv.BORDER_REPLICATE
    );
    cv.imshow(canvas, output);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.94);
    const comma = dataUrl.indexOf(",");
    if (comma < 0) throw new Error("Could not encode the cropped receipt photo.");
    return { imageBase64: dataUrl.slice(comma + 1), mimeType: "image/jpeg" };
  } finally {
    sourcePoints.delete();
    destinationPoints.delete();
    transform.delete();
    source.delete();
    output.delete();
  }
}
