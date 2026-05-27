export type QrErrorCorrectionLevel = 'medium' | 'high'

export type QrCode = {
  errorCorrectionLevel: QrErrorCorrectionLevel
  version: number
  size: number
  modules: boolean[][]
}

export type QrCodeOptions = {
  errorCorrectionLevel?: QrErrorCorrectionLevel
  minVersion?: number
}

type BlockGroup = {
  count: number
  dataCodewords: number
}

type VersionConfig = {
  version: number
  dataCodewords: number
  errorCorrectionCodewords: number
  groups: BlockGroup[]
}

type Matrix = {
  modules: boolean[][]
  reserved: boolean[][]
}

const BYTE_MODE = 0b0100
const FORMAT_ERROR_CORRECTION_LEVEL_BITS: Record<QrErrorCorrectionLevel, number> = {
  high: 0b10,
  medium: 0b00
}
const FORMAT_MASK = 0x5412
const FORMAT_GENERATOR = 0x537
const VERSION_GENERATOR = 0x1f25
const REED_SOLOMON_FIELD = 0x11d

const VERSION_CONFIGS: Record<QrErrorCorrectionLevel, VersionConfig[]> = {
  high: [{
    version: 1,
    dataCodewords: 9,
    errorCorrectionCodewords: 17,
    groups: [{ count: 1, dataCodewords: 9 }]
  }, {
    version: 2,
    dataCodewords: 16,
    errorCorrectionCodewords: 28,
    groups: [{ count: 1, dataCodewords: 16 }]
  }, {
    version: 3,
    dataCodewords: 26,
    errorCorrectionCodewords: 22,
    groups: [{ count: 2, dataCodewords: 13 }]
  }, {
    version: 4,
    dataCodewords: 36,
    errorCorrectionCodewords: 16,
    groups: [{ count: 4, dataCodewords: 9 }]
  }, {
    version: 5,
    dataCodewords: 46,
    errorCorrectionCodewords: 22,
    groups: [{ count: 2, dataCodewords: 11 }, { count: 2, dataCodewords: 12 }]
  }, {
    version: 6,
    dataCodewords: 60,
    errorCorrectionCodewords: 28,
    groups: [{ count: 4, dataCodewords: 15 }]
  }, {
    version: 7,
    dataCodewords: 66,
    errorCorrectionCodewords: 26,
    groups: [{ count: 4, dataCodewords: 13 }, { count: 1, dataCodewords: 14 }]
  }, {
    version: 8,
    dataCodewords: 86,
    errorCorrectionCodewords: 26,
    groups: [{ count: 4, dataCodewords: 14 }, { count: 2, dataCodewords: 15 }]
  }, {
    version: 9,
    dataCodewords: 100,
    errorCorrectionCodewords: 24,
    groups: [{ count: 4, dataCodewords: 12 }, { count: 4, dataCodewords: 13 }]
  }, {
    version: 10,
    dataCodewords: 122,
    errorCorrectionCodewords: 28,
    groups: [{ count: 6, dataCodewords: 15 }, { count: 2, dataCodewords: 16 }]
  }],
  medium: [{
    version: 1,
    dataCodewords: 16,
    errorCorrectionCodewords: 10,
    groups: [{ count: 1, dataCodewords: 16 }]
  }, {
    version: 2,
    dataCodewords: 28,
    errorCorrectionCodewords: 16,
    groups: [{ count: 1, dataCodewords: 28 }]
  }, {
    version: 3,
    dataCodewords: 44,
    errorCorrectionCodewords: 26,
    groups: [{ count: 1, dataCodewords: 44 }]
  }, {
    version: 4,
    dataCodewords: 64,
    errorCorrectionCodewords: 18,
    groups: [{ count: 2, dataCodewords: 32 }]
  }, {
    version: 5,
    dataCodewords: 86,
    errorCorrectionCodewords: 24,
    groups: [{ count: 2, dataCodewords: 43 }]
  }, {
    version: 6,
    dataCodewords: 108,
    errorCorrectionCodewords: 16,
    groups: [{ count: 4, dataCodewords: 27 }]
  }, {
    version: 7,
    dataCodewords: 124,
    errorCorrectionCodewords: 18,
    groups: [{ count: 4, dataCodewords: 31 }]
  }, {
    version: 8,
    dataCodewords: 154,
    errorCorrectionCodewords: 22,
    groups: [{ count: 2, dataCodewords: 38 }, { count: 2, dataCodewords: 39 }]
  }, {
    version: 9,
    dataCodewords: 182,
    errorCorrectionCodewords: 22,
    groups: [{ count: 3, dataCodewords: 36 }, { count: 2, dataCodewords: 37 }]
  }, {
    version: 10,
    dataCodewords: 216,
    errorCorrectionCodewords: 26,
    groups: [{ count: 4, dataCodewords: 43 }, { count: 1, dataCodewords: 44 }]
  }]
}

const ALIGNMENT_PATTERN_POSITIONS: Record<number, number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50]
}

const FINDER_PATTERN_WITH_QUIET_RUN_AFTER = [true, false, true, true, true, false, true, false, false, false, false]
const FINDER_PATTERN_WITH_QUIET_RUN_BEFORE = [false, false, false, false, true, false, true, true, true, false, true]

const reedSolomonExponents: number[] = []
const reedSolomonLogs: number[] = Array(256).fill(0)

let reedSolomonValue = 1

for (let index = 0; index < 255; index++) {
  reedSolomonExponents[index] = reedSolomonValue
  reedSolomonLogs[reedSolomonValue] = index
  reedSolomonValue <<= 1

  if (reedSolomonValue >= 0x100) {
    reedSolomonValue ^= REED_SOLOMON_FIELD
  }
}

export function createQrCode(value: string, options: QrCodeOptions = {}): QrCode {
  const bytes = new TextEncoder().encode(value)
  const errorCorrectionLevel = options.errorCorrectionLevel ?? 'medium'

  if (bytes.length === 0) {
    throw new Error('Enter a URL to generate a QR code.')
  }

  const config = getSmallestVersionConfig(bytes, options.minVersion ?? 1, errorCorrectionLevel)
  const dataCodewords = createDataCodewords(bytes, config)
  const codewords = addErrorCorrectionAndInterleave(dataCodewords, config)

  let bestCode: QrCode | undefined
  let bestPenalty = Number.POSITIVE_INFINITY

  for (let mask = 0; mask < 8; mask++) {
    const code = buildMatrix(config.version, codewords, mask, errorCorrectionLevel)
    const penalty = calculatePenalty(code.modules)

    if (penalty < bestPenalty) {
      bestCode = code
      bestPenalty = penalty
    }
  }

  if (!bestCode) {
    throw new Error('Unable to generate this QR code.')
  }

  return bestCode
}

export function createQrSvgPath(qrCode: QrCode, quietZone = 4): string {
  const path: string[] = []

  for (let y = 0; y < qrCode.size; y++) {
    for (let x = 0; x < qrCode.size; x++) {
      if (getModule(qrCode.modules, x, y)) {
        path.push(`M${x + quietZone} ${y + quietZone}h1v1h-1z`)
      }
    }
  }

  return path.join('')
}

export function getQrSvgViewBox(qrCode: QrCode, quietZone = 4): string {
  const size = qrCode.size + quietZone * 2

  return `0 0 ${size} ${size}`
}

export function getMaxQrByteLength(errorCorrectionLevel: QrErrorCorrectionLevel = 'medium'): number {
  const config = getLargestVersionConfig(errorCorrectionLevel)
  const payloadBits = config.dataCodewords * 8 - 4 - getCharacterCountBits(config.version)

  return Math.floor(payloadBits / 8)
}

function getSmallestVersionConfig(bytes: Uint8Array, minVersion: number, errorCorrectionLevel: QrErrorCorrectionLevel): VersionConfig {
  for (const config of VERSION_CONFIGS[errorCorrectionLevel]) {
    if (config.version < minVersion) {
      continue
    }

    const requiredBits = 4 + getCharacterCountBits(config.version) + bytes.length * 8
    const capacityBits = config.dataCodewords * 8

    if (requiredBits <= capacityBits) {
      return config
    }
  }

  throw new Error(`This QR generator supports URLs up to ${getMaxQrByteLength(errorCorrectionLevel)} UTF-8 bytes at this error correction level.`)
}

function getCharacterCountBits(version: number): number {
  return version < 10 ? 8 : 16
}

function getLargestVersionConfig(errorCorrectionLevel: QrErrorCorrectionLevel): VersionConfig {
  const configs = VERSION_CONFIGS[errorCorrectionLevel]
  const config = configs[configs.length - 1]

  if (!config) {
    throw new Error('No QR versions are configured.')
  }

  return config
}

function getAlignmentPatternPositions(version: number): number[] {
  const positions = ALIGNMENT_PATTERN_POSITIONS[version]

  if (!positions) {
    throw new Error(`QR version ${version} is not configured.`)
  }

  return positions
}

function getModule(modules: boolean[][], x: number, y: number): boolean {
  return modules[y]?.[x] ?? false
}

function setModule(modules: boolean[][], x: number, y: number, value: boolean) {
  const row = modules[y]

  if (!row) {
    throw new Error('QR matrix row is out of bounds.')
  }

  row[x] = value
}

function createDataCodewords(bytes: Uint8Array, config: VersionConfig): number[] {
  const bits: number[] = []
  const capacityBits = config.dataCodewords * 8

  appendBits(bits, BYTE_MODE, 4)
  appendBits(bits, bytes.length, getCharacterCountBits(config.version))

  for (const byte of bytes) {
    appendBits(bits, byte, 8)
  }

  appendBits(bits, 0, Math.min(4, capacityBits - bits.length))

  while (bits.length % 8 !== 0) {
    bits.push(0)
  }

  const codewords: number[] = []

  for (let index = 0; index < bits.length; index += 8) {
    let codeword = 0

    for (let bitOffset = 0; bitOffset < 8; bitOffset++) {
      codeword = (codeword << 1) | (bits[index + bitOffset] ?? 0)
    }

    codewords.push(codeword)
  }

  for (let padCodeword = 0xec; codewords.length < config.dataCodewords; padCodeword = padCodeword === 0xec ? 0x11 : 0xec) {
    codewords.push(padCodeword)
  }

  return codewords
}

function appendBits(bits: number[], value: number, length: number) {
  for (let index = length - 1; index >= 0; index--) {
    bits.push((value >>> index) & 1)
  }
}

function addErrorCorrectionAndInterleave(dataCodewords: number[], config: VersionConfig): number[] {
  const generator = createReedSolomonGenerator(config.errorCorrectionCodewords)
  const blocks: Array<{ data: number[], errorCorrection: number[] }> = []
  let offset = 0

  for (const group of config.groups) {
    for (let index = 0; index < group.count; index++) {
      const data = dataCodewords.slice(offset, offset + group.dataCodewords)
      offset += group.dataCodewords
      blocks.push({
        data,
        errorCorrection: createReedSolomonRemainder(data, generator)
      })
    }
  }

  const result: number[] = []
  const maxDataLength = Math.max(...blocks.map(block => block.data.length))

  for (let index = 0; index < maxDataLength; index++) {
    for (const block of blocks) {
      const codeword = block.data[index]

      if (codeword !== undefined) {
        result.push(codeword)
      }
    }
  }

  for (let index = 0; index < config.errorCorrectionCodewords; index++) {
    for (const block of blocks) {
      const codeword = block.errorCorrection[index]

      if (codeword === undefined) {
        throw new Error('QR error correction block is incomplete.')
      }

      result.push(codeword)
    }
  }

  return result
}

function createReedSolomonGenerator(degree: number): number[] {
  const result = Array<number>(degree).fill(0)
  result[degree - 1] = 1
  let root = 1

  for (let index = 0; index < degree; index++) {
    for (let coefficient = 0; coefficient < degree; coefficient++) {
      let value = reedSolomonMultiply(result[coefficient] ?? 0, root)

      if (coefficient + 1 < degree) {
        value ^= result[coefficient + 1] ?? 0
      }

      result[coefficient] = value
    }

    root = reedSolomonMultiply(root, 0x02)
  }

  return result
}

function createReedSolomonRemainder(data: number[], generator: number[]): number[] {
  const result = Array<number>(generator.length).fill(0)

  for (const codeword of data) {
    const factor = codeword ^ (result.shift() ?? 0)
    result.push(0)

    for (let index = 0; index < generator.length; index++) {
      result[index] = (result[index] ?? 0) ^ reedSolomonMultiply(generator[index] ?? 0, factor)
    }
  }

  return result
}

function reedSolomonMultiply(left: number, right: number): number {
  if (left === 0 || right === 0) {
    return 0
  }

  const exponentIndex = ((reedSolomonLogs[left] ?? 0) + (reedSolomonLogs[right] ?? 0)) % 255
  const value = reedSolomonExponents[exponentIndex]

  if (value === undefined) {
    throw new Error('Unable to multiply QR error correction values.')
  }

  return value
}

function buildMatrix(version: number, codewords: number[], mask: number, errorCorrectionLevel: QrErrorCorrectionLevel): QrCode {
  const size = getSize(version)
  const matrix = createMatrix(size)

  drawFunctionPatterns(matrix, version, errorCorrectionLevel)
  drawCodewords(matrix, codewords, mask)
  drawFormatBits(matrix, mask, errorCorrectionLevel)

  return {
    errorCorrectionLevel,
    version,
    size,
    modules: matrix.modules
  }
}

function getSize(version: number): number {
  return 21 + (version - 1) * 4
}

function createMatrix(size: number): Matrix {
  return {
    modules: Array.from({ length: size }, () => Array<boolean>(size).fill(false)),
    reserved: Array.from({ length: size }, () => Array<boolean>(size).fill(false))
  }
}

function drawFunctionPatterns(matrix: Matrix, version: number, errorCorrectionLevel: QrErrorCorrectionLevel) {
  const size = matrix.modules.length

  drawFinderPattern(matrix, 3, 3)
  drawFinderPattern(matrix, size - 4, 3)
  drawFinderPattern(matrix, 3, size - 4)

  for (let index = 8; index < size - 8; index++) {
    const dark = index % 2 === 0
    setFunctionModule(matrix, index, 6, dark)
    setFunctionModule(matrix, 6, index, dark)
  }

  const alignmentPositions = getAlignmentPatternPositions(version)
  const lastAlignmentPosition = alignmentPositions[alignmentPositions.length - 1]

  for (const y of alignmentPositions) {
    for (const x of alignmentPositions) {
      const overlapsFinder = (x === 6 && y === 6) || (x === 6 && y === lastAlignmentPosition) || (x === lastAlignmentPosition && y === 6)

      if (!overlapsFinder) {
        drawAlignmentPattern(matrix, x, y)
      }
    }
  }

  drawFormatBits(matrix, 0, errorCorrectionLevel)

  if (version >= 7) {
    drawVersionBits(matrix, version)
  }
}

function drawFinderPattern(matrix: Matrix, centerX: number, centerY: number) {
  const size = matrix.modules.length

  for (let y = centerY - 4; y <= centerY + 4; y++) {
    for (let x = centerX - 4; x <= centerX + 4; x++) {
      if (x >= 0 && x < size && y >= 0 && y < size) {
        const distance = Math.max(Math.abs(x - centerX), Math.abs(y - centerY))
        setFunctionModule(matrix, x, y, distance !== 2 && distance !== 4)
      }
    }
  }
}

function drawAlignmentPattern(matrix: Matrix, centerX: number, centerY: number) {
  for (let y = centerY - 2; y <= centerY + 2; y++) {
    for (let x = centerX - 2; x <= centerX + 2; x++) {
      const distance = Math.max(Math.abs(x - centerX), Math.abs(y - centerY))
      setFunctionModule(matrix, x, y, distance !== 1)
    }
  }
}

function drawFormatBits(matrix: Matrix, mask: number, errorCorrectionLevel: QrErrorCorrectionLevel) {
  const size = matrix.modules.length
  const data = (FORMAT_ERROR_CORRECTION_LEVEL_BITS[errorCorrectionLevel] << 3) | mask
  let remainder = data

  for (let index = 0; index < 10; index++) {
    remainder = (remainder << 1) ^ (((remainder >>> 9) & 1) === 1 ? FORMAT_GENERATOR : 0)
  }

  const bits = ((data << 10) | remainder) ^ FORMAT_MASK

  for (let index = 0; index <= 5; index++) {
    setFunctionModule(matrix, 8, index, getBit(bits, index))
  }

  setFunctionModule(matrix, 8, 7, getBit(bits, 6))
  setFunctionModule(matrix, 8, 8, getBit(bits, 7))
  setFunctionModule(matrix, 7, 8, getBit(bits, 8))

  for (let index = 9; index < 15; index++) {
    setFunctionModule(matrix, 14 - index, 8, getBit(bits, index))
  }

  for (let index = 0; index < 8; index++) {
    setFunctionModule(matrix, size - 1 - index, 8, getBit(bits, index))
  }

  for (let index = 8; index < 15; index++) {
    setFunctionModule(matrix, 8, size - 15 + index, getBit(bits, index))
  }

  setFunctionModule(matrix, 8, size - 8, true)
}

function drawVersionBits(matrix: Matrix, version: number) {
  const size = matrix.modules.length
  let remainder = version

  for (let index = 0; index < 12; index++) {
    remainder = (remainder << 1) ^ (((remainder >>> 11) & 1) === 1 ? VERSION_GENERATOR : 0)
  }

  const bits = (version << 12) | remainder

  for (let index = 0; index < 18; index++) {
    const x = size - 11 + (index % 3)
    const y = Math.floor(index / 3)
    const dark = getBit(bits, index)
    setFunctionModule(matrix, x, y, dark)
    setFunctionModule(matrix, y, x, dark)
  }
}

function setFunctionModule(matrix: Matrix, x: number, y: number, dark: boolean) {
  setModule(matrix.modules, x, y, dark)
  setModule(matrix.reserved, x, y, true)
}

function drawCodewords(matrix: Matrix, codewords: number[], mask: number) {
  const size = matrix.modules.length
  let bitIndex = 0
  let movingUp = true

  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) {
      right = 5
    }

    for (let vertical = 0; vertical < size; vertical++) {
      const y = movingUp ? size - 1 - vertical : vertical

      for (let columnOffset = 0; columnOffset < 2; columnOffset++) {
        const x = right - columnOffset

        if (!getModule(matrix.reserved, x, y)) {
          const bit = bitIndex < codewords.length * 8 ? getCodewordBit(codewords, bitIndex) : false
          setModule(matrix.modules, x, y, bit !== shouldApplyMask(mask, x, y))
          bitIndex++
        }
      }
    }

    movingUp = !movingUp
  }
}

function getCodewordBit(codewords: number[], bitIndex: number): boolean {
  const codeword = codewords[Math.floor(bitIndex / 8)] ?? 0
  return ((codeword >>> (7 - (bitIndex % 8))) & 1) === 1
}

function shouldApplyMask(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0:
      return (x + y) % 2 === 0
    case 1:
      return y % 2 === 0
    case 2:
      return x % 3 === 0
    case 3:
      return (x + y) % 3 === 0
    case 4:
      return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0
    case 6:
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0
    case 7:
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0
    default:
      return false
  }
}

function calculatePenalty(modules: boolean[][]): number {
  const size = modules.length
  let penalty = 0
  let darkModules = 0

  for (let y = 0; y < size; y++) {
    let runColor = getModule(modules, 0, y)
    let runLength = 1

    for (let x = 0; x < size; x++) {
      const module = getModule(modules, x, y)

      if (module) {
        darkModules++
      }

      if (x === 0) {
        continue
      }

      if (module === runColor) {
        runLength++
      } else {
        penalty += getRunPenalty(runLength)
        runColor = module
        runLength = 1
      }
    }

    penalty += getRunPenalty(runLength)
  }

  for (let x = 0; x < size; x++) {
    let runColor = getModule(modules, x, 0)
    let runLength = 1

    for (let y = 1; y < size; y++) {
      const module = getModule(modules, x, y)

      if (module === runColor) {
        runLength++
      } else {
        penalty += getRunPenalty(runLength)
        runColor = module
        runLength = 1
      }
    }

    penalty += getRunPenalty(runLength)
  }

  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const color = getModule(modules, x, y)

      if (getModule(modules, x + 1, y) === color && getModule(modules, x, y + 1) === color && getModule(modules, x + 1, y + 1) === color) {
        penalty += 3
      }
    }
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x <= size - 11; x++) {
      if (hasFinderLikePattern(index => getModule(modules, x + index, y))) {
        penalty += 40
      }
    }
  }

  for (let x = 0; x < size; x++) {
    for (let y = 0; y <= size - 11; y++) {
      if (hasFinderLikePattern(index => getModule(modules, x, y + index))) {
        penalty += 40
      }
    }
  }

  const totalModules = size * size
  const densityPenalty = Math.ceil(Math.abs(darkModules * 20 - totalModules * 10) / totalModules) - 1

  return penalty + Math.max(0, densityPenalty) * 10
}

function getRunPenalty(runLength: number): number {
  return runLength >= 5 ? 3 + runLength - 5 : 0
}

function hasFinderLikePattern(getModule: (index: number) => boolean): boolean {
  return matchesPattern(getModule, FINDER_PATTERN_WITH_QUIET_RUN_AFTER) || matchesPattern(getModule, FINDER_PATTERN_WITH_QUIET_RUN_BEFORE)
}

function matchesPattern(getModule: (index: number) => boolean, pattern: boolean[]): boolean {
  return pattern.every((value, index) => getModule(index) === value)
}

function getBit(value: number, index: number): boolean {
  return ((value >>> index) & 1) === 1
}
