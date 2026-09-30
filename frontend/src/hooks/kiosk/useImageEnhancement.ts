/**
 * useImageEnhancement.ts - Image Quality & Luminance Analysis Hook
 * 
 * Tự động phân tích và tăng cường chất lượng hình ảnh cho môi trường Kiosk:
 * 
 * 1. Tính Luminance trung bình (ITU-R BT.601): L = 0.299*R + 0.587*G + 0.114*B
 * 2. Phân loại: TOO_DARK | LOW_LIGHT | OPTIMAL | TOO_BRIGHT
 * 3. Tự động điều chỉnh CSS filter cho video preview
 * 4. Tiền xử lý Canvas bằng gamma correction trước khi đưa vào AI model
 * 5. Hiển thị cảnh báo UX khi điều kiện ánh sáng kém
 */

import { useState, useRef, useCallback, useEffect } from 'react';

// =====================================================================
// TYPES
// =====================================================================

export type LightingCondition = 'TOO_DARK' | 'LOW_LIGHT' | 'OPTIMAL' | 'TOO_BRIGHT';

export interface UseImageEnhancementReturn {
  /** Luminance trung bình hiện tại (0-255) */
  luminance: number;
  /** Phân loại điều kiện ánh sáng */
  lightingCondition: LightingCondition;
  /** CSS filter tự động cho video preview */
  videoFilterStyle: React.CSSProperties;
  /** Thông báo cảnh báo cho người dùng (null = không cần cảnh báo) */
  warningMessage: string | null;
  /** Tiền xử lý frame trước khi đưa vào face-api.js */
  enhanceFrame: (sourceCanvas: HTMLCanvasElement) => HTMLCanvasElement;
  /** Trigger phân tích luminance thủ công */
  analyzeLuminance: (video: HTMLVideoElement) => number;
}

export interface UseImageEnhancementOptions {
  /** Ngưỡng TOO_DARK (default: 60) */
  darkThreshold?: number;
  /** Ngưỡng LOW_LIGHT (default: 100) */
  lowLightThreshold?: number;
  /** Ngưỡng TOO_BRIGHT (default: 200) */
  brightThreshold?: number;
  /** Tần suất phân tích luminance (ms, default: 2000) */
  analysisIntervalMs?: number;
  /** Bật/tắt tự động phân tích (default: true) */
  enabled?: boolean;
  /** Ref đến video element cần phân tích */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Chỉ phân tích khi camera active */
  isCameraActive: boolean;
}

// =====================================================================
// CONSTANTS
// =====================================================================

/** Ngưỡng phân loại ánh sáng mặc định */
const DEFAULTS = {
  darkThreshold: 60,
  lowLightThreshold: 100,
  brightThreshold: 200,
  analysisIntervalMs: 2000,
};

/** Kích thước canvas phân tích (nhỏ để nhanh) */
const ANALYSIS_SIZE = 64;

// =====================================================================
// HOOK
// =====================================================================

export function useImageEnhancement(options: UseImageEnhancementOptions): UseImageEnhancementReturn {
  const {
    darkThreshold = DEFAULTS.darkThreshold,
    lowLightThreshold = DEFAULTS.lowLightThreshold,
    brightThreshold = DEFAULTS.brightThreshold,
    analysisIntervalMs = DEFAULTS.analysisIntervalMs,
    enabled = true,
    videoRef,
    isCameraActive,
  } = options;

  const [luminance, setLuminance] = useState(128); // Giá trị mặc định = optimal
  const [lightingCondition, setLightingCondition] = useState<LightingCondition>('OPTIMAL');

  // Canvas tái sử dụng cho phân tích luminance (không tạo mới mỗi frame)
  const analysisCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // Canvas tái sử dụng cho tiền xử lý frame
  const enhanceCanvasRef = useRef<HTMLCanvasElement | null>(null);

  /**
   * Tính Luminance trung bình từ video frame
   * 
   * Thuật toán:
   * 1. Vẽ frame xuống canvas 64×64 (downsample cực nhanh)
   * 2. Lấy ImageData, sample 1/16 pixel
   * 3. Tính L = 0.299*R + 0.587*G + 0.114*B (ITU-R BT.601 weighted sum)
   * 4. Trả về trung bình L cho toàn frame
   * 
   * Độ phức tạp: O(64*64/16) = O(256) phép tính → cực nhẹ
   */
  const analyzeLuminance = useCallback((video: HTMLVideoElement): number => {
    if (!video || video.readyState < 2) return luminance;

    // Tái sử dụng canvas (không tạo mới)
    if (!analysisCanvasRef.current) {
      analysisCanvasRef.current = document.createElement('canvas');
      analysisCanvasRef.current.width = ANALYSIS_SIZE;
      analysisCanvasRef.current.height = ANALYSIS_SIZE;
    }

    const canvas = analysisCanvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return luminance;

    // Downsample video frame xuống 64×64
    ctx.drawImage(video, 0, 0, ANALYSIS_SIZE, ANALYSIS_SIZE);
    const imageData = ctx.getImageData(0, 0, ANALYSIS_SIZE, ANALYSIS_SIZE);
    const pixels = imageData.data;

    let totalLuminance = 0;
    let sampledCount = 0;
    const step = 16; // Sample 1/16 pixel (256 samples = đủ chính xác)

    for (let i = 0; i < pixels.length; i += 4 * step) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];

      // ITU-R BT.601 weighted luminance
      // Công thức chuẩn quốc tế cho perceived brightness
      totalLuminance += 0.299 * r + 0.587 * g + 0.114 * b;
      sampledCount++;
    }

    return sampledCount > 0 ? Math.round(totalLuminance / sampledCount) : 128;
  }, [luminance]);

  /**
   * Phân loại điều kiện ánh sáng từ giá trị luminance
   */
  const classifyLighting = useCallback((lum: number): LightingCondition => {
    if (lum < darkThreshold) return 'TOO_DARK';
    if (lum < lowLightThreshold) return 'LOW_LIGHT';
    if (lum > brightThreshold) return 'TOO_BRIGHT';
    return 'OPTIMAL';
  }, [darkThreshold, lowLightThreshold, brightThreshold]);

  /**
   * Tạo CSS filter tự động dựa trên điều kiện ánh sáng
   * 
   * Logic:
   * - TOO_DARK: Tăng brightness mạnh (1.5) + contrast (1.2) để nhìn rõ hơn
   * - LOW_LIGHT: Tăng nhẹ brightness (1.25) + contrast (1.1)
   * - OPTIMAL: Không filter (giữ nguyên)
   * - TOO_BRIGHT: Giảm brightness (0.85) + tăng contrast nhẹ (1.05)
   */
  const getVideoFilter = useCallback((condition: LightingCondition): React.CSSProperties => {
    switch (condition) {
      case 'TOO_DARK':
        return {
          filter: 'brightness(1.45) contrast(1.2) saturate(106%)',
          imageRendering: '-webkit-optimize-contrast',
        };
      case 'LOW_LIGHT':
        return {
          filter: 'brightness(1.2) contrast(1.12) saturate(106%)',
          imageRendering: '-webkit-optimize-contrast',
        };
      case 'TOO_BRIGHT':
        return {
          filter: 'brightness(0.88) contrast(1.08) saturate(102%)',
          imageRendering: '-webkit-optimize-contrast',
        };
      case 'OPTIMAL':
      default:
        return {
          filter: 'contrast(108%) brightness(102%) saturate(106%)',
          imageRendering: '-webkit-optimize-contrast',
        };
    }
  }, []);

  /**
   * Tạo thông báo cảnh báo cho người dùng
   */
  const getWarningMessage = useCallback((condition: LightingCondition): string | null => {
    switch (condition) {
      case 'TOO_DARK':
        return '⚠ Ánh sáng quá yếu — Vui lòng đứng vào vùng sáng hoặc bật đèn để nhận diện chính xác';
      case 'LOW_LIGHT':
        return '💡 Ánh sáng hơi yếu — Tiến lại gần camera hoặc đứng vào vùng sáng hơn';
      case 'TOO_BRIGHT':
        return '☀ Ngược sáng — Vui lòng tránh ánh nắng trực tiếp chiếu vào camera';
      default:
        return null;
    }
  }, []);

  /**
   * Tiền xử lý frame bằng Gamma Correction trước khi đưa vào face-api.js
   * 
   * Thuật toán Gamma Correction:
   * - output = 255 * (input / 255) ^ (1 / gamma)
   * - gamma > 1: Làm sáng ảnh tối (dùng khi TOO_DARK / LOW_LIGHT)
   * - gamma < 1: Làm tối ảnh sáng (dùng khi TOO_BRIGHT)
   * - gamma = 1: Không thay đổi (OPTIMAL)
   * 
   * Sử dụng Lookup Table (LUT) 256 giá trị để tối ưu:
   * Thay vì tính Math.pow() cho từng pixel (~1M lần), tính trước 256 giá trị
   * rồi tra bảng → nhanh hơn ~100x
   */
  const enhanceFrame = useCallback((sourceCanvas: HTMLCanvasElement): HTMLCanvasElement => {
    // Nếu ánh sáng tốt, trả về canvas gốc (zero-cost)
    if (lightingCondition === 'OPTIMAL') return sourceCanvas;

    // Tái sử dụng canvas tiền xử lý
    if (!enhanceCanvasRef.current) {
      enhanceCanvasRef.current = document.createElement('canvas');
    }

    const outCanvas = enhanceCanvasRef.current;
    outCanvas.width = sourceCanvas.width;
    outCanvas.height = sourceCanvas.height;

    const srcCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
    const outCtx = outCanvas.getContext('2d', { willReadFrequently: true });
    if (!srcCtx || !outCtx) return sourceCanvas;

    const imageData = srcCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    const pixels = imageData.data;

    // Xác định gamma dựa trên điều kiện ánh sáng
    let gamma: number;
    switch (lightingCondition) {
      case 'TOO_DARK': gamma = 1.8; break;   // Tăng sáng mạnh
      case 'LOW_LIGHT': gamma = 1.3; break;  // Tăng sáng nhẹ
      case 'TOO_BRIGHT': gamma = 0.7; break; // Giảm sáng
      default: gamma = 1.0;
    }

    // Tạo Lookup Table (LUT) - tính trước 256 giá trị gamma
    const lut = new Uint8Array(256);
    const invGamma = 1.0 / gamma;
    for (let i = 0; i < 256; i++) {
      lut[i] = Math.min(255, Math.round(255 * Math.pow(i / 255, invGamma)));
    }

    // Áp dụng LUT lên toàn bộ pixel (tra bảng, không tính toán)
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = lut[pixels[i]];       // R
      pixels[i + 1] = lut[pixels[i + 1]]; // G
      pixels[i + 2] = lut[pixels[i + 2]]; // B
      // Alpha giữ nguyên
    }

    outCtx.putImageData(imageData, 0, 0);
    return outCanvas;
  }, [lightingCondition]);

  // =====================================================================
  // AUTO ANALYSIS LOOP: Phân tích luminance định kỳ
  // =====================================================================

  useEffect(() => {
    if (!enabled || !isCameraActive) return;

    const interval = setInterval(() => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;
      if (document.hidden) return;

      const lum = analyzeLuminance(videoRef.current);
      const condition = classifyLighting(lum);

      setLuminance(lum);
      setLightingCondition(condition);
    }, analysisIntervalMs);

    return () => clearInterval(interval);
  }, [enabled, isCameraActive, analysisIntervalMs, videoRef, analyzeLuminance, classifyLighting]);

  // =====================================================================
  // CLEANUP
  // =====================================================================

  useEffect(() => {
    return () => {
      analysisCanvasRef.current = null;
      enhanceCanvasRef.current = null;
    };
  }, []);

  return {
    luminance,
    lightingCondition,
    videoFilterStyle: getVideoFilter(lightingCondition),
    warningMessage: getWarningMessage(lightingCondition),
    enhanceFrame,
    analyzeLuminance,
  };
}
