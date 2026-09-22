import React, { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  MapPin,
  Navigation,
  ExternalLink,
  ShieldCheck,
  Crosshair,
  School,
  Layers,
  ZoomIn,
  ZoomOut,
  Copy,
  Compass,
  Radio,
  Sparkles,
} from 'lucide-react';

interface GpsCampusMapProps {
  campusConfig: {
    name: string;
    lat: number;
    lng: number;
    radiusMeters: number;
  };
  userCoords: {
    lat: number;
    lng: number;
  } | null;
  gpsAccuracy: number | null;
  gpsDistance: number | null;
  isGpsValid: boolean;
  effectiveRadius: number;
  isFetchingGps: boolean;
  onRefreshGps: () => void;
  isAdmin?: boolean;
  onOpenAdminConfig?: () => void;
  className?: string;
  heightClass?: string;
}

export const GpsCampusMap: React.FC<GpsCampusMapProps> = ({
  campusConfig,
  userCoords,
  gpsAccuracy,
  gpsDistance,
  isGpsValid,
  effectiveRadius,
  isFetchingGps,
  onRefreshGps,
  isAdmin = false,
  onOpenAdminConfig,
  className = '',
  heightClass = 'h-[380px] sm:h-[450px]',
}) => {
  const [mapCenterMode, setMapCenterMode] = useState<'campus' | 'user'>('campus');
  const [mapType, setMapType] = useState<'satellite' | 'roadmap'>('satellite');

  // Tính zoom phù hợp theo bán kính
  const defaultZoom = useMemo(() => {
    const r = campusConfig.radiusMeters || 500;
    if (r <= 150) return 17;
    if (r <= 350) return 16;
    if (r <= 800) return 15;
    return 14;
  }, [campusConfig.radiusMeters]);

  const [zoomLevel, setZoomLevel] = useState<number>(defaultZoom);

  // Cập nhật zoom khi radius thay đổi
  React.useEffect(() => {
    setZoomLevel(defaultZoom);
  }, [defaultZoom]);

  // Lấy tọa độ hiển thị theo chế độ: Vị trí của bạn hoặc Tâm trường học
  const markerLat = mapCenterMode === 'user' && userCoords ? userCoords.lat : campusConfig.lat;
  const markerLng = mapCenterMode === 'user' && userCoords ? userCoords.lng : campusConfig.lng;

  // Google Maps Embed:
  // t=h: Hybrid (Vệ tinh có tên đường, tòa nhà chuẩn sắc nét)
  // t=m: Roadmap (Bản đồ đường phố vector chuẩn)
  const mapEmbedUrl = useMemo(() => {
    const tParam = mapType === 'satellite' ? 'h' : 'm';
    return `https://maps.google.com/maps?q=${markerLat},${markerLng}&hl=vi&z=${zoomLevel}&t=${tParam}&output=embed`;
  }, [markerLat, markerLng, zoomLevel, mapType]);

  const googleMapsExternalUrl = userCoords
    ? `https://www.google.com/maps/dir/?api=1&origin=${userCoords.lat},${userCoords.lng}&destination=${campusConfig.lat},${campusConfig.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${campusConfig.lat},${campusConfig.lng}`;

  const handleCopyCoords = (lat: number, lng: number) => {
    navigator.clipboard.writeText(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    toast.success(`Đã sao chép tọa độ: ${lat.toFixed(5)}, ${lng.toFixed(5)}`, {
      id: 'gps-copy-coords',
      duration: 1500,
    });
  };

  return (
    <div
      className={`bg-white rounded-2xl sm:rounded-3xl border border-slate-200 overflow-hidden shadow-sm flex flex-col ${className}`}
    >
      {/* Header Bản đồ */}
      <div className="p-3.5 sm:p-4 border-b border-slate-200/90 bg-gradient-to-r from-slate-50 via-indigo-50/30 to-blue-50/40 space-y-2">
        {/* Hàng 1: Tiêu đề + Các nút điều khiển */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20">
              <Navigation className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight whitespace-nowrap">
                  Bản Đồ Định Vị Khuôn Viên Thực Tế
                </h3>

                {/* Badge trạng thái */}
                {isAdmin ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs whitespace-nowrap">
                    <ShieldCheck className="w-3 h-3 text-indigo-600" />
                    <span>Cấu Hình Geofence Admin</span>
                  </span>
                ) : (
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border shadow-2xs whitespace-nowrap ${
                      isGpsValid
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isGpsValid ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                      }`}
                    />
                    <span>{isGpsValid ? 'Trong Bán Kính Trường' : 'Ngoài Phạm Vi Cho Phép'}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Cột phải: Bộ điều khiển Bản đồ (Map Type & Center Target) */}
          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            {/* Chuyển đổi Vệ tinh / Bản đồ thường */}
            <div className="flex bg-slate-200/70 p-0.5 rounded-xl text-xs font-semibold shadow-inner">
              <button
                type="button"
                onClick={() => setMapType('satellite')}
                className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 whitespace-nowrap text-[11px] ${
                  mapType === 'satellite'
                    ? 'bg-white text-indigo-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Xem bản đồ ảnh vệ tinh độ nét cao"
              >
                <Layers className="w-3 h-3" />
                <span>Vệ Tinh</span>
              </button>
              <button
                type="button"
                onClick={() => setMapType('roadmap')}
                className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 whitespace-nowrap text-[11px] ${
                  mapType === 'roadmap'
                    ? 'bg-white text-blue-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Xem bản đồ giao thông đường phố"
              >
                <span>Bản Đồ</span>
              </button>
            </div>

            {/* Chuyển đổi Tâm Trường Học / Vị Trí Của Tôi */}
            <div className="flex bg-slate-200/70 p-0.5 rounded-xl text-xs font-semibold shadow-inner">
              <button
                type="button"
                onClick={() => setMapCenterMode('campus')}
                className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 whitespace-nowrap text-[11px] ${
                  mapCenterMode === 'campus'
                    ? 'bg-white text-blue-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Xem vị trí tâm trường học"
              >
                <School className="w-3 h-3 text-blue-600" />
                <span>Trường Học</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (userCoords) setMapCenterMode('user');
                  else onRefreshGps();
                }}
                className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 whitespace-nowrap text-[11px] ${
                  mapCenterMode === 'user'
                    ? 'bg-white text-emerald-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Xem vị trí GPS thiết bị của bạn"
              >
                <Crosshair className="w-3 h-3 text-emerald-600" />
                <span>Vị Trí Tôi</span>
              </button>
            </div>

            {/* Mở Google Maps ngoài */}
            <a
              href={googleMapsExternalUrl}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 sm:p-2 rounded-xl text-slate-500 hover:text-blue-600 bg-white hover:bg-slate-50 transition border border-slate-200 shadow-2xs"
              title="Mở trên ứng dụng Google Maps chính thức"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Hàng 2: Dải thông số chi tiết Geofence */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-600 pt-1.5 border-t border-slate-200/60">
          <span className="font-semibold text-slate-800 truncate flex items-center gap-1">
            <School className="w-3 h-3 text-blue-600" />
            {campusConfig.name}
          </span>
          <span className="text-slate-300">•</span>
          <span className="font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200/60 font-mono">
            Bán kính: {campusConfig.radiusMeters}m
          </span>
          {effectiveRadius > campusConfig.radiusMeters && (
            <>
              <span className="text-slate-300">•</span>
              <span className="text-slate-500 font-medium">
                Dung sai trong nhà: +{effectiveRadius - campusConfig.radiusMeters}m
              </span>
            </>
          )}
          {userCoords && gpsDistance !== null && (
            <>
              <span className="text-slate-300">•</span>
              <span className="text-indigo-700 font-semibold font-mono bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200/60">
                Khoảng cách thiết bị: {Math.round(gpsDistance)}m
              </span>
            </>
          )}
        </div>
      </div>

      {/* Khung nhúng Bản đồ Google Maps */}
      <div className={`relative w-full ${heightClass} bg-slate-100 overflow-hidden`}>
        {/* Loading skeleton placeholder */}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 text-slate-400 gap-2 pointer-events-none">
          <Compass className="w-8 h-8 text-blue-500 animate-spin" />
          <span className="text-xs font-semibold text-slate-500">Đang tải bản đồ khuôn viên...</span>
        </div>

        <iframe
          title="Campus Map"
          src={mapEmbedUrl}
          className="absolute inset-0 w-full h-full border-0 block z-0"
          referrerPolicy="no-referrer-when-downgrade"
        />

        {/* HUD Trực Quan Nổi Trên Góc Trái (Sleek Glassmorphism) */}
        <div className="absolute top-3 left-3 z-10 bg-slate-950/80 backdrop-blur-md px-3.5 py-2.5 rounded-2xl border border-white/20 text-white shadow-xl max-w-xs space-y-1.5 pointer-events-auto transition-all">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  isGpsValid ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <span className="truncate">
                {mapCenterMode === 'campus'
                  ? `Tâm: ${campusConfig.name}`
                  : isGpsValid
                  ? 'Tín hiệu GPS hợp lệ để điểm danh'
                  : `Cách tâm trường: ${Math.round(gpsDistance || 0)}m`}
              </span>
            </div>

            {isAdmin && (
              <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-indigo-500/30 text-indigo-300 border border-indigo-400/30">
                Admin
              </span>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 pt-0.5 border-t border-white/10 text-[11px] text-slate-300 font-mono">
            <span>
              {markerLat.toFixed(5)}, {markerLng.toFixed(5)}
            </span>
            <button
              type="button"
              onClick={() => handleCopyCoords(markerLat, markerLng)}
              className="text-slate-400 hover:text-white transition p-0.5 rounded"
              title="Sao chép tọa độ"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Floating Controls Nổi Góc Phải Dưới: Zoom +/- & Nút Quét GPS */}
        <div className="absolute bottom-3 right-3 z-10 flex flex-col sm:flex-row items-end sm:items-center gap-2">
          {/* Zoom controls */}
          <div className="flex flex-col bg-white/95 backdrop-blur-xs rounded-xl shadow-lg border border-slate-200 overflow-hidden divide-y divide-slate-100">
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.min(19, z + 1))}
              disabled={zoomLevel >= 19}
              className="p-1.5 text-slate-700 hover:bg-slate-100 hover:text-blue-600 disabled:opacity-40 transition active:scale-95"
              title="Phóng to bản đồ"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.max(12, z - 1))}
              disabled={zoomLevel <= 12}
              className="p-1.5 text-slate-700 hover:bg-slate-100 hover:text-blue-600 disabled:opacity-40 transition active:scale-95"
              title="Thu nhỏ bản đồ"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
          </div>

          {/* Nút Refresh GPS */}
          <button
            type="button"
            onClick={onRefreshGps}
            disabled={isFetchingGps}
            className="bg-white/95 hover:bg-white text-slate-800 px-3 py-2 rounded-xl shadow-lg border border-slate-200 text-xs font-bold flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50"
            title="Quét lại tọa độ GPS vệ tinh thiết bị"
          >
            <Crosshair className={`w-3.5 h-3.5 text-blue-600 ${isFetchingGps ? 'animate-spin' : ''}`} />
            <span>{isFetchingGps ? 'Đang dò GPS...' : 'Định vị lại tức thì'}</span>
          </button>
        </div>
      </div>

      {/* Footer chú giải trực quan */}
      <div className="p-3 sm:p-3.5 bg-slate-50 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2.5 text-xs text-slate-600">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 border border-white inline-block shadow-2xs" />
            <School className="w-3.5 h-3.5 text-blue-600 inline" />
            <span>
              Tâm trường: <strong>{campusConfig.name}</strong>
            </span>
          </span>

          <span className="flex items-center gap-1.5">
            <span
              className={`w-2.5 h-2.5 rounded-full border border-white inline-block shadow-2xs ${
                isGpsValid ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            <MapPin className="w-3.5 h-3.5 inline text-slate-700" />
            <span>
              Vị trí của bạn: (
              {gpsDistance !== null ? `${Math.round(gpsDistance)}m` : 'Đang lấy...'})
            </span>
          </span>
        </div>

        <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-amber-500" />
          <span>
            Vùng cho phép: <strong>{campusConfig.radiusMeters}m</strong> (Dung sai tối đa{' '}
            <strong>{effectiveRadius}m</strong>)
          </span>
        </div>
      </div>
    </div>
  );
};

export default GpsCampusMap;
