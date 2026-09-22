
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  FileCheck2,
  FileText,
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
import UserAvatar from '../../components/common/UserAvatar';

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
    <div className="space-y-4 sm:space-y-5">
      {/* Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
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
          className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors shrink-0 flex items-center gap-2 self-start md:self-auto shadow-2xs"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          <span>Làm Mới Danh Sách</span>
        </button>
      </div>

      {/* Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
          <button
            onClick={() => setActiveTab('PENDING')}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeTab === 'PENDING'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                : 'text-slate-600 hover:bg-slate-100 bg-white sm:bg-transparent border sm:border-transparent border-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span className="truncate">Chờ Xét Duyệt</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono shrink-0 ${
                activeTab === 'PENDING' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {pendingList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('HISTORY')}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeTab === 'HISTORY'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                : 'text-slate-600 hover:bg-slate-100 bg-white sm:bg-transparent border sm:border-transparent border-slate-200'
            }`}
          >
            <FileCheck2 className="w-3.5 h-3.5" />
            <span className="truncate">Lịch Sử Xử Lý</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono shrink-0 ${
                activeTab === 'HISTORY' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {historyList.length}
            </span>
          </button>
        </div>

        {/* Search - Visible on both mobile and desktop */}
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm tên giảng viên, lý do..."
            className="w-full pl-8 pr-3 py-2 sm:py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs"
          />
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
            <p className="text-xs font-medium">Đang tải danh sách hồ sơ cần duyệt...</p>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="py-12 text-center text-slate-400 px-4">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-500" />
            <p className="text-sm font-bold text-slate-700">
              {activeTab === 'PENDING'
                ? 'Tuyệt vời! Hiện tại không có đơn nào đang chờ xử lý.'
                : 'Chưa có lịch sử xử lý đơn nào.'}
            </p>
            <p className="text-xs text-slate-400 mt-1">Các đề xuất xin nghỉ mới sẽ xuất hiện tại đây.</p>
          </div>
        ) : (
          <>
            {/* MOBILE VIEW: Danh sách thẻ card cho điện thoại */}
            <div className="block md:hidden divide-y divide-slate-100">
              {filteredList.map((req) => {
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

                const isSelfRequest = applicant && user && applicant._id === user._id;

                return (
                  <div key={req._id} className="p-4 space-y-3 hover:bg-slate-50/50 transition">
                    {/* Hàng 1: Avatar + Tên + Mã đơn + Trạng thái */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <UserAvatar
                          user={applicant || { fullName: 'CB' }}
                          src={applicant?.avatar}
                          name={applicant?.fullName || 'CB'}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs text-slate-900 truncate">
                              {applicant?.fullName || 'Không rõ'}
                            </span>
                            <span className="font-mono text-[10px] text-slate-400 font-bold">
                              #{req._id.slice(-6).toUpperCase()}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 truncate">{applicant?.email || ''}</p>
                          {isSelfRequest && (
                            <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded font-semibold mt-0.5 inline-block">
                              Đơn của chính bạn
                            </span>
                          )}
                        </div>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border shrink-0 ${statusInfo.bg} ${statusInfo.color}`}
                      >
                        {req.status === 'APPROVED' && <CheckCircle2 className="w-3 h-3" />}
                        {req.status === 'REJECTED' && <XCircle className="w-3 h-3" />}
                        {req.status === 'PENDING' && <Clock className="w-3 h-3" />}
                        {statusInfo.label}
                      </span>
                    </div>

                    {/* Hàng 2: Loại đơn + Thời gian nghỉ + Số ngày */}
                    <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800 text-[11px] bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs">
                          {typeText}
                        </span>
                        <span className="font-bold text-slate-900 text-xs font-mono">
                          {days} ngày
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{formatDate(req.startDate)} → {formatDate(req.endDate)}</span>
                        </span>
                        {attachment ? (
                          <a
                            href={attachment}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 font-medium hover:underline"
                          >
                            <Paperclip className="w-3 h-3" />
                            Minh chứng
                          </a>
                        ) : (
                          <span className="text-slate-300">Không minh chứng</span>
                        )}
                      </div>
                    </div>

                    {/* Lý do vắn tắt */}
                    {req.reason && (
                      <p className="text-xs text-slate-600 line-clamp-2 italic bg-slate-50/40 p-2 rounded-lg border border-slate-100">
                        "{req.reason}"
                      </p>
                    )}

                    {/* Hàng nút thao tác di động */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => {
                          setSelectedDetail(req);
                          setIsDetailOpen(true);
                        }}
                        className="flex-1 py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5 border border-blue-200/60 shadow-2xs"
                      >
                        <FileText className="w-3.5 h-3.5 text-blue-600" />
                        <span>Chi tiết</span>
                      </button>

                      {req.status === 'PENDING' && (
                        <>
                          <button
                            onClick={() => {
                              if (isSelfRequest) {
                                toast.error('Bạn không thể tự duyệt đơn của chính mình theo quy chế!');
                                return;
                              }
                              setApproveItem(req);
                              setApprovalNote('');
                            }}
                            className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center justify-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Duyệt</span>
                          </button>

                          <button
                            onClick={() => {
                              if (isSelfRequest) {
                                toast.error('Bạn không thể tự xử lý đơn của chính mình!');
                                return;
                              }
                              setRejectItem(req);
                              setRejectionReason('');
                            }}
                            className="flex-1 py-2 px-3 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center justify-center gap-1"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Từ chối</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* DESKTOP VIEW: Bảng dữ liệu gọn gàng, đẹp mắt */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 font-bold border-b border-slate-200/80 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="pl-5 pr-3 py-3.5 w-[100px]">Mã đơn</th>
                    <th className="px-3 py-3.5 min-w-[180px]">Người nộp</th>
                    <th className="px-3 py-3.5">Loại đơn</th>
                    <th className="px-3 py-3.5 min-w-[200px]">Thời gian nghỉ</th>
                    <th className="px-3 py-3.5 text-center w-[70px]">Số ngày</th>
                    <th className="pr-5 pl-3 py-3.5 text-right min-w-[260px]">Trạng thái & Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredList.map((req) => {
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
                      <tr key={req._id} className="hover:bg-blue-50/30 transition-colors group">
                        {/* Mã đơn */}
                        <td className="pl-5 pr-3 py-3.5">
                          <span className="font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/80 text-[11px]">
                            #{req._id.slice(-6).toUpperCase()}
                          </span>
                        </td>

                        {/* Người nộp */}
                        <td className="px-3 py-3.5">
                          {applicant ? (
                            <div className="flex items-center gap-2.5">
                              <UserAvatar
                                user={applicant || { fullName: 'CB' }}
                                src={applicant?.avatar}
                                name={applicant?.fullName || 'CB'}
                                size="sm"
                              />
                              <div className="min-w-0">
                                <p className="font-bold text-slate-900 truncate text-xs">{applicant.fullName}</p>
                                <p className="text-[11px] text-slate-400 font-mono truncate">{applicant.email}</p>
                                {isSelfRequest && (
                                  <span className="text-[9px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-bold mt-0.5 inline-block uppercase tracking-wide">
                                    Đơn của bạn
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Không rõ</span>
                          )}
                        </td>

                        {/* Loại đơn */}
                        <td className="px-3 py-3.5">
                          <span className="font-semibold text-slate-800 text-[11px] bg-slate-50 px-2 py-1 rounded-lg border border-slate-200/80 whitespace-nowrap inline-block">
                            {typeText}
                          </span>
                        </td>

                        {/* Thời gian xin nghỉ + Minh chứng */}
                        <td className="px-3 py-3.5">
                          <div className="flex flex-col gap-1">
                            <span className="text-slate-700 font-mono text-[11px] whitespace-nowrap">
                              {formatDate(req.startDate)} → {formatDate(req.endDate)}
                            </span>
                            {attachment ? (
                              <a
                                href={attachment}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium text-[10px] w-fit"
                              >
                                <Paperclip className="w-3 h-3" />
                                Có minh chứng
                              </a>
                            ) : (
                              <span className="text-slate-300 text-[10px]">Không minh chứng</span>
                            )}
                          </div>
                        </td>

                        {/* Số ngày */}
                        <td className="px-3 py-3.5 text-center">
                          <span className="font-extrabold text-slate-900 text-sm">{days}</span>
                          <span className="text-slate-400 text-[10px] block">ngày</span>
                        </td>

                        {/* Trạng thái & Thao tác (gộp) */}
                        <td className="pr-5 pl-3 py-3.5">
                          <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                            {/* Badge trạng thái */}
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border shrink-0 ${statusInfo.bg} ${statusInfo.color}`}>
                              {req.status === 'APPROVED' && <CheckCircle2 className="w-3 h-3" />}
                              {req.status === 'REJECTED' && <XCircle className="w-3 h-3" />}
                              {req.status === 'PENDING' && <Clock className="w-3 h-3" />}
                              {statusInfo.label}
                            </span>

                            {/* Nút chi tiết */}
                            <button
                              onClick={() => {
                                setSelectedDetail(req);
                                setIsDetailOpen(true);
                              }}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-semibold transition-all shrink-0"
                              title="Xem chi tiết đầy đủ đơn"
                            >
                              <FileText className="w-3.5 h-3.5 inline-block" />
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
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-lg text-[11px] font-bold transition-all shadow-sm shrink-0 inline-flex items-center gap-1"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
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
                                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-lg text-[11px] font-bold transition-all shadow-sm shrink-0 inline-flex items-center gap-1"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  Từ chối
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Modal Phê Duyệt Đơn - Chi tiết đơn hiện ra luôn */}
      {approveItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn overflow-y-auto">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full p-4 sm:p-6 space-y-4 my-auto max-h-[92vh] flex flex-col">
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-slate-900 truncate">Xác Nhận Phê Duyệt Đơn</h3>
                <p className="text-xs text-slate-500 truncate">Mã đơn: #{approveItem._id.slice(-6).toUpperCase()}</p>
              </div>
            </div>

            <div className="overflow-y-auto pr-1 space-y-4 flex-1">
              {/* Chi tiết đơn hiện ra luôn trực tiếp trong hộp duyệt */}
              <div className="bg-slate-50 rounded-xl p-3.5 sm:p-4 border border-slate-200/90 space-y-3 text-xs">
                <div className="flex justify-between items-start pb-2.5 border-b border-slate-200 gap-2">
                  <div className="min-w-0">
                    <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Người nộp đơn:</span>
                    <p className="font-bold text-slate-900 text-sm mt-0.5 truncate">
                      {typeof approveItem.userId === 'object' && approveItem.userId !== null
                        ? (approveItem.userId as User).fullName
                        : 'Giảng viên / Cán bộ'}
                    </p>
                    <p className="text-slate-500 font-mono text-[11px] truncate">
                      {typeof approveItem.userId === 'object' && approveItem.userId !== null
                        ? (approveItem.userId as User).email
                        : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">Loại đơn:</span>
                    <span className="font-semibold text-slate-800 bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-xs inline-block mt-1 shadow-2xs">
                      {LEAVE_TYPE_LABELS[(approveItem as unknown as { type?: string }).type || approveItem.leaveType || ''] || 'Nghỉ phép'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-slate-700 pt-0.5 gap-1">
                  <span className="text-slate-500 font-medium">Thời gian xin nghỉ:</span>
                  <span className="font-bold font-mono text-slate-900">
                    {formatDate(approveItem.startDate)} &rarr; {formatDate(approveItem.endDate)}
                  </span>
                </div>

                <div className="pt-1">
                  <span className="text-slate-500 font-semibold block mb-1">Lý do xin nghỉ:</span>
                  <div className="p-3 bg-white rounded-xl border border-slate-200 text-slate-800 leading-relaxed font-medium text-xs break-words">
                    {approveItem.reason || 'Không ghi rõ lý do'}
                  </div>
                </div>

                {((approveItem as unknown as { attachmentUrl?: string }).attachmentUrl || approveItem.evidenceFile) && (
                  <div className="pt-1">
                    <a
                      href={(approveItem as unknown as { attachmentUrl?: string }).attachmentUrl || approveItem.evidenceFile}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 font-semibold text-xs"
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                      Xem minh chứng đính kèm (Mở tab mới)
                    </a>
                  </div>
                )}
              </div>

              <p className="text-xs text-slate-600 leading-relaxed bg-emerald-50/60 p-3 rounded-xl border border-emerald-200/80">
                💡 Hệ thống sẽ tự động chuyển các tiết dạy tương ứng thành{' '}
                <strong className="text-emerald-700">Nghỉ có phép (EXCUSED_ABSENCE)</strong> và đồng bộ chấm công.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Ghi chú phê duyệt (Tùy chọn)
                </label>
                <textarea
                  value={approvalNote}
                  onChange={(e) => setApprovalNote(e.target.value)}
                  placeholder="Nhập ghi chú hoặc dặn dò cho giảng viên..."
                  rows={2}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setApproveItem(null)}
                disabled={isApproving}
                className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors text-center"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmApprove}
                disabled={isApproving}
                className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
              >
                {isApproving ? 'Đang duyệt...' : 'Xác nhận Duyệt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Từ Chối Đơn - Chi tiết đơn hiện ra luôn */}
      {rejectItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn overflow-y-auto">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full p-4 sm:p-6 space-y-4 my-auto max-h-[92vh] flex flex-col">
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-slate-900 truncate">Từ Chối Đơn Xin Nghỉ</h3>
                <p className="text-xs text-slate-500 truncate">Mã đơn: #{rejectItem._id.slice(-6).toUpperCase()}</p>
              </div>
            </div>

            <div className="overflow-y-auto pr-1 space-y-4 flex-1">
              {/* Chi tiết đơn hiện ra luôn trực tiếp */}
              <div className="bg-slate-50 rounded-xl p-3.5 sm:p-4 border border-slate-200/90 space-y-3 text-xs">
                <div className="flex justify-between items-start pb-2.5 border-b border-slate-200 gap-2">
                  <div className="min-w-0">
                    <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Người nộp đơn:</span>
                    <p className="font-bold text-slate-900 text-sm mt-0.5 truncate">
                      {typeof rejectItem.userId === 'object' && rejectItem.userId !== null
                        ? (rejectItem.userId as User).fullName
                        : 'Giảng viên / Cán bộ'}
                    </p>
                    <p className="text-slate-500 font-mono text-[11px] truncate">
                      {typeof rejectItem.userId === 'object' && rejectItem.userId !== null
                        ? (rejectItem.userId as User).email
                        : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">Loại đơn:</span>
                    <span className="font-semibold text-slate-800 bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-xs inline-block mt-1 shadow-2xs">
                      {LEAVE_TYPE_LABELS[(rejectItem as unknown as { type?: string }).type || rejectItem.leaveType || ''] || 'Nghỉ phép'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-slate-700 pt-0.5 gap-1">
                  <span className="text-slate-500 font-medium">Thời gian xin nghỉ:</span>
                  <span className="font-bold font-mono text-slate-900">
                    {formatDate(rejectItem.startDate)} &rarr; {formatDate(rejectItem.endDate)}
                  </span>
                </div>

                <div className="pt-1">
                  <span className="text-slate-500 font-semibold block mb-1">Lý do xin nghỉ:</span>
                  <div className="p-3 bg-white rounded-xl border border-slate-200 text-slate-800 leading-relaxed font-medium text-xs break-words">
                    {rejectItem.reason || 'Không ghi rõ lý do'}
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 leading-relaxed">
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
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-colors"
                />
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setRejectItem(null)}
                disabled={isRejecting}
                className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors text-center"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={isRejecting || !rejectionReason.trim()}
                className="w-full sm:w-auto px-5 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
              >
                {isRejecting ? 'Đang xử lý...' : 'Xác nhận Từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chi Tiết Modal Bao Gồm Tất Cả */}
      <LeaveDetailModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        leaveRequest={selectedDetail}
        onApprove={(req) => {
          setApproveItem(req);
          setApprovalNote('');
        }}
        onReject={(req) => {
          setRejectItem(req);
          setRejectionReason('');
        }}
      />
    </div>
  );
};

export default LeaveApprovalsPage;
