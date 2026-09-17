import { Toaster, toast } from 'react-hot-toast';
import { 
  Building2, 
  CheckCircle2, 
  Clock, 
  FolderTree, 
  Network, 
  ShieldCheck, 
  Users, 
  Zap 
} from 'lucide-react';

export default function App() {
  const handleTestNotification = () => {
    toast.success('Hệ thống Toast thông báo hoạt động hoàn hảo!', {
      duration: 3000,
      icon: '🎉',
    });
  };

  const day1Milestones = [
    {
      title: 'Khởi tạo Vite & TypeScript',
      desc: 'React 19 + TypeScript + Vite 8 cấu hình chuẩn bundler',
      status: 'completed',
    },
    {
      title: 'Cấu hình TailwindCSS v3 & PostCSS',
      desc: 'Hệ màu Navy/Blue giáo dục, typography Inter, animations',
      status: 'completed',
    },
    {
      title: 'Vite Proxy Server',
      desc: 'Tự động chuyển tiếp /api và /uploads về http://localhost:5000',
      status: 'completed',
    },
    {
      title: 'Cấu trúc thư mục chuẩn (8/8)',
      desc: 'components, pages, services, contexts, hooks, types, utils, layouts',
      status: 'completed',
    },
    {
      title: 'Thư viện cốt lõi & Tiện ích',
      desc: 'react-router-dom, lucide-react, axios, react-hot-toast',
      status: 'completed',
    },
  ];

  const folders = [
    { name: 'src/components', desc: 'UI Components dùng chung (Button, Input, Modal, Table...)' },
    { name: 'src/pages', desc: 'Các màn hình chức năng (Login, Departments, Users...)' },
    { name: 'src/services', desc: 'Axios Client, Interceptors & Gọi API' },
    { name: 'src/contexts', desc: 'Quản lý trạng thái đăng nhập (AuthContext)' },
    { name: 'src/hooks', desc: 'Các custom hooks nghiệp vụ' },
    { name: 'src/types', desc: 'Định nghĩa TypeScript Domain Models & API Interfaces' },
    { name: 'src/utils', desc: 'Hàm xử lý ngày giờ, định dạng, lưu trữ token' },
    { name: 'src/layouts', desc: 'Khung bố cục Sidebar, Header đa phân quyền' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between">
      <Toaster position="top-right" reverseOrder={false} />

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/30">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">
                HỆ THỐNG QUẢN LÝ CHẤM CÔNG
              </h1>
              <p className="text-xs text-slate-500">Trường Đại học • Thành viên A (Core Frontend)</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Ngày 1: Hoàn tất
            </span>
            <button
              onClick={handleTestNotification}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-medium rounded-lg shadow-sm transition-all flex items-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5" />
              Kiểm tra Toast
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-8 flex-1">
        {/* Banner */}
        <div className="bg-gradient-to-br from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="relative z-10 max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-medium text-blue-200 border border-white/10">
              <ShieldCheck className="w-3.5 h-3.5" />
              Tuần 1: Dựng Nền Tảng (Core Frontend) & Màn Hình CRUD Hệ Thống
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Khởi Tạo Dự Án & Cấu Hình Môi Trường Thành Công
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Môi trường làm việc cho Thành viên A đã được thiết lập hoàn chỉnh với đầy đủ các thư viện, 
              cấu hình Proxy API, hệ thống kiểu dữ liệu TypeScript và cấu trúc thư mục quy chuẩn sẵn sàng cho Ngày 2 (Design System & Axios Interceptors).
            </p>
          </div>
        </div>

        {/* Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
              <Network className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-1">Cấu Hình Proxy Server</h3>
            <p className="text-xs text-slate-500 mb-3">
              Tất cả các yêu cầu đến <code className="bg-slate-100 text-blue-600 px-1 py-0.5 rounded">/api</code> và <code className="bg-slate-100 text-blue-600 px-1 py-0.5 rounded">/uploads</code> đều được Vite chuyển tiếp tới:
            </p>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 font-mono text-xs text-slate-700">
              http://localhost:5000
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
              <FolderTree className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-1">Cấu Trúc Thư Mục Chuẩn</h3>
            <p className="text-xs text-slate-500 mb-3">
              Thiết lập 8 phân hệ cốt lõi với TypeScript Domain Models và Path Aliases <code className="bg-slate-100 text-blue-600 px-1 py-0.5 rounded">@/*</code>:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {['components', 'pages', 'services', 'contexts', 'hooks', 'types', 'utils', 'layouts'].map((folder) => (
                <span key={folder} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] font-mono">
                  {folder}/
                </span>
              ))}
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mb-4">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-1">Sẵn Sàng Cho Nhóm</h3>
            <p className="text-xs text-slate-500 mb-3">
              Nền tảng đồng bộ phục vụ TV B (Chấm công Face ID) và TV C (Đơn từ & Chat AI):
            </p>
            <div className="space-y-1.5 text-xs text-slate-600">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>TailwindCSS v3 + PostCSS</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Axios + React Hot Toast</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>React Router v7 + Lucide Icons</span>
              </div>
            </div>
          </div>
        </div>

        {/* Milestones checklist */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Day 1 Checklist */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              Chi Tiết Công Việc Ngày 1 (Thứ 2)
            </h3>
            <div className="space-y-3">
              {day1Milestones.map((item, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800">{item.title}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Directory Architecture */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <FolderTree className="w-5 h-5 text-indigo-600" />
              Sơ Đồ Tổ Chức Thư Mục Mã Nguồn (src/)
            </h3>
            <div className="divide-y divide-slate-100">
              {folders.map((item, idx) => (
                <div key={idx} className="py-2.5 flex items-start justify-between gap-4">
                  <span className="font-mono text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                    {item.name}
                  </span>
                  <span className="text-xs text-slate-600 text-right">{item.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        Đồ án Tốt nghiệp: Xây Dựng Hệ Thống Quản Lý Chấm Công Công Tác Đại Học • Frontend Core
      </footer>
    </div>
  );
}
