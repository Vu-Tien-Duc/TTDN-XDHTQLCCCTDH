import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Calendar,
  CheckCircle2,
  Clock,
  FilePlus2,
  FileText,
  Paperclip,
  RefreshCw,
  Search,
  XCircle,
  X,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  BookOpen,
  ArrowLeftRight,
  ShieldAlert,
  Sparkles,
  Filter,
  ArrowRight,
  Inbox,
} from 'lucide-react';
import leaveService from '../../services/leave.service';
import { LeaveRequest } from '../../types';
import { formatDate, LEAVE_STATUS_MAP, getSafeMediaUrl } from '../../utils';
import LeaveBalanceCard from '../../components/leave/LeaveBalanceCard';
import LeaveDetailModal from '../../components/leave/LeaveDetailModal';
import { useAuth } from '../../contexts/AuthContext';

const LEAVE_TYPE_CONFIG: Record<
  string,
  { label: string; badgeBg: string; badgeText: string; icon: React.ComponentType<{ className?: string }> }
> = {
  nghi_phep: {
    label: 'Nghỉ phép thường',
    badgeBg: 'bg-blue-50 border-blue-200 text-blue-700',
    badgeText: 'text-blue-700',
    icon: Calendar,
  },
  day_bu: {
    label: 'Đăng ký dạy bù',
    badgeBg: 'bg-purple-50 border-purple-200 text-purple-700',
    badgeText: 'text-purple-700',
    icon: BookOpen,
  },
  doi_ca: {
    label: 'Xin đổi ca làm việc',
    badgeBg: 'bg-amber-50 border-amber-200 text-amber-700',
    badgeText: 'text-amber-700',
    icon: ArrowLeftRight,
  },
};

export const MyLeaveRequestsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Quản trị viên (Admin) không áp dụng xem đơn cá nhân, chuyển hướng về Hộp duyệt đơn
  useEffect(() => {
    if (user?.role === 'admin') {
      toast('Quản trị viên giữ quyền phê duyệt, xem danh sách đơn tại Hộp Duyệt Đơn.', {
        icon: 'ℹ',
        id: 'admin-my-leaves-redirect',
      });
      navigate('/leave/approvals', { replace: true });
    }
  }, [user, navigate]);

  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');

  // Phân trang
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

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
      toast.error('Không thể tải danh sách đơn xin nghỉ.');
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

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(`Đã sao chép mã #${code}`, { id: 'copy-code', duration: 1500 });
  };

  // Tính thống kê nhanh theo trạng thái
  const metrics = useMemo(() => {
    const total = requests.length;
    const pending = requests.filter((r) => r.status === 'PENDING').length;
    const approved = requests.filter((r) => r.status === 'APPROVED').length;
    const rejected = requests.filter((r) => r.status === 'REJECTED').length;
    return { total, pending, approved, rejected };
  }, [requests]);

  // Lọc và sắp xếp danh sách
  const filteredRequests = useMemo(() => {
    const searchLower = searchTerm.trim().toLowerCase();

    const filtered = requests.filter((r) => {
      const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
      const rType = r.type || r.leaveType || 'nghi_phep';
      const matchesType = typeFilter === 'ALL' || rType === typeFilter;
      const reasonLower = (r.reason || '').toLowerCase();
      const idLower = (r._id || '').toLowerCase();
      const matchesSearch =
        !searchLower ||
        reasonLower.includes(searchLower) ||
        idLower.includes(searchLower);

      return matchesStatus && matchesType && matchesSearch;
    });

    return filtered.sort((a, b) => {
      const dateA = new Date(a.createdAt || a.startDate).getTime();
      const dateB = new Date(b.createdAt || b.startDate).getTime();
      return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
    });
  }, [requests, statusFilter, typeFilter, searchTerm, sortBy]);

  // Phân trang dữ liệu
  const totalPages = Math.ceil(filteredRequests.length / pageSize) || 1;
  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRequests.slice(start, start + pageSize);
  }, [filteredRequests, currentPage, pageSize]);

  // Reset trang về 1 khi đổi bộ lọc
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, typeFilter, searchTerm, sortBy]);

  const hasActiveFilters = statusFilter !== 'ALL' || typeFilter !== 'ALL' || searchTerm.trim() !== '';

  const clearFilters = () => {
    setStatusFilter('ALL');
    setTypeFilter('ALL');
    setSearchTerm('');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5 sm:space-y-6 pb-8">
      {/* 1. Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-950 rounded-2xl sm:rounded-3xl p-5 sm:p-7 text-white shadow-xl border border-indigo-800/40">
        {/* Glow ambient background accents */}
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 -translate-y-8 w-48 h-48 bg-indigo-500/15 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-200 text-xs font-semibold border border-blue-400/25 backdrop-blur-xs">
              <Sparkles className="w-3.5 h-3.5 text-blue-300" />
              <span>Phân Hệ Cán Bộ & Giảng Viên</span>
              <span className="text-blue-400">•</span>
              <span className="text-blue-200">Quản Lý Đơn Nghỉ</span>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-white">
              Đơn Xin Nghỉ Của Tôi
            </h1>
            <p className="text-xs sm:text-sm text-slate-300/90 max-w-2xl leading-relaxed">
              Theo dõi tiến độ xét duyệt đơn nghỉ phép thường, đăng ký dạy bù và xin đổi ca làm việc theo thời gian thực.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-start md:self-auto">
            <button
              onClick={fetchMyRequests}
              disabled={loading}
              title="Làm mới dữ liệu"
              className="px-3.5 py-2.5 bg-white/10 hover:bg-white/15 active:scale-95 text-white text-xs font-semibold rounded-xl border border-white/10 transition-all flex items-center gap-2 backdrop-blur-xs shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-300' : ''}`} />
              <span className="hidden sm:inline">Làm Mới</span>
            </button>

            <button
              onClick={() => navigate('/leave/create')}
              className="px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 active:scale-95 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-blue-500/25 transition-all flex items-center gap-2 border border-blue-400/30"
            >
              <FilePlus2 className="w-4 h-4" />
              <span>+ Tạo Đơn Mới</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Quỹ phép năm (Leave Balance Card) */}
      <LeaveBalanceCard />

      {/* 3. Quick Status Filter Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: Tất cả đơn */}
        <button
          onClick={() => setStatusFilter('ALL')}
          className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all relative overflow-hidden group ${
            statusFilter === 'ALL'
              ? 'bg-blue-50/80 border-blue-300 shadow-sm ring-2 ring-blue-500/20'
              : 'bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/60 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Tất Cả Hồ Sơ
            </span>
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                statusFilter === 'ALL' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
              }`}
            >
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900">{metrics.total}</span>
            <span className="text-xs text-slate-400 font-medium">đơn</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 truncate">Toàn bộ lịch sử nộp đơn</p>
        </button>

        {/* Metric 2: Chờ xét duyệt */}
        <button
          onClick={() => setStatusFilter('PENDING')}
          className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all relative overflow-hidden group ${
            statusFilter === 'PENDING'
              ? 'bg-amber-50/80 border-amber-300 shadow-sm ring-2 ring-amber-500/20'
              : 'bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/60 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
              Chờ Xét Duyệt
            </span>
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                statusFilter === 'PENDING'
                  ? 'bg-amber-500 text-white'
                  : 'bg-amber-100 text-amber-700 group-hover:bg-amber-200'
              }`}
            >
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-amber-600">{metrics.pending}</span>
            <span className="text-xs text-amber-700 font-medium">đang chờ</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 truncate">Chờ Trưởng khoa / BGH duyệt</p>
        </button>

        {/* Metric 3: Đã phê duyệt */}
        <button
          onClick={() => setStatusFilter('APPROVED')}
          className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all relative overflow-hidden group ${
            statusFilter === 'APPROVED'
              ? 'bg-emerald-50/80 border-emerald-300 shadow-sm ring-2 ring-emerald-500/20'
              : 'bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/60 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
              Đã Phê Duyệt
            </span>
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                statusFilter === 'APPROVED'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-100 text-emerald-700 group-hover:bg-emerald-200'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-emerald-600">{metrics.approved}</span>
            <span className="text-xs text-emerald-700 font-medium">hợp lệ</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 truncate">Đã ghi nhận có phép</p>
        </button>

        {/* Metric 4: Bị từ chối */}
        <button
          onClick={() => setStatusFilter('REJECTED')}
          className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all relative overflow-hidden group ${
            statusFilter === 'REJECTED'
              ? 'bg-rose-50/80 border-rose-300 shadow-sm ring-2 ring-rose-500/20'
              : 'bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/60 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">
              Bị Từ Chối
            </span>
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                statusFilter === 'REJECTED'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-100 text-rose-700 group-hover:bg-rose-200'
              }`}
            >
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-rose-600">{metrics.rejected}</span>
            <span className="text-xs text-rose-700 font-medium">từ chối</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 truncate">Xem lý do & chỉnh sửa nộp lại</p>
        </button>
      </div>

      {/* 4. Main Container: Filters & Table/Cards */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
        {/* Filters & Search Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-200/80 bg-slate-50/60 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm theo lý do, mã đơn (#...)..."
                className="w-full pl-9 pr-9 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
              {/* Type Filter */}
              <div className="relative">
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="pl-3 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none shadow-2xs cursor-pointer"
                >
                  <option value="ALL">Tất cả loại đơn</option>
                  <option value="nghi_phep">Nghỉ phép thường</option>
                  <option value="day_bu">Đăng ký dạy bù</option>
                  <option value="doi_ca">Xin đổi ca làm việc</option>
                </select>
                <Filter className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Status Filter Dropdown (in addition to cards) */}
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="pl-3 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none shadow-2xs cursor-pointer"
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="PENDING">Chờ xét duyệt (PENDING)</option>
                  <option value="APPROVED">Đã phê duyệt (APPROVED)</option>
                  <option value="REJECTED">Bị từ chối (REJECTED)</option>
                </select>
                <Clock className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Sort by Date */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest')}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs cursor-pointer"
              >
                <option value="newest">Mới nhất trước</option>
                <option value="oldest">Cũ nhất trước</option>
              </select>

              {/* Clear filters button if active */}
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="px-3 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-200 transition-colors flex items-center gap-1.5"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Xóa lọc</span>
                </button>
              )}
            </div>
          </div>

          {/* Active summary label */}
          <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
            <div className="flex items-center gap-2">
              <span>
                Hiển thị <strong className="text-slate-800 font-bold">{filteredRequests.length}</strong> / {requests.length} hồ sơ
              </span>
              {hasActiveFilters && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[11px] font-semibold border border-blue-200">
                  Đang lọc kết quả
                </span>
              )}
            </div>
            {filteredRequests.length > 0 && (
              <span className="text-[11px] text-slate-400">
                Trang {currentPage} / {totalPages}
              </span>
            )}
          </div>
        </div>

        {/* 5. List Content Area */}
        {loading ? (
          <div className="py-16 text-center text-slate-400 space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600" />
            <p className="text-xs sm:text-sm font-semibold text-slate-600">Đang tải danh sách đơn của bạn...</p>
            <p className="text-xs text-slate-400">Vui lòng chờ trong giây lát</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="py-16 px-4 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto shadow-inner">
              <Inbox className="w-8 h-8 text-slate-400" />
            </div>
            <div className="max-w-md mx-auto space-y-1.5">
              <h3 className="text-base font-bold text-slate-800">
                {hasActiveFilters ? 'Không tìm thấy đơn nào phù hợp' : 'Bạn chưa có đơn xin nghỉ nào'}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {hasActiveFilters
                  ? 'Hãy thử thay đổi từ khóa tìm kiếm hoặc bỏ các điều kiện lọc trạng thái/loại đơn.'
                  : 'Hãy tạo đơn xin nghỉ phép, dạy bù hoặc đổi ca làm việc đầu tiên của bạn để gửi ban quản lý xét duyệt.'}
              </p>
            </div>
            {hasActiveFilters ? (
              <button
                onClick={clearFilters}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-xs font-bold rounded-xl transition"
              >
                Xóa Tất Cả Bộ Lọc
              </button>
            ) : (
              <button
                onClick={() => navigate('/leave/create')}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-blue-500/20 transition"
              >
                + Tạo Đơn Xin Nghỉ Đầu Tiên
              </button>
            )}
          </div>
        ) : (
          <>
            {/* VIEW A: MOBILE VIEW (Card Layout - block md:hidden) */}
            <div className="block md:hidden divide-y divide-slate-100">
              {paginatedRequests.map((req) => {
                const typeKey = req.type || req.leaveType || 'nghi_phep';
                const typeConfig = LEAVE_TYPE_CONFIG[typeKey] || LEAVE_TYPE_CONFIG.nghi_phep;
                const TypeIcon = typeConfig.icon;
                const statusInfo = LEAVE_STATUS_MAP[req.status] || LEAVE_STATUS_MAP.PENDING;

                // Tính toán ngày nghỉ
                const start = new Date(req.startDate);
                const end = new Date(req.endDate);
                const sUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
                const eUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
                const days = Math.round((eUtc - sUtc) / (1000 * 60 * 60 * 24)) + 1;
                const displayDays = Number.isNaN(days) || days < 1 ? 1 : days;

                const rawAttachment = req.attachmentUrl || req.evidenceFile;
                const attachment = getSafeMediaUrl(rawAttachment);
                const shortCode = req._id ? req._id.slice(-6).toUpperCase() : 'N/A';

                return (
                  <div
                    key={req._id}
                    className="p-4 space-y-3 hover:bg-slate-50/70 transition-colors"
                  >
                    {/* Header: Loại đơn + Mã đơn + Trạng thái */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${typeConfig.badgeBg}`}
                        >
                          <TypeIcon className="w-3.5 h-3.5" />
                          <span>{typeConfig.label}</span>
                        </span>
                        <button
                          onClick={() => handleCopyCode(shortCode)}
                          className="font-mono text-[11px] font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-md flex items-center gap-1 transition"
                          title="Bấm để sao chép mã"
                        >
                          #{shortCode}
                          <Copy className="w-2.5 h-2.5 text-slate-400" />
                        </button>
                      </div>

                      {/* Trạng thái */}
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border shrink-0 ${statusInfo.bg} ${statusInfo.color}`}
                      >
                        {req.status === 'APPROVED' && <CheckCircle2 className="w-3 h-3" />}
                        {req.status === 'REJECTED' && <XCircle className="w-3 h-3" />}
                        {req.status === 'PENDING' && <Clock className="w-3 h-3" />}
                        <span>{statusInfo.label}</span>
                      </span>
                    </div>

                    {/* Thời gian & Số ngày */}
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[10px] text-slate-400 font-medium">Khoảng thời gian</p>
                          <p className="text-xs font-bold text-slate-800 truncate">
                            {formatDate(req.startDate)} &rarr; {formatDate(req.endDate)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                        <span className="text-[10px] text-slate-400 block font-medium">Thời lượng</span>
                        <span className="text-xs font-black text-blue-700">{displayDays} ngày</span>
                      </div>
                    </div>

                    {/* Lý do */}
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        Lý do / Nội dung:
                      </span>
                      <p className="text-xs text-slate-700 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100 line-clamp-2 leading-relaxed">
                        {req.reason || 'Không ghi rõ lý do'}
                      </p>
                    </div>

                    {/* Cảnh báo lý do từ chối nếu có */}
                    {req.status === 'REJECTED' && req.rejectionReason && (
                      <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-rose-900">
                          <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          <span>Lý do từ chối:</span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-rose-800 pl-5">
                          {req.rejectionReason}
                        </p>
                      </div>
                    )}

                    {/* Ghi chú phê duyệt nếu có */}
                    {req.status === 'APPROVED' && req.approvalNote && (
                      <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Ghi chú phê duyệt:</span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-emerald-800 pl-5">
                          {req.approvalNote}
                        </p>
                      </div>
                    )}

                    {/* Footer: Minh chứng & Nút xem chi tiết */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                      <div className="text-[11px]">
                        {attachment ? (
                          <a
                            href={attachment}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 font-semibold bg-blue-50 px-2 py-1 rounded-lg border border-blue-200/60"
                          >
                            <Paperclip className="w-3 h-3" />
                            <span>File minh chứng</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Không có file</span>
                        )}
                      </div>

                      <button
                        onClick={() => handleOpenDetail(req)}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs font-bold rounded-xl transition flex items-center gap-1 shadow-xs"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Xem Chi Tiết</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* VIEW B: DESKTOP VIEW (Table Layout - hidden md:block) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 font-bold border-b border-slate-200/80 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-5 py-4">Mã Đơn</th>
                    <th className="px-5 py-4">Loại Đơn</th>
                    <th className="px-5 py-4">Thời Gian Nghỉ</th>
                    <th className="px-5 py-4 text-center">Số Ngày</th>
                    <th className="px-5 py-4">Lý Do Đề Xuất</th>
                    <th className="px-5 py-4 text-center">Minh Chứng</th>
                    <th className="px-5 py-4 text-center">Trạng Thái</th>
                    <th className="px-5 py-4 text-right">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedRequests.map((req) => {
                    const typeKey = req.type || req.leaveType || 'nghi_phep';
                    const typeConfig = LEAVE_TYPE_CONFIG[typeKey] || LEAVE_TYPE_CONFIG.nghi_phep;
                    const TypeIcon = typeConfig.icon;
                    const statusInfo = LEAVE_STATUS_MAP[req.status] || LEAVE_STATUS_MAP.PENDING;

                    const start = new Date(req.startDate);
                    const end = new Date(req.endDate);
                    const sUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
                    const eUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
                    const days = Math.round((eUtc - sUtc) / (1000 * 60 * 60 * 24)) + 1;
                    const displayDays = Number.isNaN(days) || days < 1 ? 1 : days;

                    const rawAttachment = req.attachmentUrl || req.evidenceFile;
                    const attachment = getSafeMediaUrl(rawAttachment);
                    const shortCode = req._id ? req._id.slice(-6).toUpperCase() : 'N/A';

                    return (
                      <tr
                        key={req._id}
                        className="hover:bg-slate-50/90 transition-colors group cursor-pointer"
                        onClick={() => handleOpenDetail(req)}
                      >
                        {/* Mã đơn */}
                        <td className="px-5 py-4 font-mono font-bold text-slate-700 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[11px] group-hover:bg-blue-50 group-hover:text-blue-700 transition-colors">
                              #{shortCode}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyCode(shortCode);
                              }}
                              className="text-slate-400 hover:text-slate-700 p-1 rounded transition opacity-0 group-hover:opacity-100"
                              title="Sao chép mã đơn"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </td>

                        {/* Loại đơn */}
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold text-xs border ${typeConfig.badgeBg}`}
                          >
                            <TypeIcon className="w-3.5 h-3.5" />
                            <span>{typeConfig.label}</span>
                          </span>
                        </td>

                        {/* Khoảng thời gian */}
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 font-mono text-slate-700 font-semibold text-xs">
                            <span>{formatDate(req.startDate)}</span>
                            <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{formatDate(req.endDate)}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Nộp ngày {formatDate(req.createdAt)}
                          </p>
                        </td>

                        {/* Số ngày */}
                        <td className="px-5 py-4 text-center whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-50 text-blue-800 border border-blue-200">
                            {displayDays} ngày
                          </span>
                        </td>

                        {/* Lý do */}
                        <td className="px-5 py-4 max-w-xs">
                          <p className="text-slate-700 truncate font-medium text-xs" title={req.reason}>
                            {req.reason || 'Không ghi rõ lý do'}
                          </p>
                          {req.status === 'REJECTED' && req.rejectionReason && (
                            <p className="text-[11px] text-rose-600 truncate mt-0.5 font-medium" title={req.rejectionReason}>
                              Từ chối: {req.rejectionReason}
                            </p>
                          )}
                        </td>

                        {/* Minh chứng */}
                        <td className="px-5 py-4 text-center whitespace-nowrap">
                          {attachment ? (
                            <a
                              href={attachment}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-200 transition-colors"
                              title="Mở file minh chứng trong tab mới"
                            >
                              <Paperclip className="w-3 h-3" />
                              <span>Xem file</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          ) : (
                            <span className="text-slate-300 text-xs">-</span>
                          )}
                        </td>

                        {/* Trạng thái */}
                        <td className="px-5 py-4 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border ${statusInfo.bg} ${statusInfo.color}`}
                          >
                            {req.status === 'APPROVED' && <CheckCircle2 className="w-3 h-3" />}
                            {req.status === 'REJECTED' && <XCircle className="w-3 h-3" />}
                            {req.status === 'PENDING' && <Clock className="w-3 h-3" />}
                            <span>{statusInfo.label}</span>
                          </span>
                        </td>

                        {/* Thao tác */}
                        <td className="px-5 py-4 text-right whitespace-nowrap">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDetail(req);
                            }}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-blue-600 text-slate-700 hover:text-white rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5 shadow-2xs"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Chi tiết</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="px-4 sm:px-6 py-4 border-t border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                  Hiển thị từ{' '}
                  <strong className="text-slate-800">{(currentPage - 1) * pageSize + 1}</strong> đến{' '}
                  <strong className="text-slate-800">
                    {Math.min(currentPage * pageSize, filteredRequests.length)}
                  </strong>{' '}
                  trong tổng số <strong className="text-slate-800">{filteredRequests.length}</strong> đơn
                </p>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    title="Trang trước"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {Array.from({ length: totalPages }).map((_, idx) => {
                    const pageNum = idx + 1;
                    // Chỉ hiển thị các trang lân cận nếu quá nhiều trang
                    if (
                      totalPages > 7 &&
                      Math.abs(pageNum - currentPage) > 2 &&
                      pageNum !== 1 &&
                      pageNum !== totalPages
                    ) {
                      if (Math.abs(pageNum - currentPage) === 3) {
                        return (
                          <span key={pageNum} className="px-1 text-slate-400 text-xs">
                            ...
                          </span>
                        );
                      }
                      return null;
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-8 h-8 rounded-xl text-xs font-bold transition ${
                          currentPage === pageNum
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    title="Trang tiếp theo"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 6. Chi tiết đơn Modal */}
      <LeaveDetailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        leaveRequest={selectedRequest}
      />
    </div>
  );
};

export default MyLeaveRequestsPage;
