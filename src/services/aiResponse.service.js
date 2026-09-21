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
 * Gọi Google Gemini API để tạo phản hồi tự nhiên hơn
 * (Chỉ kích hoạt khi có GEMINI_API_KEY)
 */
const generateGeminiResponse = async (payload) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const prompt = `Bạn là Trợ lý AI Quản lý Chấm công & Lịch Giảng dạy của Trường Đại học.
Dưới đây là KẾT QUẢ ĐÃ TÍNH TOÁN CHÍNH XÁC từ cơ sở dữ liệu MongoDB:
- Câu hỏi của người dùng: "${payload.question}"
- Khoảng thời gian: ${payload.dateRange?.label || 'N/A'}
- Ý định: ${payload.intent}
- Đối tượng người dùng (nếu có): ${payload.targetUser?.fullName || 'N/A'}
- Đơn vị / Khoa: ${payload.department?.name || 'N/A'}
- Dữ liệu số liệu thống kê thực tế: ${JSON.stringify(payload.statistics || {})}
- Lỗi / Từ chối quyền (nếu có): ${payload.unauthorizedReason || 'Không có'}

QUY TẮC BẮT BUỘC:
1. Bạn KHÔNG ĐƯỢC TỰ ĐOÁN HOẶC BỊA SỐ LIỆU. Chỉ sử dụng đúng các con số đã được cung cấp ở trên.
2. Trả lời bằng tiếng Việt, văn phong sư phạm chuẩn mực, rõ ràng, trực diện, định dạng Markdown đẹp.
3. Nếu dữ liệu bằng 0 hoặc không có, nêu rõ ràng là không có bản ghi nào trong khoảng thời gian đó.
4. Nếu có lỗi từ chối quyền hạn, nêu rõ lý do bảo mật và từ chối cung cấp dữ liệu.`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return text || null;
  } catch (err) {
    console.warn('[AI Response] Lỗi gọi Gemini API, chuyển sang Fallback Generator:', err.message);
    return null;
  }
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
};
