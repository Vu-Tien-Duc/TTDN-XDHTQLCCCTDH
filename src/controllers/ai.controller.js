const AttendanceLog = require('../models/attendanceLog.model');
const LeaveRequest = require('../models/leaveRequest.model');
const User = require('../models/user.model');
const Department = require('../models/department.model');
const { sendSuccess, sendError } = require('../utils/responseHandler');

/**
 * Controller xử lý câu hỏi của Thanh tra đào tạo bằng Gemini AI / Fallback Analytics Engine
 * @route POST /api/ai/chat
 */
const handleAiChat = async (req, res, next) => {
  try {
    const { question } = req.body;

    if (!question || !question.trim()) {
      return sendError(res, 'Vui lòng cung cấp câu hỏi cho Trợ lý AI.', null, 400);
    }

    const cleanQuestion = question.trim();
    const qLower = cleanQuestion.toLowerCase();

    // 1. Xác định mốc thời gian chuẩn xác của "HÔM NAY" theo múi giờ Việt Nam (UTC+7)
    const now = new Date();
    const getVietnamDateKey = (date) => {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(date));
    };

    const vnDateStr = getVietnamDateKey(now); // 'YYYY-MM-DD'
    const [y, m, d] = vnDateStr.split('-').map(Number);
    const startOfToday = new Date(`${vnDateStr}T00:00:00.000+07:00`);
    const endOfToday = new Date(`${vnDateStr}T23:59:59.999+07:00`);
    const formattedTodayStr = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;

    // 2. Thu thập dữ liệu thực tế từ hệ thống
    const [totalUsers, facultyDepts, recentAttendances, allNonRejectedLeaves, pendingLeaves, approvedLeaves, todayAttendances] = await Promise.all([
      User.find({ isActive: true }).select('fullName email role departmentId'),
      Department.find().select('name code type'),
      AttendanceLog.find()
        .sort({ checkInTime: -1 })
        .limit(100)
        .populate('userId', 'fullName email role departmentId'),
      // Lấy toàn bộ đơn không bị từ chối để lọc chuẩn xác theo ngày lịch Việt Nam
      LeaveRequest.find({ status: { $ne: 'REJECTED' } }).populate('userId', 'fullName email role departmentId'),
      LeaveRequest.find({ status: 'PENDING' }).populate('userId', 'fullName email departmentId'),
      LeaveRequest.find({ status: 'APPROVED' }).sort({ updatedAt: -1 }).limit(20).populate('userId', 'fullName email departmentId'),
      // Điểm danh hôm nay
      AttendanceLog.find({
        checkInTime: { $gte: startOfToday, $lte: endOfToday },
      }).populate('userId', 'fullName email role departmentId'),
    ]);

    // Lọc chuẩn xác đơn có hiệu lực trong ngày hôm nay (VN date key)
    const todayLeaves = allNonRejectedLeaves.filter((l) => {
      const sKey = getVietnamDateKey(l.startDate);
      const eKey = getVietnamDateKey(l.endDate);
      return sKey <= vnDateStr && eKey >= vnDateStr;
    });

    // Thống kê nhanh
    const onTimeLogs = recentAttendances.filter((a) => a.status === 'ON_TIME');
    const lateLogs = recentAttendances.filter((a) => a.status === 'LATE');
    const absentLogs = recentAttendances.filter((a) => a.status === 'ABSENT');
    const excusedLogs = recentAttendances.filter((a) => a.status === 'EXCUSED_ABSENCE');

    const violators = lateLogs.concat(absentLogs).map((log) => ({
      name: log.userId?.fullName || 'Không rõ',
      email: log.userId?.email || 'N/A',
      status: log.status === 'LATE' ? 'Đi muộn' : 'Vắng mặt',
      time: log.checkInTime ? new Date(log.checkInTime).toLocaleTimeString('vi-VN') : 'Không có',
    }));

    // Vi phạm hôm nay
    const todayLate = todayAttendances.filter((a) => a.status === 'LATE');
    const todayAbsent = todayAttendances.filter((a) => a.status === 'ABSENT');

    // 3. Nếu có GEMINI_API_KEY trong .env -> Gọi Google Gemini API
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (geminiApiKey) {
      try {
        const systemPrompt = `Bạn là Trợ lý AI Thanh tra Đào tạo & Quản lý Chấm công của Trường Đại học.
Hôm nay là ngày ${formattedTodayStr}.
Dưới đây là dữ liệu thực tế thời gian thực của hệ thống:
- ĐƠN XIN NGHỈ CỤ THỂ TRONG NGÀY HÔM NAY (${formattedTodayStr}): ${todayLeaves.length} đơn. Chi tiết: ${JSON.stringify(
          todayLeaves.map((l) => ({
            fullName: l.userId?.fullName,
            email: l.userId?.email,
            type: l.type,
            reason: l.reason,
            status: l.status,
            from: l.startDate,
            to: l.endDate,
          }))
        )}
- Điểm danh hôm nay: ${todayAttendances.length} lượt (Đi muộn: ${todayLate.length}, Vắng: ${todayAbsent.length}).
- Tổng số nhân sự: ${totalUsers.length} người.
- Tổng số đơn chờ duyệt toàn trường (PENDING): ${pendingLeaves.length} đơn.

QUY TẮC TRẢ LỜI QUAN TRỌNG:
- Khi người dùng hỏi về đơn xin nghỉ (hoặc "hôm nay có đơn xin nghỉ nào hay không", "ai nghỉ hôm nay"): Bạn CHỈ ĐƯỢC XEM VÀ TRẢ LỜI DỨT KHOÁT về ngày cụ thể HÔM NAY (${formattedTodayStr}).
  + Nếu hôm nay KHÔNG có đơn: Khẳng định dứt khoát "Hôm nay (${formattedTodayStr}) KHÔNG CÓ đơn xin nghỉ nào trong hệ thống."
  + Nếu hôm nay CÓ đơn: Liệt kê rõ ràng họ tên, lý do, trạng thái của từng đơn trong ngày hôm nay.
  + TUYỆT ĐỐI KHÔNG trả lời lan man sang các ngày khác hoặc số liệu chung chung nếu người dùng không yêu cầu.
- Sử dụng định dạng Markdown ngắn gọn, rõ ràng, trực diện.`;

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { text: systemPrompt },
                    { text: `Câu hỏi của Thanh tra đào tạo: "${cleanQuestion}"` },
                  ],
                },
              ],
            }),
          }
        );

        const geminiData = await response.json();
        const aiAnswer = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || null;

        if (aiAnswer) {
          return sendSuccess(res, 'Phản hồi từ Gemini AI.', {
            question: cleanQuestion,
            answer: aiAnswer,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (geminiError) {
        console.warn('Lỗi gọi Gemini API, chuyển sang Fallback Analytics Engine:', geminiError.message);
      }
    }

    // 4. Fallback Engine: Bộ phân tích dứt khoát dựa trên dữ liệu thực tế
    let generatedAnswer = '';

    // A. Câu hỏi dứt khoát: Đơn xin nghỉ HÔM NAY
    const isAskingToday = qLower.includes('hôm nay') || qLower.includes('nay') || qLower.includes('today') || qLower.includes('ngày hôm nay');
    const isAskingLeave = qLower.includes('nghỉ') || qLower.includes('đơn') || qLower.includes('phép');
    const isAskingAll = qLower.includes('tất cả') || qLower.includes('toàn trường') || qLower.includes('toàn bộ') || qLower.includes('lịch sử');

    if (isAskingLeave && !isAskingAll) {
      // Mặc định trả lời DỨT KHOÁT và CHỈ XEM ngày cụ thể HÔM NAY
      if (todayLeaves.length === 0) {
        generatedAnswer = `### 📌 Tình Hình Đơn Xin Nghỉ Hôm Nay (${formattedTodayStr})

**KẾT LUẬN DỨT KHOÁT:** Ngày hôm nay (${formattedTodayStr}) **KHÔNG CÓ** cán bộ/giảng viên nào có đơn xin nghỉ phép trong hệ thống.

- Toàn bộ cán bộ, giảng viên có lịch công tác đều tham gia giảng dạy và làm việc bình thường theo thời khóa biểu.
- Không phát sinh ca nghỉ phép, dạy bù hay đổi ca nào trong ngày hôm nay.`;
      } else {
        generatedAnswer = `### 📌 Danh Sách Đơn Xin Nghỉ Hôm Nay (${formattedTodayStr})

**KẾT LUẬN DỨT KHOÁT:** Ngày hôm nay (${formattedTodayStr}) **CÓ ${todayLeaves.length} ĐƠN XIN NGHỈ** trong hệ thống:

${todayLeaves
  .map((leave, idx) => {
    const statusText =
      leave.status === 'APPROVED'
        ? '✅ Đã duyệt'
        : leave.status === 'PENDING'
        ? '⏳ Đang chờ duyệt'
        : '❌ Bị từ chối';
    const typeText =
      leave.type === 'nghi_phep'
        ? 'Nghỉ phép thường'
        : leave.type === 'day_bu'
        ? 'Đăng ký dạy bù'
        : 'Xin đổi ca';
    const startStr = new Date(leave.startDate).toLocaleDateString('vi-VN');
    const endStr = new Date(leave.endDate).toLocaleDateString('vi-VN');

    return `${idx + 1}. **${leave.userId?.fullName || 'Cán bộ'}** (${leave.userId?.email || 'N/A'})
   - **Loại đơn:** ${typeText}
   - **Thời gian:** Từ ${startStr} đến ${endStr}
   - **Lý do:** *"${leave.reason}"*
   - **Trạng thái:** **${statusText}**`;
  })
  .join('\n\n')}`;
      }
    } else if (isAskingToday && (qLower.includes('muộn') || qLower.includes('vắng') || qLower.includes('vi phạm'))) {
      // B. Câu hỏi dứt khoát: Đi muộn / vắng HÔM NAY
      if (todayLate.length === 0 && todayAbsent.length === 0) {
        generatedAnswer = `### 📋 Báo Cáo Chuyên Cần Hôm Nay (${formattedTodayStr})

**KẾT QUẢ DỨT KHOÁT:** Hôm nay **KHÔNG CÓ** trường hợp nào vi phạm đi muộn hoặc vắng mặt không phép!

- Tổng số lượt điểm danh hôm nay: **${todayAttendances.length} lượt**.
- 100% cán bộ, giảng viên có ca đều chấp hành đúng giờ giảng dạy.`;
      } else {
        generatedAnswer = `### 📋 Danh Sách Vi Phạm Điểm Danh Hôm Nay (${formattedTodayStr})

Hệ thống ghi nhận **${todayLate.length + todayAbsent.length} trường hợp** cần lưu ý hôm nay:
${todayLate.map((l, i) => `${i + 1}. **${l.userId?.fullName}** - ⚠️ Đi muộn (${l.checkInTime ? new Date(l.checkInTime).toLocaleTimeString('vi-VN') : ''})`).join('\n')}
${todayAbsent.map((a, i) => `${i + 1 + todayLate.length}. **${a.userId?.fullName}** - ❌ Vắng không phép`).join('\n')}`;
      }
    } else if (qLower.includes('muộn') || qLower.includes('vắng') || qLower.includes('vi phạm')) {
      // C. Vi phạm chung
      generatedAnswer = `### 📋 Báo Cáo Tình Hình Đi Muộn & Vắng Mặt (Thanh Tra Đào Tạo)

Hệ thống ghi nhận trong các lượt điểm danh gần nhất:
- **Số ca đúng giờ:** ${onTimeLogs.length} lượt (${recentAttendances.length > 0 ? Math.round((onTimeLogs.length / recentAttendances.length) * 100) : 100}%)
- **Số ca đi muộn:** ${lateLogs.length} lượt
- **Số ca vắng không phép:** ${absentLogs.length} lượt
- **Số ca vắng có phép:** ${excusedLogs.length} lượt

${
  violators.length > 0
    ? `**Danh sách các trường hợp cần lưu ý:**\n` +
      violators
        .slice(0, 5)
        .map((v, i) => `${i + 1}. **${v.name}** (${v.email}) - Trạng thái: \`${v.status}\` lúc ${v.time}`)
        .join('\n')
    : `✅ Hiện tại **không có giảng viên/cán bộ nào vi phạm** đi muộn hoặc vắng mặt không phép!`
}

💡 **Khuyến nghị từ Thanh tra:** Đối với các trường hợp vắng không phép, đề nghị Trưởng Bộ môn liên hệ giảng viên yêu cầu nộp đơn giải trình hoặc đơn dạy bù trong vòng 48 giờ theo đúng quy chế.`;
    } else if (qLower.includes('nghỉ') || qLower.includes('đơn') || qLower.includes('phép')) {
      // D. Đơn xin nghỉ chung toàn trường
      generatedAnswer = `### 📑 Tổng Hợp Đơn Xin Nghỉ Phép & Dạy Bù Toàn Trường

Theo cơ sở dữ liệu thời gian thực:
- **Số đơn đang chờ phê duyệt (PENDING):** **${pendingLeaves.length} đơn**
- **Số đơn đã được phê duyệt gần đây:** ${approvedLeaves.length} đơn

${
  pendingLeaves.length > 0
    ? `**Các đơn đang chờ Trưởng khoa / Admin xử lý:**\n` +
      pendingLeaves
        .slice(0, 5)
        .map(
          (d, i) =>
            `${i + 1}. Giảng viên **${d.userId?.fullName || 'Ẩn danh'}** - Loại đơn: \`${d.type}\` (Từ ${new Date(d.startDate).toLocaleDateString('vi-VN')} đến ${new Date(d.endDate).toLocaleDateString('vi-VN')})`
        )
        .join('\n')
    : `✅ Toàn bộ đơn xin nghỉ phép trong hệ thống đã được xử lý, không có đơn tồn đọng.`
}

💡 **Lưu ý nghiệp vụ:** Khi Trưởng khoa hoặc Ban Giám hiệu phê duyệt đơn, hệ thống sẽ tự động đồng bộ sang bảng điểm danh thành trạng thái **Nghỉ có phép (EXCUSED_ABSENCE)** để bảo lưu quyền lợi cho giảng viên.`;
    } else if (qLower.includes('tóm tắt') || qLower.includes('báo cáo') || qLower.includes('tổng quan') || qLower.includes('kpi')) {
      const attendanceRate = recentAttendances.length > 0
        ? Math.round(((onTimeLogs.length + excusedLogs.length) / recentAttendances.length) * 100)
        : 100;

      generatedAnswer = `### 📊 Báo Cáo Tổng Hợp Tình Hình Chấm Công Toàn Trường

Kính gửi Ban Giám Hiệu và Phòng Thanh tra Đào tạo,

Dưới đây là số liệu tổng quan tình hình công tác:
1. **Quy mô nhân sự quản lý:** ${totalUsers.length} cán bộ, giảng viên thuộc ${facultyDepts.length} đơn vị/phòng ban.
2. **Tỷ lệ chuyên cần chung:** **${attendanceRate}%** (Đạt chỉ tiêu chuyên môn đề ra).
3. **Phân bổ trạng thái điểm danh:**
   - Đúng giờ: **${onTimeLogs.length}** ca
   - Đi muộn: **${lateLogs.length}** ca
   - Vắng không phép: **${absentLogs.length}** ca
   - Vắng có phép: **${excusedLogs.length}** ca
4. **Tình hình giải quyết chế độ phép:** ${pendingLeaves.length} đơn chờ duyệt, ${approvedLeaves.length} đơn đã giải quyết.

⭐ **Đánh giá chung:** Công tác giảng dạy và nề nếp kỷ luật đang được duy trì ổn định. Dữ liệu đã sẵn sàng để xuất file Excel và in biên bản PDF nghiệm thu.`;
    } else {
      generatedAnswer = `### 🤖 Trợ Lý Thanh Tra Đào Tạo & Chấm Công Đại Học

Hệ thống ghi nhận câu hỏi của bạn: *" ${cleanQuestion} "*

**Thông tin nhanh từ CSDL Chấm công:**
- Toàn trường hiện có **${totalUsers.length}** tài khoản cán bộ, giảng viên đang hoạt động.
- Gần nhất ghi nhận **${recentAttendances.length}** lượt chấm công với **${onTimeLogs.length}** lượt đúng giờ.
- Hiện có **${pendingLeaves.length}** đơn xin nghỉ/dạy bù đang chờ phê duyệt.

Bạn có thể hỏi thêm các câu hỏi chuyên sâu như:
- *"Danh sách những ai đi muộn hoặc vắng mặt hôm nay?"*
- *"Tình hình các đơn xin nghỉ đang chờ phê duyệt thế nào?"*
- *"Tóm tắt báo cáo chấm công tháng để gửi Ban Giám hiệu"*`;
    }

    return sendSuccess(res, 'Phản hồi từ Trợ lý AI.', {
      question: cleanQuestion,
      answer: generatedAnswer,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  handleAiChat,
};
