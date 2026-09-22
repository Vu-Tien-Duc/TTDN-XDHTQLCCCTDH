/**
 * useKioskCamera.ts - Smart Camera Wake/Sleep Lifecycle Hook
 * 
 * Quản lý vòng đời camera thông minh cho thiết bị Kiosk:
 * - SLEEPING: Camera tắt hoàn toàn (track.stop()), tiết kiệm RAM/CPU/nhiệt
 * - WAKING: Đang khởi động camera HD (0.5-1.5s)
 * - ACTIVE: Camera HD hoạt động, sẵn sàng quét face
 * 
 * Cơ chế đánh thức:
 * 1. Motion Detection 144p (Web Worker) - tự động phát hiện người đi tới
 * 2. Touch/Click vào màn hình Kiosk - đánh thức thủ công
 * 3. Visibility change - phục hồi khi quay lại tab
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { createMotionWorker, MotionDetectorFallback } from './motionWorker';
import type { MotionResult } from './motionWorker';

export type CameraState = 'SLEEPING' | 'WAKING' | 'ACTIVE';

/** Độ phân giải thấp cho motion detection (160×120 = 144p) */
const LOW_RES_WIDTH = 160;
const LOW_RES_HEIGHT = 120;

/** Thời gian không phát hiện face trước khi camera ngủ (ms) */
const DEFAULT_SLEEP_TIMEOUT_MS = 15_000;

/** Tần suất phân tích motion khi camera ngủ (ms) - 2fps */
const MOTION_ANALYSIS_INTERVAL_MS = 500;

export interface UseKioskCameraOptions {
  /** Thời gian idle trước khi camera ngủ (ms). Mặc định 15000 */
  sleepTimeoutMs?: number;
  /** Bật/tắt motion detection tự động. Mặc định true */
  enableMotionDetection?: boolean;
  /** Độ phân giải camera HD mong muốn */
  hdWidth?: number;
  hdHeight?: number;
  /** Preferred camera device ID */
  preferredDeviceId?: string;
}

export interface UseKioskCameraReturn {
  /** Ref gắn vào <video> chính (HD) */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Camera đang active (stream HD đang chạy) */
  isCameraActive: boolean;
  /** Trạng thái camera: SLEEPING | WAKING | ACTIVE */
  cameraState: CameraState;
  /** Danh sách thiết bị camera khả dụng */
  cameraDevices: MediaDeviceInfo[];
  /** Device ID camera đang dùng */
  selectedCameraId: string;
  /** Chuyển camera khác */
  switchCamera: (deviceId: string) => void;
  /** Đánh thức camera thủ công (chạm màn hình) */
  forceWake: () => void;
  /** Ép camera ngủ (admin) */
  forceSleep: () => void;
  /** Reset bộ đếm sleep (gọi khi phát hiện face) */
  resetSleepTimer: () => void;
  /** Stream HD hiện tại (cho cleanup bên ngoài nếu cần) */
  streamRef: React.RefObject<MediaStream | null>;
}

export function useKioskCamera(options: UseKioskCameraOptions = {}): UseKioskCameraReturn {
  const {
    sleepTimeoutMs = DEFAULT_SLEEP_TIMEOUT_MS,
    enableMotionDetection = true,
    hdWidth = 1280,
    hdHeight = 720,
    preferredDeviceId,
  } = options;

  // === State ===
  const [cameraState, setCameraState] = useState<CameraState>('SLEEPING');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState(preferredDeviceId || '');

  // === Refs ===
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Motion detection refs
  const lowResVideoRef = useRef<HTMLVideoElement | null>(null);
  const lowResStreamRef = useRef<MediaStream | null>(null);
  const lowResCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const motionWorkerRef = useRef<Worker | null>(null);
  const motionFallbackRef = useRef<MotionDetectorFallback | null>(null);
  const motionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sleep timer ref
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tránh race condition khi wake/sleep đồng thời
  const isTransitioningRef = useRef(false);

  // Lưu selectedCameraId trong ref để callback không bị stale
  const selectedCameraIdRef = useRef(selectedCameraId);
  useEffect(() => {
    selectedCameraIdRef.current = selectedCameraId;
  }, [selectedCameraId]);

  // =====================================================================
  // CAMERA HD: Start / Stop
  // =====================================================================

  /** Dừng hoàn toàn stream HD - giải phóng tài nguyên */
  const stopHdStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, []);

  /** Khởi động camera HD (720p/1080p) */
  const startHdStream = useCallback(async (deviceId?: string): Promise<boolean> => {
    try {
      // Dừng stream cũ nếu có
      stopHdStream();

      const targetDeviceId = deviceId || selectedCameraIdRef.current;

      const constraints: MediaStreamConstraints = {
        video: targetDeviceId
          ? { deviceId: { exact: targetDeviceId }, width: { ideal: hdWidth }, height: { ideal: hdHeight } }
          : { width: { ideal: hdWidth }, height: { ideal: hdHeight }, facingMode: 'user' },
        audio: false,
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch {
        // Fallback nếu webcam không hỗ trợ resolution yêu cầu
        console.warn('[KioskCamera] Fallback sang chế độ camera linh hoạt');
        stream = await navigator.mediaDevices.getUserMedia({
          video: targetDeviceId ? { deviceId: { exact: targetDeviceId } } : true,
          audio: false,
        });
      }

      streamRef.current = stream;

      // Cập nhật danh sách thiết bị camera
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
        setCameraDevices(videoInputs);

        if (targetDeviceId) {
          setSelectedCameraId(targetDeviceId);
        } else if (stream.getVideoTracks().length > 0) {
          const settings = stream.getVideoTracks()[0].getSettings();
          if (settings.deviceId) {
            setSelectedCameraId(settings.deviceId);
          } else if (videoInputs.length > 0) {
            setSelectedCameraId(videoInputs[0].deviceId);
          }
        }
      } catch (e) {
        console.warn('[KioskCamera] Lỗi liệt kê camera:', e);
      }

      // Gắn stream vào video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch((err) => console.warn('[KioskCamera] Video play warning:', err));
        };
        await videoRef.current.play().catch(() => {});
      }

      setIsCameraActive(true);
      return true;
    } catch (err) {
      console.error('[KioskCamera] Lỗi mở camera HD:', err);
      setIsCameraActive(false);
      return false;
    }
  }, [stopHdStream, hdWidth, hdHeight]);

  // =====================================================================
  // MOTION DETECTION 144p: Luồng siêu nhẹ để phát hiện người đi tới
  // =====================================================================

  /** Dừng luồng motion detection 144p */
  const stopMotionDetection = useCallback(() => {
    if (motionIntervalRef.current) {
      clearInterval(motionIntervalRef.current);
      motionIntervalRef.current = null;
    }
    if (lowResStreamRef.current) {
      lowResStreamRef.current.getTracks().forEach((t) => t.stop());
      lowResStreamRef.current = null;
    }
    if (lowResVideoRef.current) {
      lowResVideoRef.current.srcObject = null;
    }
  }, []);

  /** Khởi động motion detection 144p + Web Worker */
  const startMotionDetection = useCallback(async (onMotionDetected: () => void) => {
    if (!enableMotionDetection) return;

    try {
      // Tạo hidden video element cho 144p stream
      if (!lowResVideoRef.current) {
        const el = document.createElement('video');
        el.setAttribute('autoplay', '');
        el.setAttribute('playsinline', '');
        el.setAttribute('muted', '');
        el.muted = true;
        el.style.display = 'none';
        document.body.appendChild(el);
        lowResVideoRef.current = el;
      }

      // Tạo hidden canvas cho lấy ImageData
      if (!lowResCanvasRef.current) {
        lowResCanvasRef.current = document.createElement('canvas');
        lowResCanvasRef.current.width = LOW_RES_WIDTH;
        lowResCanvasRef.current.height = LOW_RES_HEIGHT;
      }

      const targetDeviceId = selectedCameraIdRef.current;

      // Mở camera 144p (cực nhẹ ~0.1 MB RAM)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: targetDeviceId
          ? { deviceId: { exact: targetDeviceId }, width: { ideal: LOW_RES_WIDTH }, height: { ideal: LOW_RES_HEIGHT } }
          : { width: { ideal: LOW_RES_WIDTH }, height: { ideal: LOW_RES_HEIGHT }, facingMode: 'user' },
        audio: false,
      });

      lowResStreamRef.current = stream;
      lowResVideoRef.current.srcObject = stream;
      await lowResVideoRef.current.play().catch(() => {});

      // Khởi tạo Web Worker hoặc Fallback
      if (!motionWorkerRef.current && !motionFallbackRef.current) {
        const worker = createMotionWorker();
        if (worker) {
          motionWorkerRef.current = worker;
          worker.onmessage = (e: MessageEvent<MotionResult>) => {
            if (e.data.type === 'MOTION_RESULT' && e.data.motionDetected) {
              onMotionDetected();
            }
          };
        } else {
          motionFallbackRef.current = new MotionDetectorFallback();
        }
      }

      // Phân tích motion mỗi 500ms (2fps) - cực nhẹ
      motionIntervalRef.current = setInterval(() => {
        if (!lowResVideoRef.current || lowResVideoRef.current.readyState < 2) return;
        if (document.hidden) return; // Tiết kiệm khi tab ẩn

        const canvas = lowResCanvasRef.current!;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        ctx.drawImage(lowResVideoRef.current, 0, 0, LOW_RES_WIDTH, LOW_RES_HEIGHT);
        const imageData = ctx.getImageData(0, 0, LOW_RES_WIDTH, LOW_RES_HEIGHT);

        if (motionWorkerRef.current) {
          // Gửi sang Web Worker (off-thread)
          motionWorkerRef.current.postMessage({
            type: 'ANALYZE',
            imageData,
            width: LOW_RES_WIDTH,
            height: LOW_RES_HEIGHT,
          });
        } else if (motionFallbackRef.current) {
          // Fallback main-thread
          const result = motionFallbackRef.current.analyze(imageData);
          if (result.motionDetected) {
            onMotionDetected();
          }
        }
      }, MOTION_ANALYSIS_INTERVAL_MS);
    } catch (err) {
      console.warn('[KioskCamera] Không thể khởi động motion detection:', err);
    }
  }, [enableMotionDetection]);

  // =====================================================================
  // WAKE / SLEEP STATE MACHINE
  // =====================================================================

  /** Chuyển camera sang trạng thái ngủ */
  const goToSleep = useCallback(() => {
    if (isTransitioningRef.current) return;
    isTransitioningRef.current = true;

    // Dừng sleep timer nếu có
    if (sleepTimerRef.current) {
      clearTimeout(sleepTimerRef.current);
      sleepTimerRef.current = null;
    }

    // Tắt camera HD hoàn toàn
    stopHdStream();
    setCameraState('SLEEPING');

    // Bật motion detection 144p để canh người đi tới
    startMotionDetection(() => {
      // Callback khi phát hiện chuyển động → đánh thức camera
      wakeUp();
    });

    isTransitioningRef.current = false;
  }, [stopHdStream, startMotionDetection]);

  /** Đánh thức camera từ trạng thái ngủ */
  const wakeUp = useCallback(async () => {
    if (isTransitioningRef.current) return;
    isTransitioningRef.current = true;

    // Dừng motion detection (sẽ được bật lại khi ngủ)
    stopMotionDetection();

    setCameraState('WAKING');

    // Khởi động camera HD
    const success = await startHdStream();

    if (success) {
      setCameraState('ACTIVE');
      // Bắt đầu đếm sleep timer
      resetSleepTimerInternal();
    } else {
      // Nếu không mở được camera HD, quay lại sleep
      setCameraState('SLEEPING');
      startMotionDetection(() => wakeUp());
    }

    isTransitioningRef.current = false;
  }, [stopMotionDetection, startHdStream, startMotionDetection]);

  /** Reset bộ đếm sleep (gọi mỗi khi phát hiện face) */
  const resetSleepTimerInternal = useCallback(() => {
    if (sleepTimerRef.current) {
      clearTimeout(sleepTimerRef.current);
    }
    sleepTimerRef.current = setTimeout(() => {
      goToSleep();
    }, sleepTimeoutMs);
  }, [sleepTimeoutMs, goToSleep]);

  // Public API
  const resetSleepTimer = useCallback(() => {
    if (cameraState === 'ACTIVE') {
      resetSleepTimerInternal();
    }
  }, [cameraState, resetSleepTimerInternal]);

  const forceWake = useCallback(() => {
    if (cameraState !== 'ACTIVE') {
      wakeUp();
    }
  }, [cameraState, wakeUp]);

  const forceSleep = useCallback(() => {
    if (cameraState === 'ACTIVE') {
      goToSleep();
    }
  }, [cameraState, goToSleep]);

  const switchCamera = useCallback((deviceId: string) => {
    setSelectedCameraId(deviceId);
    if (cameraState === 'ACTIVE') {
      startHdStream(deviceId);
    }
  }, [cameraState, startHdStream]);

  // =====================================================================
  // LIFECYCLE: Khởi động ban đầu & Cleanup
  // =====================================================================

  // Khởi động ngay khi mount: bắt đầu ở trạng thái SLEEPING + motion detection
  useEffect(() => {
    // Bật camera ngay lần đầu (UX tốt hơn cho Kiosk mới khởi động)
    wakeUp();

    return () => {
      // === CLEANUP TOÀN DIỆN khi unmount ===
      // 1. Dừng sleep timer
      if (sleepTimerRef.current) {
        clearTimeout(sleepTimerRef.current);
        sleepTimerRef.current = null;
      }

      // 2. Dừng camera HD
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      // 3. Dừng motion detection
      if (motionIntervalRef.current) {
        clearInterval(motionIntervalRef.current);
        motionIntervalRef.current = null;
      }
      if (lowResStreamRef.current) {
        lowResStreamRef.current.getTracks().forEach((t) => t.stop());
        lowResStreamRef.current = null;
      }

      // 4. Terminate Web Worker
      if (motionWorkerRef.current) {
        motionWorkerRef.current.terminate();
        motionWorkerRef.current = null;
      }

      // 5. Gỡ hidden video element khỏi DOM
      if (lowResVideoRef.current) {
        lowResVideoRef.current.srcObject = null;
        lowResVideoRef.current.remove();
        lowResVideoRef.current = null;
      }

      // 6. Gỡ hidden canvas
      lowResCanvasRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Xử lý visibility change: phục hồi camera khi quay lại tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && cameraState === 'ACTIVE') {
        // Kiểm tra stream có còn active không
        if (!streamRef.current || !streamRef.current.active) {
          startHdStream();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [cameraState, startHdStream]);

  return {
    videoRef,
    isCameraActive,
    cameraState,
    cameraDevices,
    selectedCameraId,
    switchCamera,
    forceWake,
    forceSleep,
    resetSleepTimer,
    streamRef,
  };
}
