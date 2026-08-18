/**
 * Tarjetas Virtuales para KIMOS — App instalable (multiInstance).
 * Permite crear tarjetas de presentación virtuales en formato imagen con código QR vCard
 * para escaneo instantáneo y almacenamiento de contactos.
 *
 * v1.1.0: las tarjetas se generan desde los usuarios reales del sistema KIMOS
 * (/api/identity/actors vía shell.authFetch): foto de perfil, correo, cargo,
 * teléfono y ubicación. Logo de marca a nivel de colección aplicado a las
 * tarjetas generadas.
 * v1.2.0: controles de visualización de foto (mostrar/ocultar, forma, tamaño,
 * zoom y encuadre del recorte, anillo) y de logo (mostrar/ocultar, tamaño,
 * opacidad y placa de fondo).
 */

// ── Sincronizado con manifest.json ───────────────────────────────────────────
const APP_VERSION = '1.2.0';
const APP_ID = 'kimos.tarjetas';

// ── Motor QR en JS puro (Byte Mode UTF-8 / Reed-Solomon) ──────────────────────
class QRCodeModel {
  constructor(typeNumber, errorCorrectLevel) {
    this.typeNumber = typeNumber;
    this.errorCorrectLevel = errorCorrectLevel;
    this.modules = null;
    this.moduleCount = 0;
    this.dataCache = null;
    this.dataList = [];
  }
  addData(data) {
    this.dataList.push(new QR8bitByte(data));
    this.dataCache = null;
  }
  isDark(row, col) {
    return this.modules[row][col];
  }
  getModuleCount() {
    return this.moduleCount;
  }
  make() {
    if (this.typeNumber < 1) {
      let typeNumber = 1;
      for (typeNumber = 1; typeNumber < 15; typeNumber++) {
        const rsBlocks = QRRSBlock.getRSBlocks(typeNumber, this.errorCorrectLevel);
        const buffer = new QRBitBuffer();
        let totalDataCount = 0;
        for (let i = 0; i < rsBlocks.length; i++) totalDataCount += rsBlocks[i].dataCount;
        for (let i = 0; i < this.dataList.length; i++) {
          const data = this.dataList[i];
          buffer.put(data.mode, 4);
          buffer.put(data.getLength(), QRUtil.getLengthInBits(data.mode, typeNumber));
          data.write(buffer);
        }
        if (buffer.getLengthInBits() <= totalDataCount * 8) break;
      }
      this.typeNumber = typeNumber;
    }
    this.makeImpl(false, this.getBestMaskPattern());
  }
  makeImpl(test, maskPattern) {
    this.moduleCount = this.typeNumber * 4 + 17;
    this.modules = new Array(this.moduleCount);
    for (let row = 0; row < this.moduleCount; row++) {
      this.modules[row] = new Array(this.moduleCount);
      for (let col = 0; col < this.moduleCount; col++) this.modules[row][col] = null;
    }
    this.setupPositionProbePattern(0, 0);
    this.setupPositionProbePattern(this.moduleCount - 7, 0);
    this.setupPositionProbePattern(0, this.moduleCount - 7);
    this.setupPositionAdjustPattern();
    this.setupTimingPattern();
    this.setupTypeInfo(test, maskPattern);
    if (this.typeNumber >= 7) this.setupTypeNumber(test);
    if (this.dataCache == null) {
      this.dataCache = QRCodeModel.createData(this.typeNumber, this.errorCorrectLevel, this.dataList);
    }
    this.mapData(this.dataCache, maskPattern);
  }
  setupPositionProbePattern(row, col) {
    for (let r = -1; r <= 7; r++) {
      if (row + r <= -1 || this.moduleCount <= row + r) continue;
      for (let c = -1; c <= 7; c++) {
        if (col + c <= -1 || this.moduleCount <= col + c) continue;
        if ((0 <= r && r <= 6 && (c == 0 || c == 6)) || (0 <= c && c <= 6 && (r == 0 || r == 6)) || (2 <= r && r <= 4 && 2 <= c && c <= 4)) {
          this.modules[row + r][col + c] = true;
        } else {
          this.modules[row + r][col + c] = false;
        }
      }
    }
  }
  getBestMaskPattern() {
    let minLostPoint = 0, pattern = 0;
    for (let i = 0; i < 8; i++) {
      this.makeImpl(true, i);
      const lostPoint = QRUtil.getLostPoint(this);
      if (i == 0 || minLostPoint > lostPoint) { minLostPoint = lostPoint; pattern = i; }
    }
    return pattern;
  }
  setupTimingPattern() {
    for (let r = 8; r < this.moduleCount - 8; r++) { if (this.modules[r][6] === null) this.modules[r][6] = (r % 2 == 0); }
    for (let c = 8; c < this.moduleCount - 8; c++) { if (this.modules[6][c] === null) this.modules[6][c] = (c % 2 == 0); }
  }
  setupPositionAdjustPattern() {
    const pos = QRUtil.getPatternPosition(this.typeNumber);
    for (let i = 0; i < pos.length; i++) {
      for (let j = 0; j < pos.length; j++) {
        const row = pos[i], col = pos[j];
        if (this.modules[row][col] !== null) continue;
        for (let r = -2; r <= 2; r++) {
          for (let c = -2; c <= 2; c++) {
            this.modules[row + r][col + c] = (r == -2 || r == 2 || c == -2 || c == 2 || (r == 0 && c == 0));
          }
        }
      }
    }
  }
  setupTypeNumber(test) {
    const bits = QRUtil.getBCHTypeNumber(this.typeNumber);
    for (let i = 0; i < 18; i++) {
      const mod = (!test && ((bits >> i) & 1) == 1);
      this.modules[Math.floor(i / 3)][i % 3 + this.moduleCount - 8 - 3] = mod;
      this.modules[i % 3 + this.moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
    }
  }
  setupTypeInfo(test, maskPattern) {
    const data = (this.errorCorrectLevel << 3) | maskPattern;
    const bits = QRUtil.getBCHTypeInfo(data);
    for (let i = 0; i < 15; i++) {
      const mod = (!test && ((bits >> i) & 1) == 1);
      if (i < 6) this.modules[i][8] = mod;
      else if (i < 8) this.modules[i + 1][8] = mod;
      else this.modules[this.moduleCount - 15 + i][8] = mod;
      if (i < 8) this.modules[8][this.moduleCount - i - 1] = mod;
      else if (i < 9) this.modules[8][15 - i - 1 + 1] = mod;
      else this.modules[8][15 - i - 1] = mod;
    }
    this.modules[this.moduleCount - 8][8] = (!test);
  }
  mapData(data, maskPattern) {
    let inc = -1, row = this.moduleCount - 1, bitIndex = 7, byteIndex = 0;
    for (let col = this.moduleCount - 1; col > 0; col -= 2) {
      if (col == 6) col--;
      while (true) {
        for (let c = 0; c < 2; c++) {
          if (this.modules[row][col - c] === null) {
            let dark = false;
            if (byteIndex < data.length) dark = (((data[byteIndex] >>> bitIndex) & 1) == 1);
            if (QRUtil.getMask(maskPattern, row, col - c)) dark = !dark;
            this.modules[row][col - c] = dark;
            bitIndex--;
            if (bitIndex == -1) { byteIndex++; bitIndex = 7; }
          }
        }
        row += inc;
        if (row < 0 || this.moduleCount <= row) { row -= inc; inc = -inc; break; }
      }
    }
  }
}
QRCodeModel.createData = function(typeNumber, errorCorrectLevel, dataList) {
  const rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectLevel);
  const buffer = new QRBitBuffer();
  for (let i = 0; i < dataList.length; i++) {
    const data = dataList[i];
    buffer.put(data.mode, 4);
    buffer.put(data.getLength(), QRUtil.getLengthInBits(data.mode, typeNumber));
    data.write(buffer);
  }
  let totalDataCount = 0;
  for (let i = 0; i < rsBlocks.length; i++) totalDataCount += rsBlocks[i].dataCount;
  if (buffer.getLengthInBits() > totalDataCount * 8) throw new Error("QR payload excede capacidad.");
  if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) buffer.put(0, 4);
  while (buffer.getLengthInBits() % 8 != 0) buffer.putBit(false);
  while (true) {
    if (buffer.getLengthInBits() >= totalDataCount * 8) break;
    buffer.put(0xEC, 8);
    if (buffer.getLengthInBits() >= totalDataCount * 8) break;
    buffer.put(0x11, 8);
  }
  return QRCodeModel.createBytes(buffer, rsBlocks);
};
QRCodeModel.createBytes = function(buffer, rsBlocks) {
  let offset = 0, maxDcCount = 0, maxEcCount = 0;
  const dcdata = new Array(rsBlocks.length), ecdata = new Array(rsBlocks.length);
  for (let r = 0; r < rsBlocks.length; r++) {
    const dcCount = rsBlocks[r].dataCount, ecCount = rsBlocks[r].totalCount - dcCount;
    maxDcCount = Math.max(maxDcCount, dcCount);
    maxEcCount = Math.max(maxEcCount, ecCount);
    dcdata[r] = new Array(dcCount);
    for (let i = 0; i < dcdata[r].length; i++) dcdata[r][i] = 0xff & buffer.buffer[i + offset];
    offset += dcCount;
    const rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
    const rawPoly = new QRPolynomial(dcdata[r], rsPoly.getLength() - 1);
    const modPoly = rawPoly.mod(rsPoly);
    ecdata[r] = new Array(rsPoly.getLength() - 1);
    for (let i = 0; i < ecdata[r].length; i++) {
      const modIndex = i + modPoly.getLength() - ecdata[r].length;
      ecdata[r][i] = (modIndex >= 0) ? modPoly.get(modIndex) : 0;
    }
  }
  let totalCodeCount = 0;
  for (let i = 0; i < rsBlocks.length; i++) totalCodeCount += rsBlocks[i].totalCount;
  const data = new Array(totalCodeCount);
  let index = 0;
  for (let i = 0; i < maxDcCount; i++) {
    for (let r = 0; r < rsBlocks.length; r++) {
      if (i < dcdata[r].length) data[index++] = dcdata[r][i];
    }
  }
  for (let i = 0; i < maxEcCount; i++) {
    for (let r = 0; r < rsBlocks.length; r++) {
      if (i < ecdata[r].length) data[index++] = ecdata[r][i];
    }
  }
  return data;
};
class QR8bitByte {
  constructor(data) {
    this.mode = 4;
    this.data = data;
    this.parsedData = [];
    for (let i = 0; i < this.data.length; i++) {
      let code = this.data.charCodeAt(i);
      if (code < 0x80) this.parsedData.push(code);
      else if (code < 0x800) this.parsedData.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
      else if (code < 0xd800 || code >= 0xe000) this.parsedData.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
      else {
        i++;
        code = 0x10000 + (((code & 0x3ff) << 10) | (this.data.charCodeAt(i) & 0x3ff));
        this.parsedData.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
      }
    }
  }
  getLength() { return this.parsedData.length; }
  write(buffer) {
    for (let i = 0; i < this.parsedData.length; i++) buffer.put(this.parsedData[i], 8);
  }
}
class QRPolynomial {
  constructor(num, shift) {
    let offset = 0;
    while (offset < num.length && num[offset] == 0) offset++;
    this.num = new Array(num.length - offset + shift);
    for (let i = 0; i < num.length - offset; i++) this.num[i] = num[i + offset];
  }
  get(index) { return this.num[index]; }
  getLength() { return this.num.length; }
  multiply(e) {
    const num = new Array(this.getLength() + e.getLength() - 1);
    for (let i = 0; i < this.getLength(); i++) {
      for (let j = 0; j < e.getLength(); j++) num[i + j] ^= QRMath.gexp(QRMath.glog(this.get(i)) + QRMath.glog(e.get(j)));
    }
    return new QRPolynomial(num, 0);
  }
  mod(e) {
    if (this.getLength() - e.getLength() < 0) return this;
    const ratio = QRMath.glog(this.get(0)) - QRMath.glog(e.get(0));
    const num = new Array(this.getLength());
    for (let i = 0; i < this.getLength(); i++) num[i] = this.get(i);
    for (let i = 0; i < e.getLength(); i++) num[i] ^= QRMath.gexp(QRMath.glog(e.get(i)) + ratio);
    return new QRPolynomial(num, 0).mod(e);
  }
}
class QRRSBlock {
  constructor(totalCount, dataCount) { this.totalCount = totalCount; this.dataCount = dataCount; }
}
QRRSBlock.RS_BLOCK_TABLE = [
  [1, 26, 19], [1, 26, 16], [1, 26, 13], [1, 26, 9],
  [1, 44, 34], [1, 44, 28], [1, 44, 22], [1, 44, 16],
  [1, 70, 55], [1, 70, 44], [2, 35, 17], [2, 35, 13],
  [1, 100, 80], [2, 50, 32], [2, 50, 24], [4, 25, 9],
  [1, 134, 108], [2, 67, 43], [2, 33, 15, 2, 34, 16], [2, 33, 11, 2, 34, 12],
  [2, 86, 68], [4, 43, 27], [4, 43, 19], [4, 43, 15],
  [2, 98, 78], [4, 49, 31], [2, 32, 14, 4, 33, 15], [4, 39, 13, 1, 40, 14],
  [2, 121, 97], [2, 60, 38, 2, 61, 39], [4, 40, 18, 2, 41, 19], [4, 40, 14, 2, 41, 15],
  [2, 146, 116], [3, 58, 36, 2, 59, 37], [4, 36, 16, 4, 37, 17], [4, 36, 12, 4, 37, 13],
  [2, 86, 68, 2, 87, 69], [4, 69, 43, 1, 70, 44], [6, 43, 19, 2, 44, 20], [6, 43, 15, 2, 44, 16],
  [4, 101, 81], [1, 80, 50, 4, 81, 51], [4, 50, 22, 4, 51, 23], [3, 36, 12, 8, 37, 13],
  [2, 116, 92, 2, 117, 93], [6, 58, 36, 2, 59, 37], [4, 46, 20, 6, 47, 21], [7, 42, 14, 4, 43, 15],
  [4, 133, 107], [8, 59, 37, 1, 60, 38], [8, 44, 20, 4, 45, 21], [12, 33, 11, 4, 34, 12],
  [3, 145, 115, 1, 146, 116], [4, 64, 40, 5, 65, 41], [11, 36, 16, 5, 37, 17], [11, 36, 12, 5, 37, 13]
];
QRRSBlock.getRSBlocks = function(typeNumber, errorCorrectLevel) {
  const rsBlock = QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + errorCorrectLevel];
  const length = rsBlock.length / 3, list = [];
  for (let i = 0; i < length; i++) {
    const count = rsBlock[i * 3 + 0], totalCount = rsBlock[i * 3 + 1], dataCount = rsBlock[i * 3 + 2];
    for (let j = 0; j < count; j++) list.push(new QRRSBlock(totalCount, dataCount));
  }
  return list;
};
class QRBitBuffer {
  constructor() { this.buffer = []; this.length = 0; }
  put(num, length) { for (let i = 0; i < length; i++) this.putBit(((num >>> (length - i - 1)) & 1) == 1); }
  getLengthInBits() { return this.length; }
  putBit(bit) {
    const bufIndex = Math.floor(this.length / 8);
    if (this.buffer.length <= bufIndex) this.buffer.push(0);
    if (bit) this.buffer[bufIndex] |= (0x80 >>> (this.length % 8));
    this.length++;
  }
}
const QRMath = {
  glog: (n) => QRMath.LOG_TABLE[n],
  gexp: (n) => { while (n < 0) n += 255; while (n >= 255) n -= 255; return QRMath.EXP_TABLE[n]; },
  EXP_TABLE: new Array(256),
  LOG_TABLE: new Array(256)
};
for (let i = 0; i < 8; i++) QRMath.EXP_TABLE[i] = 1 << i;
for (let i = 8; i < 256; i++) QRMath.EXP_TABLE[i] = QRMath.EXP_TABLE[i - 4] ^ QRMath.EXP_TABLE[i - 5] ^ QRMath.EXP_TABLE[i - 6] ^ QRMath.EXP_TABLE[i - 8];
for (let i = 0; i < 255; i++) QRMath.LOG_TABLE[QRMath.EXP_TABLE[i]] = i;

const QRUtil = {
  PATTERN_POSITION_TABLE: [
    [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
    [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50], [6, 30, 54],
    [6, 32, 58], [6, 34, 62], [6, 26, 46, 66]
  ],
  G15: (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0),
  G18: (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0),
  G15_MASK: (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1),
  getBCHTypeInfo: (data) => {
    let d = data << 10;
    while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15) >= 0) d ^= (QRUtil.G15 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15)));
    return ((data << 10) | d) ^ QRUtil.G15_MASK;
  },
  getBCHTypeNumber: (data) => {
    let d = data << 12;
    while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18) >= 0) d ^= (QRUtil.G18 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18)));
    return (data << 12) | d;
  },
  getBCHDigit: (data) => { let digit = 0; while (data != 0) { digit++; data >>>= 1; } return digit; },
  getPatternPosition: (typeNumber) => QRUtil.PATTERN_POSITION_TABLE[typeNumber - 1] || [],
  getMask: (maskPattern, i, j) => {
    switch (maskPattern) {
      case 0: return (i + j) % 2 == 0;
      case 1: return i % 2 == 0;
      case 2: return j % 3 == 0;
      case 3: return (i + j) % 3 == 0;
      case 4: return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 == 0;
      case 5: return (i * j) % 2 + (i * j) % 3 == 0;
      case 6: return ((i * j) % 2 + (i * j) % 3) % 2 == 0;
      case 7: return ((i * j) % 3 + (i + j) % 2) % 2 == 0;
      default: return false;
    }
  },
  getErrorCorrectPolynomial: (len) => {
    let a = new QRPolynomial([1], 0);
    for (let i = 0; i < len; i++) a = a.multiply(new QRPolynomial([1, QRMath.gexp(i)], 0));
    return a;
  },
  getLengthInBits: (mode, type) => (type < 10 ? 8 : 16),
  getLostPoint: (qrCode) => {
    const mc = qrCode.getModuleCount();
    let lost = 0;
    for (let r = 0; r < mc; r++) {
      for (let c = 0; c < mc; c++) {
        let same = 0, dark = qrCode.isDark(r, c);
        for (let dr = -1; dr <= 1; dr++) {
          if (r + dr < 0 || mc <= r + dr) continue;
          for (let dc = -1; dc <= 1; dc++) {
            if (c + dc < 0 || mc <= c + dc || (dr == 0 && dc == 0)) continue;
            if (dark == qrCode.isDark(r + dr, c + dc)) same++;
          }
        }
        if (same > 5) lost += (3 + same - 5);
      }
    }
    return lost;
  }
};

function generateQRMatrix(text, errorCorrection = 'M') {
  const ecMap = { L: 1, M: 0, Q: 3, H: 2 };
  const ec = ecMap[errorCorrection] !== undefined ? ecMap[errorCorrection] : 0;
  const qr = new QRCodeModel(0, ec);
  qr.addData(text);
  qr.make();
  const count = qr.getModuleCount();
  const matrix = [];
  for (let r = 0; r < count; r++) {
    const row = [];
    for (let c = 0; c < count; c++) row.push(qr.isDark(r, c));
    matrix.push(row);
  }
  return { size: count, matrix };
}

// ── Formateador vCard 3.0 estándar ──────────────────────────────────────────
// Escapado RFC 2426: sin esto, un nombre/cargo con coma o punto y coma rompe
// el parseo del vCard en la app de contactos del teléfono.
function vEsc(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

function formatVCard(card) {
  const lines = ['BEGIN:VCARD', 'VERSION:3.0'];
  const rawName = (card.name || 'Contacto').trim();
  const parts = rawName.split(/\s+/);
  const lastName = parts.length > 1 ? parts.slice(1).join(' ') : '';
  const firstName = parts[0] || '';

  lines.push(`N:${vEsc(lastName)};${vEsc(firstName)};;;`);
  lines.push(`FN:${vEsc(rawName)}`);
  if (card.company) {
    lines.push(`ORG:${vEsc(card.company)}${card.department ? ';' + vEsc(card.department) : ''}`);
  }
  if (card.title) lines.push(`TITLE:${vEsc(card.title)}`);
  if (card.phoneMobile) lines.push(`TEL;TYPE=CELL,VOICE:${vEsc(card.phoneMobile)}`);
  if (card.phoneOffice) lines.push(`TEL;TYPE=WORK,VOICE:${vEsc(card.phoneOffice)}`);
  if (card.email) lines.push(`EMAIL;TYPE=WORK,INTERNET:${vEsc(card.email)}`);
  if (card.website) lines.push(`URL:${vEsc(card.website)}`);
  if (card.address) lines.push(`ADR;TYPE=WORK:;;${vEsc(card.address)};;;;`);
  if (card.bio) lines.push(`NOTE:${vEsc(card.bio)}`);
  if (card.linkedin) lines.push(`X-SOCIAL-LINKEDIN:${vEsc(card.linkedin)}`);
  lines.push('END:VCARD');
  return lines.join('\r\n');
}

// ── Paletas predefinidas de Kimos ───────────────────────────────────────────
const THEME_PALETTES = {
  kimos: {
    id: 'kimos',
    name: 'Kimos Teal',
    bg: '#FFFFFF',
    accent: '#19ACB1',
    text: '#0F172A',
    textMuted: '#64748B',
    cardBg: '#F8FAFC',
    border: '#E2E8F0',
    qrBg: '#FFFFFF',
    qrColor: '#0F172A'
  },
  slate: {
    id: 'slate',
    name: 'Slate Ejecutivo',
    bg: '#F8FAFC',
    accent: '#2563EB',
    text: '#0F172A',
    textMuted: '#64748B',
    cardBg: '#FFFFFF',
    border: '#CBD5E1',
    qrBg: '#FFFFFF',
    qrColor: '#0F172A'
  },
  midnight: {
    id: 'midnight',
    name: 'Midnight Dark',
    bg: '#0F172A',
    accent: '#06B6D4',
    text: '#F8FAFC',
    textMuted: '#94A3B8',
    cardBg: '#1E293B',
    border: '#334155',
    qrBg: '#FFFFFF',
    qrColor: '#0F172A'
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald Pro',
    bg: '#FFFFFF',
    accent: '#059669',
    text: '#064E3B',
    textMuted: '#64748B',
    cardBg: '#F0FDF4',
    border: '#BBF7D0',
    qrBg: '#FFFFFF',
    qrColor: '#064E3B'
  },
  indigo: {
    id: 'indigo',
    name: 'Royal Indigo',
    bg: '#FFFFFF',
    accent: '#4F46E5',
    text: '#1E1B4B',
    textMuted: '#64748B',
    cardBg: '#EEF2FF',
    border: '#C7D2FE',
    qrBg: '#FFFFFF',
    qrColor: '#1E1B4B'
  },
  dualtone: {
    id: 'dualtone',
    name: 'Bicolor Kimos',
    bg: '#0F172A',
    accent: '#19ACB1',
    text: '#F8FAFC',
    textMuted: '#94A3B8',
    cardBg: '#1E293B',
    border: '#334155',
    qrBg: '#FFFFFF',
    qrColor: '#0F172A'
  }
};

function getCardPalette(card) {
  if (card.theme === 'custom' && card.customColors) {
    return {
      bg: card.customColors.bg || '#FFFFFF',
      accent: card.customColors.accent || '#19ACB1',
      text: card.customColors.text || '#0F172A',
      textMuted: card.customColors.textMuted || '#64748B',
      cardBg: card.customColors.cardBg || '#F8FAFC',
      border: '#E2E8F0',
      qrBg: '#FFFFFF',
      qrColor: '#0F172A'
    };
  }
  return THEME_PALETTES[card.theme] || THEME_PALETTES.kimos;
}

// ── Función de carga de imágenes a Image() ──────────────────────────────────
function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Dibuja la imagen recortada tipo "cover" (llena el destino sin deformarse). */
function drawImageCover(ctx, img, x, y, w, h) {
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  const scale = Math.max(w / iw, h / ih);
  const sw = w / scale, sh = h / scale;
  ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h);
}

/** Dibuja la imagen completa tipo "contain", centrada en la caja (para logos). */
function drawImageContain(ctx, img, x, y, w, h) {
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  const scale = Math.min(w / iw, h / ih);
  const dw = iw * scale, dh = ih * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

// ── Estilos de visualización de foto y logo (v1.2.0) ────────────────────────
const DEFAULT_PHOTO_STYLE = {
  visible: true,
  shape: 'circle',   // 'circle' | 'rounded' | 'square'
  size: 1,           // 0.7 – 1.25 (multiplicador del tamaño base del layout)
  zoom: 1,           // 1 – 3 (recorte: acerca la foto dentro del marco)
  offsetX: 0,        // -1 – 1 (encuadre horizontal del recorte)
  offsetY: 0,        // -1 – 1 (encuadre vertical del recorte)
  ring: true         // anillo con el color de acento
};

const DEFAULT_LOGO_STYLE = {
  visible: true,
  size: 1,           // 0.6 – 1.5 (multiplicador de la caja base del layout)
  opacity: 1,        // 0.2 – 1
  plate: 'none'      // 'none' | 'white' | 'accent' (placa de fondo)
};

const clampNum = (v, min, max, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

/** Estilo de foto normalizado (tolera tarjetas guardadas por versiones previas). */
function getPhotoStyle(card) {
  const st = { ...DEFAULT_PHOTO_STYLE, ...((card && card.photoStyle) || {}) };
  st.visible = st.visible !== false;
  st.shape = ['circle', 'rounded', 'square'].includes(st.shape) ? st.shape : 'circle';
  st.size = clampNum(st.size, 0.7, 1.25, 1);
  st.zoom = clampNum(st.zoom, 1, 3, 1);
  st.offsetX = clampNum(st.offsetX, -1, 1, 0);
  st.offsetY = clampNum(st.offsetY, -1, 1, 0);
  st.ring = st.ring !== false;
  return st;
}

/** Estilo de logo normalizado. */
function getLogoStyle(card) {
  const st = { ...DEFAULT_LOGO_STYLE, ...((card && card.logoStyle) || {}) };
  st.visible = st.visible !== false;
  st.size = clampNum(st.size, 0.6, 1.5, 1);
  st.opacity = clampNum(st.opacity, 0.2, 1, 1);
  st.plate = ['none', 'white', 'accent'].includes(st.plate) ? st.plate : 'none';
  return st;
}

/** Traza el contorno de la forma elegida para la foto (círculo/redondeado/cuadrado). */
function pathPhotoShape(ctx, shape, x, y, w, h) {
  ctx.beginPath();
  if (shape === 'square') {
    ctx.rect(x, y, w, h);
  } else if (shape === 'rounded') {
    const r = Math.min(w, h) * 0.18;
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  } else {
    ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
    ctx.closePath();
  }
}

/** Cover con zoom y encuadre: acerca la foto y desplaza la ventana de recorte. */
function drawImageCoverZoom(ctx, img, x, y, w, h, zoom, offsetX, offsetY) {
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  const scale = Math.max(w / iw, h / ih) * (zoom || 1);
  const sw = w / scale, sh = h / scale;
  const maxX = iw - sw, maxY = ih - sh;
  const sx = Math.min(maxX, Math.max(0, maxX / 2 + (offsetX || 0) * (maxX / 2)));
  const sy = Math.min(maxY, Math.max(0, maxY / 2 + (offsetY || 0) * (maxY / 2)));
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

/**
 * Dibuja la foto de la persona centrada en (cx, cy) con el estilo de la tarjeta:
 * forma, tamaño, zoom/encuadre del recorte y anillo. Sin foto, dibuja las
 * iniciales sobre el color de acento. Con `visible: false` no dibuja nada.
 */
function drawPersonPhoto(ctx, card, photoImg, cx, cy, baseRadius, pal) {
  const st = getPhotoStyle(card);
  if (!st.visible) return;
  const r = baseRadius * st.size;
  const x = cx - r, y = cy - r, size = r * 2;

  if (photoImg) {
    ctx.save();
    pathPhotoShape(ctx, st.shape, x, y, size, size);
    ctx.clip();
    drawImageCoverZoom(ctx, photoImg, x, y, size, size, st.zoom, st.offsetX, st.offsetY);
    ctx.restore();
    if (st.ring) {
      pathPhotoShape(ctx, st.shape, x, y, size, size);
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = 4;
      ctx.stroke();
    }
  } else {
    pathPhotoShape(ctx, st.shape, x, y, size, size);
    ctx.fillStyle = pal.accent;
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${Math.round(r * 0.56)}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const initials = (card.name || 'K').split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
    ctx.fillText(initials || 'K', cx, cy);
    ctx.textBaseline = 'alphabetic';
  }
}

/**
 * Dibuja el logo dentro de la caja base del layout aplicando el estilo de la
 * tarjeta (tamaño, opacidad, placa de fondo). Devuelve true si dibujó el logo;
 * false si no hay logo o está oculto (el caller decide el texto de respaldo).
 */
function drawBrandLogo(ctx, card, logoImg, x, y, w, h, pal) {
  const st = getLogoStyle(card);
  if (!logoImg || !st.visible) return false;
  const cx = x + w / 2, cy = y + h / 2;
  const bw = w * st.size, bh = h * st.size;
  const bx = cx - bw / 2, by = cy - bh / 2;

  if (st.plate !== 'none') {
    const pad = Math.min(bw, bh) * 0.14;
    ctx.save();
    pathPhotoShape(ctx, 'rounded', bx - pad, by - pad, bw + pad * 2, bh + pad * 2);
    ctx.fillStyle = st.plate === 'accent' ? pal.accent : '#FFFFFF';
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.globalAlpha = st.opacity;
  drawImageContain(ctx, logoImg, bx, by, bw, bh);
  ctx.restore();
  return true;
}

// ── Renderizador en Canvas 2D de Alta Fidelidad ─────────────────────────────
async function renderCardToCanvas(card, scale = 2, targetCanvas = null) {
  const isVert = card.format === 'vertical';
  const width = isVert ? 600 : 1050;
  const height = isVert ? 950 : 600;

  const canvas = targetCanvas || document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);

  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.scale(scale, scale);

  const pal = getCardPalette(card);
  const [photoImg, logoImg] = await Promise.all([
    loadImage(card.photoUrl),
    loadImage(card.logoUrl)
  ]);

  // Fondo principal plano
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, width, height);

  // Determinar texto QR
  let qrPayload = formatVCard(card);
  if (card.qrType === 'url' && card.website) {
    qrPayload = card.website;
  }

  let qrData;
  try {
    qrData = generateQRMatrix(qrPayload, 'M');
  } catch (e) {
    qrData = generateQRMatrix('https://kimos.io', 'M');
  }

  const style = card.style || 'modern-split';

  if (!isVert) {
    // ═══════════════════════ FORMATO HORIZONTAL (1050 x 600) ═══════════════════════
    if (style === 'modern-split' || style === 'dualtone') {
      // Banda lateral izquierda con acento
      ctx.fillStyle = pal.cardBg;
      ctx.fillRect(0, 0, 340, height);

      // Línea de acento
      ctx.fillStyle = pal.accent;
      ctx.fillRect(336, 0, 4, height);

      // Foto en la banda izquierda (forma, tamaño, zoom y encuadre según estilo)
      const photoCenterX = 170;
      const photoCenterY = 150;
      drawPersonPhoto(ctx, card, photoImg, photoCenterX, photoCenterY, 64, pal);

      // Logo en la barra izquierda si existe y está visible
      if (!drawBrandLogo(ctx, card, logoImg, photoCenterX - 70, 250, 140, 60, pal) && card.company) {
        ctx.fillStyle = pal.text;
        ctx.font = 'bold 18px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(card.company, photoCenterX, 280);
      }

      // QR Code en la esquina inferior izquierda
      drawQRBox(ctx, qrData, 85, 370, 170, 170, pal, 'ESCANEAR CONTACTO');

      // ── Contenido Principal Derecho ──
      const rightX = 390;
      let curY = 100;

      // Nombre completo
      ctx.fillStyle = pal.text;
      ctx.font = 'bold 38px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(card.name || 'Nombre y Apellidos', rightX, curY);
      curY += 34;

      // Cargo / Puesto
      ctx.fillStyle = pal.accent;
      ctx.font = '600 20px Inter, sans-serif';
      ctx.fillText((card.title || 'Cargo / Puesto').toUpperCase(), rightX, curY);
      curY += 26;

      // Empresa y Departamento
      if (card.company || card.department) {
        ctx.fillStyle = pal.textMuted;
        ctx.font = '500 17px Inter, sans-serif';
        const compText = [card.company, card.department].filter(Boolean).join(' • ');
        ctx.fillText(compText, rightX, curY);
        curY += 24;
      }

      // Línea divisoria horizontal elegante
      curY += 10;
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(rightX, curY);
      ctx.lineTo(rightX + 160, curY);
      ctx.stroke();
      curY += 35;

      // Filas de Contacto
      const contactItems = [];
      if (card.phoneMobile) contactItems.push({ icon: '📞', text: card.phoneMobile, label: 'Móvil' });
      if (card.phoneOffice) contactItems.push({ icon: '🏢', text: card.phoneOffice, label: 'Oficina' });
      if (card.email) contactItems.push({ icon: '✉️', text: card.email, label: 'Email' });
      if (card.website) contactItems.push({ icon: '🌐', text: card.website.replace(/^https?:\/\//, ''), label: 'Web' });
      if (card.address) contactItems.push({ icon: '📍', text: card.address, label: 'Ubicación' });
      if (card.linkedin) contactItems.push({ icon: '💼', text: card.linkedin.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, 'in/'), label: 'LinkedIn' });

      for (const item of contactItems.slice(0, 5)) {
        ctx.fillStyle = pal.accent;
        ctx.font = '18px sans-serif';
        ctx.fillText(item.icon, rightX, curY);

        ctx.fillStyle = pal.text;
        ctx.font = '500 16px Inter, sans-serif';
        ctx.fillText(item.text, rightX + 32, curY);
        curY += 36;
      }
    } else {
      // Estilo Minimal Clean / Corporate
      // Barra superior sutil de acento
      ctx.fillStyle = pal.accent;
      ctx.fillRect(0, 0, width, 8);

      // Logo o Avatar en la esquina superior izquierda
      let leftX = 70;
      let headerY = 70;

      drawBrandLogo(ctx, card, logoImg, leftX, headerY, 180, 70, pal);

      // Foto en la esquina superior derecha (con estilo configurable)
      drawPersonPhoto(ctx, card, photoImg, width - 130, 120, 50, pal);

      let curY = 200;
      ctx.fillStyle = pal.text;
      ctx.font = 'bold 40px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(card.name || 'Nombre y Apellidos', leftX, curY);
      curY += 34;

      ctx.fillStyle = pal.accent;
      ctx.font = '600 22px Inter, sans-serif';
      ctx.fillText((card.title || 'Cargo profesional').toUpperCase(), leftX, curY);
      curY += 28;

      if (card.company) {
        ctx.fillStyle = pal.textMuted;
        ctx.font = '500 18px Inter, sans-serif';
        ctx.fillText(card.company + (card.department ? ' | ' + card.department : ''), leftX, curY);
        curY += 32;
      }

      // Contactos
      const contactItems = [];
      if (card.phoneMobile) contactItems.push({ icon: '📞', text: card.phoneMobile });
      if (card.email) contactItems.push({ icon: '✉️', text: card.email });
      if (card.website) contactItems.push({ icon: '🌐', text: card.website.replace(/^https?:\/\//, '') });
      if (card.address) contactItems.push({ icon: '📍', text: card.address });

      for (const item of contactItems) {
        ctx.fillStyle = pal.accent;
        ctx.font = '18px sans-serif';
        ctx.fillText(item.icon, leftX, curY);

        ctx.fillStyle = pal.text;
        ctx.font = '500 17px Inter, sans-serif';
        ctx.fillText(item.text, leftX + 30, curY);
        curY += 34;
      }

      // QR Code a la derecha
      drawQRBox(ctx, qrData, width - 260, 310, 190, 190, pal, 'ESCANEAR CONTACTO');
    }
  } else {
    // ═══════════════════════ FORMATO VERTICAL (600 x 950) ═══════════════════════
    // Cabecera superior
    ctx.fillStyle = pal.cardBg;
    ctx.fillRect(0, 0, width, 320);

    // Banda decorativa de acento
    ctx.fillStyle = pal.accent;
    ctx.fillRect(0, 316, width, 4);

    // Logo arriba (según estilo; sin logo visible, nombre de la empresa)
    if (!drawBrandLogo(ctx, card, logoImg, (width - 160) / 2, 40, 160, 60, pal) && card.company) {
      ctx.fillStyle = pal.textMuted;
      ctx.font = 'bold 18px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(card.company.toUpperCase(), width / 2, 60);
    }

    // Avatar centrado en la cabecera (forma, tamaño, zoom y encuadre según estilo)
    drawPersonPhoto(ctx, card, photoImg, width / 2, 200, 75, pal);

    // Nombre y Cargo centrados
    let curY = 370;
    ctx.fillStyle = pal.text;
    ctx.font = 'bold 32px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(card.name || 'Nombre y Apellidos', width / 2, curY);
    curY += 28;

    ctx.fillStyle = pal.accent;
    ctx.font = '600 17px Inter, sans-serif';
    ctx.fillText((card.title || 'Cargo profesional').toUpperCase(), width / 2, curY);
    curY += 24;

    if (card.company) {
      ctx.fillStyle = pal.textMuted;
      ctx.font = '500 15px Inter, sans-serif';
      ctx.fillText(card.company + (card.department ? ' • ' + card.department : ''), width / 2, curY);
    }

    // Separador
    curY += 20;
    ctx.strokeStyle = pal.border || '#E2E8F0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(80, curY);
    ctx.lineTo(width - 80, curY);
    ctx.stroke();
    curY += 35;

    // Lista de Contacto alineada a la izquierda con margen
    const contactLeft = 90;
    const contactItems = [];
    if (card.phoneMobile) contactItems.push({ icon: '📞', text: card.phoneMobile });
    if (card.email) contactItems.push({ icon: '✉️', text: card.email });
    if (card.website) contactItems.push({ icon: '🌐', text: card.website.replace(/^https?:\/\//, '') });
    if (card.address) contactItems.push({ icon: '📍', text: card.address });
    if (card.linkedin) contactItems.push({ icon: '💼', text: card.linkedin.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, 'in/') });

    for (const item of contactItems.slice(0, 4)) {
      ctx.fillStyle = pal.accent;
      ctx.font = '18px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(item.icon, contactLeft, curY);

      ctx.fillStyle = pal.text;
      ctx.font = '500 16px Inter, sans-serif';
      ctx.fillText(item.text, contactLeft + 30, curY);
      curY += 32;
    }

    // QR Code centrado abajo
    const qrBoxSize = 190;
    drawQRBox(ctx, qrData, (width - qrBoxSize) / 2, 690, qrBoxSize, qrBoxSize, pal, 'ESCANEAR CONTACTO');
  }

  ctx.restore();
  return canvas;
}

// ── Dibuja caja QR limpia con marco ─────────────────────────────────────────
function drawQRBox(ctx, qrData, x, y, w, h, pal, labelText) {
  // Fondo de la caja QR
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  const rad = 10;
  ctx.roundRect ? ctx.roundRect(x, y, w, h, rad) : ctx.rect(x, y, w, h);
  ctx.fill();
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Matriz QR
  const margin = 14;
  const qrInnerSize = w - (margin * 2);
  const cellSize = qrInnerSize / qrData.size;

  ctx.fillStyle = pal.qrColor || '#0F172A';
  for (let r = 0; r < qrData.size; r++) {
    for (let c = 0; c < qrData.size; c++) {
      if (qrData.matrix[r][c]) {
        ctx.fillRect(
          Math.round(x + margin + (c * cellSize)),
          Math.round(y + margin + (r * cellSize)),
          Math.ceil(cellSize),
          Math.ceil(cellSize)
        );
      }
    }
  }

  // Label inferior
  if (labelText) {
    ctx.fillStyle = '#64748B';
    ctx.font = 'bold 9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(labelText, x + (w / 2), y + h + 16);
  }
}

// ── Plantilla de tarjeta por defecto ────────────────────────────────────────
function createDefaultCard(name = '', title = '', company = '') {
  return {
    id: 'card_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    name,
    title,
    company,
    department: '',
    phoneMobile: '',
    phoneOffice: '',
    email: '',
    website: '',
    address: '',
    linkedin: '',
    bio: '',
    photoUrl: '',
    logoUrl: '',
    memberId: '',
    photoStyle: { ...DEFAULT_PHOTO_STYLE },
    logoStyle: { ...DEFAULT_LOGO_STYLE },
    format: 'horizontal',
    theme: 'kimos',
    customColors: {
      bg: '#FFFFFF',
      accent: '#19ACB1',
      text: '#0F172A',
      textMuted: '#64748B',
      cardBg: '#F8FAFC'
    },
    style: 'modern-split',
    qrType: 'vcard',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

// ── Export default mount(shell) ─────────────────────────────────────────────
export default function mount(shell) {
  const React = globalThis.React;
  if (!React || typeof React.createElement !== 'function') {
    throw new Error('globalThis.React no disponible: el host de KIMOS debe exponer React.');
  }
  const h = React.createElement;
  const { useState, useEffect, useRef } = React;

  // Estado por instancia
  let model = {
    cards: [createDefaultCard()],
    selectedCardId: null,
    exportScale: 2,
    // Identidad de marca de la colección: se aplica a las tarjetas generadas
    // desde los usuarios del sistema (y a todas con "Aplicar a todas").
    brand: { company: '', website: '', logoUrl: '' }
  };
  model.selectedCardId = model.cards[0].id;

  // Directorio de usuarios reales del sistema KIMOS. No se persiste con
  // saveData: se refresca desde /api/identity en cada montaje.
  const directory = { members: [], me: null, loaded: false, loading: false, error: '' };

  const listeners = new Set();
  const emit = () => {
    const snap = { ...model, directory: { ...directory, members: directory.members.slice() } };
    for (const listener of listeners) listener(snap);
  };

  let saveTimer = null;
  const scheduleSave = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (shell && typeof shell.saveData === 'function') {
        shell.saveData(model).catch(() => {});
      }
    }, 600);
  };

  const commit = (next) => {
    model = { ...model, ...next };
    emit();
    scheduleSave();
  };

  // ── Usuarios reales del sistema KIMOS (/api/identity) ─────────────────────
  const req = (url, init) => (shell && typeof shell.authFetch === 'function' ? shell.authFetch(url, init) : fetch(url, init));
  const str = (v) => (v == null ? '' : String(v));

  // Proyección de un actor de /api/identity a lo que necesita una tarjeta:
  // `description` es el campo "Cargo" de la app Perfil de KIMOS.
  const memberFromActor = (a) => ({
    id: str(a.id || a.email),
    name: str(a.displayName || a.name || a.email || a.id),
    title: str(a.description),
    email: str(a.email),
    phone: str(a.phone),
    location: str(a.location),
    bio: str(a.bio),
    photoUrl: str(a.photoUrl)
  });

  const isPristineCard = (c) => !c.name && !c.email && !c.memberId && !c.photoUrl;

  let savedResolved = false;
  let sawSavedData = false;

  // Si la instancia es nueva (sin datos guardados), la primera tarjeta se
  // siembra con el perfil real del usuario conectado en lugar de datos de ejemplo.
  function maybeSeedFromMe() {
    if (!savedResolved || sawSavedData || !directory.me) return;
    if (model.cards.length !== 1 || !isPristineCard(model.cards[0])) return;
    const card = cardFromMember(directory.me);
    commit({ cards: [card], selectedCardId: card.id });
  }

  async function loadMembers() {
    if (directory.loading) return;
    directory.loading = true;
    directory.error = '';
    emit();
    try {
      const res = await req('/api/identity/actors', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      directory.members = (data.actors || [])
        .filter((a) => a && (a.type || 'human') === 'human' && a.active !== false)
        .map(memberFromActor)
        .sort((x, y) => x.name.localeCompare(y.name, 'es'));
      directory.loaded = true;
    } catch (e) {
      directory.error = 'No se pudo cargar la lista de usuarios del sistema.';
    }
    try {
      const res = await req('/api/identity/me', { cache: 'no-store' });
      if (res.ok) {
        const me = memberFromActor(await res.json());
        // /me puede venir sin los campos de perfil: completar desde el directorio.
        const full = directory.members.find((m) => m.id === me.id || (me.email && m.email === me.email));
        directory.me = full || me;
      }
    } catch (e) { /* opcional */ }
    directory.loading = false;
    emit();
    maybeSeedFromMe();
  }

  /** Crea una tarjeta a partir de un usuario real, aplicando la marca. */
  function cardFromMember(m) {
    const brand = model.brand || {};
    const card = createDefaultCard(m.name, m.title, brand.company || '');
    card.memberId = m.id;
    card.email = m.email;
    card.phoneMobile = m.phone;
    card.address = m.location;
    card.bio = m.bio;
    card.photoUrl = m.photoUrl;
    card.logoUrl = brand.logoUrl || '';
    card.website = brand.website || '';
    return card;
  }

  /** Genera tarjetas para los usuarios indicados (o todos). Omite los que ya tienen. */
  function generateCardsForMembers(ids) {
    const wanted = Array.isArray(ids) && ids.length
      ? directory.members.filter((m) => ids.includes(m.id))
      : directory.members;
    const created = [];
    const skipped = [];
    let cards = model.cards;
    for (const m of wanted) {
      const exists = cards.some((c) =>
        (c.memberId && c.memberId === m.id) ||
        (m.email && c.email && c.email.toLowerCase() === m.email.toLowerCase()));
      if (exists) { skipped.push(m.name); continue; }
      const card = cardFromMember(m);
      cards = [...cards, card];
      created.push(card);
    }
    if (created.length) {
      const nonEmpty = cards.filter((c) => !isPristineCard(c));
      commit({
        cards: nonEmpty.length ? nonEmpty : cards,
        selectedCardId: created[created.length - 1].id
      });
    }
    return { created, skipped };
  }

  /** Aplica el logo/empresa de la marca a todas las tarjetas existentes. */
  function applyBrandToCards() {
    const brand = model.brand || {};
    const cards = model.cards.map((c) => ({
      ...c,
      company: brand.company || c.company,
      logoUrl: brand.logoUrl || c.logoUrl,
      website: c.website || brand.website || '',
      updatedAt: new Date().toISOString()
    }));
    commit({ cards });
  }

  // Carga inicial
  if (shell && typeof shell.loadData === 'function') {
    shell.loadData().then((saved) => {
      savedResolved = true;
      if (saved && Array.isArray(saved.cards) && saved.cards.length > 0) {
        sawSavedData = true;
        model = {
          ...model,
          ...saved,
          brand: { ...model.brand, ...(saved.brand || {}) },
          selectedCardId: saved.selectedCardId || saved.cards[0].id
        };
        emit();
      } else {
        maybeSeedFromMe();
      }
    }).catch(() => { savedResolved = true; maybeSeedFromMe(); });
  } else {
    savedResolved = true;
  }
  loadMembers();

  // Integración Documentos v2 (🗂️)
  if (shell && shell.documents) {
    if (typeof shell.documents.onSerialize === 'function') {
      shell.documents.onSerialize(() => ({ ...model }));
    }
    if (typeof shell.documents.onLoad === 'function') {
      shell.documents.onLoad((doc) => {
        if (doc && Array.isArray(doc.cards)) {
          commit({ ...doc });
        }
      });
    }
  }

  // Integración con Agente IA (🤖 agent.control)
  let agentOff = null;
  if (shell && shell.agent && typeof shell.agent.register === 'function') {
    agentOff = shell.agent.register({
      label: 'Tarjetas Virtuales',
      description: 'Crea, consulta, actualiza y genera tarjetas de contacto virtuales con QR vCard. Puede generarlas desde los usuarios reales del sistema KIMOS (foto, correo, cargo y teléfono del perfil).',
      tools: [
        {
          name: 'LIST_USERS',
          description: 'Lista los usuarios reales del sistema KIMOS disponibles para generar tarjetas (nombre, cargo, email, si tienen foto).',
          inputSchema: { type: 'object', properties: {} }
        },
        {
          name: 'CREATE_CARDS_FROM_USERS',
          description: 'Genera tarjetas desde los usuarios reales del sistema (foto de perfil, correo, cargo, teléfono y ubicación), aplicando el logo y la empresa de la marca. Sin userIds genera para TODOS los usuarios. Omite usuarios que ya tienen tarjeta.',
          inputSchema: {
            type: 'object',
            properties: {
              userIds: { type: 'array', items: { type: 'string' }, description: 'IDs de usuarios (de LIST_USERS). Vacío u omitido = todos.' }
            }
          }
        },
        {
          name: 'SET_BRAND',
          description: 'Define la empresa y el sitio web de la marca que se aplican a las tarjetas generadas. Con applyToAll=true también actualiza las tarjetas existentes (el logo se sube desde la pestaña Usuarios Kimos).',
          inputSchema: {
            type: 'object',
            properties: {
              company: { type: 'string' },
              website: { type: 'string' },
              applyToAll: { type: 'boolean' }
            }
          }
        },
        {
          name: 'LIST_CARDS',
          description: 'Lista todas las tarjetas virtuales guardadas.',
          inputSchema: { type: 'object', properties: {} }
        },
        {
          name: 'GET_CARD',
          description: 'Obtiene el detalle completo de una tarjeta por ID.',
          inputSchema: {
            type: 'object',
            properties: { id: { type: 'string' } },
            required: ['id']
          }
        },
        {
          name: 'CREATE_CARD',
          description: 'Crea una nueva tarjeta de contacto virtual.',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              title: { type: 'string' },
              company: { type: 'string' },
              email: { type: 'string' },
              phoneMobile: { type: 'string' },
              website: { type: 'string' }
            },
            required: ['name']
          }
        },
        {
          name: 'UPDATE_CARD',
          description: 'Actualiza los campos de una tarjeta virtual existente, incluida la visualización de la foto (photoStyle) y del logo (logoStyle).',
          inputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              title: { type: 'string' },
              company: { type: 'string' },
              email: { type: 'string' },
              phoneMobile: { type: 'string' },
              website: { type: 'string' },
              theme: { type: 'string' },
              photoStyle: {
                type: 'object',
                description: 'Visualización de la foto: visible (bool), shape (circle|rounded|square), size (0.7–1.25), zoom (1–3), offsetX/offsetY (-1–1, encuadre del recorte), ring (bool, anillo de acento).',
                properties: {
                  visible: { type: 'boolean' },
                  shape: { type: 'string', enum: ['circle', 'rounded', 'square'] },
                  size: { type: 'number' },
                  zoom: { type: 'number' },
                  offsetX: { type: 'number' },
                  offsetY: { type: 'number' },
                  ring: { type: 'boolean' }
                }
              },
              logoStyle: {
                type: 'object',
                description: 'Visualización del logo: visible (bool), size (0.6–1.5), opacity (0.2–1), plate (none|white|accent, placa de fondo).',
                properties: {
                  visible: { type: 'boolean' },
                  size: { type: 'number' },
                  opacity: { type: 'number' },
                  plate: { type: 'string', enum: ['none', 'white', 'accent'] }
                }
              }
            },
            required: ['id']
          }
        },
        {
          name: 'DELETE_CARD',
          description: 'Elimina una tarjeta virtual por ID.',
          inputSchema: {
            type: 'object',
            properties: { id: { type: 'string' } },
            required: ['id']
          }
        }
      ],
      getSnapshot: () => ({
        version: APP_VERSION,
        cardCount: model.cards.length,
        selectedCardId: model.selectedCardId,
        brand: { company: (model.brand || {}).company || '', website: (model.brand || {}).website || '', hasLogo: !!((model.brand || {}).logoUrl) },
        systemUsers: directory.members.map((m) => ({ id: m.id, name: m.name, title: m.title, email: m.email, hasPhoto: !!m.photoUrl })),
        cards: model.cards.map((c) => ({
          id: c.id,
          name: c.name,
          title: c.title,
          company: c.company,
          email: c.email,
          phoneMobile: c.phoneMobile,
          format: c.format,
          theme: c.theme
        }))
      }),
      dispatchAction: async ({ type, payload }) => {
        payload = payload || {};
        if (type === 'LIST_USERS') {
          if (!directory.loaded && !directory.loading) await loadMembers();
          return {
            success: true,
            users: directory.members.map((m) => ({ id: m.id, name: m.name, title: m.title, email: m.email, phone: m.phone, hasPhoto: !!m.photoUrl }))
          };
        }
        if (type === 'CREATE_CARDS_FROM_USERS') {
          if (!directory.loaded && !directory.loading) await loadMembers();
          if (!directory.members.length) return { success: false, error: 'No hay usuarios cargados del sistema (¿sin conexión?).' };
          const ids = Array.isArray(payload.userIds) ? payload.userIds.map(String) : [];
          const { created, skipped } = generateCardsForMembers(ids);
          return {
            success: true,
            message: `${created.length} tarjeta(s) generada(s)` + (skipped.length ? `; ya existían: ${skipped.join(', ')}` : '.'),
            createdIds: created.map((c) => c.id)
          };
        }
        if (type === 'SET_BRAND') {
          const brand = { ...(model.brand || {}) };
          if (typeof payload.company === 'string') brand.company = payload.company;
          if (typeof payload.website === 'string') brand.website = payload.website;
          commit({ brand });
          if (payload.applyToAll) applyBrandToCards();
          return { success: true, message: 'Marca actualizada.' };
        }
        if (type === 'LIST_CARDS') {
          return { success: true, cards: model.cards };
        }
        if (type === 'GET_CARD') {
          const card = model.cards.find((c) => c.id === payload.id);
          if (!card) return { success: false, error: 'Tarjeta no encontrada' };
          return { success: true, card };
        }
        if (type === 'CREATE_CARD') {
          const newCard = createDefaultCard(
            payload.name || 'Nuevo Contacto',
            payload.title || '',
            payload.company || ''
          );
          if (payload.email) newCard.email = payload.email;
          if (payload.phoneMobile) newCard.phoneMobile = payload.phoneMobile;
          if (payload.website) newCard.website = payload.website;

          const cards = [...model.cards, newCard];
          commit({ cards, selectedCardId: newCard.id });
          return { success: true, cardId: newCard.id, message: 'Tarjeta creada con éxito.' };
        }
        if (type === 'UPDATE_CARD') {
          const cardIndex = model.cards.findIndex((c) => c.id === payload.id);
          if (cardIndex === -1) return { success: false, error: 'Tarjeta no encontrada' };
          const prev = model.cards[cardIndex];
          const updated = {
            ...prev,
            ...payload,
            // Los estilos se fusionan campo a campo y se normalizan (clamp de
            // rangos): el agente puede mandar valores fuera de rango.
            photoStyle: payload.photoStyle
              ? getPhotoStyle({ photoStyle: { ...(prev.photoStyle || {}), ...payload.photoStyle } })
              : prev.photoStyle,
            logoStyle: payload.logoStyle
              ? getLogoStyle({ logoStyle: { ...(prev.logoStyle || {}), ...payload.logoStyle } })
              : prev.logoStyle,
            updatedAt: new Date().toISOString()
          };
          const cards = [...model.cards];
          cards[cardIndex] = updated;
          commit({ cards });
          return { success: true, message: 'Tarjeta actualizada.' };
        }
        if (type === 'DELETE_CARD') {
          const cards = model.cards.filter((c) => c.id !== payload.id);
          const nextSelected = cards.length > 0 ? cards[0].id : null;
          commit({ cards, selectedCardId: nextSelected });
          return { success: true, message: 'Tarjeta eliminada.' };
        }
        return { success: false, error: `Acción desconocida: ${type}` };
      }
    });
  }

  // ── Componente Principal de React ──────────────────────────────────────────
  function Component() {
    const [state, setState] = useState({ ...model, directory: { ...directory, members: directory.members.slice() } });
    const [activeTab, setActiveTab] = useState('editor'); // 'team' | 'cards' | 'editor' | 'design' | 'preview'
    const liveCanvasRef = useRef(null);

    useEffect(() => {
      listeners.add(setState);
      return () => listeners.delete(setState);
    }, []);

    const currentCard = state.cards.find((c) => c.id === state.selectedCardId) || state.cards[0] || null;

    // Actualizar canvas en vivo cada vez que cambian los datos de la tarjeta activa
    useEffect(() => {
      if (currentCard && liveCanvasRef.current) {
        renderCardToCanvas(currentCard, state.exportScale || 2, liveCanvasRef.current);
      }
    }, [currentCard, state.exportScale]);

    // Helpers de mutación
    const handleUpdateCardField = (key, value) => {
      if (!currentCard) return;
      const updated = {
        ...currentCard,
        [key]: value,
        updatedAt: new Date().toISOString()
      };
      const cards = state.cards.map((c) => (c.id === currentCard.id ? updated : c));
      commit({ cards });
    };

    const handleUpdateCustomColor = (key, value) => {
      if (!currentCard) return;
      const customColors = {
        ...(currentCard.customColors || {}),
        [key]: value
      };
      handleUpdateCardField('customColors', customColors);
    };

    const handleUpdatePhotoStyle = (patch) => {
      if (!currentCard) return;
      handleUpdateCardField('photoStyle', { ...getPhotoStyle(currentCard), ...patch });
    };

    const handleUpdateLogoStyle = (patch) => {
      if (!currentCard) return;
      handleUpdateCardField('logoStyle', { ...getLogoStyle(currentCard), ...patch });
    };

    const handleCreateNewCard = () => {
      const brand = state.brand || {};
      const newCard = createDefaultCard('', '', brand.company || '');
      newCard.logoUrl = brand.logoUrl || '';
      newCard.website = brand.website || '';
      const cards = [...state.cards, newCard];
      commit({ cards, selectedCardId: newCard.id });
      setActiveTab('editor');
      if (shell && shell.notify) shell.notify({ level: 'success', text: 'Nueva tarjeta creada.' });
    };

    // ── Marca (logo/empresa de la colección) ──
    const handleUpdateBrand = (patch) => {
      commit({ brand: { ...(state.brand || {}), ...patch } });
    };

    const handleBrandLogoUpload = (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        if (shell && shell.notify) shell.notify({ level: 'error', text: 'El logo debe pesar menos de 2 MB.' });
        return;
      }
      const reader = new FileReader();
      reader.onload = (evt) => {
        handleUpdateBrand({ logoUrl: evt.target.result });
        if (shell && shell.notify) shell.notify({ level: 'success', text: 'Logo de la marca cargado. Se aplicará a las tarjetas generadas.' });
      };
      reader.readAsDataURL(file);
    };

    const handleGenerateFromMember = (memberId) => {
      const { created, skipped } = generateCardsForMembers([memberId]);
      if (created.length) {
        setActiveTab('preview');
        if (shell && shell.notify) shell.notify({ level: 'success', text: `Tarjeta generada para ${created[0].name}.` });
      } else if (skipped.length) {
        if (shell && shell.notify) shell.notify({ level: 'info', text: `${skipped[0]} ya tiene una tarjeta.` });
      }
    };

    const handleGenerateAll = () => {
      const { created, skipped } = generateCardsForMembers([]);
      if (shell && shell.notify) {
        if (created.length) {
          shell.notify({ level: 'success', text: `${created.length} tarjeta(s) generada(s) desde los usuarios del sistema.` });
        } else {
          shell.notify({ level: 'info', text: skipped.length ? 'Todos los usuarios ya tienen tarjeta.' : 'No hay usuarios para generar.' });
        }
      }
      if (created.length) setActiveTab('cards');
    };

    const handleDuplicateCard = (id) => {
      const source = state.cards.find((c) => c.id === id);
      if (!source) return;
      const dup = {
        ...JSON.parse(JSON.stringify(source)),
        id: 'card_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        name: source.name + ' (Copia)',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const cards = [...state.cards, dup];
      commit({ cards, selectedCardId: dup.id });
      if (shell && shell.notify) shell.notify({ level: 'success', text: 'Tarjeta duplicada.' });
    };

    const handleDeleteCard = (id) => {
      if (state.cards.length <= 1) {
        if (shell && shell.notify) shell.notify({ level: 'warn', text: 'Debe haber al menos una tarjeta.' });
        return;
      }
      const cards = state.cards.filter((c) => c.id !== id);
      const nextId = cards[0].id;
      commit({ cards, selectedCardId: nextId });
      if (shell && shell.notify) shell.notify({ level: 'info', text: 'Tarjeta eliminada.' });
    };

    // Manejo de carga de archivos (Avatar & Logo)
    const handleFileUpload = (e, field) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        if (shell && shell.notify) shell.notify({ level: 'error', text: 'La imagen debe pesar menos de 2 MB.' });
        return;
      }
      const reader = new FileReader();
      reader.onload = (evt) => {
        const dataUrl = evt.target.result;
        handleUpdateCardField(field, dataUrl);
        if (shell && shell.notify) shell.notify({ level: 'success', text: 'Imagen cargada correctamente.' });
      };
      reader.readAsDataURL(file);
    };

    // Acciones de Descarga y Compartir
    const handleDownloadImage = async (format = 'png') => {
      if (!currentCard) return;
      const exportCanvas = await renderCardToCanvas(currentCard, state.exportScale || 2);
      const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
      const dataUrl = exportCanvas.toDataURL(mimeType, 0.95);
      const cleanName = (currentCard.name || 'tarjeta').toLowerCase().replace(/[^a-z0-9]/g, '_');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${cleanName}_tarjeta.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      if (shell && shell.notify) shell.notify({ level: 'success', text: `Tarjeta descargada como .${format}` });
    };

    const handleCopyImageToClipboard = async () => {
      if (!currentCard) return;
      try {
        const exportCanvas = await renderCardToCanvas(currentCard, 2);
        exportCanvas.toBlob(async (blob) => {
          if (!blob) throw new Error('No se pudo generar el blob.');
          if (navigator.clipboard && navigator.clipboard.write) {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
            if (shell && shell.notify) shell.notify({ level: 'success', text: 'Imagen copiada al portapapeles.' });
          } else {
            throw new Error('Clipboard API no disponible.');
          }
        }, 'image/png');
      } catch (err) {
        if (shell && shell.notify) shell.notify({ level: 'warn', text: 'No se pudo copiar directo. Usa el botón de Descargar.' });
      }
    };

    const handleDownloadVCard = () => {
      if (!currentCard) return;
      const vcardContent = formatVCard(currentCard);
      const blob = new Blob([vcardContent], { type: 'text/vcard;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const cleanName = (currentCard.name || 'contacto').toLowerCase().replace(/[^a-z0-9]/g, '_');
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cleanName}.vcf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      if (shell && shell.notify) shell.notify({ level: 'success', text: 'Archivo vCard (.vcf) descargado.' });
    };

    const handleDownloadQR = async () => {
      if (!currentCard) return;
      let qrPayload = formatVCard(currentCard);
      if (currentCard.qrType === 'url' && currentCard.website) qrPayload = currentCard.website;
      const qrData = generateQRMatrix(qrPayload, 'M');
      const qrCanvas = document.createElement('canvas');
      const s = 600;
      qrCanvas.width = s;
      qrCanvas.height = s;
      const ctx = qrCanvas.getContext('2d');
      const pal = getCardPalette(currentCard);
      drawQRBox(ctx, qrData, 0, 0, s, s, pal, '');
      const a = document.createElement('a');
      a.href = qrCanvas.toDataURL('image/png');
      a.download = `qr_${(currentCard.name || 'contacto').toLowerCase().replace(/[^a-z0-9]/g, '_')}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      if (shell && shell.notify) shell.notify({ level: 'success', text: 'Código QR descargado.' });
    };

    // ── Render Header ──
    const renderHeader = () => {
      return h('header', { className: 'kt-header' },
        h('div', { className: 'kt-brand' },
          h('span', { className: 'kt-brand-icon' }, '🪪'),
          h('span', { className: 'kt-brand-title' }, 'Tarjetas Virtuales'),
          h('span', { className: 'kt-version-badge', title: `KIMOS App v${APP_VERSION}` }, `v${APP_VERSION}`)
        ),
        h('nav', { className: 'kt-nav-tabs' },
          h('button', {
            className: `kt-tab-btn ${activeTab === 'team' ? 'active' : ''}`,
            onClick: () => setActiveTab('team')
          }, '👥 Usuarios Kimos' + (state.directory && state.directory.members.length ? ' (' + state.directory.members.length + ')' : '')),
          h('button', {
            className: `kt-tab-btn ${activeTab === 'cards' ? 'active' : ''}`,
            onClick: () => setActiveTab('cards')
          }, '📇 Mis Tarjetas (' + state.cards.length + ')'),
          h('button', {
            className: `kt-tab-btn ${activeTab === 'editor' ? 'active' : ''}`,
            onClick: () => setActiveTab('editor')
          }, '✏️ Datos de Contacto'),
          h('button', {
            className: `kt-tab-btn ${activeTab === 'design' ? 'active' : ''}`,
            onClick: () => setActiveTab('design')
          }, '🎨 Diseño y Colores'),
          h('button', {
            className: `kt-tab-btn ${activeTab === 'preview' ? 'active' : ''}`,
            onClick: () => setActiveTab('preview')
          }, '👁️ Visor & Exportar')
        ),
        h('div', { className: 'kt-header-actions' },
          h('button', {
            className: 'kt-btn kt-btn-primary',
            onClick: handleCreateNewCard
          }, '+ Nueva Tarjeta')
        )
      );
    };

    // ── Render Pestaña 0: Usuarios Kimos (usuarios reales del sistema) ──
    const renderTeamTab = () => {
      const dir = state.directory || { members: [], loading: false, loaded: false, error: '' };
      const brand = state.brand || {};
      const cardForMember = (m) => state.cards.find((c) =>
        (c.memberId && c.memberId === m.id) ||
        (m.email && c.email && c.email.toLowerCase() === m.email.toLowerCase()));

      return h('div', { className: 'kt-full-scroll' },
        // Marca: logo y empresa aplicados a las tarjetas generadas
        h('div', { className: 'kt-section' },
          h('div', { className: 'kt-section-header' },
            h('span', { className: 'kt-section-title' }, '🏷️ Marca de las tarjetas'),
            h('button', {
              className: 'kt-btn kt-btn-sm',
              title: 'Aplica el logo y la empresa de la marca a todas las tarjetas ya creadas',
              onClick: () => {
                applyBrandToCards();
                if (shell && shell.notify) shell.notify({ level: 'success', text: 'Marca aplicada a todas las tarjetas.' });
              }
            }, 'Aplicar a todas las tarjetas')
          ),
          h('div', { className: 'kt-brand-row' },
            h('div', { className: 'kt-upload-box' },
              h('div', { className: 'kt-logo-preview' },
                brand.logoUrl
                  ? h('img', { src: brand.logoUrl, alt: 'Logo de la marca' })
                  : '🏢'
              ),
              h('div', { className: 'kt-upload-actions' },
                h('input', {
                  type: 'file',
                  accept: 'image/*',
                  style: { display: 'none' },
                  id: 'kt-brand-logo-input',
                  onChange: handleBrandLogoUpload
                }),
                h('label', { htmlFor: 'kt-brand-logo-input', className: 'kt-btn kt-btn-sm' }, 'Subir Logo de la Marca'),
                brand.logoUrl && h('button', {
                  className: 'kt-btn kt-btn-sm kt-btn-danger',
                  onClick: () => handleUpdateBrand({ logoUrl: '' })
                }, 'Quitar')
              )
            ),
            h('div', { className: 'kt-brand-fields' },
              h('div', { className: 'kt-form-group' },
                h('label', { className: 'kt-label' }, 'Empresa / Organización'),
                h('input', {
                  type: 'text',
                  className: 'kt-input',
                  placeholder: 'Ej. Kimos Technologies',
                  value: brand.company || '',
                  onChange: (e) => handleUpdateBrand({ company: e.target.value })
                })
              ),
              h('div', { className: 'kt-form-group' },
                h('label', { className: 'kt-label' }, 'Sitio Web corporativo'),
                h('input', {
                  type: 'text',
                  className: 'kt-input',
                  placeholder: 'https://miempresa.com',
                  value: brand.website || '',
                  onChange: (e) => handleUpdateBrand({ website: e.target.value })
                })
              )
            )
          ),
          h('p', { className: 'kt-hint' },
            'El logo y la empresa se añaden automáticamente a cada tarjeta generada desde los usuarios del sistema.')
        ),

        // Lista de usuarios reales
        h('div', { className: 'kt-section' },
          h('div', { className: 'kt-section-header' },
            h('span', { className: 'kt-section-title' },
              '👥 Usuarios del sistema' + (dir.members.length ? ' (' + dir.members.length + ')' : '')),
            h('div', { style: { display: 'flex', gap: '8px' } },
              h('button', { className: 'kt-btn kt-btn-sm', onClick: () => loadMembers() },
                dir.loading ? 'Cargando…' : '🔄 Actualizar'),
              h('button', {
                className: 'kt-btn kt-btn-sm kt-btn-primary',
                disabled: !dir.members.length,
                onClick: handleGenerateAll
              }, '⚡ Generar tarjetas para todos')
            )
          ),
          dir.error && h('div', { className: 'kt-empty' }, dir.error),
          !dir.error && !dir.loading && dir.loaded && !dir.members.length &&
            h('div', { className: 'kt-empty' }, 'No hay usuarios activos en el sistema.'),
          !dir.error && !dir.loaded && dir.loading &&
            h('div', { className: 'kt-empty' }, 'Cargando usuarios del sistema…'),
          h('div', { className: 'kt-member-list' },
            dir.members.map((m) => {
              const existing = cardForMember(m);
              return h('div', { key: m.id, className: 'kt-member-row' },
                h('div', { className: 'kt-member-avatar' },
                  m.photoUrl
                    ? h('img', { src: m.photoUrl, alt: m.name })
                    : h('span', null, (m.name || '?').split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase())
                ),
                h('div', { className: 'kt-member-info' },
                  h('div', { className: 'kt-member-name' }, m.name),
                  h('div', { className: 'kt-member-meta' },
                    [m.title, m.email, m.phone].filter(Boolean).join(' · ') || 'Sin datos de perfil')
                ),
                h('div', { className: 'kt-member-actions' },
                  existing
                    ? h('button', {
                        className: 'kt-btn kt-btn-sm',
                        onClick: () => {
                          commit({ selectedCardId: existing.id });
                          setActiveTab('preview');
                        }
                      }, '👁️ Ver tarjeta')
                    : h('button', {
                        className: 'kt-btn kt-btn-sm kt-btn-primary',
                        onClick: () => handleGenerateFromMember(m.id)
                      }, '➕ Generar tarjeta')
                )
              );
            })
          )
        )
      );
    };

    // ── Render Pestaña 1: Mis Tarjetas ──
    const renderCardsTab = () => {
      return h('div', { className: 'kt-full-scroll' },
        h('div', { className: 'kt-section-header' },
          h('span', { className: 'kt-section-title' }, 'Colección de Tarjetas Guardadas'),
          h('button', { className: 'kt-btn kt-btn-primary', onClick: handleCreateNewCard }, '+ Crear Tarjeta')
        ),
        h('div', { className: 'kt-cards-grid' },
          state.cards.map((c) => {
            const isSelected = c.id === currentCard?.id;
            return h('div', {
              key: c.id,
              className: `kt-card-item ${isSelected ? 'selected' : ''}`
            },
              h('div', {
                className: 'kt-card-item-preview',
                onClick: () => {
                  commit({ selectedCardId: c.id });
                  setActiveTab('preview');
                }
              },
                h(MiniCardPreview, { card: c })
              ),
              h('div', { className: 'kt-card-item-body' },
                h('div', { className: 'kt-card-item-name' }, c.name || 'Sin nombre'),
                h('div', { className: 'kt-card-item-title' }, c.title || 'Sin cargo'),
                h('div', { className: 'kt-card-item-company' }, c.company || 'Sin empresa')
              ),
              h('div', { className: 'kt-card-item-actions' },
                h('button', {
                  className: 'kt-btn kt-btn-sm',
                  onClick: () => {
                    commit({ selectedCardId: c.id });
                    setActiveTab('editor');
                  }
                }, '✏️ Editar'),
                h('button', {
                  className: 'kt-btn kt-btn-sm',
                  onClick: () => handleDuplicateCard(c.id)
                }, '📋 Duplicar'),
                h('button', {
                  className: 'kt-btn kt-btn-sm kt-btn-danger',
                  onClick: () => handleDeleteCard(c.id)
                }, '🗑️')
              )
            );
          })
        )
      );
    };

    // Mini preview componente para la cuadrícula
    function MiniCardPreview({ card }) {
      const canvasRef = useRef(null);
      useEffect(() => {
        if (canvasRef.current) {
          renderCardToCanvas(card, 0.5, canvasRef.current);
        }
      }, [card]);
      return h('canvas', { ref: canvasRef, className: 'kt-card-mini-canvas' });
    }

    // ── Render Pestaña 2: Editor de Datos ──
    const renderEditorTab = () => {
      if (!currentCard) return h('div', { className: 'kt-empty' }, 'No hay tarjeta seleccionada.');

      return h('div', { className: 'kt-split-view' },
        // Panel izquierdo: Formularios
        h('div', { className: 'kt-panel-left' },
          // Sección Información Personal
          h('div', { className: 'kt-section' },
            h('div', { className: 'kt-section-header' },
              h('span', { className: 'kt-section-title' }, '👤 Información Personal')
            ),
            h('div', { className: 'kt-form-grid' },
              h('div', { className: 'kt-form-group col-full' },
                h('label', { className: 'kt-label' }, 'Nombre y Apellidos'),
                h('input', {
                  type: 'text',
                  className: 'kt-input',
                  placeholder: 'Ej. Carlos Mendoza',
                  value: currentCard.name || '',
                  onChange: (e) => handleUpdateCardField('name', e.target.value)
                })
              ),
              h('div', { className: 'kt-form-group' },
                h('label', { className: 'kt-label' }, 'Cargo o Puesto'),
                h('input', {
                  type: 'text',
                  className: 'kt-input',
                  placeholder: 'Ej. Director de Producto',
                  value: currentCard.title || '',
                  onChange: (e) => handleUpdateCardField('title', e.target.value)
                })
              ),
              h('div', { className: 'kt-form-group' },
                h('label', { className: 'kt-label' }, 'Empresa / Organización'),
                h('input', {
                  type: 'text',
                  className: 'kt-input',
                  placeholder: 'Ej. Kimos Technologies',
                  value: currentCard.company || '',
                  onChange: (e) => handleUpdateCardField('company', e.target.value)
                })
              ),
              h('div', { className: 'kt-form-group col-full' },
                h('label', { className: 'kt-label' }, 'Departamento o Especialidad'),
                h('input', {
                  type: 'text',
                  className: 'kt-input',
                  placeholder: 'Ej. Innovación & Software',
                  value: currentCard.department || '',
                  onChange: (e) => handleUpdateCardField('department', e.target.value)
                })
              )
            )
          ),

          // Sección Contacto y Enlaces
          h('div', { className: 'kt-section' },
            h('div', { className: 'kt-section-header' },
              h('span', { className: 'kt-section-title' }, '📞 Contacto & Enlaces')
            ),
            h('div', { className: 'kt-form-grid' },
              h('div', { className: 'kt-form-group' },
                h('label', { className: 'kt-label' }, 'Teléfono Móvil / WhatsApp'),
                h('input', {
                  type: 'text',
                  className: 'kt-input',
                  placeholder: '+34 600 000 000',
                  value: currentCard.phoneMobile || '',
                  onChange: (e) => handleUpdateCardField('phoneMobile', e.target.value)
                })
              ),
              h('div', { className: 'kt-form-group' },
                h('label', { className: 'kt-label' }, 'Teléfono de Oficina'),
                h('input', {
                  type: 'text',
                  className: 'kt-input',
                  placeholder: '+34 910 000 000',
                  value: currentCard.phoneOffice || '',
                  onChange: (e) => handleUpdateCardField('phoneOffice', e.target.value)
                })
              ),
              h('div', { className: 'kt-form-group col-full' },
                h('label', { className: 'kt-label' }, 'Correo Electrónico'),
                h('input', {
                  type: 'email',
                  className: 'kt-input',
                  placeholder: 'usuario@empresa.com',
                  value: currentCard.email || '',
                  onChange: (e) => handleUpdateCardField('email', e.target.value)
                })
              ),
              h('div', { className: 'kt-form-group col-full' },
                h('label', { className: 'kt-label' }, 'Sitio Web / Perfil'),
                h('input', {
                  type: 'text',
                  className: 'kt-input',
                  placeholder: 'https://miweb.com',
                  value: currentCard.website || '',
                  onChange: (e) => handleUpdateCardField('website', e.target.value)
                })
              ),
              h('div', { className: 'kt-form-group col-full' },
                h('label', { className: 'kt-label' }, 'Dirección / Ciudad / País'),
                h('input', {
                  type: 'text',
                  className: 'kt-input',
                  placeholder: 'Madrid, España',
                  value: currentCard.address || '',
                  onChange: (e) => handleUpdateCardField('address', e.target.value)
                })
              ),
              h('div', { className: 'kt-form-group col-full' },
                h('label', { className: 'kt-label' }, 'Perfil de LinkedIn'),
                h('input', {
                  type: 'text',
                  className: 'kt-input',
                  placeholder: 'https://linkedin.com/in/usuario',
                  value: currentCard.linkedin || '',
                  onChange: (e) => handleUpdateCardField('linkedin', e.target.value)
                })
              ),
              h('div', { className: 'kt-form-group col-full' },
                h('label', { className: 'kt-label' }, 'Bio / Nota breve (se guarda en el vCard)'),
                h('textarea', {
                  className: 'kt-textarea',
                  placeholder: 'Breve descripción o lema...',
                  value: currentCard.bio || '',
                  onChange: (e) => handleUpdateCardField('bio', e.target.value)
                })
              )
            )
          )
        ),

        // Panel derecho: Preview en tiempo real
        h('div', { className: 'kt-panel-right' },
          h('div', { className: 'kt-preview-container' },
            h('div', { className: 'kt-canvas-wrapper' },
              h('canvas', { ref: liveCanvasRef, className: 'kt-live-canvas' })
            ),
            h('div', { className: 'kt-export-toolbar' },
              h('button', { className: 'kt-btn kt-btn-primary', onClick: () => handleDownloadImage('png') }, '📥 Descargar PNG'),
              h('button', { className: 'kt-btn', onClick: handleCopyImageToClipboard }, '📋 Copiar Imagen'),
              h('button', { className: 'kt-btn', onClick: handleDownloadVCard }, '📲 Guardar Contacto (.vcf)')
            )
          )
        )
      );
    };

    // ── Render Pestaña 3: Diseño y Colores ──
    const renderDesignTab = () => {
      if (!currentCard) return h('div', { className: 'kt-empty' }, 'No hay tarjeta seleccionada.');
      const photoSt = getPhotoStyle(currentCard);
      const logoSt = getLogoStyle(currentCard);

      return h('div', { className: 'kt-split-view' },
        h('div', { className: 'kt-panel-left' },
          // Fotos e Identidad Visual
          h('div', { className: 'kt-section' },
            h('div', { className: 'kt-section-header' },
              h('span', { className: 'kt-section-title' }, '🖼️ Fotos y Logotipo')
            ),
            h('div', { className: 'kt-form-group' },
              h('label', { className: 'kt-label' }, 'Foto de Persona (Avatar individual)'),
              h('div', { className: 'kt-upload-box' },
                h('div', { className: 'kt-avatar-preview' },
                  currentCard.photoUrl
                    ? h('img', { src: currentCard.photoUrl, alt: 'Foto de perfil' })
                    : '👤'
                ),
                h('div', { className: 'kt-upload-actions' },
                  h('input', {
                    type: 'file',
                    accept: 'image/*',
                    style: { display: 'none' },
                    id: 'kt-photo-input',
                    onChange: (e) => handleFileUpload(e, 'photoUrl')
                  }),
                  h('label', { htmlFor: 'kt-photo-input', className: 'kt-btn kt-btn-sm' }, 'Subir Foto'),
                  currentCard.photoUrl && h('button', {
                    className: 'kt-btn kt-btn-sm kt-btn-danger',
                    onClick: () => handleUpdateCardField('photoUrl', '')
                  }, 'Quitar')
                )
              )
            ),

            // Visualización de la foto: mostrar/ocultar, forma, tamaño, zoom y encuadre
            h('div', { className: 'kt-style-controls' },
              h('label', { className: 'kt-check-row' },
                h('input', {
                  type: 'checkbox',
                  checked: photoSt.visible,
                  onChange: (e) => handleUpdatePhotoStyle({ visible: e.target.checked })
                }),
                'Mostrar la foto en la tarjeta'
              ),
              photoSt.visible && h('div', { className: 'kt-form-grid' },
                h('div', { className: 'kt-form-group' },
                  h('label', { className: 'kt-label' }, 'Forma de la foto'),
                  h('select', {
                    className: 'kt-select',
                    value: photoSt.shape,
                    onChange: (e) => handleUpdatePhotoStyle({ shape: e.target.value })
                  },
                    h('option', { value: 'circle' }, 'Círculo'),
                    h('option', { value: 'rounded' }, 'Cuadrado redondeado'),
                    h('option', { value: 'square' }, 'Cuadrado')
                  )
                ),
                h('div', { className: 'kt-form-group' },
                  h('label', { className: 'kt-label' }, `Tamaño · ${Math.round(photoSt.size * 100)}%`),
                  h('input', {
                    type: 'range',
                    className: 'kt-range',
                    min: 70, max: 125, step: 5,
                    value: Math.round(photoSt.size * 100),
                    onChange: (e) => handleUpdatePhotoStyle({ size: Number(e.target.value) / 100 })
                  })
                ),
                h('div', { className: 'kt-form-group' },
                  h('label', { className: 'kt-label' }, `Zoom del recorte · ${Math.round(photoSt.zoom * 100)}%`),
                  h('input', {
                    type: 'range',
                    className: 'kt-range',
                    min: 100, max: 300, step: 5,
                    value: Math.round(photoSt.zoom * 100),
                    disabled: !currentCard.photoUrl,
                    onChange: (e) => handleUpdatePhotoStyle({ zoom: Number(e.target.value) / 100 })
                  })
                ),
                h('div', { className: 'kt-form-group' },
                  h('label', { className: 'kt-label' }, 'Encuadre horizontal ⟷'),
                  h('input', {
                    type: 'range',
                    className: 'kt-range',
                    min: -100, max: 100, step: 5,
                    value: Math.round(photoSt.offsetX * 100),
                    disabled: !currentCard.photoUrl,
                    onChange: (e) => handleUpdatePhotoStyle({ offsetX: Number(e.target.value) / 100 })
                  })
                ),
                h('div', { className: 'kt-form-group' },
                  h('label', { className: 'kt-label' }, 'Encuadre vertical ↕'),
                  h('input', {
                    type: 'range',
                    className: 'kt-range',
                    min: -100, max: 100, step: 5,
                    value: Math.round(photoSt.offsetY * 100),
                    disabled: !currentCard.photoUrl,
                    onChange: (e) => handleUpdatePhotoStyle({ offsetY: Number(e.target.value) / 100 })
                  })
                ),
                h('div', { className: 'kt-form-group' },
                  h('label', { className: 'kt-check-row' },
                    h('input', {
                      type: 'checkbox',
                      checked: photoSt.ring,
                      onChange: (e) => handleUpdatePhotoStyle({ ring: e.target.checked })
                    }),
                    'Anillo con el color de acento'
                  ),
                  h('button', {
                    className: 'kt-btn kt-btn-sm',
                    style: { marginTop: '6px' },
                    disabled: photoSt.zoom === 1 && photoSt.offsetX === 0 && photoSt.offsetY === 0,
                    onClick: () => handleUpdatePhotoStyle({ zoom: 1, offsetX: 0, offsetY: 0 })
                  }, '↺ Restablecer recorte')
                )
              )
            ),
            h('div', { className: 'kt-form-group', style: { marginTop: '12px' } },
              h('label', { className: 'kt-label' }, 'Logo de la Empresa / Marca'),
              h('div', { className: 'kt-upload-box' },
                h('div', { className: 'kt-logo-preview' },
                  currentCard.logoUrl
                    ? h('img', { src: currentCard.logoUrl, alt: 'Logo empresa' })
                    : '🏢'
                ),
                h('div', { className: 'kt-upload-actions' },
                  h('input', {
                    type: 'file',
                    accept: 'image/*',
                    style: { display: 'none' },
                    id: 'kt-logo-input',
                    onChange: (e) => handleFileUpload(e, 'logoUrl')
                  }),
                  h('label', { htmlFor: 'kt-logo-input', className: 'kt-btn kt-btn-sm' }, 'Subir Logo'),
                  currentCard.logoUrl && h('button', {
                    className: 'kt-btn kt-btn-sm kt-btn-danger',
                    onClick: () => handleUpdateCardField('logoUrl', '')
                  }, 'Quitar')
                )
              )
            ),

            // Visualización del logo: mostrar/ocultar, tamaño, opacidad y placa de fondo
            currentCard.logoUrl && h('div', { className: 'kt-style-controls' },
              h('label', { className: 'kt-check-row' },
                h('input', {
                  type: 'checkbox',
                  checked: logoSt.visible,
                  onChange: (e) => handleUpdateLogoStyle({ visible: e.target.checked })
                }),
                'Mostrar el logo en la tarjeta'
              ),
              logoSt.visible && h('div', { className: 'kt-form-grid' },
                h('div', { className: 'kt-form-group' },
                  h('label', { className: 'kt-label' }, `Tamaño · ${Math.round(logoSt.size * 100)}%`),
                  h('input', {
                    type: 'range',
                    className: 'kt-range',
                    min: 60, max: 150, step: 5,
                    value: Math.round(logoSt.size * 100),
                    onChange: (e) => handleUpdateLogoStyle({ size: Number(e.target.value) / 100 })
                  })
                ),
                h('div', { className: 'kt-form-group' },
                  h('label', { className: 'kt-label' }, `Opacidad · ${Math.round(logoSt.opacity * 100)}%`),
                  h('input', {
                    type: 'range',
                    className: 'kt-range',
                    min: 20, max: 100, step: 5,
                    value: Math.round(logoSt.opacity * 100),
                    onChange: (e) => handleUpdateLogoStyle({ opacity: Number(e.target.value) / 100 })
                  })
                ),
                h('div', { className: 'kt-form-group col-full' },
                  h('label', { className: 'kt-label' }, 'Fondo del logo'),
                  h('select', {
                    className: 'kt-select',
                    value: logoSt.plate,
                    onChange: (e) => handleUpdateLogoStyle({ plate: e.target.value })
                  },
                    h('option', { value: 'none' }, 'Sin fondo (transparente)'),
                    h('option', { value: 'white' }, 'Placa blanca redondeada (para fondos oscuros)'),
                    h('option', { value: 'accent' }, 'Placa del color de acento')
                  )
                )
              )
            )
          ),

          // Formato y Orientación
          h('div', { className: 'kt-section' },
            h('div', { className: 'kt-section-header' },
              h('span', { className: 'kt-section-title' }, '📐 Orientación y Estilo')
            ),
            h('div', { className: 'kt-form-grid' },
              h('div', { className: 'kt-form-group' },
                h('label', { className: 'kt-label' }, 'Orientación'),
                h('select', {
                  className: 'kt-select',
                  value: currentCard.format || 'horizontal',
                  onChange: (e) => handleUpdateCardField('format', e.target.value)
                },
                  h('option', { value: 'horizontal' }, 'Horizontal (1050 x 600 px)'),
                  h('option', { value: 'vertical' }, 'Vertical (600 x 950 px)')
                )
              ),
              h('div', { className: 'kt-form-group' },
                h('label', { className: 'kt-label' }, 'Disposición'),
                h('select', {
                  className: 'kt-select',
                  value: currentCard.style || 'modern-split',
                  onChange: (e) => handleUpdateCardField('style', e.target.value)
                },
                  h('option', { value: 'modern-split' }, 'Bicolor Dividido (Modern Split)'),
                  h('option', { value: 'minimal' }, 'Minimalista Limpio (Minimal Clean)')
                )
              ),
              h('div', { className: 'kt-form-group col-full' },
                h('label', { className: 'kt-label' }, 'Contenido del Código QR'),
                h('select', {
                  className: 'kt-select',
                  value: currentCard.qrType || 'vcard',
                  onChange: (e) => handleUpdateCardField('qrType', e.target.value)
                },
                  h('option', { value: 'vcard' }, 'vCard 3.0 Completo (Guardar contacto en la agenda del móvil)'),
                  h('option', { value: 'url' }, 'Enlace Directo (Abrir URL de Sitio Web / Perfil)')
                )
              )
            )
          ),

          // Paletas de Color
          h('div', { className: 'kt-section' },
            h('div', { className: 'kt-section-header' },
              h('span', { className: 'kt-section-title' }, '🎨 Paleta de Colores Kimos')
            ),
            h('div', { className: 'kt-palette-grid' },
              Object.keys(THEME_PALETTES).map((palKey) => {
                const pal = THEME_PALETTES[palKey];
                const isActive = currentCard.theme === palKey;
                return h('div', {
                  key: palKey,
                  className: `kt-palette-card ${isActive ? 'active' : ''}`,
                  onClick: () => handleUpdateCardField('theme', palKey)
                },
                  h('div', { className: 'kt-palette-preview' },
                    h('div', { style: { flex: 1, background: pal.bg } }),
                    h('div', { style: { width: '12px', background: pal.accent } }),
                    h('div', { style: { flex: 1, background: pal.cardBg } })
                  ),
                  h('span', { className: 'kt-palette-name' }, pal.name)
                );
              }),
              h('div', {
                className: `kt-palette-card ${currentCard.theme === 'custom' ? 'active' : ''}`,
                onClick: () => handleUpdateCardField('theme', 'custom')
              },
                h('div', { className: 'kt-palette-preview' },
                  h('div', { style: { flex: 1, background: currentCard.customColors?.bg || '#fff' } }),
                  h('div', { style: { width: '12px', background: currentCard.customColors?.accent || '#19ACB1' } }),
                  h('div', { style: { flex: 1, background: currentCard.customColors?.cardBg || '#f8fafc' } })
                ),
                h('span', { className: 'kt-palette-name' }, 'Personalizado')
              )
            ),
            // Selectores de color cuando está en personalizado
            currentCard.theme === 'custom' && h('div', { className: 'kt-color-inputs' },
              h('div', { className: 'kt-color-item' },
                h('input', {
                  type: 'color',
                  className: 'kt-color-picker',
                  value: currentCard.customColors?.bg || '#ffffff',
                  onChange: (e) => handleUpdateCustomColor('bg', e.target.value)
                }),
                h('span', { className: 'kt-label' }, 'Fondo')
              ),
              h('div', { className: 'kt-color-item' },
                h('input', {
                  type: 'color',
                  className: 'kt-color-picker',
                  value: currentCard.customColors?.accent || '#19ACB1',
                  onChange: (e) => handleUpdateCustomColor('accent', e.target.value)
                }),
                h('span', { className: 'kt-label' }, 'Color de Acento')
              ),
              h('div', { className: 'kt-color-item' },
                h('input', {
                  type: 'color',
                  className: 'kt-color-picker',
                  value: currentCard.customColors?.text || '#0f172a',
                  onChange: (e) => handleUpdateCustomColor('text', e.target.value)
                }),
                h('span', { className: 'kt-label' }, 'Texto Principal')
              ),
              h('div', { className: 'kt-color-item' },
                h('input', {
                  type: 'color',
                  className: 'kt-color-picker',
                  value: currentCard.customColors?.cardBg || '#f8fafc',
                  onChange: (e) => handleUpdateCustomColor('cardBg', e.target.value)
                }),
                h('span', { className: 'kt-label' }, 'Superficie de Tarjeta')
              )
            )
          )
        ),

        // Panel derecho: Preview interactivo
        h('div', { className: 'kt-panel-right' },
          h('div', { className: 'kt-preview-container' },
            h('div', { className: 'kt-canvas-wrapper' },
              h('canvas', { ref: liveCanvasRef, className: 'kt-live-canvas' })
            ),
            h('div', { className: 'kt-export-toolbar' },
              h('button', { className: 'kt-btn kt-btn-primary', onClick: () => handleDownloadImage('png') }, '📥 Descargar PNG'),
              h('button', { className: 'kt-btn', onClick: handleCopyImageToClipboard }, '📋 Copiar Imagen')
            )
          )
        )
      );
    };

    // ── Render Pestaña 4: Visor & Exportación ──
    const renderPreviewTab = () => {
      if (!currentCard) return h('div', { className: 'kt-empty' }, 'No hay tarjeta seleccionada.');

      return h('div', { className: 'kt-full-scroll', style: { display: 'flex', flexDirection: 'column', alignItems: 'center' } },
        h('div', { className: 'kt-preview-container', style: { maxWidth: '850px' } },
          h('div', { className: 'kt-canvas-wrapper', style: { width: '100%' } },
            h('canvas', { ref: liveCanvasRef, className: 'kt-live-canvas' })
          ),
          h('div', { className: 'kt-qr-helper-tip' },
            '📱 ', h('strong', null, 'Tip de escaneo:'), ' Apunta con la cámara de tu smartphone para escanear y agregar a la agenda.'
          ),
          h('div', { className: 'kt-export-toolbar' },
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', marginRight: 'auto' } },
              h('label', { className: 'kt-label' }, 'Calidad:'),
              h('select', {
                className: 'kt-select',
                style: { width: 'auto', padding: '4px 8px' },
                value: state.exportScale || 2,
                onChange: (e) => commit({ exportScale: Number(e.target.value) })
              },
                h('option', { value: 1 }, '1x Estándar'),
                h('option', { value: 2 }, '2x HD (Recomendada)'),
                h('option', { value: 3 }, '3x Ultra Alta Resolución')
              )
            ),
            h('button', { className: 'kt-btn kt-btn-primary', onClick: () => handleDownloadImage('png') }, '📥 Descargar PNG'),
            h('button', { className: 'kt-btn', onClick: () => handleDownloadImage('jpg') }, '🖼️ Descargar JPG'),
            h('button', { className: 'kt-btn', onClick: handleCopyImageToClipboard }, '📋 Copiar Imagen'),
            h('button', { className: 'kt-btn', onClick: handleDownloadVCard }, '📲 Guardar Contacto (.vcf)'),
            h('button', { className: 'kt-btn', onClick: handleDownloadQR }, '🔲 Solo QR')
          )
        )
      );
    };

    return h('div', { className: 'kimos-tarjetas' },
      renderHeader(),
      h('main', { className: 'kt-main' },
        activeTab === 'team' && renderTeamTab(),
        activeTab === 'cards' && renderCardsTab(),
        activeTab === 'editor' && renderEditorTab(),
        activeTab === 'design' && renderDesignTab(),
        activeTab === 'preview' && renderPreviewTab()
      )
    );
  }

  return {
    Component,
    unmount() {
      clearTimeout(saveTimer);
      if (agentOff && typeof agentOff === 'function') agentOff();
    }
  };
}
