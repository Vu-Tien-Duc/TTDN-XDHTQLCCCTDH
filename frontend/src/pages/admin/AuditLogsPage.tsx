import React, { useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  Clock,
  Eye,
  Globe,
  FileCode2,
} from 'lucide-react';
import { auditLogService, AuditLogItem } from '../../services';
import { formatDate, formatDateTime, showErrorToast } from '../../utils';
import { Button, Modal, EmptyState } from '../../components';

const ACTION_MAP: Record<string, { label: string; color: string; bg: string }> = {
  // Điểm danh Face ID / QR / Thủ công
  FACE_CHECK_IN: { label: 'Điểm Danh Face ID (Vào ca)', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  FACE_CHECK_OUT: { label: 'Điểm Danh Face ID (Ra về)', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' },
  QR_CHECK_IN: { label: 'Điểm Danh QR Động', color: 'text-sky-700', bg: 'bg-sky-50 border-sky-200' },
  CHECK_IN: { label: 'Vào Ca Làm Việc', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  CHECK_OUT: { label: 'Ra Về Hết Ca', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' },
  EDIT_ATTENDANCE: { label: 'Điều Chỉnh Chấm Công', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  ADMIN_OVERRIDE_ATTENDANCE: { label: 'Ghi Đè Chấm Công', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  ATTENDANCE_OVERLAPPING_SCHEDULES_WARNING: { label: 'Cảnh Báo Trùng Lịch Ca', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },

  // Nhận diện & Face ID Descriptors
  REGISTER_FACE_DESCRIPTOR: { label: 'Đăng Ký Khuôn Mặt', color: 'text-cyan-700', bg: 'bg-cyan-50 border-cyan-200' },
  DELETE_FACE_DESCRIPTOR: { label: 'Xóa Dữ Liệu Khuôn Mặt', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },

  // Xác thực & Bảo mật Auth
  USER_LOGIN_SUCCESS: { label: 'Đăng Nhập Thành Công', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  USER_LOGIN_FAILED: { label: 'Đăng Nhập Thất Bại', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' },
  USER_LOGOUT: { label: 'Đăng Xuất Hệ Thống', color: 'text-slate-700', bg: 'bg-slate-100 border-slate-200' },
  CHANGE_PASSWORD: { label: 'Đổi Mật Khẩu', color: 'text-violet-700', bg: 'bg-violet-50 border-violet-200' },
  RESET_PASSWORD: { label: 'Khôi Phục Mật Khẩu (OTP)', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
  UPDATE_AVATAR: { label: 'Cập Nhật Ảnh Đại Diện', color: 'text-teal-700', bg: 'bg-teal-50 border-teal-200' },

  // Nghỉ phép
  APPROVE_LEAVE: { label: 'Phê Duyệt Đơn Nghỉ', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  REJECT_LEAVE: { label: 'Từ Chối Đơn Nghỉ', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' },

  // Tự động Cron
  CRON_AUTO_ABSENT: { label: 'Quét Tự Động Đánh Vắng', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },

  // Quản lý người dùng
  CREATE_USER: { label: 'Thêm Người Dùng Mới', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  UPDATE_USER: { label: 'Cập Nhật Người Dùng', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  DELETE_USER: { label: 'Khóa Tài Khoản', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' },

  // Quản lý đơn vị & ca
  CREATE_DEPARTMENT: { label: 'Tạo Đơn Vị Mới', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' },
  UPDATE_DEPARTMENT: { label: 'Cập Nhật Đơn Vị', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  DELETE_DEPARTMENT: { label: 'Xóa Đơn Vị', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' },
  CREATE_SHIFT: { label: 'Tạo Ca Làm Việc', color: 'text-teal-700', bg: 'bg-teal-50 border-teal-200' },
  UPDATE_SHIFT: { label: 'Cập Nhật Ca', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  DELETE_SHIFT: { label: 'Xóa Ca Làm Việc', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' },
};

const TARGET_TYPE_MAP: Record<string, string> = {
  User: 'Người dùng (Cán bộ)',
  AttendanceLog: 'Bản ghi Chấm công',
  LeaveRequest: 'Đơn xin Nghỉ phép',
  Department: 'Khoa / Phòng ban',
  ShiftConfig: 'Ca làm việc chuẩn',
  Schedule: 'Lịch phân công giảng dạy',
};

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Filters
  const [actionFilter, setActionFilter] = useState<string>('');
  const [targetTypeFilter, setTargetTypeFilter] = useState<string>('');
  const [searchActor, setSearchActor] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [serverTotalDocs, setServerTotalDocs] = useState<number>(0);
  const [serverTotalPages, setServerTotalPages] = useState<number>(1);
  const pageSize = 12;

  // Details Modal
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  // Fetch Audit Logs
  const fetchAuditLogs = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      // Chuẩn hóa endDate về cuối ngày (23:59:59.999) để không bỏ sót các log trong ngày kết thúc
      let formattedEndDate: string | undefined = undefined;
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        formattedEndDate = end.toISOString();
      }

      const res = await auditLogService.getAuditLogs({
        action: actionFilter || undefined,
        targetType: targetTypeFilter || undefined,
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        endDate: formattedEndDate,
        page: currentPage,
        limit: pageSize,
      });

      if (res && Array.isArray(res.logs)) {
        setLogs(res.logs);
        setServerTotalDocs(res.pagination?.totalDocs ?? res.totalRecords ?? res.logs.length);
        setServerTotalPages(res.pagination?.totalPages ?? Math.ceil((res.totalRecords || res.logs.length) / pageSize) ?? 1);
      } else {
        setLogs([]);
        setServerTotalDocs(0);
        setServerTotalPages(1);
      }
    } catch (err) {
      showErrorToast(err, 'Không thể tải nhật ký kiểm toán hệ thống.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [actionFilter, targetTypeFilter, startDate, endDate, currentPage, pageSize]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  // Filtered by Search Actor (trên tập log hiện tại)
  const filteredLogs = useMemo(() => {
    if (!searchActor.trim()) return logs;
    const term = searchActor.toLowerCase().trim();
    return logs.filter((log) => {
      const actorName = log.actor?.fullName?.toLowerCase() || (log.actorType === 'SYSTEM' ? 'hệ thống cron system' : '');
      const actorEmail = log.actor?.email?.toLowerCase() || '';
      const actionName = log.action?.toLowerCase() || '';
      return actorName.includes(term) || actorEmail.includes(term) || actionName.includes(term);
    });
  }, [logs, searchActor]);

  const paginatedLogs = filteredLogs;

  const handleResetFilter = () => {
    setActionFilter('');
    setTargetTypeFilter('');
    setSearchActor('');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 p-6 sm:p-8 text-white shadow-xl shadow-indigo-950/15 border border-slate-800">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-72 h-72 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 text-purple-200 text-xs font-semibold border border-purple-400/30 mb-2">
              <ShieldAlert className="w-3.5 h-3.5 text-purple-300" />
              <span>Phân Hệ Giám Sát & Tuân Thủ</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Nhật Ký Kiểm Toán Hệ Thống (Audit Logs)
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-xl">
              Ghi nhận và lưu vết toàn bộ các thao tác nhạy cảm của Quản trị viên và Trưởng khoa nhằm đảm bảo tính toàn vẹn, minh bạch của dữ liệu.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchAuditLogs(true)}
              disabled={loading || refreshing}
              className="bg-white/10 hover:bg-white/20 border-white/20 text-white font-medium text-xs rounded-xl shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Làm mới dữ liệu</span>
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <Filter className="w-3.5 h-3.5 text-blue-600" />
            <span>Bộ Lọc Tra Cứu Nhật Ký</span>
          </div>
          {(actionFilter || targetTypeFilter || searchActor || startDate || endDate) && (
            <button
              onClick={handleResetFilter}
              className="text-xs text-blue-600 hover:text-blue-700 hover:underline font-semibold"
            >
              Đặt lại tất cả
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Tìm kiếm người thao tác */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchActor}
              onChange={(e) => {
                setSearchActor(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Tìm theo người hoặc hành động..."
              className="w-full text-xs pl-8 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-slate-50/50"
            />
          </div>

          {/* Lọc loại hành động */}
          <div>
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-slate-50/50 font-medium text-slate-700"
            >
              <option value="">-- Tất cả hành động --</option>
              <option value="APPROVE_LEAVE">Phê duyệt đơn nghỉ phép</option>
              <option value="REJECT_LEAVE">Từ chối đơn nghỉ phép</option>
              <option value="EDIT_ATTENDANCE">Điều chỉnh chấm công</option>
              <option value="ADMIN_OVERRIDE_ATTENDANCE">Ghi đè chấm công thủ công</option>
              <option value="CRON_AUTO_ABSENT">Quét tự động đánh vắng (Cron)</option>
              <option value="CREATE_USER">Thêm người dùng mới</option>
              <option value="UPDATE_USER">Cập nhật người dùng</option>
              <option value="DELETE_USER">Khóa tài khoản người dùng</option>
              <option value="CREATE_DEPARTMENT">Tạo đơn vị mới</option>
              <option value="UPDATE_DEPARTMENT">Cập nhật đơn vị</option>
              <option value="DELETE_DEPARTMENT">Xóa đơn vị</option>
              <option value="CREATE_SHIFT">Tạo ca làm việc</option>
              <option value="UPDATE_SHIFT">Cập nhật ca làm việc</option>
              <option value="DELETE_SHIFT">Xóa ca làm việc</option>
            </select>
          </div>

          {/* Lọc Target Type */}
          <div>
            <select
              value={targetTypeFilter}
              onChange={(e) => {
                setTargetTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-slate-50/50 font-medium text-slate-700"
            >
              <option value="">-- Tất cả đối tượng --</option>
              <option value="User">Người dùng (Cán bộ)</option>
              <option value="AttendanceLog">Bản ghi Chấm công</option>
              <option value="LeaveRequest">Đơn xin Nghỉ phép</option>
              <option value="Department">Khoa / Phòng ban</option>
              <option value="ShiftConfig">Ca làm việc chuẩn</option>
              <option value="Schedule">Lịch phân công giảng dạy</option>
            </select>
          </div>

          {/* Từ ngày */}
          <div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-slate-50/50 text-slate-700"
            />
          </div>

          {/* Đến ngày */}
          <div>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-slate-50/50 text-slate-700"
            />
          </div>
        </div>
      </div>

      {/* 3. Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 bg-slate-50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredLogs.length === 0 ? (
          <EmptyState
            icon={ShieldAlert}
            title="Không tìm thấy bản ghi nhật ký kiểm toán nào"
            description="Không có thao tác nhạy cảm nào khớp với tiêu chí bộ lọc đã chọn."
            actionText="Đặt lại bộ lọc"
            onAction={handleResetFilter}
            className="py-12 border-0"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase font-bold text-[11px]">
                    <th className="py-3 px-4">Thời gian</th>
                    <th className="py-3 px-4">Người thực hiện</th>
                    <th className="py-3 px-4">Hành động</th>
                    <th className="py-3 px-4">Đối tượng tác động</th>
                    <th className="py-3 px-4">Địa chỉ IP</th>
                    <th className="py-3 px-4 text-right">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedLogs.map((log) => {
                    const actionInfo = ACTION_MAP[log.action] || {
                      label: log.action,
                      color: 'text-slate-700',
                      bg: 'bg-slate-100 border-slate-200',
                    };

                    return (
                      <tr key={log._id} className="hover:bg-slate-50/70 transition group">
                        {/* Thời gian */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-semibold text-slate-900">{formatDate(log.timestamp)}</div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(log.timestamp).toLocaleTimeString('vi-VN')}</span>
                          </div>
                        </td>

                        {/* Người thực hiện */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {log.actorType === 'SYSTEM' || !log.actor ? (
                            <div>
                              <div className="font-bold text-indigo-700 flex items-center gap-1.5">
                                <span className="inline-block w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                                Hệ thống (CRON / Auto)
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono">Tác vụ tự động</div>
                            </div>
                          ) : (
                            <div>
                              <div className="font-bold text-slate-800">
                                {log.actor?.fullName || 'Người dùng ẩn'}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono">{log.actor?.email || '—'}</div>
                            </div>
                          )}
                        </td>

                        {/* Hành động */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-bold border ${actionInfo.bg} ${actionInfo.color}`}
                          >
                            {actionInfo.label}
                          </span>
                        </td>

                        {/* Đối tượng */}
                        <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-700">
                          <span className="font-bold text-slate-900">
                            {TARGET_TYPE_MAP[log.targetType] || log.targetType}
                          </span>
                          <span className="text-[11px] text-slate-400 block font-mono truncate max-w-[140px]">
                            ID: {log.targetId}
                          </span>
                        </td>

                        {/* IP Address */}
                        <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono">
                          {log.ipAddress ? (
                            <span className="flex items-center gap-1">
                              <Globe className="w-3 h-3 text-slate-400" />
                              <span>{log.ipAddress}</span>
                            </span>
                          ) : (
                            <span className="text-slate-300">N/A</span>
                          )}
                        </td>

                        {/* Action */}
                        <td className="py-3 px-4 whitespace-nowrap text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedLog(log)}
                            className="text-xs py-1 px-2.5 rounded-lg border-slate-200 hover:border-blue-400 hover:text-blue-600"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            <span>Xem vết</span>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {serverTotalPages > 1 && (
              <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>
                  Hiển thị {(currentPage - 1) * pageSize + 1} -{' '}
                  {Math.min(currentPage * pageSize, serverTotalDocs)} trên tổng số {serverTotalDocs} bản ghi
                </span>

                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="text-xs py-1 px-2"
                  >
                    Trước
                  </Button>
                  <span className="px-2 font-bold text-slate-700">
                    {currentPage} / {serverTotalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(serverTotalPages, p + 1))}
                    disabled={currentPage === serverTotalPages}
                    className="text-xs py-1 px-2"
                  >
                    Sau
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 4. Details Modal */}
      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title="Chi Tiết Thao Tác Kiểm Toán"
        maxWidth="2xl"
      >
        {selectedLog && (
          <div className="space-y-4 pt-1 text-xs">
            {/* Summary Info Header */}
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <div>
                <span className="text-slate-400 font-medium block">Người thực hiện:</span>
                <span className="font-bold text-slate-900 text-sm">
                  {selectedLog.actorType === 'SYSTEM' || !selectedLog.actor
                    ? 'Hệ thống (CRON / Tác vụ tự động)'
                    : selectedLog.actor?.fullName || 'Người dùng ẩn'}
                </span>
                <span className="text-slate-500 block font-mono text-[11px]">
                  {selectedLog.actor?.email || (selectedLog.actorType === 'SYSTEM' ? 'system@university.internal' : '—')}
                </span>
              </div>

              <div>
                <span className="text-slate-400 font-medium block">Thời điểm ghi nhận:</span>
                <span className="font-bold text-slate-900">{formatDateTime(selectedLog.timestamp)}</span>
                <span className="text-slate-500 block text-[11px]">IP: {selectedLog.ipAddress || 'Internal'}</span>
              </div>
            </div>

            {/* Action & Target */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-blue-50/60 border border-blue-100 text-xs">
              <div>
                <span className="text-slate-500 font-medium block">Hành động:</span>
                <span className="font-bold text-blue-950 text-sm">
                  {ACTION_MAP[selectedLog.action]?.label || selectedLog.action}
                </span>
                <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                  Mã hệ thống: {selectedLog.action}
                </span>
              </div>
              <div className="text-right">
                <span className="text-slate-500 font-medium block">Đối tượng tác động:</span>
                <span className="font-bold text-slate-800 text-sm">
                  {TARGET_TYPE_MAP[selectedLog.targetType] || selectedLog.targetType}
                </span>
                <span className="font-mono text-[11px] text-slate-500 block mt-0.5">
                  ID: {selectedLog.targetId}
                </span>
              </div>
            </div>

            {/* Details JSON View */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <FileCode2 className="w-4 h-4 text-slate-500" />
                  <span>Dữ liệu chi tiết sự thay đổi (Details):</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(selectedLog.details, null, 2));
                    toast.success('Đã sao chép nội dung JSON!');
                  }}
                  className="text-blue-600 hover:underline font-medium text-[11px]"
                >
                  Sao chép JSON
                </button>
              </div>

              <pre className="p-4 rounded-2xl bg-slate-900 text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-60 leading-relaxed border border-slate-800">
                {JSON.stringify(selectedLog.details || { message: 'Không có thông tin chi tiết bổ sung.' }, null, 2)}
              </pre>
            </div>

            <div className="pt-2 flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setSelectedLog(null)}>
                Đóng hộp thoại
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AuditLogsPage;
