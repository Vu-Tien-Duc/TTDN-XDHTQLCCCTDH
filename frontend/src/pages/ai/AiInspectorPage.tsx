import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  User,
  RefreshCw,
  HelpCircle,
  ShieldCheck,
  Zap,
  AlertTriangle,
} from 'lucide-react';
import aiService from '../../services/ai.service';
import { formatTime } from '../../utils';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  time: string;
}

export const AiInspectorPage: React.FC = () => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'ai',
      text: `### 👋 Xin chào Thanh tra Đào tạo!

Tôi là **Trợ lý AI Thanh tra Chấm công** được huấn luyện để phân tích số liệu chấm công, nề nếp giảng dạy và tiến độ duyệt phép của Trường Đại học.

**Bạn có thể yêu cầu tôi thực hiện:**
- 🔍 *Tra cứu các trường hợp đi muộn, vắng mặt không phép hôm nay hoặc tuần này.*
- 📊 *Đánh giá tỷ lệ chuyên cần của từng Khoa và Bộ môn.*
- 📑 *Tổng hợp danh sách các đơn nghỉ phép đang chờ Trưởng khoa/BGH phê duyệt.*
- 📝 *Soạn thảo báo cáo tóm tắt tình hình chấm công gửi Ban Giám Hiệu.*`,
      time: formatTime(new Date()),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
      const aiText = res.data?.answer || 'Hệ thống đã nhận câu hỏi nhưng chưa có câu trả lời.';
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
        text: '⚠️ Không thể kết nối với dịch vụ Gemini AI. Vui lòng kiểm tra lại kết nối mạng hoặc máy chủ.',
        time: formatTime(new Date()),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const sampleCategories = [
    {
      title: 'Kiểm Tra Kỷ Luật & Vi Phạm',
      icon: AlertTriangle,
      color: 'text-amber-600',
      questions: [
        'Hôm nay có những ai đi muộn hoặc vắng mặt?',
        'Liệt kê danh sách giảng viên vắng mặt không phép gần nhất',
      ],
    },
    {
      title: 'Thống Kê Đơn Từ & Quỹ Phép',
      icon: ShieldCheck,
      color: 'text-blue-600',
      questions: [
        'Tình hình các đơn xin nghỉ đang chờ Trưởng khoa phê duyệt?',
        'Có đơn xin nghỉ nào quá hạn chưa được xử lý không?',
      ],
    },
    {
      title: 'Báo Cáo Tóm Tắt Gửi BGH',
      icon: Sparkles,
      color: 'text-indigo-600',
      questions: [
        'Tóm tắt báo cáo chấm công tháng hiện tại để báo cáo Ban Giám Hiệu',
        'Đơn vị nào có tỷ lệ chuyên cần tốt nhất tháng này?',
      ],
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold text-blue-200 border border-white/15">
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              Giai Đoạn 2: Trí Tuệ Nhân Tạo Trong Quản Lý Giáo Dục
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Trợ Lý Gemini AI Cho Thanh Tra Đào Tạo
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Truy vấn và phân tích tức thì dữ liệu chấm công, thời khóa biểu và đơn nghỉ phép bằng ngôn ngữ tự nhiên.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 bg-white/10 px-3 py-2 rounded-xl border border-white/10">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-xs font-bold text-slate-200">Trạng thái: Trực Tuyến</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Side: Categories & Prompt Cards (1 Col) */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-blue-600" />
            Chuyên Đề Thanh Tra
          </h3>

          {sampleCategories.map((cat, idx) => {
            const Icon = cat.icon;
            return (
              <div
                key={idx}
                className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-2.5"
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
                      className="w-full text-left p-2 rounded-lg bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-700 text-[11px] leading-snug transition-colors border border-slate-100"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Side: Chat Window (3 Cols) */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200/80 shadow-sm flex flex-col h-[650px] overflow-hidden">
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
                  className={`max-w-[85%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-blue-600 text-white rounded-br-none shadow-sm'
                      : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-none shadow-sm'
                  }`}
                >
                  <div className="whitespace-pre-wrap font-sans space-y-2">{msg.text}</div>
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
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 mt-1 shadow-sm">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                </div>
                <div className="bg-white border border-slate-200/80 rounded-2xl rounded-bl-none p-4 text-xs text-slate-500 shadow-sm flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce"></span>
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce delay-150"></span>
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce delay-300"></span>
                  <span className="font-medium">Trợ lý AI đang truy vấn CSDL MongoDB và phân tích số liệu...</span>
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
                placeholder="Đặt câu hỏi về chấm công, kỷ luật giảng dạy hoặc tình hình nghỉ phép..."
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
