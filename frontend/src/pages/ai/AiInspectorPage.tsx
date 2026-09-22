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
  Copy,
  Check,
  ExternalLink,
  BookOpen,
  Cpu,
  Trash2,
  ChevronRight,
  X,
  MessageSquare,
} from 'lucide-react';
import toast from 'react-hot-toast';
import aiService, { AiChatResponseData, AiChatAmbiguousMatch } from '../../services/ai.service';
import { useAuth } from '../../contexts/AuthContext';
import { formatTime } from '../../utils';
import { GeminiStar } from '../../components/ai/AiChatWidget';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  time: string;
  statistics?: any;
  intent?: string;
  isAmbiguous?: boolean;
  matches?: AiChatAmbiguousMatch[];
  agentMode?: 'attendance' | 'academic' | 'general';
}

type AgentMode = 'attendance' | 'academic' | 'general';


// Hàm format hiển thị thông minh cho AI, hỗ trợ tiêu đề, bullet, bold, code block, table
const renderFormattedAiText = (content: string, isUser: boolean) => {
  if (isUser) {
    return <div className="whitespace-pre-wrap font-sans leading-relaxed">{content}</div>;
  }

  const lines = content.split('\n');

  return (
    <div className="space-y-1.5 font-sans leading-relaxed text-xs sm:text-sm">
      {lines.map((rawLine, idx) => {
        const line = rawLine.trim();
        if (!line) {
          return <div key={idx} className="h-1" />;
        }

        // Dòng tiêu đề: ### hoặc ## hoặc #
        if (line.startsWith('###') || line.startsWith('##') || line.startsWith('#')) {
          const cleanHeading = line.replace(/^#+\s*/, '').replace(/\*\*/g, '');
          return (
            <div
              key={idx}
              className="font-bold text-slate-900 text-sm sm:text-base mt-2.5 mb-1 pb-1 border-b border-slate-200/80 flex items-center gap-1.5"
            >
              <span>{cleanHeading}</span>
            </div>
          );
        }

        // Dòng code hoặc trích dẫn
        if (line.startsWith('```') || line.endsWith('```')) {
          return null;
        }

        // Dòng gạch đầu dòng: * hoặc - hoặc •
        const isBullet = /^[-*•]\s+/.test(line);
        const textToProcess = isBullet ? line.replace(/^[-*•]\s+/, '') : line;

        // Dòng số thứ tự 1. 2. 3.
        const isNumbered = /^\d+\.\s+/.test(line);

        // Xử lý các đoạn in đậm **text** và `code`
        const parts = textToProcess.split(/(\*\*[^*]+?\*\*|`[^`]+?`)/g);
        const inlineElements = parts.map((part, pIdx) => {
          if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
            const boldText = part.slice(2, -2);
            return (
              <strong key={pIdx} className="font-bold text-slate-900">
                {boldText}
              </strong>
            );
          }
          if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
            const codeText = part.slice(1, -1);
            return (
              <code key={pIdx} className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-[11px] text-blue-700 border border-slate-200">
                {codeText}
              </code>
            );
          }
          return <span key={pIdx}>{part}</span>;
        });

        if (isBullet) {
          return (
            <div key={idx} className="flex items-start gap-2 ml-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0 mt-2"></span>
              <span className="flex-1">{inlineElements}</span>
            </div>
          );
        }

        if (isNumbered) {
          return (
            <div key={idx} className="ml-1 pl-1">
              {inlineElements}
            </div>
          );
        }

        return <p key={idx}>{inlineElements}</p>;
      })}
    </div>
  );
};

export const AiInspectorPage: React.FC = () => {
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeAgent, setActiveAgent] = useState<AgentMode>('attendance');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const selectedModel = 'gemini-3.5-flash-lite';

  const roleName =
    user?.role === 'admin'
      ? 'Quản trị viên (Admin)'
      : user?.role === 'truongkhoa'
      ? 'Trưởng khoa / Quản lý'
      : user?.role === 'giangvien'
      ? 'Giảng viên'
      : 'Cán bộ / Nhân viên';

  const getInitialWelcomeText = (agent: AgentMode = activeAgent) => {
    const role = user?.role || 'giangvien';
    const rawName = user?.fullName || '';

    if (agent === 'academic') {
      return `### 🎓 Trợ Lý Học Thuật & Giáo Dục Đại Học
Chào ${rawName || 'Thầy/Cô'}! Tôi là **Academic AI Agent**, hoạt động dựa trên nền tảng **Google AI Studio (Gemini 3.5 Flash-Lite Siêu Tốc)**.

Tôi có thể hỗ trợ bạn các tác vụ chuyên môn:
- 📝 **Soạn giáo án & Đề cương:** Lập kế hoạch bài giảng, chuẩn đầu ra môn học (CLO/PLO).
- ❓ **Ngân hàng câu hỏi:** Tạo câu hỏi trắc nghiệm, tự luận, ma trận đề kiểm tra có đáp án.
- 📖 **Quy chế & Quy định:** Giải thích quy chế đào tạo tín chỉ, tính điểm học phần, nề nếp thi cử.
- 💡 *Hãy nhập yêu cầu của bạn hoặc chọn các câu hỏi mẫu bên dưới.*`;
    }

    if (agent === 'general') {
      return `### ⚡ Trợ Lý AI Đa Năng (Google AI Studio)
Chào ${rawName || 'Bạn'}! Bạn đang kích hoạt chế độ **General AI Agent (Gemini 3.5 Flash-Lite)**.

Tôi sẵn sàng hỗ trợ giải đáp mọi lĩnh vực:
- 🌐 Kiến thức công nghệ, lập trình, trí tuệ nhân tạo và chuyển đổi số.
- ✍️ Soạn thảo văn bản hành chính, thông báo, thư ngỏ, biên bản họp.
- 🔍 Phân tích, tổng hợp thông tin, dịch thuật đa ngôn ngữ và giải quyết vấn đề.
- 🚀 *Mô hình kết nối trực tiếp với Google AI Studio thông qua biến môi trường .env máy chủ.*`;
    }

    // Default: Attendance Agent
    if (role === 'giangvien') {
      const gvGreeting = rawName.toLowerCase().startsWith('giảng viên') || rawName.toLowerCase().startsWith('thầy') || rawName.toLowerCase().startsWith('cô')
        ? rawName
        : `Giảng viên ${rawName}`;
      return `### 👋 Xin chào ${gvGreeting || 'Thầy/Cô'}!
Tôi là **Trợ lý AI Điểm Danh & Lịch Giảng Dạy**. Dữ liệu được trích xuất thời gian thực từ MongoDB:

- 📚 **Lịch giảng dạy:** Thời khóa biểu hôm nay, ngày mai, số buổi dạy trong tuần/tháng.
- ⏱️ **Chấm công & Chuyên cần:** Số buổi đúng giờ, đi trễ, về sớm, vắng có phép / không phép.
- 📑 **Đơn từ & Đổi ca:** Tiến độ xét duyệt đơn xin nghỉ, đăng ký dạy bù hoặc đổi ca.
- 💡 *Bấm vào các câu hỏi gợi ý bên dưới để tra cứu ngay.*`;
    }

    if (role === 'truongkhoa') {
      const tkGreeting = rawName.toLowerCase().startsWith('trưởng khoa') ? rawName : `Trưởng khoa ${rawName}`;
      return `### 👋 Kính chào ${tkGreeting || 'Thầy/Cô Trưởng khoa'}!
Tôi là **Trợ lý AI Giám Sát Chấm Công & Đào Tạo Khoa**:

- 🏛️ **Giám sát Khoa:** Số giảng viên có lịch dạy hôm nay, tổng số tiết giảng dạy.
- ⚠️ **Kỷ luật & Chuyên cần:** Danh sách cán bộ/giảng viên đi trễ, vắng mặt trong tuần/tháng.
- 📑 **Xét duyệt đơn từ:** Nắm bắt nhanh các đơn xin nghỉ, dạy bù, đổi ca đang chờ duyệt.
- 🔍 **Tra cứu chi tiết:** Kiểm tra lịch dạy và chấm công của từng giảng viên trong khoa.`;
    }

    if (role === 'nhanvien') {
      return `### 👋 Xin chào ${rawName || 'Cán bộ/Nhân viên'}!
Tôi là **Trợ lý AI Hỗ trợ Chấm công Hành chính**:

- ⏱️ **Chấm công ca hành chính:** Số ngày đúng giờ, đi trễ, vắng mặt của bạn trong tháng.
- 📑 **Chế độ nghỉ phép:** Tình trạng đơn xin nghỉ phép, số ngày phép đã sử dụng.`;
    }

    // Admin
    const adminGreeting = rawName.toLowerCase().startsWith('quản trị') ? rawName : `Quản trị viên ${rawName}`;
    return `### 👋 Xin chào ${adminGreeting || 'Quản trị viên'}!
Tôi là **Trợ lý AI Thanh tra & Quản lý Hệ thống Toàn Trường**:

- 🌐 **Tổng quan toàn trường:** Thống kê số người đi làm, đi trễ, vắng mặt hôm nay.
- 🏆 **Thống kê chuyên sâu:** Top đi trễ nhiều nhất, tỷ lệ chuyên cần theo từng Khoa/Phòng ban.
- 📑 **Hồ sơ đơn từ:** Thống kê đơn nghỉ toàn trường (chờ duyệt, đã duyệt, từ chối, dạy bù, đổi ca).
- 👤 **Tra cứu nhân sự:** Kiểm tra chấm công và lịch công tác của bất kỳ cán bộ nào.`;
  };

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: getInitialWelcomeText('attendance'),
      time: formatTime(new Date()),
      agentMode: 'attendance',
    },
  ]);

  // Cập nhật lại tin chào khi chuyển Agent
  const handleSwitchAgent = (newAgent: AgentMode) => {
    setActiveAgent(newAgent);
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        sender: 'ai',
        text: getInitialWelcomeText(newAgent),
        time: formatTime(new Date()),
        agentMode: newAgent,
      },
    ]);
  };

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
      agentMode: activeAgent,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await aiService.askAiAssistant({
        message: q,
        agentMode: activeAgent,
        model: selectedModel,
      });

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
        agentMode: activeAgent,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: '⚠️ Không thể kết nối với dịch vụ AI. Vui lòng kiểm tra lại kết nối mạng hoặc biến GEMINI_API_KEY trong file .env trên máy chủ.',
        time: formatTime(new Date()),
        agentMode: activeAgent,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Đã sao chép câu trả lời vào clipboard!', { id: 'copy-toast', duration: 1500 });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: Date.now().toString(),
        sender: 'ai',
        text: getInitialWelcomeText(activeAgent),
        time: formatTime(new Date()),
        agentMode: activeAgent,
      },
    ]);
    toast.success('Đã làm mới phiên hội thoại!');
  };

  // Danh mục câu hỏi theo Agent và vai trò người dùng
  const getAgentSampleQuestions = () => {
    if (activeAgent === 'academic') {
      return [
        {
          title: 'Soạn Giáo Án & Đề Cương',
          icon: BookOpen,
          color: 'text-indigo-600',
          questions: [
            'Soạn đề cương chi tiết học phần Lập trình Web cho 3 tín chỉ',
            'Xây dựng chuẩn đầu ra (CLO) cho môn Cơ sở dữ liệu',
            'Gợi ý giáo án 1 buổi học 3 tiết về Thuật toán tìm kiếm',
            'Đề xuất tài liệu tham khảo và giáo trình cho môn AI',
          ],
        },
        {
          title: 'Ngân Hàng Câu Hỏi & Đề Thi',
          icon: Cpu,
          color: 'text-blue-600',
          questions: [
            'Tạo 5 câu hỏi trắc nghiệm 4 đáp án về Mạng máy tính kèm giải thích',
            'Xây dựng 3 bài tập tự luận môn Cấu trúc dữ liệu có thang điểm',
            'Gợi ý ma trận đề thi cuối kỳ môn Kiến trúc máy tính',
            'Tạo câu hỏi tình huống thực tế cho môn Quản trị dự án',
          ],
        },
        {
          title: 'Phương Pháp Sư Phạm & Quy Chế',
          icon: ShieldCheck,
          color: 'text-emerald-600',
          questions: [
            'Các phương pháp dạy học tích cực hiệu quả trong đại học',
            'Cách đánh giá điểm chuyên cần và điểm quá trình công bằng',
            'Quy định đào tạo theo học chế tín chỉ về số tiết nghỉ tối đa',
            'Hướng dẫn ứng dụng AI để nâng cao chất lượng bài giảng',
          ],
        },
      ];
    }

    if (activeAgent === 'general') {
      return [
        {
          title: 'Soạn Thảo Văn Bản & Báo Cáo',
          icon: Sparkles,
          color: 'text-amber-600',
          questions: [
            'Soạn mẫu thông báo dời lịch học cho sinh viên bằng văn phong sư phạm',
            'Viết email xin nghỉ phép dạy do công tác đột xuất gửi Trưởng khoa',
            'Tóm tắt các nguyên tắc quản lý thời gian hiệu quả cho giảng viên',
            'Soạn biên bản họp bộ môn tổng kết học kỳ',
          ],
        },
        {
          title: 'Công Nghệ & Trí Tuệ Nhân Tạo',
          icon: Cpu,
          color: 'text-indigo-600',
          questions: [
            'Giải thích khái niệm RAG (Retrieval-Augmented Generation) dễ hiểu',
            'Cách tích hợp Google Gemini API vào ứng dụng web React Node.js',
            'So sánh kiến trúc Microservices và Monolithic',
            'Các xu hướng công nghệ nổi bật trong giáo dục đại học 2026',
          ],
        },
      ];
    }

    // Attendance Agent
    const role = user?.role || 'giangvien';
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
          title: 'Chấm Công & Chuyên Cần Cá Nhân',
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
          title: 'Đơn Nghỉ Phép & Dạy Bù',
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

    if (role === 'truongkhoa') {
      return [
        {
          title: 'Lịch Dạy Thuộc Khoa',
          icon: Calendar,
          color: 'text-blue-600',
          questions: [
            'Hôm nay khoa có bao nhiêu giảng viên có lịch dạy?',
            'Tuần này khoa có bao nhiêu tiết dạy?',
            'TS. Trần Thị Bích tuần này dạy bao nhiêu buổi?',
          ],
        },
        {
          title: 'Kỷ Luật & Chuyên Cần Khoa',
          icon: Clock,
          color: 'text-amber-600',
          questions: [
            'Trong tháng này khoa có bao nhiêu lượt đi trễ?',
            'Trong tháng này khoa có bao nhiêu lượt vắng?',
            'Trong tuần này ai trong khoa đi trễ nhiều nhất?',
          ],
        },
        {
          title: 'Hộp Duyệt Đơn Từ',
          icon: ShieldCheck,
          color: 'text-emerald-600',
          questions: [
            'Có bao nhiêu đơn nghỉ đang chờ duyệt?',
            'Tuần này có bao nhiêu đơn xin nghỉ trong khoa?',
            'Tuần này có bao nhiêu đơn bị từ chối?',
          ],
        },
      ];
    }

    // Admin
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
        title: 'Thanh Tra Nhân Sự',
        icon: Users,
        color: 'text-blue-600',
        questions: [
          'TS. Trần Thị Bích tháng này đúng giờ bao nhiêu ngày?',
          'TS. Trần Thị Bích tháng này đi trễ bao nhiêu ngày?',
          'ThS. Phạm Văn Cường tuần này dạy bao nhiêu buổi?',
        ],
      },
      {
        title: 'Tổng Hợp Đơn & Báo Cáo',
        icon: Sparkles,
        color: 'text-indigo-600',
        questions: [
          'Có bao nhiêu đơn nghỉ đang chờ duyệt?',
          'Tháng này có bao nhiêu đơn nghỉ được duyệt?',
          'Tuần này có bao nhiêu đơn dạy bù?',
        ],
      },
    ];
  };

  const sampleCategories = getAgentSampleQuestions();
  // Gom các câu hỏi gợi ý nhanh thành 1 mảng để hiển thị chip cuộn ngang
  const quickQuestions = sampleCategories.flatMap((c) => c.questions).slice(0, 8);

  return (
    <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* 1. Header Banner & Trạng Thái Google AI Studio */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-blue-500/20 to-indigo-500/20 text-blue-200 text-[11px] font-bold border border-blue-400/30">
                <GeminiStar className="w-3.5 h-3.5 text-blue-400" />
                <span>Google AI Studio & LLM Agents</span>
              </span>

              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-slate-200 border border-white/15">
                <Zap className="w-3 h-3 text-amber-300" />
                <span>Model: {selectedModel}</span>
              </span>

              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>Google AI Studio (.env)</span>
              </span>
            </div>

            <h2 className="text-lg sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <span>Trợ Lý Trí Tuệ Nhân Tạo AI Đại Học</span>
            </h2>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Giải đáp nghiệp vụ thời gian thực từ CSDL trường học, hỗ trợ soạn thảo học thuật và tương tác trực tiếp với mô hình ngôn ngữ lớn <strong>Google Gemini</strong>.
            </p>
          </div>

          {/* Action buttons góc phải header */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleClearChat}
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-slate-200 hover:text-white text-xs font-bold transition flex items-center gap-1.5 border border-white/15 shadow-sm cursor-pointer"
              title="Làm mới phiên hội thoại"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Làm Mới Chat</span>
            </button>
          </div>
        </div>

        {/* 2. Thanh Chọn Chế Độ AI Agent (Segmented Control Responsive) */}
        <div className="mt-3.5 pt-3 border-t border-white/10 flex items-center gap-1.5 sm:gap-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden md:inline shrink-0">Chế độ:</span>
          
          <button
            type="button"
            onClick={() => handleSwitchAgent('attendance')}
            className={`flex-1 sm:flex-none px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-95 ${
              activeAgent === 'attendance'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-1 ring-white/20'
                : 'bg-white/10 text-slate-300 hover:bg-white/15 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-blue-300 shrink-0" />
            <span><span className="hidden sm:inline">Dữ Liệu & </span>Chấm Công</span>
          </button>

          <button
            type="button"
            onClick={() => handleSwitchAgent('academic')}
            className={`flex-1 sm:flex-none px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-95 ${
              activeAgent === 'academic'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-1 ring-white/20'
                : 'bg-white/10 text-slate-300 hover:bg-white/15 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-indigo-300 shrink-0" />
            <span><span className="hidden sm:inline">Trợ Lý </span>Học Thuật</span>
          </button>

          <button
            type="button"
            onClick={() => handleSwitchAgent('general')}
            className={`flex-1 sm:flex-none px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-95 ${
              activeAgent === 'general'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30 ring-1 ring-white/20'
                : 'bg-white/10 text-slate-300 hover:bg-white/15 hover:text-white'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span>AI Đa Năng<span className="hidden sm:inline"> (Gemini)</span></span>
          </button>
        </div>
      </div>

      {/* 3. Bố Cục Hai Cột: Câu Hỏi Gợi Ý (Desktop) & Khung Chat Box (Desktop + Mobile) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6 items-start">
        {/* Cột trái (Desktop only): Danh mục câu hỏi theo Agent */}
        <div className="hidden lg:block lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-blue-600" />
              <span>Gợi Ý Câu Hỏi</span>
            </h3>
            <span className="text-[10px] text-slate-400 font-bold">{roleName}</span>
          </div>

          <div className="space-y-3">
            {sampleCategories.map((cat, idx) => {
              const Icon = cat.icon;
              return (
                <div
                  key={idx}
                  className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-2 hover:shadow-xs transition"
                >
                  <div className="flex items-center gap-2">
                    <Icon className={`w-3.5 h-3.5 ${cat.color}`} />
                    <h4 className="text-xs font-bold text-slate-900">{cat.title}</h4>
                  </div>
                  <div className="space-y-1">
                    {cat.questions.map((q, qIdx) => (
                      <button
                        key={qIdx}
                        onClick={() => handleSend(q)}
                        disabled={isLoading}
                        className="w-full text-left p-2 rounded-xl bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-700 text-[11px] leading-snug transition border border-slate-100/80 disabled:opacity-50 group flex items-start gap-1.5 cursor-pointer"
                      >
                        <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-blue-600 shrink-0 mt-0.5 transition-transform group-hover:translate-x-0.5" />
                        <span>{q}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cột phải: Chat Window (Chiều cao vừa vặn cho cả Mobile và Desktop) */}
        <div className="col-span-1 lg:col-span-3 bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm flex flex-col h-[520px] sm:h-[740px] overflow-hidden">
          {/* Header nhỏ phía trên cửa sổ chat */}
          <div className="p-3 sm:p-3.5 border-b border-slate-200/90 bg-gradient-to-r from-slate-50 via-indigo-50/20 to-blue-50/30 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-slate-900 via-indigo-900 to-blue-900 text-white flex items-center justify-center shrink-0 shadow-sm">
                <GeminiStar className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                    {activeAgent === 'attendance'
                      ? 'AI Chấm Công & Cơ Sở Dữ Liệu Trường'
                      : activeAgent === 'academic'
                      ? 'AI Trợ Lý Học Thuật & Giáo Dục Đại Học'
                      : 'AI Đa Năng Google AI Studio'}
                  </h4>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                </div>
                <p className="text-[10px] text-slate-500 truncate">
                  Model: <span className="font-mono font-bold text-indigo-700">{selectedModel}</span> • Phân quyền: {roleName}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleClearChat}
                className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                title="Xóa cuộc trò chuyện"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Dải gợi ý câu hỏi dạng chip cuộn ngang (Cực kỳ tiện dụng trên cả Mobile và Desktop) */}
          <div className="px-3 py-2 bg-slate-100/60 border-b border-slate-200/60 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
              <HelpCircle className="w-3 h-3 text-blue-500" />
              <span>Gợi ý:</span>
            </span>
            {quickQuestions.map((q, qIdx) => (
              <button
                key={qIdx}
                type="button"
                onClick={() => handleSend(q)}
                disabled={isLoading}
                className="px-2.5 py-1 rounded-full bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-[11px] font-medium border border-slate-200/80 shadow-2xs whitespace-nowrap transition active:scale-95 shrink-0 disabled:opacity-50 cursor-pointer"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Khu vực hiển thị tin nhắn (Chat Messages Scrollable Area) */}
          <div className="flex-1 p-3.5 sm:p-5 overflow-y-auto space-y-3.5 bg-slate-50/50 sidebar-scrollbar">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 sm:gap-3 group ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'ai' && (
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-tr from-slate-900 via-indigo-900 to-blue-900 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm p-1.5">
                    <GeminiStar className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                )}

                <div
                  className={`max-w-[92%] sm:max-w-[85%] rounded-2xl p-3.5 sm:p-4 text-xs sm:text-sm leading-relaxed relative ${
                    msg.sender === 'user'
                      ? 'bg-blue-600 text-white rounded-br-2xs shadow-sm font-medium'
                      : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-2xs shadow-xs'
                  }`}
                >
                  {renderFormattedAiText(msg.text, msg.sender === 'user')}

                  {/* Hiển thị danh sách người dùng khi bị trùng tên để chọn trực tiếp */}
                  {msg.isAmbiguous && msg.matches && msg.matches.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-200/80 space-y-2">
                      <p className="text-xs font-semibold text-slate-700">Chọn người bạn muốn xem:</p>
                      <div className="flex flex-wrap gap-2">
                        {msg.matches.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => handleSend(`${m.fullName} tháng này đi trễ bao nhiêu ngày?`)}
                            className="px-3 py-1.5 text-[11px] font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors cursor-pointer"
                          >
                            👉 {m.fullName} ({m.departmentName})
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Visual Badges tóm tắt số liệu nếu có */}
                  {msg.statistics && typeof msg.statistics === 'object' && !msg.isAmbiguous && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap gap-1.5 text-[10px] sm:text-[11px]">
                      {msg.statistics.onTime !== undefined && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> Đúng giờ: {msg.statistics.onTime}
                        </span>
                      )}
                      {msg.statistics.late !== undefined && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold border border-amber-200">
                          <Clock className="w-3 h-3" /> Đi trễ: {msg.statistics.late}
                        </span>
                      )}
                      {msg.statistics.absent !== undefined && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 font-semibold border border-rose-200">
                          <XCircle className="w-3 h-3" /> Vắng: {msg.statistics.absent}
                        </span>
                      )}
                      {msg.statistics.excusedAbsent !== undefined && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                          <ShieldCheck className="w-3 h-3" /> Có phép: {msg.statistics.excusedAbsent}
                        </span>
                      )}
                      {msg.statistics.totalActualSessions !== undefined && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200">
                          <Calendar className="w-3 h-3" /> Số buổi dạy: {msg.statistics.totalActualSessions}
                        </span>
                      )}
                      {msg.statistics.pending !== undefined && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold border border-amber-200">
                          <Clock className="w-3 h-3" /> Chờ duyệt: {msg.statistics.pending}
                        </span>
                      )}
                      {msg.statistics.approved !== undefined && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> Đã duyệt: {msg.statistics.approved}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Footer của tin nhắn: Thời gian + Nút Copy */}
                  <div className="mt-2 pt-1 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                    <span className={msg.sender === 'user' ? 'text-blue-100' : 'text-slate-400'}>
                      {msg.time}
                    </span>

                    {msg.sender === 'ai' && (
                      <button
                        type="button"
                        onClick={() => handleCopy(msg.id, msg.text)}
                        className="opacity-70 hover:opacity-100 transition flex items-center gap-1 text-slate-500 hover:text-blue-600 px-1 py-0.5 rounded cursor-pointer"
                        title="Sao chép nội dung câu trả lời"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span className="text-[10px] text-emerald-600 font-bold">Đã chép</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span className="text-[10px]">Sao chép</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {msg.sender === 'user' && (
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                    <UserIcon className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-2.5 sm:gap-3 justify-start">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-tr from-slate-900 via-indigo-900 to-blue-900 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm p-1.5">
                  <GeminiStar className="w-4 h-4 animate-spin" style={{ animationDuration: '3s' }} />
                </div>
                <div className="bg-white border border-slate-200/80 rounded-2xl rounded-bl-2xs p-3.5 text-xs text-slate-600 shadow-xs flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-[#1BA1E3] animate-bounce"></span>
                  <span className="w-2 h-2 rounded-full bg-[#9164E8] animate-bounce [animation-delay:150ms]"></span>
                  <span className="w-2 h-2 rounded-full bg-[#DE628B] animate-bounce [animation-delay:300ms]"></span>
                  <span className="font-medium text-slate-700">
                    {activeAgent === 'attendance'
                      ? 'AI đang tổng hợp CSDL MongoDB và phân tích số liệu...'
                      : `Google AI Studio (${selectedModel}) đang suy luận câu trả lời...`}
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Khung nhập tin nhắn (Input Box Responsive) */}
          <div className="p-2.5 sm:p-4 bg-white border-t border-slate-200/90 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <div className="relative flex-1">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    activeAgent === 'attendance'
                      ? 'Hỏi dữ liệu trường: chấm công, lịch dạy, đơn nghỉ, vắng mặt...'
                      : activeAgent === 'academic'
                      ? 'Yêu cầu soạn giáo án, câu hỏi trắc nghiệm, bài giảng...'
                      : 'Đặt bất kỳ câu hỏi nào cho Google AI Studio Gemini...'
                  }
                  className="w-full pl-3.5 pr-8 py-2.5 sm:py-3 bg-slate-50 focus:bg-white text-slate-800 placeholder-slate-400 border border-slate-200 rounded-xl sm:rounded-2xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                />
                {input && (
                  <button
                    type="button"
                    onClick={() => setInput('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="px-4 py-2.5 sm:px-5 sm:py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-95 disabled:opacity-40 text-white font-bold rounded-xl sm:rounded-2xl shadow-md shadow-blue-500/20 transition flex items-center gap-1.5 shrink-0 text-xs sm:text-sm cursor-pointer"
              >
                <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Gửi Câu Hỏi</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AiInspectorPage;
