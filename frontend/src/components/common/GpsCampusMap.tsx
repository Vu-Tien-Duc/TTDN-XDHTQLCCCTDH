import React, { useState } from 'react';
import { MapPin, Navigation, ExternalLink, ShieldCheck, Crosshair, School } from 'lucide-react';

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
}) => {
  const [mapCenterMode, setMapCenterMode] = useState<'user' | 'campus'>('campus');

  // Tính bbox cho OpenStreetMap hiển thị bao trùm cả khuôn viên và người dùng
  const centerLat = mapCenterMode === 'user' && userCoords ? userCoords.lat : campusConfig.lat;
  const centerLng = mapCenterMode === 'user' && userCoords ? userCoords.lng : campusConfig.lng;

  // Zoom offset xấp xỉ ~500m - 1km xung quanh
  const delta = 0.0075;
  const minLng = (centerLng - delta).toFixed(6);
  const minLat = (centerLat - delta).toFixed(6);
  const maxLng = (centerLng + delta).toFixed(6);
  const maxLat = (centerLat + delta).toFixed(6);

  const markerLat = userCoords ? userCoords.lat : campusConfig.lat;
  const markerLng = userCoords ? userCoords.lng : campusConfig.lng;

  const osmEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${minLng}%2C${minLat}%2C${maxLng}%2C${maxLat}&layer=mapnik&marker=${markerLat}%2C${markerLng}`;

  const googleMapsUrl = userCoords
    ? `https://www.google.com/maps/dir/?api=1&origin=${userCoords.lat},${userCoords.lng}&destination=${campusConfig.lat},${campusConfig.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${campusConfig.lat},${campusConfig.lng}`;

  return (
    <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs space-y-0">
      {/* Header Bản đồ */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-slate-50 to-indigo-50/40">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-blue-600/10 text-blue-600 flex items-center justify-center shrink-0">
            <Navigation className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">Bản Đồ Định Vị Khuôn Viên Thực Tế</h3>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  isGpsValid
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                }`}
              >
                {isGpsValid ? 'Trong Bán Kính Trường' : 'Ngoài Phạm Vi Cho Phép'}
              </span>
            </div>
            <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
              <span>{campusConfig.name}</span>
              <span>•</span>
              <span className="font-semibold text-blue-700">Bán kính: {campusConfig.radiusMeters}m</span>
              {gpsAccuracy && (
                <>
                  <span>•</span>
                  <span className="text-slate-500 font-mono">Dung sai: +{Math.min(Math.round(gpsAccuracy), 100)}m</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {isAdmin && onOpenAdminConfig && (
            <button
              onClick={onOpenAdminConfig}
              className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold border border-indigo-200 transition flex items-center gap-1"
              title="Chỉ Admin có quyền thiết lập tọa độ trường"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Chỉnh Tọa Độ (Admin)</span>
            </button>
          )}

          <div className="flex bg-slate-200/80 p-0.5 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setMapCenterMode('campus')}
              className={`px-2.5 py-1 rounded-lg transition ${
                mapCenterMode === 'campus'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Trường Học
            </button>
            <button
              onClick={() => {
                if (userCoords) setMapCenterMode('user');
                else onRefreshGps();
              }}
              className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 ${
                mapCenterMode === 'user'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Crosshair className="w-3 h-3" />
              <span>Vị Trí Của Tôi</span>
            </button>
          </div>

          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noreferrer"
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition border border-slate-200"
            title="Mở trên Google Maps"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Khung nhúng Bản đồ OpenStreetMap */}
      <div className="relative w-full h-72 sm:h-80 bg-slate-100 overflow-hidden">
        <iframe
          title="Campus Map"
          src={osmEmbedUrl}
          className="w-full h-full border-0"
          loading="lazy"
        />

        {/* HUD Trực quan nổi trên góc bản đồ */}
        <div className="absolute top-3 left-3 z-10 bg-slate-950/85 backdrop-blur-md px-3.5 py-2.5 rounded-2xl border border-white/20 text-white shadow-xl max-w-xs space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold">
            <div className={`w-2.5 h-2.5 rounded-full ${isGpsValid ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span>{isGpsValid ? 'Tín hiệu GPS hợp lệ để điểm danh' : 'Cách tâm trường: ' + (gpsDistance || 0) + 'm'}</span>
          </div>
          <div className="text-[11px] text-slate-300 font-mono">
            {userCoords ? `Tọa độ: ${userCoords.lat.toFixed(5)}, ${userCoords.lng.toFixed(5)}` : 'Đang tìm kiếm vệ tinh GPS...'}
          </div>
        </div>

        {/* Nút Refresh GPS nổi góc dưới */}
        <button
          onClick={onRefreshGps}
          disabled={isFetchingGps}
          className="absolute bottom-3 right-3 z-10 bg-white/95 hover:bg-white text-slate-800 px-3 py-2 rounded-xl shadow-lg border border-slate-200 text-xs font-bold flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50"
        >
          <Crosshair className={`w-3.5 h-3.5 text-blue-600 ${isFetchingGps ? 'animate-spin' : ''}`} />
          <span>{isFetchingGps ? 'Đang dò GPS...' : 'Định vị lại tức thì'}</span>
        </button>
      </div>

      {/* Footer chú giải trực quan */}
      <div className="p-3 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-blue-600 border border-white inline-block shadow-xs" />
            <School className="w-3.5 h-3.5 text-blue-600 inline" />
            <span>Tâm trường học: <strong>{campusConfig.name}</strong></span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded-full border border-white inline-block shadow-xs ${isGpsValid ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <MapPin className="w-3.5 h-3.5 inline text-slate-700" />
            <span>Vị trí của bạn ({gpsDistance !== null ? `${gpsDistance}m` : 'Đang lấy...'})</span>
          </span>
        </div>

        <div className="text-[11px] text-slate-500">
          💡 Vùng xanh cho phép: <strong>{campusConfig.radiusMeters}m</strong> (Dung sai trong nhà tối đa <strong>{effectiveRadius}m</strong>)
        </div>
      </div>
    </div>
  );
};

export default GpsCampusMap;
