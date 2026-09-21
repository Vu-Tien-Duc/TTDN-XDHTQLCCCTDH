/**
 * Utility phân tích và chuẩn hóa mốc thời gian tiếng Việt
 * Áp dụng múi giờ chuẩn: Asia/Ho_Chi_Minh (UTC+7)
 * Đảm bảo [fromDate, toDate] chính xác tuyệt đối từ 00:00:00.000 đến 23:59:59.999
 */

const TIMEZONE = 'Asia/Ho_Chi_Minh';

/**
 * Lấy chuỗi YYYY-MM-DD theo giờ Việt Nam
 * @param {Date} [date=new Date()]
 * @returns {string} 'YYYY-MM-DD'
 */
const getVietnamDateString = (date = new Date()) => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
};

/**
 * Tạo Date object tương ứng với thời điểm tại Việt Nam (UTC+7)
 * @param {string} dateStr 'YYYY-MM-DD'
 * @param {string} [timeStr='00:00:00.000']
 * @returns {Date}
 */
const createVietnamDate = (dateStr, timeStr = '00:00:00.000') => {
  return new Date(`${dateStr}T${timeStr}+07:00`);
};

/**
 * Lấy thông tin ngày, tháng, năm hiện tại theo giờ Việt Nam
 * @param {Date} [date=new Date()]
 * @returns {{ year: number, month: number, day: number, dateStr: string, weekday: number }}
 */
const getVietnamParts = (date = new Date()) => {
  const dateStr = getVietnamDateString(date);
  const [year, month, day] = dateStr.split('-').map(Number);
  // Thứ trong tuần: tạo Date UTC tại 12:00 của ngày đó để xác định thứ chính xác
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const weekday = d.getUTCDay(); // 0: Chủ nhật, 1: Thứ 2, ..., 6: Thứ 7
  return { year, month, day, dateStr, weekday };
};

/**
 * Lấy ngày cuối cùng của một tháng
 * @param {number} year
 * @param {number} month (1-12)
 * @returns {number} 28, 29, 30, hoặc 31
 */
const getDaysInMonth = (year, month) => {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
};

/**
 * Phân tích cụm từ thời gian tiếng Việt từ câu hỏi tự nhiên
 * @param {string} text
 * @param {Date} [referenceDate=new Date()]
 * @returns {{
 *   fromDate: Date,
 *   toDate: Date,
 *   label: string,
 *   type: 'TODAY' | 'YESTERDAY' | 'TOMORROW' | 'THIS_WEEK' | 'LAST_WEEK' | 'NEXT_WEEK' | 'THIS_MONTH' | 'LAST_MONTH' | 'NEXT_MONTH' | 'SPECIFIC_MONTH' | 'RECENT_DAYS' | 'MONTH_START' | 'MONTH_END' | 'DEFAULT'
 * }}
 */
const parseVietnameseDateRange = (text = '', referenceDate = new Date()) => {
  const lower = (text || '').toLowerCase().trim();
  const { year, month, day, dateStr, weekday } = getVietnamParts(referenceDate);

  // 1. Ngày mai
  if (lower.includes('ngày mai') || lower.includes('mai')) {
    const tm = new Date(createVietnamDate(dateStr, '12:00:00.000').getTime() + 24 * 60 * 60 * 1000);
    const tmParts = getVietnamParts(tm);
    return {
      fromDate: createVietnamDate(tmParts.dateStr, '00:00:00.000'),
      toDate: createVietnamDate(tmParts.dateStr, '23:59:59.999'),
      label: `ngày mai (${tmParts.day}/${tmParts.month}/${tmParts.year})`,
      type: 'TOMORROW',
    };
  }

  // 2. Hôm qua
  if (lower.includes('hôm qua') || lower.includes('qua')) {
    const yst = new Date(createVietnamDate(dateStr, '12:00:00.000').getTime() - 24 * 60 * 60 * 1000);
    const ystParts = getVietnamParts(yst);
    return {
      fromDate: createVietnamDate(ystParts.dateStr, '00:00:00.000'),
      toDate: createVietnamDate(ystParts.dateStr, '23:59:59.999'),
      label: `hôm qua (${ystParts.day}/${ystParts.month}/${ystParts.year})`,
      type: 'YESTERDAY',
    };
  }

  // 3. 7 ngày gần nhất / gần đây
  if (lower.includes('7 ngày') || lower.includes('bảy ngày')) {
    const start = new Date(createVietnamDate(dateStr, '12:00:00.000').getTime() - 6 * 24 * 60 * 60 * 1000);
    const startParts = getVietnamParts(start);
    return {
      fromDate: createVietnamDate(startParts.dateStr, '00:00:00.000'),
      toDate: createVietnamDate(dateStr, '23:59:59.999'),
      label: `7 ngày gần nhất (từ ${startParts.day}/${startParts.month} đến ${day}/${month}/${year})`,
      type: 'RECENT_DAYS',
    };
  }

  // 4. 30 ngày gần nhất / gần đây
  if (lower.includes('30 ngày') || lower.includes('ba mươi ngày')) {
    const start = new Date(createVietnamDate(dateStr, '12:00:00.000').getTime() - 29 * 24 * 60 * 60 * 1000);
    const startParts = getVietnamParts(start);
    return {
      fromDate: createVietnamDate(startParts.dateStr, '00:00:00.000'),
      toDate: createVietnamDate(dateStr, '23:59:59.999'),
      label: `30 ngày gần nhất (từ ${startParts.day}/${startParts.month} đến ${day}/${month}/${year})`,
      type: 'RECENT_DAYS',
    };
  }

  // 5. Tuần trước
  if (lower.includes('tuần trước')) {
    const diffToMonday = weekday === 0 ? 6 : weekday - 1;
    const thisMonday = new Date(createVietnamDate(dateStr, '12:00:00.000').getTime() - diffToMonday * 24 * 60 * 60 * 1000);
    const lastMonday = new Date(thisMonday.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastSunday = new Date(lastMonday.getTime() + 6 * 24 * 60 * 60 * 1000);

    const lMonParts = getVietnamParts(lastMonday);
    const lSunParts = getVietnamParts(lastSunday);
    return {
      fromDate: createVietnamDate(lMonParts.dateStr, '00:00:00.000'),
      toDate: createVietnamDate(lSunParts.dateStr, '23:59:59.999'),
      label: `tuần trước (từ ${lMonParts.day}/${lMonParts.month} đến ${lSunParts.day}/${lSunParts.month}/${lSunParts.year})`,
      type: 'LAST_WEEK',
    };
  }

  // 6. Tuần sau
  if (lower.includes('tuần sau') || lower.includes('tuần tới')) {
    const diffToMonday = weekday === 0 ? 6 : weekday - 1;
    const thisMonday = new Date(createVietnamDate(dateStr, '12:00:00.000').getTime() - diffToMonday * 24 * 60 * 60 * 1000);
    const nextMonday = new Date(thisMonday.getTime() + 7 * 24 * 60 * 60 * 1000);
    const nextSunday = new Date(nextMonday.getTime() + 6 * 24 * 60 * 60 * 1000);

    const nMonParts = getVietnamParts(nextMonday);
    const nSunParts = getVietnamParts(nextSunday);
    return {
      fromDate: createVietnamDate(nMonParts.dateStr, '00:00:00.000'),
      toDate: createVietnamDate(nSunParts.dateStr, '23:59:59.999'),
      label: `tuần sau (từ ${nMonParts.day}/${nMonParts.month} đến ${nSunParts.day}/${nSunParts.month}/${nSunParts.year})`,
      type: 'NEXT_WEEK',
    };
  }

  // 7. Tuần này / trong tuần
  if (lower.includes('tuần này') || lower.includes('trong tuần') || lower.includes('cả tuần')) {
    const diffToMonday = weekday === 0 ? 6 : weekday - 1;
    const thisMonday = new Date(createVietnamDate(dateStr, '12:00:00.000').getTime() - diffToMonday * 24 * 60 * 60 * 1000);
    const thisSunday = new Date(thisMonday.getTime() + 6 * 24 * 60 * 60 * 1000);

    const tMonParts = getVietnamParts(thisMonday);
    const tSunParts = getVietnamParts(thisSunday);
    return {
      fromDate: createVietnamDate(tMonParts.dateStr, '00:00:00.000'),
      toDate: createVietnamDate(tSunParts.dateStr, '23:59:59.999'),
      label: `tuần này (từ ${tMonParts.day}/${tMonParts.month} đến ${tSunParts.day}/${tSunParts.month}/${tSunParts.year})`,
      type: 'THIS_WEEK',
    };
  }

  // 8. Tháng trước
  if (lower.includes('tháng trước')) {
    let prevMonth = month - 1;
    let prevYear = year;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear -= 1;
    }
    const daysInPrev = getDaysInMonth(prevYear, prevMonth);
    const mStr = String(prevMonth).padStart(2, '0');
    return {
      fromDate: createVietnamDate(`${prevYear}-${mStr}-01`, '00:00:00.000'),
      toDate: createVietnamDate(`${prevYear}-${mStr}-${String(daysInPrev).padStart(2, '0')}`, '23:59:59.999'),
      label: `tháng trước (tháng ${prevMonth}/${prevYear})`,
      type: 'LAST_MONTH',
    };
  }

  // 9. Tháng sau
  if (lower.includes('tháng sau') || lower.includes('tháng tới')) {
    let nextMonth = month + 1;
    let nextYear = year;
    if (nextMonth === 13) {
      nextMonth = 1;
      nextYear += 1;
    }
    const daysInNext = getDaysInMonth(nextYear, nextMonth);
    const mStr = String(nextMonth).padStart(2, '0');
    return {
      fromDate: createVietnamDate(`${nextYear}-${mStr}-01`, '00:00:00.000'),
      toDate: createVietnamDate(`${nextYear}-${mStr}-${String(daysInNext).padStart(2, '0')}`, '23:59:59.999'),
      label: `tháng sau (tháng ${nextMonth}/${nextYear})`,
      type: 'NEXT_MONTH',
    };
  }

  // 10. Đầu tháng
  if (lower.includes('đầu tháng')) {
    const mStr = String(month).padStart(2, '0');
    return {
      fromDate: createVietnamDate(`${year}-${mStr}-01`, '00:00:00.000'),
      toDate: createVietnamDate(`${year}-${mStr}-10`, '23:59:59.999'),
      label: `đầu tháng ${month}/${year} (từ 01 đến 10/${month}/${year})`,
      type: 'MONTH_START',
    };
  }

  // 11. Cuối tháng
  if (lower.includes('cuối tháng')) {
    const days = getDaysInMonth(year, month);
    const mStr = String(month).padStart(2, '0');
    return {
      fromDate: createVietnamDate(`${year}-${mStr}-20`, '00:00:00.000'),
      toDate: createVietnamDate(`${year}-${mStr}-${String(days).padStart(2, '0')}`, '23:59:59.999'),
      label: `cuối tháng ${month}/${year} (từ 20 đến ${days}/${month}/${year})`,
      type: 'MONTH_END',
    };
  }

  // 12. Tháng cụ thể: "tháng 9", "tháng 09", "tháng 9/2026", "tháng 9 năm 2026"
  const monthMatch = lower.match(/tháng\s*(\d{1,2})(?:\/|\s*năm\s*)?(\d{4})?/);
  if (monthMatch && !lower.includes('tháng này') && !lower.includes('tháng trước') && !lower.includes('tháng sau')) {
    const targetMonth = parseInt(monthMatch[1], 10);
    const targetYear = monthMatch[2] ? parseInt(monthMatch[2], 10) : year;
    if (targetMonth >= 1 && targetMonth <= 12) {
      const days = getDaysInMonth(targetYear, targetMonth);
      const mStr = String(targetMonth).padStart(2, '0');
      return {
        fromDate: createVietnamDate(`${targetYear}-${mStr}-01`, '00:00:00.000'),
        toDate: createVietnamDate(`${targetYear}-${mStr}-${String(days).padStart(2, '0')}`, '23:59:59.999'),
        label: `tháng ${targetMonth}/${targetYear}`,
        type: 'SPECIFIC_MONTH',
      };
    }
  }

  // 13. Tháng này / trong tháng
  if (lower.includes('tháng này') || lower.includes('trong tháng') || lower.includes('cả tháng')) {
    const days = getDaysInMonth(year, month);
    const mStr = String(month).padStart(2, '0');
    return {
      fromDate: createVietnamDate(`${year}-${mStr}-01`, '00:00:00.000'),
      toDate: createVietnamDate(`${year}-${mStr}-${String(days).padStart(2, '0')}`, '23:59:59.999'),
      label: `tháng này (${month}/${year})`,
      type: 'THIS_MONTH',
    };
  }

  // 14. Mặc định hoặc nói rõ "hôm nay", "ngày hôm nay", "nay"
  return {
    fromDate: createVietnamDate(dateStr, '00:00:00.000'),
    toDate: createVietnamDate(dateStr, '23:59:59.999'),
    label: `hôm nay (${day}/${month}/${year})`,
    type: 'TODAY',
  };
};

module.exports = {
  TIMEZONE,
  getVietnamDateString,
  createVietnamDate,
  getVietnamParts,
  getDaysInMonth,
  parseVietnameseDateRange,
};
