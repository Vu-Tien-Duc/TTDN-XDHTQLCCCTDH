import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  ScanFace,
  Hand,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { attendanceApi } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { AttendanceLog, AttendanceStatus } from '../types';
import { toast } from 'react-hot-toast';

export const AttendanceHistoryPage: React.FC = () => {
  const { user } = useAuth();

  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 15;

  // Bộ lọc
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [methodFilter, setMethodFilter] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      const res: any = await attendanceApi.getHistory({
        page,
        limit,
        status: statusFilter || undefined,
        method: methodFilter || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      });

      if (res && res.success && res.data) {
        // Backend trả về { total, page, totalPages, records }
        const data = res.data;
        if (data.records) {
          setLogs(data.records);
          setTotal(data.total || 0);
          setTotalPages(data.totalPages || 1);
        } else if (Array.isArray(data)) {
          setLogs(data);
          setTotal(data.length);
          setTotalPages(1);
        }
      }
    } catch (error) {
      console.error('Lỗi tải lịch sử chấm công:', error);
      toast.error('Không thể tải lịch sử chấm công');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, methodFilter, fromDate, toDate]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Format Badge Trạng Thái
  const renderStatusBadge = (status: AttendanceStatus) => {
    switch (status) {
      case 'ON_TIME':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Đúng Giờ
          </span>
        );
      case 'LATE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5" />
            Đi Muộn
          </span>
        );
      case 'EARLY_LEAVE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-50 text-orange-700 border border-orange-200">
            <Clock className="w-3.5 h-3.5" />
            Về Sớm
          </span>
        );
      case 'ABSENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-3.5 h-3.5" />
            Vắng Mặt
          </span>
        );
      case 'EXCUSED_ABSENCE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Nghỉ Có Phép
          </span>
        );
      default:
        return <span className="text-xs text-gray-500">{status}</span>;
    }
  };

  // Format Badge Phương Thức
  const renderMethodBadge = (method: string, confidenceScore?: number) => {
    if (method === 'face' || method === 'FACE_ID') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
          <ScanFace className="w-3.5 h-3.5 text-purple-600" />
          <span>Face ID</span>
          {confidenceScore !== undefined && confidenceScore !== null && (
            <span className="text-[10px] bg-purple-200/60 px-1.5 py-0.2 rounded-md font-mono">
              {(confidenceScore * 100).toFixed(0)}%
            </span>
          )}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
        <Hand className="w-3.5 h-3.5 text-blue-600" />
        <span>Thủ Công</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Lịch Sử Chấm Công Đa Phương Thức</h1>
            <p className="text-sm text-gray-500">
              {user?.role === 'admin'
                ? 'Theo dõi & đối soát toàn bộ dữ liệu điểm danh trên toàn hệ thống'
                : user?.role === 'truongkhoa'
                ? 'Dữ liệu chấm công của cán bộ, giảng viên thuộc khoa quản lý'
                : 'Nhật ký chấm công và thời gian làm việc cá nhân'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchHistory()}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        </div>
      </div>

      {/* Bộ Lọc Filter Bar */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Lọc Trạng Thái */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Trạng thái</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-full text-xs px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="ON_TIME">Đúng Giờ (ON_TIME)</option>
            <option value="LATE">Đi Muộn (LATE)</option>
            <option value="EARLY_LEAVE">Về Sớm (EARLY_LEAVE)</option>
            <option value="ABSENT">Vắng Mặt (ABSENT)</option>
            <option value="EXCUSED_ABSENCE">Nghỉ Có Phép</option>
          </select>
        </div>

        {/* Lọc Phương Thức */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Phương thức</label>
          <select
            value={methodFilter}
            onChange={(e) => {
              setMethodFilter(e.target.value);
              setPage(1);
            }}
            className="w-full text-xs px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          >
            <option value="">Tất cả phương thức</option>
            <option value="face">Khuôn mặt (Face ID)</option>
            <option value="manual">Thủ công (Web Manual)</option>
          </select>
        </div>

        {/* Từ Ngày */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Từ ngày</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              setPage(1);
            }}
            className="w-full text-xs px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        {/* Đến Ngày */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Đến ngày</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              setPage(1);
            }}
            className="w-full text-xs px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Bảng Dữ Liệu Chấm Công */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50/80 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3.5 px-4">Nhân Sự / Giảng Viên</th>
                <th className="py-3.5 px-4">Ca Làm Việc / Lịch Học</th>
                <th className="py-3.5 px-4">Check-in</th>
                <th className="py-3.5 px-4">Check-out</th>
                <th className="py-3.5 px-4">Phương Thức</th>
                <th className="py-3.5 px-4">Trạng Thái</th>
                <th className="py-3.5 px-4">Thiết Bị</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
                      <span>Đang tải dữ liệu chấm công...</span>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">
                    Không có bản ghi chấm công nào phù hợp với bộ lọc
                  </td>
                </tr>
              ) : (
                logs.map((log: any) => {
                  const checkInDate = log.checkInTime ? new Date(log.checkInTime) : null;
                  const checkOutDate = log.checkOutTime ? new Date(log.checkOutTime) : null;

                  return (
                    <tr key={log._id} className="hover:bg-gray-50/70 transition">
                      {/* Người chấm công */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center font-bold text-xs text-indigo-600">
                            {log.userId?.fullName?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 text-xs">
                              {log.userId?.fullName || 'Không xác định'}
                            </div>
                            <div className="text-[11px] text-gray-400">
                              {log.userId?.email || 'N/A'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Ca / Phòng */}
                      <td className="py-3.5 px-4">
                        <div className="text-xs font-medium text-gray-900">
                          {log.shiftId?.name || 'Ca làm việc'}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {log.scheduleId?.roomId ? `Phòng ${log.scheduleId.roomId}` : 'Theo ca chuẩn'}
                        </div>
                      </td>

                      {/* Check-in */}
                      <td className="py-3.5 px-4">
                        {checkInDate ? (
                          <div>
                            <div className="text-xs font-bold font-mono text-gray-900">
                              {checkInDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div className="text-[11px] text-gray-400">
                              {checkInDate.toLocaleDateString('vi-VN')}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">--:--</span>
                        )}
                      </td>

                      {/* Check-out */}
                      <td className="py-3.5 px-4">
                        {checkOutDate ? (
                          <div>
                            <div className="text-xs font-bold font-mono text-gray-900">
                              {checkOutDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div className="text-[11px] text-gray-400">
                              {checkOutDate.toLocaleDateString('vi-VN')}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Chưa check-out</span>
                        )}
                      </td>

                      {/* Phương thức */}
                      <td className="py-3.5 px-4">
                        {renderMethodBadge(log.method, log.confidenceScore)}
                      </td>

                      {/* Trạng thái */}
                      <td className="py-3.5 px-4">
                        {renderStatusBadge(log.status)}
                      </td>

                      {/* Thiết bị / Ghi chú */}
                      <td className="py-3.5 px-4 text-xs text-gray-500 font-mono">
                        {log.deviceId || (log.method === 'face' ? 'KIOSK_CENTRAL' : 'WEB_CLIENT')}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Phân trang */}
        <div className="p-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <div>
            Tổng số <span className="font-bold text-gray-900">{total}</span> lượt chấm công
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2">
              Trang <strong className="text-gray-900">{page}</strong> / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendanceHistoryPage;
