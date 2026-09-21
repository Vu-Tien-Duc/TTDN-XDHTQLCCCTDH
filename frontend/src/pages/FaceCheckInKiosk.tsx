import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as faceapi from '@vladmandic/face-api';
import {
  CheckCircle2,
  Clock,
  Upload,
  AlertTriangle,
  Volume2,
  VolumeX,
  Maximize2,
  Building,
  Sparkles,
  LogIn,
  LogOut,
  Timer,
  UserCheck,
  ShieldCheck,
  History,
  Activity,
  QrCode,
  Compass,
  MapPin,
  ShieldAlert,
  Radio,
  RefreshCw,
  Smartphone,
  Check,
  Camera,
  CameraOff,
  ArrowLeft,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { attendanceApi } from '../api';
import { toast } from 'react-hot-toast';
import { generateQrSvg } from '../utils/qrCode';
import { formatAvatarUrl } from '../utils';

type KioskMode = 'auto' | 'check_in' | 'check_out';
type KioskState = 'IDLE' | 'DETECTING' | 'VERIFYING' | 'SUCCESS' | 'ERROR';

interface CheckInResult {
  action?: 'CHECK_IN' | 'CHECK_OUT';
  user: {
    _id: string;
    fullName: string;
    email: string;
    avatar?: string;
    role: string;
  };
  attendance: any;
  confidenceScore: number;
  distance: number;
  statusText?: string;
  status?: string;
  workingDuration?: {
    totalMinutes: number;
    formatted: string;
  };
  earlyLeave?: {
    isEarlyLeave: boolean;
    earlyMinutes: number;
  };
  checkOutTime?: string;
  checkInTime?: string;
  scannedAt?: Date | string;
}

// Che email trên màn hình công cộng (P0 - Item 3)
const maskEmail = (email?: string): string => {
  if (!email || !email.includes('@')) return email || '';
  const [name, domain] = email.split('@');
  if (name.length <= 2) return `${name}***@${domain}`;
  return `${name[0]}****${name[name.length - 1]}@${domain}`;
};

// Tính Eye Aspect Ratio (EAR) từ 68 điểm landmarks để kiểm tra chớp mắt (P2 - Item 13)
const calculateEAR = (landmarks: faceapi.FaceLandmarks68): number => {
  const pts = landmarks.positions;
  const dist = (p1: faceapi.Point, p2: faceapi.Point) => Math.hypot(p1.x - p2.x, p1.y - p2.y);

  // Left Eye: 36 - 41
  const leftEAR = (dist(pts[37], pts[41]) + dist(pts[38], pts[40])) / (2 * dist(pts[36], pts[39]));
  // Right Eye: 42 - 47
  const rightEAR = (dist(pts[43], pts[47]) + dist(pts[44], pts[46])) / (2 * dist(pts[42], pts[45]));

  return (leftEAR + rightEAR) / 2;
};

export const FaceCheckInKiosk: React.FC = () => {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [modelReady, setModelReady] = useState(false);
  const [isScanning, setIsScanning] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [kioskMode, setKioskMode] = useState<KioskMode>('auto');
  const [kioskState, setKioskState] = useState<KioskState>('IDLE');
  const [detectionProgress, setDetectionProgress] = useState(0); // 0 - 100%
  const [livenessHint, setLivenessHint] = useState<string | null>(null);

  // Lịch sử 5 lượt quét gần nhất hiển thị tại Kiosk (P3 - Item 17)
  const [recentScans, setRecentScans] = useState<CheckInResult[]>([]);

  const [result, setResult] = useState<CheckInResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Tab hiển thị: Camera Face ID hoặc Màn hình QR Code Động
  const [displayTab, setDisplayTab] = useState<'face' | 'qr'>('face');

  // Bảo mật 2 lớp (2FA): Face ID + Tọa độ GPS Geofencing thực tế của thiết bị
  const [is2FaGpsEnabled, setIs2FaGpsEnabled] = useState(true);
  const [kioskCoords, setKioskCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [kioskGpsAccuracy, setKioskGpsAccuracy] = useState<number | null>(null);
  const [twoFaSecurityAlert, setTwoFaSecurityAlert] = useState<string | null>(null);

  // Màn hình mã QR Động TOTP (20 giây)
  const [dynamicQrSvg, setDynamicQrSvg] = useState<string>('');
  const [qrToken, setQrToken] = useState<string>('');
  const [qrCountdown, setQrCountdown] = useState<number>(20);
  const [isLoadingQr, setIsLoadingQr] = useState<boolean>(false);

  // Quản lý thiết bị Camera thực tế & xử lý đa webcam
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isProcessingRef = useRef(false);
  const isCallingApiRef = useRef(false);
  const cooldownRef = useRef(false);
  const toastCooldownRef = useRef(false);
  const kioskModeRef = useRef<KioskMode>(kioskMode);

  // Giữ state trong ref để tránh re-trigger interval liên tục (Issue 1)
  const kioskStateRef = useRef<KioskState>('IDLE');
  const progressRef = useRef(0);

  const setState = useCallback((s: KioskState) => {
    kioskStateRef.current = s;
    setKioskState(s);
  }, []);

  const setProgress = useCallback((p: number) => {
    progressRef.current = p;
    setDetectionProgress(p);
  }, []);

  // Bộ đệm ổn định khuôn mặt 3 frame liên tiếp & Liveness (P1 - Item 4, Issue 2)
  const stableCountRef = useRef(0);
  const lastDescriptorRef = useRef<Float32Array | null>(null);
  const lastNosePosRef = useRef<{ x: number; y: number } | null>(null);
  const blinkHistoryRef = useRef<number[]>([]);
  const motionHistoryRef = useRef<number[]>([]);

  // Tái sử dụng AudioContext 1 lần duy nhất trong useRef (P3 - Item 20)
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    kioskModeRef.current = kioskMode;
  }, [kioskMode]);

  // 1. Đồng hồ thời gian thực
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Lấy tọa độ GPS thực tế của thiết bị Kiosk từ chip vệ tinh
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setKioskCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setKioskGpsAccuracy(pos.coords.accuracy);
        },
        (err) => console.warn('[Kiosk] Không lấy được GPS thực tế:', err),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  }, []);

  // Lấy mã QR động từ máy chủ (hiệu lực 20 giây)
  const fetchNewQrCode = useCallback(async () => {
    try {
      setIsLoadingQr(true);
      const res = await attendanceApi.generateQRCode({ roomId: 'KIOSK_MAIN_HALL' });
      if (res && res.success && res.data?.qrToken) {
        setQrToken(res.data.qrToken);
        const svg = generateQrSvg(res.data.qrToken);
        setDynamicQrSvg(svg);
        setQrCountdown(20);
      }
    } catch (err) {
      console.error('Lỗi sinh mã QR Kiosk:', err);
    } finally {
      setIsLoadingQr(false);
    }
  }, []);

  // Quản lý đếm ngược 20s và tự động đổi mã QR
  useEffect(() => {
    if (displayTab === 'qr') {
      fetchNewQrCode();
      const interval = setInterval(() => {
        setQrCountdown((prev) => {
          if (prev <= 1) {
            fetchNewQrCode();
            return 20;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [displayTab, fetchNewQrCode]);

  // 2. Screen WakeLock API để giữ màn hình Kiosk luôn sáng (P3 - Item 18)
  useEffect(() => {
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        }
      } catch {
        // Trình duyệt không hỗ trợ hoặc từ chối
      }
    };
    requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      wakeLock?.release();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // 3. Phát âm thanh phản hồi (Tái sử dụng duy nhất 1 AudioContext) (P3 - Item 20)
  const playBeep = useCallback((success = true) => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (success) {
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else {
        osc.frequency.setValueAtTime(220, ctx.currentTime); // A3
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch {
      // Audio context policy
    }
  }, [soundEnabled]);

  // 4. Tải models AI
  useEffect(() => {
    const loadModels = async () => {
      try {
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
        await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
        await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
        setModelReady(true);
      } catch (err) {
        console.error('Lỗi tải model:', err);
        toast.error('Không thể tải Model weights từ /models');
      }
    };
    loadModels();
  }, []);

  // 5. Mở Camera (Hỗ trợ chọn thiết bị, fallback độ phân giải, tự phục hồi khi chuyển tab)
  const startCamera = useCallback(async (preferredDeviceId?: string) => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      const constraints: MediaStreamConstraints = {
        video: preferredDeviceId
          ? { deviceId: { exact: preferredDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (constraintErr) {
        // Fallback linh hoạt nếu webcam không hỗ trợ 1280x720 hoặc constraint strict
        console.warn('Thử camera chế độ linh hoạt:', constraintErr);
        stream = await navigator.mediaDevices.getUserMedia({
          video: preferredDeviceId ? { deviceId: { exact: preferredDeviceId } } : true,
          audio: false,
        });
      }

      streamRef.current = stream;

      // Cập nhật danh sách camera khả dụng
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
        setCameraDevices(videoInputs);
        if (preferredDeviceId) {
          setSelectedCameraId(preferredDeviceId);
        } else if (stream.getVideoTracks().length > 0) {
          const activeTrack = stream.getVideoTracks()[0];
          const settings = activeTrack.getSettings();
          if (settings.deviceId) {
            setSelectedCameraId(settings.deviceId);
          } else if (videoInputs.length > 0) {
            setSelectedCameraId(videoInputs[0].deviceId);
          }
        }
      } catch (e) {
        console.warn('Lỗi liệt kê camera:', e);
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch((playErr) => console.warn('Video play warning:', playErr));
        };
        await videoRef.current.play().catch(() => {});
      }
      setIsCameraActive(true);
    } catch (err) {
      console.error('Lỗi mở camera:', err);
      setIsCameraActive(false);
      toast.error('Không thể truy cập camera. Vui lòng kiểm tra quyền hoặc chọn camera khác!');
    }
  }, []);

  // Kích hoạt camera khi model sẵn sàng hoặc khi người dùng quay lại tab Face ID
  useEffect(() => {
    if (modelReady && displayTab === 'face') {
      if (streamRef.current && streamRef.current.active && videoRef.current) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.play().catch(console.error);
        setIsCameraActive(true);
      } else {
        startCamera(selectedCameraId || undefined);
      }
    }
  }, [modelReady, displayTab, startCamera, selectedCameraId]);

  // Giải phóng stream camera khi rời khỏi trang Kiosk
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // 6. Vẽ khung bám 4 góc công nghệ cao (P3 - Item 21)
  const drawCornerBrackets = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    isTarget: boolean,
    progress: number
  ) => {
    const len = Math.min(24, w * 0.2);
    ctx.lineWidth = isTarget ? 3.5 : 1.5;
    ctx.strokeStyle = color;
    ctx.beginPath();

    // Top-Left
    ctx.moveTo(x, y + len);
    ctx.lineTo(x, y);
    ctx.lineTo(x + len, y);

    // Top-Right
    ctx.moveTo(x + w - len, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + len);

    // Bottom-Right
    ctx.moveTo(x + w, y + h - len);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + w - len, y + h);

    // Bottom-Left
    ctx.moveTo(x + len, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + h - len);

    ctx.stroke();

    if (isTarget && progress > 0) {
      // Vẽ thanh tiến trình quét trên đầu bounding box
      const barY = Math.max(8, y - 10);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
      ctx.fillRect(x, barY, w, 6);
      ctx.fillStyle = color;
      ctx.fillRect(x, barY, (w * progress) / 100, 6);
    }
  };

  // 7. Vòng lặp quét khuôn mặt tự động kết hợp State Machine & Stability Counter
  useEffect(() => {
    if (!modelReady || !isScanning) return;

    const interval = setInterval(async () => {
      // Dừng quét khi tab bị ẩn để tiết kiệm tài nguyên (P3 - Item 19)
      if (document.hidden) return;
      if (!videoRef.current || isProcessingRef.current || cooldownRef.current) return;
      if (videoRef.current.readyState < 2) return;

      try {
        isProcessingRef.current = true;
        const video = videoRef.current;
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;
        const centerX = videoWidth / 2;
        const centerY = videoHeight / 2;
        const maxDistance = Math.hypot(centerX, centerY);

        const detections = await faceapi
          .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.45 }))
          .withFaceLandmarks()
          .withFaceDescriptors();

        if (detections && detections.length > 0) {
          // Tìm khuôn mặt đứng chính diện gần trung tâm nhất (Target Face)
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

          // 1. Kiểm tra khoảng cách: Nếu mặt quá xa (< 16% bề ngang khung hình), chưa gọi API
          if (faceRatio < 0.16) {
            stableCountRef.current = 0;
            setProgress(0);
            if (kioskStateRef.current !== 'VERIFYING') {
              setState('DETECTING');
            }
          } else {
            // 2. Kiểm tra độ ổn định vector khuôn mặt (P1 - Item 4: 3 frame liên tiếp)
            if (lastDescriptorRef.current) {
              const d = faceapi.euclideanDistance(targetFace.descriptor, lastDescriptorRef.current);
              stableCountRef.current = d < 0.35 ? stableCountRef.current + 1 : 1;
            } else {
              stableCountRef.current = 1;
            }
            lastDescriptorRef.current = targetFace.descriptor;

            // 3. Liveness Check: Giám sát chỉ số EAR (Eye Aspect Ratio) và vi chuyển động mũi (Issue 2)
            const ear = calculateEAR(targetFace.landmarks);
            blinkHistoryRef.current.push(ear);
            if (blinkHistoryRef.current.length > 12) blinkHistoryRef.current.shift();

            const nose = targetFace.landmarks.positions[30];
            const faceW = targetBox.width;
            if (lastNosePosRef.current) {
              const move = Math.hypot(nose.x - lastNosePosRef.current.x, nose.y - lastNosePosRef.current.y) / faceW;
              motionHistoryRef.current.push(move);
              if (motionHistoryRef.current.length > 12) motionHistoryRef.current.shift();
            }
            lastNosePosRef.current = { x: nose.x, y: nose.y };

            const maxEAR = Math.max(...blinkHistoryRef.current);
            const minEAR = Math.min(...blinkHistoryRef.current);
            const blinked = blinkHistoryRef.current.length >= 6 && (maxEAR - minEAR) > 0.08;

            const avgMotion = motionHistoryRef.current.length
              ? motionHistoryRef.current.reduce((a, b) => a + b, 0) / motionHistoryRef.current.length
              : 0;
            const alive = blinked || avgMotion > 0.004;

            const progress = Math.min(100, Math.round((stableCountRef.current / 3) * 100));
            setProgress(progress);

            if (stableCountRef.current < 3) {
              if (kioskStateRef.current !== 'VERIFYING') {
                setState('DETECTING');
              }
              setLivenessHint(null);
            } else if (!alive) {
              // Liveness chặn thực: yêu cầu người dùng nháy mắt hoặc quay nhẹ đầu trước khi cho phép gọi API
              if (kioskStateRef.current !== 'VERIFYING') {
                setState('DETECTING');
              }
              setLivenessHint('Vui lòng nháy mắt hoặc quay nhẹ đầu để xác thực người thật');
            } else if (!isCallingApiRef.current && !cooldownRef.current) {
              // 4. Đã đủ 3 frame ổn định & xác thực người thật -> Chuyển sang VERIFYING và gọi API bất đồng bộ (Issue 21)
              setLivenessHint(null);
              isCallingApiRef.current = true;
              stableCountRef.current = 0;
              setState('VERIFYING');

              // Snapshot frame hình minh chứng (Issue 14)
              let capturedImage: string | undefined;
              try {
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = 320;
                tempCanvas.height = 240;
                const tCtx = tempCanvas.getContext('2d');
                if (tCtx && videoRef.current) {
                  tCtx.drawImage(videoRef.current, 0, 0, 320, 240);
                  capturedImage = tempCanvas.toDataURL('image/jpeg', 0.6);
                }
              } catch {}

              const abortController = new AbortController();
              const timeoutId = setTimeout(() => abortController.abort(), 5000); // 5s timeout

              const locationPayload = is2FaGpsEnabled && kioskCoords ? kioskCoords : undefined;

              attendanceApi
                .faceCheckIn({
                  faceDescriptor: Array.from(targetFace.descriptor),
                  mode: kioskModeRef.current,
                  capturedImage,
                  location: locationPayload,
                  signal: abortController.signal,
                })
                .then((res) => {
                  clearTimeout(timeoutId);
                  isCallingApiRef.current = false;
                  if (res && res.success) {
                    const checkInResult: CheckInResult = { ...res.data, scannedAt: new Date() };
                    setResult(checkInResult);
                    setRecentScans((prev) => [
                      checkInResult,
                      ...prev.filter((r) => r.user?._id !== checkInResult.user?._id).slice(0, 4),
                    ]);
                    setErrorMessage(null);
                    setTwoFaSecurityAlert(null);
                    setState('SUCCESS');
                    playBeep(true);
                    cooldownRef.current = true;

                    setTimeout(() => {
                      setResult(null);
                      setState('IDLE');
                      setProgress(0);
                      cooldownRef.current = false;
                    }, 4000);
                  }
                })
                .catch((err: any) => {
                  clearTimeout(timeoutId);
                  isCallingApiRef.current = false;
                  const responseData = err.response?.data;
                  const msg = responseData?.message || err.message || 'Không thể xác thực danh tính.';
                  const errCode = responseData?.errorCode || responseData?.code;
                  const extraDistance = responseData?.data?.distance;

                  const displayError =
                    extraDistance !== undefined && extraDistance !== null
                      ? `${msg} (Độ lệch vector: ${(extraDistance * 100).toFixed(1)}%)`
                      : msg;

                  if (errCode === 'FACE_2FA_OUT_OF_GEOFENCE' || msg.includes('2FA') || msg.includes('khuôn viên')) {
                    setTwoFaSecurityAlert(msg);
                    setTimeout(() => setTwoFaSecurityAlert(null), 8000);
                  }

                  if (!toastCooldownRef.current) {
                    toastCooldownRef.current = true;
                    toast.error(displayError, { id: 'kiosk-err' });
                    setTimeout(() => {
                      toastCooldownRef.current = false;
                    }, 4000);
                  }

                  setErrorMessage(displayError);
                  setState('ERROR');
                  playBeep(false);
                  cooldownRef.current = true;
                  setTimeout(() => {
                    setErrorMessage(null);
                    setState('IDLE');
                    setProgress(0);
                    cooldownRef.current = false;
                  }, 4000);
                });
            }
          }

          // Vẽ giao diện nhận diện 4 góc công nghệ cao lên Canvas (P3 - Item 21)
          if (canvasRef.current) {
            const canvas = canvasRef.current;
            const displaySize = { width: videoWidth, height: videoHeight };
            faceapi.matchDimensions(canvas, displaySize);
            // Giữ canvas khớp 100% với container và video, tránh inline style px làm lệch tỉ lệ
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);

              const curState = kioskStateRef.current;
              const curProgress = progressRef.current;

              for (const d of detections) {
                const resized = faceapi.resizeResults(d, displaySize);
                const { x, y, width, height } = resized.detection.box;
                const isTarget = d === targetFace;

                // Tính tọa độ đối xứng qua trục Y để khớp chính xác với video camera selfie đã lật gương
                const drawX = displaySize.width - (x + width);

                const color = isTarget
                  ? curState === 'VERIFYING'
                    ? '#38bdf8'
                    : curState === 'SUCCESS'
                    ? '#10b981'
                    : curState === 'ERROR'
                    ? '#ef4444'
                    : '#a855f7'
                  : '#64748b';

                drawCornerBrackets(ctx, drawX, y, width, height, color, isTarget, isTarget ? curProgress : 0);

                // Badge trạng thái trên đầu người (chữ đọc xuôi tự nhiên từ trái sang phải)
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
                    ? curState === 'VERIFYING'
                      ? '● ĐANG ĐỐI SOÁT AI...'
                      : curState === 'SUCCESS'
                      ? '✓ XÁC THỰC THÀNH CÔNG'
                      : `★ ĐIỂM DANH (${curProgress}%)`
                    : 'Người qua lại',
                  drawX + 6,
                  Math.max(15, y - 9)
                );
              }
            }
          }
        } else {
          // Không có người trước camera
          stableCountRef.current = 0;
          setProgress(0);
          if (!isCallingApiRef.current && !cooldownRef.current) {
            setState('IDLE');
          }
          setLivenessHint(null);
          if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          }
        }
      } catch {
        // Ignored
      } finally {
        isProcessingRef.current = false;
      }
    }, 550);

    return () => clearInterval(interval);
  }, [modelReady, isScanning, playBeep, setState, setProgress]);

  // 8. Tải ảnh dự phòng
  const handleBackupUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !modelReady) return;

    try {
      const img = await faceapi.bufferToImage(file);
      const detection = await faceapi
        .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        toast.error('Không tìm thấy khuôn mặt trong ảnh!');
        return;
      }

      const descriptorArray = Array.from(detection.descriptor);
      const res = await attendanceApi.faceCheckIn({
        faceDescriptor: descriptorArray,
        mode: kioskModeRef.current,
        location: is2FaGpsEnabled && kioskCoords ? kioskCoords : undefined,
      });

      if (res && res.success) {
        setResult(res.data);
        setErrorMessage(null);
        playBeep(true);
        setTimeout(() => setResult(null), 4500);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể điểm danh bằng ảnh này';
      setErrorMessage(msg);
      playBeep(false);
      setTimeout(() => setErrorMessage(null), 3500);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Định dạng ngày giờ tiếng Việt
  const dateFormatted = currentTime.toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timeFormatted = currentTime.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  // Cho phép bấm phím Esc để thoát Kiosk về Dashboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else {
          navigate('/dashboard');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  return (
    <div className="fixed inset-0 bg-slate-950 text-white flex flex-col overflow-y-auto overflow-x-hidden select-none font-sans z-50">
      {/* Top Bar Header */}
      <div className="shrink-0 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-6 py-2.5 sm:py-3 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          {/* Nút Thoát Kiosk */}
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-bold transition border border-slate-700 hover:border-indigo-500/50 shadow-sm"
            title="Quay lại Bảng Điều Khiển Hệ Thống (hoặc bấm phím Esc)"
          >
            <ArrowLeft className="w-4 h-4 text-indigo-400" />
            <span className="hidden sm:inline">Thoát Kiosk</span>
          </button>

          <div className="p-2.5 bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 rounded-2xl shadow-inner">
            <Building className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-base font-black tracking-wide bg-gradient-to-r from-indigo-300 via-white to-purple-300 bg-clip-text text-transparent">
              KIOSK ĐIỂM DANH SINH TRẮC HỌC AI
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              Cổng Sảnh Trung Tâm &bull; Hệ Thống Quản Lý Chấm Công Đại Học
            </p>
          </div>
        </div>

        {/* Bộ Chuyển Đổi Chế Độ Điểm Danh (Auto / Check-in / Check-out) */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950/90 rounded-2xl border border-slate-800 shadow-inner">
          <button
            onClick={() => setKioskMode('auto')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition duration-200 ${
              kioskMode === 'auto'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30 ring-1 ring-white/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            Tự Động (Auto)
          </button>
          <button
            onClick={() => setKioskMode('check_in')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition duration-200 ${
              kioskMode === 'check_in'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 ring-1 ring-emerald-300/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <LogIn className="w-3.5 h-3.5 text-emerald-300" />
            Vào Ca (In)
          </button>
          <button
            onClick={() => setKioskMode('check_out')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition duration-200 ${
              kioskMode === 'check_out'
                ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30 ring-1 ring-cyan-300/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <LogOut className="w-3.5 h-3.5 text-cyan-300" />
            Ra Về (Out)
          </button>
        </div>

        {/* Đồng hồ điện tử & Tiện ích */}
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-2xl font-black tracking-wider text-indigo-300 font-mono">
              {timeFormatted}
            </div>
            <div className="text-xs text-slate-400 capitalize font-medium">{dateFormatted}</div>
          </div>

          <div className="flex items-center gap-2 border-l border-slate-800 pl-6">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
            >
              {soundEnabled ? <Volume2 className="w-5 h-5 text-indigo-400" /> : <VolumeX className="w-5 h-5 text-slate-500" />}
            </button>
            <button
              onClick={() => {
                if (!document.fullscreenElement) {
                  document.documentElement.requestFullscreen();
                } else {
                  document.exitFullscreen();
                }
              }}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Toàn màn hình"
            >
              <Maximize2 className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition flex items-center gap-1.5 text-xs font-bold"
              title="Thoát Kiosk về Bảng Điều Khiển"
            >
              <LogOut className="w-4 h-4 text-rose-400" />
              <span>Thoát</span>
            </button>
          </div>
        </div>
      </div>

      {/* Thanh Điều Hướng Hybrid: Face ID Kiosk vs Màn hình QR Code Động + 2FA GPS */}
      <div className="shrink-0 bg-slate-900/60 border-b border-slate-800/80 px-6 py-2 flex flex-wrap items-center justify-between gap-3 z-20">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDisplayTab('face')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              displayTab === 'face'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70'
            }`}
          >
            <UserCheck className="w-4 h-4 text-indigo-300" />
            <span>1. Camera Face ID (Kiosk Sảnh)</span>
          </button>

          <button
            onClick={() => setDisplayTab('qr')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              displayTab === 'qr'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70'
            }`}
          >
            <QrCode className="w-4 h-4 text-purple-300" />
            <span>2. Màn Hình QR Code Động (20s)</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          </button>
        </div>

        {/* Cấu hình Camera Khả dụng & 2FA GPS Thực tế */}
        <div className="flex items-center gap-2">
          {displayTab === 'face' && cameraDevices.length > 0 && (
            <div className="flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs">
              <Camera className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <select
                value={selectedCameraId}
                onChange={(e) => {
                  const devId = e.target.value;
                  setSelectedCameraId(devId);
                  startCamera(devId);
                }}
                className="bg-transparent text-slate-300 text-xs outline-none cursor-pointer max-w-[130px] sm:max-w-[170px] truncate"
                title="Chọn thiết bị camera (nếu có nhiều webcam hoặc đang chọn nhầm camera hồng ngoại)"
              >
                {cameraDevices.map((dev, idx) => (
                  <option key={dev.deviceId || idx} value={dev.deviceId} className="bg-slate-900 text-white">
                    {dev.label || `Camera ${idx + 1}`}
                  </option>
                ))}
              </select>
              <button
                onClick={() => startCamera(selectedCameraId)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-indigo-300 transition"
                title="Khởi động lại luồng Camera"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Cấu hình 2FA GPS Thực tế */}
          <div className="flex items-center gap-2 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setIs2FaGpsEnabled(!is2FaGpsEnabled)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold transition ${
                is2FaGpsEnabled ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-500 bg-slate-800'
              }`}
              title="Bảo mật 2 lớp: Bắt buộc tọa độ GPS của thiết bị nằm trong bán kính trường"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>2FA GPS: {is2FaGpsEnabled ? 'BẬT' : 'TẮT'}</span>
            </button>

            {is2FaGpsEnabled && (
              <div className="flex items-center gap-1.5 pl-2 border-l border-slate-800 text-slate-300 font-mono text-[11px]">
                <MapPin className="w-3.5 h-3.5 text-rose-400" />
                <span>
                  {kioskCoords
                    ? `${kioskCoords.lat.toFixed(5)}, ${kioskCoords.lng.toFixed(5)}`
                    : 'Đang định vị vệ tinh GPS...'}
                </span>
                {kioskGpsAccuracy && (
                  <span className="text-slate-500 text-[10px]">(±{Math.round(kioskGpsAccuracy)}m)</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Kiosk Area */}
      <div className="flex-1 flex items-center justify-center p-3 sm:p-4 lg:p-6 gap-6 relative min-h-0 my-auto">
        {displayTab === 'qr' ? (
          /* MÀN HÌNH QR CODE ĐỘNG (20s) */
          <div className="relative w-full max-w-4xl aspect-[16/10] max-h-[min(540px,calc(100vh-210px))] min-h-[280px] bg-slate-900 rounded-3xl overflow-hidden border-2 border-purple-500/30 shadow-2xl shadow-purple-500/10 flex flex-col items-center justify-center p-6 text-center">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>

            {/* Thanh thông tin trên: Badge + Bộ đếm 20s */}
            <div className="flex items-center justify-between w-full max-w-md mb-3 z-10">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-400/30 text-xs font-bold flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
                  MÃ QR ĐỘNG TOTP
                </span>
                <span className="text-[11px] text-slate-400 font-mono">HMAC-SHA256</span>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative w-9 h-9 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15" fill="none" stroke="#334155" strokeWidth="3" />
                    <circle
                      cx="18"
                      cy="18"
                      r="15"
                      fill="none"
                      stroke="#a855f7"
                      strokeWidth="3"
                      strokeDasharray="94.2"
                      strokeDashoffset={94.2 - (94.2 * qrCountdown) / 20}
                      className="transition-all duration-1000 ease-linear"
                    />
                  </svg>
                  <span className="absolute text-[11px] font-mono font-black text-purple-300">{qrCountdown}s</span>
                </div>
                <button
                  onClick={fetchNewQrCode}
                  disabled={isLoadingQr}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                  title="Làm mới mã QR ngay lập tức"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingQr ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Khung thẻ QR Code trắng tinh, cân xứng hoàn hảo với 4 góc HUD công nghệ */}
            <div className="relative z-10 mb-3">
              {/* 4 góc trang trí công nghệ cao */}
              <div className="absolute -top-2.5 -left-2.5 w-6 h-6 border-t-2 border-l-2 border-purple-400 rounded-tl-xl pointer-events-none"></div>
              <div className="absolute -top-2.5 -right-2.5 w-6 h-6 border-t-2 border-r-2 border-purple-400 rounded-tr-xl pointer-events-none"></div>
              <div className="absolute -bottom-2.5 -left-2.5 w-6 h-6 border-b-2 border-l-2 border-purple-400 rounded-bl-xl pointer-events-none"></div>
              <div className="absolute -bottom-2.5 -right-2.5 w-6 h-6 border-b-2 border-r-2 border-purple-400 rounded-br-xl pointer-events-none"></div>

              <div className="w-56 h-56 sm:w-64 sm:h-64 p-3.5 bg-white rounded-2xl shadow-2xl shadow-purple-500/20 flex items-center justify-center overflow-hidden">
                {dynamicQrSvg ? (
                  <div
                    dangerouslySetInnerHTML={{ __html: dynamicQrSvg }}
                    className="w-full h-full flex items-center justify-center"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400 gap-2">
                    <RefreshCw className="w-7 h-7 animate-spin text-purple-500" />
                    <span className="text-xs font-semibold">Đang tạo mã QR...</span>
                  </div>
                )}
              </div>
            </div>

            <div className="max-w-md z-10">
              <h3 className="text-sm font-bold text-white mb-0.5">
                Quét Mã Bằng Điện Thoại Để Điểm Danh
              </h3>
              <p className="text-[11px] text-slate-400 leading-snug">
                Mở ứng dụng hoặc trang Web trên điện thoại &gt; Chọn tab{' '}
                <strong className="text-purple-300">"Quét QR Động"</strong>. Mã tự động đổi sau mỗi 20 giây để chống chụp ảnh chia sẻ ra ngoài.
              </p>
            </div>
          </div>
        ) : (
          /* Khung Camera Trung Tâm Face ID */
          <div className="relative w-full max-w-4xl aspect-[16/10] max-h-[min(540px,calc(100vh-210px))] min-h-[280px] bg-slate-900 rounded-3xl overflow-hidden border-2 border-indigo-500/30 shadow-2xl shadow-indigo-500/10 flex items-center justify-center">
            {/* Luồng Video Webcam Thực */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              onLoadedMetadata={() => {
                videoRef.current?.play().catch((err) => console.warn('Video play warning:', err));
              }}
              className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1] z-0"
            />
            {/* Canvas vẽ bounding box và radar quét AI (tọa độ tính trực tiếp, không lật ngược chữ) */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full object-cover pointer-events-none z-10"
            />

            {/* Màn hình thông báo khi camera chưa sẵn sàng */}
            {!isCameraActive && (
              <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center z-15 p-6 text-center">
                <CameraOff className="w-14 h-14 text-slate-500 mb-3 animate-pulse" />
                <h4 className="text-white font-bold text-base mb-1">Camera Đang Khởi Động Hoặc Bị Khóa</h4>
                <p className="text-xs text-slate-400 max-w-md mb-4 leading-relaxed">
                  Nếu màn hình bị đen, hãy kiểm tra <strong>nút gạt che camera vật lý</strong> trên mép laptop hoặc ứng dụng khác (Zoom, Teams) đang chiếm camera.
                </p>
                <button
                  onClick={() => startCamera(selectedCameraId)}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Kích Hoạt Lại Camera Ngay</span>
                </button>
              </div>
            )}

            {/* Status Badge Góc Trái */}
            <div className="absolute top-6 left-6 flex items-center gap-2 bg-slate-900/85 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-slate-700 text-xs font-semibold z-20">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-emerald-400">CAMERA TRỰC TIẾP</span>
              <span className="text-slate-500">&bull;</span>
              <span className="text-slate-300 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                Liveness ON
              </span>
            </div>

            {/* State Machine Status Badge Góc Phải (P3 - Item 15) */}
            <div className="absolute top-6 right-6 flex items-center gap-2 bg-slate-900/85 backdrop-blur-md px-4 py-1.5 rounded-full border border-slate-700 text-xs font-bold tracking-wide z-20">
              {kioskState === 'IDLE' && (
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-slate-500" />
                  SẴN SÀNG CHỜ QUÉT
                </span>
              )}
              {kioskState === 'DETECTING' && (
                <span className="text-purple-300 flex items-center gap-1.5 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-purple-400" />
                  ĐANG NHẬN DIỆN ({detectionProgress}%)
                </span>
              )}
              {kioskState === 'VERIFYING' && (
                <span className="text-cyan-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  ĐỐI SOÁT VECTOR AI...
                </span>
              )}
              {kioskState === 'SUCCESS' && (
                <span className="text-emerald-300 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                  XÁC THỰC THÀNH CÔNG
                </span>
              )}
              {kioskState === 'ERROR' && (
                <span className="text-rose-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  KHÔNG KHỚP
                </span>
              )}
            </div>

            {/* Hướng dẫn căn chỉnh khuôn mặt */}
            <div className="absolute bottom-6 inset-x-0 flex justify-center pointer-events-none z-20">
              <div className="bg-slate-950/85 backdrop-blur-md px-6 py-2.5 rounded-2xl border border-slate-800 text-xs text-slate-300 flex items-center gap-2.5 shadow-lg">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
              <span>
                {kioskMode === 'auto'
                  ? 'Đứng thẳng, cách camera 0.6m - 1.0m: Quét đầu ca để Vào ca, cuối ca để Ra về'
                  : kioskMode === 'check_in'
                  ? 'Đứng thẳng trước camera để ghi nhận Vào ca (Check-in)'
                  : 'Đứng thẳng trước camera để ghi nhận Ra về (Check-out)'}
              </span>
            </div>
          </div>

          {/* POPUP THÀNH CÔNG (Che email nhạy cảm - P0 Item 3) */}
          {result && (
            <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-8 z-30 animate-in fade-in zoom-in-95 duration-200">
              <div
                className={`w-20 h-20 rounded-full border-2 flex items-center justify-center mb-4 ${
                  result.action === 'CHECK_OUT'
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-400 shadow-xl shadow-cyan-500/20'
                    : 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-xl shadow-emerald-500/20'
                }`}
              >
                {result.action === 'CHECK_OUT' ? (
                  <LogOut className="w-10 h-10 text-cyan-400" />
                ) : (
                  <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                )}
              </div>

              <div
                className={`text-xs uppercase tracking-widest font-black mb-1 ${
                  result.action === 'CHECK_OUT' ? 'text-cyan-400' : 'text-emerald-400'
                }`}
              >
                {result.action === 'CHECK_OUT' ? '🎉 CHECK-OUT (RA VỀ) THÀNH CÔNG!' : '✨ CHECK-IN (VÀO CA) THÀNH CÔNG!'}
              </div>

              <h2 className="text-3xl font-black text-white mb-1">{result.user?.fullName}</h2>

              {/* Email đã che (Masked) bảo vệ quyền riêng tư công cộng */}
              <p className="text-sm text-slate-400 mb-5 font-mono">
                {maskEmail(result.user?.email)}
              </p>

              {/* Thông tin trạng thái & thời gian làm việc */}
              <div className="flex flex-wrap items-center justify-center gap-3">
                {result.action === 'CHECK_OUT' ? (
                  <>
                    <span
                      className={`px-4 py-2 rounded-xl text-sm font-black tracking-wide border ${
                        result.statusText === 'EARLY_LEAVE' || result.earlyLeave?.isEarlyLeave
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                      }`}
                    >
                      {result.statusText === 'EARLY_LEAVE' || result.earlyLeave?.isEarlyLeave
                        ? `⚠ VỀ SỚM (${result.earlyLeave?.earlyMinutes || 0} phút)`
                        : '✓ HOÀN THÀNH CA DẠY'}
                    </span>

                    {result.workingDuration && (
                      <span className="px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-950/60 border border-indigo-500/40 text-indigo-300 flex items-center gap-1.5">
                        <Timer className="w-4 h-4 text-indigo-400" />
                        Thời gian: {result.workingDuration.formatted}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <span
                      className={`px-4 py-2 rounded-xl text-sm font-black tracking-wide border ${
                        result.status === 'ON_TIME' || result.statusText === 'ON_TIME'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      }`}
                    >
                      {result.status === 'ON_TIME' || result.statusText === 'ON_TIME' ? '✓ ĐÚNG GIỜ' : '⚠ ĐI MUỘN'}
                    </span>

                    <span className="px-4 py-2 rounded-xl text-sm font-semibold bg-slate-800 border border-slate-700 text-slate-300">
                      Độ chính xác: {(result.confidenceScore * 100).toFixed(1)}%
                    </span>
                  </>
                )}
              </div>

              {result.attendance?.shiftId && (
                <div className="mt-4 text-xs text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" />
                  <span>
                    {result.attendance.shiftId.name} ({result.attendance.shiftId.startTime} -{' '}
                    {result.attendance.shiftId.endTime})
                  </span>
                </div>
              )}
            </div>
          )}

          {/* POPUP BÁO LỖI: Nhắc nhở */}
          {errorMessage && !result && (
            <div className="absolute inset-x-8 bottom-20 bg-rose-950/90 backdrop-blur-md border border-rose-600/50 p-4 rounded-2xl flex items-center gap-3 z-30 shadow-xl">
              <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0" />
              <div className="text-xs font-semibold text-rose-200">{errorMessage}</div>
            </div>
          )}

          {/* GỢI Ý LIVENESS: Nháy mắt hoặc cử động đầu (Issue 2) */}
          {livenessHint && !errorMessage && !result && (
            <div className="absolute inset-x-8 bottom-20 bg-amber-950/90 backdrop-blur-md border border-amber-500/50 p-4 rounded-2xl flex items-center gap-3 z-30 shadow-xl animate-pulse">
              <Sparkles className="w-6 h-6 text-amber-400 shrink-0" />
              <div className="text-xs font-bold text-amber-200">{livenessHint}</div>
            </div>
          )}
          {/* CẢNH BÁO BẢO MẬT 2FA (FACE ID + GPS GEOFENCING) */}
          {twoFaSecurityAlert && (
            <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-8 z-40 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-20 h-20 rounded-full bg-rose-500/20 border-2 border-rose-500 flex items-center justify-center mb-4 text-rose-400 shadow-2xl shadow-rose-500/40 animate-bounce">
                <ShieldAlert className="w-10 h-10 text-rose-400" />
              </div>
              <div className="text-xs uppercase tracking-widest font-black text-rose-400 mb-1">
                🚨 CẢNH BÁO BẢO MẬT 2FA (FACE ID + GPS)
              </div>
              <h2 className="text-2xl font-black text-white mb-2 text-center">
                TỌA ĐỘ NGOÀI KHUÔN VIÊN TRƯỜNG!
              </h2>
              <div className="max-w-md bg-rose-950/60 border border-rose-600/40 p-4 rounded-2xl text-xs text-rose-200 text-center mb-4">
                {twoFaSecurityAlert}
              </div>
              <p className="text-xs text-slate-400 text-center max-w-sm">
                Cơ chế Bảo mật 2 lớp phát hiện khuôn mặt hợp lệ nhưng thiết bị nằm ngoài khuôn viên trường học. Hệ thống đã ngăn chặn hành vi sử dụng video hoặc ảnh quay lén từ xa.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 mt-5">
                <button
                  onClick={() => {
                    setIs2FaGpsEnabled(false);
                    setTwoFaSecurityAlert(null);
                    toast.success('Đã tạm tắt 2FA GPS! Bạn có thể quét khuôn mặt lại ngay bây giờ.');
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition"
                >
                  Tắt 2FA GPS & Thử Lại
                </button>
                {kioskCoords && (
                  <button
                    onClick={async () => {
                      try {
                        await attendanceApi.updateCampusConfig({
                          name: 'Khuôn viên Thực tế (Tọa độ Kiosk hiện tại)',
                          lat: kioskCoords.lat,
                          lng: kioskCoords.lng,
                          radiusMeters: 500,
                        });
                        toast.success('Đã hiệu chuẩn khuôn viên trường theo GPS hiện tại (bán kính 500m)!');
                        setTwoFaSecurityAlert(null);
                      } catch (e) {
                        toast.error('Không thể cập nhật cấu hình GPS');
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition"
                  >
                    Hiệu Chuẩn GPS Về Vị Trí Này
                  </button>
                )}
                <button
                  onClick={() => setTwoFaSecurityAlert(null)}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition"
                >
                  Đóng
                </button>
              </div>
            </div>
          )}
        </div>
        )}

        {/* Thanh hiển thị 5 lượt quét gần đây (P3 - Item 17, Issue 3) */}
        <div className="hidden lg:flex flex-col w-72 max-h-[min(540px,calc(100vh-210px))] min-h-[280px] bg-slate-900/70 border border-slate-800 rounded-3xl p-4 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 pb-3 border-b border-slate-800">
            <History className="w-4 h-4 text-indigo-400" />
            <span>Lượt Quét Gần Nhất ({recentScans.length})</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pt-3">
            {recentScans.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 text-xs px-4">
                <UserCheck className="w-8 h-8 text-slate-700 mb-2" />
                <span>Chưa có lượt điểm danh nào trong phiên làm việc này.</span>
              </div>
            ) : (
              recentScans.map((item, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center gap-3 animate-in fade-in slide-in-from-top-2"
                >
                  <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-xs font-bold text-indigo-300 shrink-0 overflow-hidden">
                    {item.user?.avatar ? (
                      <img src={formatAvatarUrl(item.user.avatar)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      item.user?.fullName?.charAt(0) || 'U'
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-200 truncate">{item.user?.fullName}</p>
                    <p className="text-[10px] text-slate-500 font-mono">
                      {new Date(item.scannedAt || Date.now()).toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      &bull;{' '}
                      {item.action === 'CHECK_OUT' ? (
                        <span className="text-cyan-400 font-bold">Ra về</span>
                      ) : (
                        <span className="text-emerald-400 font-bold">Vào ca</span>
                      )}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-lg font-bold border shrink-0 ${
                      item.statusText === 'EARLY_LEAVE'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    }`}
                  >
                    {item.statusText === 'EARLY_LEAVE' ? 'Sớm' : 'OK'}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="pt-3 border-t border-slate-800 text-[10px] text-slate-500 text-center">
            Tự động cập nhật thời gian thực
          </div>
        </div>
      </div>

      {/* Bottom Bar: Phương án dự phòng upload ảnh */}
      <div className="shrink-0 bg-slate-900/90 backdrop-blur-md border-t border-slate-800/80 px-6 py-2.5 sm:py-3 flex items-center justify-between z-20 mt-auto">
        <div className="text-xs text-slate-500 font-medium">
          Mô hình: <span className="text-slate-400">TinyFaceDetector + Euclidean (d &lt; 0.55)</span> &bull; Trạng thái:{' '}
          <span className="text-indigo-400 font-bold uppercase">{kioskState}</span>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={handleBackupUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 transition"
          >
            <Upload className="w-4 h-4 text-indigo-400" />
            Tải Ảnh Nhận Diện (Dự phòng)
          </button>
          <button
            onClick={() => setIsScanning(!isScanning)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition border ${
              isScanning
                ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40 hover:bg-indigo-600/30'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {isScanning ? 'Tạm Dừng Quét' : 'Tiếp Tục Quét'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FaceCheckInKiosk;
