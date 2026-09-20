import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  FileCheck2,
  Paperclip,
  RefreshCw,
  Search,
  XCircle,
} from 'lucide-react';
import leaveService from '../../services/leave.service';
import { LeaveRequest, User } from '../../types';
import { formatDate, LEAVE_STATUS_MAP } from '../../utils';
import { useAuth } from '../../contexts/AuthContext';
import LeaveDetailModal from '../../components/leave/LeaveDetailModal';

const LEAVE_TYPE_LABELS: Record<string, string> = {
  nghi_phep: 'Nghỉ phép thường',
  day_bu: 'Đăng ký dạy bù',
  doi_ca: 'Xin đổi ca làm việc',
};

export const LeaveApprovalsPage: React.FC = () => {
  const { user } = useAuth();

  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'PENDING' | 'HISTORY'>('PENDING');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal State
  const [selectedDetail, setSelectedDetail] = useState<LeaveRequest | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Approve Modal State
  const [approveItem, setApproveItem] = useState<LeaveRequest | null>(null);
  const [approvalNote, setApprovalNote] = useState('');
  const [isApproving, setIsApproving] = useState(false);

  // Reject Modal State
  const [rejectItem, setRejectItem] = useState<LeaveRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  const fetchApprovals = async () => {
    setLoading(true);
    try {
      const res = await leaveService.getLeaveRequests();
      if (res.success && res.data) {
        setRequests(res.data);
      }
    } catch {
      toast.error('Không thể tải danh sách đơn cần duyệt.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, []);

  // Xử lý Phê duyệt
  const handleConfirmApprove = async () => {
    if (!approveItem) return;
    setIsApproving(true);
    try {
      const res = await leaveService.approveLeaveRequest(approveItem._id, approvalNote.trim());
      if (res.success) {
        toast.success('Đã phê duyệt đơn thành công! Hệ thống đã đồng bộ chấm công có phép.', {
          icon: '🎉',
          duration: 4000,
        });
        setApproveItem(null);
        setApprovalNote('');
        fetchApprovals();
      } else {
        toast.error(res.message || 'Lỗi khi duyệt đơn.');
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Không thể phê duyệt đơn.';
      toast.error(msg);
    } finally {
      setIsApproving(false);
    }
  };

  // Xử lý Từ chối
  const handleConfirmReject = async () => {
    if (!rejectItem) return;
    if (!rejectionReason.trim()) {
      toast.error('Lý do từ chối là bắt buộc theo quy định.');
      return;
    }

    setIsRejecting(true);
    try {
      const res = await leaveService.rejectLeaveRequest(rejectItem._id, rejectionReason.trim());
      if (res.success) {
        toast.success('Đã từ chối đơn thành công.', { icon: 'ℹ' });
        setRejectItem(null);
        setRejectionReason('');
        fetchApprovals();
      } else {
        toast.error(res.message || 'Lỗi khi từ chối đơn.');
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Không thể từ chối đơn.';
      toast.error(msg);
    } finally {
      setIsRejecting(false);
    }
  };

  // Phân loại đơn theo tab
  const pendingList = requests.filter((r) => r.status === 'PENDING');
  const historyList = requests.filter((r) => r.status !== 'PENDING');

  const currentList = activeTab === 'PENDING' ? pendingList : historyList;

  const filteredList = currentList.filter((r) => {
    const applicantName =
      typeof r.userId === 'object' && r.userId !== null ? (r.userId as User).fullName : '';
    const reasonText = r.reason || '';

    return (
      !searchTerm ||
      applicantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reasonText.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-200">
              Thẩm Quyền Cán Bộ Quản Lý
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-500">
              {user?.role === 'admin' ? 'Ban Giám Hiệu / Quản trị viên' : 'Trưởng Khoa & Bộ Môn'}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            Hộp Xét Duyệt Đơn Nghỉ Phép & Dạy Bù
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Phê duyệt hoặc từ chối các đề xuất xin nghỉ của giảng viên, tự động đồng bộ sang bảng điểm danh có phép và thông báo qua email.
          </p>
        </div>

        <button
          onClick={fetchApprovals}
          disabled={loading}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors shrink-0 flex items-center gap-2 self-start md:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Làm Mới Danh Sách
        </button>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('PENDING')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
              activeTab === 'PENDING'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Clock className="w-4 h-4" />
            Đơn Chờ Xét Duyệt
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                activeTab === 'PENDING' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {pendingList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('HISTORY')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
              activeTab === 'HISTORY'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileCheck2 className="w-4 h-4" />
            Lịch Sử Đã Xử Lý
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                activeTab === 'HISTORY' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {historyList.length}
            </span>
          </button>
        </div>

        {/* Search */}
        <div className="relative hidden sm:block">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo tên giảng viên, lý do..."
            className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-64"
          />
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200/80 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Mã đơn</th>
                <th className="px-5 py-3.5">Người nộp</th>
                <th className="px-5 py-3.5">Loại đơn</th>
                <th className="px-5 py-3.5">Thời gian xin nghỉ</th>
                <th className="px-5 py-3.5">Số ngày</th>
                <th className="px-5 py-3.5">Minh chứng</th>
                <th className="px-5 py-3.5">Trạng thái</th>
                <th className="px-5 py-3.5 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    Đang tải danh sách đơn cần duyệt...
                  </td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                    {activeTab === 'PENDING'
                      ? 'Tuyệt vời! Hiện tại không có đơn nào đang chờ xử lý.'
                      : 'Chưa có lịch sử xử lý đơn nào.'}
                  </td>
                </tr>
              ) : (
                filteredList.map((req) => {
                  const applicant =
                    typeof req.userId === 'object' && req.userId !== null
                      ? (req.userId as User)
                      : null;

                  const typeKey = (req as unknown as { type?: string }).type || req.leaveType || 'nghi_phep';
                  const typeText = LEAVE_TYPE_LABELS[typeKey] || typeKey;
                  const statusInfo = LEAVE_STATUS_MAP[req.status] || LEAVE_STATUS_MAP.PENDING;

                  const start = new Date(req.startDate);
                  const end = new Date(req.endDate);
                  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

                  const attachment =
                    (req as unknown as { attachmentUrl?: string }).attachmentUrl || req.evidenceFile;

                  // Kiểm tra xem đơn này có phải do chính người duyệt nộp hay không (chống tự duyệt)
                  const isSelfRequest = applicant && user && applicant._id === user._id;

                  return (
                    <tr key={req._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3.5 font-mono font-bold text-slate-700">
                        #{req._id.slice(-6).toUpperCase()}
                      </td>

                      {/* Người nộp */}
                      <td className="px-5 py-3.5">
                        {applicant ? (
                          <div>
                            <p className="font-bold text-slate-900">{applicant.fullName}</p>
                            <p className="text-[11px] text-slate-400 font-mono">{applicant.email}</p>
                            {isSelfRequest && (
                              <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-semibold mt-0.5 inline-block">
                                Đơn của chính bạn
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">Không rõ</span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 font-semibold text-slate-800">
                        {typeText}
                      </td>

                      <td className="px-5 py-3.5 text-slate-600 font-mono">
                        {formatDate(req.startDate)} &rarr; {formatDate(req.endDate)}
                      </td>

                      <td className="px-5 py-3.5 font-bold text-slate-800">
                        {days} ngày
                      </td>

                      <td className="px-5 py-3.5">
                        {attachment ? (
                          <a
                            href={attachment}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium"
                          >
                            <Paperclip className="w-3.5 h-3.5" />
                            Minh chứng
                          </a>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusInfo.bg} ${statusInfo.color}`}>
                          {req.status === 'APPROVED' && <CheckCircle2 className="w-3 h-3" />}
                          {req.status === 'REJECTED' && <XCircle className="w-3 h-3" />}
                          {req.status === 'PENDING' && <Clock className="w-3 h-3" />}
                          {statusInfo.label}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedDetail(req);
                              setIsDetailOpen(true);
                            }}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Xem chi tiết"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {req.status === 'PENDING' && (
                            <>
                              {/* Nút Phê Duyệt */}
                              <button
                                onClick={() => {
                                  if (isSelfRequest) {
                                    toast.error('Bạn không thể tự duyệt đơn của chính mình theo quy chế!');
                                    return;
                                  }
                                  setApproveItem(req);
                                  setApprovalNote('');
                                }}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                              >
                                Duyệt
                              </button>

                              {/* Nút Từ Chối */}
                              <button
                                onClick={() => {
                                  if (isSelfRequest) {
                                    toast.error('Bạn không thể tự xử lý đơn của chính mình!');
                                    return;
                                  }
                                  setRejectItem(req);
                                  setRejectionReason('');
                                }}
                                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                              >
                                Từ chối
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Phê Duyệt Đơn */}
      {approveItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Xác Nhận Phê Duyệt Đơn</h3>
                <p className="text-xs text-slate-500">Mã đơn: #{approveItem._id.slice(-6).toUpperCase()}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200">
              Đồng ý cho giảng viên nghỉ từ ngày <strong>{formatDate(approveItem.startDate)}</strong> đến ngày{' '}
              <strong>{formatDate(approveItem.endDate)}</strong>. Hệ thống sẽ tự động chuyển các tiết dạy tương ứng thành{' '}
              <strong className="text-blue-600">Nghỉ có phép (EXCUSED_ABSENCE)</strong>.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Ghi chú phê duyệt (Tùy chọn)
              </label>
              <textarea
                value={approvalNote}
                onChange={(e) => setApprovalNote(e.target.value)}
                placeholder="Nhập ghi chú hoặc dặn dò cho giảng viên..."
                rows={3}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setApproveItem(null)}
                disabled={isApproving}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmApprove}
                disabled={isApproving}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2"
              >
                {isApproving ? 'Đang duyệt...' : 'Xác nhận Duyệt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Từ Chối Đơn */}
      {rejectItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Từ Chối Đơn Xin Nghỉ</h3>
                <p className="text-xs text-slate-500">Mã đơn: #{rejectItem._id.slice(-6).toUpperCase()}</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
              Quy chế yêu cầu bắt buộc phải cung cấp lý do từ chối để thông báo minh bạch cho người nộp đơn.
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Lý do từ chối <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Nhập lý do cụ thể (VD: Trùng lịch thi quan trọng, thiếu văn bản minh chứng y tế hợp lệ...)"
                rows={3}
                required
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectItem(null)}
                disabled={isRejecting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={isRejecting || !rejectionReason.trim()}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2"
              >
                {isRejecting ? 'Đang xử lý...' : 'Xác nhận Từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chi Tiết Modal */}
      <LeaveDetailModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        leaveRequest={selectedDetail}
      />
    </div>
  );
};

export default LeaveApprovalsPage;
