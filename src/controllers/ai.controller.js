const Department = require('../models/department.model');
const { parseIntent, INTENTS } = require('../services/aiIntentParser');
const {
  getAttendanceSummary,
  getTopLateUsers,
  getLeaveRequestSummary,
  countTeachingSessions,
  countTeachersWithScheduleOnDate,
} = require('../services/aiAnalytics.service');
const { generateAiResponse } = require('../services/aiResponse.service');
const { sendSuccess, sendError } = require('../utils/responseHandler');

/**
 * Controller xử lý hội thoại với AI Assistant
 * Tích hợp toàn diện: Intent Parser -> Analytics Engine (MongoDB) -> Security/RBAC -> LLM / Fallback Response
 * @route POST /api/ai/chat
 */
const handleAiChat = async (req, res, next) => {
  try {
    const rawInput = req.body?.message || req.body?.question;

    if (!rawInput || typeof rawInput !== 'string' || !rawInput.trim()) {
      return sendError(res, 'Vui lòng cung cấp câu hỏi cho Trợ lý AI.', null, 400);
    }

    const question = rawInput.trim();
    const currentUser = req.user; // Trích xuất từ JWT token, bảo mật tuyệt đối

    // 1. Phân tích ý định câu hỏi & bóc tách tham số (Intent, DateRange, User, Department)
    const parsed = await parseIntent(question, currentUser);
    const { intent, dateRange, targetUser, department, leaveType, status, isAmbiguousUser, matches } = parsed;

    // 2. Xử lý trường hợp trùng tên nhiều người (Disambiguation)
    if (isAmbiguousUser) {
      const answer = await generateAiResponse({
        intent,
        question,
        dateRange,
        isAmbiguous: true,
        ambiguousMatches: matches,
      });

      return sendSuccess(res, 'Yêu cầu làm rõ danh tính người dùng.', {
        question,
        answer,
        intent,
        dateRange,
        isAmbiguous: true,
        matches,
        timestamp: new Date().toISOString(),
      });
    }

    let statistics = null;
    let unauthorizedReason = null;

    const fromDate = dateRange?.fromDate;
    const toDate = dateRange?.toDate;
    const userId = targetUser?._id;
    let departmentId = department?._id;
    let effectiveDepartment = department;

    // Đối với Trưởng khoa: Nếu không chỉ định khoa khác thì tự động gán theo khoa trực thuộc quản lý của mình
    if (!departmentId && currentUser?.role === 'truongkhoa' && currentUser?.departmentId) {
      departmentId = currentUser.departmentId;
    }

    if (!effectiveDepartment && departmentId) {
      effectiveDepartment = await Department.findById(departmentId);
    }

    // 3. Điều hướng tới Analytics Engine dựa trên Intent
    switch (intent) {
      // ----------------------------------------------------------------------
      // NHÓM CHẤM CÔNG CÁ NHÂN & TỔNG HỢP
      // ----------------------------------------------------------------------
      case INTENTS.ATTENDANCE_USER_LATE:
      case INTENTS.ATTENDANCE_USER_ON_TIME:
      case INTENTS.ATTENDANCE_USER_ABSENT:
      case INTENTS.ATTENDANCE_USER_TOTAL:
      case INTENTS.ATTENDANCE_USER_SUMMARY:
      case INTENTS.ATTENDANCE_PRESENT_COUNT:
      case INTENTS.ATTENDANCE_LATE_COUNT:
      case INTENTS.ATTENDANCE_ABSENT_COUNT:
      case INTENTS.ATTENDANCE_DEPT_SUMMARY: {
        const result = await getAttendanceSummary({
          userId,
          departmentId,
          fromDate,
          toDate,
          currentUser,
        });

        if (result.unauthorized) {
          unauthorizedReason = result.reason;
        } else {
          statistics = result;
        }
        break;
      }

      // ----------------------------------------------------------------------
      // NHÓM AI ĐI TRỄ NHIỀU NHẤT
      // ----------------------------------------------------------------------
      case INTENTS.ATTENDANCE_TOP_LATE: {
        const result = await getTopLateUsers({
          departmentId,
          fromDate,
          toDate,
          limit: 5,
          currentUser,
        });

        if (result.unauthorized) {
          unauthorizedReason = result.reason;
        } else {
          statistics = result;
        }
        break;
      }

      // ----------------------------------------------------------------------
      // NHÓM ĐƠN NGHỈ PHÉP / DẠY BÙ / ĐỔI CA
      // ----------------------------------------------------------------------
      case INTENTS.LEAVE_REQUEST_COUNT:
      case INTENTS.LEAVE_REQUEST_USER_DAYS: {
        const result = await getLeaveRequestSummary({
          status,
          userId,
          departmentId,
          fromDate,
          toDate,
          currentUser,
        });

        if (result.unauthorized) {
          unauthorizedReason = result.reason;
        } else {
          statistics = result;
        }
        break;
      }

      case INTENTS.LEAVE_REQUEST_TYPE_COUNT: {
        const result = await getLeaveRequestSummary({
          type: leaveType,
          status,
          departmentId,
          fromDate,
          toDate,
          currentUser,
        });

        if (result.unauthorized) {
          unauthorizedReason = result.reason;
        } else {
          statistics = {
            ...result,
            leaveType,
          };
        }
        break;
      }

      // ----------------------------------------------------------------------
      // NHÓM LỊCH GIẢNG DẠY
      // ----------------------------------------------------------------------
      case INTENTS.SCHEDULE_USER_COUNT:
      case INTENTS.SCHEDULE_USER_CHECK:
      case INTENTS.SCHEDULE_USER_DETAILS: {
        const result = await countTeachingSessions({
          userId,
          departmentId,
          fromDate,
          toDate,
          currentUser,
        });

        if (result.unauthorized) {
          unauthorizedReason = result.reason;
        } else {
          statistics = result;
        }
        break;
      }

      case INTENTS.SCHEDULE_DEPT_TEACHERS_TODAY: {
        const result = await countTeachersWithScheduleOnDate({
          departmentId,
          date: fromDate || new Date(),
          currentUser,
        });

        if (result.unauthorized) {
          unauthorizedReason = result.reason;
        } else {
          statistics = result;
        }
        break;
      }

      // ----------------------------------------------------------------------
      // BÁO CÁO TỔNG QUAN
      // ----------------------------------------------------------------------
      case INTENTS.GENERAL_REPORT:
      default: {
        // Thu thập tổng quan trong quyền hạn của người dùng
        const attSummary = await getAttendanceSummary({
          departmentId,
          fromDate,
          toDate,
          currentUser,
        });

        if (!attSummary.unauthorized) {
          const leaveSummary = await getLeaveRequestSummary({
            departmentId,
            fromDate,
            toDate,
            currentUser,
          });

          statistics = {
            attendance: attSummary,
            leaves: leaveSummary.unauthorized ? null : leaveSummary,
          };
        } else {
          unauthorizedReason = attSummary.reason;
        }
        break;
      }
    }

    // 4. Tạo câu trả lời tự nhiên bằng tiếng Việt (Qua Gemini hoặc Fallback Engine)
    const answer = await generateAiResponse({
      intent,
      question,
      dateRange,
      targetUser,
      department: effectiveDepartment,
      statistics,
      unauthorizedReason,
    });

    return sendSuccess(res, 'Phản hồi từ Trợ lý AI thành công.', {
      question,
      answer,
      intent,
      dateRange: {
        from: dateRange?.fromDate,
        to: dateRange?.toDate,
        label: dateRange?.label,
      },
      targetUser: targetUser
        ? {
            id: targetUser._id,
            fullName: targetUser.fullName,
            email: targetUser.email,
            role: targetUser.role,
          }
        : null,
      department: department
        ? {
            id: department._id,
            name: department.name,
          }
        : null,
      statistics: statistics || null,
      unauthorized: Boolean(unauthorizedReason),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  handleAiChat,
};
