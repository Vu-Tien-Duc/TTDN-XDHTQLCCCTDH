import React from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  MessageSquare,
  ShieldAlert,
  User as UserIcon,
  X,
  XCircle,
} from 'lucide-react';
import { LeaveRequest, User } from '../../types';
import { formatDate, formatDateTime, LEAVE_STATUS_MAP } from '../../utils';

interface LeaveDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  leaveRequest: LeaveRequest | null;
}

const LEAVE_TYPE_LABELS: Record<string, string> = {
  nghi_phep: 'Nghỉ phép thường',
  day_bu: 'Đăng ký dạy bù',
  doi_ca: 'Xin đổi ca làm việc',
};

export const LeaveDetailModal: React.FC<LeaveDetailModalProps> = ({ isOpen, onClose, leaveRequest }) => {
  if (!isOpen || !leaveRequest) return null;

  const applicant =
    typeof leaveRequest.userId === 'object' && leaveRequest.userId !== null
      ? (leaveRequest.userId as User)
      : null;

  const approver =
    typeof leaveRequest.reviewedBy === 'object' && leaveRequest.reviewedBy !== null
      ? (leaveRequest.reviewedBy as User)
      : null;

  // Type & Status
  const typeKey = (leaveRequest as unknown as { type?: string }).type || leaveRequest.leaveType || 'nghi_phep';
  const typeLabel = LEAVE_TYPE_LABELS[typeKey] || typeKey;
  const statusInfo = LEAVE_STATUS_MAP[leaveRequest.status] || LEAVE_STATUS_MAP.PENDING;

  // File url
  const attachment =
    (leaveRequest as unknown as { attachmentUrl?: string }).attachmentUrl || leaveRequest.evidenceFile;

  // Calculate days chuẩn theo lịch
  const start = new Date(leaveRequest.startDate);
  const end = new Date(leaveRequest.endDate);
  const sUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const eUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  const diffDays = Math.round((eUtc - sUtc) / (1000 * 60 * 60 * 24)) + 1;

  const isImage = attachment && /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(attachment.split('?')[0]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh] my-auto">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold text-slate-900 truncate">Chi Tiết Đơn Nghỉ / Dạy Bù</h3>
              <p className="text-xs text-slate-500 truncate">Mã đơn: #{leaveRequest._id.slice(-6).toUpperCase()}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-200/80 text-slate-500 hover:text-slate-700 flex items-center justify-center transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Status & Type Banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div>
              <span className="text-xs text-slate-500">Loại đơn:</span>
              <p className="text-sm font-semibold text-slate-800">{typeLabel}</p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500 block">Trạng thái hiện tại:</span>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border mt-0.5 ${statusInfo.bg} ${statusInfo.color}`}>
                {leaveRequest.status === 'APPROVED' && <CheckCircle2 className="w-3.5 h-3.5" />}
                {leaveRequest.status === 'REJECTED' && <XCircle className="w-3.5 h-3.5" />}
                {leaveRequest.status === 'PENDING' && <Clock className="w-3.5 h-3.5" />}
                {statusInfo.label}
              </span>
            </div>
          </div>

          {/* Applicant Info */}
          {applicant && (
            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <UserIcon className="w-4 h-4 text-blue-600" />
                Thông tin người nộp đơn
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700 pt-1">
                <div>
                  <span className="text-slate-400">Họ và tên:</span>{' '}
                  <strong className="text-slate-800">{applicant.fullName}</strong>
                </div>
                <div>
                  <span className="text-slate-400">Email:</span> {applicant.email}
                </div>
                <div>
                  <span className="text-slate-400">Vai trò:</span>{' '}
                  <span className="capitalize">{applicant.role}</span>
                </div>
                <div>
                  <span className="text-slate-400">Thời điểm nộp:</span>{' '}
                  {formatDateTime(leaveRequest.createdAt)}
                </div>
              </div>
            </div>
          )}

          {/* Time Duration */}
          <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Khoảng thời gian áp dụng</p>
                <p className="text-sm font-bold text-slate-900 mt-0.5">
                  {formatDate(leaveRequest.startDate)} &rarr; {formatDate(leaveRequest.endDate)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs text-blue-600 font-medium">Tổng số</span>
              <p className="text-xl font-extrabold text-blue-900">{diffDays} ngày</p>
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
              Lý do xin nghỉ / giải trình:
            </label>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
              {leaveRequest.reason}
            </div>
          </div>

          {/* Evidence Attachment */}
          {attachment ? (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                Minh chứng đính kèm thực tế:
              </label>
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-xs font-semibold text-slate-800 truncate">{attachment.split('/').pop()}</p>
                    <p className="text-[10px] text-slate-400 font-mono truncate">{attachment}</p>
                  </div>
                </div>
                <a
                  href={attachment}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shrink-0 transition-all shadow-sm"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Xem file
                </a>
              </div>
              {isImage && (
                <div className="mt-3 rounded-2xl overflow-hidden border border-slate-200 bg-slate-900/5 p-2 flex flex-col items-center justify-center relative group">
                  <img
                    src={attachment}
                    alt="Minh chứng đính kèm"
                    className="max-h-72 object-contain rounded-xl shadow-xs transition-transform group-hover:scale-[1.01]"
                    onError={(e) => {
                      // Nếu lỗi load ảnh
                      const target = e.currentTarget;
                      target.style.display = 'none';
                      const fallback = target.parentElement?.querySelector('.img-fallback');
                      if (fallback) (fallback as HTMLElement).style.display = 'flex';
                    }}
                  />
                  <div className="img-fallback hidden p-6 text-center text-xs text-slate-400 flex-col items-center gap-2">
                    <FileText className="w-8 h-8 text-slate-300" />
                    <span>Không thể tải bản xem trước của ảnh. Vui lòng bấm "Xem file" ở trên để mở trực tiếp.</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-400 text-center">
              Không có file minh chứng đính kèm cho đơn này
            </div>
          )}

          {/* Approval or Rejection Details */}
          {leaveRequest.status === 'APPROVED' && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Thông tin phê duyệt
              </div>
              {approver && (
                <p className="text-xs text-emerald-700">
                  Người duyệt: <strong>{approver.fullName}</strong> ({approver.email})
                </p>
              )}
              {leaveRequest.approvalNote && (
                <p className="text-xs text-emerald-900 bg-white/80 p-2.5 rounded-lg border border-emerald-200/60 mt-1">
                  <strong>Ghi chú:</strong> {leaveRequest.approvalNote}
                </p>
              )}
            </div>
          )}

          {leaveRequest.status === 'REJECTED' && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-rose-800">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                Lý do từ chối phê duyệt
              </div>
              {approver && (
                <p className="text-xs text-rose-700">
                  Người từ chối: <strong>{approver.fullName}</strong>
                </p>
              )}
              <div className="text-xs text-rose-900 bg-white/90 p-2.5 rounded-lg border border-rose-200/80 font-medium">
                {leaveRequest.rejectionReason || 'Không có lý do chi tiết.'}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

export default LeaveDetailModal;
