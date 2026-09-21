/**
 * Zero-dependency QR Code generator (Fast, self-contained, ISO/IEC 18004 compliant)
 * Based on Nayuki's Public Domain QR Code library.
 */

export namespace qrcodegen {
  export class QrCode {
    public static readonly Ecc = {
      LOW: { ordinal: 0, formatBits: 1 },
      MEDIUM: { ordinal: 1, formatBits: 0 },
      QUARTILE: { ordinal: 2, formatBits: 3 },
      HIGH: { ordinal: 3, formatBits: 2 },
    };

    public readonly size: number;
    private readonly modules: boolean[][];
    private readonly isFunction: boolean[][];

    public constructor(
      public readonly version: number,
      public readonly errorCorrectionLevel: any,
      dataCodewords: number[],
      mask: number
    ) {
      if (version < 1 || version > 40) throw new RangeError('Version out of range');
      if (mask < -1 || mask > 7) throw new RangeError('Mask value out of range');
      this.size = version * 4 + 17;
      this.modules = [];
      this.isFunction = [];
      for (let y = 0; y < this.size; y++) {
        this.modules.push(new Array(this.size).fill(false));
        this.isFunction.push(new Array(this.size).fill(false));
      }

      this.drawFunctionPatterns();
      const allCodewords = this.addEccAndInterleave(dataCodewords);
      this.drawCodewords(allCodewords);

      if (mask === -1) {
        let minPenalty = 1e9;
        for (let i = 0; i < 8; i++) {
          this.applyMask(i);
          this.drawFormatBits(i);
          const penalty = this.getPenaltyScore();
          if (penalty < minPenalty) {
            mask = i;
            minPenalty = penalty;
          }
          this.applyMask(i);
        }
      }
      this.applyMask(mask);
      this.drawFormatBits(mask);
      this.isFunction = [];
    }

    public getModule(x: number, y: number): boolean {
      return 0 <= x && x < this.size && 0 <= y && y < this.size && this.modules[y][x];
    }

    public static encodeText(text: string, ecl: any): QrCode {
      const seg = QrSegment.makeBytes(toUtf8ByteArray(text));
      return QrCode.encodeSegments([seg], ecl);
    }

    public static encodeSegments(segs: QrSegment[], ecl: any, minVersion = 1, maxVersion = 40, mask = -1): QrCode {
      for (let version = minVersion; ; version++) {
        const dataCapacityBits = QrCode.getNumDataCodewords(version, ecl) * 8;
        const usedBits = QrSegment.getTotalBits(segs, version);
        if (usedBits <= dataCapacityBits) {
          const bb: number[] = [];
          for (const seg of segs) {
            appendBits(seg.mode.modeBits, 4, bb);
            appendBits(seg.numChars, seg.mode.numCharCountBits(version), bb);
            for (const b of seg.getData()) bb.push(b);
          }
          appendBits(0, Math.min(4, dataCapacityBits - bb.length), bb);
          appendBits(0, (8 - (bb.length % 8)) % 8, bb);
          const padByte = [0xec, 0x11];
          for (let i = 0; bb.length < dataCapacityBits; i++) {
            appendBits(padByte[i % 2], 8, bb);
          }
          const dataCodewords: number[] = [];
          while (dataCodewords.length * 8 < bb.length) dataCodewords.push(0);
          bb.forEach((bit, i) => (dataCodewords[i >>> 3] |= bit << (7 - (i & 7))));
          return new QrCode(version, ecl, dataCodewords, mask);
        }
        if (version >= maxVersion) throw new Error('Data too long');
      }
    }

    private drawFunctionPatterns(): void {
      for (let i = 0; i < this.size; i++) {
        this.setFunctionModule(6, i, i % 2 === 0);
        this.setFunctionModule(i, 6, i % 2 === 0);
      }
      this.drawFinderPattern(3, 3);
      this.drawFinderPattern(this.size - 4, 3);
      this.drawFinderPattern(3, this.size - 4);

      const alignPatPos = QrCode.getAlignmentPatternPositions(this.version);
      const numAlign = alignPatPos.length;
      for (let i = 0; i < numAlign; i++) {
        for (let j = 0; j < numAlign; j++) {
          if ((i === 0 && j === 0) || (i === 0 && j === numAlign - 1) || (i === numAlign - 1 && j === 0)) continue;
          this.drawAlignmentPattern(alignPatPos[i], alignPatPos[j]);
        }
      }
      this.drawFormatBits(0);
      this.drawVersion();
    }

    private drawFormatBits(mask: number): void {
      const data = (this.errorCorrectionLevel.formatBits << 3) | mask;
      let rem = data;
      for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      const bits = ((data << 10) | rem) ^ 0x5412;
      for (let i = 0; i <= 5; i++) this.setFunctionModule(8, i, getBit(bits, i));
      this.setFunctionModule(8, 7, getBit(bits, 6));
      this.setFunctionModule(8, 8, getBit(bits, 7));
      this.setFunctionModule(7, 8, getBit(bits, 8));
      for (let i = 9; i < 15; i++) this.setFunctionModule(14 - i, 8, getBit(bits, i));
      for (let i = 0; i < 8; i++) this.setFunctionModule(this.size - 1 - i, 8, getBit(bits, i));
      for (let i = 8; i < 15; i++) this.setFunctionModule(8, this.size - 15 + i, getBit(bits, i));
      this.setFunctionModule(8, this.size - 8, true);
    }

    private drawVersion(): void {
      if (this.version < 7) return;
      let rem = this.version;
      for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
      const bits = (this.version << 12) | rem;
      for (let i = 0; i < 18; i++) {
        const bit = getBit(bits, i);
        const a = this.size - 11 + (i % 3);
        const b = Math.floor(i / 3);
        this.setFunctionModule(a, b, bit);
        this.setFunctionModule(b, a, bit);
      }
    }

    private drawFinderPattern(x: number, y: number): void {
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const dist = Math.max(Math.abs(dx), Math.abs(dy));
          const xx = x + dx;
          const yy = y + dy;
          if (0 <= xx && xx < this.size && 0 <= yy && yy < this.size) {
            this.setFunctionModule(xx, yy, dist !== 2 && dist !== 4);
          }
        }
      }
    }

    private drawAlignmentPattern(x: number, y: number): void {
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          this.setFunctionModule(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    }

    private setFunctionModule(x: number, y: number, isDark: boolean): void {
      this.modules[y][x] = isDark;
      this.isFunction[y][x] = true;
    }

    private addEccAndInterleave(data: number[]): number[] {
      const ver = this.version;
      const ecl = this.errorCorrectionLevel;
      const numBlocks = QrCode.NUM_ERROR_CORRECTION_BLOCKS[ecl.ordinal][ver];
      const blockEccLen = QrCode.ECC_CODEWORDS_PER_BLOCK[ecl.ordinal][ver];
      const rawCodewords = Math.floor(QrCode.getNumRawDataModules(ver) / 8);
      const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
      const shortBlockLen = Math.floor(rawCodewords / numBlocks);

      const blocks: number[][] = [];
      const rsDiv = QrCode.reedSolomonComputeDivisor(blockEccLen);
      for (let i = 0, k = 0; i < numBlocks; i++) {
        const dat = data.slice(k, k + shortBlockLen - blockEccLen + (i >= numShortBlocks ? 1 : 0));
        k += dat.length;
        const ecc = QrCode.reedSolomonComputeRemainder(dat, rsDiv);
        if (i < numShortBlocks) dat.push(0);
        blocks.push(dat.concat(ecc));
      }

      const result: number[] = [];
      for (let i = 0; i < blocks[0].length; i++) {
        blocks.forEach((block, j) => {
          if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) result.push(block[i]);
        });
      }
      return result;
    }

    private drawCodewords(data: number[]): void {
      let i = 0;
      for (let right = this.size - 1; right >= 1; right -= 2) {
        if (right === 6) right = 5;
        for (let vert = 0; vert < this.size; vert++) {
          for (let j = 0; j < 2; j++) {
            const x = right - j;
            const upward = ((right + 1) & 2) === 0;
            const y = upward ? this.size - 1 - vert : vert;
            if (!this.isFunction[y][x] && i < data.length * 8) {
              this.modules[y][x] = getBit(data[i >>> 3], 7 - (i & 7));
              i++;
            }
          }
        }
      }
    }

    private applyMask(mask: number): void {
      for (let y = 0; y < this.size; y++) {
        for (let x = 0; x < this.size; x++) {
          let invert: boolean;
          switch (mask) {
            case 0: invert = (x + y) % 2 === 0; break;
            case 1: invert = y % 2 === 0; break;
            case 2: invert = x % 3 === 0; break;
            case 3: invert = (x + y) % 3 === 0; break;
            case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
            case 5: invert = ((x * y) % 2) + ((x * y) % 3) === 0; break;
            case 6: invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break;
            case 7: invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0; break;
            default: throw new Error('Invalid mask');
          }
          if (!this.isFunction[y][x] && invert) this.modules[y][x] = !this.modules[y][x];
        }
      }
    }

    private getPenaltyScore(): number {
      let result = 0;
      for (let y = 0; y < this.size; y++) {
        let runColor = false;
        let runX = 0;
        for (let x = 0; x < this.size; x++) {
          if (this.modules[y][x] === runColor) {
            runX++;
            if (runX === 5) result += 3;
            else if (runX > 5) result++;
          } else {
            runColor = this.modules[y][x];
            runX = 1;
          }
        }
      }
      return result;
    }

    private static getAlignmentPatternPositions(ver: number): number[] {
      if (ver === 1) return [];
      const num = Math.floor(ver / 7) + 2;
      const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (num * 2 - 2)) * 2;
      const result = [6];
      for (let pos = ver * 4 + 10; result.length < num; pos -= step) result.splice(1, 0, pos);
      return result;
    }

    private static getNumRawDataModules(ver: number): number {
      let result = (16 * ver + 128) * ver + 64;
      if (ver >= 2) {
        const numAlign = Math.floor(ver / 7) + 2;
        result -= (25 * numAlign - 10) * numAlign - 55;
        if (ver >= 7) result -= 36;
      }
      return result;
    }

    private static getNumDataCodewords(ver: number, ecl: any): number {
      return Math.floor(QrCode.getNumRawDataModules(ver) / 8) - QrCode.ECC_CODEWORDS_PER_BLOCK[ecl.ordinal][ver] * QrCode.NUM_ERROR_CORRECTION_BLOCKS[ecl.ordinal][ver];
    }

    private static reedSolomonComputeDivisor(degree: number): number[] {
      const result: number[] = new Array(degree).fill(0);
      result[degree - 1] = 1;
      let root = 1;
      for (let i = 0; i < degree; i++) {
        for (let j = 0; j < result.length; j++) {
          result[j] = QrCode.reedSolomonMultiply(result[j], root);
          if (j + 1 < result.length) result[j] ^= result[j + 1];
        }
        root = QrCode.reedSolomonMultiply(root, 0x02);
      }
      return result;
    }

    private static reedSolomonComputeRemainder(data: number[], divisor: number[]): number[] {
      const result = divisor.map(() => 0);
      for (const b of data) {
        const factor = b ^ (result.shift() as number);
        result.push(0);
        divisor.forEach((coef, i) => (result[i] ^= QrCode.reedSolomonMultiply(coef, factor)));
      }
      return result;
    }

    private static reedSolomonMultiply(x: number, y: number): number {
      let z = 0;
      for (let i = 7; i >= 0; i--) {
        z = (z << 1) ^ ((z >>> 7) * 0x11d);
        z ^= ((y >>> i) & 1) * x;
      }
      return z;
    }

    private static readonly ECC_CODEWORDS_PER_BLOCK = [
      [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
      [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
      [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
      [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    ];

    private static readonly NUM_ERROR_CORRECTION_BLOCKS = [
      [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
      [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
      [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
      [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 72, 74, 78],
    ];
  }

  export class QrSegment {
    public static readonly Mode = {
      BYTE: { modeBits: 0x4, numCharCountBits: () => 8 },
    };

    public constructor(
      public readonly mode: any,
      public readonly numChars: number,
      private readonly bitData: number[]
    ) {}

    public getData(): number[] {
      return this.bitData.slice();
    }

    public static makeBytes(data: number[]): QrSegment {
      const bb: number[] = [];
      for (const b of data) appendBits(b, 8, bb);
      return new QrSegment(QrSegment.Mode.BYTE, data.length, bb);
    }

    public static getTotalBits(segs: QrSegment[], version: number): number {
      let result = 0;
      for (const seg of segs) {
        const ccbits = seg.mode.numCharCountBits(version);
        result += 4 + ccbits + seg.bitData.length;
      }
      return result;
    }
  }

  function appendBits(val: number, len: number, bb: number[]): void {
    for (let i = len - 1; i >= 0; i--) bb.push((val >>> i) & 1);
  }

  function getBit(x: number, i: number): boolean {
    return ((x >>> i) & 1) !== 0;
  }

  function toUtf8ByteArray(str: string): number[] {
    str = encodeURI(str);
    const result: number[] = [];
    for (let i = 0; i < str.length; i++) {
      if (str.charAt(i) !== '%') result.push(str.charCodeAt(i));
      else {
        result.push(parseInt(str.substr(i + 1, 2), 16));
        i += 2;
      }
    }
    return result;
  }
}

/**
 * Tạo thẻ SVG QR Code hoàn chỉnh từ chuỗi văn bản
 * Chuẩn ISO/IEC 18004:
 * - Quiet zone = 4 modules đồng đều tuyệt đối 4 cạnh
 * - Background phẳng không bo viền trong SVG (tránh cắt góc finder patterns)
 * - Tỉ lệ chuẩn 100% responsive, render sắc nét crispEdges
 */
export function generateQrSvg(
  text: string,
  options?: { border?: number; darkColor?: string; lightColor?: string }
): string {
  try {
    const border = options?.border ?? 4;
    const darkColor = options?.darkColor ?? '#0f172a';
    const lightColor = options?.lightColor ?? '#ffffff';

    const qr = qrcodegen.QrCode.encodeText(text, qrcodegen.QrCode.Ecc.MEDIUM);
    const parts: string[] = [];
    for (let y = 0; y < qr.size; y++) {
      for (let x = 0; x < qr.size; x++) {
        if (qr.getModule(x, y)) {
          parts.push(`M${x + border},${y + border}h1v1h-1z`);
        }
      }
    }
    const totalSize = qr.size + border * 2;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" width="100%" height="100%" shape-rendering="crispEdges" style="display: block; width: 100%; height: 100%;">
      <rect width="${totalSize}" height="${totalSize}" fill="${lightColor}" />
      <path d="${parts.join('')}" fill="${darkColor}" />
    </svg>`;
  } catch (err) {
    console.error('Lỗi sinh SVG QR:', err);
    return '';
  }
}
