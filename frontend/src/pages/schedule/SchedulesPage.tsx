import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar,
  Clock,
  User as UserIcon,
  Building2,
  MapPin,
  Plus,
  Edit2,
  Trash2,
  Search,
  Filter,
  RefreshCw,
  LayoutGrid,
  List,
  AlertTriangle,
  X,
  BookOpen,
  Users,
  Eye,
  Info,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { scheduleService, CreateSchedulePayload, UpdateSchedulePayload } from '../../services/scheduleService';
import { shiftService } from '../../services/shiftService';
import { departmentService } from '../../services/departmentService';
import { userService } from '../../services/userService';
import { Schedule, ShiftConfig, Department, User } from '../../types';

// Danh sách các thứ trong tuần chuẩn (Bắt đầu từ Thứ 2 đến Chủ Nhật)
const WEEKDAYS = [
  { value: 1, label: 'Thứ Hai', short: 'Thứ 2', code: 'T2' },
  { value: 2, label: 'Thứ Ba', short: 'Thứ 3', code: 'T3' },
  { value: 3, label: 'Thứ Tư', short: 'Thứ 4', code: 'T4' },
  { value: 4, label: 'Thứ Năm', short: 'Thứ 5', code: 'T5' },
  { value: 5, label: 'Thứ Sáu', short: 'Thứ 6', code: 'T6' },
  { value: 6, label: 'Thứ Bảy', short: 'Thứ 7', code: 'T7' },
  { value: 0, label: 'Chủ Nhật', short: 'Chủ Nhật', code: 'CN' },
];

// Danh sách phòng học gợi ý phổ biến tại trường đại học
const POPULAR_ROOMS = [
  'Giảng đường A2-301',
  'Giảng đường A2-302',
  'Giảng đường B3-401',
  'Giảng đường B3-402',
  'Phòng thực hành CNTT Lab 1',
  'Phòng thực hành CNTT Lab 2',
  'Hội trường Trung tâm C1',
  'Phòng chuyên đề KTX-105',
];

// Định dạng màu sắc nhận diện cho từng loại ca
const SHIFT_THEMES: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  'ca sáng': { bg: 'bg-blue-50/60 hover:bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', badge: 'bg-blue-100 text-blue-700' },
  'ca chiều': { bg: 'bg-amber-50/60 hover:bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', badge: 'bg-amber-100 text-amber-700' },
  'ca tối': { bg: 'bg-purple-50/60 hover:bg-purple-50', border: 'border-purple-200', text: 'text-purple-800', badge: 'bg-purple-100 text-purple-700' },
  'ca hành chính': { bg: 'bg-emerald-50/60 hover:bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', badge: 'bg-emerald-100 text-emerald-700' },
};

// Danh sách học kỳ chuẩn
const SEMESTERS = [
  { id: 'hk1_2026', name: 'Học kỳ 1 (2026 - 2027)' },
  { id: 'hk2_2026', name: 'Học kỳ 2 (2026 - 2027)' },
  { id: 'hk3_2026', name: 'Học kỳ Hè (2026 - 2027)' },
];

// Hàm lấy ngày Thứ Hai đầu tuần
const getMonday = (d: Date) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setHours(0, 0, 0, 0);
  date.setDate(diff);
  return date;
};

export const SchedulesPage: React.FC = () => {
  const { user } = useAuth();

  // Quyền thao tác thêm / sửa / xóa
  const canManage = user?.role === 'admin' || user?.role === 'truongkhoa';
  const isPersonalOnly = user?.role === 'giangvien' || user?.role === 'nhanvien';

  // State dữ liệu
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [shifts, setShifts] = useState<ShiftConfig[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Chế độ hiển thị: 'grid' (Bảng tuần) hoặc 'table' (Danh sách)
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Học kỳ & Điều hướng tuần
  const [selectedSemester, setSelectedSemester] = useState<string>('hk1_2026');
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => getMonday(new Date()));

  // 7 ngày trong tuần được chọn
  const weekDaysWithDates = useMemo(() => {
    return WEEKDAYS.map((wd, index) => {
      const dayDate = new Date(currentWeekStart);
      dayDate.setDate(currentWeekStart.getDate() + index);
      const dateFormatted = `${String(dayDate.getDate()).padStart(2, '0')}/${String(dayDate.getMonth() + 1).padStart(2, '0')}`;
      const isToday = dayDate.toDateString() === new Date().toDateString();
      return {
        ...wd,
        date: dayDate,
        dateFormatted,
        isToday,
      };
    });
  }, [currentWeekStart]);

  // Chuỗi hiển thị khoảng ngày của tuần
  const weekRangeText = useMemo(() => {
    const monday = new Date(currentWeekStart);
    const sunday = new Date(currentWeekStart);
    sunday.setDate(monday.getDate() + 6);
    return `${String(monday.getDate()).padStart(2, '0')}/${String(monday.getMonth() + 1).padStart(2, '0')} - ${String(sunday.getDate()).padStart(2, '0')}/${String(sunday.getMonth() + 1).padStart(2, '0')}/${sunday.getFullYear()}`;
  }, [currentWeekStart]);

  // Bộ lọc
  const [selectedDeptId, setSelectedDeptId] = useState<string>('all');
  const [selectedUserId, setSelectedUserId] = useState<string>(isPersonalOnly ? user?._id || '' : 'all');
  const [selectedShiftId, setSelectedShiftId] = useState<string>('all');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  // Modal Tạo / Sửa
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [conflictError, setConflictError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    userId: '',
    shiftId: '',
    weekday: 1,
    roomId: '',
    subjectName: '',
    subjectCode: '',
    startTime: '',
    endTime: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(new Date().setMonth(new Date().getMonth() + 4)).toISOString().split('T')[0],
    isRecurring: true,
  });

  const selectedFormUser = usersList.find((u) => u._id === formData.userId);
  const canAssignSubject = selectedFormUser?.role === 'giangvien' || selectedFormUser?.role === 'truongkhoa';

  // Modal Xác nhận xóa
  const [deleteTarget, setDeleteTarget] = useState<Schedule | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [detailSchedule, setDetailSchedule] = useState<Schedule | null>(null);

  // Ngày hiện tại trong tuần (0: Chủ Nhật, 1: Thứ 2, ...)
  const currentWeekday = new Date().getDay();

  const getDepartmentInfo = (scheduleUser: User | null) => {
    if (!scheduleUser) return { unitName: '', facultyName: '' };

    const departmentValue = scheduleUser.departmentId;
    const department =
      typeof departmentValue === 'object' && departmentValue !== null
        ? departmentValue
        : departments.find((item) => item._id === departmentValue);

    if (!department) return { unitName: '', facultyName: '' };

    const parent =
      typeof department.parentId === 'object' && department.parentId !== null
        ? department.parentId
        : departments.find((item) => item._id === department.parentId);

    return {
      unitName: department.name,
      facultyName: department.type === 'bomon' ? parent?.name || '' : department.name,
    };
  };

  const detailUser = detailSchedule
    ? typeof detailSchedule.userId === 'object' && detailSchedule.userId !== null
      ? (detailSchedule.userId as User)
      : usersList.find((item) => item._id === detailSchedule.userId) || null
    : null;
  const detailShift =
    detailSchedule && typeof detailSchedule.shiftId === 'object' && detailSchedule.shiftId !== null
      ? (detailSchedule.shiftId as ShiftConfig)
      : detailSchedule
        ? shifts.find((item) => item._id === detailSchedule.shiftId)
        : null;
  const detailDepartmentInfo = getDepartmentInfo(detailUser);

  // Tải dữ liệu ban đầu
  const loadData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const [schedulesData, shiftsData, deptsData, usersData] = await Promise.all([
        scheduleService.getSchedules().catch(() => []),
        shiftService.getAllShifts().catch(() => []),
        departmentService.getAllDepartments().catch(() => []),
        canManage
          ? userService.getAllUsers().catch(() => [])
          : Promise.resolve(user ? [user] : []),
      ]);

      setSchedules(schedulesData);
      setShifts((Array.isArray(shiftsData) ? shiftsData : []).filter((s) => s.isActive !== false));
      setDepartments(deptsData);

      // Kết hợp người dùng từ API và người dùng đã được populate trong schedules
      const userMap = new Map<string, User>();
      if (Array.isArray(usersData)) {
        usersData.forEach((u) => {
          if (u && u._id) userMap.set(u._id, u);
        });
      }
      if (user && user._id) {
        userMap.set(user._id, user);
      }
      schedulesData.forEach((s) => {
        if (s.userId && typeof s.userId === 'object' && (s.userId as User)._id) {
          const u = s.userId as User;
          if (!userMap.has(u._id)) userMap.set(u._id, u);
        }
      });

      setUsersList(Array.from(userMap.values()));
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Không thể tải dữ liệu lịch giảng dạy');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canManage, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Thiết lập mặc định nếu là giảng viên/nhân viên
  useEffect(() => {
    if (isPersonalOnly && user?._id) {
      setSelectedUserId(user._id);
    }
  }, [isPersonalOnly, user?._id]);

  // Lọc danh sách Giảng viên theo Khoa được chọn (ở bộ lọc)
  const filteredUsers = useMemo(() => {
    if (selectedDeptId === 'all') return usersList;
    return usersList.filter((u) => {
      const deptId = typeof u.departmentId === 'object' && u.departmentId !== null ? (u.departmentId as Department)._id : u.departmentId;
      return deptId === selectedDeptId;
    });
  }, [usersList, selectedDeptId]);

  // Lọc danh sách lịch theo các tiêu chí
  const filteredSchedules = useMemo(() => {
    return schedules.filter((sch) => {
      const schUserId = typeof sch.userId === 'object' && sch.userId !== null ? (sch.userId as User)._id : (sch.userId as string) || '';

      // 1. Lọc theo Giảng viên
      if (selectedUserId !== 'all' && schUserId !== selectedUserId) {
        return false;
      }

      // 2. Lọc theo Khoa
      if (selectedDeptId !== 'all') {
        const userObj =
          typeof sch.userId === 'object' && sch.userId !== null
            ? (sch.userId as User)
            : usersList.find((u) => u._id === schUserId);

        let schDeptId = '';
        if (userObj) {
          schDeptId =
            typeof userObj.departmentId === 'object' && userObj.departmentId !== null
              ? (userObj.departmentId as Department)._id
              : (userObj.departmentId as string) || '';
        }

        if (schDeptId !== selectedDeptId) {
          const userDept = departments.find((d) => d._id === schDeptId);
          const parentId = typeof userDept?.parentId === 'object' ? userDept?.parentId?._id : userDept?.parentId;
          if (schDeptId !== selectedDeptId && parentId !== selectedDeptId) {
            return false;
          }
        }
      }

      // 3. Lọc theo Ca
      if (selectedShiftId !== 'all') {
        const schShiftId = typeof sch.shiftId === 'object' && sch.shiftId !== null ? (sch.shiftId as ShiftConfig)._id : sch.shiftId;
        if (String(schShiftId) !== String(selectedShiftId)) return false;
      }

      // 4. Tìm kiếm từ khóa (Tên GV, Phòng học, Email)
      if (searchKeyword.trim()) {
        const kw = searchKeyword.toLowerCase();
        const userObj =
          typeof sch.userId === 'object' && sch.userId !== null
            ? (sch.userId as User)
            : usersList.find((u) => u._id === schUserId);

        const userName = userObj?.fullName?.toLowerCase() || '';
        const userEmail = userObj?.email?.toLowerCase() || '';
        const room = (sch.roomId || sch.room || '').toLowerCase();
        if (!userName.includes(kw) && !userEmail.includes(kw) && !room.includes(kw)) {
          return false;
        }
      }

      return true;
    });
  }, [schedules, selectedUserId, selectedDeptId, selectedShiftId, searchKeyword, departments, usersList]);

  // Thống kê nhanh
  const stats = useMemo(() => {
    const uniqueLecturers = new Set(
      filteredSchedules.map((s) => (typeof s.userId === 'object' && s.userId !== null ? (s.userId as User)._id : s.userId))
    );
    const uniqueRooms = new Set(filteredSchedules.map((s) => s.roomId || s.room).filter(Boolean));
    const todaySchedules = filteredSchedules.filter((s) => {
      const wd = s.weekday !== undefined ? Number(s.weekday) : (s.dayOfWeek !== undefined ? Number(s.dayOfWeek) : -1);
      return wd === currentWeekday;
    });

    return {
      total: filteredSchedules.length,
      lecturers: uniqueLecturers.size,
      rooms: uniqueRooms.size,
      today: todaySchedules.length,
    };
  }, [filteredSchedules, currentWeekday]);

  // Mở Modal Tạo mới (có thể nhận giá trị mặc định từ ô bấm trong Bảng tuần)
  const handleOpenCreateModal = (defaultWeekday?: number, defaultShiftId?: string) => {
    setEditingSchedule(null);
    setConflictError(null);

    // Tìm ca đầu tiên nếu không truyền
    const defaultShift = defaultShiftId ? shifts.find((s) => s._id === defaultShiftId) : shifts[0];

    // Giảng viên mặc định
    const defaultUser = isPersonalOnly
      ? user?._id || ''
      : filteredUsers.length > 0
      ? filteredUsers[0]._id
      : usersList[0]?._id || '';
    const defaultUserObj = usersList.find((u) => u._id === defaultUser);
    const defaultCanTeach = defaultUserObj?.role === 'giangvien' || defaultUserObj?.role === 'truongkhoa';

    const today = new Date();
    const fourMonthsLater = new Date();
    fourMonthsLater.setDate(today.getDate() + 120);

    setFormData({
      userId: defaultUser,
      shiftId: defaultShift?._id || '',
      weekday: defaultWeekday !== undefined ? defaultWeekday : 1,
      roomId: 'Giảng đường A2-301',
      subjectName: defaultCanTeach ? 'Lập trình Web' : '',
      subjectCode: defaultCanTeach ? 'CS201' : '',
      startTime: defaultShift?.startTime || '07:00',
      endTime: defaultShift?.endTime || '11:30',
      startDate: today.toISOString().split('T')[0],
      endDate: fourMonthsLater.toISOString().split('T')[0],
      isRecurring: true,
    });
    setIsModalOpen(true);
  };

  // Mở Modal Sửa lịch
  const handleOpenEditModal = (sch: Schedule) => {
    setEditingSchedule(sch);
    setConflictError(null);

    const schUserId = typeof sch.userId === 'object' && sch.userId !== null ? (sch.userId as User)._id : sch.userId;
    const schShiftId = typeof sch.shiftId === 'object' && sch.shiftId !== null ? (sch.shiftId as ShiftConfig)._id : sch.shiftId;
    const shiftObj = shifts.find((s) => s._id === schShiftId);

    const formattedStartDate = sch.startDate ? new Date(sch.startDate).toISOString().split('T')[0] : '';
    const formattedEndDate = sch.endDate ? new Date(sch.endDate).toISOString().split('T')[0] : '';

    setFormData({
      userId: schUserId,
      shiftId: schShiftId,
      weekday: sch.weekday,
      roomId: sch.roomId || sch.room || '',
      subjectName: sch.subjectName || '',
      subjectCode: sch.subjectCode || '',
      startTime: sch.startTime || shiftObj?.startTime || '',
      endTime: sch.endTime || shiftObj?.endTime || '',
      startDate: formattedStartDate,
      endDate: formattedEndDate,
      isRecurring: sch.isRecurring !== undefined ? sch.isRecurring : true,
    });
    setIsModalOpen(true);
  };

  useEffect(() => {
    if (selectedFormUser && !canAssignSubject && (formData.subjectName || formData.subjectCode)) {
      setFormData((prev) => ({ ...prev, subjectName: '', subjectCode: '' }));
    }
  }, [selectedFormUser, canAssignSubject, formData.subjectName, formData.subjectCode]);

  // Thay đổi Ca làm việc trong form -> Tự động điền startTime / endTime tương ứng
  const handleShiftChange = (newShiftId: string) => {
    const shiftObj = shifts.find((s) => s._id === newShiftId);
    setFormData((prev) => ({
      ...prev,
      shiftId: newShiftId,
      startTime: shiftObj ? shiftObj.startTime : prev.startTime,
      endTime: shiftObj ? shiftObj.endTime : prev.endTime,
    }));
  };

  // Submit Form Tạo / Sửa
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setConflictError(null);

    if (!formData.userId) {
      toast.error('Vui lòng chọn Giảng viên / Nhân sự');
      return;
    }
    if (!formData.shiftId) {
      toast.error('Vui lòng chọn Ca học');
      return;
    }
    if (!formData.roomId.trim()) {
      toast.error('Vui lòng nhập hoặc chọn Phòng học');
      return;
    }
    if (!formData.startDate || !formData.endDate) {
      toast.error('Vui lòng chọn ngày bắt đầu và kết thúc');
      return;
    }
    if (new Date(formData.endDate) < new Date(formData.startDate)) {
      toast.error('Ngày kết thúc không được trước ngày bắt đầu');
      return;
    }

    try {
      setSubmitting(true);

      if (editingSchedule) {
        // Cập nhật
        const payload: UpdateSchedulePayload = {
          userId: formData.userId,
          shiftId: formData.shiftId,
          weekday: Number(formData.weekday),
          roomId: formData.roomId,
          subjectName: formData.subjectName,
          subjectCode: formData.subjectCode,
          startTime: formData.startTime,
          endTime: formData.endTime,
          startDate: formData.startDate,
          endDate: formData.endDate,
          isRecurring: formData.isRecurring,
        };
        const updated = await scheduleService.updateSchedule(editingSchedule._id, payload);
        toast.success('Cập nhật lịch phân công thành công!');
        setSchedules((prev) => prev.map((item) => (item._id === updated._id ? updated : item)));
        setIsModalOpen(false);
      } else {
        // Tạo mới
        const payload: CreateSchedulePayload = {
          userId: formData.userId,
          shiftId: formData.shiftId,
          weekday: Number(formData.weekday),
          roomId: formData.roomId,
          subjectName: formData.subjectName,
          subjectCode: formData.subjectCode,
          startTime: formData.startTime,
          endTime: formData.endTime,
          startDate: formData.startDate,
          endDate: formData.endDate,
          isRecurring: formData.isRecurring,
        };
        const created = await scheduleService.createSchedule(payload);
        toast.success('Tạo lịch phân công mới thành công!');
        setSchedules((prev) => [created, ...prev]);
        setIsModalOpen(false);
      }
    } catch (error: any) {
      const errResponse = error?.response?.data;
      const errorMsg = errResponse?.message || 'Có lỗi xảy ra khi lưu lịch phân công';

      // Xử lý xung đột lịch (Conflict Detection 409)
      if (error?.response?.status === 409) {
        setConflictError(errorMsg);
        toast.error('Xung đột thời gian: ' + errorMsg);
      } else {
        toast.error(errorMsg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Xác nhận Xóa lịch
  const handleDeleteSchedule = async () => {
    if (!deleteTarget) return;
    try {
      setIsDeleting(true);
      await scheduleService.deleteSchedule(deleteTarget._id);
      toast.success('Đã xóa lịch phân công thành công!');
      setSchedules((prev) => prev.filter((s) => s._id !== deleteTarget._id));
      setDeleteTarget(null);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Không thể xóa lịch phân công');
    } finally {
      setIsDeleting(false);
    }
  };

  // Lấy màu sắc nhận diện ca
  const getShiftTheme = (shiftName?: string) => {
    if (!shiftName) return SHIFT_THEMES['ca sáng'];
    const key = shiftName.toLowerCase();
    for (const [k, v] of Object.entries(SHIFT_THEMES)) {
      if (key.includes(k)) return v;
    }
    return SHIFT_THEMES['ca sáng'];
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header & Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Thời Khóa Biểu & Lịch Phân Công Giảng Dạy</h1>
              <p className="text-xs md:text-sm text-gray-500">
                {isPersonalOnly
                  ? 'Xem thời khóa biểu giảng dạy và ca công tác hàng tuần của bạn'
                  : 'Quản lý, phân công giảng dạy và điều phối phòng học theo tuần'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Chuyển chế độ Bảng tuần / Danh sách */}
          <div className="flex items-center bg-gray-100 p-1 rounded-lg border border-gray-200">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                viewMode === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Xem dạng Bảng tuần"
            >
              <LayoutGrid className="w-4 h-4" />
              <span>Bảng tuần</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                viewMode === 'table' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Xem dạng Danh sách chi tiết"
            >
              <List className="w-4 h-4" />
              <span>Danh sách</span>
            </button>
          </div>

          {/* Nút làm mới */}
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="p-2 text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
            title="Tải lại dữ liệu"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          {/* Nút Thêm lịch (chỉ Admin / Trưởng khoa) */}
          {canManage && (
            <button
              onClick={() => handleOpenCreateModal()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm hover:shadow transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo Lịch Phân Công</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Thống kê nhanh */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3.5">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-xs text-gray-500 font-medium">Tổng số ca phân công</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3.5">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{stats.lecturers}</div>
            <div className="text-xs text-gray-500 font-medium">Giảng viên / Nhân sự</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3.5">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{stats.rooms}</div>
            <div className="text-xs text-gray-500 font-medium">Phòng học & Giảng đường</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3.5">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{stats.today}</div>
            <div className="text-xs text-gray-500 font-medium">Ca dạy hôm nay ({WEEKDAYS.find((w) => w.value === currentWeekday)?.short})</div>
          </div>
        </div>
      </div>

      {/* 3. Bộ lọc điều kiện */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <Filter className="w-4 h-4 text-blue-600" />
          <span>Bộ lọc dữ liệu thời khóa biểu:</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Lọc theo Khoa / Đơn vị */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Khoa / Đơn vị</label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <select
                value={selectedDeptId}
                onChange={(e) => {
                  setSelectedDeptId(e.target.value);
                  // Nếu đổi khoa, reset chọn người nếu người cũ không thuộc khoa này
                  if (!isPersonalOnly) setSelectedUserId('all');
                }}
                disabled={isPersonalOnly}
                className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-lg bg-gray-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="all">-- Tất cả Khoa / Phòng ban --</option>
                {departments
                  .filter((d) => d.type === 'khoa' || d.type === 'phongban')
                  .map((dept) => (
                    <option key={dept._id} value={dept._id}>
                      {dept.type === 'khoa' ? '🏛️ ' : '🏢 '} {dept.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Lọc theo Giảng viên */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Giảng viên / Cán bộ</label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                disabled={isPersonalOnly}
                className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-lg bg-gray-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isPersonalOnly ? (
                  <option value={user?._id}>{user?.fullName} (Cá nhân bạn)</option>
                ) : (
                  <>
                    <option value="all">-- Tất cả Giảng viên ({filteredUsers.length}) --</option>
                    {filteredUsers.map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.fullName} ({u.email.split('@')[0]})
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>
          </div>

          {/* Lọc theo Ca làm việc */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Ca làm việc</label>
            <div className="relative">
              <Clock className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <select
                value={selectedShiftId}
                onChange={(e) => setSelectedShiftId(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-lg bg-gray-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">-- Tất cả Ca dạy --</option>
                {shifts.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name} ({s.startTime} - {s.endTime})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tìm kiếm phòng / từ khóa */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Tìm kiếm phòng học / từ khóa</label>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="VD: A2-301, Lab CNTT..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-lg bg-gray-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchKeyword && (
                <button
                  onClick={() => setSearchKeyword('')}
                  className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Trạng thái bộ lọc tích cực */}
        {(selectedDeptId !== 'all' || (selectedUserId !== 'all' && !isPersonalOnly) || selectedShiftId !== 'all' || searchKeyword) && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100 text-xs">
            <span className="text-gray-500 font-medium">Đang lọc theo:</span>
            {selectedDeptId !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium">
                Khoa: {departments.find((d) => d._id === selectedDeptId)?.name}
                <button onClick={() => setSelectedDeptId('all')} className="hover:text-blue-900">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedUserId !== 'all' && !isPersonalOnly && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-full font-medium">
                GV: {usersList.find((u) => u._id === selectedUserId)?.fullName}
                <button onClick={() => setSelectedUserId('all')} className="hover:text-indigo-900">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedShiftId !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-full font-medium">
                Ca: {shifts.find((s) => s._id === selectedShiftId)?.name}
                <button onClick={() => setSelectedShiftId('all')} className="hover:text-emerald-900">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {searchKeyword && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-gray-100 text-gray-700 rounded-full font-medium">
                Từ khóa: "{searchKeyword}"
                <button onClick={() => setSearchKeyword('')} className="hover:text-gray-900">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            <button
              onClick={() => {
                setSelectedDeptId('all');
                if (!isPersonalOnly) setSelectedUserId('all');
                setSelectedShiftId('all');
                setSearchKeyword('');
              }}
              className="text-blue-600 hover:text-blue-800 font-semibold underline ml-1"
            >
              Đặt lại tất cả
            </button>
          </div>
        )}
      </div>

      {/* 4. Nội dung chính: Chế độ Bảng tuần (Weekly Grid View) */}
      {viewMode === 'grid' ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Thanh Điều Hướng Tuần & Chọn Học Kỳ */}
          <div className="bg-slate-50/80 border-b border-gray-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-bold text-gray-700">Học kỳ:</span>
              <select
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(e.target.value)}
                className="px-2.5 py-1 text-xs bg-white border border-gray-300 rounded-lg font-semibold text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {SEMESTERS.map((sem) => (
                  <option key={sem.id} value={sem.id}>
                    {sem.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentWeekStart((prev) => new Date(prev.getTime() - 7 * 24 * 60 * 60 * 1000))}
                className="p-1.5 text-gray-600 hover:bg-white hover:shadow-xs rounded-lg border border-gray-200 transition"
                title="Tuần trước"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="text-xs font-bold text-gray-900 bg-white px-3 py-1 rounded-lg border border-gray-200 shadow-2xs">
                <span>Tuần: {weekRangeText}</span>
              </div>

              <button
                onClick={() => setCurrentWeekStart((prev) => new Date(prev.getTime() + 7 * 24 * 60 * 60 * 1000))}
                className="p-1.5 text-gray-600 hover:bg-white hover:shadow-xs rounded-lg border border-gray-200 transition"
                title="Tuần sau"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => setCurrentWeekStart(getMonday(new Date()))}
                className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-2.5 py-1 rounded-lg transition"
              >
                Tuần Hiện Tại
              </button>
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center">
              <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
              <p className="text-sm text-gray-500">Đang tải dữ liệu thời khóa biểu tuần...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] border-collapse">
                {/* Header Bảng: Các Thứ trong tuần kèm ngày cụ thể */}
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-700">
                    <th className="w-36 py-3.5 px-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-200 bg-gray-100/50">
                      Ca Giảng Dạy
                    </th>
                    {weekDaysWithDates.map((wd) => {
                      return (
                        <th
                          key={wd.value}
                          className={`py-3 px-3 text-center border-r border-gray-200 last:border-r-0 transition-colors ${
                            wd.isToday ? 'bg-blue-50/70 text-blue-700 font-bold ring-1 ring-inset ring-blue-200' : ''
                          }`}
                        >
                          <div className="flex flex-col items-center">
                            <span className="text-xs font-semibold uppercase">{wd.label}</span>
                            <span className="text-[11px] font-mono font-medium text-gray-500 mt-0.5">
                              {wd.dateFormatted}
                            </span>
                            {wd.isToday && (
                              <span className="mt-0.5 px-2 py-0.2 bg-blue-600 text-white text-[10px] font-bold rounded-full uppercase tracking-wider">
                                Hôm nay
                              </span>
                            )}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                {/* Body Bảng: Hàng theo Ca làm việc */}
                <tbody className="divide-y divide-gray-200">
                  {shifts.map((shift) => {
                    const theme = getShiftTheme(shift.name);

                    return (
                      <tr key={shift._id} className="hover:bg-gray-50/30 transition-colors">
                        {/* Cột Tên Ca */}
                        <td className="py-4 px-3 align-top border-r border-gray-200 bg-gray-50/40">
                          <div className="sticky left-0">
                            <div className="font-bold text-xs text-gray-900">{shift.name}</div>
                            <div className="flex items-center gap-1 text-[11px] text-gray-500 mt-1">
                              <Clock className="w-3 h-3 text-gray-400" />
                              <span>
                                {shift.startTime} - {shift.endTime}
                              </span>
                            </div>
                            <span className={`inline-block mt-2 px-2 py-0.5 text-[10px] font-semibold rounded-md ${theme.badge}`}>
                              Cho phép trễ: {shift.lateThresholdMinutes}p
                            </span>
                          </div>
                        </td>

                        {/* 7 Cột từ Thứ 2 đến Chủ Nhật */}
                        {WEEKDAYS.map((wd) => {
                          const isToday = wd.value === currentWeekday;

                          // Lấy các lịch trùng Ca và Thứ này
                          const cellSchedules = filteredSchedules.filter((sch) => {
                            const schShiftId = typeof sch.shiftId === 'object' && sch.shiftId !== null ? (sch.shiftId as ShiftConfig)._id : sch.shiftId;
                            const schWd = sch.weekday !== undefined ? Number(sch.weekday) : (sch.dayOfWeek !== undefined ? Number(sch.dayOfWeek) : -1);
                            return schWd === wd.value && String(schShiftId) === String(shift._id);
                          });

                          return (
                            <td
                              key={wd.value}
                              className={`p-2 align-top border-r border-gray-200 last:border-r-0 min-h-[120px] transition-colors relative group ${
                                isToday ? 'bg-blue-50/20' : ''
                              }`}
                            >
                              <div className="space-y-2 min-h-[100px]">
                                {cellSchedules.length > 0 ? (
                                  cellSchedules.map((sch) => {
                                    const schUserId = typeof sch.userId === 'object' && sch.userId !== null ? (sch.userId as User)._id : (sch.userId as string);
                                    const schUser = typeof sch.userId === 'object' && sch.userId !== null ? (sch.userId as User) : usersList.find((u) => u._id === schUserId) || null;
                                    const departmentInfo = getDepartmentInfo(schUser);

                                    return (
                                      <div
                                        key={sch._id}
                                        onClick={() => setDetailSchedule(sch)}
                                        className={`p-2.5 rounded-lg border text-left shadow-xs transition-all hover:shadow-md cursor-pointer ${theme.bg} ${theme.border} group/card relative`}
                                      >
                                        {/* Phòng học & Badge */}
                                        <div className="flex items-start justify-between gap-1 mb-1.5">
                                          <div className="flex items-center gap-1 text-xs font-bold text-gray-900 bg-white/90 px-2 py-0.5 rounded border border-gray-200/80 shadow-2xs">
                                            <MapPin className="w-3 h-3 text-red-500 shrink-0" />
                                            <span className="truncate max-w-[130px]">{sch.roomId || sch.room || 'Chưa xếp phòng'}</span>
                                          </div>

                                          {/* Thao tác Sửa / Xóa */}
                                          {canManage && (
                                            <div className="flex items-center gap-0.5 opacity-0 group-hover/card:opacity-100 transition-opacity bg-white/90 rounded border border-gray-200 px-1 py-0.5 shadow-2xs">
                                              <button
                                                onClick={(event) => {
                                                  event.stopPropagation();
                                                  setDetailSchedule(sch);
                                                }}
                                                className="p-1 text-gray-500 hover:text-emerald-600 rounded transition-colors"
                                                title="Xem chi tiết lịch"
                                              >
                                                <Eye className="w-3 h-3" />
                                              </button>
                                              <button
                                                onClick={(event) => {
                                                  event.stopPropagation();
                                                  handleOpenEditModal(sch);
                                                }}
                                                className="p-1 text-gray-500 hover:text-blue-600 rounded transition-colors"
                                                title="Chỉnh sửa lịch"
                                              >
                                                <Edit2 className="w-3 h-3" />
                                              </button>
                                              <button
                                                onClick={() => setDeleteTarget(sch)}
                                                className="p-1 text-gray-500 hover:text-red-600 rounded transition-colors"
                                                title="Xóa lịch"
                                              >
                                                <Trash2 className="w-3 h-3" />
                                              </button>
                                            </div>
                                          )}
                                        </div>

                                        {/* Giảng viên */}
                                        <div className="text-xs font-semibold text-gray-900 truncate">
                                          {schUser ? schUser.fullName : 'Cán bộ / Giảng viên'}
                                        </div>

                                        {/* Khoa / Bộ môn */}
                                        {departmentInfo.unitName && (
                                          <div className="text-[11px] text-gray-500 truncate flex items-center gap-1 mt-0.5">
                                            <Building2 className="w-2.5 h-2.5 text-gray-400 shrink-0" />
                                            <span className="truncate">
                                              {departmentInfo.facultyName && departmentInfo.facultyName !== departmentInfo.unitName
                                                ? `${departmentInfo.facultyName} / `
                                                : ''}
                                              {departmentInfo.unitName}
                                            </span>
                                          </div>
                                        )}

                                        {sch.subjectName && (
                                          <div className="text-[11px] text-blue-700 font-medium truncate mt-1">
                                            {sch.subjectCode ? `${sch.subjectCode} - ` : ''}{sch.subjectName}
                                          </div>
                                        )}

                                        {/* Khung giờ thực tế */}
                                        <div className="flex items-center justify-between text-[10px] text-gray-600 mt-1.5 pt-1 border-t border-gray-200/60 font-medium">
                                          <span>
                                            {sch.startTime || shift.startTime} - {sch.endTime || shift.endTime}
                                          </span>
                                          {sch.isRecurring && (
                                            <span className="text-blue-600 font-semibold text-[9px] bg-blue-100/80 px-1.5 py-0.2 rounded">
                                              Hàng tuần
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })
                                ) : (
                                  <div className="h-full flex flex-col items-center justify-center py-6 text-gray-300">
                                    <span className="text-[11px] font-medium text-gray-400/80">Trống</span>
                                  </div>
                                )}

                                {/* Nút Tạo nhanh tại ô này khi hover */}
                                {canManage && (
                                  <button
                                    onClick={() => handleOpenCreateModal(wd.value, shift._id)}
                                    className="w-full py-1 text-[11px] font-medium text-gray-500 hover:text-blue-600 hover:bg-blue-50/80 rounded border border-dashed border-gray-200 hover:border-blue-300 transition-all opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1"
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>Thêm lịch</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* 5. Nội dung dạng Danh Sách Bảng Chi Tiết (Table View) */
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Giảng Viên / Cán Bộ</th>
                  <th className="py-3 px-4">Khoa / Đơn Vị</th>
                  <th className="py-3 px-4">Thứ</th>
                  <th className="py-3 px-4">Ca Giảng Dạy</th>
                  <th className="py-3 px-4">Khung Giờ</th>
                  <th className="py-3 px-4">Phòng Học</th>
                  <th className="py-3 px-4">Thời Gian Áp Dụng</th>
                  <th className="py-3 px-4 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredSchedules.length > 0 ? (
                  filteredSchedules.map((sch) => {
                    const schUserId = typeof sch.userId === 'object' && sch.userId !== null ? (sch.userId as User)._id : (sch.userId as string);
                    const schUser = typeof sch.userId === 'object' && sch.userId !== null ? (sch.userId as User) : usersList.find((u) => u._id === schUserId) || null;
                    const schShift = typeof sch.shiftId === 'object' && sch.shiftId !== null ? (sch.shiftId as ShiftConfig) : null;
                    const schWd = sch.weekday !== undefined ? Number(sch.weekday) : (sch.dayOfWeek !== undefined ? Number(sch.dayOfWeek) : -1);
                    const wdObj = WEEKDAYS.find((w) => w.value === schWd);
                    const isToday = schWd === currentWeekday;
                    const departmentInfo = getDepartmentInfo(schUser);

                    return (
                      <tr key={sch._id} className="hover:bg-gray-50/60 transition-colors">
                        {/* Giảng viên */}
                        <td className="py-3.5 px-4 font-medium text-gray-900">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                              {schUser ? schUser.fullName.charAt(0) : 'U'}
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900">{schUser ? schUser.fullName : 'N/A'}</div>
                              <div className="text-[11px] text-gray-400">{schUser ? schUser.email : ''}</div>
                            </div>
                          </div>
                        </td>

                        {/* Khoa */}
                        <td className="py-3.5 px-4 text-gray-600">
                          <div className="flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5 text-gray-400" />
                            <span>
                              {departmentInfo.facultyName && departmentInfo.facultyName !== departmentInfo.unitName
                                ? `${departmentInfo.facultyName} / `
                                : ''}
                              {departmentInfo.unitName || 'Chưa phân bổ'}
                            </span>
                          </div>
                        </td>

                        {/* Thứ */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-semibold text-xs ${
                              isToday ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {wdObj ? wdObj.label : `Thứ ${sch.weekday + 1}`}
                            {isToday && <span className="ml-1 text-[10px] text-blue-600 font-bold">• Hôm nay</span>}
                          </span>
                        </td>

                        {/* Ca làm việc */}
                        <td className="py-3.5 px-4 font-medium text-gray-800">
                          {schShift ? schShift.name : 'Ca dạy'}
                        </td>

                        {/* Giờ học */}
                        <td className="py-3.5 px-4 text-gray-600 font-medium">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-gray-400" />
                            <span>
                              {sch.startTime || schShift?.startTime} - {sch.endTime || schShift?.endTime}
                            </span>
                          </div>
                        </td>

                        {/* Phòng học */}
                        <td className="py-3.5 px-4 font-semibold text-gray-900">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 rounded-md">
                            <MapPin className="w-3 h-3" />
                            {sch.roomId || sch.room || 'Chưa xếp'}
                          </span>
                          {sch.subjectName && (
                            <div className="mt-1 text-[11px] text-blue-700 font-medium">
                              {sch.subjectCode ? `${sch.subjectCode} - ` : ''}{sch.subjectName}
                            </div>
                          )}
                        </td>

                        {/* Thời gian hiệu lực */}
                        <td className="py-3.5 px-4 text-[11px] text-gray-500">
                          <div>
                            {sch.startDate ? new Date(sch.startDate).toLocaleDateString('vi-VN') : 'Từ đầu kỳ'}
                            {' - '}
                            {sch.endDate ? new Date(sch.endDate).toLocaleDateString('vi-VN') : 'Cuối kỳ'}
                          </div>
                          {sch.isRecurring && <div className="text-blue-600 font-semibold">Lặp lại hàng tuần</div>}
                        </td>

                        {/* Thao tác */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setDetailSchedule(sch)}
                              className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                              title="Xem chi tiết lịch"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {canManage && (
                              <>
                              <button
                                onClick={() => handleOpenEditModal(sch)}
                                className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Sửa lịch"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeleteTarget(sch)}
                                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Xóa lịch"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-gray-500">
                      Không tìm thấy lịch phân công nào phù hợp với bộ lọc.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. MODAL TẠO / SỬA LỊCH PHÂN CÔNG GIẢNG DẠY (POST / PUT /api/schedules) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-white/20 rounded-lg">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">
                    {editingSchedule ? 'Chỉnh Sửa Lịch Phân Công' : 'Tạo Mới Lịch Phân Công Giảng Dạy'}
                  </h3>
                  <p className="text-xs text-blue-100">
                    {editingSchedule
                      ? 'Điều chỉnh phòng học, ca dạy hoặc khung thời gian'
                      : 'Hệ thống tự động kiểm tra chống trùng lịch giáo viên'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmitForm} className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Alert hiển thị lỗi xung đột thời gian (Conflict Detection) */}
              {conflictError && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-800 animate-in slide-in-from-top duration-150">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">Không thể lưu do xung đột thời gian:</div>
                    <div className="mt-0.5">{conflictError}</div>
                  </div>
                </div>
              )}

              {/* 1. Chọn Giảng viên */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Giảng Viên / Cán Bộ Phân Công <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.userId}
                  onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                  disabled={isPersonalOnly}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-gray-100"
                >
                  <option value="">-- Chọn Giảng viên --</option>
                  {usersList.map((u) => {
                    const dept =
                      typeof u.departmentId === 'object' && u.departmentId !== null
                        ? (u.departmentId as Department).name
                        : '';
                    return (
                      <option key={u._id} value={u._id}>
                        {u.fullName} ({u.email}) {dept ? `[${dept}]` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* 2. Chọn Ca làm việc & Thứ trong tuần */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Ca Học <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.shiftId}
                    onChange={(e) => handleShiftChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="">-- Chọn Ca --</option>
                    {shifts.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name} ({s.startTime} - {s.endTime})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Thứ Trong Tuần <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.weekday}
                    onChange={(e) => setFormData({ ...formData, weekday: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {WEEKDAYS.map((w) => (
                      <option key={w.value} value={w.value}>
                        {w.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 3. Tùy chỉnh giờ dạy thực tế (Tự động lấy từ Ca hoặc tùy biến) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Giờ Bắt Đầu (HH:mm)</label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Giờ Kết Thúc (HH:mm)</label>
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* 4. Chọn Phòng học */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Phòng Học / Giảng Đường <span className="text-red-500">*</span>
                </label>
                <div className="space-y-1.5">
                  <input
                    type="text"
                    value={formData.roomId}
                    onChange={(e) => setFormData({ ...formData, roomId: e.target.value })}
                    placeholder="VD: Giảng đường A2-301 hoặc Lab CNTT 1"
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  {/* Gợi ý phòng phổ biến */}
                  <div className="flex flex-wrap items-center gap-1 text-[11px] text-gray-500">
                    <span className="font-medium">Gợi ý nhanh:</span>
                    {POPULAR_ROOMS.slice(0, 4).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setFormData({ ...formData, roomId: r })}
                        className="px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors text-[10px]"
                      >
                        {r.replace('Giảng đường ', '')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 4.5. Thông tin môn học, chỉ áp dụng cho người có nhiệm vụ giảng dạy */}
              {canAssignSubject && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Tên Môn Học
                  </label>
                  <input
                    type="text"
                    value={formData.subjectName}
                    onChange={(e) => setFormData({ ...formData, subjectName: e.target.value })}
                    placeholder="VD: Lập trình Web"
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Mã Môn Học
                  </label>
                  <input
                    type="text"
                    value={formData.subjectCode}
                    onChange={(e) => setFormData({ ...formData, subjectCode: e.target.value.toUpperCase() })}
                    placeholder="VD: CS201"
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none uppercase"
                  />
                </div>
              </div>
              )}

              {/* 5. Khung thời gian học kỳ (startDate -> endDate) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Ngày Bắt Đầu Hiệu Lực <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Ngày Kết Thúc Hiệu Lực <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* 6. Lặp lại hàng tuần */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isRecurringCheckbox"
                  checked={formData.isRecurring}
                  onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <label htmlFor="isRecurringCheckbox" className="text-xs font-semibold text-gray-700 cursor-pointer">
                  Lặp lại hàng tuần trong suốt khung thời gian học kỳ
                </label>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingSchedule ? 'Lưu Thay Đổi' : 'Xác Nhận Tạo Lịch'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. MODAL XEM CHI TIẾT LỊCH, mọi vai trò đều được xem */}
      {detailSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-slate-700 to-blue-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-white/20 rounded-lg">
                  <Info className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Chi tiết lịch phân công</h3>
                  <p className="text-xs text-blue-100">Thông tin giảng viên, đơn vị và môn học</p>
                </div>
              </div>
              <button
                onClick={() => setDetailSchedule(null)}
                className="p-1 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                title="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm">
              <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
                <div className="w-11 h-11 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  {detailUser?.fullName?.charAt(0) || 'U'}
                </div>
                <div>
                  <div className="font-bold text-gray-900">{detailUser?.fullName || 'Chưa xác định'}</div>
                  <div className="text-xs text-gray-500">{detailUser?.email || 'Không có email'}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                  <div className="text-[11px] text-blue-600 font-semibold uppercase">Môn học</div>
                  <div className="mt-1 font-semibold text-gray-900">{detailSchedule.subjectName || 'Không áp dụng'}</div>
                  {detailSchedule.subjectCode && <div className="text-xs text-gray-500">Mã: {detailSchedule.subjectCode}</div>}
                </div>
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                  <div className="text-[11px] text-emerald-600 font-semibold uppercase">Khoa / Đơn vị</div>
                  <div className="mt-1 font-semibold text-gray-900">{detailDepartmentInfo.facultyName || 'Chưa phân bổ'}</div>
                  {detailDepartmentInfo.unitName && detailDepartmentInfo.unitName !== detailDepartmentInfo.facultyName && (
                    <div className="text-xs text-gray-500">Bộ môn: {detailDepartmentInfo.unitName}</div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-y-3 gap-x-5 text-xs">
                <div><span className="text-gray-500">Thứ:</span> <strong>{WEEKDAYS.find((item) => item.value === detailSchedule.weekday)?.label || 'Chưa xác định'}</strong></div>
                <div><span className="text-gray-500">Ca:</span> <strong>{detailShift?.name || 'Chưa xác định'}</strong></div>
                <div><span className="text-gray-500">Thời gian:</span> <strong>{detailSchedule.startTime || detailShift?.startTime || '--:--'} - {detailSchedule.endTime || detailShift?.endTime || '--:--'}</strong></div>
                <div><span className="text-gray-500">Phòng:</span> <strong>{detailSchedule.roomId || detailSchedule.room || 'Chưa xếp phòng'}</strong></div>
                <div className="col-span-2"><span className="text-gray-500">Hiệu lực:</span> <strong>{detailSchedule.startDate ? new Date(detailSchedule.startDate).toLocaleDateString('vi-VN') : 'Từ đầu kỳ'} - {detailSchedule.endDate ? new Date(detailSchedule.endDate).toLocaleDateString('vi-VN') : 'Cuối kỳ'}</strong></div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setDetailSchedule(null)}
                  className="px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. MODAL XÁC NHẬN XÓA LỊCH */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Xác Nhận Xóa Lịch Phân Công</h3>
              <p className="text-xs text-gray-500 mt-1">
                Bạn có chắc chắn muốn xóa lịch phân công vào{' '}
                <span className="font-semibold text-gray-800">
                  {WEEKDAYS.find((w) => w.value === deleteTarget.weekday)?.label}
                </span>{' '}
                (Phòng: {deleteTarget.roomId || deleteTarget.room || 'N/A'})? Thao tác này không thể hoàn tác.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex-1"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleDeleteSchedule}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow transition-all disabled:opacity-50 flex-1 flex items-center justify-center gap-1.5"
              >
                {isDeleting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Xóa Ngay</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchedulesPage;
