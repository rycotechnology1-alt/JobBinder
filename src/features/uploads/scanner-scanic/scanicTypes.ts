import type { CornerPoints, DetectionOptions } from "scanic";

export type ScanicDetectionMode = "live" | "capture" | "fallback";

export type ScanicFrameDimensions = {
  width: number;
  height: number;
};

export type ScannerResult = {
  file: File;
  pageCount: number;
  source: "scan";
  metadata?: {
    scannerProvider: "scanic";
    enhancementMode?: string;
    detectionMode?: ScanicDetectionMode;
  };
};

export interface DocumentScannerProvider {
  openScanner(options: {
    maxPages?: number;
    defaultFileName?: string;
  }): Promise<ScannerResult>;
}

export type ScanicPage = {
  id: string;
  blob: Blob;
  objectUrl: string;
  width: number;
  height: number;
  detectionMode: ScanicDetectionMode;
  corners?: ScanicCorners | null;
  confidence?: number | null;
};

export type ScanicCapture = {
  blob: Blob;
  width: number;
  height: number;
  detectionMode: ScanicDetectionMode;
  corners?: ScanicCorners | null;
  confidence?: number | null;
  sourceWidth?: number;
  sourceHeight?: number;
  detectionFrame?: ScanicFrameDimensions | null;
  displayFrame?: ScanicFrameDimensions | null;
  needsCornerReview?: boolean;
};

export type ScanicCorners = CornerPoints;

export type ScanicOptions = DetectionOptions;
