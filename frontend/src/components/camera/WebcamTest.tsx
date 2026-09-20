import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as faceapi from '@vladmandic/face-api';
import {
  Camera,
  CameraOff,
  CheckCircle2,
  XCircle,
  Loader2,
  Cpu,
  AlertTriangle,
  ScanFace,
  Activity,
  Info,
} from 'lucide-react';

type ModelStatus = 'idle' | 'loading' | 'ready' | 'error';

interface FaceDetectionResult {
  score: number;
  box: { x: number; y: number; width: number; height: number };
}

const MODEL_URL = '/models';

export const WebcamTest: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [modelStatus, setModelStatus] = useState<ModelStatus>('idle');
  const [modelLoadLog, setModelLoadLog] = useState<string[]>([]);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [detections, setDetections] = useState<FaceDetectionResult[]>([]);
  const [fps, setFps] = useState<number>(0);
  const fpsCounterRef = useRef({ frames: 0, lastTime: performance.now() });

  const addLog = (msg: string) =>
    setModelLoadLog((prev) => [...prev, `${new Date().toLocaleTimeString('vi-VN')} - ${msg}`]);

  const loadModels = useCallback(async () => {
    if (modelStatus === 'ready' || modelStatus === 'loading') return;
    setModelStatus('loading');
    setModelLoadLog([]);
    try {
      addLog('Dang nap TinyFaceDetector...');
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      addLog('TinyFaceDetector: OK');
      addLog('Dang nap FaceLandmark68Net...');
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
      addLog('FaceLandmark68Net: OK');
      addLog('Dang nap FaceRecognitionNet...');
      await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
      addLog('FaceRecognitionNet: OK - Tat ca model san sang!');
      setModelStatus('ready');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog('Loi nap model: ' + msg);
      setModelStatus('error');
    }
  }, [modelStatus]);

  const detectFaces = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !isCameraOn || modelStatus !== 'ready') return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video.readyState < 2) {
      animationFrameRef.current = requestAnimationFrame(detectFaces);
      return;
    }
    const displaySize = { width: video.videoWidth, height: video.videoHeight };
    if (canvas.width !== displaySize.width || canvas.height !== displaySize.height) {
      faceapi.matchDimensions(canvas, displaySize);
    }
    const detected = await faceapi.detectAllFaces(
      video,
      new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 })
    );
    const counter = fpsCounterRef.current;
    counter.frames++;
    const now = performance.now();
    const elapsed = now - counter.lastTime;
    if (elapsed >= 1000) {
      setFps(Math.round((counter.frames * 1000) / elapsed));
      counter.frames = 0;
      counter.lastTime = now;
    }
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const resized = faceapi.resizeResults(detected, displaySize);
      resized.forEach((det) => {
        const { x, y, width, height } = det.box;
        const score = Math.round(det.score * 100);
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, width, height);
        const cornerLen = Math.min(width, height) * 0.15;
        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(x, y + cornerLen); ctx.lineTo(x, y); ctx.lineTo(x + cornerLen, y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + width - cornerLen, y); ctx.lineTo(x + width, y); ctx.lineTo(x + width, y + cornerLen); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, y + height - cornerLen); ctx.lineTo(x, y + height); ctx.lineTo(x + cornerLen, y + height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + width - cornerLen, y + height); ctx.lineTo(x + width, y + height); ctx.lineTo(x + width, y + height - cornerLen); ctx.stroke();
        const label = 'Khuon mat ' + score + '%';
        ctx.font = 'bold 13px sans-serif';
        const textWidth = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(x - 1, y - 26, textWidth + 12, 22);
        ctx.fillStyle = '#4ade80';
        ctx.fillText(label, x + 5, y - 8);
      });
      setDetections(resized.map((d) => ({ score: d.score, box: { x: d.box.x, y: d.box.y, width: d.box.width, height: d.box.height } })));
    }
    animationFrameRef.current = requestAnimationFrame(detectFaces);
  }, [isCameraOn, modelStatus]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setIsCameraOn(true);
    } catch (err) {
      setCameraError(err instanceof Error ? err.message : 'Khong the truy cap camera');
    }
  };

  const stopCamera = () => {
    if (animationFrameRef.current) { cancelAnimationFrame(animationFrameRef.current); animationFrameRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    if (canvasRef.current) { const ctx = canvasRef.current.getContext('2d'); ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height); }
    setIsCameraOn(false); setDetections([]); setFps(0);
  };

  useEffect(() => {
    if (isCameraOn && modelStatus === 'ready') { animationFrameRef.current = requestAnimationFrame(detectFaces); }
    return () => { if (animationFrameRef.current) { cancelAnimationFrame(animationFrameRef.current); animationFrameRef.current = null; } };
  }, [isCameraOn, modelStatus, detectFaces]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { return () => { stopCamera(); }; }, []);

  const statusMap = {
    idle: { label: 'Chua nap model', color: 'text-gray-500', bg: 'bg-gray-100', icon: <Cpu className="w-4 h-4" /> },
    loading: { label: 'Dang nap model...', color: 'text-blue-600', bg: 'bg-blue-50', icon: <Loader2 className="w-4 h-4 animate-spin" /> },
    ready: { label: 'Model san sang', color: 'text-green-600', bg: 'bg-green-50', icon: <CheckCircle2 className="w-4 h-4" /> },
    error: { label: 'Loi nap model', color: 'text-red-600', bg: 'bg-red-50', icon: <XCircle className="w-4 h-4" /> },
  };
  const statusInfo = statusMap[modelStatus];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-violet-100 text-violet-600 rounded-xl"><ScanFace className="w-6 h-6" /></div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Kiem Thu Nhan Dien Khuon Mat</h1>
              <p className="text-sm text-gray-500">@vladmandic/face-api &middot; TinyFaceDetector &middot; Real-time Bounding Box</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-violet-600 text-white text-xs flex items-center justify-center font-bold">1</span>
                Nap Model Weights
              </h2>
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${statusInfo.bg} ${statusInfo.color}`}>
                {statusInfo.icon}<span>{statusInfo.label}</span>
              </div>
              <button id="btn-load-models" onClick={loadModels} disabled={modelStatus === 'loading' || modelStatus === 'ready'}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-semibold rounded-xl transition-colors">
                {modelStatus === 'loading' ? <><Loader2 className="w-4 h-4 animate-spin" /> Dang nap...</>
                  : modelStatus === 'ready' ? <><CheckCircle2 className="w-4 h-4" /> Da san sang</>
                    : <><Cpu className="w-4 h-4" /> Nap Model</>}
              </button>
              {modelLoadLog.length > 0 && (
                <div className="bg-gray-900 rounded-xl p-3 max-h-44 overflow-y-auto space-y-0.5">
                  {modelLoadLog.map((line, i) => <div key={i} className="text-xs font-mono text-green-400 leading-5">{line}</div>)}
                </div>
              )}
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-violet-600 text-white text-xs flex items-center justify-center font-bold">2</span>
                Dieu Khien Camera
              </h2>
              {cameraError && <div className="flex items-start gap-2 p-3 bg-red-50 text-red-700 rounded-xl text-sm"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><span>{cameraError}</span></div>}
              {!isCameraOn
                ? <button id="btn-start-camera" onClick={startCamera} disabled={modelStatus !== 'ready'}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-semibold rounded-xl transition-colors">
                    <Camera className="w-4 h-4" /> Bat Camera
                  </button>
                : <button id="btn-stop-camera" onClick={stopCamera}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-xl transition-colors">
                    <CameraOff className="w-4 h-4" /> Tat Camera
                  </button>}
              {modelStatus !== 'ready' && <div className="flex items-center gap-1.5 text-xs text-amber-600"><Info className="w-3.5 h-3.5" /> Vui long nap model truoc khi bat camera</div>}
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2"><Activity className="w-4 h-4 text-violet-600" /> Ket Qua</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 bg-violet-50 rounded-xl"><div className="text-2xl font-bold text-violet-700">{detections.length}</div><div className="text-xs text-violet-500 font-medium mt-0.5">Khuon mat</div></div>
                <div className="text-center p-3 bg-blue-50 rounded-xl"><div className="text-2xl font-bold text-blue-700">{fps}</div><div className="text-xs text-blue-500 font-medium mt-0.5">FPS</div></div>
              </div>
              {detections.length > 0 && detections.map((d, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 bg-green-50 rounded-lg">
                  <span className="text-xs font-medium text-green-700">Khuon mat #{i + 1}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${d.score * 100}%` }} /></div>
                    <span className="text-xs font-bold text-green-700 w-10 text-right">{Math.round(d.score * 100)}%</span>
                  </div>
                </div>
              ))}
              {isCameraOn && detections.length === 0 && <p className="text-center py-3 text-sm text-gray-400">Chua phat hien khuon mat...</p>}
            </div>
          </div>
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><Camera className="w-4 h-4 text-violet-600" /> Luong Camera & Nhan Dien</h2>
              <div className="relative bg-gray-900 rounded-xl overflow-hidden aspect-video flex items-center justify-center">
                <video ref={videoRef} id="webcam-video" className={`absolute inset-0 w-full h-full object-cover transition-opacity ${isCameraOn ? 'opacity-100' : 'opacity-0'}`} autoPlay playsInline muted />
                <canvas ref={canvasRef} id="webcam-canvas" className="absolute inset-0 w-full h-full object-cover" />
                {!isCameraOn && (
                  <div className="relative z-10 text-center">
                    <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-3"><CameraOff className="w-10 h-10 text-gray-500" /></div>
                    <p className="text-gray-400 text-sm">Camera chua duoc bat</p>
                    <p className="text-gray-500 text-xs mt-1">{modelStatus !== 'ready' ? 'Hay nap model truoc' : 'Nhan "Bat Camera" de bat dau'}</p>
                  </div>
                )}
                {isCameraOn && <>
                  <div className="absolute top-3 right-3 z-20 bg-black/60 text-green-400 text-xs font-mono px-2 py-1 rounded-lg">{fps} FPS &middot; {detections.length} face{detections.length !== 1 ? 's' : ''}</div>
                  <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 bg-black/60 px-2 py-1 rounded-lg"><div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" /><span className="text-white text-xs font-medium">LIVE</span></div>
                </>}
              </div>
              <div className="mt-4 p-3 bg-blue-50 rounded-xl flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                <div className="text-xs text-blue-700">
                  <p className="font-medium mb-1">Huong dan kiem thu:</p>
                  <p>1. Bam <strong>"Nap Model"</strong> cho den khi log hien "FaceRecognitionNet: OK"</p>
                  <p>2. Bam <strong>"Bat Camera"</strong> - trinh duyet xin quyen truy cap camera</p>
                  <p>3. Dung truoc camera - khung xanh se bao quanh khuon mat kem % tin cay</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WebcamTest;
