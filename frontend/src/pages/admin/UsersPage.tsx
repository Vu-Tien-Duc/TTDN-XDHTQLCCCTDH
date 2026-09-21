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
} from 'lucide-react';
import { Department, Role, User as UserType } from '../../types';
import { userService, CreateUserPayload, UpdateUserPayload } from '../../services/userService';
import { departmentService } from '../../services/departmentService';
import { useAuth } from '../../contexts/AuthContext';

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

  // Tải danh sách người dùng
  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      const params: { role?: Role; departmentId?: string; search?: string } = {};
      if (selectedRole !== 'all') params.role = selectedRole as Role;
      if (selectedDept !== 'all' && isAdmin) params.departmentId = selectedDept;
      if (search.trim()) params.search = search.trim();

      const data = await userService.getAllUsers(params);
      setUsers(data || []);
    } catch (err) {
      console.error('[UsersPage] Lỗi tải người dùng:', err);
      toast.error('Không thể tải danh sách cán bộ / giảng viên.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedRole, selectedDept, search, isAdmin]);

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

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
            <Users className="w-4 h-4" />
            <span>Nhân Sự & Giảng Viên</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Quản Lý Cán Bộ & Người Dùng
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {isAdmin
              ? 'Toàn quyền quản trị danh sách nhân sự toàn trường, phân quyền và khóa tài khoản.'
              : 'Danh sách nhân sự thuộc quyền quản lý của Khoa trực thuộc.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchUsers}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
            title="Tải lại danh sách"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {/* NÚT THÊM NGƯỜI DÙNG: Chỉ hiển thị cho Admin */}
          {isAdmin && (
            <button
              onClick={handleOpenCreateModal}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition active:scale-98"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm Cán Bộ / Giảng Viên</span>
            </button>
          )}
        </div>
      </div>

      {/* Thanh Bộ Lọc & Tìm Kiếm */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        {/* Tìm kiếm */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo họ tên hoặc email..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Lọc theo Role & Khoa */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            <span>Bộ lọc:</span>
          </div>

          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Tất cả vai trò</option>
            <option value="admin">Quản trị viên (Admin)</option>
            <option value="truongkhoa">Trưởng khoa</option>
            <option value="giangvien">Giảng viên</option>
            <option value="nhanvien">Chuyên viên / Nhân viên</option>
          </select>

          {isAdmin && (
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[200px] truncate"
            >
              <option value="all">Tất cả Khoa / Phòng ban</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Bảng Danh Sách Người Dùng */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <p className="text-sm text-slate-500">Đang tải danh sách người dùng...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">
            Không tìm thấy người dùng nào phù hợp với điều kiện tìm kiếm.
          </div>
        ) : (
          <>
            {/* Giao diện Thẻ dành riêng cho Mobile */}
            <div className="md:hidden divide-y divide-slate-100">
              {users.map((u) => {
                const deptName =
                  u.departmentId && typeof u.departmentId === 'object'
                    ? u.departmentId.name
                    : '-';
                return (
                  <div key={u._id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center border border-blue-200 shrink-0">
                          {u.fullName.split(' ').pop()?.substring(0, 2).toUpperCase() || 'U'}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 text-sm truncate">{u.fullName}</p>
                          <p className="text-slate-400 text-xs font-mono truncate">{u.email}</p>
                        </div>
                      </div>
                      <div className="shrink-0">{getRoleBadge(u.role)}</div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      <span className="inline-flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        <span className="truncate max-w-[140px]">{deptName}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                        <Award className="w-3.5 h-3.5 text-amber-500" />
                        <span>{u.annualLeaveQuota || 12} ngày phép</span>
                      </span>
                      {u.isActive !== false ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                          <UserCheck className="w-3 h-3" />
                          <span>Hoạt Động</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 font-bold">
                          <UserX className="w-3 h-3" />
                          <span>Đã Khóa</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-50">
                      <button
                        onClick={() => handleOpenEditModal(u)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 transition"
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
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 hover:bg-rose-100 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Khóa / Xóa</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bảng dữ liệu dành cho Tablet & Desktop */}
            <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50/80 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-6">Cán Bộ / Giảng Viên</th>
                  <th className="py-3.5 px-6">Vai Trò</th>
                  <th className="py-3.5 px-6">Khoa / Đơn Vị</th>
                  <th className="py-3.5 px-6">Quỹ Phép Năm</th>
                  <th className="py-3.5 px-6">Trạng Thái</th>
                  <th className="py-3.5 px-6 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => {
                  const deptName =
                    u.departmentId && typeof u.departmentId === 'object'
                      ? u.departmentId.name
                      : '-';

                  return (
                    <tr key={u._id} className="hover:bg-slate-50/60 transition">
                      {/* Avatar & Tên */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center border border-blue-200">
                            {u.fullName.split(' ').pop()?.substring(0, 2).toUpperCase() || 'U'}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 text-sm leading-tight">{u.fullName}</p>
                            <p className="text-slate-400 text-[11px] font-mono mt-0.5">{u.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-4 px-6">{getRoleBadge(u.role)}</td>

                      {/* Khoa */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{deptName}</span>
                        </div>
                      </td>

                      {/* Quỹ ngày phép */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-1">
                          <Award className="w-3.5 h-3.5 text-amber-500" />
                          <span className="font-bold text-slate-800">{u.annualLeaveQuota || 12}</span>
                          <span className="text-slate-400 text-[11px]">ngày/năm</span>
                        </div>
                      </td>

                      {/* Trạng thái hoạt động */}
                      <td className="py-4 px-6">
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
                      <td className="py-4 px-6 text-right">
                        <div className="inline-flex items-center gap-1">
                          {/* Nút sửa: Cả Admin và Trưởng khoa đều có */}
                          <button
                            onClick={() => handleOpenEditModal(u)}
                            className="p-2 rounded-xl text-blue-600 hover:bg-blue-50 transition"
                            title={isDean ? 'Sửa hạn mức phép & họ tên' : 'Chỉnh sửa thông tin'}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Nút Xóa/Khóa: CHỈ HIỂN THỊ CHO ADMIN (Trưởng khoa bị ẩn) */}
                          {isAdmin && (
                            <button
                              onClick={() => {
                                setUserToDelete(u);
                                setDeleteModalOpen(true);
                              }}
                              className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 transition"
                              title="Vô hiệu hóa tài khoản (Soft delete)"
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

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
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
