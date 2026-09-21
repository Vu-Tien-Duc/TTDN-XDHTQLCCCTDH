import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  User as UserIcon,
  RefreshCw,
  HelpCircle,
  ShieldCheck,
  Zap,
  AlertTriangle,
  Clock,
  Calendar,
  CheckCircle2,
  XCircle,
  Users,
} from 'lucide-react';
import aiService, { AiChatResponseData, AiChatAmbiguousMatch } from '../../services/ai.service';
import { useAuth } from '../../contexts/AuthContext';
import { formatTime } from '../../utils';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  time: string;
  statistics?: any;
  intent?: string;
  isAmbiguous?: boolean;
  matches?: AiChatAmbiguousMatch[];
}

export const AiInspectorPage: React.FC = () => {
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const roleName =
    user?.role === 'admin'
      ? 'Quản trị viên (Admin)'
      : user?.role === 'truongkhoa'
      ? 'Trưởng khoa / Quản lý'
      : user?.role === 'giangvien'
      ? 'Giảng viên'
      : 'Cán bộ / Nhân viên';

  const getInitialWelcomeText = () => {
    const role = user?.role || 'giangvien';
    const name = user?.fullName || 'Thầy/Cô';

    if (role === 'giangvien') {
      return `### 👋 Xin chào Giảng viên ${name}!
Tôi là **Trợ lý AI Hỗ trợ Giảng viên**. Bạn có thể tra cứu nhanh các thông tin cá nhân:

- 📚 **Lịch giảng dạy:** Thời khóa biểu hôm nay, ngày mai, số buổi dạy trong tuần/tháng.
- ⏱️ **Chấm công & Chuyên cần:** Số buổi đúng giờ, đi trễ, về sớm, vắng có phép / không phép.
- 📑 **Đơn từ & Đổi ca:** Tiến độ xét duyệt đơn xin nghỉ, đăng ký dạy bù hoặc đổi ca.
- 💡 *Bấm vào các câu hỏi gợi ý bên trái để tra cứu tức thì.*`;
    }

    if (role === 'truongkhoa') {
      return `### 👋 Kính chào Trưởng khoa ${name}!
Tôi là **Trợ lý AI Quản trị Khoa & Bộ môn**. Hệ thống đã phân quyền phạm vi quản lý cho bạn:

- 🏛️ **Giám sát Khoa:** Số giảng viên có lịch dạy hôm nay, tổng số tiết giảng dạy.
- ⚠️ **Kỷ luật & Chuyên cần:** Danh sách cán bộ/giảng viên đi trễ, vắng mặt trong tuần/tháng.
- 📑 **Xét duyệt đơn từ:** Nắm bắt nhanh các đơn xin nghỉ, dạy bù, đổi ca đang chờ bạn phê duyệt.
- 🔍 **Tra cứu chi tiết:** Kiểm tra lịch dạy và chấm công của từng giảng viên trực thuộc khoa.`;
    }

    if (role === 'nhanvien') {
      return `### 👋 Xin chào Cán bộ/Nhân viên ${name}!
Tôi là **Trợ lý AI Hỗ trợ Chấm công Hành chính**. Bạn có thể hỏi tôi về:

- ⏱️ **Chấm công ca hành chính:** Số ngày đúng giờ, đi trễ, vắng mặt của bạn trong tháng.
- 📑 **Chế độ nghỉ phép:** Tình trạng đơn xin nghỉ phép, số ngày phép đã sử dụng.
- 💡 *Bấm vào các câu hỏi gợi ý bên trái để kiểm tra nhanh.*`;
    }

    // Role: ADMIN
    return `### 👋 Xin chào Quản trị viên ${name}!
Tôi là **Trợ lý AI Thanh tra & Quản lý Hệ thống**. Bạn có toàn quyền truy xuất CSDL toàn trường:

- 🌐 **Tổng quan toàn trường:** Thống kê số người đi làm, đi trễ, vắng mặt hôm nay theo thời gian thực.
- 🏆 **Thống kê chuyên sâu:** Xếp hạng đi trễ nhiều nhất, tỷ lệ chuyên cần theo từng Khoa/Phòng ban.
- 📑 **Hồ sơ đơn từ:** Thống kê đơn nghỉ toàn trường (chờ duyệt, đã duyệt, từ chối, dạy bù, đổi ca).
- 👤 **Tra cứu nhân sự:** Kiểm tra chấm công và lịch công tác của bất kỳ cán bộ, giảng viên nào.`;
  };

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: getInitialWelcomeText(),
      time: formatTime(new Date()),
    },
  ]);

  // Cập nhật lại lời chào khi thông tin người dùng được load
  useEffect(() => {
    setMessages([
      {
        id: 'welcome',
        sender: 'ai',
        text: getInitialWelcomeText(),
        time: formatTime(new Date()),
      },
    ]);
  }, [user?.role, user?.fullName]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async (questionText?: string) => {
    const q = (questionText || input).trim();
    if (!q || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: q,
      time: formatTime(new Date()),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await aiService.askAiAssistant(q);
      const data: AiChatResponseData | undefined = res.data;
      const aiText = data?.answer || 'Hệ thống đã nhận câu hỏi nhưng chưa có phản hồi.';

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: aiText,
        time: formatTime(new Date()),
        statistics: data?.statistics,
        intent: data?.intent,
        isAmbiguous: data?.isAmbiguous,
        matches: data?.matches,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: '⚠️ Không thể kết nối với máy chủ AI. Vui lòng kiểm tra lại kết nối mạng hoặc thử lại sau.',
        time: formatTime(new Date()),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // Tạo danh mục câu hỏi mẫu thông minh theo vai trò người dùng (RBAC)
  const getSampleCategories = () => {
    const role = user?.role || 'giangvien';

    // 1. GIẢNG VIÊN
    if (role === 'giangvien') {
      return [
        {
          title: 'Lịch Giảng Dạy Của Tôi',
          icon: Calendar,
          color: 'text-indigo-600',
          questions: [
            'Hôm nay lịch giảng dạy của tôi như thế nào?',
            'Ngày mai tôi có tiết dạy nào không?',
            'Tuần này tôi dạy bao nhiêu buổi?',
            'Trong tháng này tôi có bao nhiêu buổi dạy?',
          ],
        },
        {
          title: 'Chấm Công & Chuyên Cần Của Tôi',
          icon: Clock,
          color: 'text-amber-600',
          questions: [
            'Tôi hôm nay chấm công thế nào?',
            'Tuần này tôi đi trễ bao nhiêu lần?',
            'Tháng này tôi đúng giờ bao nhiêu ngày, vắng bao nhiêu ngày?',
            'Tháng này tôi vắng bao nhiêu ngày?',
          ],
        },
        {
          title: 'Đơn Nghỉ Phép & Dạy Bù Của Tôi',
          icon: ShieldCheck,
          color: 'text-emerald-600',
          questions: [
            'Đơn xin nghỉ của tôi đang trạng thái gì?',
            'Tháng này tổng số ngày nghỉ của tôi là bao nhiêu?',
            'Tuần này có bao nhiêu đơn dạy bù?',
            'Có bao nhiêu đơn đổi ca đang chờ duyệt?',
          ],
        },
      ];
    }

    // 2. TRƯỞNG KHOA
    if (role === 'truongkhoa') {
      return [
        {
          title: 'Quản Lý Lịch Dạy Của Khoa',
          icon: Calendar,
          color: 'text-blue-600',
          questions: [
            'Hôm nay khoa CNTT có bao nhiêu giảng viên có lịch dạy?',
            'Tuần này khoa CNTT có bao nhiêu tiết dạy?',
            'TS. Trần Thị Bích tuần này dạy bao nhiêu buổi?',
            'ThS. Phạm Văn Cường tuần này có lịch dạy không?',
          ],
        },
        {
          title: 'Kỷ Luật & Chuyên Cần Của Khoa',
          icon: Clock,
          color: 'text-amber-600',
          questions: [
            'Trong tháng này khoa CNTT có bao nhiêu lượt đi trễ?',
            'Trong tháng này khoa CNTT có bao nhiêu lượt vắng?',
            'Trong tuần này ai trong khoa đi trễ nhiều nhất?',
            'TS. Trần Thị Bích tháng này đi trễ bao nhiêu ngày?',
          ],
        },
        {
          title: 'Phê Duyệt Đơn Từ Thuộc Khoa',
          icon: ShieldCheck,
          color: 'text-emerald-600',
          questions: [
            'Có bao nhiêu đơn nghỉ đang chờ duyệt?',
            'Tuần này có bao nhiêu đơn xin nghỉ trong khoa?',
            'Tuần này có bao nhiêu đơn bị từ chối?',
            'Có bao nhiêu đơn đổi ca đang chờ duyệt?',
          ],
        },
      ];
    }

    // 3. NHÂN VIÊN HÀNH CHÍNH
    if (role === 'nhanvien') {
      return [
        {
          title: 'Giờ Làm Việc & Chấm Công Cá Nhân',
          icon: Clock,
          color: 'text-amber-600',
          questions: [
            'Tôi hôm nay chấm công thế nào?',
            'Tuần này tôi đi trễ bao nhiêu lần?',
            'Tháng này tôi chấm công đúng giờ bao nhiêu ngày?',
            'Tháng này tôi có ngày nào vắng không?',
          ],
        },
        {
          title: 'Đơn Nghỉ Phép & Chế Độ',
          icon: ShieldCheck,
          color: 'text-emerald-600',
          questions: [
            'Đơn xin nghỉ của tôi đang trạng thái gì?',
            'Tháng này tổng số ngày nghỉ của tôi là bao nhiêu?',
            'Có bao nhiêu đơn đổi ca đang chờ duyệt?',
          ],
        },
      ];
    }

    // 4. ADMIN (QUẢN TRỊ VIÊN)
    return [
      {
        title: 'Chuyên Cần Toàn Trường',
        icon: AlertTriangle,
        color: 'text-amber-600',
        questions: [
          'Hôm nay có bao nhiêu người đi làm?',
          'Hôm nay có bao nhiêu người đi trễ?',
          'Hôm nay có bao nhiêu người vắng?',
          'Trong tuần này ai đi trễ nhiều nhất?',
        ],
      },
      {
        title: 'Thanh Tra Cán Bộ & Giảng Viên',
        icon: Users,
        color: 'text-blue-600',
        questions: [
          'TS. Trần Thị Bích tháng này đúng giờ bao nhiêu ngày?',
          'TS. Trần Thị Bích tháng này đi trễ bao nhiêu ngày?',
          'Tháng này tổng số ngày nghỉ của TS. Trần Thị Bích là bao nhiêu?',
          'ThS. Phạm Văn Cường tuần này dạy bao nhiêu buổi?',
        ],
      },
      {
        title: 'Tổng Hợp Đơn & Báo Cáo Toàn Trường',
        icon: Sparkles,
        color: 'text-indigo-600',
        questions: [
          'Có bao nhiêu đơn nghỉ đang chờ duyệt?',
          'Tháng này có bao nhiêu đơn nghỉ được duyệt?',
          'Tuần này có bao nhiêu đơn bị từ chối?',
          'Tuần này có bao nhiêu đơn dạy bù?',
        ],
      },
    ];
  };

  const sampleCategories = getSampleCategories();

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold text-blue-200 border border-white/15">
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              AI Analytics Engine: Dữ Liệu Thời Gian Thực MongoDB
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              Trợ Lý AI Chấm Công & Quản Lý Giảng Dạy
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Hỏi đáp bằng tiếng Việt tự nhiên về lịch dạy, chấm công, đơn nghỉ và báo cáo chuyên cần. Số liệu được tính toán chính xác 100% từ cơ sở dữ liệu.
            </p>
          </div>

          <div className="flex flex-col items-start md:items-end gap-1.5 shrink-0">
            <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/10">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-xs font-bold text-slate-200">{roleName}</span>
            </div>
            <span className="text-[11px] text-blue-300 font-mono">Múi giờ: Asia/Ho_Chi_Minh (UTC+7)</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Side: Role-based Suggested Questions */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-blue-600" />
            Gợi Ý Câu Hỏi Theo Vai Trò
          </h3>

          {sampleCategories.map((cat, idx) => {
            const Icon = cat.icon;
            return (
              <div
                key={idx}
                className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-2.5 hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${cat.color}`} />
                  <h4 className="text-xs font-bold text-slate-900">{cat.title}</h4>
                </div>
                <div className="space-y-1.5">
                  {cat.questions.map((q, qIdx) => (
                    <button
                      key={qIdx}
                      onClick={() => handleSend(q)}
                      disabled={isLoading}
                      className="w-full text-left p-2 rounded-lg bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-700 text-[11px] leading-snug transition-colors border border-slate-100 disabled:opacity-50"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Side: Chat Window */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200/80 shadow-sm flex flex-col h-[700px] overflow-hidden">
          {/* Chat Messages */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-slate-50/40">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'ai' && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 mt-1 shadow-sm">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[88%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-blue-600 text-white rounded-br-none shadow-sm'
                      : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-none shadow-sm'
                  }`}
                >
                  <div className="whitespace-pre-wrap font-sans space-y-2">{msg.text}</div>

                  {/* Hiển thị danh sách người dùng khi bị trùng tên để chọn trực tiếp */}
                  {msg.isAmbiguous && msg.matches && msg.matches.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-200/80 space-y-2">
                      <p className="text-xs font-semibold text-slate-700">Chọn người bạn muốn xem:</p>
                      <div className="flex flex-wrap gap-2">
                        {msg.matches.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => handleSend(`${m.fullName} tháng này đi trễ bao nhiêu ngày?`)}
                            className="px-3 py-1.5 text-[11px] font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
                          >
                            👉 {m.fullName} ({m.departmentName})
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Visual Badges tóm tắt số liệu nếu có */}
                  {msg.statistics && typeof msg.statistics === 'object' && !msg.isAmbiguous && (
                    <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-2 text-[11px]">
                      {msg.statistics.onTime !== undefined && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> Đúng giờ: {msg.statistics.onTime}
                        </span>
                      )}
                      {msg.statistics.late !== undefined && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-semibold border border-amber-200">
                          <Clock className="w-3 h-3" /> Đi trễ: {msg.statistics.late}
                        </span>
                      )}
                      {msg.statistics.absent !== undefined && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 font-semibold border border-rose-200">
                          <XCircle className="w-3 h-3" /> Vắng: {msg.statistics.absent}
                        </span>
                      )}
                      {msg.statistics.excusedAbsent !== undefined && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                          <ShieldCheck className="w-3 h-3" /> Có phép: {msg.statistics.excusedAbsent}
                        </span>
                      )}
                      {msg.statistics.totalActualSessions !== undefined && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200">
                          <Calendar className="w-3 h-3" /> Số buổi dạy: {msg.statistics.totalActualSessions}
                        </span>
                      )}
                      {msg.statistics.pending !== undefined && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-semibold border border-amber-200">
                          <Clock className="w-3 h-3" /> Chờ duyệt: {msg.statistics.pending}
                        </span>
                      )}
                      {msg.statistics.approved !== undefined && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> Đã duyệt: {msg.statistics.approved}
                        </span>
                      )}
                    </div>
                  )}

                  <div
                    className={`mt-2 text-[10px] text-right font-mono ${
                      msg.sender === 'user' ? 'text-blue-100' : 'text-slate-400'
                    }`}
                  >
                    {msg.time}
                  </div>
                </div>

                {msg.sender === 'user' && (
                  <div className="w-8 h-8 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 mt-1">
                    <UserIcon className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 mt-1 shadow-sm">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                </div>
                <div className="bg-white border border-slate-200/80 rounded-2xl rounded-bl-none p-4 text-xs text-slate-600 shadow-sm flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce"></span>
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce delay-150"></span>
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce delay-300"></span>
                  <span className="font-medium">Trợ lý AI đang truy vấn CSDL MongoDB và tổng hợp số liệu...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input */}
          <div className="p-4 bg-white border-t border-slate-200">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-3"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Đặt câu hỏi bằng tiếng Việt: chấm công, lịch dạy, đơn nghỉ, vắng mặt..."
                className="flex-1 px-4 py-3 bg-slate-50 focus:bg-white text-slate-800 placeholder-slate-400 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="px-5 py-3 bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:opacity-50 text-white font-bold rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center gap-2 shrink-0 text-xs sm:text-sm"
              >
                <Send className="w-4 h-4" />
                Gửi Câu Hỏi
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AiInspectorPage;
