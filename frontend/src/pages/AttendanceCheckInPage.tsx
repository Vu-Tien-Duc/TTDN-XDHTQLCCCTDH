import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import {
  CheckCircle2,
  LogOut,
  Calendar,
  MapPin,
  BookOpen,
  RefreshCw,
  ShieldCheck,
  QrCode,
  Compass,
  Camera,
  AlertTriangle,
  XCircle,
  Radio,
  ScanLine,
  Navigation,
  Crosshair,
  Sliders,
  ArrowRight,
  Check,
} from 'lucide-react';
import { attendanceApi } from '../api';
import { Schedule, ShiftConfig, AttendanceLog } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { getVietnamDateString, formatTime } from '../utils';
import GpsCampusMap from '../components/common/GpsCampusMap';

// Tính khoảng cách Haversine thực tế (mét)
function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

type TabType = 'gps' | 'qr';

export const AttendanceCheckInPage: React.FC = () => {
  const { user } = useAuth();

  // Tab chuyển đổi phương thức điểm danh (hỗ trợ điều hướng qua URL query param: ?tab=gps|qr)
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === 'gps' || tabParam === 'qr') {
        return tabParam;
      }
    } catch { }
    return 'gps';
  });

  // Đồng hồ thời gian thực
  const [currentTime, setCurrentTime] = useState(new Date());

  // Trạng thái dữ liệu lịch trình
  const [todaySchedules, setTodaySchedules] = useState<Schedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Bản ghi chấm công đã thực hiện hôm nay
  const [todayLogs, setTodayLogs] = useState<AttendanceLog[]>([]);
  // Ca làm việc người dùng chọn chủ động
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);

  // ==========================================
  // CẤU HÌNH TỌA ĐỘ TRƯỜNG THỰC TẾ (TỪ SERVER)
  // ==========================================
  const [campusConfig, setCampusConfig] = useState<{
    name: string;
    lat: number;
    lng: number;
    radiusMeters: number;
  }>({
    name: 'Khuôn viên Cơ sở chính - Trường Đại học',
    lat: 20.965483,
    lng: 105.729905,
    radiusMeters: 500,
  });
  const [isUpdatingCampus, setIsUpdatingCampus] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [customRadius, setCustomRadius] = useState('200');

  // ==========================================
  // 1. TỌA ĐỘ GPS THỰC TẾ CỦA THIẾT BỊ (100% REAL)
  // ==========================================
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsAltitude, setGpsAltitude] = useState<number | null>(null);
  const [gpsDistance, setGpsDistance] = useState<number | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isFetchingGps, setIsFetchingGps] = useState(false);

  // ==========================================
  // 2. QUÉT MÃ QR ĐỘNG (CAMERA SCANNER)
  // ==========================================
  const [cameraActive, setCameraActive] = useState(false);
  const [isScanningQr, setIsScanningQr] = useState(false);
  const [lastScannedToken, setLastScannedToken] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const qrStreamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<any>(null);

  // Cập nhật đồng hồ mỗi giây
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Tải cấu hình khuôn viên trường thực tế từ Backend
  const loadCampusConfig = useCallback(async () => {
    try {
      const res = await attendanceApi.getCampusConfig();
      if (res && res.success && res.data) {
        setCampusConfig({
          name: res.data.name || 'Khuôn viên Trường',
          lat: Number(res.data.lat),
          lng: Number(res.data.lng),
          radiusMeters: Number(res.data.radiusMeters || 200),
        });
        setCustomRadius(String(res.data.radiusMeters || 200));
      }
    } catch {
      // Dùng cấu hình mặc định nếu chưa lấy được
    }
  }, []);

  useEffect(() => {
    loadCampusConfig();
  }, [loadCampusConfig]);

  // Lấy tọa độ GPS THỰC TẾ từ chip định vị thiết bị (Chính xác cao, tức thì)
  const fetchCurrentLocation = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setGpsError('Trình duyệt hoặc thiết bị không hỗ trợ định vị GPS.');
      return;
    }

    setIsFetchingGps(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsFetchingGps(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserCoords({ lat, lng });
        setGpsAccuracy(pos.coords.accuracy);
        setGpsAltitude(pos.coords.altitude);

        const dist = calculateDistanceMeters(lat, lng, campusConfig.lat, campusConfig.lng);
        setGpsDistance(dist);
      },
      (err) => {
        setIsFetchingGps(false);
        let msg = 'Không thể lấy dữ liệu GPS.';
        if (err.code === 1) msg = 'Quyền truy cập vị trí bị từ chối. Vui lòng bật định vị trên trình duyệt/điện thoại.';
        else if (err.code === 2) msg = 'Không có tín hiệu vệ tinh GPS hoặc mạng yếu.';
        else if (err.code === 3) msg = 'Quá thời gian lấy vị trí GPS (Timeout).';
        setGpsError(msg);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 3000 }
    );
  }, [campusConfig.lat, campusConfig.lng]);

  // Cập nhật lại khoảng cách khi campusConfig thay đổi
  useEffect(() => {
    if (userCoords) {
      const dist = calculateDistanceMeters(userCoords.lat, userCoords.lng, campusConfig.lat, campusConfig.lng);
      setGpsDistance(dist);
    }
  }, [campusConfig, userCoords]);

  // Tự động kích hoạt GPS tức thì và liên tục theo dõi vị trí (watchPosition)
  useEffect(() => {
    fetchCurrentLocation();

    let watchId: number | null = null;
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      try {
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            setUserCoords({ lat, lng });
            setGpsAccuracy(pos.coords.accuracy);
            setGpsAltitude(pos.coords.altitude);
            const dist = calculateDistanceMeters(lat, lng, campusConfig.lat, campusConfig.lng);
            setGpsDistance(dist);
          },
          () => { },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
        );
      } catch { }
    }

    return () => {
      if (watchId !== null && typeof window !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [campusConfig.lat, campusConfig.lng, fetchCurrentLocation]);

  // Đồng bộ vị trí trường học theo vị trí GPS thực tế hiện tại
  const handleSetCampusToCurrentLocation = async () => {
    if (!userCoords) {
      toast.error('Chưa có tọa độ GPS của thiết bị để đồng bộ.');
      return;
    }

    try {
      setIsUpdatingCampus(true);
      const res = await attendanceApi.updateCampusConfig({
        name: campusConfig.name,
        lat: userCoords.lat,
        lng: userCoords.lng,
        radiusMeters: parseInt(customRadius, 10) || 200,
      });

      if (res && res.success) {
        setCampusConfig({
          name: res.data.name,
          lat: res.data.lat,
          lng: res.data.lng,
          radiusMeters: res.data.radiusMeters,
        });
        setGpsDistance(0);
        setShowConfigModal(false);
        toast.success(`📍 Đã cập nhật tọa độ trường về vị trí thực tế của bạn (${userCoords.lat.toFixed(6)}, ${userCoords.lng.toFixed(6)})!`);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể cập nhật cấu hình vị trí trường.');
    } finally {
      setIsUpdatingCampus(false);
    }
  };

  // Lấy lịch dạy và lịch sử chấm công hôm nay
  const loadTodayData = useCallback(async () => {
    try {
      setIsLoading(true);
      // Sử dụng chuẩn ngày Việt Nam (Asia/Ho_Chi_Minh) tránh lỗi lệch múi giờ ban đêm (00h-07h)
      const todayVnStr = getVietnamDateString();
      const [scheduleRes, historyRes] = await Promise.all([
        attendanceApi.getTodaySchedules(),
        attendanceApi.getHistory({
          from: todayVnStr,
          to: todayVnStr,
        }),
      ]);

      if (scheduleRes?.data?.schedules) {
        setTodaySchedules(scheduleRes.data.schedules);
      } else {
        setTodaySchedules([]);
      }

      const logs =
        historyRes?.data?.records ??
        (Array.isArray(historyRes?.data) ? historyRes.data : (historyRes?.data as { logs?: AttendanceLog[] })?.logs || []);
      setTodayLogs(logs);
    } catch (err: unknown) {
      console.error('[AttendanceCheckIn] Lỗi tải dữ liệu:', err);
      toast.error('Không thể tải lịch dạy hoặc thông tin chấm công hôm nay.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTodayData();
  }, [loadTodayData]);

  const GRACE_BEFORE_MINUTES = 240; // Cho phép check-in sớm bao nhiêu cũng được (lên tới 4 tiếng trước ca)

  const timeStringToMinutes = (timeStr?: string): number => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  // 1. Tìm bản ghi chấm công đang mở hôm nay (đã check-in nhưng chưa check-out, không phải vắng mặt)
  const openAttendanceLog = useMemo(() => {
    return todayLogs.find(
      (log) => log.checkInTime && !log.checkOutTime && log.status !== 'ABSENT' && log.status !== 'EXCUSED_ABSENCE'
    );
  }, [todayLogs]);

  // 2. Xác định ca làm việc active:
  // Ưu tiên: Ca người dùng chủ động chọn -> Ca đang mở (để người dùng bấm Check-out ngay khi hết tiết) -> Ca đang trong giờ -> Ca sắp tới -> Ca đầu tiên
  const activeSchedule = useMemo(() => {
    if (todaySchedules.length === 0) return undefined;

    // A. Nếu người dùng chủ động click chọn 1 ca cụ thể
    if (selectedScheduleId) {
      const matched = todaySchedules.find((s) => s._id === selectedScheduleId);
      if (matched) return matched;
    }

    // B. Ưu tiên cao nhất: Ca ĐANG MỞ (Đã check-in nhưng chưa check-out)
    // Giúp khi hết tiết học, trang lập tức tập trung vào ca này để giảng viên Check-out dễ dàng
    if (openAttendanceLog) {
      const openSchedId =
        typeof openAttendanceLog.scheduleId === 'object'
          ? (openAttendanceLog.scheduleId as any)?._id
          : openAttendanceLog.scheduleId;
      const matchedBySched = todaySchedules.find((s) => s._id === openSchedId);
      if (matchedBySched) return matchedBySched;

      const openShiftId =
        typeof openAttendanceLog.shiftId === 'object'
          ? (openAttendanceLog.shiftId as any)?._id
          : openAttendanceLog.shiftId;
      const matchedByShift = todaySchedules.find((s) => {
        const sid = typeof s.shiftId === 'object' ? s.shiftId?._id : s.shiftId;
        return sid === openShiftId;
      });
      if (matchedByShift) return matchedByShift;
    }

    // C. Tìm ca đang diễn ra (trong khoảng từ 4 tiếng trước đến kết thúc ca + 30 phút)
    const currentM = currentTime.getHours() * 60 + currentTime.getMinutes();
    const runningSchedule = todaySchedules.find((sch) => {
      const shift = sch.shiftId as ShiftConfig;
      if (!shift) return false;
      const startM = timeStringToMinutes(shift.startTime);
      const endM = timeStringToMinutes(shift.endTime);
      return currentM >= startM - GRACE_BEFORE_MINUTES && currentM <= endM + 30;
    });
    if (runningSchedule) return runningSchedule;

    // D. Tìm ca tiếp theo chưa diễn ra
    const upcomingSchedule = todaySchedules.find((sch) => {
      const shift = sch.shiftId as ShiftConfig;
      if (!shift) return false;
      const startM = timeStringToMinutes(shift.startTime);
      return currentM < startM;
    });
    if (upcomingSchedule) return upcomingSchedule;

    return todaySchedules[0];
  }, [todaySchedules, selectedScheduleId, openAttendanceLog, currentTime]);

  const activeShift = activeSchedule?.shiftId as ShiftConfig | undefined;

  // Lấy bản ghi chấm công của ca active (ưu tiên khớp scheduleId, sau đó tới shiftId)
  const currentCaLog = useMemo(() => {
    if (!activeSchedule) return undefined;
    const bySched = todayLogs.find((log) => {
      const logSchedId =
        typeof log.scheduleId === 'object' ? (log.scheduleId as any)?._id : log.scheduleId;
      return logSchedId && logSchedId === activeSchedule._id;
    });
    if (bySched) return bySched;

    if (activeShift) {
      return todayLogs.find((log) => {
        const sid = typeof log.shiftId === 'object' ? log.shiftId?._id : log.shiftId;
        return sid === activeShift._id;
      });
    }
    return undefined;
  }, [activeSchedule, activeShift, todayLogs]);

  // Người vắng mặt (ABSENT) hoặc nghỉ phép (EXCUSED_ABSENCE) thì CHƯA check-in
  const hasCheckedIn = Boolean(
    currentCaLog?.checkInTime &&
      currentCaLog.status !== 'ABSENT' &&
      currentCaLog.status !== 'EXCUSED_ABSENCE'
  );
  const hasCheckedOut = Boolean(currentCaLog?.checkOutTime);

  // ==========================================
  // XỬ LÝ CHẤM CÔNG GPS THỰC TẾ (1-TOUCH)
  // ==========================================
  const handleGpsCheckIn = async () => {
    if (!userCoords) {
      toast.error('Chưa có tín hiệu GPS thực tế. Vui lòng bấm Lấy lại vị trí.');
      return;
    }

    if (gpsDistance !== null && gpsDistance > effectiveRadius) {
      toast.error(
        `❌ Bị chặn: Bạn đang cách trường ${gpsDistance}m (Vượt quá bán kính cho phép ${campusConfig.radiusMeters}m). Không thể điểm danh!`
      );
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await attendanceApi.checkIn({
        method: 'gps',
        shiftId: activeShift?._id,
        scheduleId: activeSchedule?._id,
        location: userCoords,
        accuracy: gpsAccuracy || undefined,
      });

      const log = res.data;
      if (log.status === 'ON_TIME') {
        toast.success(`🎉 Điểm danh GPS thành công! ĐÚNG GIỜ (Khoảng cách thực tế: ${gpsDistance || 0}m)`);
      } else if (log.status === 'LATE') {
        toast.error(`⚠️ Điểm danh GPS thành công nhưng bạn đã ĐI MUỘN (Khoảng cách thực tế: ${gpsDistance || 0}m)`);
      } else {
        toast.success('Điểm danh GPS thành công!');
      }

      loadTodayData();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Điểm danh GPS thất bại. Vui lòng kiểm tra lại vị trí.';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================
  // XỬ LÝ CAMERA QUÉT MÃ QR ĐỘNG THỰC TẾ
  // ==========================================
  const startCameraScanner = async () => {
    try {
      setCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      qrStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      // BarcodeDetector API chuẩn trình duyệt
      if ('BarcodeDetector' in window) {
        const barcodeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        scanIntervalRef.current = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2 || isScanningQr) return;
          try {
            const barcodes = await barcodeDetector.detect(videoRef.current);
            if (barcodes.length > 0) {
              const detectedToken = barcodes[0].rawValue;
              if (detectedToken && detectedToken !== lastScannedToken) {
                setLastScannedToken(detectedToken);
                stopCameraScanner();
                processQrAttendance(detectedToken);
              }
            }
          } catch { }
        }, 400);
      }
    } catch (err: any) {
      toast.error('Không thể mở camera: ' + (err.message || 'Vui lòng cấp quyền truy cập camera.'));
      setCameraActive(false);
    }
  };

  const stopCameraScanner = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (qrStreamRef.current) {
      qrStreamRef.current.getTracks().forEach((t) => t.stop());
      qrStreamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCameraScanner();
    };
  }, []);

  const processQrAttendance = async (token: string) => {
    if (!token) {
      toast.error('Không tìm thấy nội dung mã QR.');
      return;
    }

    if (!userCoords) {
      toast.error('Điểm danh QR yêu cầu bật định vị GPS trong khuôn viên trường để xác thực bạn có mặt thực tế. Vui lòng bấm Lấy lại vị trí.');
      setTimeout(() => setLastScannedToken(null), 3000);
      return;
    }

    try {
      setIsScanningQr(true);
      const res = await attendanceApi.scanQRCode({
        qrToken: token.trim(),
        location: { ...userCoords, accuracy: gpsAccuracy || undefined },
        accuracy: gpsAccuracy || undefined,
        deviceId: 'DEVICE_' + (user?.fullName?.replace(/\s+/g, '_') || 'USER'),
      });

      if (res && res.success) {
        toast.success(res.message || '🎉 Quét mã QR thành công! Đã ghi nhận điểm danh.');
        loadTodayData();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Quét mã QR thất bại hoặc mã đã hết hạn.';
      toast.error(msg);
      // Cho phép quét lại sau 3s nếu lỗi
      setTimeout(() => setLastScannedToken(null), 3000);
    } finally {
      setIsScanningQr(false);
    }
  };

  // ==========================================
  // XỬ LÝ KẾT THÚC CA CHẤM CÔNG GPS (CHECK-OUT)
  // ==========================================
  const handleGpsCheckOut = async (targetAttendanceId?: string, targetShiftId?: string) => {
    try {
      setIsSubmitting(true);
      const attId = targetAttendanceId || currentCaLog?._id || openAttendanceLog?._id;
      const shId = targetShiftId || activeShift?._id;

      await attendanceApi.checkOut({
        method: userCoords ? 'gps' : 'manual',
        attendanceId: attId,
        shiftId: shId,
        location: userCoords || undefined,
        accuracy: gpsAccuracy || undefined,
      });
      toast.success('👋 Check-out ra ca thành công! Đã kết thúc ca làm việc.');
      loadTodayData();
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string } } };
      toast.error(apiErr.response?.data?.message || 'Check-out thất bại. Bạn chưa có ca mở hoặc đã check-out rồi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Dung sai sai số GPS thông minh: Bổ sung sai số accuracy của thiết bị (tối đa +100m)
  const accuracyTolerance = Math.min(Math.round(gpsAccuracy || 0), 100);
  const effectiveRadius = campusConfig.radiusMeters + accuracyTolerance;
  const isGpsValid = gpsDistance !== null && gpsDistance <= effectiveRadius;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* 1. Header & Giới thiệu hệ thống thực */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
            <Radio className="w-4 h-4 animate-pulse text-blue-500" />
            <span>Hệ Thống Điểm Danh Trực Tuyến • Thông Số Thực Tế</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Chấm Công Định Vị GPS & QR Động
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Dữ liệu vệ tinh GPS thực từ thiết bị đối chiếu với tọa độ khuôn viên ({campusConfig.name}, bán kính {campusConfig.radiusMeters}m).
          </p>
        </div>

        <div className="flex items-center gap-2">
          {user?.role === 'admin' && (
            <button
              onClick={() => setShowConfigModal(true)}
              className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition shadow-xs flex items-center gap-1.5 text-xs font-semibold"
              title="Xem và chỉnh tọa độ trường (Dành cho Quản trị viên)"
            >
              <Sliders className="w-4 h-4 text-blue-600" />
              <span className="hidden sm:inline">Tọa độ trường</span>
            </button>
          )}
          <button
            onClick={loadTodayData}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition shadow-xs flex items-center gap-1.5 text-xs font-semibold"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Làm mới</span>
          </button>
        </div>
      </div>

      {/* Modal Cấu hình tọa độ trường thực tế (Chỉ Admin) */}
      {user?.role === 'admin' && showConfigModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <MapPin className="w-5 h-5 text-blue-600" />
                <span>Cấu Hình Tọa Độ Khuôn Viên Trường</span>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-500 font-medium">Tên khuôn viên:</label>
                <input
                  type="text"
                  value={campusConfig.name}
                  onChange={(e) => setCampusConfig({ ...campusConfig, name: e.target.value })}
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-500 font-medium">Vĩ độ (Lat):</label>
                  <input
                    type="number"
                    step="any"
                    value={campusConfig.lat}
                    onChange={(e) => setCampusConfig({ ...campusConfig, lat: parseFloat(e.target.value) || 0 })}
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-slate-500 font-medium">Kinh độ (Lng):</label>
                  <input
                    type="number"
                    step="any"
                    value={campusConfig.lng}
                    onChange={(e) => setCampusConfig({ ...campusConfig, lng: parseFloat(e.target.value) || 0 })}
                    className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-mono text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-500 font-medium">Bán kính cho phép điểm danh (mét):</label>
                <input
                  type="number"
                  value={customRadius}
                  onChange={(e) => setCustomRadius(e.target.value)}
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-mono text-slate-900"
                  placeholder="200"
                />
              </div>

              {userCoords && (
                <div className="p-3 bg-blue-50 rounded-2xl border border-blue-100">
                  <p className="text-blue-900 font-bold mb-1 flex items-center gap-1.5">
                    <Crosshair className="w-4 h-4 text-blue-600" />
                    <span>GPS thiết bị hiện tại của bạn:</span>
                  </p>
                  <p className="font-mono text-blue-800 text-[11px]">
                    Lat: {userCoords.lat.toFixed(6)} | Lng: {userCoords.lng.toFixed(6)}
                  </p>
                  <button
                    type="button"
                    onClick={handleSetCampusToCurrentLocation}
                    disabled={isUpdatingCampus}
                    className="mt-2 w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{isUpdatingCampus ? 'Đang cập nhật...' : 'Đặt vị trí hiện tại làm vị trí trường'}</span>
                  </button>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowConfigModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bộ chọn ca làm việc hôm nay (nếu có nhiều ca) */}
      {todaySchedules.length > 1 && (
        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs font-semibold text-slate-500">
            <span className="flex items-center gap-1.5 text-slate-700">
              <BookOpen className="w-4 h-4 text-blue-600" />
              <span>Hôm nay bạn có {todaySchedules.length} ca dạy • Bấm để chọn ca cần điểm danh hoặc check-out:</span>
            </span>
            {openAttendanceLog && (
              <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1.5 w-fit">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                Có ca đang mở chờ Check-out
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {todaySchedules.map((sch) => {
              const shift = sch.shiftId as ShiftConfig;
              const isSelected = activeSchedule?._id === sch._id;
              const log = todayLogs.find((l) => {
                const schedId = typeof l.scheduleId === 'object' ? (l.scheduleId as any)?._id : l.scheduleId;
                if (schedId && schedId === sch._id) return true;
                const sid = typeof l.shiftId === 'object' ? l.shiftId?._id : l.shiftId;
                return shift && sid === shift._id;
              });
              const isOpen = Boolean(log?.checkInTime && !log?.checkOutTime && log.status !== 'ABSENT' && log.status !== 'EXCUSED_ABSENCE');
              const isDone = Boolean(log?.checkOutTime);

              return (
                <button
                  key={sch._id}
                  onClick={() => setSelectedScheduleId(sch._id)}
                  className={`py-2 px-3.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 border cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20'
                      : isOpen
                      ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 shadow-xs'
                      : isDone
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span>{shift?.name || sch.subjectName || 'Ca dạy'}</span>
                  <span className={`text-[11px] font-mono px-2 py-0.5 rounded-md ${
                    isSelected ? 'bg-blue-700 text-white' : 'bg-white text-slate-600 border border-slate-200/60'
                  }`}>
                    {shift?.startTime} ⟶ {shift?.endTime}
                  </span>
                  {isOpen && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500 text-white font-extrabold animate-pulse">
                      Đang mở
                    </span>
                  )}
                  {isDone && (
                    <span className="text-emerald-600 font-bold text-[11px]">✓</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Bộ chọn Phương thức Điểm danh */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100/80 rounded-2xl border border-slate-200/80">
        <button
          onClick={() => setActiveTab('gps')}
          className={`flex-1 min-w-[150px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all ${activeTab === 'gps'
            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
            : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
        >
          <Compass className="w-4 h-4" />
          <span>Định Vị GPS Thực Tế</span>
          {isGpsValid && <span className="w-2 h-2 rounded-full bg-emerald-400"></span>}
        </button>

        <button
          onClick={() => setActiveTab('qr')}
          className={`flex-1 min-w-[150px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all ${activeTab === 'qr'
            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
            : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
        >
          <QrCode className="w-4 h-4" />
          <span>Quét Camera QR Động</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: ĐỊNH VỊ GPS THỰC TẾ (100% REAL GEOFENCING) */}
      {/* ========================================================= */}
      {activeTab === 'gps' && (
        <div className="space-y-6">
          {/* BẢN ĐỒ TRỰC QUAN KHUÔN VIÊN TRƯỜNG & VỊ TRÍ THỰC TẾ */}
          <GpsCampusMap
            campusConfig={campusConfig}
            userCoords={userCoords}
            gpsAccuracy={gpsAccuracy}
            gpsDistance={gpsDistance}
            isGpsValid={isGpsValid}
            effectiveRadius={effectiveRadius}
            isFetchingGps={isFetchingGps}
            onRefreshGps={fetchCurrentLocation}
            isAdmin={user?.role === 'admin'}
            onOpenAdminConfig={() => setShowConfigModal(true)}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Cột trái: Radar định vị & Nút bấm GPS */}
            <div className="lg:col-span-2 bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 text-white p-6 sm:p-8 rounded-3xl shadow-xl relative overflow-hidden flex flex-col justify-between min-h-[400px]">
              {/* Hiệu ứng radar mờ phía sau */}
              <div className="absolute top-1/2 right-10 -translate-y-1/2 w-72 h-72 rounded-full border border-blue-500/20 pointer-events-none animate-ping opacity-30"></div>
              <div className="absolute top-1/2 right-10 -translate-y-1/2 w-48 h-48 rounded-full border border-blue-400/30 pointer-events-none"></div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold backdrop-blur-md border border-blue-400/30">
                    <Compass className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                    <span>Vệ Tinh GPS Hoạt Động (Bán kính {campusConfig.radiusMeters}m)</span>
                  </span>

                  <button
                    onClick={fetchCurrentLocation}
                    disabled={isFetchingGps}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs text-white border border-white/10 transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isFetchingGps ? 'animate-spin' : ''}`} />
                    <span>{isFetchingGps ? 'Đang lấy tọa độ...' : 'Đo lại vị trí GPS'}</span>
                  </button>
                </div>

                {/* Thông số khoảng cách & trạng thái */}
                <div className="mt-6 flex flex-col sm:flex-row sm:items-baseline gap-4">
                  <div>
                    <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Khoảng cách thực tế đến trường</p>
                    <div className="text-5xl sm:text-6xl font-mono font-extrabold text-white mt-1 flex items-baseline gap-2">
                      <span>{gpsDistance !== null ? gpsDistance : '--'}</span>
                      <span className="text-2xl text-blue-400 font-sans font-medium">mét</span>
                    </div>
                  </div>

                  <div className="sm:ml-auto">
                    {gpsDistance !== null ? (
                      isGpsValid ? (
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-bold text-sm">
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          <span>TRONG KHUÔN VIÊN TRƯỜNG (HỢP LỆ)</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-rose-500/20 border border-rose-400/40 text-rose-300 font-bold text-sm">
                          <XCircle className="w-5 h-5 text-rose-400" />
                          <span>NGOÀI PHẠM VI TRƯỜNG (&gt; {campusConfig.radiusMeters}m)</span>
                        </div>
                      )
                    ) : (
                      <div className="text-xs text-slate-400 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        <span>Đang chờ dữ liệu GPS thực từ trình duyệt...</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Thanh đo Geofence Progress Bar */}
                <div className="mt-6 p-4 rounded-2xl bg-white/5 border border-white/10">
                  <div className="flex justify-between text-xs text-slate-300 mb-2">
                    <span>0m (Tâm trường)</span>
                    <span className="font-bold text-amber-300">Ngưỡng {campusConfig.radiusMeters}m</span>
                    <span>500m+</span>
                  </div>
                  <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden relative">
                    <div
                      className="absolute top-0 bottom-0 w-1 bg-amber-400 z-10"
                      style={{ left: `${Math.min(100, (campusConfig.radiusMeters / 500) * 100)}%` }}
                      title={`Ngưỡng tối đa ${campusConfig.radiusMeters}m`}
                    ></div>
                    <div
                      className={`h-full transition-all duration-700 rounded-full ${isGpsValid ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-rose-500'
                        }`}
                      style={{ width: `${Math.min(100, ((gpsDistance || 0) / 500) * 100)}%` }}
                    ></div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
                    <span>
                      Tọa độ thiết bị:{' '}
                      {userCoords ? `${userCoords.lat.toFixed(6)}, ${userCoords.lng.toFixed(6)}` : 'Đang lấy...'}
                    </span>
                    <span>{campusConfig.name}</span>
                  </div>
                </div>
              </div>

              {/* Nút bấm điểm danh GPS 1-Chạm & Check-out GPS */}
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={handleGpsCheckIn}
                  disabled={isSubmitting || hasCheckedIn || !isGpsValid}
                  className={`py-4 px-6 rounded-2xl font-bold text-sm sm:text-base flex items-center justify-center gap-3 transition-all active:scale-98 shadow-xl ${hasCheckedIn
                    ? 'bg-slate-700/60 text-slate-400 cursor-not-allowed border border-white/10'
                    : isGpsValid
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-emerald-500/30 animate-pulse'
                      : 'bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed'
                    }`}
                >
                  <MapPin className="w-5 h-5" />
                  <span>
                    {hasCheckedIn
                      ? 'Đã Check-in Ca Này'
                      : isGpsValid
                        ? 'Xác Nhận Check-in GPS'
                        : `Cách trường ${gpsDistance || 0}m - Ngoài phạm vi`}
                  </span>
                </button>

                <button
                  onClick={() => handleGpsCheckOut()}
                  disabled={isSubmitting || !hasCheckedIn || hasCheckedOut}
                  className={`py-4 px-6 rounded-2xl font-bold text-sm sm:text-base flex items-center justify-center gap-3 transition-all active:scale-98 shadow-xl ${!hasCheckedIn || hasCheckedOut
                    ? 'bg-slate-800/50 text-slate-500 border border-white/5 cursor-not-allowed'
                    : 'bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white shadow-rose-500/30 animate-pulse cursor-pointer'
                    }`}
                >
                  <LogOut className="w-5 h-5" />
                  <span>{hasCheckedOut ? 'Đã Check-out Ca Này' : 'Kết Thúc Ca (Check-out)'}</span>
                </button>
              </div>
            </div>

            {/* Cột phải: Thông số viễn trắc GPS thực tế của thiết bị */}
            <div className="space-y-4">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
                  <Navigation className="w-4 h-4" />
                  <span>Viễn Trắc GPS Thiết Bị Thực Tế</span>
                </div>
                <h3 className="font-bold text-slate-900 text-sm">Dữ Liệu Phần Cứng Định Vị</h3>

                <div className="space-y-2.5 pt-2 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-slate-500">Vĩ độ (Latitude):</span>
                    <span className="font-mono font-bold text-slate-900">{userCoords ? userCoords.lat.toFixed(6) : '--'}</span>
                  </div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-slate-500">Kinh độ (Longitude):</span>
                    <span className="font-mono font-bold text-slate-900">{userCoords ? userCoords.lng.toFixed(6) : '--'}</span>
                  </div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-slate-500">Độ chính xác (Accuracy):</span>
                    <span className="font-mono font-semibold text-emerald-600">
                      {gpsAccuracy ? `± ${Math.round(gpsAccuracy)} mét` : '--'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-slate-500">Độ cao (Altitude):</span>
                    <span className="font-mono text-slate-700">{gpsAltitude ? `${Math.round(gpsAltitude)} m` : 'Mặt đất'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Tọa độ mục tiêu trường:</span>
                    <span className="font-mono text-xs text-blue-700 font-semibold">
                      {campusConfig.lat.toFixed(4)}, {campusConfig.lng.toFixed(4)}
                    </span>
                  </div>
                </div>

                {gpsError && (
                  <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                    {gpsError}
                  </div>
                )}

                {/* Nút căn chỉnh nhanh vị trí thực tế (Chỉ Quản trị viên) */}
                {user?.role === 'admin' && (
                  <button
                    type="button"
                    onClick={handleSetCampusToCurrentLocation}
                    disabled={isUpdatingCampus || !userCoords}
                    className="w-full mt-3 py-2.5 px-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition flex items-center justify-center gap-2 border border-slate-200"
                  >
                    <Crosshair className="w-3.5 h-3.5 text-blue-600" />
                    <span>Đặt vị trí hiện tại làm vị trí trường</span>
                  </button>
                )}
              </div>

              {/* Thông tin ca hiện tại */}
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 text-xs space-y-2">
                <h4 className="font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-blue-600" />
                  <span>Ca Giảng Dạy Theo Lịch Hôm Nay</span>
                </h4>
                {activeSchedule ? (
                  <div className="space-y-1.5 text-slate-600 pt-1">
                    <p className="font-bold text-slate-800 text-sm">{activeSchedule.subjectName || 'Lịch giảng dạy'}</p>
                    <p className="text-slate-500">
                      Phòng: <span className="font-semibold text-slate-700">{activeSchedule.roomId || 'Chưa xếp'}</span>
                    </p>
                    <p className="text-slate-500">
                      Khung ca: {activeShift?.startTime} ⟶ {activeShift?.endTime}
                    </p>
                  </div>
                ) : (
                  <p className="text-slate-500">Hôm nay không có ca giảng dạy nào theo thời khóa biểu.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: QUÉT MÃ QR ĐỘNG (CAMERA SCANNER THỰC) */}
      {/* ========================================================= */}
      {activeTab === 'qr' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-slate-900 rounded-3xl p-6 text-white flex flex-col justify-between min-h-[440px] relative overflow-hidden">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-400/30">
                  <ScanLine className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                  <span>Camera QR Code Scanner (Trực tiếp từ Camera)</span>
                </span>

                <button
                  onClick={cameraActive ? stopCameraScanner : startCameraScanner}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-2 ${cameraActive ? 'bg-rose-500 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{cameraActive ? 'Tắt Camera' : 'Mở Camera Quét Mã'}</span>
                </button>
              </div>

              {/* Khung quét Camera Thực */}
              <div className="relative w-full aspect-video sm:aspect-[4/3] max-h-[360px] bg-black rounded-2xl overflow-hidden flex items-center justify-center border border-white/10">
                <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />

                {cameraActive ? (
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                    <div className="w-56 h-56 border-2 border-indigo-400/80 rounded-2xl relative shadow-[0_0_50px_rgba(99,102,241,0.3)]">
                      <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse top-1/2"></div>
                      <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-white"></div>
                      <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-white"></div>
                      <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-white"></div>
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-white"></div>
                    </div>
                    <p className="text-xs text-slate-300 mt-4 bg-black/60 px-3 py-1 rounded-full backdrop-blur-sm">
                      Hướng camera về phía mã QR động hiển thị trên Kiosk sảnh hoặc màn hình lớp
                    </p>
                  </div>
                ) : (
                  <div className="text-center p-6 text-slate-400">
                    <QrCode className="w-16 h-16 mx-auto mb-3 text-slate-600" />
                    <p className="text-sm font-semibold text-slate-300">Camera chưa được kích hoạt</p>
                    <p className="text-xs text-slate-500 mt-1">Bấm nút "Mở Camera Quét Mã" phía trên để điểm danh</p>
                  </div>
                )}
              </div>
            </div>

            {isScanningQr && (
              <div className="mt-4 p-3 rounded-xl bg-indigo-950/80 border border-indigo-500/40 text-xs text-center text-indigo-300 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Đang gửi mã và tọa độ GPS lên hệ thống xác thực...</span>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                <span>Cơ Chế QR Chống Điểm Danh Hộ</span>
              </h3>
              <ul className="space-y-2 text-xs text-slate-600 list-disc list-inside">
                <li>
                  <strong className="text-slate-800">Bắt buộc định vị GPS:</strong> Điện thoại quét mã QR phải nằm trong bán kính trường ({campusConfig.radiusMeters}m). Ngăn chặn tuyệt đối việc chụp màn hình gửi Zalo để người ở nhà quét hộ.
                </li>
                <li>
                  <strong className="text-slate-800">Mã tự hủy sau 20 giây:</strong> Mã động làm mới liên tục tại Kiosk/màn hình lớp.
                </li>
                <li>
                  <strong className="text-slate-800">Chữ ký số HMAC-SHA256:</strong> Đảm bảo mã sinh từ máy chủ chính chủ, chống giả mạo token.
                </li>
              </ul>
            </div>

            {/* Trạng thái GPS hiện tại của thiết bị khi quét QR */}
            <div className={`p-4 rounded-3xl border text-xs ${isGpsValid
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
              : 'bg-amber-50/70 border-amber-200 text-amber-900'
              }`}>
              <div className="flex items-center gap-2 font-bold mb-1">
                <Navigation className={`w-4 h-4 ${isGpsValid ? 'text-emerald-600' : 'text-amber-600'}`} />
                <span>{isGpsValid ? 'GPS Sẵn Sàng Điểm Danh QR' : 'Chưa Xác Thực Được GPS Trường'}</span>
              </div>
              <p className="text-[11px] opacity-80">
                {isGpsValid
                  ? `Thiết bị đang trong khuôn viên trường (cách tâm trường ${gpsDistance || 0}m). Bạn có thể quét mã QR ngay.`
                  : userCoords
                    ? `Bạn đang cách trường ${gpsDistance || 0}m (vượt quá bán kính cho phép ${campusConfig.radiusMeters}m). Bạn cần có mặt tại trường để quét mã.`
                    : 'Vui lòng cho phép quyền truy cập vị trí và bấm "Lấy lại vị trí" ở tab GPS trước khi quét mã.'}
              </p>
            </div>

            <div className="bg-indigo-50/60 p-6 rounded-3xl border border-indigo-100 text-xs text-indigo-950">
              <p className="font-bold mb-1">💡 Hướng Dẫn:</p>
              <p className="text-slate-600">
                Hãy nhìn màn hình Kiosk (`/kiosk`) tại sảnh hoặc máy chiếu giảng đường, bấm "Mở Camera Quét Mã" trên điện thoại để quét ngay.
              </p>
            </div>
          </div>
        </div>
      )}



      {/* 4. Lịch Trình Chi Tiết Các Ca Hôm Nay */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-sm text-slate-900">
              Lịch Dạy & Công Tác Hôm Nay ({todaySchedules.length} ca)
            </h3>
          </div>
          <span className="text-xs text-slate-400">Tự động kế thừa từ thời khóa biểu</span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-400 text-xs">Đang tải lịch trình hôm nay...</div>
        ) : todaySchedules.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            Hôm nay bạn không có ca giảng dạy nào. Hãy tận hưởng ngày làm việc hiệu quả!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50/80 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-6">Ca Giảng Dạy</th>
                  <th className="py-3.5 px-6">Học Phần / Môn Học</th>
                  <th className="py-3.5 px-6">Phòng Học</th>
                  <th className="py-3.5 px-6">Khung Giờ</th>
                  <th className="py-3.5 px-6">Phương thức</th>
                  <th className="py-3.5 px-6">Trạng Thái</th>
                  <th className="py-3.5 px-6 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {todaySchedules.map((sch) => {
                  const shift = sch.shiftId as ShiftConfig;
                  const log = todayLogs.find((l) => {
                    const schedId = typeof l.scheduleId === 'object' ? (l.scheduleId as any)?._id : l.scheduleId;
                    if (schedId && schedId === sch._id) return true;
                    const sid = typeof l.shiftId === 'object' ? l.shiftId?._id : l.shiftId;
                    return shift && sid === shift._id;
                  });

                  const isOpen = Boolean(log?.checkInTime && !log?.checkOutTime && log.status !== 'ABSENT' && log.status !== 'EXCUSED_ABSENCE');

                  return (
                    <tr key={sch._id} className="hover:bg-slate-50/60 transition">
                      <td className="py-4 px-6 font-bold text-slate-900">{shift?.name || 'Ca dạy'}</td>
                      <td className="py-4 px-6 text-slate-800">{sch.subjectName || 'Giảng dạy chính khóa'}</td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center gap-1 text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg font-medium">
                          <MapPin className="w-3 h-3 text-rose-500" />
                          <span>{sch.roomId || 'Chưa xếp phòng'}</span>
                        </span>
                      </td>
                      <td className="py-4 px-6 font-mono font-bold text-slate-800">
                        {shift?.startTime} ⟶ {shift?.endTime}
                      </td>
                      <td className="py-4 px-6">
                        {log?.method && log.status !== 'ABSENT' && log.status !== 'EXCUSED_ABSENCE' ? (
                          <span className="uppercase font-mono text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold">
                            {log.method}
                          </span>
                        ) : (
                          <span className="text-slate-400">--</span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        {log ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold text-[11px] ${
                              log.status === 'ON_TIME'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : log.status === 'LATE'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : log.status === 'ABSENT'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : log.status === 'EXCUSED_ABSENCE'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>
                              {log.status === 'ON_TIME'
                                ? 'Đúng Giờ'
                                : log.status === 'LATE'
                                ? 'Đi Muộn'
                                : log.status === 'ABSENT'
                                ? 'Vắng Mặt'
                                : log.status === 'EXCUSED_ABSENCE'
                                ? 'Nghỉ Có Phép'
                                : log.status}
                            </span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Chưa điểm danh</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right">
                        {isOpen ? (
                          <button
                            onClick={() => handleGpsCheckOut(log?._id, shift?._id)}
                            disabled={isSubmitting}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-bold text-xs shadow-xs transition active:scale-95 cursor-pointer"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                            <span>Check-out ra ca</span>
                          </button>
                        ) : log?.checkOutTime ? (
                          <div className="text-[11px] text-slate-500 font-mono">
                            <span>{formatTime(log.checkInTime)} ⟶ {formatTime(log.checkOutTime)}</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedScheduleId(sch._id);
                              window.scrollTo({ top: 300, behavior: 'smooth' });
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-blue-200 hover:bg-blue-50 text-blue-600 text-[11px] font-semibold transition cursor-pointer"
                          >
                            <span>Chọn ca</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendanceCheckInPage;
