/**
 * useFaceScanLoop.ts - Performance-Optimized Face Detection Loop
 * 
 * Vòng lặp quét khuôn mặt tối ưu hiệu năng cho thiết bị Kiosk:
 * 
 * 1. requestAnimationFrame thay setInterval → đồng bộ với refresh rate, không block UI
 * 2. Frame rate throttling (mặc định 7fps) → giảm tải CPU đáng kể
 * 3. Circular buffer cho blink/motion history → không memory leak từ push/shift
 * 4. Tái sử dụng canvas buffer → không tạo DOM element mỗi frame
 * 5. Abort-safe API calls → hủy request khi unmount
 * 6. Full cleanup khi unmount
 */

import { useRef, useCallback, useEffect } from 'react';
import * as faceapi from '@vladmandic/face-api';
import type { KioskMode, KioskState, CheckInResult } from './useFaceScanTypes';
import { attendanceApi } from '../../api';

// =====================================================================
// CIRCULAR BUFFER: Cấu trúc dữ liệu cố định, không memory leak
// =====================================================================

/**
 * Circular Buffer với kích thước cố định
 * 
 * Thay vì push/shift (tạo GC pressure mỗi frame), buffer này:
 * - Pre-allocate đúng kích thước cần thiết
 * - Ghi đè phần tử cũ nhất khi đầy (zero allocation)
 * - O(1) cho cả push và truy cập
 */
class CircularBuffer {
  private buffer: Float64Array;
  private head = 0;
  private count = 0;

  constructor(private capacity: number) {
    this.buffer = new Float64Array(capacity);
  }

  push(value: number) {
    this.buffer[this.head] = value;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
  }

  /** Lấy tất cả giá trị hợp lệ (từ cũ → mới) */
  getAll(): number[] {
    if (this.count === 0) return [];
    const result: number[] = [];
    const start = this.count < this.capacity ? 0 : this.head;
    for (let i = 0; i < this.count; i++) {
      result.push(this.buffer[(start + i) % this.capacity]);
    }
    return result;
  }

  get length() { return this.count; }

  getMin(): number {
    if (this.count === 0) return 0;
    let min = Infinity;
    const start = this.count < this.capacity ? 0 : this.head;
    for (let i = 0; i < this.count; i++) {
      const val = this.buffer[(start + i) % this.capacity];
      if (val < min) min = val;
    }
    return min;
  }

  getMax(): number {
    if (this.count === 0) return 0;
    let max = -Infinity;
    const start = this.count < this.capacity ? 0 : this.head;
    for (let i = 0; i < this.count; i++) {
      const val = this.buffer[(start + i) % this.capacity];
      if (val > max) max = val;
    }
    return max;
  }

  getAverage(): number {
    if (this.count === 0) return 0;
    let sum = 0;
    const start = this.count < this.capacity ? 0 : this.head;
    for (let i = 0; i < this.count; i++) {
      sum += this.buffer[(start + i) % this.capacity];
    }
    return sum / this.count;
  }

  reset() {
    this.head = 0;
    this.count = 0;
  }
}

// =====================================================================
// EAR CALCULATION: Eye Aspect Ratio cho Liveness Detection
// =====================================================================

/**
 * Tính Eye Aspect Ratio (EAR) từ 68 điểm landmarks
 * 
 * EAR = (||p2-p6|| + ||p3-p5||) / (2 * ||p1-p4||)
 * 
 * Khi mắt mở: EAR ~ 0.25-0.35
 * Khi mắt nhắm: EAR < 0.15
 * Chênh lệch EAR > 0.08 giữa max/min trong 12 frame → đã chớp mắt
 */
const calculateEAR = (landmarks: faceapi.FaceLandmarks68): number => {
  const pts = landmarks.positions;
  const dist = (p1: faceapi.Point, p2: faceapi.Point) => Math.hypot(p1.x - p2.x, p1.y - p2.y);

  // Left Eye: landmarks 36-41
  const leftEAR = (dist(pts[37], pts[41]) + dist(pts[38], pts[40])) / (2 * dist(pts[36], pts[39]));
  // Right Eye: landmarks 42-47
  const rightEAR = (dist(pts[43], pts[47]) + dist(pts[44], pts[46])) / (2 * dist(pts[42], pts[45]));

  return (leftEAR + rightEAR) / 2;
};

// =====================================================================
// HOOK OPTIONS & CALLBACKS
// =====================================================================

export interface UseFaceScanLoopOptions {
  /** Ref đến video element */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Ref đến canvas overlay */
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  /** Vòng quét đang active (camera ready + model loaded) */
  isActive: boolean;
  /** Target FPS (mặc định 7 = ~143ms/frame) */
  targetFps?: number;
  /** Bật chế độ lật gương selfie (mặc định true) */
  isMirrored?: boolean;
  /** Chế độ Kiosk hiện tại */
  kioskMode: KioskMode;
  /** Hàm tiền xử lý frame trước khi nhận diện (từ useImageEnhancement) */
  enhanceFrame?: (canvas: HTMLCanvasElement) => HTMLCanvasElement;
  /** Callback khi state machine thay đổi */
  onStateChange: (state: KioskState) => void;
  /** Callback khi progress thay đổi (0-100) */
  onProgressChange: (progress: number) => void;
  /** Callback khi liveness hint thay đổi */
  onLivenessHint: (hint: string | null) => void;
  /** Callback khi phát hiện khuôn mặt (dùng để reset sleep timer) */
  onFaceDetected?: () => void;
  /** Callback khi không có khuôn mặt */
  onNoFace?: () => void;
  /** Callback khi API trả kết quả thành công */
  onApiResult: (result: CheckInResult) => void;
  /** Callback khi API lỗi */
  onApiError: (message: string) => void;
  /** Hàm phát âm thanh */
  playBeep: (success: boolean) => void;
}

// =====================================================================
// FACE SCAN LOOP HOOK
// =====================================================================

export function useFaceScanLoop(options: UseFaceScanLoopOptions) {
  const {
    videoRef,
    canvasRef,
    isActive,
    targetFps = 7,
    isMirrored = true,
    kioskMode,
    enhanceFrame,
    onStateChange,
    onProgressChange,
    onLivenessHint,
    onFaceDetected,
    onNoFace,
    onApiResult,
    onApiError,
    playBeep,
  } = options;

  const isMirroredRef = useRef(isMirrored);
  isMirroredRef.current = isMirrored;

  // Refs cho trạng thái internal (tránh re-render liên tục)
  const isProcessingRef = useRef(false);
  const isCallingApiRef = useRef(false);
  const cooldownRef = useRef(false);
  const toastCooldownRef = useRef(false);
  const rafIdRef = useRef<number>(0);
  const lastFrameTimeRef = useRef(0);

  // Stability tracking
  const stableCountRef = useRef(0);
  const lastDescriptorRef = useRef<Float32Array | null>(null);
  const lastNosePosRef = useRef<{ x: number; y: number } | null>(null);

  // Circular buffers cho liveness detection (capacity: 12 frames)
  const blinkBufferRef = useRef(new CircularBuffer(12));
  const motionBufferRef = useRef(new CircularBuffer(12));

  // Canvas buffer tái sử dụng cho snapshot (không tạo mới mỗi frame)
  const snapshotCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // AbortController cho API call đang chạy
  const abortControllerRef = useRef<AbortController | null>(null);

  // Refs cho options (tránh stale closure)
  const kioskModeRef = useRef(kioskMode);
  useEffect(() => { kioskModeRef.current = kioskMode; }, [kioskMode]);

  const enhanceFrameRef = useRef(enhanceFrame);
  useEffect(() => { enhanceFrameRef.current = enhanceFrame; }, [enhanceFrame]);

  // Khoảng thời gian tối thiểu giữa 2 frame (ms)
  const frameIntervalMs = 1000 / targetFps;

  /**
   * Vẽ khung bám 4 góc công nghệ cao
   */
  const drawCornerBrackets = useCallback((
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    color: string, isTarget: boolean, progress: number
  ) => {
    const len = Math.min(24, w * 0.2);
    ctx.lineWidth = isTarget ? 3.5 : 1.5;
    ctx.strokeStyle = color;
    ctx.beginPath();

    // 4 góc
    ctx.moveTo(x, y + len); ctx.lineTo(x, y); ctx.lineTo(x + len, y);
    ctx.moveTo(x + w - len, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + len);
    ctx.moveTo(x + w, y + h - len); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - len, y + h);
    ctx.moveTo(x + len, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - len);
    ctx.stroke();

    // Thanh tiến trình
    if (isTarget && progress > 0) {
      const barY = Math.max(8, y - 10);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
      ctx.fillRect(x, barY, w, 6);
      ctx.fillStyle = color;
      ctx.fillRect(x, barY, (w * progress) / 100, 6);
    }
  }, []);

  // =====================================================================
  // MAIN SCAN LOOP (requestAnimationFrame-based)
  // =====================================================================

  useEffect(() => {
    if (!isActive) return;

    let isMounted = true;

    const scanFrame = async (timestamp: number) => {
      if (!isMounted) return;

      // Throttle: Chỉ xử lý nếu đã qua đủ thời gian kể từ frame trước
      const elapsed = timestamp - lastFrameTimeRef.current;
      if (elapsed < frameIntervalMs) {
        rafIdRef.current = requestAnimationFrame(scanFrame);
        return;
      }
      lastFrameTimeRef.current = timestamp;

      // Guard conditions
      if (document.hidden) {
        rafIdRef.current = requestAnimationFrame(scanFrame);
        return;
      }
      if (!videoRef.current || isProcessingRef.current || cooldownRef.current) {
        rafIdRef.current = requestAnimationFrame(scanFrame);
        return;
      }
      if (videoRef.current.readyState < 2) {
        rafIdRef.current = requestAnimationFrame(scanFrame);
        return;
      }

      try {
        isProcessingRef.current = true;
        const video = videoRef.current;
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;
        const centerX = videoWidth / 2;
        const centerY = videoHeight / 2;
        const maxDistance = Math.hypot(centerX, centerY);

        // Face detection (đồng thời landmarks + descriptor)
        const detections = await faceapi
          .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.45 }))
          .withFaceLandmarks()
          .withFaceDescriptors();

        if (detections && detections.length > 0) {
          onFaceDetected?.();

          // Tìm Target Face: khuôn mặt trung tâm + lớn nhất
          let targetFace = detections[0];
          let bestScore = -Infinity;

          for (const d of detections) {
            const box = d.detection.box;
            const faceCenterX = box.x + box.width / 2;
            const faceCenterY = box.y + box.height / 2;
            const distToCenter = Math.hypot(faceCenterX - centerX, faceCenterY - centerY);
            const centerWeight = Math.max(0.3, 1.0 - 0.7 * (distToCenter / maxDistance));
            const area = box.width * box.height;
            const score = area * centerWeight;

            if (score > bestScore) {
              bestScore = score;
              targetFace = d;
            }
          }

          const targetBox = targetFace.detection.box;
          const faceRatio = targetBox.width / videoWidth;

          if (faceRatio < 0.16) {
            // Mặt quá xa
            stableCountRef.current = 0;
            onProgressChange(0);
            if (!isCallingApiRef.current && !cooldownRef.current) {
              onStateChange('DETECTING');
            }
          } else {
            // Kiểm tra ổn định vector khuôn mặt (3 frame liên tiếp)
            if (lastDescriptorRef.current) {
              const d = faceapi.euclideanDistance(targetFace.descriptor, lastDescriptorRef.current);
              stableCountRef.current = d < 0.35 ? stableCountRef.current + 1 : 1;
            } else {
              stableCountRef.current = 1;
            }
            lastDescriptorRef.current = targetFace.descriptor;

            // Liveness: EAR + micro-motion
            const ear = calculateEAR(targetFace.landmarks);
            blinkBufferRef.current.push(ear);

            const nose = targetFace.landmarks.positions[30];
            const faceW = targetBox.width;
            if (lastNosePosRef.current) {
              const move = Math.hypot(
                nose.x - lastNosePosRef.current.x,
                nose.y - lastNosePosRef.current.y
              ) / faceW;
              motionBufferRef.current.push(move);
            }
            lastNosePosRef.current = { x: nose.x, y: nose.y };

            const maxEAR = blinkBufferRef.current.getMax();
            const minEAR = blinkBufferRef.current.getMin();
            const blinked = blinkBufferRef.current.length >= 6 && (maxEAR - minEAR) > 0.08;
            const avgMotion = motionBufferRef.current.getAverage();
            const alive = blinked || avgMotion > 0.004;

            const progress = Math.min(100, Math.round((stableCountRef.current / 3) * 100));
            onProgressChange(progress);

            if (stableCountRef.current < 3) {
              if (!isCallingApiRef.current && !cooldownRef.current) {
                onStateChange('DETECTING');
              }
              onLivenessHint(null);
            } else if (!alive) {
              if (!isCallingApiRef.current && !cooldownRef.current) {
                onStateChange('DETECTING');
              }
              onLivenessHint('Vui lòng nháy mắt hoặc quay nhẹ đầu để xác thực người thật');
            } else if (!isCallingApiRef.current && !cooldownRef.current) {
              // === ĐỦ 3 FRAME + LIVENESS OK → GỌI API ===
              onLivenessHint(null);
              isCallingApiRef.current = true;
              stableCountRef.current = 0;
              onStateChange('VERIFYING');

              // Snapshot frame minh chứng độ nét cao chuẩn hóa (tái sử dụng canvas)
              let capturedImage: string | undefined;
              try {
                const vw = videoRef.current?.videoWidth || 640;
                const vh = videoRef.current?.videoHeight || 480;
                const snapWidth = Math.min(640, vw);
                const snapHeight = Math.round(snapWidth * (vh / vw));

                if (!snapshotCanvasRef.current) {
                  snapshotCanvasRef.current = document.createElement('canvas');
                }
                snapshotCanvasRef.current.width = snapWidth;
                snapshotCanvasRef.current.height = snapHeight;

                const tCtx = snapshotCanvasRef.current.getContext('2d');
                if (tCtx && videoRef.current) {
                  tCtx.imageSmoothingEnabled = true;
                  tCtx.imageSmoothingQuality = 'high';
                  if (isMirroredRef.current) {
                    tCtx.save();
                    tCtx.translate(snapWidth, 0);
                    tCtx.scale(-1, 1);
                    tCtx.drawImage(videoRef.current, 0, 0, snapWidth, snapHeight);
                    tCtx.restore();
                  } else {
                    tCtx.drawImage(videoRef.current, 0, 0, snapWidth, snapHeight);
                  }
                  capturedImage = snapshotCanvasRef.current.toDataURL('image/jpeg', 0.82);
                }
              } catch { /* ignore */ }

              // API call với AbortController
              const abortController = new AbortController();
              abortControllerRef.current = abortController;
              const timeoutId = setTimeout(() => abortController.abort(), 5000);

              attendanceApi
                .faceCheckIn({
                  faceDescriptor: Array.from(targetFace.descriptor),
                  mode: kioskModeRef.current,
                  capturedImage,
                  signal: abortController.signal,
                })
                .then((res) => {
                  clearTimeout(timeoutId);
                  isCallingApiRef.current = false;
                  abortControllerRef.current = null;

                  if (res && res.success) {
                    const checkInResult: CheckInResult = { ...res.data, scannedAt: new Date() };
                    onApiResult(checkInResult);
                    onStateChange('SUCCESS');
                    playBeep(true);
                    cooldownRef.current = true;

                    setTimeout(() => {
                      onStateChange('IDLE');
                      onProgressChange(0);
                      cooldownRef.current = false;
                    }, 4000);
                  }
                })
                .catch((err: any) => {
                  clearTimeout(timeoutId);
                  isCallingApiRef.current = false;
                  abortControllerRef.current = null;

                  if (err.name === 'AbortError' || err.name === 'CanceledError') return;

                  const responseData = err.response?.data;
                  const msg = responseData?.message || err.message || 'Không thể xác thực danh tính.';
                  const extraDistance = responseData?.data?.distance;
                  const displayError = extraDistance !== undefined && extraDistance !== null
                    ? `${msg} (Độ lệch vector: ${(extraDistance * 100).toFixed(1)}%)`
                    : msg;

                  onApiError(displayError);
                  onStateChange('ERROR');
                  playBeep(false);
                  cooldownRef.current = true;

                  setTimeout(() => {
                    onStateChange('IDLE');
                    onProgressChange(0);
                    cooldownRef.current = false;
                  }, 4000);
                });
            }
          }

          // === VẼ BOUNDING BOX lên Canvas ===
          if (canvasRef.current) {
            const canvas = canvasRef.current;
            const displaySize = { width: videoWidth, height: videoHeight };
            faceapi.matchDimensions(canvas, displaySize);
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);

              for (const d of detections) {
                const resized = faceapi.resizeResults(d, displaySize);
                const { x, y, width, height } = resized.detection.box;
                const isTarget = d === targetFace;

                // Mirror X cho camera selfie nếu đang bật chế độ gương
                const drawX = isMirroredRef.current ? displaySize.width - (x + width) : x;

                const curState = isCallingApiRef.current ? 'VERIFYING' : cooldownRef.current ? 'SUCCESS' : 'DETECTING';
                const color = isTarget
                  ? curState === 'VERIFYING' ? '#38bdf8'
                    : curState === 'SUCCESS' ? '#10b981'
                      : '#a855f7'
                  : '#64748b';

                const curProgress = Math.min(100, Math.round((stableCountRef.current / 3) * 100));
                drawCornerBrackets(ctx, drawX, y, width, height, color, isTarget, isTarget ? curProgress : 0);

                // Badge trạng thái
                const badgeWidth = isTarget ? 170 : 110;
                ctx.fillStyle = isTarget ? 'rgba(15, 23, 42, 0.85)' : 'rgba(30, 41, 59, 0.7)';
                ctx.strokeStyle = color;
                ctx.lineWidth = 1;
                ctx.strokeRect(drawX, Math.max(0, y - 24), badgeWidth, 22);
                ctx.fillRect(drawX, Math.max(0, y - 24), badgeWidth, 22);

                ctx.fillStyle = isTarget ? '#ffffff' : '#94a3b8';
                ctx.font = isTarget ? 'bold 11px sans-serif' : '10px sans-serif';
                ctx.fillText(
                  isTarget
                    ? curState === 'VERIFYING' ? '● ĐANG ĐỐI SOÁT AI...'
                      : curState === 'SUCCESS' ? '✓ XÁC THỰC THÀNH CÔNG'
                        : `★ ĐIỂM DANH (${curProgress}%)`
                    : 'Người qua lại',
                  drawX + 6,
                  Math.max(15, y - 9)
                );
              }
            }
          }
        } else {
          // === KHÔNG CÓ KHUÔN MẶT ===
          stableCountRef.current = 0;
          onProgressChange(0);
          if (!isCallingApiRef.current && !cooldownRef.current) {
            onStateChange('IDLE');
          }
          onLivenessHint(null);
          onNoFace?.();

          if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          }
        }
      } catch {
        // Ignored - face-api errors
      } finally {
        isProcessingRef.current = false;
      }

      // Tiếp tục loop
      if (isMounted) {
        rafIdRef.current = requestAnimationFrame(scanFrame);
      }
    };

    // Khởi động loop
    rafIdRef.current = requestAnimationFrame(scanFrame);

    return () => {
      // === CLEANUP TOÀN DIỆN ===
      isMounted = false;

      // 1. Dừng requestAnimationFrame
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = 0;
      }

      // 2. Hủy API call đang chạy
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      // 3. Reset refs
      isProcessingRef.current = false;
      isCallingApiRef.current = false;
      cooldownRef.current = false;
      stableCountRef.current = 0;
      lastDescriptorRef.current = null;
      lastNosePosRef.current = null;
      blinkBufferRef.current.reset();
      motionBufferRef.current.reset();
    };
  }, [
    isActive, frameIntervalMs, videoRef, canvasRef,
    onStateChange, onProgressChange, onLivenessHint,
    onFaceDetected, onNoFace, onApiResult, onApiError,
    playBeep, drawCornerBrackets,
  ]);

  // Cleanup snapshot canvas on unmount
  useEffect(() => {
    return () => {
      snapshotCanvasRef.current = null;
    };
  }, []);
}
