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
  Radio,
  RefreshCw,
  Smartphone,
  Check,
  Camera,
  CameraOff,
  ArrowLeft,
  X,
  Sun,
  Moon,
  Eye,
  Zap,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { attendanceApi } from '../../api';
import { toast } from 'react-hot-toast';
import { generateQrSvg } from '../../utils/qrCode';
import { getSafeMediaUrl } from '../../utils';
import { UserAvatar } from '../../components';
import { useKioskCamera, useImageEnhancement, useFaceScanLoop } from '../../hooks/kiosk';
import type { KioskMode, KioskState, CheckInResult } from '../../hooks/kiosk';

// Che email trên màn hình công cộng (P0 - Item 3)
const maskEmail = (email?: string): string => {
  if (!email || !email.includes('@')) return email || '';
  const [name, domain] = email.split('@');
  if (name.length <= 2) return `${name}***@${domain}`;
  return `${name[0]}****${name[name.length - 1]}@${domain}`;
};

export const FaceCheckInKiosk: React.FC = () => {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [modelReady, setModelReady] = useState(false);
  const [isScanning, setIsScanning] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [kioskMode, setKioskMode] = useState<KioskMode>('auto');
  const [kioskState, setKioskState] = useState<KioskState>('IDLE');
  const [detectionProgress, setDetectionProgress] = useState(0);
  const [livenessHint, setLivenessHint] = useState<string | null>(null);

  // Lịch sử 5 lượt quét gần nhất
  const [recentScans, setRecentScans] = useState<CheckInResult[]>([]);
  const [showMobileHistory, setShowMobileHistory] = useState<boolean>(false);

  const [result, setResult] = useState<CheckInResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Tab hiển thị: Camera Face ID hoặc Màn hình QR Code Động
  const [displayTab, setDisplayTab] = useState<'face' | 'qr'>('face');

  // QR Code Động
  const [dynamicQrSvg, setDynamicQrSvg] = useState<string>('');
  const [qrToken, setQrToken] = useState<string>('');
  const [qrCountdown, setQrCountdown] = useState<number>(20);
  const [isLoadingQr, setIsLoadingQr] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tái sử dụng AudioContext 1 lần duy nhất
  const audioCtxRef = useRef<AudioContext | null>(null);

  // =====================================================================
  // HOOK 1: Smart Camera Lifecycle (Wake/Sleep)
  // =====================================================================

  const {
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
  } = useKioskCamera({
    sleepTimeoutMs: 15_000,
    enableMotionDetection: true,
    hdWidth: 1280,
    hdHeight: 720,
  });

  // =====================================================================
  // HOOK 2: Image Enhancement & Luminance Analysis
  // =====================================================================

  const {
    luminance,
    lightingCondition,
    videoFilterStyle,
    warningMessage: lightingWarning,
    enhanceFrame,
  } = useImageEnhancement({
    videoRef,
    isCameraActive: isCameraActive && cameraState === 'ACTIVE',
    analysisIntervalMs: 2000,
  });

  // =====================================================================
  // Đồng hồ thời gian thực
  // =====================================================================

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // =====================================================================
  // QR Code Động
  // =====================================================================

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

  // =====================================================================
  // Screen WakeLock API
  // =====================================================================

  useEffect(() => {
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        }
      } catch { /* Trình duyệt không hỗ trợ */ }
    };
    requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') requestWakeLock();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      wakeLock?.release();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // =====================================================================
  // Âm thanh phản hồi
  // =====================================================================

  const playBeep = useCallback((success = true) => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (success) {
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else {
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch { /* Audio context policy */ }
  }, [soundEnabled]);

  // =====================================================================
  // Tải models AI
  // =====================================================================

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

  // =====================================================================
  // HOOK 3: Performance-Optimized Face Scan Loop
  // =====================================================================

  const handleApiResult = useCallback((checkInResult: CheckInResult) => {
    setResult(checkInResult);
    setRecentScans((prev) => [
      checkInResult,
      ...prev.filter((r) => r.user?._id !== checkInResult.user?._id).slice(0, 4),
    ]);
    setErrorMessage(null);

    // Auto clear sau 4s
    setTimeout(() => {
      setResult(null);
    }, 4000);
  }, []);

  const handleApiError = useCallback((message: string) => {
    setErrorMessage(message);

    if (!toastCooldownRef.current) {
      toastCooldownRef.current = true;
      toast.error(message, { id: 'kiosk-err' });
      setTimeout(() => { toastCooldownRef.current = false; }, 4000);
    }

    setTimeout(() => { setErrorMessage(null); }, 4000);
  }, []);

  const toastCooldownRef = useRef(false);

  // Face scan loop chỉ chạy khi: model ready + camera active + đang scanning + tab face
  useFaceScanLoop({
    videoRef,
    canvasRef,
    isActive: modelReady && isScanning && isCameraActive && cameraState === 'ACTIVE' && displayTab === 'face',
    targetFps: 7,
    kioskMode,
    enhanceFrame,
    onStateChange: setKioskState,
    onProgressChange: setDetectionProgress,
    onLivenessHint: setLivenessHint,
    onFaceDetected: resetSleepTimer,   // Reset 15s sleep khi thấy face
    onNoFace: undefined,
    onApiResult: handleApiResult,
    onApiError: handleApiError,
    playBeep,
  });

  // =====================================================================
  // Tải ảnh dự phòng
  // =====================================================================

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
        mode: kioskMode,
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

  // =====================================================================
  // Tiện ích
  // =====================================================================

  const dateFormatted = currentTime.toLocaleDateString('vi-VN', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
  });
  const timeFormatted = currentTime.toLocaleTimeString('vi-VN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  // Phím Esc thoát Kiosk
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

  // =====================================================================
  // Luminance indicator helper
  // =====================================================================

  const getLuminanceColor = () => {
    if (lightingCondition === 'TOO_DARK') return 'bg-orange-500';
    if (lightingCondition === 'LOW_LIGHT') return 'bg-amber-400';
    if (lightingCondition === 'TOO_BRIGHT') return 'bg-yellow-300';
    return 'bg-emerald-400';
  };

  const getLuminanceIcon = () => {
    if (lightingCondition === 'TOO_DARK' || lightingCondition === 'LOW_LIGHT') return <Moon className="w-3 h-3" />;
    if (lightingCondition === 'TOO_BRIGHT') return <Sun className="w-3 h-3" />;
    return <Sun className="w-3 h-3" />;
  };

  // =====================================================================
  // RENDER
  // =====================================================================

  return (
    <div className="fixed inset-0 bg-slate-950 text-white flex flex-col overflow-y-auto overflow-x-hidden select-none font-sans z-50">
      {/* =============== TOP BAR HEADER =============== */}
      <div className="shrink-0 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-3 sm:px-6 py-2.5 sm:py-3 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3 z-20">
        {/* Hàng 1: Tiêu đề Kiosk, Logo & Đồng hồ */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-bold transition border border-slate-700 hover:border-indigo-500/50 shadow-sm shrink-0 cursor-pointer"
              title="Quay lại Bảng Điều Khiển Hệ Thống (hoặc phím Esc)"
            >
              <ArrowLeft className="w-4 h-4 text-indigo-400" />
              <span className="hidden sm:inline">Thoát</span>
            </button>

            <div className="p-2 sm:p-2.5 bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 rounded-2xl shadow-inner shrink-0">
              <Building className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-black tracking-wide bg-gradient-to-r from-indigo-300 via-white to-purple-300 bg-clip-text text-transparent truncate">
                KIOSK ĐIỂM DANH AI
              </h1>
              <p className="text-[10px] sm:text-xs text-slate-400 font-medium truncate">
                Cổng Sảnh Trung Tâm &bull; Quản Lý Chấm Công
              </p>
            </div>
          </div>

          {/* Đồng hồ & Tiện ích */}
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <div className="text-right">
              <div className="text-base sm:text-2xl font-black tracking-wider text-indigo-300 font-mono">
                {timeFormatted}
              </div>
              <div className="text-[10px] sm:text-xs text-slate-400 capitalize font-medium hidden sm:block">
                {dateFormatted}
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-2 sm:border-l sm:border-slate-800 sm:pl-4">
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="p-2 sm:p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                title={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400" /> : <VolumeX className="w-4 h-4 sm:w-5 sm:h-5 text-slate-500" />}
              </button>
              <button
                onClick={() => {
                  if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen();
                  } else {
                    document.exitFullscreen();
                  }
                }}
                className="p-2 sm:p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                title="Toàn màn hình"
              >
                <Maximize2 className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="px-2.5 sm:px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition flex items-center gap-1 text-xs font-bold cursor-pointer"
                title="Thoát Kiosk về Bảng Điều Khiển"
              >
                <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400" />
                <span className="hidden md:inline">Thoát</span>
              </button>
            </div>
          </div>
        </div>

        {/* Hàng 2: Chế độ Auto / Vào Ca / Ra Về */}
        <div className="grid grid-cols-3 xl:flex items-center gap-1.5 p-1 bg-slate-950/90 rounded-2xl border border-slate-800 shadow-inner">
          <button
            onClick={() => setKioskMode('auto')}
            className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-4 py-2 rounded-xl text-xs font-bold transition duration-200 cursor-pointer ${kioskMode === 'auto'
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30 ring-1 ring-white/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span className="truncate">Tự Động</span>
          </button>
          <button
            onClick={() => setKioskMode('check_in')}
            className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-4 py-2 rounded-xl text-xs font-bold transition duration-200 cursor-pointer ${kioskMode === 'check_in'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 ring-1 ring-emerald-300/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
          >
            <LogIn className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
            <span className="truncate">Vào Ca</span>
          </button>
          <button
            onClick={() => setKioskMode('check_out')}
            className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-4 py-2 rounded-xl text-xs font-bold transition duration-200 cursor-pointer ${kioskMode === 'check_out'
              ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30 ring-1 ring-cyan-300/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
          >
            <LogOut className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
            <span className="truncate">Ra Về</span>
          </button>
        </div>
      </div>

      {/* =============== THANH ĐIỀU HƯỚNG: Face ID / QR =============== */}
      <div className="shrink-0 bg-slate-900/60 border-b border-slate-800/80 px-3 sm:px-6 py-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 z-20">
        <div className="grid grid-cols-2 sm:flex items-center gap-2">
          <button
            onClick={() => setDisplayTab('face')}
            className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${displayTab === 'face'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70'
              }`}
          >
            <UserCheck className="w-4 h-4 text-indigo-300 shrink-0" />
            <span className="truncate">Camera Face ID</span>
          </button>

          <button
            onClick={() => setDisplayTab('qr')}
            className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${displayTab === 'qr'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70'
              }`}
          >
            <QrCode className="w-4 h-4 text-purple-300 shrink-0" />
            <span className="truncate">Mã QR Động</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
          </button>
        </div>

        {/* Camera selector & Lịch sử */}
        <div className="flex items-center justify-between sm:justify-end gap-2">
          {displayTab === 'face' && cameraDevices.length > 0 && (
            <div className="flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs">
              <Camera className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <select
                value={selectedCameraId}
                onChange={(e) => switchCamera(e.target.value)}
                className="bg-transparent text-slate-300 text-xs outline-none cursor-pointer max-w-[120px] sm:max-w-[170px] truncate"
                title="Chọn thiết bị camera"
              >
                {cameraDevices.map((dev, idx) => (
                  <option key={dev.deviceId || idx} value={dev.deviceId} className="bg-slate-900 text-white">
                    {dev.label || `Camera ${idx + 1}`}
                  </option>
                ))}
              </select>
              <button
                onClick={() => forceWake()}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-indigo-300 transition cursor-pointer"
                title="Khởi động lại luồng Camera"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Camera State Badge */}
          {displayTab === 'face' && (
            <div className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-wide ${
              cameraState === 'SLEEPING' ? 'bg-slate-800/80 border-slate-700 text-slate-500' :
              cameraState === 'WAKING' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
              'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            }`}>
              <Zap className="w-3 h-3" />
              {cameraState === 'SLEEPING' ? 'Chờ người' : cameraState === 'WAKING' ? 'Đang bật...' : 'Active'}
            </div>
          )}

          <button
            onClick={() => setShowMobileHistory(!showMobileHistory)}
            className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/80 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-bold transition cursor-pointer"
          >
            <History className="w-3.5 h-3.5 text-indigo-400" />
            <span>Lịch sử ({recentScans.length})</span>
          </button>

          <div className="hidden md:flex items-center gap-2 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800 text-xs text-slate-300 shrink-0">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-semibold text-emerald-300">Kiosk Cố Định Sảnh</span>
          </div>
        </div>
      </div>

      {/* =============== MAIN KIOSK AREA =============== */}
      <div className="flex-1 flex items-center justify-center p-3 sm:p-4 lg:p-6 gap-6 relative min-h-0 my-auto">
        {displayTab === 'qr' ? (
          /* =============== QR CODE ĐỘNG =============== */
          <div className="relative w-full max-w-4xl aspect-[4/3] sm:aspect-[16/10] max-h-[min(560px,calc(100vh-210px))] min-h-[300px] bg-slate-900 rounded-3xl overflow-hidden border-2 border-purple-500/30 shadow-2xl shadow-purple-500/10 flex flex-col items-center justify-center p-4 sm:p-6 text-center">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>

            {/* Badge + Counter */}
            <div className="flex items-center justify-between w-full max-w-md mb-2 sm:mb-3 z-10">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="px-2.5 sm:px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-400/30 text-[11px] sm:text-xs font-bold flex items-center gap-1.5">
                  <Radio className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-purple-400 animate-pulse" />
                  MÃ QR ĐỘNG TOTP
                </span>
                <span className="text-[10px] sm:text-[11px] text-slate-400 font-mono hidden sm:inline">HMAC-SHA256</span>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15" fill="none" stroke="#334155" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15" fill="none" stroke="#a855f7" strokeWidth="3"
                      strokeDasharray="94.2" strokeDashoffset={94.2 - (94.2 * qrCountdown) / 20}
                      className="transition-all duration-1000 ease-linear" />
                  </svg>
                  <span className="absolute text-[10px] sm:text-[11px] font-mono font-black text-purple-300">{qrCountdown}s</span>
                </div>
                <button
                  onClick={fetchNewQrCode}
                  disabled={isLoadingQr}
                  className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                  title="Làm mới mã QR ngay lập tức"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingQr ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* QR Code */}
            <div className="relative z-10 mb-2 sm:mb-3">
              <div className="absolute -top-2 -left-2 sm:-top-2.5 sm:-left-2.5 w-5 h-5 sm:w-6 sm:h-6 border-t-2 border-l-2 border-purple-400 rounded-tl-xl pointer-events-none"></div>
              <div className="absolute -top-2 -right-2 sm:-top-2.5 sm:-right-2.5 w-5 h-5 sm:w-6 sm:h-6 border-t-2 border-r-2 border-purple-400 rounded-tr-xl pointer-events-none"></div>
              <div className="absolute -bottom-2 -left-2 sm:-bottom-2.5 sm:-left-2.5 w-5 h-5 sm:w-6 sm:h-6 border-b-2 border-l-2 border-purple-400 rounded-bl-xl pointer-events-none"></div>
              <div className="absolute -bottom-2 -right-2 sm:-bottom-2.5 sm:-right-2.5 w-5 h-5 sm:w-6 sm:h-6 border-b-2 border-r-2 border-purple-400 rounded-br-xl pointer-events-none"></div>

              <div className="w-44 h-44 sm:w-60 sm:h-60 p-3 sm:p-3.5 bg-white rounded-2xl shadow-2xl shadow-purple-500/20 flex items-center justify-center overflow-hidden">
                {dynamicQrSvg ? (
                  <div dangerouslySetInnerHTML={{ __html: dynamicQrSvg }} className="w-full h-full flex items-center justify-center" />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400 gap-2">
                    <RefreshCw className="w-6 h-6 sm:w-7 sm:h-7 animate-spin text-purple-500" />
                    <span className="text-xs font-semibold">Đang tạo mã QR...</span>
                  </div>
                )}
              </div>
            </div>

            <div className="max-w-md z-10">
              <h3 className="text-xs sm:text-sm font-bold text-white mb-0.5">
                Quét Mã Bằng Điện Thoại Để Điểm Danh
              </h3>
              <p className="text-[10px] sm:text-[11px] text-slate-400 leading-snug">
                Mở ứng dụng hoặc Web trên điện thoại &gt; Chọn tab{' '}
                <strong className="text-purple-300">"Quét QR Động"</strong>. Tự đổi sau 20s.
              </p>
            </div>
          </div>
        ) : (
          /* =============== CAMERA FACE ID (với Sleep/Wake) =============== */
          <div
            className="relative w-full max-w-4xl aspect-[4/3] sm:aspect-[16/10] max-h-[min(560px,calc(100vh-210px))] min-h-[300px] bg-slate-900 rounded-3xl overflow-hidden border-2 border-indigo-500/30 shadow-2xl shadow-indigo-500/10 flex items-center justify-center"
            onClick={() => { if (cameraState === 'SLEEPING') forceWake(); }}
          >

            {/* ===== MÀN HÌNH STANDBY (Camera đang ngủ) ===== */}
            {cameraState === 'SLEEPING' && (
              <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center z-30 p-6 text-center cursor-pointer">
                {/* Hiệu ứng pulse nhẹ nền */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-indigo-600/5 rounded-full animate-pulse pointer-events-none"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-indigo-500/8 rounded-full animate-ping pointer-events-none" style={{ animationDuration: '3s' }}></div>

                {/* Icon camera ngủ */}
                <div className="relative mb-6 z-10">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-slate-800/80 border-2 border-slate-700/60 flex items-center justify-center shadow-2xl">
                    <Eye className="w-10 h-10 sm:w-12 sm:h-12 text-slate-500" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center">
                    <Moon className="w-4 h-4 text-indigo-400" />
                  </div>
                </div>

                {/* Đồng hồ lớn */}
                <div className="text-4xl sm:text-6xl font-black tracking-wider text-indigo-300/80 font-mono mb-2 z-10">
                  {timeFormatted}
                </div>
                <div className="text-sm sm:text-base text-slate-500 capitalize font-medium mb-6 z-10">
                  {dateFormatted}
                </div>

                {/* Hướng dẫn */}
                <div className="flex flex-col items-center gap-2 z-10">
                  <div className="flex items-center gap-2 text-sm sm:text-base text-slate-400 font-semibold">
                    <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400 animate-pulse" />
                    <span>Đi tới gần Kiosk để bắt đầu điểm danh</span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-slate-600 max-w-sm">
                    Camera tự động bật khi phát hiện chuyển động • Chạm màn hình để bật ngay
                  </p>
                </div>

                {/* Badge trạng thái tiết kiệm năng lượng */}
                <div className="absolute bottom-4 sm:bottom-6 flex items-center gap-2 text-[10px] text-slate-600 z-10">
                  <div className="w-2 h-2 rounded-full bg-indigo-500/50 animate-pulse"></div>
                  <span>Chế độ tiết kiệm năng lượng • Camera đã tắt</span>
                </div>
              </div>
            )}

            {/* ===== MÀN HÌNH ĐANG BẬT CAMERA ===== */}
            {cameraState === 'WAKING' && (
              <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center z-30 p-6 text-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-indigo-600/20 border-2 border-indigo-500/40 flex items-center justify-center mb-4 animate-pulse">
                  <Camera className="w-8 h-8 sm:w-10 sm:h-10 text-indigo-400" />
                </div>
                <h4 className="text-white font-bold text-sm sm:text-base mb-1">Đang khởi động Camera...</h4>
                <p className="text-[11px] sm:text-xs text-slate-400 max-w-md">
                  Vui lòng đứng thẳng trước màn hình và chờ trong giây lát
                </p>
                {/* Progress bar animation */}
                <div className="w-48 h-1 bg-slate-800 rounded-full mt-4 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                </div>
              </div>
            )}

            {/* ===== LUỒNG VIDEO HD ===== */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              onLoadedMetadata={() => {
                videoRef.current?.play().catch((err) => console.warn('Video play warning:', err));
              }}
              className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1] z-0"
              style={cameraState === 'ACTIVE' ? videoFilterStyle : {}}
            />
            {/* Canvas overlay */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full object-cover pointer-events-none z-10"
            />

            {/* Camera chưa sẵn sàng (khi ACTIVE nhưng stream lỗi) */}
            {cameraState === 'ACTIVE' && !isCameraActive && (
              <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center z-15 p-4 sm:p-6 text-center">
                <CameraOff className="w-10 h-10 sm:w-14 sm:h-14 text-slate-500 mb-2 sm:mb-3 animate-pulse" />
                <h4 className="text-white font-bold text-sm sm:text-base mb-1">Camera Đang Khởi Động Hoặc Bị Khóa</h4>
                <p className="text-[11px] sm:text-xs text-slate-400 max-w-md mb-3 sm:mb-4 leading-relaxed">
                  Nếu màn hình đen, hãy kiểm tra nút gạt camera vật lý hoặc ứng dụng khác (Zoom, Teams) đang chiếm camera.
                </p>
                <button
                  onClick={() => forceWake()}
                  className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Kích Hoạt Lại Camera</span>
                </button>
              </div>
            )}

            {/* ===== STATUS BADGES (chỉ hiển thị khi ACTIVE) ===== */}
            {cameraState === 'ACTIVE' && (
              <>
                {/* Badge Góc Trái: Camera + Liveness + Luminance */}
                <div className="absolute top-3 sm:top-5 left-3 sm:left-5 flex flex-col gap-1.5 z-20">
                  <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-900/85 backdrop-blur-md px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full border border-slate-700 text-[10px] sm:text-xs font-semibold shadow-md">
                    <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-emerald-500 animate-ping" />
                    <span className="text-emerald-400">CAMERA TRỰC TIẾP</span>
                    <span className="text-slate-500 hidden sm:inline">&bull;</span>
                    <span className="text-slate-300 hidden sm:flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                      Liveness ON
                    </span>
                  </div>

                  {/* Luminance Indicator */}
                  <div className="flex items-center gap-1.5 bg-slate-900/85 backdrop-blur-md px-2.5 py-1 rounded-full border border-slate-700 text-[10px] font-semibold shadow-md">
                    {getLuminanceIcon()}
                    <span className={`${lightingCondition === 'OPTIMAL' ? 'text-emerald-400' : lightingCondition === 'TOO_DARK' ? 'text-orange-400' : lightingCondition === 'LOW_LIGHT' ? 'text-amber-400' : 'text-yellow-300'}`}>
                      {lightingCondition === 'OPTIMAL' ? 'Sáng tốt' : lightingCondition === 'TOO_DARK' ? 'Quá tối' : lightingCondition === 'LOW_LIGHT' ? 'Hơi tối' : 'Quá sáng'}
                    </span>
                    {/* Mini bar */}
                    <div className="w-12 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${getLuminanceColor()}`} style={{ width: `${Math.min(100, (luminance / 255) * 100)}%` }}></div>
                    </div>
                    <span className="text-slate-500 font-mono">{luminance}</span>
                  </div>
                </div>

                {/* Badge Góc Phải: State Machine */}
                <div className="absolute top-3 sm:top-5 right-3 sm:right-5 flex items-center gap-1.5 sm:gap-2 bg-slate-900/85 backdrop-blur-md px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-full border border-slate-700 text-[10px] sm:text-xs font-bold tracking-wide z-20 shadow-md">
                  {kioskState === 'IDLE' && (
                    <span className="text-slate-400 flex items-center gap-1 sm:gap-1.5">
                      <Activity className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-500" />
                      <span>SẴN SÀNG CHỜ</span>
                    </span>
                  )}
                  {kioskState === 'DETECTING' && (
                    <span className="text-purple-300 flex items-center gap-1 sm:gap-1.5 animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-purple-400" />
                      <span>NHẬN DIỆN ({detectionProgress}%)</span>
                    </span>
                  )}
                  {kioskState === 'VERIFYING' && (
                    <span className="text-cyan-300 flex items-center gap-1 sm:gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                      <span>ĐỐI SOÁT AI...</span>
                    </span>
                  )}
                  {kioskState === 'SUCCESS' && (
                    <span className="text-emerald-300 flex items-center gap-1 sm:gap-1.5">
                      <UserCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400" />
                      <span>THÀNH CÔNG</span>
                    </span>
                  )}
                  {kioskState === 'ERROR' && (
                    <span className="text-rose-300 flex items-center gap-1 sm:gap-1.5">
                      <AlertTriangle className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-rose-400" />
                      <span>KHÔNG KHỚP</span>
                    </span>
                  )}
                </div>

                {/* Hướng dẫn căn chỉnh */}
                <div className="absolute bottom-3 sm:bottom-6 inset-x-0 flex justify-center pointer-events-none z-20 px-3">
                  <div className="bg-slate-950/85 backdrop-blur-md px-3 sm:px-6 py-1.5 sm:py-2.5 rounded-2xl border border-slate-800 text-[10px] sm:text-xs text-slate-300 flex items-center gap-2 shadow-lg text-center max-w-sm sm:max-w-md">
                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping shrink-0" />
                    <span className="truncate sm:whitespace-normal">
                      {kioskMode === 'auto'
                        ? 'Đứng thẳng trước camera: Quét đầu ca để Vào ca, cuối ca để Ra về'
                        : kioskMode === 'check_in'
                          ? 'Đứng thẳng trước camera để ghi nhận Vào ca (Check-in)'
                          : 'Đứng thẳng trước camera để ghi nhận Ra về (Check-out)'}
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* ===== POPUP THÀNH CÔNG ===== */}
            {result && (
              <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-8 z-30 animate-in fade-in zoom-in-95 duration-200">
                <div
                  className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 flex items-center justify-center mb-3 sm:mb-4 ${result.action === 'CHECK_OUT'
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-400 shadow-xl shadow-cyan-500/20'
                    : 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-xl shadow-emerald-500/20'
                    }`}
                >
                  {result.action === 'CHECK_OUT' ? (
                    <LogOut className="w-8 h-8 sm:w-10 sm:h-10 text-cyan-400" />
                  ) : (
                    <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-400" />
                  )}
                </div>

                <div
                  className={`text-[11px] sm:text-xs uppercase tracking-widest font-black mb-1 ${result.action === 'CHECK_OUT' ? 'text-cyan-400' : 'text-emerald-400'
                    }`}
                >
                  {result.action === 'CHECK_OUT' ? '🎉 CHECK-OUT (RA VỀ) THÀNH CÔNG!' : '✨ CHECK-IN (VÀO CA) THÀNH CÔNG!'}
                </div>

                <h2 className="text-xl sm:text-3xl font-black text-white mb-1 text-center">{result.user?.fullName}</h2>

                <p className="text-xs sm:text-sm text-slate-400 mb-3 sm:mb-5 font-mono">
                  {maskEmail(result.user?.email)}
                </p>

                <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                  {result.action === 'CHECK_OUT' ? (
                    <>
                      <span
                        className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-black tracking-wide border ${result.statusText === 'EARLY_LEAVE' || result.earlyLeave?.isEarlyLeave
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                          }`}
                      >
                        {result.statusText === 'EARLY_LEAVE' || result.earlyLeave?.isEarlyLeave
                          ? `⚠ VỀ SỚM (${result.earlyLeave?.earlyMinutes || 0} phút)`
                          : '✓ HOÀN THÀNH CA DẠY'}
                      </span>

                      {result.workingDuration && (
                        <span className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold bg-indigo-950/60 border border-indigo-500/40 text-indigo-300 flex items-center gap-1.5">
                          <Timer className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-400" />
                          Thời gian: {result.workingDuration.formatted}
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <span
                        className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-black tracking-wide border ${result.status === 'ON_TIME' || result.statusText === 'ON_TIME'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          }`}
                      >
                        {result.status === 'ON_TIME' || result.statusText === 'ON_TIME' ? '✓ ĐÚNG GIỜ' : '⚠ ĐI MUỘN'}
                      </span>

                      <span className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold bg-slate-800 border border-slate-700 text-slate-300">
                        Khớp: {(result.confidenceScore * 100).toFixed(1)}%
                      </span>
                    </>
                  )}
                </div>

                {result.attendance?.shiftId && (
                  <div className="mt-3 sm:mt-4 text-xs text-slate-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" />
                    <span>
                      {result.attendance.shiftId.name} ({result.attendance.shiftId.startTime} -{' '}
                      {result.attendance.shiftId.endTime})
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* POPUP BÁO LỖI */}
            {errorMessage && !result && (
              <div className="absolute inset-x-4 sm:inset-x-8 bottom-16 sm:bottom-20 bg-rose-950/90 backdrop-blur-md border border-rose-600/50 p-3 sm:p-4 rounded-2xl flex items-center gap-3 z-30 shadow-xl">
                <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-rose-400 shrink-0" />
                <div className="text-xs font-semibold text-rose-200">{errorMessage}</div>
              </div>
            )}

            {/* GỢI Ý LIVENESS */}
            {livenessHint && !errorMessage && !result && cameraState === 'ACTIVE' && (
              <div className="absolute inset-x-4 sm:inset-x-8 bottom-16 sm:bottom-20 bg-amber-950/90 backdrop-blur-md border border-amber-500/50 p-3 sm:p-4 rounded-2xl flex items-center gap-3 z-30 shadow-xl animate-pulse">
                <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400 shrink-0" />
                <div className="text-xs font-bold text-amber-200">{livenessHint}</div>
              </div>
            )}

            {/* CẢNH BÁO ÁNH SÁNG */}
            {lightingWarning && !errorMessage && !result && !livenessHint && cameraState === 'ACTIVE' && (
              <div className="absolute inset-x-4 sm:inset-x-8 bottom-16 sm:bottom-20 bg-slate-900/90 backdrop-blur-md border border-amber-500/40 p-3 sm:p-4 rounded-2xl flex items-center gap-3 z-30 shadow-xl">
                {lightingCondition === 'TOO_DARK' ? <Moon className="w-5 h-5 text-amber-400 shrink-0" /> : <Sun className="w-5 h-5 text-yellow-400 shrink-0" />}
                <div className="text-xs font-semibold text-amber-200">{lightingWarning}</div>
              </div>
            )}
          </div>
        )}

        {/* =============== SIDEBAR LỊCH SỬ (Desktop) =============== */}
        <div className="hidden lg:flex flex-col w-72 max-h-[min(560px,calc(100vh-210px))] min-h-[300px] bg-slate-900/70 border border-slate-800 rounded-3xl p-4 backdrop-blur-md shrink-0">
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
                  <div className="shrink-0">
                    <UserAvatar user={item.user} size="sm" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-200 truncate">{item.user?.fullName}</p>
                    <p className="text-[10px] text-slate-500 font-mono">
                      {new Date(item.scannedAt || Date.now()).toLocaleTimeString('vi-VN', {
                        hour: '2-digit', minute: '2-digit',
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
                    className={`text-[10px] px-2 py-0.5 rounded-lg font-bold border shrink-0 ${item.statusText === 'EARLY_LEAVE'
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

      {/* =============== DRAWER MOBILE HISTORY =============== */}
      {showMobileHistory && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end lg:hidden animate-in fade-in duration-200">
          <div className="bg-slate-900 border-t border-slate-800 rounded-t-3xl max-h-[75vh] flex flex-col p-4 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <History className="w-4 h-4 text-indigo-400" />
                <span>Lượt Quét Gần Nhất ({recentScans.length})</span>
              </div>
              <button
                onClick={() => setShowMobileHistory(false)}
                className="p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 py-3">
              {recentScans.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  <UserCheck className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                  <span>Chưa có lượt điểm danh nào trong phiên này.</span>
                </div>
              ) : (
                recentScans.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center gap-3"
                  >
                    <UserAvatar user={item.user} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-200 truncate">{item.user?.fullName}</p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {new Date(item.scannedAt || Date.now()).toLocaleTimeString('vi-VN', {
                          hour: '2-digit', minute: '2-digit',
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
                      className={`text-[10px] px-2.5 py-1 rounded-lg font-bold border shrink-0 ${
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
          </div>
        </div>
      )}

      {/* =============== BOTTOM BAR =============== */}
      <div className="shrink-0 bg-slate-900/90 backdrop-blur-md border-t border-slate-800/80 px-4 sm:px-6 py-2.5 sm:py-3 flex flex-col sm:flex-row items-center justify-between gap-3 z-20 mt-auto">
        <div className="hidden sm:block text-xs text-slate-500 font-medium">
          Mô hình: <span className="text-slate-400">TinyFaceDetector + Euclidean (d &lt; 0.55)</span> &bull; Trạng thái:{' '}
          <span className="text-indigo-400 font-bold uppercase">{kioskState}</span>
          {cameraState !== 'ACTIVE' && (
            <> &bull; Camera: <span className="text-amber-400 font-bold uppercase">{cameraState}</span></>
          )}
        </div>

        <div className="flex items-center justify-center sm:justify-end gap-2 sm:gap-3 w-full sm:w-auto">
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={handleBackupUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 transition cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-400 shrink-0" />
            <span className="truncate">Tải Ảnh (Dự phòng)</span>
          </button>
          <button
            onClick={() => setIsScanning(!isScanning)}
            className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition border cursor-pointer ${isScanning
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
