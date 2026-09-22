import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import {
  Users,
  Search,
  Plus,
  Edit2,
  Trash2,
  UserCheck,
  UserX,
  Building2,
  Filter,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Lock,
  Mail,
  Award,
  ChevronLeft,
  ChevronRight,
  Camera,
  X,
  RotateCcw,
  Sparkles,
  GraduationCap,
  Shield,
  Briefcase,
} from 'lucide-react';
import { Department, Role, User as UserType } from '../../types';
import { userService, CreateUserPayload, UpdateUserPayload } from '../../services/userService';
import { departmentService } from '../../services/departmentService';
import { useAuth } from '../../contexts/AuthContext';
import { UserAvatar } from '../../components';

export const UsersPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const isDean = currentUser?.role === 'truongkhoa';

  const [users, setUsers] = useState<UserType[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Bộ lọc
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedDept, setSelectedDept] = useState<string>('all');

  // Phân trang Server-side
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);

  const generateSecurePassword = () => {
    const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowers = 'abcdefghijkmnpqrstuvwxyz';
    const numbers = '23456789';
    const specials = '!@#$%&*';
    const allChars = uppers + lowers + numbers + specials;
    const pwd = [
      uppers[Math.floor(Math.random() * uppers.length)],
      lowers[Math.floor(Math.random() * lowers.length)],
      numbers[Math.floor(Math.random() * numbers.length)],
      specials[Math.floor(Math.random() * specials.length)],
    ];
    for (let i = 0; i < 6; i++) {
      pwd.push(allChars[Math.floor(Math.random() * allChars.length)]);
    }
    return pwd.sort(() => 0.5 - Math.random()).join('');
  };

  // Modal Thêm người dùng (Chỉ Admin)
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createFormData, setCreateFormData] = useState<CreateUserPayload>({
    fullName: '',
    email: '',
    password: '',
    role: 'giangvien',
    departmentId: '',
    annualLeaveQuota: 12,
  });

  // Modal Chỉnh sửa người dùng
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [editFormData, setEditFormData] = useState<UpdateUserPayload>({
    fullName: '',
    departmentId: '',
    role: 'giangvien',
    isActive: true,
    annualLeaveQuota: 12,
  });

  // Modal Xóa mềm / Khóa tài khoản (Chỉ Admin)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserType | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Tải danh sách phòng ban
  const fetchDepartments = useCallback(async () => {
    try {
      const depts = await departmentService.getAllDepartments();
      setDepartments(depts || []);
    } catch {
      // Bỏ qua lỗi nạp phòng ban
    }
  }, []);

  // Tải danh sách người dùng phân trang từ Server
  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      const params: { role?: Role; departmentId?: string; search?: string; page: number; limit: number } = {
        page: currentPage,
        limit: pageSize,
      };
      if (selectedRole !== 'all') params.role = selectedRole as Role;
      if (selectedDept !== 'all' && isAdmin) params.departmentId = selectedDept;
      if (search.trim()) params.search = search.trim();

      const result = await userService.getUsersPaginated(params);
      if (result && Array.isArray(result.records)) {
        setUsers(result.records);
        setTotalPages(result.totalPages || 1);
        setTotalUsers(result.total || result.records.length);
      } else if (Array.isArray(result)) {
        setUsers(result);
        setTotalPages(1);
        setTotalUsers(result.length);
      }
    } catch (err) {
      console.error('[UsersPage] Lỗi tải người dùng:', err);
      toast.error('Không thể tải danh sách cán bộ / giảng viên.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedRole, selectedDept, search, isAdmin, currentPage, pageSize]);

  // Reset về trang 1 khi thay đổi bộ lọc tìm kiếm
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedRole, selectedDept, search]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Mở Modal Tạo mới (Admin)
  const handleOpenCreateModal = () => {
    setCreateFormData({
      fullName: '',
      email: '',
      password: generateSecurePassword(),
      role: 'giangvien',
      departmentId: departments[0]?._id || '',
      annualLeaveQuota: 12,
    });
    setCreateModalOpen(true);
  };

  // Submit Tạo người dùng
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!createFormData.fullName.trim() || !createFormData.email.trim() || !createFormData.password) {
      toast.error('Vui lòng điền đầy đủ họ tên, email và mật khẩu.');
      return;
    }

    if (!createFormData.departmentId) {
      toast.error('Vui lòng chọn Khoa / Đơn vị trực thuộc.');
      return;
    }

    if (createFormData.role === 'admin') {
      toast.error('Không thể bổ nhiệm quyền Quản trị viên từ màn hình quản lý cán bộ.');
      return;
    }

    try {
      setIsSubmitting(true);
      await userService.createUser(createFormData);
      toast.success(`Đã thêm cán bộ "${createFormData.fullName}" thành công!`);
      setCreateModalOpen(false);
      fetchUsers();
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string } } };
      toast.error(apiErr.response?.data?.message || 'Không thể tạo người dùng mới.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mở Modal Chỉnh sửa
  const handleOpenEditModal = (u: UserType) => {
    setEditingUser(u);
    const deptId =
      u.departmentId && typeof u.departmentId === 'object'
        ? u.departmentId._id
        : (u.departmentId as string) || '';

    setEditFormData({
      fullName: u.fullName,
      departmentId: deptId,
      role: u.role,
      isActive: u.isActive !== undefined ? u.isActive : true,
      annualLeaveQuota: u.annualLeaveQuota || 12,
    });
    setEditModalOpen(true);
  };

  // Submit Chỉnh sửa
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      setIsSubmitting(true);

      // Nếu là Trưởng khoa, chỉ gửi các trường được phép sửa
      const payload: UpdateUserPayload = isDean
        ? {
            fullName: editFormData.fullName,
            annualLeaveQuota: editFormData.annualLeaveQuota,
          }
        : editFormData;

      await userService.updateUser(editingUser._id, payload);
      toast.success(`Cập nhật thông tin "${editFormData.fullName}" thành công!`);
      setEditModalOpen(false);
      setEditingUser(null);
      fetchUsers();
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string } } };
      toast.error(apiErr.response?.data?.message || 'Không thể cập nhật người dùng.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Xóa mềm / Khóa tài khoản
  const handleDeleteSubmit = async () => {
    if (!userToDelete) return;
    try {
      setIsSubmitting(true);
      await userService.deleteUser(userToDelete._id);
      toast.success(`Đã khóa tài khoản "${userToDelete.fullName}" thành công.`);
      setDeleteModalOpen(false);
      setUserToDelete(null);
      fetchUsers();
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string } } };
      toast.error(apiErr.response?.data?.message || 'Không thể khóa tài khoản này.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Badge vai trò
  const getRoleBadge = (role: Role) => {
    switch (role) {
      case 'admin':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-700 border border-purple-200">Quản Trị Viên</span>;
      case 'truongkhoa':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-700 border border-blue-200">Trưởng Khoa</span>;
      case 'giangvien':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">Giảng Viên</span>;
      case 'nhanvien':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700 border border-amber-200">Chuyên Viên</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">{role}</span>;
    }
  };

  // Thống kê nhanh từ danh sách
  const activeFilterCount = (search.trim() ? 1 : 0) + (selectedRole !== 'all' ? 1 : 0) + (selectedDept !== 'all' ? 1 : 0);
  const lecturerCount = users.filter((u) => u.role === 'giangvien').length;
  const activeCount = users.filter((u) => u.isActive !== false).length;
  const faceRegisteredCount = users.filter((u) => u.faceRegistered || (u as any).faceDataRegistered).length;

  const handleResetFilters = () => {
    setSearch('');
    setSelectedRole('all');
    setSelectedDept('all');
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
            <Users className="w-4 h-4" />
            <span>Nhân Sự & Giảng Viên</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Quản Lý Cán Bộ & Người Dùng
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {isAdmin
              ? 'Toàn quyền quản trị danh sách nhân sự, cấu hình vai trò và quản lý hồ sơ Face ID.'
              : 'Danh sách nhân sự thuộc quyền quản lý của Khoa trực thuộc.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-end sm:self-auto shrink-0">
          <button
            onClick={fetchUsers}
            className="p-2 sm:p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
            title="Tải lại danh sách"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {/* NÚT THÊM NGƯỜI DÙNG: Chỉ hiển thị cho Admin */}
          {isAdmin && (
            <button
              onClick={handleOpenCreateModal}
              className="flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition active:scale-98"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm Cán Bộ</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 Thẻ Thống Kê Nhanh (Responsive Grid) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 flex items-center gap-3 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 truncate">Tổng Cán Bộ</div>
            <div className="text-lg sm:text-2xl font-black text-slate-900 font-mono mt-0.5">{totalUsers}</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 flex items-center gap-3 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 truncate">Giảng Viên</div>
            <div className="text-lg sm:text-2xl font-black text-emerald-700 font-mono mt-0.5">
              {users.length > 0 ? `${lecturerCount}` : '-'}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 flex items-center gap-3 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 truncate">Hoạt Động</div>
            <div className="text-lg sm:text-2xl font-black text-indigo-700 font-mono mt-0.5">
              {users.length > 0 ? `${activeCount}` : '-'}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 flex items-center gap-3 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-200 text-violet-600 flex items-center justify-center shrink-0">
            <Camera className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 truncate">Đã Đăng Ký FaceID</div>
            <div className="text-lg sm:text-2xl font-black text-violet-700 font-mono mt-0.5">
              {users.length > 0 ? `${faceRegisteredCount}` : '-'}
            </div>
          </div>
        </div>
      </div>

      {/* Thanh Bộ Lọc & Tìm Kiếm */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Tìm kiếm */}
          <div className="relative flex-1 max-w-full md:max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo họ tên hoặc email cán bộ..."
              className="w-full pl-10 pr-9 py-2 sm:py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
                title="Xóa tìm kiếm"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Lọc theo Khoa & Nút đặt lại */}
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <div className="flex items-center gap-1.5 flex-1 sm:flex-none">
                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="w-full sm:w-auto px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[220px] truncate"
                >
                  <option value="all">Tất cả Khoa / Phòng ban</option>
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {activeFilterCount > 0 && (
              <button
                onClick={handleResetFilters}
                className="flex items-center gap-1 px-2.5 py-2 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-200 transition"
                title="Xóa tất cả bộ lọc"
              >
                <RotateCcw className="w-3 h-3" />
                <span className="hidden sm:inline">Đặt lại</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Role Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 border-t border-slate-100">
          <button
            onClick={() => setSelectedRole('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              selectedRole === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tất cả ({totalUsers || users.length})
          </button>
          <button
            onClick={() => setSelectedRole('giangvien')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              selectedRole === 'giangvien'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60'
            }`}
          >
            <GraduationCap className="w-3 h-3" />
            <span>Giảng viên</span>
          </button>
          <button
            onClick={() => setSelectedRole('truongkhoa')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              selectedRole === 'truongkhoa'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200/60'
            }`}
          >
            <Building2 className="w-3 h-3" />
            <span>Trưởng khoa</span>
          </button>
          <button
            onClick={() => setSelectedRole('nhanvien')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              selectedRole === 'nhanvien'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/60'
            }`}
          >
            <Briefcase className="w-3 h-3" />
            <span>Chuyên viên</span>
          </button>
          <button
            onClick={() => setSelectedRole('admin')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              selectedRole === 'admin'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200/60'
            }`}
          >
            <Shield className="w-3 h-3" />
            <span>Admin</span>
          </button>
        </div>
      </div>

      {/* Bảng Danh Sách Người Dùng */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <p className="text-sm text-slate-500 font-medium">Đang tải danh sách người dùng...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Users className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-700">Không tìm thấy người dùng phù hợp</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Hãy thử thay đổi từ khóa tìm kiếm hoặc bấm đặt lại bộ lọc để xem toàn bộ danh sách.
            </p>
            {activeFilterCount > 0 && (
              <button
                onClick={handleResetFilters}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Đặt lại bộ lọc</span>
              </button>
            )}
          </div>
        ) : (
          <>
            {/* GIAO DIỆN MOBILE: Card View Tách Biệt Rõ Ràng (md:hidden) */}
            <div className="md:hidden p-3.5 sm:p-4 bg-slate-50/80 space-y-3.5">
              {users.map((u) => {
                const deptName =
                  u.departmentId && typeof u.departmentId === 'object'
                    ? u.departmentId.name
                    : '-';
                const hasFace = Boolean(u.faceRegistered || (u as any).faceDataRegistered);
                const roleBorder =
                  u.role === 'admin'
                    ? 'border-purple-200/90 border-l-[5px] border-l-purple-600'
                    : u.role === 'truongkhoa'
                    ? 'border-blue-200/90 border-l-[5px] border-l-blue-600'
                    : u.role === 'giangvien'
                    ? 'border-emerald-200/90 border-l-[5px] border-l-emerald-600'
                    : 'border-amber-200/90 border-l-[5px] border-l-amber-600';

                return (
                  <div
                    key={u._id}
                    className={`p-4 rounded-2xl bg-white border shadow-xs hover:shadow-md transition-all space-y-3.5 ${roleBorder}`}
                  >
                    {/* Hàng 1: Avatar + Tên + Email + Vai trò */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <UserAvatar
                          user={u}
                          size="md"
                          showStatus
                          isActive={u.isActive !== false}
                        />
                        <div className="min-w-0">
                          <p className="font-extrabold text-slate-900 text-sm truncate leading-tight">
                            {u.fullName}
                          </p>
                          <p className="text-slate-400 text-xs font-mono truncate mt-0.5">
                            {u.email}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0">{getRoleBadge(u.role)}</div>
                    </div>

                    {/* Hàng 2: Khối thông tin Đơn vị & Thông số trạng thái */}
                    <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/80 space-y-2 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="text-slate-500 font-medium">Đơn vị:</span>
                        <span className="font-bold text-slate-800 truncate">{deptName}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-slate-200/60 text-[11px]">
                        {/* FaceID Status */}
                        {hasFace ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                            <Camera className="w-3 h-3 text-emerald-600" />
                            <span>Đã Face ID</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white text-slate-500 border border-slate-200 font-medium">
                            <Camera className="w-3 h-3 text-slate-400" />
                            <span>Chưa Face ID</span>
                          </span>
                        )}

                        {/* Quỹ phép */}
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white text-slate-600 border border-slate-200 font-medium">
                          <Award className="w-3 h-3 text-amber-500" />
                          <span>{u.annualLeaveQuota || 12} phép/năm</span>
                        </span>

                        {/* Trạng thái hoạt động */}
                        {u.isActive !== false ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                            <UserCheck className="w-3 h-3" />
                            <span>Hoạt Động</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-bold">
                            <UserX className="w-3 h-3" />
                            <span>Đã Khóa</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Hàng 3: Nút Thao Tác Mobile */}
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        onClick={() => handleOpenEditModal(u)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition shadow-2xs"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Chỉnh sửa</span>
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => {
                            setUserToDelete(u);
                            setDeleteModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition shadow-2xs"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Khóa</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* GIAO DIỆN DESKTOP: Bảng dữ liệu chuẩn (hidden md:block) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50/80 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-5">Cán Bộ / Giảng Viên</th>
                    <th className="py-3.5 px-4">Vai Trò</th>
                    <th className="py-3.5 px-4">Khoa / Đơn Vị</th>
                    <th className="py-3.5 px-4">Face ID</th>
                    <th className="py-3.5 px-4">Quỹ Phép</th>
                    <th className="py-3.5 px-4">Trạng Thái</th>
                    <th className="py-3.5 px-5 text-right">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => {
                    const deptName =
                      u.departmentId && typeof u.departmentId === 'object'
                        ? u.departmentId.name
                        : '-';
                    const hasFace = Boolean(u.faceRegistered || (u as any).faceDataRegistered);

                    return (
                      <tr key={u._id} className="hover:bg-slate-50/60 transition group">
                        {/* Avatar & Tên & Email */}
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-3">
                            <UserAvatar
                              user={u}
                              size="sm"
                              showStatus
                              isActive={u.isActive !== false}
                            />
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 text-sm leading-tight group-hover:text-blue-600 transition-colors">
                                {u.fullName}
                              </p>
                              <p className="text-slate-400 text-[11px] font-mono mt-0.5">{u.email}</p>
                            </div>
                          </div>
                        </td>

                        {/* Role */}
                        <td className="py-3.5 px-4">{getRoleBadge(u.role)}</td>

                        {/* Khoa */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[150px]">{deptName}</span>
                          </div>
                        </td>

                        {/* Face ID Status */}
                        <td className="py-3.5 px-4">
                          {hasFace ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                              <Camera className="w-3 h-3 text-emerald-600" />
                              <span>Đã Face ID</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-50 text-slate-400 border border-slate-200 text-[10px]">
                              <span>Chưa cài</span>
                            </span>
                          )}
                        </td>

                        {/* Quỹ ngày phép */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1">
                            <Award className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span className="font-bold text-slate-800 font-mono">{u.annualLeaveQuota || 12}</span>
                            <span className="text-slate-400 text-[11px]">ngày</span>
                          </div>
                        </td>

                        {/* Trạng thái hoạt động */}
                        <td className="py-3.5 px-4">
                          {u.isActive !== false ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                              <UserCheck className="w-3 h-3" />
                              <span>Hoạt Động</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold">
                              <UserX className="w-3 h-3" />
                              <span>Đã Khóa</span>
                            </span>
                          )}
                        </td>

                        {/* Thao tác */}
                        <td className="py-3.5 px-5 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => handleOpenEditModal(u)}
                              className="p-1.5 rounded-xl text-blue-600 hover:bg-blue-50 transition"
                              title={isDean ? 'Sửa hạn mức phép & họ tên' : 'Chỉnh sửa thông tin'}
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            {isAdmin && (
                              <button
                                onClick={() => {
                                  setUserToDelete(u);
                                  setDeleteModalOpen(true);
                                }}
                                className="p-1.5 rounded-xl text-rose-600 hover:bg-rose-50 transition"
                                title="Khóa tài khoản (Soft delete)"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Thanh Phân Trang Server-side (Responsive) */}
            <div className="p-3.5 sm:p-4 border-t border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
              <div className="text-center sm:text-left">
                Hiển thị <span className="font-semibold text-slate-800 font-mono">{users.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</span> - <span className="font-semibold text-slate-800 font-mono">{Math.min(currentPage * pageSize, totalUsers)}</span> / <span className="font-semibold text-slate-800 font-mono">{totalUsers}</span> cán bộ
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={currentPage <= 1 || isLoading}
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-slate-700 transition"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Trước</span>
                  </button>

                  <span className="px-3 py-1 rounded-xl bg-white border border-slate-200 font-bold text-slate-800 font-mono text-xs">
                    {currentPage} / {totalPages}
                  </span>

                  <button
                    type="button"
                    disabled={currentPage >= totalPages || isLoading}
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-slate-700 transition"
                  >
                    <span className="hidden sm:inline">Sau</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ======================================================= */}
      {/* MODAL THÊM NGƯỜI DÙNG MỚI (CHỈ ADMIN) */}
      {/* ======================================================= */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-600" />
                <span>Thêm Cán Bộ / Giảng Viên Mới</span>
              </h3>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Họ Và Tên *
                </label>
                <input
                  type="text"
                  value={createFormData.fullName}
                  onChange={(e) => setCreateFormData({ ...createFormData, fullName: e.target.value })}
                  placeholder="Ví dụ: TS. Nguyễn Văn A"
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>Email *</span>
                  </label>
                  <input
                    type="email"
                    value={createFormData.email}
                    onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value })}
                    placeholder="gv.a@university.edu.vn"
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Mật Khẩu Khởi Tạo *</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const newPwd = generateSecurePassword();
                        setCreateFormData((prev) => ({ ...prev, password: newPwd }));
                        toast.success('Đã tạo mật khẩu ngẫu nhiên an toàn.');
                      }}
                      className="text-[11px] text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 hover:underline"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Tạo ngẫu nhiên</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={createFormData.password}
                    onChange={(e) => setCreateFormData({ ...createFormData, password: e.target.value })}
                    placeholder="Mật khẩu khởi tạo tài khoản..."
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Vai Trò (Role) *
                  </label>
                  <select
                    value={createFormData.role}
                    onChange={(e) => setCreateFormData({ ...createFormData, role: e.target.value as Role })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="giangvien">Giảng viên</option>
                    <option value="truongkhoa">Trưởng khoa</option>
                    <option value="nhanvien">Chuyên viên / Nhân viên</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Hạn Mức Phép Năm (Ngày) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    value={createFormData.annualLeaveQuota}
                    onChange={(e) =>
                      setCreateFormData({ ...createFormData, annualLeaveQuota: parseInt(e.target.value, 10) || 12 })
                    }
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Khoa / Phòng Ban Trực Thuộc *
                </label>
                <select
                  value={createFormData.departmentId}
                  onChange={(e) => setCreateFormData({ ...createFormData, departmentId: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Chọn Khoa / Bộ môn --</option>
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name} ({d.type})
                    </option>
                  ))}
                </select>
              </div>

              {/* Buttons */}
              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Đang tạo...' : 'Tạo Tài Khoản'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* MODAL CHỈNH SỬA THÔNG TIN NGƯỜI DÙNG */}
      {/* ======================================================= */}
      {editModalOpen && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Chỉnh Sửa Thông Tin Cán Bộ
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{editingUser.email}</p>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-5 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Preview Avatar & Thông tin cán bộ */}
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <UserAvatar user={editingUser} size="lg" showStatus isActive={editingUser.isActive !== false} />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{editingUser.fullName}</p>
                  <p className="text-xs text-slate-500 font-mono truncate">{editingUser.email}</p>
                  <div className="mt-1">{getRoleBadge(editingUser.role)}</div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Họ Và Tên *
                </label>
                <input
                  type="text"
                  value={editFormData.fullName}
                  onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Hạn Mức Phép Năm (Ngày) *
                </label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={editFormData.annualLeaveQuota}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, annualLeaveQuota: parseInt(e.target.value, 10) || 12 })
                  }
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Các trường chỉ ADMIN mới được sửa */}
              {isAdmin && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Vai Trò (Role)
                      </label>
                      <select
                        value={editFormData.role}
                        onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value as Role })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="giangvien">Giảng viên</option>
                        <option value="truongkhoa">Trưởng khoa</option>
                        <option value="nhanvien">Chuyên viên / Nhân viên</option>
                        {editingUser.role === 'admin' && (
                          <option value="admin">Quản trị viên (Admin)</option>
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Trạng Thái Hoạt Động
                      </label>
                      <select
                        value={editFormData.isActive ? 'true' : 'false'}
                        onChange={(e) => setEditFormData({ ...editFormData, isActive: e.target.value === 'true' })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="true">Đang hoạt động</option>
                        <option value="false">Vô hiệu hóa (Khóa)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Khoa / Bộ Môn Trực Thuộc
                    </label>
                    <select
                      value={editFormData.departmentId}
                      onChange={(e) => setEditFormData({ ...editFormData, departmentId: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {departments.map((d) => (
                        <option key={d._id} value={d._id}>
                          {d.name} ({d.type})
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* Ghi chú phân quyền nếu là Trưởng khoa */}
              {isDean && (
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-700">
                  💡 <strong>Ghi chú Trưởng khoa:</strong> Bạn có quyền điều chỉnh họ tên và hạn mức ngày phép năm của cán bộ khoa mình. Quyền thay đổi vai trò hoặc chuyển khoa do Quản trị viên (Admin) phụ trách.
                </div>
              )}

              {/* Buttons */}
              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* MODAL KHÓA / VÔ HIỆU HÓA NGƯỜI DÙNG (CHỈ ADMIN) */}
      {/* ======================================================= */}
      {deleteModalOpen && userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Khóa tài khoản cán bộ?</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Bạn có chắc chắn muốn vô hiệu hóa tài khoản <span className="font-bold text-slate-800">&quot;{userToDelete.fullName}&quot;</span> ({userToDelete.email})?
              Người dùng này sẽ không thể đăng nhập vào hệ thống (Xóa mềm - Soft delete).
            </p>

            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                onClick={() => setDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
              >
                Hủy Bỏ
              </button>
              <button
                onClick={handleDeleteSubmit}
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-500/20 transition disabled:opacity-50"
              >
                {isSubmitting ? 'Đang khóa...' : 'Xác Nhận Khóa Tài Khoản'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;
