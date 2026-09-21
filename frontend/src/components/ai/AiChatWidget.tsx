import { useState, useRef, useEffect, useMemo } from 'react';
import { Bot, Send, X, Sparkles, User, RefreshCw } from 'lucide-react';
import aiService from '../../services/ai.service';
import { formatTime } from '../../utils';
import { useAuth } from '../../contexts/AuthContext';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  time: string;
}

export const AiChatWidget: React.FC = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Cấu hình linh hoạt theo từng chức vụ (Role)
  const roleConfig = useMemo(() => {
    const role = user?.role;
    const name = user?.fullName ? ` ${user.fullName}` : '';

    if (role === 'giangvien') {
      return {
        headerTitle: 'Trợ Lý Giảng Viên AI',
        headerSubtitle: 'Lịch dạy & Chấm công cá nhân',
        welcomeText: `Xin chào Thầy/Cô${name}! Tôi là **Trợ lý AI Giảng viên**. Thầy/Cô có thể hỏi nhanh về lịch giảng dạy hôm nay/ngày mai, số lần đi trễ, hoặc trạng thái các đơn xin nghỉ phép/dạy bù.`,
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
      return {
        headerTitle: 'Trợ Lý Quản Lý Khoa AI',
        headerSubtitle: 'Giám sát giảng dạy & Chấm công khoa',
        welcomeText: `Kính chào Thầy/Cô Trưởng khoa${name}! Tôi là **Trợ lý AI Quản lý Khoa**. Thầy/Cô có thể hỏi về danh sách giảng viên trong khoa có lịch dạy hôm nay, tình hình đi muộn và các đơn xin nghỉ đang chờ duyệt.`,
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
        welcomeText: `Xin chào${name}! Tôi là **Trợ lý AI Chấm công & Ca làm việc**. Bạn có thể hỏi tôi về kết quả chấm công hôm nay, số lần đi trễ trong tuần/tháng hoặc kiểm tra trạng thái đơn xin nghỉ.`,
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
    return {
      headerTitle: 'Trợ Lý Thanh Tra AI',
      headerSubtitle: 'Dữ liệu thời gian thực toàn trường',
      welcomeText: `Xin chào Quản trị viên${name}! Tôi là **Trợ lý AI Thanh tra Đào tạo & Quản lý Chấm công**. Bạn có thể hỏi tôi về tình hình đi muộn, vắng mặt toàn trường, đơn xin nghỉ hoặc tóm tắt báo cáo chấm công.`,
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

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
      const res = await aiService.askAiAssistant(q);
      const aiText = res.data?.answer || 'Hệ thống đã ghi nhận nhưng chưa thể xử lý câu trả lời.';
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
        text: '⚠️ Không thể kết nối với dịch vụ Trợ lý AI. Vui lòng thử lại sau giây lát.',
        time: formatTime(new Date()),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Button - Gọn nhẹ, thanh lịch */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-5 right-5 z-40 px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-full shadow-md shadow-blue-500/25 flex items-center gap-2 transition-all hover:scale-105 active:scale-95 group border border-white/20 text-xs font-semibold"
          title={roleConfig.headerTitle}
        >
          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-blue-100 animate-pulse" />
          </div>
          <span>Trợ Lý AI</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
        </button>
      )}

      {/* Chat Window - Nhỏ gọn, tối ưu không gian */}
      {isOpen && (
        <div className="fixed bottom-5 right-5 z-50 w-[90vw] sm:w-[360px] h-[500px] max-h-[82vh] bg-white rounded-2xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden animate-fadeIn">
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-blue-200">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold flex items-center gap-1.5">
                  {roleConfig.headerTitle}
                  <span className="px-1.5 py-0.2 bg-blue-500/30 border border-blue-400/30 rounded text-[9px] font-normal text-blue-200">
                    Gemini
                  </span>
                </h4>
                <p className="text-[10px] text-slate-300">{roleConfig.headerSubtitle}</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick Prompts */}
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-200/80 flex items-center gap-1.5 overflow-x-auto text-[11px] no-scrollbar shrink-0">
            <span className="text-slate-400 text-[10px] uppercase font-bold shrink-0 ml-1">Gợi ý:</span>
            {roleConfig.prompts.map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleSend(prompt)}
                className="px-2.5 py-1 bg-white hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 text-slate-700 rounded-full border border-slate-200 shrink-0 transition-colors whitespace-nowrap"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Messages Body */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/50">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'ai' && (
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[82%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-blue-600 text-white rounded-br-none shadow-sm'
                      : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-none shadow-sm'
                  }`}
                >
                  <div className="whitespace-pre-wrap font-sans">{msg.text}</div>
                  <div
                    className={`mt-1 text-[10px] text-right ${
                      msg.sender === 'user' ? 'text-blue-100' : 'text-slate-400'
                    }`}
                  >
                    {msg.time}
                  </div>
                </div>

                {msg.sender === 'user' && (
                  <div className="w-7 h-7 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-2.5 justify-start">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                </div>
                <div className="bg-white border border-slate-200/80 rounded-2xl rounded-bl-none p-3.5 text-xs text-slate-500 shadow-sm flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-bounce"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-bounce delay-150"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-bounce delay-300"></span>
                  <span>AI đang phân tích dữ liệu CSDL chấm công...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <div className="p-3 bg-white border-t border-slate-200 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={roleConfig.placeholder}
                className="flex-1 px-3.5 py-2.5 bg-slate-100 focus:bg-white text-slate-800 placeholder-slate-400 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:opacity-50 disabled:pointer-events-none text-white flex items-center justify-center transition-all shadow-sm"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default AiChatWidget;
