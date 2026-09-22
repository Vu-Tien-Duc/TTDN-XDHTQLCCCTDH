import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import {
  Building2,
  FolderTree,
  Table as TableIcon,
  Plus,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronRight,
  Search,
  User,
  Users,
  MapPin,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  BookOpen,
  Briefcase,
} from 'lucide-react';
import { Department, User as UserType } from '../../types';
import { departmentService, DepartmentPayload } from '../../services/departmentService';
import { userService } from '../../services/userService';
import { useAuth } from '../../contexts/AuthContext';
import { UserAvatar } from '../../components';

export const DepartmentsPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';

  const [departmentsTree, setDepartmentsTree] = useState<Department[]>([]);
  const [flatDepartments, setFlatDepartments] = useState<Department[]>([]);
  const [usersList, setUsersList] = useState<UserType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'tree' | 'table'>('tree');
  const [selectedType, setSelectedType] = useState<'all' | 'khoa' | 'bomon' | 'phongban'>('all');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingDept, setEditingDept] = useState<Department | null>(null);

  // Form State
  const [formData, setFormData] = useState<DepartmentPayload>({
    name: '',
    type: 'khoa',
    parentId: null,
    managerId: null,
    location: { lat: 21.028511, lng: 105.854167 },
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Confirm Modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deptToDelete, setDeptToDelete] = useState<Department | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 1. Tải danh sách phòng ban
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [treeData, flatData] = await Promise.all([
        departmentService.getDepartmentTree(),
        departmentService.getAllDepartments(),
      ]);

      setDepartmentsTree(treeData || []);
      setFlatDepartments(flatData || []);

      // Mặc định mở rộng tất cả các node cấp 1 và cấp 2
      const initialExpanded: Record<string, boolean> = {};
      const markExpanded = (nodes: Department[]) => {
        nodes.forEach((n) => {
          initialExpanded[n._id] = true;
          if (n.children && n.children.length > 0) {
            markExpanded(n.children);
          }
        });
      };
      markExpanded(treeData || []);
      setExpandedNodes(initialExpanded);

      if (treeData && treeData.length > 0) {
        setSelectedDeptId((prev) => prev || treeData[0]._id);
      }
    } catch (err) {
      console.error('[DepartmentsPage] Lỗi tải dữ liệu:', err);
      toast.error('Không thể tải danh sách Cơ cấu Tổ chức.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Tải danh sách người dùng để gán Trưởng đơn vị
  const fetchUsers = useCallback(async () => {
    try {
      const usersResult = await userService.getAllUsers();
      // getAllUsers() trả về User[] hoặc UserPaginationResult tùy backend
      const userArray = Array.isArray(usersResult) ? usersResult : (usersResult as any)?.users || [];
      setUsersList(userArray);
    } catch {
      // Bỏ qua nếu lỗi nạp user
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchUsers();
  }, [fetchData, fetchUsers]);

  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
  };

  // Mở Modal Thêm mới
  const handleOpenCreateModal = (parentDept?: Department) => {
    setModalMode('create');
    setEditingDept(null);
    setFormData({
      name: '',
      type: parentDept ? 'bomon' : 'khoa',
      parentId: parentDept ? parentDept._id : null,
      managerId: null,
      location: { lat: 21.028511, lng: 105.854167 },
    });
    setIsModalOpen(true);
  };

  // Mở Modal Chỉnh sửa
  const handleOpenEditModal = (dept: Department) => {
    setModalMode('edit');
    setEditingDept(dept);

    const parentId =
      dept.parentId && typeof dept.parentId === 'object'
        ? dept.parentId._id
        : (dept.parentId as string) || null;

    const managerId =
      dept.managerId && typeof dept.managerId === 'object'
        ? dept.managerId._id
        : (dept.managerId as string) || null;

    setFormData({
      name: dept.name,
      type: (dept.type as 'khoa' | 'bomon' | 'phongban') || 'khoa',
      parentId,
      managerId,
      location: dept.location || { lat: 21.028511, lng: 105.854167 },
    });
    setIsModalOpen(true);
  };

  // Submit Thêm / Sửa
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Vui lòng nhập tên đơn vị.');
      return;
    }

    if (formData.type === 'bomon' && !formData.parentId) {
      toast.error('Đơn vị loại Bộ môn bắt buộc phải trực thuộc một Khoa.');
      return;
    }

    try {
      setIsSubmitting(true);
      if (modalMode === 'create') {
        await departmentService.createDepartment(formData);
        toast.success(`Tạo mới "${formData.name}" thành công!`);
      } else if (editingDept) {
        await departmentService.updateDepartment(editingDept._id, formData);
        toast.success(`Cập nhật "${formData.name}" thành công!`);
      }

      setIsModalOpen(false);
      fetchData();
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string } } };
      toast.error(apiErr.response?.data?.message || 'Thao tác thất bại. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Xóa đơn vị
  const handleDelete = async () => {
    if (!deptToDelete) return;
    try {
      setIsDeleting(true);
      await departmentService.deleteDepartment(deptToDelete._id);
      toast.success(`Đã xóa "${deptToDelete.name}" thành công.`);
      setDeleteModalOpen(false);
      setDeptToDelete(null);
      fetchData();
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string } } };
      toast.error(apiErr.response?.data?.message || 'Không thể xóa đơn vị này.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Lọc tìm kiếm bảng phẳng theo cả từ khóa và loại đơn vị
  const filteredFlatList = flatDepartments.filter((d) => {
    const matchType = selectedType === 'all' || d.type === selectedType;
    const matchName = d.name.toLowerCase().includes(searchTerm.toLowerCase());
    const managerName =
      d.managerId && typeof d.managerId === 'object' ? d.managerId.fullName : '';
    const matchManager = managerName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchType && (matchName || matchManager);
  });

  const getTypeBadge = (type?: string) => {
    switch (type) {
      case 'khoa':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-blue-100 text-blue-700 border border-blue-200 shrink-0">
            <Building2 className="w-3 h-3 text-blue-600" />
            <span>Khoa Đào Tạo</span>
          </span>
        );
      case 'bomon':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 shrink-0">
            <BookOpen className="w-3 h-3 text-emerald-600" />
            <span>Bộ Môn</span>
          </span>
        );
      case 'phongban':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-amber-100 text-amber-700 border border-amber-200 shrink-0">
            <Briefcase className="w-3 h-3 text-amber-600" />
            <span>Phòng Ban</span>
          </span>
        );
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200 shrink-0">{type || 'Đơn vị'}</span>;
    }
  };

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'admin':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">Quản trị viên</span>;
      case 'truongkhoa':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">Trưởng khoa</span>;
      case 'giangvien':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">Giảng viên</span>;
      case 'nhanvien':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">Chuyên viên</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">{role || 'Cán bộ'}</span>;
    }
  };

  const selectedDept = flatDepartments.find((item) => item._id === selectedDeptId) || flatDepartments[0] || null;
  const totalKhoa = flatDepartments.filter((d) => d.type === 'khoa').length;
  const totalBoMon = flatDepartments.filter((d) => d.type === 'bomon').length;
  const totalPhongBan = flatDepartments.filter((d) => d.type === 'phongban').length;

  // Lọc danh sách nhân sự trực thuộc đơn vị đang được chọn
  const deptMembers = selectedDept
    ? usersList.filter((u) => {
        const dId = u.departmentId && typeof u.departmentId === 'object' ? u.departmentId._id : u.departmentId;
        return dId === selectedDept._id;
      })
    : [];

  // Đệ quy render các nhánh cây (Responsive Tree Nodes)
  const renderTreeNodes = (nodes: Department[], level = 0) => {
    return (
      <div className={`space-y-2.5 ${level > 0 ? 'ml-2 sm:ml-5 pl-2 sm:pl-3.5 border-l-2 border-slate-200' : ''}`}>
        {nodes.map((node) => {
          const hasChildren = node.children && node.children.length > 0;
          const isExpanded = !!expandedNodes[node._id];
          const manager = node.managerId && typeof node.managerId === 'object' ? node.managerId : null;
          const isSelected = selectedDeptId === node._id;
          const isKhoa = node.type === 'khoa';
          const isBoMon = node.type === 'bomon';

          return (
            <div key={node._id} className="group">
              <div
                className={`flex items-center justify-between p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-blue-50/90 border-blue-400 shadow-sm ring-2 ring-blue-500/20'
                    : isKhoa
                      ? 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-xs border-l-[4px] border-l-blue-600'
                      : isBoMon
                        ? 'bg-white/95 border-slate-200 hover:border-emerald-300 hover:shadow-xs border-l-[4px] border-l-emerald-500'
                        : 'bg-white/95 border-slate-200 hover:border-amber-300 hover:shadow-xs border-l-[4px] border-l-amber-500'
                }`}
                onClick={() => setSelectedDeptId(node._id)}
              >
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  {hasChildren ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleNode(node._id);
                      }}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition shrink-0"
                    >
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                  ) : (
                    <div className="w-6 h-6 flex items-center justify-center text-slate-300 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                    </div>
                  )}

                  <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                    <span className={`font-bold text-xs sm:text-sm truncate ${isSelected ? 'text-blue-700' : 'text-slate-800'}`}>
                      {node.name}
                    </span>
                    <div className="shrink-0">{getTypeBadge(node.type)}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-2">
                  {manager ? (
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50/90 hover:bg-slate-100 px-2 sm:px-2.5 py-1 rounded-xl border border-slate-200 shrink-0">
                      <UserAvatar user={manager} size="xs" />
                      <span className="font-medium truncate max-w-[85px] sm:max-w-[130px] text-slate-800 text-[11px] sm:text-xs">
                        {manager.fullName}
                      </span>
                    </div>
                  ) : (
                    <span className="hidden sm:inline text-[11px] text-slate-400 italic">Chưa bổ nhiệm</span>
                  )}

                  {isAdmin && (
                    <div className="flex items-center gap-0.5 sm:gap-1 opacity-90 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                      {node.type === 'khoa' && (
                        <button
                          onClick={() => handleOpenCreateModal(node)}
                          className="p-1 sm:p-1.5 rounded-xl text-emerald-600 hover:bg-emerald-50 transition"
                          title="Thêm Bộ môn con vào Khoa này"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleOpenEditModal(node)}
                        className="p-1 sm:p-1.5 rounded-xl text-blue-600 hover:bg-blue-50 transition"
                        title="Chỉnh sửa thông tin"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setDeptToDelete(node);
                          setDeleteModalOpen(true);
                        }}
                        className="p-1 sm:p-1.5 rounded-xl text-rose-600 hover:bg-rose-50 transition"
                        title="Xóa đơn vị"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {hasChildren && isExpanded && (
                <div className="mt-2">{renderTreeNodes(node.children!, level + 1)}</div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
            <Building2 className="w-4 h-4" />
            <span>Cơ Cấu Tổ Chức</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Quản Lý Khoa & Bộ Môn
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Mô hình phân cấp: Ban Giám Hiệu → Khoa / Phòng ban → Bộ môn trực thuộc
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 self-end sm:self-auto">
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button
              onClick={() => setViewMode('tree')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                viewMode === 'tree' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FolderTree className="w-4 h-4" />
              <span>Dạng Cây</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                viewMode === 'table' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon className="w-4 h-4" />
              <span>Dạng Bảng</span>
            </button>
          </div>

          <button
            onClick={fetchData}
            className="p-2 sm:p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
            title="Tải lại dữ liệu"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {isAdmin && (
            <button
              onClick={() => handleOpenCreateModal()}
              className="flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition active:scale-98"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm Đơn Vị</span>
            </button>
          )}
        </div>
      </div>

      {/* 3 Thẻ Thống Kê Loại Đơn Vị (Responsive Grid 3 Cột) */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-xs border-l-4 border-l-blue-600">
          <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-blue-600 truncate flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5" />
            <span>Khoa Đào Tạo</span>
          </div>
          <div className="mt-1 sm:mt-2 text-lg sm:text-2xl font-black text-slate-900 font-mono">{totalKhoa}</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-xs border-l-4 border-l-emerald-600">
          <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-emerald-600 truncate flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Bộ Môn</span>
          </div>
          <div className="mt-1 sm:mt-2 text-lg sm:text-2xl font-black text-slate-900 font-mono">{totalBoMon}</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-xs border-l-4 border-l-amber-600">
          <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-amber-600 truncate flex items-center gap-1">
            <Briefcase className="w-3.5 h-3.5" />
            <span>Phòng Ban</span>
          </div>
          <div className="mt-1 sm:mt-2 text-lg sm:text-2xl font-black text-slate-900 font-mono">{totalPhongBan}</div>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-12 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-sm font-medium text-slate-500">Đang tải cấu trúc cây Khoa & Bộ môn...</p>
        </div>
      ) : viewMode === 'tree' ? (
        /* CHẾ ĐỘ 1: DẠNG CÂY (TREE VIEW) VỚI PANEL CHI TIẾT */
        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-4 sm:gap-6 items-start">
          {/* Cột trái: Sơ đồ cây phân cấp */}
          <div className="bg-slate-50/70 rounded-2xl sm:rounded-3xl border border-slate-200 p-3.5 sm:p-6 shadow-xs">
            <div className="mb-3 sm:mb-4 flex items-center justify-between text-xs text-slate-500 font-semibold px-1">
              <span>Sơ đồ cây phân cấp ({departmentsTree.length} nhánh)</span>
              <span className="hidden sm:inline italic text-[11px]">Bấm vào đơn vị để xem chi tiết</span>
            </div>

            {departmentsTree.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 text-slate-400 text-sm">
                Chưa có dữ liệu đơn vị. Vui lòng bấm &quot;Thêm Đơn Vị&quot; để khởi tạo.
              </div>
            ) : (
              renderTreeNodes(departmentsTree)
            )}
          </div>

          {/* Cột phải: Thông tin chi tiết & Danh sách cán bộ trực thuộc */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-xs lg:sticky lg:top-6">
            {selectedDept ? (
              <div className="space-y-4">
                {/* Header chi tiết */}
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Đơn vị đang xem</div>
                    <h2 className="mt-1 text-lg sm:text-xl font-black text-slate-900 truncate">{selectedDept.name}</h2>
                  </div>
                  <div className="shrink-0">{getTypeBadge(selectedDept.type)}</div>
                </div>

                {/* Thông số tóm tắt: Loại, Đơn vị cha, Tọa độ GPS */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">Đơn vị cấp trên</span>
                    <span className="mt-1 font-bold text-slate-800 truncate block">
                      {selectedDept.parentId && typeof selectedDept.parentId === 'object'
                        ? selectedDept.parentId.name
                        : 'Ban Giám Hiệu'}
                    </span>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">Tọa độ GPS</span>
                    <span className="mt-1 font-mono text-[11px] text-slate-700 truncate block">
                      {selectedDept.location?.lat && selectedDept.location?.lng
                        ? `${selectedDept.location.lat}, ${selectedDept.location.lng}`
                        : 'Chưa cập nhật'}
                    </span>
                  </div>
                </div>

                {/* Thẻ Trưởng đơn vị: Có hiển thị Avatar đầy đủ */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 sm:p-4">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-blue-600" />
                    <span>Trưởng Đơn Vị / Phụ Trách</span>
                  </div>

                  {selectedDept.managerId && typeof selectedDept.managerId === 'object' ? (
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        user={selectedDept.managerId}
                        size="lg"
                        showStatus
                        isActive={selectedDept.managerId.isActive !== false}
                      />
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 text-sm">{selectedDept.managerId.fullName}</p>
                        <p className="text-xs text-slate-500 font-mono mt-0.5 truncate">{selectedDept.managerId.email}</p>
                        <div className="mt-1.5">{getRoleBadge(selectedDept.managerId.role)}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2 py-1">
                      <span className="text-xs text-slate-400 italic">Chưa bổ nhiệm phụ trách đơn vị</span>
                      {isAdmin && (
                        <button
                          onClick={() => handleOpenEditModal(selectedDept)}
                          className="text-xs font-bold text-blue-600 hover:text-blue-700 underline"
                        >
                          Bổ nhiệm ngay
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Danh sách cán bộ / giảng viên trực thuộc (Members List with Avatars) */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-3.5 sm:p-4 space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-blue-600" />
                      <span>Cán bộ / Giảng viên trực thuộc</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-mono font-bold">
                      {deptMembers.length} nhân sự
                    </span>
                  </div>

                  {deptMembers.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-2 text-center">
                      Chưa có cán bộ / giảng viên nào thuộc đơn vị này.
                    </p>
                  ) : (
                    <div className="max-h-52 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100">
                      {deptMembers.map((member) => (
                        <div key={member._id} className="pt-2 first:pt-0 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <UserAvatar user={member} size="sm" showStatus isActive={member.isActive !== false} />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800 truncate">{member.fullName}</p>
                              <p className="text-[10px] text-slate-400 font-mono truncate">{member.email}</p>
                            </div>
                          </div>
                          <div className="shrink-0">{getRoleBadge(member.role)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Nút thao tác Quản trị */}
                {isAdmin && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                    {selectedDept.type === 'khoa' && (
                      <button
                        onClick={() => handleOpenCreateModal(selectedDept)}
                        className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Thêm bộ môn</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleOpenEditModal(selectedDept)}
                      className="flex-1 min-w-[100px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Sửa</span>
                    </button>
                    <button
                      onClick={() => {
                        setDeptToDelete(selectedDept);
                        setDeleteModalOpen(true);
                      }}
                      className="flex-1 min-w-[100px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Xóa</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-slate-400 py-10 text-center">Chưa có đơn vị nào được chọn.</div>
            )}
          </div>
        </div>
      ) : (
        /* CHẾ ĐỘ 2: DẠNG BẢNG (TABLE VIEW) */
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
          {/* Thanh tìm kiếm & Tabs lọc loại đơn vị */}
          <div className="p-3.5 sm:p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm theo tên đơn vị hoặc tên trưởng khoa..."
                className="w-full pl-10 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Tabs: Tất cả | Khoa | Bộ Môn | Phòng Ban */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
              <button
                onClick={() => setSelectedType('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  selectedType === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Tất cả ({flatDepartments.length})
              </button>
              <button
                onClick={() => setSelectedType('khoa')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  selectedType === 'khoa'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200/60'
                }`}
              >
                <Building2 className="w-3 h-3" />
                <span>Khoa ({totalKhoa})</span>
              </button>
              <button
                onClick={() => setSelectedType('bomon')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  selectedType === 'bomon'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60'
                }`}
              >
                <BookOpen className="w-3 h-3" />
                <span>Bộ Môn ({totalBoMon})</span>
              </button>
              <button
                onClick={() => setSelectedType('phongban')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  selectedType === 'phongban'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/60'
                }`}
              >
                <Briefcase className="w-3 h-3" />
                <span>Phòng Ban ({totalPhongBan})</span>
              </button>
            </div>
          </div>

          {/* GIAO DIỆN MOBILE: CARD VIEW TÁCH BIỆT RÕ RÀNG (md:hidden) */}
          <div className="md:hidden p-3.5 sm:p-4 bg-slate-50/80 space-y-3.5">
            {filteredFlatList.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
                Không tìm thấy đơn vị nào phù hợp.
              </div>
            ) : (
              filteredFlatList.map((d) => {
                const parentName =
                  d.parentId && typeof d.parentId === 'object' ? d.parentId.name : '-';
                const manager = d.managerId && typeof d.managerId === 'object' ? d.managerId : null;
                const isKhoa = d.type === 'khoa';
                const isBoMon = d.type === 'bomon';
                const isPhongBan = d.type === 'phongban';

                // Đếm số lượng cán bộ thuộc đơn vị này
                const memberCount = usersList.filter((u) => {
                  const uDeptId = u.departmentId && typeof u.departmentId === 'object' ? u.departmentId._id : u.departmentId;
                  return uDeptId === d._id;
                }).length;

                return (
                  <div
                    key={d._id}
                    className={`p-4 rounded-2xl bg-white border shadow-xs hover:shadow-md transition-all space-y-3.5 ${
                      isKhoa
                        ? 'border-blue-200/90 border-l-[5px] border-l-blue-600'
                        : isBoMon
                          ? 'border-emerald-200/90 border-l-[5px] border-l-emerald-600'
                          : 'border-amber-200/90 border-l-[5px] border-l-amber-600'
                    }`}
                  >
                    {/* Header Thẻ: Icon loại + Tên đơn vị + Badge phân loại */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border ${
                            isKhoa
                              ? 'bg-blue-50 text-blue-600 border-blue-200'
                              : isBoMon
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                : 'bg-amber-50 text-amber-600 border-amber-200'
                          }`}
                        >
                          {isKhoa ? (
                            <Building2 className="w-4 h-4" />
                          ) : isBoMon ? (
                            <BookOpen className="w-4 h-4" />
                          ) : (
                            <Briefcase className="w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-extrabold text-sm text-slate-900 leading-snug">
                            {d.name}
                          </h4>
                          {isBoMon && parentName !== '-' ? (
                            <div className="inline-flex items-center gap-1 text-[11px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md mt-1 border border-emerald-200 font-medium">
                              <span>↳ Thuộc Khoa:</span>
                              <span className="font-bold">{parentName}</span>
                            </div>
                          ) : isKhoa ? (
                            <p className="text-[11px] text-blue-700 mt-0.5 font-medium">
                              Khoa đào tạo &bull; Cấp trường
                            </p>
                          ) : (
                            <p className="text-[11px] text-amber-700 mt-0.5 font-medium">
                              Phòng ban hành chính & chức năng
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0">{getTypeBadge(d.type)}</div>
                    </div>

                    {/* Nội dung thông số: Trưởng đơn vị + Nhân sự & GPS */}
                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/80">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                          Trưởng Đơn Vị
                        </span>
                        <div className="flex items-center gap-1.5 mt-1.5 min-w-0">
                          {manager ? (
                            <>
                              <UserAvatar user={manager} size="xs" />
                              <div className="min-w-0">
                                <span className="font-bold text-slate-800 truncate block text-xs">
                                  {manager.fullName}
                                </span>
                              </div>
                            </>
                          ) : (
                            <span className="text-slate-400 italic text-xs">Chưa bổ nhiệm</span>
                          )}
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                          Nhân Sự & Vị Trí
                        </span>
                        <div className="mt-1.5 space-y-0.5">
                          <div className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                            <Users className="w-3 h-3 text-slate-400" />
                            <span>{memberCount} nhân sự</span>
                          </div>
                          <div className="font-mono text-[10px] text-slate-500 truncate flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{d.location?.lat ? `${d.location.lat}, ${d.location.lng}` : 'Chưa gán'}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Nút hành động */}
                    {isAdmin && (
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                        <button
                          onClick={() => handleOpenEditModal(d)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Sửa</span>
                        </button>
                        <button
                          onClick={() => {
                            setDeptToDelete(d);
                            setDeleteModalOpen(true);
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Xóa</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* GIAO DIỆN DESKTOP & TABLET: BẢNG TRUYỀN THỐNG (hidden md:block) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50/80 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Tên Đơn Vị</th>
                  <th className="py-3.5 px-4">Loại</th>
                  <th className="py-3.5 px-4">Đơn Vị Cấp Trên</th>
                  <th className="py-3.5 px-4">Trưởng Đơn Vị</th>
                  <th className="py-3.5 px-4">Tọa Độ GPS</th>
                  {isAdmin && <th className="py-3.5 px-4 text-right">Thao Tác</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredFlatList.map((d) => {
                  const parentName =
                    d.parentId && typeof d.parentId === 'object' ? d.parentId.name : '-';
                  const manager = d.managerId && typeof d.managerId === 'object' ? d.managerId : null;

                  return (
                    <tr key={d._id} className="hover:bg-slate-50/60 transition group">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                              d.type === 'khoa'
                                ? 'bg-blue-50 text-blue-600 border-blue-200'
                                : d.type === 'bomon'
                                  ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                  : 'bg-amber-50 text-amber-600 border-amber-200'
                            }`}
                          >
                            {d.type === 'khoa' ? (
                              <Building2 className="w-3.5 h-3.5" />
                            ) : d.type === 'bomon' ? (
                              <BookOpen className="w-3.5 h-3.5" />
                            ) : (
                              <Briefcase className="w-3.5 h-3.5" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                              {d.name}
                            </p>
                            {d.type === 'bomon' && parentName !== '-' && (
                              <p className="text-[10px] text-emerald-700 font-medium mt-0.5">
                                ↳ Thuộc: {parentName}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">{getTypeBadge(d.type)}</td>
                      <td className="py-3.5 px-4 text-slate-600">{parentName}</td>
                      <td className="py-3.5 px-4">
                        {manager ? (
                          <div className="flex items-center gap-2">
                            <UserAvatar user={manager} size="xs" />
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-800 truncate">{manager.fullName}</p>
                              <p className="text-[10px] text-slate-400 font-mono truncate">{manager.email}</p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Chưa bổ nhiệm</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                        {d.location?.lat ? `${d.location.lat}, ${d.location.lng}` : '-'}
                      </td>
                      {isAdmin && (
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => handleOpenEditModal(d)}
                              className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition"
                              title="Chỉnh sửa"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setDeptToDelete(d);
                                setDeleteModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition"
                              title="Xóa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* MODAL THÊM / CHỈNH SỬA KHOA & BỘ MÔN (RESPONSIVE SCROLL) */}
      {/* ======================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h3 className="text-base font-bold text-slate-900">
                {modalMode === 'create' ? 'Thêm Đơn Vị / Bộ Môn Mới' : 'Cập Nhật Thông Tin Đơn Vị'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
              {/* Tên đơn vị */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Tên Đơn Vị *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ví dụ: Khoa Công Nghệ Thông Tin"
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Loại đơn vị */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Loại Đơn Vị *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => {
                    const newType = e.target.value as 'khoa' | 'bomon' | 'phongban';
                    setFormData({ ...formData, type: newType, parentId: newType === 'khoa' ? null : formData.parentId });
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="khoa">Khoa đào tạo</option>
                  <option value="bomon">Bộ môn trực thuộc</option>
                  <option value="phongban">Phòng ban hành chính</option>
                </select>
              </div>

              {/* Đơn vị cha (Khoa cha nếu là Bộ môn) */}
              {formData.type === 'bomon' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Trực Thuộc Khoa (Đơn vị cha) *
                  </label>
                  <select
                    value={formData.parentId || ''}
                    onChange={(e) => setFormData({ ...formData, parentId: e.target.value || null })}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Chọn Khoa trực thuộc --</option>
                    {flatDepartments
                      .filter((d) => d.type === 'khoa' && d._id !== editingDept?._id)
                      .map((k) => (
                        <option key={k._id} value={k._id}>
                          {k.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Trưởng đơn vị */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Trưởng Khoa / Trưởng Đơn Vị
                </label>
                <select
                  value={formData.managerId || ''}
                  onChange={(e) => setFormData({ ...formData, managerId: e.target.value || null })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Chưa chỉ định người phụ trách --</option>
                  {usersList.map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.fullName} ({u.email}) - {u.role}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tọa độ GPS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>Vĩ độ (Lat)</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.location?.lat || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        location: { ...formData.location, lat: parseFloat(e.target.value) || 0 },
                      })
                    }
                    placeholder="21.028511"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>Kinh độ (Lng)</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.location?.lng || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        location: { ...formData.location, lng: parseFloat(e.target.value) || 0 },
                      })
                    }
                    placeholder="105.854167"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Đang lưu...' : modalMode === 'create' ? 'Tạo Đơn Vị' : 'Lưu Thay Đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* MODAL XÁC NHẬN XÓA */}
      {/* ======================================================= */}
      {deleteModalOpen && deptToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Xác nhận xóa đơn vị?</h3>
            <p className="text-xs text-slate-500 mt-2">
              Bạn có chắc chắn muốn xóa <span className="font-bold text-slate-800">&quot;{deptToDelete.name}&quot;</span>?
              Thao tác này không thể hoàn tác nếu không còn đơn vị con hoặc nhân sự liên kết.
            </p>

            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                onClick={() => setDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
              >
                Hủy Bỏ
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-500/20 transition disabled:opacity-50"
              >
                {isDeleting ? 'Đang xóa...' : 'Xác Nhận Xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DepartmentsPage;
