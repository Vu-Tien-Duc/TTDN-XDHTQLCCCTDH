import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as faceapi from '@vladmandic/face-api';
import {
  UserCheck,
  UserX,
  Camera,
  CameraOff,
  Upload,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Scan,
  ShieldCheck,
  User,
  Sparkles,
  RotateCw,
  RotateCcw,
  Check,
} from 'lucide-react';
import { attendanceApi } from '../api';
import { toast } from 'react-hot-toast';

interface Lecturer {
  _id: string;
  fullName: string;
  email: string;
  role: string;
  departmentId?: { _id: string; name: string };
  avatar?: string;
  faceRegistered?: boolean;
}

// 3 góc chụp khuôn mặt sinh trắc học tối ưu (P1 - Item 16)
const POSES = [
  { step: 1, title: 'Nhìn thẳng vào camera', desc: 'Giữ khuôn mặt chính diện, nhìn thẳng vào ống kính' },
  { step: 2, title: 'Quay nhẹ sang trái (15° - 30°)', desc: 'Hơi nghiêng mặt sang bên trái của bạn' },
  { step: 3, title: 'Quay nhẹ sang phải (15° - 30°)', desc: 'Hơi nghiêng mặt sang bên phải của bạn' },
];

export const FaceRegistrationPage: React.FC = () => {
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<Lecturer | null>(null);

  // Trạng thái AI Model
  const [modelReady, setModelReady] = useState(false);
  const [loadingModel, setLoadingModel] = useState(false);

  // Camera & Biometric Rotation Scanning (Quay đầu 1 vòng)
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [circleProgress, setCircleProgress] = useState<number>(0); // 0 -> 100%
  const [coveredCount, setCoveredCount] = useState<number>(0);
  const [isSavingAuto, setIsSavingAuto] = useState<boolean>(false);
  const [detectedDescriptor, setDetectedDescriptor] = useState<number[] | null>(null);
  const [capturedImagePreview, setCapturedImagePreview] = useState<string | null>(null);
  const [samples, setSamples] = useState<number[][]>([]);
  const [samplePreviews, setSamplePreviews] = useState<string[]>([]);
  const [duplicateError, setDuplicateError] = useState<{
    message: string;
    duplicateFullName?: string;
    duplicateEmail?: string;
    distance?: number;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const scanIntervalRef = useRef<any>(null);
  const isDetectingRef = useRef<boolean>(false);
  const ticksCoveredRef = useRef<boolean[]>(Array(24).fill(false));
  const circleSamplesRef = useRef<number[][]>([]);
  const lastSectorSampledRef = useRef<number>(-1);
  const isAutoSavingRef = useRef<boolean>(false);

  // 1. Tải model weights
  const loadFaceModels = useCallback(async () => {
    if (modelReady || loadingModel) return;
    try {
      setLoadingModel(true);
      await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
      await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
      await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
      setModelReady(true);
    } catch (error) {
      console.error('Lỗi nạp model face-api:', error);
      toast.error('Không thể nạp model AI khuôn mặt từ thư mục /models');
    } finally {
      setLoadingModel(false);
    }
  }, [modelReady, loadingModel]);

  // 2. Lấy danh sách giảng viên
  const fetchLecturers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await attendanceApi.getUsers();
      if (res && res.data) {
        setLecturers(res.data);
      }
    } catch (error) {
      console.error('Lỗi lấy danh sách giảng viên:', error);
      toast.error('Không thể tải danh sách giảng viên');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLecturers();
    loadFaceModels();
  }, [fetchLecturers, loadFaceModels]);

  // Âm thanh phản hồi quét sinh trắc học công nghệ cao
  const playBeep = useCallback((freq: number = 880, duration: number = 0.15) => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch {}
  }, []);

  const playTickSound = useCallback(() => {
    playBeep(720, 0.05);
  }, [playBeep]);

  const playCelebrationChime = useCallback(() => {
    playBeep(523.25, 0.1);
    setTimeout(() => playBeep(659.25, 0.1), 90);
    setTimeout(() => playBeep(783.99, 0.1), 180);
    setTimeout(() => playBeep(1046.5, 0.25), 270);
  }, [playBeep]);

  // 3. Điều khiển Camera & Khởi tạo vòng quét tròn 360°
  const startCamera = async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      });
      streamRef.current = stream;
      setIsCameraActive(true);
      setDetectedDescriptor(null);
      setCapturedImagePreview(null);
      setSamples([]);
      setSamplePreviews([]);
      setDuplicateError(null);
      setCircleProgress(0);
      setCoveredCount(0);
      ticksCoveredRef.current = Array(24).fill(false);
      circleSamplesRef.current = [];
      lastSectorSampledRef.current = -1;
      isAutoSavingRef.current = false;
      setIsSavingAuto(false);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (e) {
          console.warn('Lỗi video.play:', e);
        }
      }
    } catch (error) {
      console.error('Lỗi mở camera:', error);
      toast.error('Không thể mở camera. Vui lòng cấp quyền webcam hoặc dùng nút Tải ảnh lên.');
    }
  };

  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    setIsCameraActive(false);
    setIsSavingAuto(false);
    isAutoSavingRef.current = false;
  };

  // Đảm bảo stream được gắn vào video khi isCameraActive bật
  useEffect(() => {
    if (isCameraActive && videoRef.current && streamRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.play().catch((err) => console.warn('Lỗi play stream:', err));
      }
    }
  }, [isCameraActive]);

  // Cleanup camera khi unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Tự động lưu Face ID sau khi hoàn tất 1 vòng quay
  const autoSaveFaceDescriptor = useCallback(async (collectedSamples: number[][]) => {
    if (!selectedUser || collectedSamples.length === 0) return;

    try {
      setIsExtracting(true);
      setDuplicateError(null);
      setIsSavingAuto(true);

      const payload = collectedSamples.length >= 3 ? collectedSamples : collectedSamples[0];
      const res = await attendanceApi.registerFaceDescriptor(selectedUser._id, payload);

      if (res && res.success) {
        playCelebrationChime();
        toast.success(`🎉 Đã quét trọn vẹn toàn bộ khuôn mặt và lưu Face ID thành công cho ${selectedUser.fullName}!`, { duration: 6000 });
        setLecturers((prev) =>
          prev.map((item) => (item._id === selectedUser._id ? { ...item, faceRegistered: true } : item))
        );
        setSelectedUser((prev) => (prev ? { ...prev, faceRegistered: true } : null));
        stopCamera();
      }
    } catch (error: any) {
      console.error('Lỗi tự động lưu Face ID:', error);
      playBeep(300, 0.3);
      if (error.response?.status === 409) {
        const errPayload = error.response.data || {};
        const errErrors = errPayload.errors || {};
        const msg = errPayload.message || 'Khuôn mặt này đã được đăng ký cho tài khoản khác!';
        setDuplicateError({
          message: msg,
          duplicateFullName: errErrors.duplicateFullName,
          duplicateEmail: errErrors.duplicateEmail,
          distance: errErrors.distance,
        });
        toast.error(`⚠️ ${msg}`, { duration: 7000 });
      } else {
        toast.error(error.response?.data?.message || 'Lỗi khi lưu vector khuôn mặt vào máy chủ');
      }
    } finally {
      setIsExtracting(false);
      setIsSavingAuto(false);
    }
  }, [selectedUser, playCelebrationChime, playBeep]);

  // VÒNG LẶP QUÉT TRÒN QUAY ĐẦU 1 VÒNG (SINGLE CIRCULAR HEAD TURN SCANNER)
  useEffect(() => {
    if (!isCameraActive || !modelReady || !selectedUser) {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
      return;
    }

    const runCircleScanTick = async () => {
      if (isDetectingRef.current || isAutoSavingRef.current || isExtracting) return;
      if (!videoRef.current || videoRef.current.readyState < 2) return;

      isDetectingRef.current = true;
      try {
        const video = videoRef.current;
        const detections = await faceapi
          .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.35 }))
          .withFaceLandmarks()
          .withFaceDescriptors();

        const canvas = canvasRef.current;
        if (!canvas) return;

        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
        }
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const cX = canvas.width / 2;
        const cY = canvas.height / 2;
        const radius = Math.min(canvas.width, canvas.height) * 0.32;
        const numTicks = 24;

        if (!detections || detections.length === 0) {
          // Vẽ vòng tròn ticks màu xám khi chưa có mặt
          drawTicks(ctx, cX, cY, radius, numTicks, ticksCoveredRef.current, null, 0);
          return;
        }

        // Chọn khuôn mặt trung tâm nhất
        let targetFace = detections[0];
        let bestScore = -Infinity;
        const maxD = Math.hypot(cX, cY);

        for (const d of detections) {
          const box = d.detection.box;
          const fX = box.x + box.width / 2;
          const fY = box.y + box.height / 2;
          const dist = Math.hypot(fX - cX, fY - cY);
          const centerWeight = Math.max(0.3, 1.0 - 0.7 * (dist / maxD));
          const score = box.width * box.height * centerWeight;
          if (score > bestScore) {
            bestScore = score;
            targetFace = d;
          }
        }

        const pos = targetFace.landmarks.positions;
        const nose = pos[30];
        const leftJaw = pos[0];
        const rightJaw = pos[16];
        const chin = pos[8];
        const leftEye = pos[36];
        const rightEye = pos[45];

        const faceCenterX = (leftJaw.x + rightJaw.x) / 2;
        const faceWidth = Math.max(1, rightJaw.x - leftJaw.x);
        const eyeCenterY = (leftEye.y + rightEye.y) / 2;
        const faceHeight = Math.max(1, chin.y - eyeCenterY);

        // Vector độ lệch quay đầu (dx: trái/phải, dy: ngước/cúi)
        const dx = (nose.x - faceCenterX) / (faceWidth * 0.45);
        const dy = (nose.y - (eyeCenterY + chin.y) / 2) / (faceHeight * 0.45);
        const mag = Math.hypot(dx, dy);

        let currentAngle: number | null = null;

        // Vẽ các điểm mốc sinh trắc học trên khuôn mặt
        ctx.fillStyle = 'rgba(52, 211, 153, 0.75)';
        for (let i = 0; i < pos.length; i += 2) {
          const p = pos[i];
          ctx.beginPath();
          ctx.arc(p.x, p.y, 2, 0, 2 * Math.PI);
          ctx.fill();
        }

        // Khi người dùng nghiêng/quay đầu theo vòng tròn
        if (mag >= 0.055) {
          // Tính góc nghiêng trong khoảng [0, 2*PI)
          let angle = Math.atan2(dy, dx);
          if (angle < 0) angle += 2 * Math.PI;
          currentAngle = angle;

          const sectorIdx = Math.floor((angle / (2 * Math.PI)) * numTicks) % numTicks;

          if (!ticksCoveredRef.current[sectorIdx]) {
            ticksCoveredRef.current[sectorIdx] = true;
            playTickSound();

            // Trích xuất mẫu vector sinh trắc học ở các góc cách nhau để đảm bảo độ bao phủ đa dạng
            if (
              lastSectorSampledRef.current === -1 ||
              Math.abs(sectorIdx - lastSectorSampledRef.current) >= 3 ||
              circleSamplesRef.current.length < 4
            ) {
              const desc = Array.from(targetFace.descriptor);
              circleSamplesRef.current.push(desc);
              lastSectorSampledRef.current = sectorIdx;
              setSamples([...circleSamplesRef.current]);

              // Snapshot frame hình minh chứng
              const snapCanvas = document.createElement('canvas');
              snapCanvas.width = 320;
              snapCanvas.height = 240;
              const sCtx = snapCanvas.getContext('2d');
              if (sCtx && videoRef.current) {
                sCtx.drawImage(videoRef.current, 0, 0, 320, 240);
              }
              const dataUrl = snapCanvas.toDataURL('image/jpeg', 0.85);
              setSamplePreviews((prev) => [...prev, dataUrl]);
              setCapturedImagePreview(dataUrl);
            }
          }
        } else {
          // Khi nhìn thẳng chính diện, nếu chưa có mẫu chính diện thì lưu mẫu 1
          if (circleSamplesRef.current.length === 0) {
            const desc = Array.from(targetFace.descriptor);
            circleSamplesRef.current.push(desc);
            setSamples([...circleSamplesRef.current]);
          }
        }

        // Đếm số vạch đã quét xong (cần 17/24 vạch ~ 70% vòng tròn là hoàn tất)
        const covered = ticksCoveredRef.current.filter(Boolean).length;
        setCoveredCount(covered);

        const pct = Math.min(100, Math.round((covered / 17) * 100));
        setCircleProgress(pct);

        // Vẽ 24 vạch tròn Face ID chuẩn Apple
        drawTicks(ctx, cX, cY, radius, numTicks, ticksCoveredRef.current, currentAngle, pct);

        // Đã hoàn tất 1 vòng quay -> Tự động lưu ngay
        if (pct >= 100 && !isAutoSavingRef.current && circleSamplesRef.current.length >= 2) {
          isAutoSavingRef.current = true;
          setIsSavingAuto(true);
          playCelebrationChime();
          toast.success('🎉 Đã nhận diện trọn vẹn toàn bộ khuôn mặt trong 1 vòng quay! Đang lưu Face ID...', { id: 'circle-save' });
          autoSaveFaceDescriptor([...circleSamplesRef.current]);
        }
      } catch (err) {
        console.error('Lỗi circle scan tick:', err);
      } finally {
        isDetectingRef.current = false;
      }
    };

    scanIntervalRef.current = setInterval(runCircleScanTick, 90);

    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
    };
  }, [isCameraActive, modelReady, selectedUser, isSavingAuto, isExtracting, autoSaveFaceDescriptor, playTickSound, playCelebrationChime]);

  // Hàm vẽ 24 vạch tròn chuẩn Face ID bao quanh khuôn mặt
  const drawTicks = (
    ctx: CanvasRenderingContext2D,
    cX: number,
    cY: number,
    radius: number,
    numTicks: number,
    ticksCovered: boolean[],
    currentAngle: number | null,
    progress: number
  ) => {
    const tickLen = 16;
    for (let i = 0; i < numTicks; i++) {
      const angle = (i / numTicks) * 2 * Math.PI - Math.PI / 2;
      const isCovered = ticksCovered[i] || progress >= 100;

      const rIn = radius;
      const rOut = radius + tickLen;
      const x1 = cX + Math.cos(angle) * rIn;
      const y1 = cY + Math.sin(angle) * rIn;
      const x2 = cX + Math.cos(angle) * rOut;
      const y2 = cY + Math.sin(angle) * rOut;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineWidth = isCovered ? 5 : 2.5;
      ctx.strokeStyle = isCovered ? '#10B981' : 'rgba(255, 255, 255, 0.3)';
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // Vẽ chấm tròn chỉ hướng quay đầu hiện tại
    if (currentAngle !== null && progress < 100) {
      const pAngle = currentAngle;
      const pR = radius + tickLen / 2;
      const pX = cX + Math.cos(pAngle) * pR;
      const pY = cY + Math.sin(pAngle) * pR;

      ctx.beginPath();
      ctx.arc(pX, pY, 7, 0, 2 * Math.PI);
      ctx.fillStyle = '#38BDF8';
      ctx.shadowColor = '#38BDF8';
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  };

  // 4. Chụp ảnh từ camera và trích xuất vector 128 số (Hỗ trợ 3 góc chụp P1 - Item 16, Item 17)
  const handleCaptureAndExtract = async () => {
    if (!videoRef.current || !modelReady) {
      toast.error('Camera hoặc Model AI chưa sẵn sàng');
      return;
    }

    if (!isCameraActive || videoRef.current.readyState < 2) {
      toast.error('Camera đang khởi động, vui lòng đợi hình ảnh xuất hiện rõ nét rồi nhấn Chụp!');
      return;
    }

    try {
      setIsExtracting(true);
      const video = videoRef.current;

      // Tạo canvas tạm để chụp frame hình
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }

      // Trích xuất vector từ canvas vừa chụp (đảm bảo frame tĩnh không bị rung giật)
      let detections = await faceapi
        .detectAllFaces(canvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.4 }))
        .withFaceLandmarks()
        .withFaceDescriptors();

      // Fallback threshold 0.3 nếu ánh sáng phòng chưa tối ưu
      if (!detections || detections.length === 0) {
        detections = await faceapi
          .detectAllFaces(canvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.3 }))
          .withFaceLandmarks()
          .withFaceDescriptors();
      }

      if (!detections || detections.length === 0) {
        toast.error('Không tìm thấy khuôn mặt rõ ràng! Vui lòng căn giữa khuôn mặt, tăng độ sáng và thử lại.');
        return;
      }

      // Chọn khuôn mặt đứng gần nhất và ở vị trí trung tâm nhất
      let targetFace = detections[0];
      let bestScore = -Infinity;
      const cX = canvas.width / 2;
      const cY = canvas.height / 2;
      const maxD = Math.hypot(cX, cY);

      for (const d of detections) {
        const box = d.detection.box;
        const fX = box.x + box.width / 2;
        const fY = box.y + box.height / 2;
        const dist = Math.hypot(fX - cX, fY - cY);
        const centerWeight = Math.max(0.3, 1.0 - 0.7 * (dist / maxD));
        const score = box.width * box.height * centerWeight;
        if (score > bestScore) {
          bestScore = score;
          targetFace = d;
        }
      }

      // Kiểm tra chất lượng ảnh đăng ký: Bounding box tối thiểu (Issue 17)
      if (targetFace.detection.box.width < 90 || targetFace.detection.box.height < 90) {
        toast.error('Khuôn mặt quá nhỏ hoặc ở quá xa (tối thiểu 90x90px)! Hãy di chuyển lại gần camera hơn.');
        return;
      }

      // Kiểm tra độ sáng ảnh (Issue 17)
      if (ctx) {
        const box = targetFace.detection.box;
        const imgData = ctx.getImageData(
          Math.max(0, Math.floor(box.x)),
          Math.max(0, Math.floor(box.y)),
          Math.min(Math.floor(box.width), canvas.width),
          Math.min(Math.floor(box.height), canvas.height)
        );
        let totalLuma = 0;
        for (let i = 0; i < imgData.data.length; i += 4) {
          totalLuma += (imgData.data[i] * 299 + imgData.data[i + 1] * 587 + imgData.data[i + 2] * 114) / 1000;
        }
        const avgLuma = totalLuma / Math.max(1, imgData.data.length / 4);
        if (avgLuma < 35) {
          toast.error('Ánh sáng quá tối! Vui lòng bật thêm đèn hoặc di chuyển đến nơi sáng hơn.');
          return;
        }
      }

      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      const descriptorArray = Array.from(targetFace.descriptor);
      const nextSamples = [...samples, descriptorArray];
      const nextPreviews = [...samplePreviews, dataUrl];

      setSamples(nextSamples);
      setSamplePreviews(nextPreviews);
      setCapturedImagePreview(dataUrl);

      if (nextSamples.length < 3) {
        toast.success(`Đã lưu góc ${nextSamples.length}/3 (${POSES[nextSamples.length - 1].title})! Tiếp theo: ${POSES[nextSamples.length].title}`);
      } else {
        setDetectedDescriptor(nextSamples[0]);
        stopCamera();
        toast.success('🎉 Đã thu thập đủ 3 góc chụp khuôn mặt! Nhấn "Xác Nhận & Lưu Face ID" để hoàn tất.');
      }
    } catch (error) {
      console.error('Lỗi trích xuất vector:', error);
      toast.error('Lỗi xử lý hình ảnh khuôn mặt: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsExtracting(false);
    }
  };

  // 5. Tải ảnh chân dung từ file
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!modelReady) {
      toast.error('Model AI đang nạp, vui lòng đợi giây lát!');
      return;
    }

    try {
      setIsExtracting(true);
      setDuplicateError(null);
      const img = await faceapi.bufferToImage(file);
      setCapturedImagePreview(img.src);
      stopCamera();

      let detections = await faceapi
        .detectAllFaces(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.4 }))
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (!detections || detections.length === 0) {
        detections = await faceapi
          .detectAllFaces(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.3 }))
          .withFaceLandmarks()
          .withFaceDescriptors();
      }

      if (!detections || detections.length === 0) {
        toast.error('Không tìm thấy khuôn mặt trong ảnh tải lên! Vui lòng chọn ảnh chụp thẳng, rõ mặt.');
        setDetectedDescriptor(null);
        setSamples([]);
        setSamplePreviews([]);
        return;
      }

      // Chọn khuôn mặt chiếm diện tích lớn nhất (chính diện)
      let targetFace = detections[0];
      let maxArea = -Infinity;
      for (const d of detections) {
        const area = d.detection.box.width * d.detection.box.height;
        if (area > maxArea) {
          maxArea = area;
          targetFace = d;
        }
      }

      // Kiểm tra chất lượng kích thước ảnh upload (Issue 17)
      if (targetFace.detection.box.width < 90 || targetFace.detection.box.height < 90) {
        toast.error('Khuôn mặt trong ảnh tải lên quá nhỏ (kích thước tối thiểu 90x90px). Vui lòng chọn ảnh chụp gần và rõ nét hơn!');
        setDetectedDescriptor(null);
        setSamples([]);
        setSamplePreviews([]);
        return;
      }

      const descriptorArray = Array.from(targetFace.descriptor);
      setDetectedDescriptor(descriptorArray);
      setSamples([descriptorArray]);
      setSamplePreviews([img.src]);

      if (detections.length > 1) {
        toast.success(`Đã tự động chọn khuôn mặt chủ thể chính trong ${detections.length} người trong ảnh tải lên.`);
      } else {
        toast.success('Đã trích xuất vector từ file ảnh! Nhấn "Xác Nhận & Lưu Face ID" để lưu.');
      }
    } catch (error) {
      console.error('Lỗi trích xuất ảnh:', error);
      toast.error('Không thể xử lý file ảnh');
    } finally {
      setIsExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 6. Gửi API lưu vector vào DB (Hỗ trợ đa vector 3 góc Issue 16)
  const handleSaveDescriptor = async () => {
    if (!selectedUser || (samples.length === 0 && !detectedDescriptor)) {
      toast.error('Vui lòng chọn giảng viên và chụp khuôn mặt trước!');
      return;
    }

    try {
      setIsExtracting(true);
      setDuplicateError(null);

      // Gửi đa vector 3 mẫu nếu có, hoặc vector đơn lẻ
      const payload = samples.length >= 3 ? samples : (detectedDescriptor || samples[0]);
      const res = await attendanceApi.registerFaceDescriptor(selectedUser._id, payload);

      if (res && res.success) {
        const countText = samples.length >= 3 ? ' (3 góc chụp sinh trắc học)' : '';
        toast.success(`🎉 Đã đăng ký Face ID thành công cho ${selectedUser.fullName}${countText}!`);
        // Cập nhật lại danh sách local
        setLecturers((prev) =>
          prev.map((item) => (item._id === selectedUser._id ? { ...item, faceRegistered: true } : item))
        );
        setSelectedUser((prev) => (prev ? { ...prev, faceRegistered: true } : null));
        setDetectedDescriptor(null);
        setSamples([]);
        setSamplePreviews([]);
        setCapturedImagePreview(null);
        setDuplicateError(null);
      }
    } catch (error: any) {
      console.error('Lỗi lưu Face ID:', error);
      if (error.response?.status === 409) {
        const errPayload = error.response.data || {};
        const errErrors = errPayload.errors || {};
        const msg = errPayload.message || 'Khuôn mặt này đã được đăng ký cho tài khoản khác!';
        setDuplicateError({
          message: msg,
          duplicateFullName: errErrors.duplicateFullName,
          duplicateEmail: errErrors.duplicateEmail,
          distance: errErrors.distance,
        });
        toast.error(`⚠️ ${msg}`, { duration: 7000 });
      } else {
        toast.error(error.response?.data?.message || 'Lỗi khi lưu vector khuôn mặt vào máy chủ');
      }
    } finally {
      setIsExtracting(false);
    }
  };

  // 7. Xóa dữ liệu Face ID của người dùng
  const handleDeleteFaceDescriptor = async () => {
    if (!selectedUser) return;
    const isConfirmed = window.confirm(
      `Bạn có chắc chắn muốn xóa Face ID của "${selectedUser.fullName}"?\n\nSau khi xóa, tài khoản này sẽ cần quét lại khuôn mặt thật qua Webcam để có thể điểm danh Kiosk.`
    );
    if (!isConfirmed) return;

    try {
      setIsExtracting(true);
      const res = await attendanceApi.deleteFaceDescriptor(selectedUser._id);
      if (res && res.success) {
        toast.success(`Đã xóa dữ liệu Face ID của ${selectedUser.fullName}!`);
        setLecturers((prev) =>
          prev.map((item) => (item._id === selectedUser._id ? { ...item, faceRegistered: false } : item))
        );
        setSelectedUser((prev) => (prev ? { ...prev, faceRegistered: false } : null));
        setDetectedDescriptor(null);
        setCapturedImagePreview(null);
        setDuplicateError(null);
      }
    } catch (error: any) {
      console.error('Lỗi xóa Face ID:', error);
      toast.error(error.response?.data?.message || 'Không thể xóa dữ liệu Face ID');
    } finally {
      setIsExtracting(false);
    }
  };

  const filteredLecturers = lecturers.filter(
    (l) =>
      l.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <Scan className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Đăng Ký Khuôn Mặt Giảng Viên (Face ID)</h1>
              <p className="text-sm text-gray-500">
                Trích xuất vector 128 chiều bảo mật tại client và lưu trữ phục vụ Kiosk tự động
              </p>
            </div>
          </div>
        </div>

        {/* Trạng thái model AI */}
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold ${
              modelReady ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {modelReady ? 'AI Face Models Sẵn Sàng' : loadingModel ? 'Đang nạp Model Weights...' : 'Chưa nạp Model'}
          </div>
          <button
            onClick={() => {
              fetchLecturers();
              loadFaceModels();
            }}
            className="p-2 hover:bg-gray-100 text-gray-600 rounded-xl transition"
            title="Làm mới"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Cột trái: Danh sách Giảng viên (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col h-[360px] lg:h-[700px]">
          <div className="p-4 border-b border-gray-100 space-y-3">
            <h2 className="font-bold text-gray-800 text-sm">Danh sách Nhân sự & Giảng viên</h2>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm theo tên hoặc email..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 divide-y divide-gray-50">
            {loading ? (
              <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
                Đang tải dữ liệu...
              </div>
            ) : filteredLecturers.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                Không tìm thấy nhân sự phù hợp
              </div>
            ) : (
              filteredLecturers.map((lec) => {
                const isSelected = selectedUser?._id === lec._id;
                return (
                  <div
                    key={lec._id}
                    onClick={() => {
                      setSelectedUser(lec);
                      setDetectedDescriptor(null);
                      setCapturedImagePreview(null);
                      setDuplicateError(null);
                      setCircleProgress(0);
                      setCoveredCount(0);
                      ticksCoveredRef.current = Array(24).fill(false);
                      circleSamplesRef.current = [];
                      lastSectorSampledRef.current = -1;
                      isAutoSavingRef.current = false;
                      setIsSavingAuto(false);
                      setSamples([]);
                      setSamplePreviews([]);
                      stopCamera();
                    }}
                    className={`p-3 rounded-xl cursor-pointer transition flex items-center justify-between ${
                      isSelected
                        ? 'bg-indigo-50/70 border border-indigo-200 shadow-sm'
                        : 'hover:bg-gray-50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-600 text-sm border border-gray-200">
                        {lec.fullName.charAt(0)}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900 text-sm">{lec.fullName}</div>
                        <div className="text-xs text-gray-500">{lec.email}</div>
                        {lec.departmentId && (
                          <div className="text-[11px] text-indigo-600 font-medium mt-0.5">
                            {lec.departmentId.name}
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      {lec.faceRegistered ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <UserCheck className="w-3 h-3" />
                          Đã có Face ID
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                          <UserX className="w-3 h-3" />
                          Chưa đăng ký
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Cột phải: Khung Chụp / Đăng ký Face ID (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 flex flex-col justify-between min-h-[560px] lg:h-[700px]">
          {selectedUser ? (
            <div className="flex flex-col h-full justify-between space-y-4">
              {/* Header giảng viên được chọn */}
              <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-gray-900 text-base">{selectedUser.fullName}</h3>
                      {selectedUser.faceRegistered ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <UserCheck className="w-3 h-3" /> Đã có Face ID
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          <UserX className="w-3 h-3" /> Chưa có Face ID
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{selectedUser.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {selectedUser.faceRegistered && (
                    <button
                      onClick={handleDeleteFaceDescriptor}
                      disabled={isExtracting}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl border border-rose-200 transition disabled:opacity-50"
                      title="Xóa dữ liệu khuôn mặt hiện tại"
                    >
                      <UserX className="w-3.5 h-3.5" />
                      Xóa Face ID
                    </button>
                  )}
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!modelReady || isExtracting}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Tải ảnh lên
                  </button>

                  {!isCameraActive ? (
                    <button
                      onClick={startCamera}
                      disabled={!modelReady || isExtracting}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition disabled:opacity-50"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      Mở Camera
                    </button>
                  ) : (
                    <button
                      onClick={stopCamera}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl transition"
                    >
                      <CameraOff className="w-3.5 h-3.5" />
                      Đóng Cam
                    </button>
                  )}
                </div>
              </div>

              {/* Khung hiển thị Camera / Ảnh chụp */}
              <div className="flex-1 relative bg-gray-900 rounded-2xl overflow-hidden flex items-center justify-center border border-gray-800">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${isCameraActive ? 'block' : 'hidden'}`}
                />

                {/* Canvas vẽ vòng tròn 24 vạch sinh trắc học Face ID */}
                {isCameraActive && (
                  <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none z-10"
                  />
                )}

                {/* Lời nhắc & Khung hướng dẫn: QUAY ĐẦU MỘT VÒNG ĐỂ NHẬN DIỆN TOÀN BỘ KHUÔN MẶT */}
                {isCameraActive && (
                  <>
                    {/* Header thông điệp chính: Quay đầu một vòng nhận diện toàn bộ khuôn mặt */}
                    <div className="absolute top-3 inset-x-3 z-20 flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/15 text-white shadow-2xl text-center">
                      <div className="flex items-center gap-2 text-xs font-black text-amber-300">
                        <RotateCw className="w-4 h-4 text-amber-400 animate-spin" />
                        <span className="text-sm">Quay đầu một vòng để nhận diện toàn bộ khuôn mặt</span>
                      </div>
                      <p className="text-[11px] text-slate-300 mt-0.5">
                        Chỉ một lần quay vậy thôi — máy sẽ tự động ghi nhớ toàn bộ khuôn mặt và lưu Face ID, không cần chụp nhiều lần!
                      </p>
                    </div>

                    {/* Vòng tâm hiển thị % tiến trình vòng quay */}
                    <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-15 pt-8">
                      <div className="bg-black/60 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/20 text-white text-xs font-bold flex items-center gap-2 shadow-2xl">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Vòng quay khuôn mặt: {circleProgress}% ({coveredCount}/17 vạch)</span>
                      </div>
                    </div>
                  </>
                )}

                {/* Overlay khi đang tự động lưu dữ liệu */}
                {isSavingAuto && (
                  <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center text-white space-y-4 z-30 animate-in fade-in duration-200">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center shadow-2xl shadow-emerald-500/50 animate-bounce">
                      <Sparkles className="w-8 h-8 text-emerald-400" />
                    </div>
                    <div className="text-center space-y-1">
                      <h3 className="text-base font-bold text-emerald-300">
                        🎉 ĐÃ NHẬN DIỆN TRỌN VẸN TOÀN BỘ KHUÔN MẶT TRONG 1 VÒNG QUAY!
                      </h3>
                      <p className="text-xs text-slate-300">
                        Đang đồng bộ hóa dữ liệu Face ID của {selectedUser?.fullName} vào hệ thống...
                      </p>
                    </div>
                    <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
                  </div>
                )}

                {!isCameraActive && capturedImagePreview && (
                  <div className="w-full h-full flex flex-col items-center justify-center p-3 relative">
                    <img
                      src={capturedImagePreview}
                      alt="Captured"
                      className="w-full h-full object-contain rounded-xl"
                    />
                    {samplePreviews.length > 1 && (
                      <div className="absolute bottom-3 inset-x-3 flex items-center justify-center gap-2 bg-black/60 backdrop-blur-md py-2 px-3 rounded-xl border border-white/10">
                        {samplePreviews.map((prevUrl, pIdx) => (
                          <div
                            key={pIdx}
                            onClick={() => setCapturedImagePreview(prevUrl)}
                            className={`w-14 h-14 rounded-lg overflow-hidden border-2 cursor-pointer transition ${
                              capturedImagePreview === prevUrl ? 'border-emerald-400 scale-105' : 'border-white/30 opacity-70'
                            }`}
                            title={`Góc ${pIdx + 1}: ${POSES[pIdx]?.title}`}
                          >
                            <img src={prevUrl} alt="" className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {!isCameraActive && !capturedImagePreview && (
                  <div className="text-center p-6 text-gray-500 space-y-2">
                    <Scan className="w-12 h-12 mx-auto text-gray-600 stroke-1" />
                    <p className="text-sm font-medium">Chưa mở camera hoặc chưa chọn ảnh</p>
                    <p className="text-xs text-gray-600 max-w-sm">
                      Chọn <span className="text-indigo-400 font-semibold">Mở Camera</span> để quay đầu một vòng máy tự động nhận diện toàn bộ khuôn mặt (không cần chụp nhiều lần) hoặc <span className="text-indigo-400 font-semibold">Tải ảnh lên</span> để trích xuất.
                    </p>
                  </div>
                )}

                {/* Overlay khi đang trích xuất */}
                {isExtracting && (
                  <div className="absolute inset-0 bg-black/70 backdrop-blur-xs flex flex-col items-center justify-center text-white space-y-3 z-20">
                    <RefreshCw className="w-9 h-9 animate-spin text-indigo-400" />
                    <p className="text-sm font-medium">Đang nhận diện & trích xuất vector 128 số...</p>
                    <p className="text-xs text-gray-300">Vui lòng giữ nguyên tư thế trong giây lát</p>
                  </div>
                )}
              </div>

              {/* Cảnh báo trùng lặp khuôn mặt */}
              {duplicateError && (
                <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl space-y-2.5 animate-in fade-in duration-300">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-rose-100 text-rose-700 rounded-xl shrink-0 mt-0.5">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                    <div className="space-y-1.5 flex-1">
                      <div className="font-bold text-rose-900 text-sm flex items-center justify-between">
                        <span>⚠️ Phát Hiện Khuôn Mặt Đã Tồn Tại (Trùng Lặp)!</span>
                        <span className="text-[11px] px-2.5 py-0.5 bg-rose-200 text-rose-800 rounded-full font-bold">
                          Không Cho Phép
                        </span>
                      </div>
                      <p className="text-xs text-rose-700 leading-relaxed font-medium">
                        {duplicateError.message}
                      </p>
                      {duplicateError.duplicateFullName && (
                        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                          <span className="text-gray-600 font-medium">Khuôn mặt này thuộc về:</span>
                          <span className="px-2.5 py-1 bg-white border border-rose-200 text-rose-900 rounded-lg font-bold shadow-xs">
                            👤 {duplicateError.duplicateFullName} ({duplicateError.duplicateEmail})
                          </span>
                          {duplicateError.distance !== undefined && (
                            <span className="text-[11px] text-gray-500 font-mono">
                              [Euclidean: {duplicateError.distance} &lt; 0.55]
                            </span>
                          )}
                        </div>
                      )}
                      <p className="text-[11px] text-rose-600 italic pt-1">
                        🔒 Quy định bảo mật: Mỗi tài khoản chỉ được liên kết 1 khuôn mặt duy nhất. Bạn không thể sử dụng 1 khuôn mặt để điểm danh cho nhiều tài khoản khác nhau.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Thông tin Vector trích xuất & Nút bấm */}
              <div className="pt-3 border-t border-gray-100 space-y-3">
                {samples.length >= 3 || (detectedDescriptor && samples.length <= 1) ? (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-emerald-800">
                          {samples.length >= 3
                            ? 'Đã trích xuất đủ 3 góc khuôn mặt (Đa vector sinh trắc học tối ưu)'
                            : 'Khuôn mặt hợp lệ - Đã trích xuất 128 đặc trưng sinh trắc học'}
                        </div>
                        <div className="text-[11px] text-emerald-600">
                          Sẵn sàng cập nhật Face ID cho {selectedUser.fullName}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setDetectedDescriptor(null);
                          setCapturedImagePreview(null);
                          setSamples([]);
                          setSamplePreviews([]);
                          setDuplicateError(null);
                          startCamera();
                        }}
                        disabled={isExtracting}
                        className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                      >
                        Chụp lại từ đầu
                      </button>
                      <button
                        onClick={handleSaveDescriptor}
                        disabled={isExtracting}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
                      >
                        {samples.length >= 3 ? 'Xác Nhận & Lưu Face ID (3 Góc)' : 'Xác Nhận & Lưu Face ID'}
                      </button>
                    </div>
                  </div>
                ) : isCameraActive ? (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-gradient-to-r from-amber-50 via-indigo-50 to-emerald-50 p-3.5 rounded-xl border border-indigo-200">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-indigo-600 text-white animate-spin">
                        <RotateCw className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-indigo-950 flex items-center gap-2">
                          <span>Quay đầu một vòng để nhận diện toàn bộ khuôn mặt</span>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-semibold">
                            Chỉ 1 lần quay duy nhất
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 mt-0.5">
                          Quay đầu chậm rãi một vòng — Không cần bấm chụp nhiều lần. Tiến trình: <strong>{circleProgress}%</strong>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setCircleProgress(0);
                        setCoveredCount(0);
                        ticksCoveredRef.current = Array(24).fill(false);
                        circleSamplesRef.current = [];
                        lastSectorSampledRef.current = -1;
                        setSamples([]);
                        setSamplePreviews([]);
                        setCapturedImagePreview(null);
                        isAutoSavingRef.current = false;
                        setIsSavingAuto(false);
                      }}
                      className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shrink-0 flex items-center gap-1 font-semibold"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Quay lại từ đầu</span>
                    </button>
                  </div>
                ) : (
                  <div className="p-3 bg-gray-50 rounded-xl flex items-center gap-2 text-xs text-gray-500">
                    <AlertCircle className="w-4 h-4 text-gray-400 shrink-0" />
                    <span>
                      Hướng dẫn: Khi mở camera, chỉ cần quay đầu một vòng chậm rãi để máy nhận diện toàn bộ khuôn mặt chỉ trong một lần quay vậy thôi, không cần chụp nhiều lần!
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 space-y-3">
              <div className="p-4 bg-gray-50 rounded-2xl">
                <ShieldCheck className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="font-semibold text-gray-700 text-sm">Chưa chọn nhân sự nào</h3>
              <p className="text-xs text-gray-400 max-w-sm">
                Vui lòng chọn một giảng viên hoặc nhân viên từ danh sách bên trái để bắt đầu đăng ký khuôn mặt Face ID.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FaceRegistrationPage;
