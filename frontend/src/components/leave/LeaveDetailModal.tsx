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
import { formatDate, formatDateTime, LEAVE_STATUS_MAP, getSafeMediaUrl } from '../../utils';
import UserAvatar from '../common/UserAvatar';

interface LeaveDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  leaveRequest: LeaveRequest | null;
  onApprove?: (req: LeaveRequest) => void;
  onReject?: (req: LeaveRequest) => void;
}

const LEAVE_TYPE_LABELS: Record<string, string> = {
  nghi_phep: 'Nghỉ phép thường',
  day_bu: 'Đăng ký dạy bù',
  doi_ca: 'Xin đổi ca làm việc',
};

export const LeaveDetailModal: React.FC<LeaveDetailModalProps> = ({
  isOpen,
  onClose,
  leaveRequest,
  onApprove,
  onReject,
}) => {
  if (!isOpen || !leaveRequest) return null;

  const applicant =
    typeof leaveRequest.userId === 'object' && leaveRequest.userId !== null
      ? (leaveRequest.userId as User)
      : null;

  const approverObj = leaveRequest.approvedBy || leaveRequest.reviewedBy;
  const approver =
    typeof approverObj === 'object' && approverObj !== null
      ? (approverObj as User)
      : null;

  // Type & Status
  const typeKey = leaveRequest.type || leaveRequest.leaveType || 'nghi_phep';
  const typeLabel = LEAVE_TYPE_LABELS[typeKey] || typeKey;
  const statusInfo = LEAVE_STATUS_MAP[leaveRequest.status] || LEAVE_STATUS_MAP.PENDING;

  // File url
  const rawAttachment = leaveRequest.attachmentUrl || leaveRequest.evidenceFile;
  const attachment = getSafeMediaUrl(rawAttachment);

  // Calculate days chuẩn theo lịch
  const start = new Date(leaveRequest.startDate);
  const end = new Date(leaveRequest.endDate);
  const sUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const eUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  const diffDays = Math.round((eUtc - sUtc) / (1000 * 60 * 60 * 24)) + 1;

  const isImage = attachment && /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(attachment.split('?')[0]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh] my-auto">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-50/90 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">Hồ Sơ Đơn Nghỉ / Dạy Bù</h3>
              <p className="text-[11px] sm:text-xs text-slate-500 font-mono truncate">
                Mã: #{leaveRequest._id.slice(-6).toUpperCase()} &bull; Nộp ngày {formatDate(leaveRequest.createdAt)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl hover:bg-slate-200/80 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors shrink-0"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 flex-1 text-xs sm:text-sm">
          {/* Status & Type Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90">
            <div>
              <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 block mb-0.5">Phân loại đơn:</span>
              <p className="text-sm font-bold text-slate-800">{typeLabel}</p>
            </div>
            <div className="flex items-center gap-2 sm:text-right">
              <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 sm:hidden">Trạng thái:</span>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${statusInfo.bg} ${statusInfo.color}`}>
                {leaveRequest.status === 'APPROVED' && <CheckCircle2 className="w-3.5 h-3.5" />}
                {leaveRequest.status === 'REJECTED' && <XCircle className="w-3.5 h-3.5" />}
                {leaveRequest.status === 'PENDING' && <Clock className="w-3.5 h-3.5" />}
                {statusInfo.label}
              </span>
            </div>
          </div>

          {/* Applicant Info with UserAvatar */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <UserIcon className="w-4 h-4 text-blue-600" />
                Thông tin người nộp đơn
              </div>
              {applicant?.code && (
                <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                  {applicant.code}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3.5 pt-0.5">
              <UserAvatar
                user={applicant ? { fullName: applicant.fullName, avatar: applicant.avatar, email: applicant.email } : null}
                size="lg"
              />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-900 text-sm sm:text-base truncate">
                  {applicant ? applicant.fullName : 'Giảng viên / Cán bộ'}
                </p>
                <p className="text-xs text-slate-500 font-mono truncate">
                  {applicant?.email || 'Chưa cập nhật email'}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                    {applicant?.role || 'Nhân sự'}
                  </span>
                  {applicant?.departmentId && (
                    <span className="text-[11px] text-slate-500 truncate">
                      Khoa: {typeof applicant.departmentId === 'object' ? (applicant.departmentId as { name?: string }).name : applicant.departmentId}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Thời điểm gửi đơn:</span>
              <span className="font-semibold text-slate-700">{formatDateTime(leaveRequest.createdAt)}</span>
            </div>
          </div>

          {/* Time Duration */}
          <div className="p-4 rounded-2xl bg-linear-to-r from-blue-50/70 to-indigo-50/70 border border-blue-200/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Calendar className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-500 font-medium">Khoảng thời gian nghỉ</p>
                <p className="text-xs sm:text-sm font-bold text-slate-900 mt-0.5 truncate">
                  {formatDate(leaveRequest.startDate)} &rarr; {formatDate(leaveRequest.endDate)}
                </p>
              </div>
            </div>
            <div className="text-right shrink-0 bg-white/80 px-3 py-1.5 rounded-xl border border-blue-200/60 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-blue-600 block">Tổng số</span>
              <p className="text-lg sm:text-xl font-extrabold text-blue-900 leading-tight">{diffDays} ngày</p>
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
              Lý do xin nghỉ / Nội dung giải trình:
            </label>
            <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-800 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words">
              {leaveRequest.reason || 'Không ghi rõ lý do'}
            </div>
          </div>

          {/* Evidence Attachment */}
          {attachment ? (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                Minh chứng đính kèm thực tế:
              </label>
              <div className="p-3 sm:p-3.5 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="overflow-hidden min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">{attachment.split('/').pop()}</p>
                    <p className="text-[10px] text-slate-400 font-mono truncate">{attachment}</p>
                  </div>
                </div>
                <a
                  href={attachment}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shrink-0 transition-all shadow-sm"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Xem file
                </a>
              </div>
              {isImage && (
                <div className="mt-2 rounded-2xl overflow-hidden border border-slate-200 bg-slate-900/5 p-2 flex flex-col items-center justify-center relative group">
                  <img
                    src={attachment}
                    alt="Minh chứng đính kèm"
                    className="max-h-60 sm:max-h-80 w-auto object-contain rounded-xl shadow-xs transition-transform group-hover:scale-[1.01]"
                    onError={(e) => {
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
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-400 text-center">
              Không có file minh chứng đính kèm cho đơn này
            </div>
          )}

          {/* Approval or Rejection Details */}
          {leaveRequest.status === 'APPROVED' && (
            <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Thông tin phê duyệt
              </div>
              {approver && (
                <div className="flex items-center gap-2.5 pt-1">
                  <UserAvatar
                    user={{ fullName: approver.fullName, avatar: approver.avatar, email: approver.email }}
                    size="sm"
                  />
                  <div className="text-xs">
                    <p className="font-bold text-emerald-950">{approver.fullName}</p>
                    <p className="text-[11px] text-emerald-700 font-mono">{approver.email}</p>
                  </div>
                </div>
              )}
              {leaveRequest.approvalNote && (
                <div className="text-xs text-emerald-900 bg-white/90 p-3 rounded-xl border border-emerald-200/80 mt-1 leading-relaxed">
                  <strong className="block text-emerald-800 mb-0.5">Ghi chú phê duyệt:</strong>
                  {leaveRequest.approvalNote}
                </div>
              )}
            </div>
          )}

          {leaveRequest.status === 'REJECTED' && (
            <div className="p-4 rounded-2xl bg-rose-50/80 border border-rose-200 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-rose-800">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                Lý do từ chối phê duyệt
              </div>
              {approver && (
                <div className="flex items-center gap-2.5 pt-1">
                  <UserAvatar
                    user={{ fullName: approver.fullName, avatar: approver.avatar, email: approver.email }}
                    size="sm"
                  />
                  <div className="text-xs">
                    <p className="font-bold text-rose-950">{approver.fullName}</p>
                    <p className="text-[11px] text-rose-700 font-mono">{approver.email}</p>
                  </div>
                </div>
              )}
              <div className="text-xs text-rose-900 bg-white/90 p-3 rounded-xl border border-rose-200/80 font-medium leading-relaxed">
                <strong className="block text-rose-800 mb-0.5">Lý do từ chối:</strong>
                {leaveRequest.rejectionReason || 'Không có lý do chi tiết.'}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-50 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 shrink-0">
          <div className="flex items-center justify-center sm:justify-start">
            {leaveRequest.status === 'PENDING' ? (
              <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200/80 px-3 py-1.5 rounded-xl w-full sm:w-auto text-center">
                ⏳ Đơn đang chờ xét duyệt
              </span>
            ) : null}
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2">
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-xs font-semibold rounded-xl transition-all text-center"
            >
              Đóng
            </button>
            {leaveRequest.status === 'PENDING' && onReject && (
              <button
                onClick={() => {
                  onClose();
                  onReject(leaveRequest);
                }}
                className="w-full sm:w-auto px-4 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5"
              >
                <XCircle className="w-3.5 h-3.5" />
                Từ chối
              </button>
            )}
            {leaveRequest.status === 'PENDING' && onApprove && (
              <button
                onClick={() => {
                  onClose();
                  onApprove(leaveRequest);
                }}
                className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Phê duyệt
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeaveDetailModal;

