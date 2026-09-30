/**
 * motionWorker.ts - Web Worker inline cho Motion Detection 144p
 * 
 * Phân tích chuyển động pixel off-main-thread để đánh thức camera Kiosk
 * khi có người đi tới mà không cần cảm biến phần cứng PIR.
 * 
 * Thuật toán:
 * 1. Nhận ImageData (160×120) từ main thread
 * 2. So sánh absolute diff từng pixel với frame trước
 * 3. Nếu > threshold% pixel thay đổi vượt ngưỡng → báo MOTION_DETECTED
 * 4. Chạy hoàn toàn trong Worker thread, không block UI
 */

// Inline Web Worker source code (sẽ được tạo thành Blob URL)
const MOTION_WORKER_SOURCE = `
  // Frame trước đó để so sánh
  let previousFrame = null;
  
  // Cấu hình mặc định
  let config = {
    pixelDiffThreshold: 30,    // Ngưỡng thay đổi tối thiểu của 1 pixel (0-255)
    motionPercentThreshold: 12, // % pixel thay đổi để coi là có chuyển động
    samplingStep: 4,           // Lấy mẫu mỗi 4 pixel (giảm tải tính toán)
  };

  self.onmessage = function(e) {
    const { type, data, imageData, width, height } = e.data;

    if (type === 'CONFIG') {
      // Cập nhật cấu hình từ main thread
      Object.assign(config, data);
      return;
    }

    if (type === 'ANALYZE') {
      // imageData.data là Uint8ClampedArray (RGBA)
      const pixels = imageData.data;
      const totalSampled = Math.floor((width * height) / config.samplingStep);
      let changedPixels = 0;

      if (previousFrame && previousFrame.length === pixels.length) {
        // So sánh pixel-by-pixel (chỉ kênh R, G, B - bỏ Alpha)
        for (let i = 0; i < pixels.length; i += 4 * config.samplingStep) {
          const diffR = Math.abs(pixels[i] - previousFrame[i]);
          const diffG = Math.abs(pixels[i + 1] - previousFrame[i + 1]);
          const diffB = Math.abs(pixels[i + 2] - previousFrame[i + 2]);
          
          // Trung bình 3 kênh màu
          const avgDiff = (diffR + diffG + diffB) / 3;
          
          if (avgDiff > config.pixelDiffThreshold) {
            changedPixels++;
          }
        }
      }

      // Lưu frame hiện tại cho lần so sánh tiếp theo
      previousFrame = new Uint8ClampedArray(pixels);

      // Tính % chuyển động
      const motionPercent = totalSampled > 0 ? (changedPixels / totalSampled) * 100 : 0;
      const motionDetected = motionPercent > config.motionPercentThreshold;

      self.postMessage({
        type: 'MOTION_RESULT',
        motionDetected,
        motionPercent: Math.round(motionPercent * 10) / 10,
        changedPixels,
        totalSampled,
      });
    }

    if (type === 'RESET') {
      previousFrame = null;
    }
  };
`;

/**
 * Tạo Motion Detection Web Worker từ inline source code
 * Sử dụng Blob URL để không cần file worker riêng biệt
 * 
 * @returns Worker instance hoặc null nếu trình duyệt không hỗ trợ
 */
export function createMotionWorker(): Worker | null {
  try {
    const blob = new Blob([MOTION_WORKER_SOURCE], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);

    // Giải phóng Blob URL sau khi Worker đã load (Worker giữ reference riêng)
    // Delay nhỏ để đảm bảo Worker đã khởi tạo xong
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    return worker;
  } catch (err) {
    console.warn('[MotionWorker] Không thể tạo Web Worker, sẽ dùng fallback main-thread:', err);
    return null;
  }
}

/**
 * Cấu hình cho Motion Detection Worker
 */
export interface MotionWorkerConfig {
  pixelDiffThreshold?: number;    // Ngưỡng thay đổi 1 pixel (default: 30)
  motionPercentThreshold?: number; // % pixel thay đổi (default: 12)
  samplingStep?: number;          // Bước lấy mẫu pixel (default: 4)
}

/**
 * Kết quả phân tích chuyển động từ Worker
 */
export interface MotionResult {
  type: 'MOTION_RESULT';
  motionDetected: boolean;
  motionPercent: number;
  changedPixels: number;
  totalSampled: number;
}

/**
 * Fallback Motion Detection trên Main Thread
 * Dùng khi Web Worker không khả dụng
 * 
 * Lưu ý: Chạy trên main thread nên cần throttle chặt (≤ 2fps)
 */
export class MotionDetectorFallback {
  private previousFrame: Uint8ClampedArray | null = null;
  private config = {
    pixelDiffThreshold: 30,
    motionPercentThreshold: 12,
    samplingStep: 4,
  };

  configure(config: Partial<MotionWorkerConfig>) {
    Object.assign(this.config, config);
  }

  /**
   * Phân tích chuyển động từ ImageData
   * @param imageData - ImageData từ canvas 144p
   * @returns Kết quả phân tích
   */
  analyze(imageData: ImageData): Omit<MotionResult, 'type'> {
    const pixels = imageData.data;
    const totalSampled = Math.floor((imageData.width * imageData.height) / this.config.samplingStep);
    let changedPixels = 0;

    if (this.previousFrame && this.previousFrame.length === pixels.length) {
      for (let i = 0; i < pixels.length; i += 4 * this.config.samplingStep) {
        const diffR = Math.abs(pixels[i] - this.previousFrame[i]);
        const diffG = Math.abs(pixels[i + 1] - this.previousFrame[i + 1]);
        const diffB = Math.abs(pixels[i + 2] - this.previousFrame[i + 2]);
        const avgDiff = (diffR + diffG + diffB) / 3;

        if (avgDiff > this.config.pixelDiffThreshold) {
          changedPixels++;
        }
      }
    }

    this.previousFrame = new Uint8ClampedArray(pixels);

    const motionPercent = totalSampled > 0 ? (changedPixels / totalSampled) * 100 : 0;
    return {
      motionDetected: motionPercent > this.config.motionPercentThreshold,
      motionPercent: Math.round(motionPercent * 10) / 10,
      changedPixels,
      totalSampled,
    };
  }

  reset() {
    this.previousFrame = null;
  }
}
