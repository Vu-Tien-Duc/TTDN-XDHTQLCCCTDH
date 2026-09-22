import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Send, X, Sparkles, User, RefreshCw, ChevronRight, ChevronLeft, Minimize2, ShieldCheck, BookOpen, Cpu } from 'lucide-react';
import aiService from '../../services/ai.service';
import { formatTime } from '../../utils';
import { useAuth } from '../../contexts/AuthContext';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  time: string;
}

/**
 * Biểu tượng Google Gemini chuẩn với dải màu Gradient đặc trưng (Cyan -> Royal Blue -> Purple -> Coral Pink)
 */
export const GeminiStar: React.FC<{ className?: string; style?: React.CSSProperties }> = ({
  className = 'w-6 h-6',
  style,
}) => {
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="gemini-star-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1BA1E3" />
          <stop offset="35%" stopColor="#5480F5" />
          <stop offset="70%" stopColor="#9164E8" />
          <stop offset="100%" stopColor="#DE628B" />
        </linearGradient>
      </defs>
      <path
        d="M14 0C14 7.732 20.268 14 28 14C20.268 14 14 20.268 14 28C14 20.268 7.732 14 0 14C7.732 14 14 7.732 14 0Z"
        fill="url(#gemini-star-gradient)"
      />
    </svg>
  );
};

/**
 * Biểu tượng Google Gemini dạng kép (Dual Sparkles) rực rỡ và xinh xắn
 */
export const GeminiLogo: React.FC<{ className?: string; style?: React.CSSProperties }> = ({
  className = 'w-7 h-7',
  style,
}) => {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="gemini-logo-grad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1BA1E3" />
          <stop offset="35%" stopColor="#5480F5" />
          <stop offset="70%" stopColor="#9164E8" />
          <stop offset="100%" stopColor="#DE628B" />
        </linearGradient>
        <linearGradient id="gemini-logo-grad2" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#1BA1E3" />
          <stop offset="50%" stopColor="#9164E8" />
          <stop offset="100%" stopColor="#FD8E62" />
        </linearGradient>
      </defs>
      {/* Ngôi sao chính Gemini */}
      <path
        d="M16 1C16 8.73 22.27 15 30 15C22.27 15 16 21.27 16 29C16 21.27 9.73 15 2 15C9.73 15 16 8.73 16 1Z"
        fill="url(#gemini-logo-grad1)"
      />
      {/* Ngôi sao phụ góc trái dưới */}
      <path
        d="M6 19C6 21.76 8.24 24 11 24C8.24 24 6 26.24 6 29C6 26.24 3.76 24 1 24C3.76 24 6 21.76 6 19Z"
        fill="url(#gemini-logo-grad2)"
        opacity="0.95"
      />
    </svg>
  );
};

// Hàm render văn bản AI tinh gọn, thẩm mỹ, lọc sạch '**' và định dạng đẹp mắt
const renderFormattedAiText = (content: string, isUser: boolean) => {
  if (isUser) {
    return <div className="whitespace-pre-wrap font-sans text-xs leading-relaxed">{content}</div>;
  }

  const lines = content.split('\n');

  return (
    <div className="space-y-1.5 font-sans leading-relaxed text-xs text-slate-800">
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
              className="font-bold text-slate-900 text-xs mt-2 mb-1 pb-1 border-b border-slate-200/80 flex items-center gap-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
              <span>{cleanHeading}</span>
            </div>
          );
        }

        // Dòng gạch đầu dòng: * hoặc - hoặc •
        const isBullet = /^[-*•]\s+/.test(line);
        // Dòng số thứ tự: 1. 2. 3.
        const isNumberList = /^\d+\.\s+/.test(line);
        const textToProcess = isBullet
          ? line.replace(/^[-*•]\s+/, '')
          : isNumberList
          ? line.replace(/^\d+\.\s+/, '')
          : line;

        // Xử lý các đoạn in đậm **text**
        const parts = textToProcess.split(/(\*\*[^*]+?\*\*)/g);
        const inlineElements = parts.map((part, pIdx) => {
          if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
            const boldText = part.slice(2, -2);
            return (
              <strong key={pIdx} className="font-semibold text-slate-900">
                {boldText}
              </strong>
            );
          }
          const cleanPart = part.replace(/\*\*/g, '');
          return <span key={pIdx}>{cleanPart}</span>;
        });

        if (isBullet) {
          return (
            <div key={idx} className="flex items-start gap-1.5 ml-1 my-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0 mt-1.5"></span>
              <div className="flex-1">{inlineElements}</div>
            </div>
          );
        }

        if (isNumberList) {
          const numMatch = line.match(/^(\d+)\.\s+/);
          const num = numMatch ? numMatch[1] : '•';
          return (
            <div key={idx} className="flex items-start gap-1.5 ml-1 my-0.5">
              <span className="text-[11px] font-bold text-indigo-600 shrink-0 min-w-[14px]">
                {num}.
              </span>
              <div className="flex-1">{inlineElements}</div>
            </div>
          );
        }

        return <p key={idx} className="my-0.5">{inlineElements}</p>;
      })}
    </div>
  );
};

export const AiChatWidget: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeAgent, setActiveAgent] = useState<'attendance' | 'academic' | 'general'>('attendance');

  // Vị trí 2D (X, Y) tự do trên toàn bộ màn hình (Mặc định ở góc dưới bên phải, có thể kéo đi bất cứ đâu)
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    const defaultX = typeof window !== 'undefined' ? Math.max(16, window.innerWidth - 76) : 500;
    const defaultY = typeof window !== 'undefined' ? Math.max(16, window.innerHeight - 150) : 500;
    try {
      const savedX = localStorage.getItem('gemini_ai_pos_x');
      const savedY = localStorage.getItem('gemini_ai_pos_y');
      if (savedX && savedY) {
        const px = parseInt(savedX, 10);
        const py = parseInt(savedY, 10);
        const winW = typeof window !== 'undefined' ? window.innerWidth : 1024;
        const winH = typeof window !== 'undefined' ? window.innerHeight : 768;
        if (!isNaN(px) && !isNaN(py)) {
          return {
            x: Math.max(16, Math.min(winW - 72, px)),
            y: Math.max(16, Math.min(winH - 72, py)),
          };
        }
      }
    } catch {}
    return { x: defaultX, y: defaultY };
  });

  // Tự động giữ icon trong khung nhìn khi người dùng thu phóng / đổi kích thước màn hình
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => ({
        x: Math.max(16, Math.min(window.innerWidth - 72, prev.x)),
        y: Math.max(16, Math.min(window.innerHeight - 72, prev.y)),
      }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Chế độ thu gọn vào mép màn hình (Dock to side edge)
  const [isDocked, setIsDocked] = useState<boolean>(() => {
    try {
      return localStorage.getItem('gemini_ai_docked') === 'true';
    } catch {}
    return false;
  });

  // Xác định bong bóng đang ở nửa trái hay nửa phải màn hình
  const isLeft = typeof window !== 'undefined' ? position.x < window.innerWidth / 2 : false;

  const isDraggingRef = useRef(false);
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const startWidgetPosRef = useRef({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
    startWidgetPosRef.current = { ...position };
    hasMovedRef.current = false;
    try {
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const deltaX = e.clientX - dragStartPosRef.current.x;
    const deltaY = e.clientY - dragStartPosRef.current.y;
    if (Math.hypot(deltaX, deltaY) > 5) {
      hasMovedRef.current = true;
    }
    const minX = 16;
    const maxX = window.innerWidth - 72;
    const minY = 16;
    const maxY = window.innerHeight - 72;

    const nextX = Math.max(minX, Math.min(maxX, startWidgetPosRef.current.x + deltaX));
    const nextY = Math.max(minY, Math.min(maxY, startWidgetPosRef.current.y + deltaY));
    setPosition({ x: nextX, y: nextY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {}
    try {
      localStorage.setItem('gemini_ai_pos_x', String(position.x));
      localStorage.setItem('gemini_ai_pos_y', String(position.y));
    } catch {}
    if (!hasMovedRef.current) {
      setIsOpen(true);
    }
  };

  const toggleDock = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !isDocked;
    setIsDocked(next);
    try {
      localStorage.setItem('gemini_ai_docked', String(next));
    } catch {}
  };

  // Cấu hình linh hoạt theo từng chức vụ (Role)
  const roleConfig = useMemo(() => {
    const role = user?.role;
    const rawName = user?.fullName || '';

    if (role === 'giangvien') {
      const gvGreeting = rawName.toLowerCase().startsWith('giảng viên') || rawName.toLowerCase().startsWith('thầy') || rawName.toLowerCase().startsWith('cô')
        ? rawName
        : `Thầy/Cô ${rawName}`;
      return {
        headerTitle: 'Trợ Lý Giảng Viên AI',
        headerSubtitle: 'Lịch dạy & Chấm công cá nhân',
        welcomeText: `Xin chào ${gvGreeting.trim()}! Tôi là **Trợ lý AI Giảng viên**. Thầy/Cô có thể hỏi nhanh về lịch giảng dạy hôm nay/ngày mai, số lần đi trễ, hoặc trạng thái các đơn xin nghỉ phép/dạy bù.`,
        placeholder: 'Hỏi về lịch dạy, chấm công cá nhân, đơn nghỉ...',
        prompts: [
          'Lịch giảng dạy của tôi hôm nay?',
          'Ngày mai tôi có tiết dạy nào không?',
          'Tuần này tôi đi trễ bao nhiêu lần?',
          'Đơn xin nghỉ của tôi đang trạng thái gì?',
        ],
      };
    }

    if (role === 'truongkhoa') {
      const tkGreeting = rawName.toLowerCase().startsWith('trưởng khoa') ? rawName : `Trưởng khoa ${rawName}`;
      return {
        headerTitle: 'Trợ Lý Quản Lý Khoa AI',
        headerSubtitle: 'Giám sát giảng dạy & Chấm công khoa',
        welcomeText: `Kính chào ${tkGreeting.trim()}! Tôi là **Trợ lý AI Quản lý Khoa**. Thầy/Cô có thể hỏi về danh sách giảng viên trong khoa có lịch dạy hôm nay, tình hình đi muộn và các đơn xin nghỉ đang chờ duyệt.`,
        placeholder: 'Hỏi về giảng viên khoa, tình hình đi muộn, đơn nghỉ...',
        prompts: [
          'Hôm nay khoa có bao nhiêu giảng viên dạy?',
          'Trong tháng này khoa có bao nhiêu lượt đi trễ?',
          'Có bao nhiêu đơn nghỉ đang chờ duyệt?',
          'Tuần này ai trong khoa đi trễ nhiều nhất?',
        ],
      };
    }

    if (role === 'nhanvien') {
      return {
        headerTitle: 'Trợ Lý Nhân Viên AI',
        headerSubtitle: 'Chấm công & Ca làm việc cá nhân',
        welcomeText: `Xin chào ${rawName || 'Cán bộ/Nhân viên'}! Tôi là **Trợ lý AI Chấm công & Ca làm việc**. Bạn có thể hỏi tôi về kết quả chấm công hôm nay, số lần đi trễ trong tuần/tháng hoặc kiểm tra trạng thái đơn xin nghỉ.`,
        placeholder: 'Hỏi về ca làm, chấm công, đơn nghỉ của bạn...',
        prompts: [
          'Tôi hôm nay chấm công thế nào?',
          'Tuần này tôi đi trễ bao nhiêu lần?',
          'Tháng này tôi đúng giờ bao nhiêu ngày?',
          'Đơn xin nghỉ của tôi đang trạng thái gì?',
        ],
      };
    }

    // Mặc định: admin / thanh tra
    const adminGreeting = rawName.toLowerCase().startsWith('quản trị') ? rawName : `Quản trị viên ${rawName}`;
    return {
      headerTitle: 'Trợ Lý Thanh Tra AI',
      headerSubtitle: 'Dữ liệu thời gian thực toàn trường',
      welcomeText: `Xin chào ${adminGreeting.trim()}! Tôi là **Trợ lý AI Thanh tra Đào tạo & Quản lý Chấm công**. Bạn có thể hỏi tôi về tình hình đi muộn, vắng mặt toàn trường, đơn xin nghỉ hoặc tóm tắt báo cáo chấm công.`,
      placeholder: 'Nhập câu hỏi tra cứu thanh tra toàn trường...',
      prompts: [
        'Hôm nay có bao nhiêu người đi làm?',
        'Hôm nay có ai đi muộn hoặc vắng không?',
        'Có bao nhiêu đơn xin nghỉ đang chờ duyệt?',
        'Tóm tắt báo cáo chấm công tháng này',
      ],
    };
  }, [user]);

  const [messages, setMessages] = useState<Message[]>([]);

  // Khởi tạo tin nhắn chào hỏi theo chức vụ khi mở widget hoặc khi user thay đổi
  useEffect(() => {
    setMessages([
      {
        id: 'welcome',
        sender: 'ai',
        text: roleConfig.welcomeText,
        time: formatTime(new Date()),
      },
    ]);
  }, [roleConfig.welcomeText]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      // Tự động focus ô nhập liệu khi mở chat box
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [messages, isOpen]);

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
      const res = await aiService.askAiAssistant(q, {
        agentMode: activeAgent,
        model: 'gemini-3.5-flash-lite',
      });
      const aiText = res.data?.answer || 'Hệ thống đã ghi nhận nhưng chưa nhận được câu trả lời từ máy chủ.';
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: aiText,
        time: formatTime(new Date()),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: '⚠️ Không thể kết nối với dịch vụ Gemini AI. Vui lòng kiểm tra lại kết nối mạng hoặc thử lại sau.',
        time: formatTime(new Date()),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetChat = (agent = activeAgent) => {
    let welcome = roleConfig.welcomeText;
    if (agent === 'academic') {
      welcome = `Chào bạn! Tôi là **Trợ lý Học thuật & Sư phạm (Gemini)**. Hãy yêu cầu tôi soạn giáo án, câu hỏi trắc nghiệm, chuẩn đầu ra học phần hoặc giải đáp quy chế đào tạo tín chỉ.`;
    } else if (agent === 'general') {
      welcome = `Chào bạn! Tôi là **Trợ lý AI Đa Năng (Google Gemini)**. Bạn có thể hỏi tôi bất kỳ câu hỏi nào về kiến thức, văn bản hành chính hay công nghệ.`;
    }
    setMessages([
      {
        id: Date.now().toString(),
        sender: 'ai',
        text: welcome,
        time: formatTime(new Date()),
      },
    ]);
  };

  const handleSwitchAgentInWidget = (agent: 'attendance' | 'academic' | 'general') => {
    setActiveAgent(agent);
    handleResetChat(agent);
  };

  // Nếu đang ở trang /ai-assistant thì ẩn widget nổi để không bị đè lên nút gửi hoặc xung đột giao diện
  if (location.pathname === '/ai-assistant') {
    return null;
  }

  return (
    <>
      {/* ========================================================= */}
      {/* 1.1. CHẾ ĐỘ THU GỌN VÀO MÉP MÀN HÌNH (Docked to Side Edge) */}
      {/* ========================================================= */}
      {isDocked && !isOpen && (
        <div
          style={{ top: `${position.y}px` }}
          className={`fixed z-[9999] flex items-center select-none animate-in duration-200 ${
            isLeft ? 'left-0 slide-in-from-left' : 'right-0 slide-in-from-right'
          }`}
        >
          <button
            type="button"
            onClick={() => {
              setIsDocked(false);
              try {
                localStorage.setItem('gemini_ai_docked', 'false');
              } catch {}
            }}
            className={`flex items-center gap-1.5 py-2 px-2.5 sm:px-3 bg-gradient-to-r from-[#1BA1E3] via-[#9164E8] to-[#DE628B] text-white shadow-xl hover:scale-105 transition-all text-xs font-bold border-y border-white/30 group cursor-pointer ${
              isLeft ? 'rounded-r-2xl border-r pl-2.5 hover:pr-4' : 'rounded-l-2xl border-l pr-2.5 hover:pl-4'
            }`}
            title="Nhấn để mở Trợ lý AI"
          >
            {isLeft ? (
              <>
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                <span className="text-[11px] font-extrabold tracking-wide drop-shadow-xs">Trợ lý AI</span>
                <GeminiStar className="w-4 h-4 animate-pulse" />
              </>
            ) : (
              <>
                <GeminiStar className="w-4 h-4 animate-pulse" />
                <span className="text-[11px] font-extrabold tracking-wide drop-shadow-xs">Trợ lý AI</span>
                <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              </>
            )}
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* 1.2. NÚT TRÒN NỔI KÉO THẢ TỰ DO (Floating Draggable Bubble) */}
      {/* ========================================================= */}
      {!isDocked && !isOpen && (
        <div
          style={{
            transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
            transition: isDraggingRef.current ? 'none' : 'transform 0.15s ease-out',
          }}
          className="fixed top-0 left-0 z-[9999] select-none"
        >
          <div className="relative flex items-center group/bubble">
            {/* Nút thu gọn nhanh vào mép màn hình */}
            <button
              type="button"
              onClick={toggleDock}
              className={`absolute -top-1.5 z-10 w-5 h-5 rounded-full bg-slate-800/90 hover:bg-slate-900 text-slate-300 hover:text-white flex items-center justify-center text-[10px] shadow-md border border-white/20 transition-all hover:scale-110 cursor-pointer opacity-75 group-hover/bubble:opacity-100 ${
                isLeft ? '-left-1' : '-right-1'
              }`}
              title={isLeft ? 'Gập gọn vào mép trái màn hình' : 'Gập gọn vào mép phải màn hình'}
            >
              {isLeft ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>

            <button
              type="button"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="relative p-[2.5px] rounded-full bg-gradient-to-tr from-[#1BA1E3] via-[#9164E8] to-[#DE628B] shadow-[0_8px_25px_rgba(145,100,232,0.45)] hover:shadow-[0_12px_32px_rgba(145,100,232,0.65)] active:scale-95 transition-shadow duration-300 focus:outline-none cursor-grab active:cursor-grabbing touch-none select-none"
              title={`${roleConfig.headerTitle} (Kéo thả tự do xung quanh màn hình)`}
              aria-label={roleConfig.headerTitle}
            >
              {/* Lớp nền tròn trắng ngọc trai */}
              <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-white flex items-center justify-center relative overflow-hidden transition-colors hover:bg-slate-50 pointer-events-none">
                <GeminiLogo className="w-5.5 h-5.5 sm:w-7 sm:h-7 transition-transform duration-300 hover:rotate-6 hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-b from-white/60 via-transparent to-transparent pointer-events-none rounded-full" />
              </div>

              {/* Chấm tròn xanh báo trạng thái sẵn sàng */}
              <span className="absolute top-0 right-0 flex h-3 w-3 pointer-events-none">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-white shadow-xs"></span>
              </span>

              {/* Tooltip hướng dẫn khi hover */}
              <div
                className={`hidden sm:flex items-center gap-1.5 absolute ${
                  isLeft
                    ? 'left-full ml-3 -translate-x-2 group-hover/bubble:translate-x-0'
                    : 'right-full mr-3 translate-x-2 group-hover/bubble:translate-x-0'
                } px-3 py-1.5 rounded-full bg-slate-900/95 text-white text-xs font-medium shadow-xl opacity-0 group-hover/bubble:opacity-100 transition-all duration-200 pointer-events-none whitespace-nowrap border border-white/10 backdrop-blur-sm`}
              >
                <span>{roleConfig.headerTitle}</span>
                <span className="text-[10px] text-slate-400 font-mono">(kéo di chuyển khắp màn hình)</span>
                <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
              </div>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. HỘP THOẠI AI CHAT BOX (Nhỏ gọn, tinh tế trên Mobile) */}
      {/* ========================================================= */}
      {isOpen && (
        <div
          className={`fixed bottom-3 sm:bottom-6 z-[9999] w-[calc(100vw-1.5rem)] max-w-[290px] sm:max-w-none sm:w-[380px] h-[340px] max-h-[50vh] sm:h-[540px] sm:max-h-[80vh] bg-white rounded-2xl sm:rounded-3xl shadow-[0_12px_36px_-6px_rgba(15,23,42,0.3)] border border-slate-200/90 flex flex-col overflow-hidden transition-all animate-in fade-in zoom-in-95 duration-200 ${
            isLeft ? 'left-3 sm:left-6' : 'right-3 sm:right-6'
          }`}
        >
          {/* Header - Nhỏ gọn, phong cách Google Gemini */}
          <div className="px-2.5 py-1.5 sm:px-3.5 sm:py-2 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shrink-0 shadow-xs space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 min-w-0">
                {/* Avatar Gemini */}
                <div className="w-5 h-5 sm:w-6.5 sm:h-6.5 rounded-md bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center p-0.5 shadow-inner shrink-0">
                  <GeminiStar className="w-3 h-3 sm:w-4 sm:h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1 truncate">
                    <h4 className="text-[10px] sm:text-xs font-bold text-white tracking-wide truncate">
                      {activeAgent === 'academic'
                        ? 'Trợ Lý Học Thuật'
                        : activeAgent === 'general'
                        ? 'Trợ Lý Đa Năng'
                        : roleConfig.headerTitle}
                    </h4>
                    <span className="px-1 py-0.2 rounded bg-blue-500/30 border border-blue-400/40 text-[7.5px] sm:text-[9px] font-semibold text-blue-200 shrink-0">
                      Gemini
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[8.5px] sm:text-[10px] text-slate-300 font-medium truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
                    <span className="truncate">
                      {activeAgent === 'academic'
                        ? 'Soạn đề & giáo án'
                        : activeAgent === 'general'
                        ? 'Tri thức mở Gemini'
                        : roleConfig.headerSubtitle}
                    </span>
                  </div>
                </div>
              </div>

              {/* Các nút thao tác Header */}
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleResetChat()}
                  className="w-5.5 h-5.5 sm:w-6.5 sm:h-6.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                  title="Làm mới hội thoại"
                >
                  <RefreshCw className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setIsDocked(true);
                    try {
                      localStorage.setItem('gemini_ai_docked', 'true');
                    } catch {}
                  }}
                  className="hidden sm:flex w-6.5 h-6.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white items-center justify-center transition-colors cursor-pointer"
                  title="Gập gọn vào mép màn hình"
                >
                  <Minimize2 className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="w-5.5 h-5.5 sm:w-6.5 sm:h-6.5 rounded-full bg-white/10 hover:bg-red-500/40 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer ml-0.5"
                  title="Đóng chat box"
                >
                  <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                </button>
              </div>
            </div>

            {/* Thanh chuyển chế độ 3 Agent nhỏ gọn */}
            <div className="flex items-center gap-0.5 bg-black/35 p-0.5 rounded-md border border-white/10">
              <button
                type="button"
                onClick={() => handleSwitchAgentInWidget('attendance')}
                className={`flex-1 py-0.5 px-1 rounded text-[8.5px] sm:text-[10px] font-bold transition flex items-center justify-center gap-0.5 cursor-pointer truncate ${
                  activeAgent === 'attendance'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <ShieldCheck className="w-2 h-2 sm:w-2.5 sm:h-2.5 shrink-0" />
                <span className="truncate">Chấm công</span>
              </button>
              <button
                type="button"
                onClick={() => handleSwitchAgentInWidget('academic')}
                className={`flex-1 py-0.5 px-1 rounded text-[8.5px] sm:text-[10px] font-bold transition flex items-center justify-center gap-0.5 cursor-pointer truncate ${
                  activeAgent === 'academic'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <BookOpen className="w-2 h-2 sm:w-2.5 sm:h-2.5 shrink-0" />
                <span className="truncate">Học thuật</span>
              </button>
              <button
                type="button"
                onClick={() => handleSwitchAgentInWidget('general')}
                className={`flex-1 py-0.5 px-1 rounded text-[8.5px] sm:text-[10px] font-bold transition flex items-center justify-center gap-0.5 cursor-pointer truncate ${
                  activeAgent === 'general'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <Cpu className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-amber-300 shrink-0" />
                <span className="truncate">Đa năng</span>
              </button>
            </div>
          </div>

          {/* Thanh Gợi Ý Thao Tác Nhanh (Quick Prompts Bar) */}
          <div className="px-2 py-1 sm:px-3 sm:py-1.5 bg-slate-50/90 border-b border-slate-100 flex items-center gap-1 overflow-x-auto text-[9.5px] no-scrollbar shrink-0">
            <span className="text-slate-400 text-[8px] sm:text-[9.5px] uppercase font-bold shrink-0 ml-0.5">
              Gợi ý:
            </span>
            {(activeAgent === 'academic'
              ? [
                  '3 câu trắc nghiệm Lập trình Web',
                  'Mục tiêu chuẩn đầu ra CLO',
                  'Quy chế tính điểm tín chỉ',
                ]
              : activeAgent === 'general'
              ? [
                  'Thông báo nghỉ học',
                  'Công thức Excel tính điểm',
                  'Dịch tóm tắt bài báo',
                ]
              : roleConfig.prompts
            ).map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleSend(prompt)}
                className="px-1.5 py-0.5 sm:px-2.5 sm:py-1 bg-white hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 text-slate-700 rounded-full border border-slate-200/90 shrink-0 transition-all text-[8.5px] sm:text-xs flex items-center gap-0.5 shadow-2xs active:scale-95 cursor-pointer whitespace-nowrap"
              >
                <span>💡</span>
                <span className="truncate max-w-[130px] sm:max-w-[150px]">{prompt}</span>
              </button>
            ))}
          </div>

          {/* Thân Hội Thoại (Messages Body) */}
          <div className="flex-1 p-2 sm:p-3 overflow-y-auto space-y-1.5 sm:space-y-3 bg-gradient-to-b from-slate-50/60 to-slate-100/40 sidebar-scrollbar">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-1.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {/* Avatar AI */}
                {msg.sender === 'ai' && (
                  <div className="w-5 h-5 sm:w-6.5 sm:h-6.5 rounded-md sm:rounded-lg bg-gradient-to-tr from-slate-900 to-indigo-950 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs p-0.5 sm:p-1">
                    <GeminiStar className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  </div>
                )}

                {/* Bong bóng tin nhắn */}
                <div
                  className={`max-w-[90%] sm:max-w-[84%] rounded-xl sm:rounded-2xl p-2 sm:p-3 text-[10.5px] sm:text-xs leading-relaxed transition-all ${
                    msg.sender === 'user'
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-tr-xs shadow-xs'
                      : 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-xs shadow-2xs'
                  }`}
                >
                  {renderFormattedAiText(msg.text, msg.sender === 'user')}
                  <div
                    className={`mt-0.5 sm:mt-1 text-[7.5px] sm:text-[9px] text-right flex items-center justify-end gap-1 ${
                      msg.sender === 'user' ? 'text-blue-200' : 'text-slate-400'
                    }`}
                  >
                    <span>{msg.time}</span>
                  </div>
                </div>

                {/* Avatar Người dùng */}
                {msg.sender === 'user' && (
                  <div className="w-5 h-5 sm:w-6.5 sm:h-6.5 rounded-md sm:rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                    <User className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  </div>
                )}
              </div>
            ))}

            {/* Trạng thái Gemini đang phản hồi */}
            {isLoading && (
              <div className="flex gap-1.5 justify-start items-center">
                <div className="w-5 h-5 sm:w-6.5 sm:h-6.5 rounded-md sm:rounded-lg bg-gradient-to-tr from-slate-900 to-indigo-950 text-white flex items-center justify-center shrink-0 shadow-xs p-0.5 sm:p-1">
                  <GeminiStar className="w-3 h-3 sm:w-3.5 sm:h-3.5 animate-spin" style={{ animationDuration: '3s' }} />
                </div>
                <div className="bg-white border border-slate-200/80 rounded-xl px-2 py-1 sm:px-2.5 sm:py-1.5 text-[9.5px] sm:text-xs text-slate-500 shadow-2xs flex items-center gap-1 sm:gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1BA1E3] animate-bounce"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#9164E8] animate-bounce [animation-delay:150ms]"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#DE628B] animate-bounce [animation-delay:300ms]"></span>
                  <span className="text-[9.5px] sm:text-[10px] font-medium text-slate-600 ml-0.5">
                    Gemini đang trả lời...
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Ô Nhập Liệu (Input Footer) */}
          <div className="p-1 sm:p-2 bg-white border-t border-slate-100 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-1 sm:gap-1.5"
            >
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    activeAgent === 'academic'
                      ? 'Soạn đề, giáo án...'
                      : activeAgent === 'general'
                      ? 'Hỏi bất kỳ điều gì...'
                      : 'Hỏi chấm công, lịch dạy...'
                  }
                  className="w-full pl-2 sm:pl-3 pr-6 py-1.5 sm:py-2 bg-slate-100/90 focus:bg-white text-slate-800 placeholder-slate-400 border border-slate-200 rounded-lg sm:rounded-xl text-[10.5px] sm:text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all shadow-inner"
                />
                {input && (
                  <button
                    type="button"
                    onClick={() => setInput('')}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-[10px] cursor-pointer p-0.5"
                  >
                    ✕
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="w-6.5 h-6.5 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 active:scale-95 disabled:opacity-40 disabled:pointer-events-none text-white flex items-center justify-center transition-all shadow-xs shrink-0 cursor-pointer"
                title="Gửi câu hỏi"
              >
                <Send className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default AiChatWidget;
