import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  Eye,
  FilePlus2,
  FileText,
  Paperclip,
  RefreshCw,
  Search,
  XCircle,
} from 'lucide-react';
import leaveService from '../../services/leave.service';
import { LeaveRequest } from '../../types';
import { formatDate, LEAVE_STATUS_MAP } from '../../utils';
import LeaveBalanceCard from '../../components/leave/LeaveBalanceCard';
import LeaveDetailModal from '../../components/leave/LeaveDetailModal';

const LEAVE_TYPE_LABELS: Record<string, string> = {
  nghi_phep: 'Nghỉ phép thường',
  day_bu: 'Đăng ký dạy bù',
  doi_ca: 'Xin đổi ca làm việc',
};

export const MyLeaveRequestsPage: React.FC = () => {
  const navigate = useNavigate();

  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const fetchMyRequests = async () => {
    setLoading(true);
    try {
      const res = await leaveService.getLeaveRequests();
      if (res.success && res.data) {
        setRequests(res.data);
      }
    } catch {
      // Bỏ qua lỗi hiển thị danh sách rỗng
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyRequests();
  }, []);

  const handleOpenDetail = (item: LeaveRequest) => {
    setSelectedRequest(item);
    setIsModalOpen(true);
  };

  // Lọc danh sách
  const filteredRequests = requests.filter((r) => {
    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
    const rType = (r as unknown as { type?: string }).type || r.leaveType;
    const matchesType = typeFilter === 'ALL' || rType === typeFilter;
    const matchesSearch =
      !searchTerm ||
      r.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r._id && r._id.toLowerCase().includes(searchTerm.toLowerCase()));

    return matchesStatus && matchesType && matchesSearch;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
              Quản Lý Đơn Từ
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-500">Lịch sử & tiến độ phê duyệt</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            Danh Sách Đơn Xin Nghỉ Của Tôi
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Theo dõi tình trạng xét duyệt đơn nghỉ phép, dạy bù, đổi ca và tra cứu lý do từ chối.
          </p>
        </div>

        <button
          onClick={() => navigate('/leave/create')}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-sm shadow-blue-500/20 transition-all flex items-center gap-2 shrink-0"
        >
          <FilePlus2 className="w-4 h-4" />
          Tạo Đơn Mới
        </button>
      </div>

      {/* Leave Balance Widget (Task 4) */}
      <LeaveBalanceCard />

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {/* Filters Bar */}
        <div className="p-4 border-b border-slate-200/80 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm theo lý do..."
                className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-48 sm:w-60"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="PENDING">Chờ duyệt (PENDING)</option>
              <option value="APPROVED">Đã duyệt (APPROVED)</option>
              <option value="REJECTED">Bị từ chối (REJECTED)</option>
            </select>

            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="ALL">Tất cả loại đơn</option>
              <option value="nghi_phep">Nghỉ phép thường</option>
              <option value="day_bu">Đăng ký dạy bù</option>
              <option value="doi_ca">Xin đổi ca dạy</option>
            </select>
          </div>

          <button
            onClick={fetchMyRequests}
            disabled={loading}
            className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5 self-start md:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200/80 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Mã đơn</th>
                <th className="px-5 py-3.5">Loại đơn</th>
                <th className="px-5 py-3.5">Thời gian nghỉ</th>
                <th className="px-5 py-3.5">Số ngày</th>
                <th className="px-5 py-3.5">Lý do</th>
                <th className="px-5 py-3.5">Minh chứng</th>
                <th className="px-5 py-3.5">Trạng thái</th>
                <th className="px-5 py-3.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    Đang tải danh sách đơn...
                  </td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    Không tìm thấy đơn nào phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => {
                  const typeKey = (req as unknown as { type?: string }).type || req.leaveType || 'nghi_phep';
                  const typeText = LEAVE_TYPE_LABELS[typeKey] || typeKey;
                  const statusInfo = LEAVE_STATUS_MAP[req.status] || LEAVE_STATUS_MAP.PENDING;

                  const start = new Date(req.startDate);
                  const end = new Date(req.endDate);
                  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

                  const attachment =
                    (req as unknown as { attachmentUrl?: string }).attachmentUrl || req.evidenceFile;

                  return (
                    <tr key={req._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3.5 font-mono font-bold text-slate-700">
                        #{req._id.slice(-6).toUpperCase()}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-semibold text-slate-900">{typeText}</span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 font-mono">
                        {formatDate(req.startDate)} &rarr; {formatDate(req.endDate)}
                      </td>
                      <td className="px-5 py-3.5 font-bold text-slate-800">
                        {days} ngày
                      </td>
                      <td className="px-5 py-3.5 max-w-xs truncate text-slate-600">
                        {req.reason}
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
                            Xem file
                          </a>
                        ) : (
                          <span className="text-slate-300 text-[11px]">-</span>
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
                        <button
                          onClick={() => handleOpenDetail(req)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Chi tiết
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      <LeaveDetailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        leaveRequest={selectedRequest}
      />
    </div>
  );
};

export default MyLeaveRequestsPage;
