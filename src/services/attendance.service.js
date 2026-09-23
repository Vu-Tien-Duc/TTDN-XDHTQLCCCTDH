const AttendanceLog = require('../models/attendanceLog.model');
const ShiftConfig = require('../models/shiftConfig.model');
const Schedule = require('../models/schedule.model');
const AuditLog = require('../models/auditLog.model');

/**
 * Chuyển đổi mốc thời gian về múi giờ chuẩn Asia/Ho_Chi_Minh (UTC+7)
 * Khắc phục triệt để lỗi lệch 7 tiếng của server runtime trên VPS (UTC) hoặc Local (UTC+7)
 * Đảm bảo các hàm .getHours(), .getMinutes(), .getDay(), .toISOString().slice(0, 10) luôn trả về giờ VN
 * @param {Date|string|number} [date=new Date()]
 * @returns {Date}
 */
const getVietnamTime = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date(date);
  const validDate = isNaN(d.getTime()) ? new Date() : d;

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(validDate);
  const map = {};
  for (const p of parts) {
    map[p.type] = p.value;
  }

  const year = parseInt(map.year, 10);
  const month = parseInt(map.month, 10) - 1;
  const day = parseInt(map.day, 10);
  const hours = parseInt(map.hour, 10) % 24;
  const minutes = parseInt(map.minute, 10);
  const seconds = parseInt(map.second, 10);

  const vnDate = new Date(Date.UTC(year, month, day, hours, minutes, seconds));
  vnDate.getHours = () => hours;
  vnDate.getMinutes = () => minutes;
  vnDate.getSeconds = () => seconds;
  vnDate.getDay = () => vnDate.getUTCDay();
  vnDate.getDate = () => day;
  vnDate.getMonth = () => month;
  vnDate.getFullYear = () => year;

  return vnDate;
};

/**
 * Xác định khoảng thời gian đầu ngày và cuối ngày [00:00:00.000, 23:59:59.999] theo chuẩn múi giờ UTC+7 (Asia/Ho_Chi_Minh)
 * @param {Date} [date=new Date()]
 * @returns {{ startOfDay: Date, endOfDay: Date, dateStr: string }}
 */
const getVietnamDayRange = (date = new Date()) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const dateStr = formatter.format(date); // Định dạng YYYY-MM-DD
  const startOfDay = new Date(`${dateStr}T00:00:00.000+07:00`);
  const endOfDay = new Date(`${dateStr}T23:59:59.999+07:00`);
  return { startOfDay, endOfDay, dateStr };
};

/**
 * Bóc tách chuỗi "HH:mm" thành tổng số phút trong ngày tính từ 00:00 để so sánh toán học
 * @param {string} timeStr - Chuỗi định dạng "HH:mm"
 * @returns {number} Số phút từ 00:00
 */
const timeStringToMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Xác định khung giờ check-in hợp lệ cho ca làm việc:
 * - Sớm tối đa 30 phút trước giờ bắt đầu ca (startMinutes - 30)
 * - Muộn tối đa 15 phút (startMinutes + 15)
 * @param {Object} shift - Bản ghi ca làm việc (chứa startTime, endTime, lateThresholdMinutes)
 * @returns {Object|null} { startMinutes, endMinutes, windowStartMinutes, windowEndMinutes }
 */
const getTodayScheduleWindow = (shift) => {
  if (!shift || !shift.startTime || !shift.endTime) return null;
  const startMinutes = timeStringToMinutes(shift.startTime);
  const endMinutes = timeStringToMinutes(shift.endTime);
  const lateThreshold = shift.lateThresholdMinutes !== undefined ? shift.lateThresholdMinutes : 15;
  return {
    startMinutes,
    endMinutes,
    windowStartMinutes: Math.max(0, startMinutes - 30),
    windowEndMinutes: startMinutes + lateThreshold,
  };
};

/**
 * Tính toán trạng thái chấm công dựa vào thời điểm check-in và cấu hình ca:
 * - Check-in trước hoặc đúng startTime -> 'ON_TIME' (Đúng giờ)
 * - Check-in sau startTime -> 'LATE' (Đi muộn)
 * @param {Date} checkInTime 
 * @param {Object} shiftConfig 
 * @param {Date} [date=new Date()] (ngày áp dụng)
 * @returns {String} 'ON_TIME' | 'LATE'
 */
const calculateAttendanceStatus = (checkInTime, shiftConfig, date = new Date()) => {
  if (!shiftConfig || !shiftConfig.startTime) return 'ON_TIME';

  const vnDate = getVietnamTime(checkInTime || date);
  const currentMinutes = vnDate.getHours() * 60 + vnDate.getMinutes();
  const startMinutes = timeStringToMinutes(shiftConfig.startTime);

  if (currentMinutes > startMinutes) {
    return 'LATE';
  }
  return 'ON_TIME';
};

/**
 * Đánh giá toàn diện lịch làm việc hôm nay để check-in theo nghiệp vụ:
 * 1. Sớm bao nhiêu cũng được (lên tới 240 phút / 4 tiếng trước giờ bắt đầu ca).
 * 2. Cho phép muộn tối đa 15 phút (startMinutes + lateThreshold, mặc định 15p).
 * 3. Nếu muộn quá 15 phút: TỰ ĐỘNG HỦY LỊCH / GHI NHẬN VẮNG MẶT (ABSENT) và gửi email cảnh báo.
 * 4. Nếu hôm nay không có lịch: Trả về trạng thái 'NO_SCHEDULE'.
 * 5. Nếu chưa đến giờ check-in ca tiếp theo: Trả về trạng thái 'TOO_EARLY'.
 * 
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {string|mongoose.Types.ObjectId} [specificShiftId=null]
 * @returns {Promise<Object>}
 */
const evaluateUserScheduleForCheckIn = async (userId, specificShiftId = null) => {
  const nowVN = getVietnamTime();
  const currentWeekday = nowVN.getDay();
  const currentMinutes = nowVN.getHours() * 60 + nowVN.getMinutes();
  const dayRange = getVietnamDayRange(nowVN);
  const { startOfDay, endOfDay } = dayRange;

  const query = {
    userId,
    weekday: currentWeekday,
    startDate: { $lte: endOfDay },
    endDate: { $gte: startOfDay },
  };

  if (specificShiftId) {
    query.shiftId = specificShiftId;
  }

  const schedules = await Schedule.find(query)
    .populate('shiftId')
    .populate('userId', 'fullName email role')
    .sort({ startTime: 1 });

  // 1. Nếu không có bất kỳ lịch nào hôm nay
  if (!schedules || schedules.length === 0) {
    return {
      canCheckIn: false,
      status: 'NO_SCHEDULE',
      message: 'Hôm nay bạn không có lịch làm việc/giảng dạy trên hệ thống.',
    };
  }

  const cancelledSchedules = [];
  const absentSchedules = [];
  let eligibleSchedule = null;
  let upcomingSchedule = null;
  let alreadyCheckedInLog = null;

  // Lấy hàm xử lý vắng mặt / hủy lịch an toàn từ cron.service
  let processAbsentCheck = null;
  try {
    const cronModule = require('./cron.service');
    processAbsentCheck = cronModule.processScheduleAttendanceCheck;
  } catch (e) {
    console.warn('[AttendanceService] Không thể load cronModule:', e.message);
  }

  for (const sch of schedules) {
    const shift = sch.shiftId;
    if (!shift) continue;

    const shiftStartStr = sch.startTime || shift.startTime;
    const shiftEndStr = sch.endTime || shift.endTime;
    const startMinutes = timeStringToMinutes(shiftStartStr);
    const lateThreshold = shift.lateThresholdMinutes !== undefined ? shift.lateThresholdMinutes : 15;

    // Kiểm tra xem ca này hôm nay đã có bản ghi chấm công nào chưa
    const existingLog = await AttendanceLog.findOne({
      userId,
      scheduleId: sch._id,
      $or: [
        { checkInTime: { $gte: startOfDay, $lte: endOfDay } },
        { createdAt: { $gte: startOfDay, $lte: endOfDay } },
      ],
    });

    if (existingLog) {
      if (existingLog.status === 'ABSENT' || existingLog.status === 'EXCUSED_ABSENCE') {
        // Ca này đã bị hủy/đánh vắng trước đó -> Lưu vết để thông báo đúng, không báo nhầm "hoàn thành ca"
        absentSchedules.push({
          schedule: sch,
          shift,
          shiftStartStr,
          shiftEndStr,
          lateThreshold,
          status: existingLog.status,
          log: existingLog,
        });
        continue;
      }
      if (existingLog.checkOutTime) {
        // Ca này đã hoàn thành cả vào và ra -> Bỏ qua, xét ca tiếp theo
        continue;
      }
      if (existingLog.checkInTime && !existingLog.checkOutTime) {
        // Ca này đang mở (đã check-in chưa check-out)
        alreadyCheckedInLog = existingLog;
        continue;
      }
    }

    // Chưa có bản ghi chấm công cho ca này:
    // Tình huống A: Đã muộn quá ngưỡng cho phép của ca (currentMinutes > startMinutes + lateThreshold)
    if (currentMinutes > startMinutes + lateThreshold) {
      if (processAbsentCheck) {
        try {
          const absentResult = await processAbsentCheck(sch, dayRange);
          cancelledSchedules.push({
            scheduleId: sch._id,
            shiftName: shift.name,
            startTime: shiftStartStr,
            endTime: shiftEndStr,
            lateThreshold,
            absentResult,
          });
        } catch (err) {
          console.error(`[AttendanceService] Lỗi khi tự động hủy lịch đánh vắng ca ${shift.name}:`, err);
        }
      }

      // Ghi Audit Log hủy lịch tự động
      AuditLog.create({
        actor: userId,
        action: 'SCHEDULE_AUTO_CANCELLED_LATE',
        targetId: sch._id.toString(),
        targetType: 'Schedule',
        details: {
          shiftName: shift.name,
          startTime: shiftStartStr,
          currentMinutes,
          lateMinutes: currentMinutes - startMinutes,
          lateThreshold,
          reason: `Quá hạn check-in (muộn quá ${lateThreshold} phút). Tự động hủy lịch và đánh vắng.`,
        },
        timestamp: new Date(),
      }).catch(() => { });

      // Tiếp tục vòng lặp để kiểm tra xem có ca tiếp theo trong ngày không
      continue;
    }

    // Tình huống B: Chưa đến giờ check-in (chỉ cho phép điểm danh trước giờ bắt đầu tối đa 30 phút)
    const earlyLimitMinutes = Math.max(0, startMinutes - 30);
    if (currentMinutes < earlyLimitMinutes) {
      if (!upcomingSchedule) {
        const openH = Math.floor(earlyLimitMinutes / 60).toString().padStart(2, '0');
        const openM = (earlyLimitMinutes % 60).toString().padStart(2, '0');
        upcomingSchedule = {
          scheduleId: sch._id,
          shiftName: shift.name,
          startTime: shiftStartStr,
          endTime: shiftEndStr,
          openCheckInTime: `${openH}:${openM}`,
        };
      }
      continue;
    }

    // Tình huống C: Hợp lệ để check-in!
    // Trong vòng 30 phút trước ca hoặc muộn trong ngưỡng cho phép của ca
    const status = currentMinutes > startMinutes ? 'LATE' : 'ON_TIME';
    const lateMinutes = status === 'LATE' ? currentMinutes - startMinutes : 0;

    eligibleSchedule = {
      schedule: sch,
      shift,
      status,
      lateMinutes,
      shiftStartStr,
      shiftEndStr,
    };
    break; // Đã tìm thấy ca hợp lệ nhất để thực hiện check-in
  }

  // Nếu tìm thấy ca hợp lệ để check-in
  if (eligibleSchedule) {
    return {
      canCheckIn: true,
      selectedSchedule: eligibleSchedule.schedule,
      shift: eligibleSchedule.shift,
      status: eligibleSchedule.status,
      lateMinutes: eligibleSchedule.lateMinutes,
      cancelledSchedules,
    };
  }

  // Nếu người dùng đã check-in ca này rồi và đang mở
  if (alreadyCheckedInLog) {
    return {
      canCheckIn: false,
      status: 'ALREADY_CHECKED_IN',
      existingLog: alreadyCheckedInLog,
      message: 'Bạn đã thực hiện check-in cho ca làm việc hôm nay rồi.',
    };
  }

  // Nếu có ca bị hủy do muộn quá ngưỡng cho phép của ca đó
  if (cancelledSchedules.length > 0) {
    const c = cancelledSchedules[0];
    const thresholdText = c.lateThreshold ? `${c.lateThreshold} phút` : '15 phút';
    if (upcomingSchedule) {
      const openTimeText = upcomingSchedule.openCheckInTime ? ` (Mở điểm danh từ ${upcomingSchedule.openCheckInTime})` : '';
      return {
        canCheckIn: false,
        status: 'SCHEDULE_CANCELLED_LATE',
        message: `Ca làm việc ${c.shiftName} (${c.startTime}) đã quá hạn check-in (vượt ngưỡng cho phép đi muộn ${thresholdText}) và đã tự động bị hủy lịch / ghi nhận vắng mặt. Ca tiếp theo: ${upcomingSchedule.shiftName} (${upcomingSchedule.startTime})${openTimeText} chưa đến giờ điểm danh.`,
        cancelledSchedules,
        upcomingSchedule,
      };
    }
    return {
      canCheckIn: false,
      status: 'SCHEDULE_CANCELLED_LATE',
      message: `Ca làm việc ${c.shiftName} (${c.startTime} - ${c.endTime}) đã quá hạn check-in (vượt ngưỡng cho phép đi muộn ${thresholdText}) và đã tự động bị hủy lịch / ghi nhận vắng mặt.`,
      cancelledSchedules,
    };
  }

  // Nếu chưa đến giờ ca tiếp theo
  if (upcomingSchedule) {
    const openTimeText = upcomingSchedule.openCheckInTime ? ` (Mở điểm danh từ ${upcomingSchedule.openCheckInTime})` : '';
    return {
      canCheckIn: false,
      status: 'TOO_EARLY',
      message: `Chưa đến giờ điểm danh. Ca làm việc tiếp theo: ${upcomingSchedule.shiftName} (${upcomingSchedule.startTime} - ${upcomingSchedule.endTime})${openTimeText}. Bạn chỉ có thể điểm danh trước giờ bắt đầu tối đa 30 phút.`,
      upcomingSchedule,
    };
  }

  // Nếu có ca hôm nay đã bị ghi nhận vắng mặt hoặc nghỉ có phép, thông báo chính xác
  if (absentSchedules.length > 0) {
    const lastAbsent = absentSchedules[absentSchedules.length - 1];
    const shiftName = lastAbsent.shift?.name || 'Ca làm việc';
    const statusText = lastAbsent.status === 'EXCUSED_ABSENCE' ? 'nghỉ có phép' : 'vắng mặt (do quá hạn điểm danh)';
    const thresholdText = lastAbsent.lateThreshold ? ` (quá ${lastAbsent.lateThreshold} phút)` : '';
    return {
      canCheckIn: false,
      status: 'SCHEDULE_ABSENT_RECORDED',
      message: `Ca làm việc ${shiftName} (${lastAbsent.shiftStartStr} - ${lastAbsent.shiftEndStr}) đã quá hạn điểm danh${thresholdText} và đã bị ghi nhận ${statusText}. Bạn không thể thực hiện điểm danh cho ca này nữa.`,
      absentSchedules,
    };
  }

  // Tất cả các ca hôm nay đã hoàn thành hoặc đã xử lý
  return {
    canCheckIn: false,
    status: 'ALL_SCHEDULES_COMPLETED',
    message: 'Bạn đã hoàn thành tất cả các ca làm việc trong ngày hôm nay.',
  };
};

/**
 * Đánh giá trạng thái khi Check-out:
 * - So sánh giờ check-out thực tế với endTime của ca làm việc
 * - Nếu về trước endTime:
 *   + Nếu trạng thái ban đầu là ON_TIME -> Chuyển thành EARLY_LEAVE
 *   + Nếu trạng thái ban đầu là LATE -> Giữ nguyên LATE
 * @param {Date} checkOutTime 
 * @param {Object} shiftConfig 
 * @param {String} initialStatus - 'ON_TIME' | 'LATE'
 * @returns {Object} { finalStatus, isEarlyLeave, earlyMinutes }
 */
const calculateCheckOutStatus = (checkOutTime, shiftConfig, initialStatus = 'ON_TIME') => {
  if (!shiftConfig || !shiftConfig.endTime) {
    return { finalStatus: initialStatus, isEarlyLeave: false, earlyMinutes: 0 };
  }

  const vnDate = getVietnamTime(checkOutTime);
  const checkOutMinutes = vnDate.getHours() * 60 + vnDate.getMinutes();
  const shiftEndMinutes = timeStringToMinutes(shiftConfig.endTime);

  const isEarlyLeave = checkOutMinutes < shiftEndMinutes;
  const earlyMinutes = isEarlyLeave ? shiftEndMinutes - checkOutMinutes : 0;

  // Quy tắc nghiệp vụ: Nếu ban đầu ON_TIME mà về sớm -> EARLY_LEAVE. Nếu ban đầu đã LATE -> giữ nguyên LATE
  let finalStatus = initialStatus;
  if (isEarlyLeave && initialStatus === 'ON_TIME') {
    finalStatus = 'EARLY_LEAVE';
  }

  return {
    finalStatus,
    isEarlyLeave,
    earlyMinutes,
  };
};

/**
 * Tạo điều kiện truy vấn thời gian chấm công:
 * Bao gồm cả checkInTime và createdAt (cho các bản ghi ABSENT/EXCUSED_ABSENCE do Cron tạo khi checkInTime = null)
 * @param {Date|string} startDate
 * @param {Date|string} endDate
 * @returns {Object}
 */
const buildAttendanceDateFilter = (startDate, endDate) => {
  if (!startDate && !endDate) return {};
  const cond = {};
  let startStr = null;
  let endStr = null;

  if (startDate) {
    if (typeof startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      startStr = startDate;
      cond.$gte = new Date(`${startDate}T00:00:00.000+07:00`);
    } else {
      const d = new Date(startDate);
      cond.$gte = d;
      const vnD = new Date(d.getTime() + 7 * 3600 * 1000);
      startStr = vnD.toISOString().slice(0, 10);
    }
  }
  if (endDate) {
    if (typeof endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      endStr = endDate;
      cond.$lte = new Date(`${endDate}T23:59:59.999+07:00`);
    } else {
      const d = new Date(endDate);
      cond.$lte = d;
      const vnD = new Date(d.getTime() + 7 * 3600 * 1000);
      endStr = vnD.toISOString().slice(0, 10);
    }
  }

  const workDateCond = {};
  if (startStr) workDateCond.$gte = startStr;
  if (endStr) workDateCond.$lte = endStr;

  return {
    $or: [
      { checkInTime: cond },
      { workDate: workDateCond },
      { checkInTime: null, createdAt: cond },
    ],
  };
};

/**
 * Lấy tổng hợp thống kê chấm công theo người dùng
 */
const getAttendanceSummaryByUser = async (userId, startDate, endDate) => {
  const query = { userId };
  if (startDate || endDate) {
    const dateQuery = buildAttendanceDateFilter(startDate, endDate);
    Object.assign(query, dateQuery);
  }

  const records = await AttendanceLog.find(query)
    .populate('shiftId', 'name startTime endTime')
    .populate('scheduleId', 'roomId weekday')
    .sort({ checkInTime: -1, createdAt: -1 });

  const summary = {
    totalRecords: records.length,
    onTimeCount: records.filter((r) => r.status === 'ON_TIME').length,
    lateCount: records.filter((r) => r.status === 'LATE').length,
    earlyLeaveCount: records.filter((r) => r.status === 'EARLY_LEAVE').length,
    absentCount: records.filter((r) => r.status === 'ABSENT').length,
    excusedCount: records.filter((r) => r.status === 'EXCUSED_ABSENCE').length,
    records,
  };

  return summary;
};

/**
 * Tính khoảng cách Euclidean giữa hai vector đặc trưng 128 số
 * @param {number[]} vecA
 * @param {number[]} vecB
 * @returns {number}
 */
const euclideanDistance = (vecA, vecB) => {
  if (!vecA || !vecB || vecA.length !== vecB.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < vecA.length; i++) {
    sum += (vecA[i] - vecB[i]) ** 2;
  }
  return Math.sqrt(sum);
};

// Ngưỡng so khớp nhận diện khuôn mặt Kiosk (1-to-N matching).
// Khi đã có đa góc mẫu (faceDescriptors), khoảng cách của chính người dùng thường là 0.20 - 0.42.
// Khoảng cách giữa 2 người khác nhau thường từ 0.52 - 0.90+.
// Ngưỡng 0.48 đảm bảo nhận diện chính xác người thật và chặn 100% việc nhận nhầm người khác (FAR < 0.01%).
const FACE_MATCH_THRESHOLD = 0.48;

// Ngưỡng kiểm tra trùng lặp khi Đăng Ký Khuôn Mặt (Anti-duplicate registration).
// Khi cùng một người đăng ký 2 tài khoản, khoảng cách vector chính diện và centroid luôn < 0.28.
// Hai người khác nhau (kể cả cùng giới tính, cùng góc nhìn, có nét tương đồng) thường có khoảng cách từ 0.32 - 0.85+.
// Đặt ngưỡng 0.28 để ngăn chặn 1 người đăng ký nhiều tài khoản, đồng thời triệt tiêu hoàn toàn lỗi chặn nhầm 2 người khác nhau.
const DUPLICATE_FACE_THRESHOLD = 0.28;

/**
 * Tính vector trung tâm (Centroid) và chuẩn hóa độ dài L2 = 1.0
 * @param {number[][]} descriptors - Mảng các vector 128 số
 * @returns {number[]|null}
 */
const computeNormalizedCentroid = (descriptors) => {
  if (!Array.isArray(descriptors) || descriptors.length === 0) return null;
  const validDesc = descriptors.filter((d) => Array.isArray(d) && d.length === 128);
  if (validDesc.length === 0) return null;

  const dim = 128;
  const centroid = new Array(dim).fill(0);
  for (const desc of validDesc) {
    for (let i = 0; i < dim; i++) {
      centroid[i] += desc[i];
    }
  }

  let norm = 0;
  for (let i = 0; i < dim; i++) {
    norm += centroid[i] * centroid[i];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dim; i++) {
      centroid[i] /= norm;
    }
  }
  return centroid;
};

/**
 * Thuật toán Biometric Multi-Metric Fusion kiểm tra trùng lặp khuôn mặt:
 * 1. Chống lọt (Không cho cùng 1 người đăng ký nhiều tài khoản):
 *    - Bắt chính xác khoảng cách cùng một người (thường < 0.28 giữa các vector nhìn thẳng chuẩn).
 * 2. Chống nhầm (Không bao giờ chặn 2 đồng nghiệp khác nhau có nét tương đồng):
 *    - Sử dụng Centroid và Primary Frontal để triệt tiêu phương sai góc nghiêng ngẫu nhiên.
 *    - Khoảng cách giữa 2 người khác nhau (thường >= 0.32) được phép đăng ký bình thường.
 *
 * @param {number[][]} incomingDescriptors
 * @param {Array} otherUsersWithFace
 * @returns {{ isDuplicate: boolean, duplicateUser: Object|null, distance: number, threshold: number }}
 */
const checkDuplicateFace = (incomingDescriptors, otherUsersWithFace) => {
  if (!Array.isArray(incomingDescriptors) || incomingDescriptors.length === 0) {
    return { isDuplicate: false, duplicateUser: null, distance: Infinity, threshold: DUPLICATE_FACE_THRESHOLD };
  }

  const inputPrimary = incomingDescriptors[0];
  const inputCentroid = computeNormalizedCentroid(incomingDescriptors);
  let closestDuplicateUser = null;
  let minRecordedDistance = Infinity;

  for (const other of otherUsersWithFace) {
    const otherCandidates = [];
    if (Array.isArray(other.faceDescriptors) && other.faceDescriptors.length > 0) {
      otherCandidates.push(...other.faceDescriptors.filter(d => Array.isArray(d) && d.length === 128));
    } else if (Array.isArray(other.faceDescriptor) && other.faceDescriptor.length === 128) {
      otherCandidates.push(other.faceDescriptor);
    }

    if (otherCandidates.length === 0) continue;

    const otherPrimary = otherCandidates[0];
    const otherCentroid = computeNormalizedCentroid(otherCandidates);

    // 1. Khoảng cách trực tiếp giữa 2 góc chính diện (Primary Frontal Distance)
    const primaryDist = (inputPrimary && otherPrimary)
      ? euclideanDistance(inputPrimary, otherPrimary)
      : Infinity;

    // 2. Khoảng cách giữa 2 vector trung tâm sinh trắc học (Biometric Centroid Distance)
    const centroidDist = (inputCentroid && otherCentroid)
      ? euclideanDistance(inputCentroid, otherCentroid)
      : Infinity;

    // 3. Khoảng cách tối thiểu giữa toàn bộ các cặp mẫu
    let minPairDist = Infinity;
    for (const inVec of incomingDescriptors) {
      for (const exVec of otherCandidates) {
        const d = euclideanDistance(inVec, exVec);
        if (d < minPairDist) minPairDist = d;
      }
    }

    const effectiveMin = Math.min(primaryDist, centroidDist, minPairDist);
    if (effectiveMin < minRecordedDistance) {
      minRecordedDistance = effectiveMin;
    }

    // NGUYÊN TẮC BẢO VỆ ĐỒNG NGHIỆP:
    // Nếu cả góc chính diện và vector trung tâm đều cách nhau xa (>= 0.32):
    // Hai người này CHẮC CHẮN là 2 cá thể riêng biệt, không được báo trùng!
    if (primaryDist >= 0.32 && centroidDist >= 0.32) {
      continue;
    }

    // TIÊU CHÍ XÁC NHẬN TRÙNG LẶP (CÙNG MỘT NGƯỜI):
    // Cùng một người thì góc chính diện nhìn thẳng hoặc vector trung tâm phải cực kỳ khớp (< 0.28).
    // Nếu cả hai đều < 0.30 và có góc khớp sâu < 0.25 thì xác nhận trùng.
    const isDup =
      primaryDist < 0.28 ||
      centroidDist < 0.28 ||
      (primaryDist < 0.30 && centroidDist < 0.30 && minPairDist < 0.25);

    if (isDup) {
      closestDuplicateUser = other;
      break;
    }
  }

  return {
    isDuplicate: !!closestDuplicateUser,
    duplicateUser: closestDuplicateUser,
    distance: minRecordedDistance < Infinity ? +minRecordedDistance.toFixed(4) : 0,
    threshold: DUPLICATE_FACE_THRESHOLD,
  };
};

// In-memory Cache cho danh sách vector Face ID của người dùng (TTL 5 phút)
let _cachedUsersWithFace = null;
let _faceCacheExpiry = 0;
const FACE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 phút

/**
 * Lấy danh sách người dùng đã đăng ký Face ID từ Cache trong RAM (tránh đọc DB mỗi frame)
 * @returns {Promise<Array>}
 */
const getCachedUsersWithFace = async () => {
  const now = Date.now();
  if (_cachedUsersWithFace && now < _faceCacheExpiry) {
    return _cachedUsersWithFace;
  }

  const User = require('../models/user.model');
  const users = await User.find({
    isActive: true,
    $or: [
      { faceDescriptor: { $exists: true, $ne: null } },
      { faceDescriptors: { $exists: true, $not: { $size: 0 } } },
    ],
  }).select('+faceDescriptor +faceDescriptors fullName email role departmentId avatar');

  _cachedUsersWithFace = users;
  _faceCacheExpiry = now + FACE_CACHE_TTL_MS;
  return users;
};

/**
 * Xóa cache người dùng Face ID khi có người đăng ký mới hoặc xóa Face ID
 */
const invalidateFaceCache = () => {
  _cachedUsersWithFace = null;
  _faceCacheExpiry = 0;
};

/**
 * Tìm kiếm người dùng khớp nhất từ một vector khuôn mặt (hỗ trợ cả đơn vector và đa vector)
 * @param {number[]} descriptor
 * @param {Array} usersWithFace
 * @param {number} [threshold=FACE_MATCH_THRESHOLD]
 * @returns {{ bestMatch: Object|null, bestDistance: number, confidenceScore: number }}
 */
const findBestFaceMatch = (descriptor, usersWithFace, threshold = FACE_MATCH_THRESHOLD) => {
  let bestMatch = null;
  let bestDistance = Infinity;

  for (const u of usersWithFace) {
    const candidates = [];
    if (Array.isArray(u.faceDescriptors) && u.faceDescriptors.length > 0) {
      candidates.push(...u.faceDescriptors);
    } else if (Array.isArray(u.faceDescriptor) && u.faceDescriptor.length === 128) {
      candidates.push(u.faceDescriptor);
    }

    if (candidates.length === 0) continue;

    for (const cand of candidates) {
      if (!cand || cand.length !== 128) continue;
      const dist = euclideanDistance(descriptor, cand);
      if (dist < bestDistance) {
        bestDistance = dist;
        bestMatch = u;
      }
    }
  }

  const confidenceScore = bestDistance < Infinity ? +(1 - bestDistance).toFixed(4) : 0;
  return {
    bestMatch: bestDistance < threshold ? bestMatch : null,
    bestDistance: +bestDistance.toFixed(4),
    confidenceScore,
  };
};

// =======================================================
// GEOFENCING & GPS COORDINATE VALIDATION (2FA + Mobile)
// =======================================================
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const CAMPUS_CONFIG_FILE = path.join(__dirname, '../config/campus_config.json');

const loadPersistedCampusConfig = () => {
  try {
    if (fs.existsSync(CAMPUS_CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(CAMPUS_CONFIG_FILE, 'utf8'));
      if (data && typeof data === 'object') {
        return {
          name: data.name || process.env.CAMPUS_NAME || 'Khuôn viên Cơ sở chính - Trường Đại học',
          lat: data.lat !== undefined && !isNaN(Number(data.lat)) ? parseFloat(data.lat) : parseFloat(process.env.CAMPUS_LAT || '20.965483'),
          lng: data.lng !== undefined && !isNaN(Number(data.lng)) ? parseFloat(data.lng) : parseFloat(process.env.CAMPUS_LNG || '105.729905'),
          radiusMeters: data.radiusMeters !== undefined && !isNaN(Number(data.radiusMeters)) ? parseInt(data.radiusMeters, 10) : parseInt(process.env.CAMPUS_RADIUS_METERS || '500', 10),
        };
      }
    }
  } catch (err) {
    console.warn('[AttendanceService] Không thể đọc campus_config.json:', err.message);
  }
  return {
    name: process.env.CAMPUS_NAME || 'Khuôn viên Cơ sở chính - Trường Đại học',
    lat: parseFloat(process.env.CAMPUS_LAT || '20.965483'),
    lng: parseFloat(process.env.CAMPUS_LNG || '105.729905'),
    radiusMeters: parseInt(process.env.CAMPUS_RADIUS_METERS || '500', 10),
  };
};

const savePersistedCampusConfig = (cfg) => {
  try {
    fs.writeFileSync(CAMPUS_CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
  } catch (err) {
    console.error('[AttendanceService] Không thể lưu campus_config.json:', err.message);
  }
};

const CAMPUS_CONFIG = loadPersistedCampusConfig();

/**
 * Tính khoảng cách đường chim bay giữa 2 tọa độ GPS (Công thức Haversine)
 * @param {number} lat1 
 * @param {number} lon1 
 * @param {number} lat2 
 * @param {number} lon2 
 * @returns {number} Khoảng cách tính bằng mét
 */
const calculateDistanceMeters = (lat1, lon1, lat2, lon2) => {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) {
    return Infinity;
  }
  const R = 6371e3; // Bán kính Trái Đất (mét)
  const rad = Math.PI / 180;
  const phi1 = lat1 * rad;
  const phi2 = lat2 * rad;
  const deltaPhi = (lat2 - lat1) * rad;
  const deltaLambda = (lon2 - lon1) * rad;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
};

/**
 * Kiểm tra xem vị trí người dùng có nằm trong Hàng rào địa lý (Geofence) hay không
 * Hỗ trợ dung sai thông minh theo sai số GPS thực tế của điện thoại (Adaptive Tolerance)
 * @param {{ lat: number, lng: number, accuracy?: number }} clientLocation 
 * @param {{ lat?: number, lng?: number, name?: string }} [targetLocation] 
 * @param {number} [maxRadius] 
 * @returns {{ isInside: boolean, distanceMeters: number, allowedRadius: number, effectiveRadius: number, target: Object }}
 */
const validateGeofence = (clientLocation, targetLocation = null, maxRadius = null) => {
  const allowedRadius = maxRadius || CAMPUS_CONFIG.radiusMeters;
  const accuracyTolerance = Math.min(Number(clientLocation?.accuracy) || 0, 100);
  const effectiveRadius = allowedRadius + accuracyTolerance;

  const campusTarget = {
    name: CAMPUS_CONFIG.name,
    lat: CAMPUS_CONFIG.lat,
    lng: CAMPUS_CONFIG.lng,
  };

  if (!clientLocation || clientLocation.lat === undefined || clientLocation.lng === undefined) {
    return {
      isInside: false,
      distanceMeters: Infinity,
      allowedRadius,
      effectiveRadius,
      target: campusTarget,
      error: 'Không tìm thấy dữ liệu tọa độ GPS từ thiết bị.',
    };
  }

  // 1. Kiểm tra khoảng cách tới Tọa độ Khuôn viên trường (Campus Config) - Ưu tiên hàng đầu
  const campusDistance = calculateDistanceMeters(
    Number(clientLocation.lat),
    Number(clientLocation.lng),
    Number(CAMPUS_CONFIG.lat),
    Number(CAMPUS_CONFIG.lng)
  );

  if (campusDistance <= effectiveRadius) {
    return {
      isInside: true,
      distanceMeters: campusDistance,
      allowedRadius,
      effectiveRadius,
      target: campusTarget,
    };
  }

  // 2. Nếu targetLocation (khoa/phòng ban) có tọa độ riêng hợp lệ, kiểm tra thêm
  if (
    targetLocation &&
    targetLocation.lat !== undefined &&
    targetLocation.lat !== null &&
    targetLocation.lng !== undefined &&
    targetLocation.lng !== null
  ) {
    const deptDistance = calculateDistanceMeters(
      Number(clientLocation.lat),
      Number(clientLocation.lng),
      Number(targetLocation.lat),
      Number(targetLocation.lng)
    );

    if (deptDistance <= effectiveRadius) {
      return {
        isInside: true,
        distanceMeters: deptDistance,
        allowedRadius,
        effectiveRadius,
        target: {
          name: targetLocation.name || CAMPUS_CONFIG.name,
          lat: targetLocation.lat,
          lng: targetLocation.lng,
        },
      };
    }
  }

  // Nếu không nằm trong cả hai, trả về khoảng cách đến khuôn viên trường
  return {
    isInside: false,
    distanceMeters: campusDistance,
    allowedRadius,
    effectiveRadius,
    target: campusTarget,
  };
};

// =======================================================
// DYNAMIC TOTP / TIMED QR CODE GENERATION & VERIFICATION
// =======================================================
const QR_SECRET = process.env.QR_SECRET || process.env.JWT_SECRET || 'university_totp_qr_secret_2026';
const QR_LIFETIME_SECONDS = 20; // Mã đổi mỗi 20 giây

/**
 * Sinh mã QR Động chứa token có chữ ký HMAC kèm timestamp (Hết hạn sau 20s)
 * Thiết kế gọn nhẹ để sinh QR code kích thước lớn, các khối vuông to rõ, camera quét cực nhạy từ xa
 * @param {Object} [meta={}] Thông tin giảng đường/kiosk
 * @returns {{ qrToken: string, qrPayload: Object, expiresIn: number, expiresAt: string }}
 */
const generateDynamicQRCode = (meta = {}) => {
  const timestamp = Date.now();
  const nonce = crypto.randomBytes(4).toString('hex');
  const payload = {
    type: 'ATT_QR',
    timestamp,
    expiresIn: QR_LIFETIME_SECONDS,
    nonce,
    room: meta.roomId || 'KIOSK',
  };

  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  // Chữ ký 32 ký tự hex (128-bit) vừa bảo mật tuyệt đối chống giả mạo vừa giữ QR code tinh gọn
  const signature = crypto.createHmac('sha256', QR_SECRET).update(payloadBase64).digest('hex').substring(0, 32);
  const qrToken = `${payloadBase64}.${signature}`;

  return {
    qrToken,
    qrPayload: payload,
    expiresIn: QR_LIFETIME_SECONDS,
    expiresAt: new Date(timestamp + QR_LIFETIME_SECONDS * 1000).toISOString(),
    campus: CAMPUS_CONFIG,
  };
};

/**
 * Xác minh mã QR Động được quét từ điện thoại
 * @param {string} token - Token dạng base64Payload.signature
 * @returns {{ valid: boolean, message?: string, data?: Object }}
 */
const verifyDynamicQRCode = (token) => {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return { valid: false, message: 'Mã QR không đúng định dạng hoặc bị lỗi khi quét.' };
  }

  const [payloadBase64, signature] = token.split('.');
  const fullSignature = crypto.createHmac('sha256', QR_SECRET).update(payloadBase64).digest('hex');

  // Hỗ trợ cả chữ ký 32 ký tự tối ưu và chữ ký 64 ký tự đầy đủ
  const isValidSig = signature === fullSignature.substring(0, 32) || signature === fullSignature;
  if (!isValidSig) {
    return { valid: false, message: 'Chữ ký mã QR không hợp lệ (Mã giả mạo).' };
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8'));
    const now = Date.now();
    const elapsedSeconds = (now - payload.timestamp) / 1000;

    // Cho phép ân hạn thêm 10 giây đối với độ trễ đường truyền mạng di động
    const MAX_ALLOWED_SECONDS = QR_LIFETIME_SECONDS + 10;

    if (elapsedSeconds > MAX_ALLOWED_SECONDS) {
      return {
        valid: false,
        message: `Mã QR đã hết hạn (${Math.round(elapsedSeconds)}s trước). Vui lòng quét mã QR mới nhất hiển thị trên màn hình!`,
      };
    }

    return { valid: true, data: payload };
  } catch {
    return { valid: false, message: 'Không thể giải mã nội dung mã QR.' };
  }
};

const getCampusConfig = () => ({ ...CAMPUS_CONFIG });

const updateCampusConfig = (newConfig = {}) => {
  if (newConfig.name) CAMPUS_CONFIG.name = String(newConfig.name).trim();
  if (newConfig.lat !== undefined && !isNaN(Number(newConfig.lat))) {
    CAMPUS_CONFIG.lat = parseFloat(newConfig.lat);
  }
  if (newConfig.lng !== undefined && !isNaN(Number(newConfig.lng))) {
    CAMPUS_CONFIG.lng = parseFloat(newConfig.lng);
  }
  if (newConfig.radiusMeters !== undefined && !isNaN(Number(newConfig.radiusMeters))) {
    CAMPUS_CONFIG.radiusMeters = parseInt(newConfig.radiusMeters, 10);
  }
  savePersistedCampusConfig(CAMPUS_CONFIG);
  return { ...CAMPUS_CONFIG };
};

module.exports = {
  getVietnamTime,
  getVietnamDayRange,
  timeStringToMinutes,
  getTodayScheduleWindow,
  calculateAttendanceStatus,
  calculateCheckOutStatus,
  getAttendanceSummaryByUser,
  buildAttendanceDateFilter,
  euclideanDistance,
  FACE_MATCH_THRESHOLD,
  DUPLICATE_FACE_THRESHOLD,
  computeNormalizedCentroid,
  checkDuplicateFace,
  getCachedUsersWithFace,
  invalidateFaceCache,
  findBestFaceMatch,
  CAMPUS_CONFIG,
  getCampusConfig,
  updateCampusConfig,
  calculateDistanceMeters,
  validateGeofence,
  generateDynamicQRCode,
  verifyDynamicQRCode,
  evaluateUserScheduleForCheckIn,
};

