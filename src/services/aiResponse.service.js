/**
 * Dịch vụ tạo câu trả lời tự nhiên bằng tiếng Việt cho AI Assistant
 * Dựa trên số liệu thực tế đã được Analytics Engine tính toán chính xác
 */

/**
 * Fallback Response Generator: Sinh câu trả lời tiếng Việt định dạng Markdown
 * Hoàn toàn dựa trên số liệu tính toán từ MongoDB, không bịa đặt, ngắn gọn và trực diện
 */
const generateFallbackResponse = ({ intent, question, dateRange, targetUser, department, statistics, error, unauthorizedReason, isAmbiguous, ambiguousMatches }) => {
  // 1. Trường hợp không có quyền (Authorization Failure)
  if (unauthorizedReason) {
    return `### ⛔ Từ Chối Quyền Truy Cập\n\n${unauthorizedReason}\n\n*Hệ thống quản lý chấm công áp dụng nghiêm ngặt phân quyền theo cấp bậc để bảo mật thông tin.*`;
  }

  // 2. Trường hợp tên người dùng bị trùng (Disambiguation)
  if (isAmbiguous && ambiguousMatches && ambiguousMatches.length > 0) {
    return `### 🔍 Yêu Cầu Xác Nhận Danh Tính\n\nTôi tìm thấy **${ambiguousMatches.length} người** phù hợp với tên bạn vừa hỏi. Vui lòng nêu rõ họ tên đầy đủ hoặc mã nhân sự:\n\n` +
      ambiguousMatches.map((m, i) => `${i + 1}. **${m.fullName}** (${m.email}) - Đơn vị: *${m.departmentName}* [Vai trò: \`${m.role}\`]`).join('\n');
  }

  // 3. Trường hợp không tìm thấy người dùng
  if (error === 'USER_NOT_FOUND') {
    return `### ⚠️ Không Tìm Thấy Người Dùng\n\nKhông tìm thấy thông tin cán bộ hoặc giảng viên trong hệ thống. Vui lòng kiểm tra lại họ tên hoặc đơn vị công tác.`;
  }

  const timeLabel = dateRange?.label || 'khoảng thời gian yêu cầu';
  const userName = targetUser?.fullName || 'Người dùng';
  const deptName = department?.name || 'toàn trường';

  switch (intent) {
    // ------------------------------------------------------------------------
    // NHÓM CHẤM CÔNG CÁ NHÂN
    // ------------------------------------------------------------------------
    case 'ATTENDANCE_USER_LATE': {
      const lateCount = statistics?.late || 0;
      if (statistics?.total === 0) {
        return `### 📋 Thống Kê Đi Trễ\n\nTrong ${timeLabel}, **${userName}** không có bản ghi chấm công nào trong hệ thống.`;
      }
      if (lateCount === 0) {
        return `### 📋 Thống Kê Đi Trễ\n\nTrong ${timeLabel}, **${userName}** **không đi trễ lần nào** (0 ngày). Đạt tỷ lệ đúng giờ 100%!`;
      }
      return `### 📋 Thống Kê Đi Trễ\n\nTrong ${timeLabel}, **${userName}** đã **đi trễ ${lateCount} ngày** (trên tổng số ${statistics.total} lượt chấm công ghi nhận).`;
    }

    case 'ATTENDANCE_USER_ON_TIME': {
      const onTimeCount = statistics?.onTime || 0;
      if (statistics?.total === 0) {
        return `### 📋 Thống Kê Đúng Giờ\n\nTrong ${timeLabel}, không tìm thấy dữ liệu chấm công của **${userName}** trong hệ thống.`;
      }
      return `### 📋 Thống Kê Đúng Giờ\n\nTrong ${timeLabel}, **${userName}** đã chấm công **đúng giờ ${onTimeCount} ngày** (trên tổng số ${statistics.total} lượt chấm công).`;
    }

    case 'ATTENDANCE_USER_ABSENT': {
      const absentCount = statistics?.absent || 0;
      const excusedCount = statistics?.excusedAbsent || 0;
      if (absentCount === 0 && excusedCount === 0) {
        return `### 📋 Thống Kê Vắng Mặt\n\nTrong ${timeLabel}, **${userName}** **không có ngày nào vắng mặt**!`;
      }
      return `### 📋 Thống Kê Vắng Mặt\n\nTrong ${timeLabel}, **${userName}** có:\n- **Vắng không phép (ABSENT):** ${absentCount} ngày\n- **Vắng có phép (EXCUSED_ABSENCE):** ${excusedCount} ngày`;
    }

    case 'ATTENDANCE_USER_TOTAL': {
      const total = statistics?.total || 0;
      if (total === 0) {
        return `### 📋 Tổng Số Ngày Chấm Công\n\nTrong ${timeLabel}, **${userName}** chưa có lượt chấm công nào được ghi nhận.`;
      }
      return `### 📋 Tổng Số Ngày Chấm Công\n\nTrong ${timeLabel}, **${userName}** có tổng cộng **${total} ngày** phát sinh dữ liệu chấm công.`;
    }

    case 'ATTENDANCE_USER_SUMMARY': {
      const { total, onTime, late, earlyLeave, absent, excusedAbsent } = statistics || {};
      if (total === 0) {
        return `### 📋 Báo Cáo Chấm Công: ${userName}\n\nTrong ${timeLabel}, không tìm thấy dữ liệu chấm công của **${userName}** trong hệ thống.`;
      }
      return `### 📋 Báo Cáo Chấm Công: ${userName}\n\nTrong ${timeLabel}, hệ thống ghi nhận tổng cộng **${total} lượt** chấm công của **${userName}**:\n\n` +
        `- ✅ **Đúng giờ:** ${onTime} ngày\n` +
        `- ⚠️ **Đi trễ:** ${late} ngày\n` +
        `- 🚪 **Về sớm:** ${earlyLeave} ngày\n` +
        `- 📩 **Vắng có phép:** ${excusedAbsent} ngày\n` +
        `- ❌ **Vắng không phép:** ${absent} ngày`;
    }

    // ------------------------------------------------------------------------
    // NHÓM CHẤM CÔNG TỔNG HỢP / ĐI LÀM / TRỄ / VẮNG
    // ------------------------------------------------------------------------
    case 'ATTENDANCE_PRESENT_COUNT': {
      const count = statistics?.presentUserCount || 0;
      const totalLogs = statistics?.total || 0;
      return `### 👥 Thống Kê Người Đi Làm Hôm Nay\n\nTrong ${timeLabel}, hệ thống ghi nhận **${count} người** đã chấm công đi làm (với tổng số ${totalLogs} lượt check-in ghi nhận).`;
    }

    case 'ATTENDANCE_LATE_COUNT': {
      const lateCount = statistics?.late || 0;
      if (lateCount === 0) {
        return `### ⏰ Thống Kê Đi Trễ\n\nTrong ${timeLabel}, tại ${deptName} **không có ai đi trễ**. Nề nếp kỷ luật rất tốt!`;
      }
      return `### ⏰ Thống Kê Đi Trễ\n\nTrong ${timeLabel}, tại ${deptName} có **${lateCount} lượt đi trễ**.`;
    }

    case 'ATTENDANCE_ABSENT_COUNT': {
      const absentCount = statistics?.absent || 0;
      const excusedCount = statistics?.excusedAbsent || 0;
      if (absentCount === 0 && excusedCount === 0) {
        return `### 🚫 Thống Kê Vắng Mặt\n\nTrong ${timeLabel}, tại ${deptName} **không có người nào vắng mặt**.`;
      }
      return `### 🚫 Thống Kê Vắng Mặt\n\nTrong ${timeLabel}, tại ${deptName} ghi nhận:\n- **Vắng không phép:** ${absentCount} trường hợp\n- **Vắng có phép:** ${excusedCount} trường hợp\n- **Tổng lượt vắng:** ${absentCount + excusedCount} trường hợp`;
    }

    case 'ATTENDANCE_TOP_LATE': {
      const { topUsers, totalLateLogs } = statistics || {};
      if (!topUsers || topUsers.length === 0) {
        return `### 🏆 Thống Kê Đi Trễ Nhiều Nhất\n\nTrong ${timeLabel}, tại ${deptName} **không ghi nhận lượt đi trễ nào**!`;
      }
      return `### 🏆 Danh Sách Đi Trễ Nhiều Nhất\n\nTrong ${timeLabel} (Tổng số ${totalLateLogs} lượt trễ ghi nhận):\n\n` +
        topUsers.map((u, i) => `${i + 1}. **${u.fullName}** (${u.email}) - **${u.count} lần** đi trễ`).join('\n');
    }

    // ------------------------------------------------------------------------
    // NHÓM ĐƠN NGHỈ / DẠY BÙ / ĐỔI CA
    // ------------------------------------------------------------------------
    case 'LEAVE_REQUEST_COUNT': {
      const { total, pending, approved, rejected } = statistics || {};
      return `### 📑 Thống Kê Đơn Xin Nghỉ\n\nTrong ${timeLabel}, tại ${deptName} có **${total} đơn** xin nghỉ phép:\n\n` +
        `- ⏳ **Đang chờ duyệt (PENDING):** ${pending} đơn\n` +
        `- ✅ **Đã được phê duyệt (APPROVED):** ${approved} đơn\n` +
        `- ❌ **Bị từ chối (REJECTED):** ${rejected} đơn`;
    }

    case 'LEAVE_REQUEST_USER_DAYS': {
      const approvedDays = statistics?.totalApprovedDays || 0;
      const totalRequests = statistics?.total || 0;
      const approvedReqs = statistics?.approved || 0;
      if (totalRequests === 0) {
        return `### 🌴 Tổng Số Ngày Nghỉ Phép: ${userName}\n\nTrong ${timeLabel}, **${userName}** không có đơn xin nghỉ phép nào trong hệ thống.`;
      }
      return `### 🌴 Tổng Số Ngày Nghỉ Phép: ${userName}\n\nTrong ${timeLabel}, **${userName}** có tổng cộng **${approvedDays} ngày nghỉ** đã được phê duyệt hợp lệ (từ ${approvedReqs} đơn đã duyệt).`;
    }

    case 'LEAVE_REQUEST_TYPE_COUNT': {
      const typeLabel = statistics?.leaveType === 'day_bu' ? 'đăng ký dạy bù' : 'xin đổi ca';
      const { total, pending, approved, rejected } = statistics || {};
      return `### 🔄 Thống Kê Đơn ${typeLabel.toUpperCase()}\n\nTrong ${timeLabel}, hệ thống ghi nhận **${total} đơn** ${typeLabel}:\n\n` +
        `- ⏳ **Đang chờ duyệt:** ${pending} đơn\n` +
        `- ✅ **Đã được duyệt:** ${approved} đơn\n` +
        `- ❌ **Bị từ chối:** ${rejected} đơn`;
    }

    // ------------------------------------------------------------------------
    // NHÓM LỊCH GIẢNG DẠY
    // ------------------------------------------------------------------------
    case 'SCHEDULE_USER_COUNT': {
      const sessionCount = statistics?.totalActualSessions || 0;
      if (sessionCount === 0) {
        return `### 📚 Số Buổi Giảng Dạy: ${userName}\n\nTrong ${timeLabel}, **${userName}** không có buổi giảng dạy nào theo thời khóa biểu.`;
      }
      return `### 📚 Số Buổi Giảng Dạy: ${userName}\n\nTrong ${timeLabel}, **${userName}** có tổng cộng **${sessionCount} buổi dạy** thực tế theo phân công thời khóa biểu.`;
    }

    case 'SCHEDULE_USER_CHECK': {
      const sessionCount = statistics?.totalActualSessions || 0;
      if (sessionCount === 0) {
        return `### 📅 Lịch Giảng Dạy: ${userName}\n\nTrong ${timeLabel}, **${userName}** **KHÔNG CÓ** lịch giảng dạy nào trong hệ thống.`;
      }
      return `### 📅 Lịch Giảng Dạy: ${userName}\n\nTrong ${timeLabel}, **${userName}** **CÓ ${sessionCount} buổi giảng dạy** theo thời khóa biểu.`;
    }

    case 'SCHEDULE_USER_DETAILS': {
      const sessions = statistics?.sessions || [];
      if (sessions.length === 0) {
        return `### 📅 Lịch Giảng Dạy Chi Tiết: ${userName}\n\nTrong ${timeLabel}, **${userName}** không có lịch giảng dạy nào.`;
      }
      return `### 📅 Lịch Giảng Dạy Chi Tiết: ${userName}\n\nTrong ${timeLabel}, **${userName}** có **${sessions.length} buổi giảng dạy**:\n\n` +
        sessions.map((s, i) => `${i + 1}. **${s.subjectName}** (${s.subjectCode || 'N/A'})\n   - **Thời gian:** ${s.startTime} - ${s.endTime} (${s.shiftName || 'Ca học'})\n   - **Ngày:** ${s.dateDisplay} (Thứ ${s.weekday === 0 ? 'CN' : s.weekday + 1})\n   - **Phòng học:** ${s.roomId || 'Chưa xếp phòng'}`).join('\n\n');
    }

    case 'SCHEDULE_DEPT_TEACHERS_TODAY': {
      const { totalTeachers, totalSessions, teachers } = statistics || {};
      if (totalTeachers === 0) {
        return `### 🏛️ Lịch Giảng Dạy Hôm Nay: ${deptName}\n\nHôm nay, tại **${deptName}** không có giảng viên nào có lịch giảng dạy theo thời khóa biểu.`;
      }
      return `### 🏛️ Lịch Giảng Dạy Hôm Nay: ${deptName}\n\nHôm nay, tại **${deptName}** có **${totalTeachers} giảng viên** có lịch giảng dạy (Tổng số ${totalSessions} tiết/ca dạy):\n\n` +
        teachers.map((t, i) => `${i + 1}. **${t.fullName}** - ${t.sessionsCount} ca dạy`).join('\n');
    }

    // ------------------------------------------------------------------------
    // BÁO CÁO CHUNG
    // ------------------------------------------------------------------------
    case 'GENERAL_REPORT':
    default: {
      return `### 🤖 Trợ Lý AI Chấm Công & Đào Tạo Đại Học\n\nHệ thống ghi nhận câu hỏi của bạn: *"${question}"*\n\n` +
        `Bạn có thể tra cứu chi tiết bằng các câu hỏi mẫu sau:\n` +
        `- *"Hôm nay có bao nhiêu người đi làm?"*\n` +
        `- *"Hôm nay có bao nhiêu người đi trễ / vắng?"*\n` +
        `- *"Tuần này có bao nhiêu đơn xin nghỉ?"*\n` +
        `- *"Lịch giảng dạy của tôi hôm nay như thế nào?"*\n` +
        `- *"Trong tuần này ai đi trễ nhiều nhất?"*`;
    }
  }
};

/**
 * Gọi Google Gemini API từ Google AI Studio
 * Hỗ trợ đa dạng model (gemini-2.0-flash, gemini-1.5-flash, gemini-1.5-pro)
 * Nhận API Key từ client hoặc từ biến môi trường
 */
const generateGeminiResponse = async (payload) => {
  let apiKey = (payload?.apiKey || process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    try {
      require('dotenv').config();
      apiKey = (process.env.GEMINI_API_KEY || '').trim();
    } catch (e) {}
  }
  if (!apiKey) return null;

  const model = payload?.model || 'gemini-3.5-flash-lite';

  try {
    const prompt = `YÊU CẦU: Trả lời câu hỏi người dùng DỰA TRÊN SỐ LIỆU MONGODB DƯỚI ĐÂY:
- Câu hỏi: "${payload.question}"
- Khoảng thời gian: ${payload.dateRange?.label || 'N/A'}
- Ý định: ${payload.intent}
- Đối tượng: ${payload.targetUser?.fullName || 'N/A'}
- Đơn vị / Khoa: ${payload.department?.name || 'N/A'}
- Số liệu thống kê: ${JSON.stringify(payload.statistics || {})}
- Quyền hạn: ${payload.unauthorizedReason || 'Hợp lệ'}

QUY TẮC CỐT LÕI (TRẢ LỜI TRỰC DIỆN - KHÔNG LAN MAN):
1. CẤM mở bài, CẤM chào hỏi (Tuyệt đối không viết "Chào bạn", "Tôi là trợ lý AI...", "Căn cứ theo...", "Dưới đây là...").
2. VÀO THẲNG CÂU TRẢ LỜI NGAY DÒNG ĐẦU TIÊN với các con số cụ thể.
3. Trình bày ngắn gọn bằng 2-4 gạch đầu dòng, in đậm các con số quan trọng.
4. CẤM kết bài sáo rỗng hoặc lời chúc cuối câu.
5. Tuyệt đối không bịa số liệu. Chỉ dùng đúng các con số được cung cấp.`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500); // 2.5s timeout

    const genConfig = {
      maxOutputTokens: 350,
      temperature: 0.2, // Tập trung cao độ, không lan man
    };
    if (model.includes('3.6-flash')) {
      genConfig.thinkingConfig = { thinkingBudget: 0 };
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: genConfig,
        }),
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) return text;

    return null;
  } catch (err) {
    // Quá thời gian chờ hoặc lỗi mạng: lập tức dùng bộ tổng hợp CSDL MongoDB siêu tốc (0.05s)
    return null;
  }
};

/**
 * Trực tiếp trả lời bằng Google AI Studio Gemini cho các AI Agent chuyên biệt (Học thuật, Đa năng)
 */
const generateDirectAgentResponse = async ({ question, agentMode, model = 'gemini-3.5-flash-lite', apiKey, user }) => {
  let activeKey = (apiKey || process.env.GEMINI_API_KEY || '').trim();
  if (!activeKey) {
    try {
      require('dotenv').config();
      activeKey = (process.env.GEMINI_API_KEY || '').trim();
    } catch (e) {}
  }

  const roleTitle = user?.role === 'admin' ? 'Quản trị viên' : user?.role === 'truongkhoa' ? 'Trưởng khoa' : 'Giảng viên/Cán bộ';
  const userName = user?.fullName || 'Thầy/Cô';

  let systemPrompt = '';
  if (agentMode === 'academic') {
    systemPrompt = `Bạn là Trợ lý Học thuật & Sư phạm Đại học.
QUY TẮC BẮT BUỘC (TRẢ LỜI TRỰC DIỆN - KHÔNG LAN MAN DÀI DÒNG):
1. ĐÚNG TRỌNG TÂM 100%: Đi thẳng vào nội dung câu hỏi, không nói vòng vo.
2. CẤM chào hỏi xã giao, CẤM mở bài dài dòng (Tuyệt đối không viết "Kính chào Thầy/Cô", "Tôi rất vui...", "Dưới đây là gợi ý...").
3. VÀO THẲNG NỘI DUNG YÊU CẦU:
   - Nếu hỏi trắc nghiệm: Xuất ngay từng câu hỏi kèm 4 đáp án A, B, C, D, chỉ rõ đáp án đúng và giải thích ngắn 1 dòng.
   - Nếu hỏi soạn giáo án/đề cương: Xuất ngay các mục chính dạng gạch đầu dòng cô đọng.
   - Nếu hỏi quy chế: Nêu ngay điều khoản, công thức tính và quy định cụ thể.
4. CẤM kết bài sáo rỗng (CẤM viết: "Hy vọng câu trả lời này giúp ích...", "Nếu cần thêm...").
5. Ngắn gọn, súc tích, cấu trúc rõ ràng bằng Markdown.`;
  } else {
    // general
    systemPrompt = `Bạn là Trợ Lý AI Đa Năng.
QUY TẮC BẮT BUỘC (TRẢ LỜI TRỰC DIỆN - KHÔNG LAN MAN DÀI DÒNG):
1. VÀO THẲNG VẤN ĐỀ, trả lời trực diện ngay dòng đầu tiên.
2. CẤM chào hỏi mở đầu, CẤM giới thiệu bản thân, CẤM kết bài sáo rỗng.
3. Cung cấp câu trả lời ngắn gọn, chuẩn xác, định dạng Markdown sạch sẽ.`;
  }

  let apiErrorMessage = null;

  if (activeKey) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

      const genConfig = {
        maxOutputTokens: 600,
        temperature: 0.2, // Nhiệt độ thấp giúp câu trả lời chuẩn xác, không lan man
      };
      if (model.includes('3.6-flash')) {
        genConfig.thinkingConfig = { thinkingBudget: 0 };
      }

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${activeKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': activeKey,
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ parts: [{ text: question }] }],
            generationConfig: genConfig,
          }),
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      const data = await res.json();
      if (data?.error) {
        apiErrorMessage = data.error.message || JSON.stringify(data.error);
        console.warn(`[Direct Gemini - ${model}] API Response:`, apiErrorMessage);

        // Fallback sang 3.6-flash với thinkingBudget 0 nếu model lite gặp lỗi
        if (model === 'gemini-3.5-flash-lite') {
          const fallbackRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${activeKey}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': activeKey,
              },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: systemPrompt }] },
                contents: [{ parts: [{ text: question }] }],
                generationConfig: {
                  thinkingConfig: { thinkingBudget: 0 },
                  maxOutputTokens: 800,
                },
              }),
            }
          );
          const fallbackData = await fallbackRes.json();
          const fallbackText = fallbackData?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (fallbackText) return fallbackText;
        }
      }
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
    } catch (err) {
      if (err.name === 'AbortError') {
        apiErrorMessage = 'Yêu cầu phản hồi quá thời gian cho phép (6s). Vui lòng thử lại với câu hỏi ngắn gọn hơn.';
      } else {
        apiErrorMessage = err.message;
      }
      console.warn('[Direct Gemini] Lỗi gọi Gemini:', apiErrorMessage);
    }
  }

  // Trường hợp đã có Key trong .env nhưng Google báo lỗi (ví dụ sai định dạng hoặc hết hạn)
  if (activeKey && apiErrorMessage) {
    return `### ⚠️ Không thể kết nối Google AI Studio (Gemini)\n\n` +
      `Hệ thống đã đọc \`GEMINI_API_KEY\` từ file \`.env\`, tuy nhiên Google AI Studio trả về thông báo lỗi:\n\n` +
      `> ❌ **Nguyên nhân:** \`${apiErrorMessage}\`\n\n` +
      `**Hướng dẫn xử lý:**\n` +
      `- Khóa chuẩn của Google AI Studio (Gemini) bắt đầu bằng \`AIzaSy...\` (khoảng 39 ký tự).\n` +
      `- Vui lòng truy cập **[aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)**, bấm **"Create API key"** hoặc copy lại đúng mã khóa.\n` +
      `- Dán vào biến \`GEMINI_API_KEY=\` trong file \`.env\` ở thư mục gốc của dự án.`;
  }

  // Fallback khi chưa cấu hình Key trong .env
  if (agentMode === 'academic') {
    return `### 🎓 Trợ Lý Học Thuật & Giáo Dục Đại Học\n\nTôi đã ghi nhận yêu cầu: **"${question}"**.\n\n` +
      `⚠️ **Chưa cấu hình API Key trong file .env**\n\n` +
      `Để kích hoạt toàn bộ sức mạnh AI của **Google AI Studio (Gemini 2.0 Flash)** cho tác vụ soạn giáo án, câu hỏi trắc nghiệm và nghiên cứu, vui lòng dán khóa API vào file \`.env\` của hệ thống:\n\n` +
      `\`\`\`env\nGEMINI_API_KEY=AIzaSy...\n\`\`\`\n\n` +
      `*Mẹo: Bạn có thể lấy khóa API miễn phí từ Google AI Studio tại: [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey).*`;
  }

  return `### ⚡ Trợ Lý AI Đa Năng (Google AI Studio)\n\nTôi đã nhận câu hỏi: **"${question}"**.\n\n` +
    `⚠️ **Chưa cấu hình API Key trong file .env**\n\n` +
    `Vui lòng dán khóa Google AI Studio API Key vào biến \`GEMINI_API_KEY\` trong file \`.env\` của máy chủ để bắt đầu trò chuyện trực tiếp với mô hình **Gemini 2.0 Flash**!`;
};

/**
 * Hàm tổng hợp sinh câu trả lời AI hoàn chỉnh
 * @param {Object} context
 * @returns {Promise<string>}
 */
const generateAiResponse = async (context) => {
  // 1. Thử gọi Gemini AI nếu có API Key
  const geminiAnswer = await generateGeminiResponse(context);
  if (geminiAnswer) {
    return geminiAnswer;
  }

  // 2. Sử dụng Fallback Generator chuẩn xác
  return generateFallbackResponse(context);
};

module.exports = {
  generateAiResponse,
  generateFallbackResponse,
  generateDirectAgentResponse,
};
