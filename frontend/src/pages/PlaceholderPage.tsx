import React from 'react';
import { useLocation } from 'react-router-dom';
import { Layers, CheckCircle, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

interface PlaceholderProps {
  title?: string;
  description?: string;
}

export const PlaceholderPage: React.FC<PlaceholderProps> = ({ title, description }) => {
  const location = useLocation();

  const getPageInfo = () => {
    switch (location.pathname) {
      case '/departments':
        return {
          name: 'Cơ Cấu Tổ Chức & Phòng Ban',
          desc: 'Quản lý mô hình trường, các khoa và bộ môn trực thuộc (Department Model).',
        };
      case '/users':
        return {
          name: 'Quản Lý Cán Bộ & Giảng Viên',
          desc: 'Quản trị danh sách nhân sự, phân quyền vai trò và hạn mức ngày phép.',
        };
      case '/shifts':
        return {
          name: 'Danh Mục Ca Làm Việc',
          desc: 'Cấu hình khung giờ bắt đầu, giờ kết thúc và ngưỡng trễ (ShiftConfig).',
        };
      case '/schedules':
        return {
          name: 'Phân Công Lịch Dạy & Công Tác',
          desc: 'Quản lý lịch giảng dạy theo học kỳ, phòng học và kiểm tra chống trùng lịch.',
        };
      case '/attendance':
        return {
          name: 'Nhật Ký Chấm Công & Điểm Danh',
          desc: 'Theo dõi check-in, check-out, đối soát giờ thực tế theo ca và điều chỉnh công.',
        };
      case '/leave-requests':
        return {
          name: 'Quản Lý Đơn Từ & Nghỉ Phép',
          desc: 'Quy trình nộp đơn, đính kèm file minh chứng và phê duyệt phân cấp.',
        };
      case '/reports':
        return {
          name: 'Báo Cáo & Thống Kê Tổng Hợp',
          desc: 'Báo cáo tổng kết chấm công, tỷ lệ đi muộn và số ngày nghỉ theo tháng.',
        };
      case '/audit-logs':
        return {
          name: 'Nhật Ký Kiểm Toán (Audit Logs)',
          desc: 'Truy vết toàn diện các thao tác nhạy cảm của người dùng trên hệ thống.',
        };
      default:
        return {
          name: title || 'Phân Hệ Đang Phát Triển',
          desc: description || 'Giao diện phân hệ này đang được kết nối với API Backend tương ứng.',
        };
    }
  };

  const info = getPageInfo();

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 text-center max-w-2xl mx-auto my-6 shadow-xs">
      <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-5">
        <Layers className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{info.name}</h2>
      <p className="text-slate-500 text-sm mt-2 leading-relaxed">{info.desc}</p>

      <div className="mt-6 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-left text-xs text-slate-600 space-y-2">
        <div className="flex items-center gap-2 font-semibold text-slate-800">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>Trạng thái Backend API: Sẵn sàng kết nối</span>
        </div>
        <p className="text-slate-500 pl-6">
          Endpoint REST API và Controllers đã được triển khai đầy đủ trên Express 5 & MongoDB Mongoose.
        </p>
      </div>

      <div className="mt-8 flex items-center justify-center gap-4">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Về Bảng Điều Khiển</span>
        </Link>
      </div>
    </div>
  );
};

export default PlaceholderPage;
