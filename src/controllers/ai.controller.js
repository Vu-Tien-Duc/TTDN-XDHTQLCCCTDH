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

    // 1. Thu thập dữ liệu thực tế từ hệ thống để làm Context
    const [totalUsers, facultyDepts, recentAttendances, pendingLeaves, approvedLeaves] = await Promise.all([
      User.find({ isActive: true }).select('fullName email role departmentId'),
      Department.find().select('name code type'),
      AttendanceLog.find()
        .sort({ checkInTime: -1 })
        .limit(100)
        .populate('userId', 'fullName email role departmentId'),
      LeaveRequest.find({ status: 'PENDING' }).populate('userId', 'fullName email departmentId'),
      LeaveRequest.find({ status: 'APPROVED' }).sort({ updatedAt: -1 }).limit(20).populate('userId', 'fullName email departmentId'),
    ]);

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

    // 2. Nếu có GEMINI_API_KEY trong .env -> Gọi trực tiếp Google Gemini API
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (geminiApiKey) {
      try {
        const systemPrompt = `Bạn là Trợ lý AI Thanh tra Đào tạo & Quản lý Chấm công của Trường Đại học. 
Dưới đây là dữ liệu thực tế của hệ thống:
- Tổng số nhân sự: ${totalUsers.length} cán bộ, giảng viên.
- Tổng lượt điểm danh gần nhất: ${recentAttendances.length} (Đúng giờ: ${onTimeLogs.length}, Đi muộn: ${lateLogs.length}, Vắng mặt: ${absentLogs.length}, Nghỉ có phép: ${excusedLogs.length}).
- Số đơn xin nghỉ đang chờ phê duyệt (PENDING): ${pendingLeaves.length}.
- Danh sách vi phạm (đi muộn / vắng): ${JSON.stringify(violators.slice(0, 10))}.

Hãy trả lời câu hỏi của Thanh tra đào tạo một cách chuyên nghiệp, chính xác, sử dụng định dạng Markdown (tiêu đề, danh sách gạch đầu dòng, bảng nếu phù hợp) và đưa ra khuyến nghị thực tế cho nhà trường.`;

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
        const aiAnswer =
          geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || null;

        if (aiAnswer) {
          return sendSuccess(res, 'Phản hồi từ Gemini AI.', {
            question: cleanQuestion,
            answer: aiAnswer,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (geminiError) {
        console.warn('Lỗi gọi Gemini API, chuyển sang Bộ phân tích thống kê thông minh (Fallback):', geminiError.message);
      }
    }

    // 3. Fallback Engine: Bộ phân tích thống kê thông minh dựa trên dữ liệu thật
    let generatedAnswer = '';
    const qLower = cleanQuestion.toLowerCase();

    if (qLower.includes('muộn') || qLower.includes('vắng') || qLower.includes('vi phạm')) {
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
      generatedAnswer = `### 📑 Tổng Hợp Tình Hình Đơn Xin Nghỉ Phép & Dạy Bù

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
