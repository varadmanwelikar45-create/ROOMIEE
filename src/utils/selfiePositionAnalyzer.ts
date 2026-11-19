export type SelfieGuidanceDirection =
  | 'move_left'
  | 'move_right'
  | 'move_up'
  | 'move_down'
  | 'move_closer'
  | 'more_light'
  | 'centered'
  | 'no_face';

export interface SelfiePositionAnalysis {
  direction: SelfieGuidanceDirection;
  instruction: string;
  centered: boolean;
  confidence: number;
  brightness: number;
  faceBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface DetectedBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface NativeFaceDetector {
  detect: (source: HTMLCanvasElement) => Promise<Array<{ boundingBox: DOMRectReadOnly }>>;
}

type FaceDetectorCtor = new (options?: {
  fastMode?: boolean;
  maxDetectedFaces?: number;
}) => NativeFaceDetector;

let cachedFaceDetector: NativeFaceDetector | null | undefined;

function getNativeFaceDetector(): NativeFaceDetector | null {
  if (cachedFaceDetector !== undefined) return cachedFaceDetector;
  try {
    const win = window as unknown as { FaceDetector?: FaceDetectorCtor };
    if (typeof window !== 'undefined' && typeof win.FaceDetector === 'function') {
      cachedFaceDetector = new win.FaceDetector({ fastMode: true, maxDetectedFaces: 2 });
      return cachedFaceDetector;
    }
  } catch {
    // Native FaceDetector unavailable in this browser
  }
  cachedFaceDetector = null;
  return null;
}

function isSkinTonePixel(r: number, g: number, b: number): boolean {
  // YCbCr skin-tone cluster across diverse skin complexions
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

  const ycbcrMatch = y > 38 && cb >= 76 && cb <= 129 && cr >= 131 && cr <= 176;
  if (ycbcrMatch) return true;

  // Secondary warm-illumination RGB check for dim/warm indoor webcams
  const maxRgb = Math.max(r, g, b);
  const minRgb = Math.min(r, g, b);
  return (
    r > 65 &&
    g > 40 &&
    b > 22 &&
    r > g &&
    r > b &&
    maxRgb - minRgb > 14 &&
    r - g > 8
  );
}

function detectSkinClusterBox(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): { box: DetectedBox | null; avgBrightness: number } {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  const cols = 16;
  const rows = 12;
  const cellW = width / cols;
  const cellH = height / rows;
  const cellSkinCounts = new Float32Array(cols * rows);
  const cellTotalCounts = new Float32Array(cols * rows);

  let totalLuma = 0;
  let pixelCount = 0;

  // Sample every 2nd pixel for <2ms real-time frame analysis
  for (let py = 0; py < height; py += 2) {
    const rowIdx = Math.min(rows - 1, Math.floor(py / cellH));
    for (let px = 0; px < width; px += 2) {
      const i = (py * width + px) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      totalLuma += luma;
      pixelCount++;

      const colIdx = Math.min(cols - 1, Math.floor(px / cellW));
      const cellIdx = rowIdx * cols + colIdx;
      cellTotalCounts[cellIdx]++;
      if (isSkinTonePixel(r, g, b)) {
        cellSkinCounts[cellIdx]++;
      }
    }
  }

  const avgBrightness = pixelCount > 0 ? totalLuma / pixelCount : 128;

  // Find peak 3x3 region in the grid so background clutter doesn't skew centroid
  let bestScore = 0;
  let bestCol = Math.floor(cols / 2);
  let bestRow = Math.floor(rows / 2);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let regionScore = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
            const idx = nr * cols + nc;
            const ratio = cellTotalCounts[idx] > 0 ? cellSkinCounts[idx] / cellTotalCounts[idx] : 0;
            regionScore += ratio;
          }
        }
      }
      if (regionScore > bestScore) {
        bestScore = regionScore;
        bestCol = c;
        bestRow = r;
      }
    }
  }

  if (bestScore < 0.75) {
    return { box: null, avgBrightness };
  }

  // Expand around peak cell to estimate face bounding box & weighted center
  let weightedX = 0;
  let weightedY = 0;
  let totalWeight = 0;
  let minCol = bestCol;
  let maxCol = bestCol;
  let minRow = bestRow;
  let maxRow = bestRow;

  for (let r = Math.max(0, bestRow - 3); r <= Math.min(rows - 1, bestRow + 3); r++) {
    for (let c = Math.max(0, bestCol - 3); c <= Math.min(cols - 1, bestCol + 3); c++) {
      const idx = r * cols + c;
      const ratio = cellTotalCounts[idx] > 0 ? cellSkinCounts[idx] / cellTotalCounts[idx] : 0;
      if (ratio >= 0.22) {
        weightedX += (c + 0.5) * ratio;
        weightedY += (r + 0.5) * ratio;
        totalWeight += ratio;
        minCol = Math.min(minCol, c);
        maxCol = Math.max(maxCol, c);
        minRow = Math.min(minRow, r);
        maxRow = Math.max(maxRow, r);
      }
    }
  }

  if (totalWeight <= 0) {
    return { box: null, avgBrightness };
  }

  const cx = weightedX / totalWeight / cols;
  const cy = weightedY / totalWeight / rows;
  const boxW = Math.max(0.18, ((maxCol - minCol + 1) / cols) * 0.95);
  const boxH = Math.max(0.24, ((maxRow - minRow + 1) / rows) * 0.95);

  return {
    box: {
      x: Math.max(0, Math.min(1 - boxW, cx - boxW / 2)),
      y: Math.max(0, Math.min(1 - boxH, cy - boxH / 2)),
      width: boxW,
      height: boxH,
    },
    avgBrightness,
  };
}

function buildGuidanceFromBox(
  box: DetectedBox | null,
  avgBrightness: number
): SelfiePositionAnalysis {
  if (avgBrightness < 30) {
    return {
      direction: 'more_light',
      instruction: 'Need a bit more light on your face',
      centered: false,
      confidence: 80,
      brightness: Math.round(avgBrightness),
    };
  }

  if (!box) {
    return {
      direction: 'no_face',
      instruction: 'Position your face inside the oval',
      centered: false,
      confidence: 50,
      brightness: Math.round(avgBrightness),
    };
  }

  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const areaRatio = box.width * box.height;

  // In a mirrored preview, face left of center (cx < 0.41) needs user to move right
  if (cx < 0.41) {
    return {
      direction: 'move_right',
      instruction: 'Move right',
      centered: false,
      confidence: 90,
      brightness: Math.round(avgBrightness),
      faceBox: box,
    };
  }
  if (cx > 0.59) {
    return {
      direction: 'move_left',
      instruction: 'Move left',
      centered: false,
      confidence: 90,
      brightness: Math.round(avgBrightness),
      faceBox: box,
    };
  }

  if (cy < 0.33) {
    return {
      direction: 'move_down',
      instruction: 'Move down',
      centered: false,
      confidence: 90,
      brightness: Math.round(avgBrightness),
      faceBox: box,
    };
  }
  if (cy > 0.60) {
    return {
      direction: 'move_up',
      instruction: 'Move up',
      centered: false,
      confidence: 90,
      brightness: Math.round(avgBrightness),
      faceBox: box,
    };
  }

  if (areaRatio < 0.04) {
    return {
      direction: 'move_closer',
      instruction: 'Move a little closer',
      centered: false,
      confidence: 85,
      brightness: Math.round(avgBrightness),
      faceBox: box,
    };
  }

  return {
    direction: 'centered',
    instruction: 'Centered! Hold still...',
    centered: true,
    confidence: 94,
    brightness: Math.round(avgBrightness),
    faceBox: box,
  };
}

/**
 * Analyzes a live mirrored video frame and returns directional guidance
 * ("Move left", "Move right", "Move up", "Move down", or "Centered!").
 */
export async function analyzeSelfieVideoFrame(
  video: HTMLVideoElement,
  workCanvas: HTMLCanvasElement
): Promise<SelfiePositionAnalysis> {
  const width = 160;
  const height = 120;
  if (workCanvas.width !== width) workCanvas.width = width;
  if (workCanvas.height !== height) workCanvas.height = height;

  const ctx = workCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || !video.videoWidth || !video.videoHeight) {
    return {
      direction: 'no_face',
      instruction: 'Preparing camera...',
      centered: false,
      confidence: 0,
      brightness: 128,
    };
  }

  // Draw mirrored horizontally to match the live mirrored camera viewfinder
  ctx.save();
  ctx.setTransform(-1, 0, 0, 1, width, 0);
  ctx.drawImage(video, 0, 0, width, height);
  ctx.restore();

  const skinResult = detectSkinClusterBox(ctx, width, height);

  const detector = getNativeFaceDetector();
  if (detector) {
    try {
      const faces = await detector.detect(workCanvas);
      if (faces.length > 0) {
        const largest = faces.reduce((best, cur) =>
          cur.boundingBox.width * cur.boundingBox.height >
          best.boundingBox.width * best.boundingBox.height
            ? cur
            : best
        );
        const b = largest.boundingBox;
        return buildGuidanceFromBox(
          {
            x: Math.max(0, Math.min(1, b.x / width)),
            y: Math.max(0, Math.min(1, b.y / height)),
            width: Math.max(0.05, Math.min(1, b.width / width)),
            height: Math.max(0.05, Math.min(1, b.height / height)),
          },
          skinResult.avgBrightness
        );
      }
    } catch {
      cachedFaceDetector = null;
    }
  }

  return buildGuidanceFromBox(skinResult.box, skinResult.avgBrightness);
}

/**
 * Analyzes a still selfie photo File for framing feedback before/during verification.
 */
export function analyzeSelfieImageFile(file: File): Promise<SelfiePositionAnalysis> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () =>
      resolve({
        direction: 'centered',
        instruction: 'Analyzing selfie...',
        centered: true,
        confidence: 70,
        brightness: 128,
      });
    reader.onload = (event) => {
      const dataUrl = event.target?.result;
      if (typeof dataUrl !== 'string') {
        resolve({
          direction: 'centered',
          instruction: 'Analyzing selfie...',
          centered: true,
          confidence: 70,
          brightness: 128,
        });
        return;
      }
      const img = new Image();
      img.onerror = () =>
        resolve({
          direction: 'centered',
          instruction: 'Analyzing selfie...',
          centered: true,
          confidence: 70,
          brightness: 128,
        });
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 120;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve({
            direction: 'centered',
            instruction: 'Analyzing selfie...',
            centered: true,
            confidence: 70,
            brightness: 128,
          });
          return;
        }
        ctx.drawImage(img, 0, 0, 160, 120);
        const skinResult = detectSkinClusterBox(ctx, 160, 120);
        const detector = getNativeFaceDetector();
        if (detector) {
          try {
            const faces = await detector.detect(canvas);
            if (faces.length > 0) {
              const b = faces[0].boundingBox;
              resolve(
                buildGuidanceFromBox(
                  {
                    x: Math.max(0, Math.min(1, b.x / 160)),
                    y: Math.max(0, Math.min(1, b.y / 120)),
                    width: Math.max(0.05, Math.min(1, b.width / 160)),
                    height: Math.max(0.05, Math.min(1, b.height / 120)),
                  },
                  skinResult.avgBrightness
                )
              );
              return;
            }
          } catch {
            cachedFaceDetector = null;
          }
        }
        resolve(buildGuidanceFromBox(skinResult.box, skinResult.avgBrightness));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}
