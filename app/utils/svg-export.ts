const svgNamespace = 'http://www.w3.org/2000/svg'

const genericFontFamilies = new Set([
  'cursive',
  'fantasy',
  'monospace',
  'sans-serif',
  'serif',
  'system-ui',
  'ui-monospace',
  'ui-sans-serif',
  'ui-serif'
])
const embeddedFontStyleAttribute = 'data-cuteqrcodes-embedded-fonts'
const fontAssetDataUrlCache = new Map<string, Promise<string>>()
const fontFaceRuleCache = new Map<string, Promise<string | null>>()

type UsedFontFace = {
  characters: Set<number>
  styles: Set<string>
}

export function inlineComputedSvgStyles(
  sourceSvg: SVGSVGElement,
  clonedSvg: SVGSVGElement
) {
  const sourceElements = [sourceSvg, ...sourceSvg.querySelectorAll('*')]
  const clonedElements = [clonedSvg, ...clonedSvg.querySelectorAll('*')]
  const styleProperties = [
    'color',
    'fill',
    'font-family',
    'font-size',
    'font-style',
    'font-weight',
    'letter-spacing',
    'opacity',
    'stop-color',
    'stroke'
  ]

  sourceElements.forEach((sourceElement, index) => {
    const clonedElement = clonedElements[index]

    if (!(clonedElement instanceof SVGElement)) {
      return
    }

    const computedStyle = window.getComputedStyle(sourceElement)

    styleProperties.forEach((property) => {
      const value = computedStyle.getPropertyValue(property)

      if (value) {
        clonedElement.style.setProperty(property, value)
      }
    })
  })
}

export async function embedUsedSvgFontFaces(svg: SVGSVGElement) {
  if (hasEmbeddedFontFaces(svg)) {
    return
  }

  const usedFontFaces = getUsedSvgFontFaces(svg)

  if (!usedFontFaces.size) {
    return
  }

  const cssText = await getEmbeddedFontFaceCss(usedFontFaces)

  if (!cssText) {
    return
  }

  const defs = getOrCreateSvgDefs(svg)
  const style = document.createElementNS(svgNamespace, 'style')

  style.setAttribute('type', 'text/css')
  style.setAttribute(embeddedFontStyleAttribute, 'true')
  style.textContent = cssText
  defs.insertBefore(style, defs.firstChild)
}

export async function embedUsedSvgFontFacesInText(svgText: string) {
  if (svgText.includes(embeddedFontStyleAttribute)) {
    return svgText
  }

  const parser = new DOMParser()
  const parsedDocument = parser.parseFromString(svgText, 'image/svg+xml')
  const svg = parsedDocument.documentElement

  if (!(svg instanceof SVGSVGElement)) {
    return svgText
  }

  await embedUsedSvgFontFaces(svg)

  return new XMLSerializer().serializeToString(svg)
}

export async function inlineSvgImages(svg: SVGSVGElement) {
  const images = Array.from(svg.querySelectorAll('image'))

  await Promise.all(
    images.map(async (image) => {
      const href
        = image.getAttribute('href')
          || image.getAttributeNS('http://www.w3.org/1999/xlink', 'href')

      if (!href || href.startsWith('data:')) {
        return
      }

      const response = await fetch(href)

      if (!response.ok) {
        throw new Error(`Unable to load icon for PDF: ${href}`)
      }

      const dataUrl = await blobToDataUrl(await response.blob())

      image.setAttribute('href', dataUrl)
      image.setAttributeNS('http://www.w3.org/1999/xlink', 'href', dataUrl)
    })
  )
}

function hasEmbeddedFontFaces(svg: SVGSVGElement) {
  return Array.from(svg.querySelectorAll('style')).some(style =>
    style.textContent?.includes('@font-face')
  )
}

function getUsedSvgFontFaces(svg: SVGSVGElement) {
  const fontFaces = new Map<string, UsedFontFace>()
  const elements = Array.from(svg.querySelectorAll('text, tspan'))

  elements.forEach((element) => {
    if (!(element instanceof SVGElement)) {
      return
    }

    const fontFamily
      = element.style.getPropertyValue('font-family')
        || element.getAttribute('font-family')
        || (element.isConnected ? window.getComputedStyle(element).fontFamily : '')

    const text = element.textContent ?? ''
    const fontStyle = normalizeFontStyle(
      element.style.getPropertyValue('font-style')
      || element.getAttribute('font-style')
      || (element.isConnected ? window.getComputedStyle(element).fontStyle : '')
    )

    parseFontFamilyList(fontFamily).forEach((family) => {
      const normalizedFamily = normalizeFontFamily(family)

      if (normalizedFamily && !genericFontFamilies.has(normalizedFamily)) {
        const fontFace = fontFaces.get(normalizedFamily) ?? {
          characters: new Set<number>(),
          styles: new Set<string>()
        }

        fontFace.styles.add(fontStyle)

        Array.from(text).forEach((character) => {
          fontFace.characters.add(character.codePointAt(0) ?? 0)
        })

        fontFaces.set(normalizedFamily, fontFace)
      }
    })
  })

  return fontFaces
}

function parseFontFamilyList(value: string) {
  const fontFamilies: string[] = []
  let currentValue = ''
  let quoteCharacter = ''

  for (const character of value) {
    if (quoteCharacter) {
      currentValue += character

      if (character === quoteCharacter) {
        quoteCharacter = ''
      }

      continue
    }

    if (character === '\'' || character === '"') {
      quoteCharacter = character
      currentValue += character
      continue
    }

    if (character === ',') {
      fontFamilies.push(currentValue)
      currentValue = ''
      continue
    }

    currentValue += character
  }

  if (currentValue.trim()) {
    fontFamilies.push(currentValue)
  }

  return fontFamilies
}

function normalizeFontFamily(value: string) {
  const trimmedValue = value
    .trim()
    .replace(/^['"]/, '')
    .replace(/['"]$/, '')

  if (!trimmedValue || trimmedValue.startsWith('var(')) {
    return ''
  }

  return trimmedValue.toLowerCase()
}

function normalizeFontStyle(value: string) {
  return value.trim().toLowerCase() || 'normal'
}

async function getEmbeddedFontFaceCss(fontFaces: Map<string, UsedFontFace>) {
  const fontFaceRules = collectFontFaceRules(fontFaces)
  const cssRules = await Promise.all(
    fontFaceRules.map(async (rule) => {
      try {
        return await getEmbeddedFontFaceRuleCss(rule)
      } catch {
        return null
      }
    })
  )

  return cssRules.filter(Boolean).join('\n')
}

function collectFontFaceRules(fontFaces: Map<string, UsedFontFace>) {
  const fontFaceRules: CSSFontFaceRule[] = []

  Array.from(document.styleSheets).forEach((styleSheet) => {
    let rules: CSSRuleList

    try {
      rules = styleSheet.cssRules
    } catch {
      return
    }

    collectFontFaceRulesFromList(rules, fontFaceRules)
  })

  return fontFaceRules.filter((rule) => {
    const fontFace = fontFaces.get(
      normalizeFontFamily(rule.style.getPropertyValue('font-family'))
    )

    if (!fontFace) {
      return false
    }

    const fontStyle = normalizeFontStyle(rule.style.getPropertyValue('font-style'))

    return fontFace.styles.has(fontStyle) && fontFaceRuleCoversText(rule, fontFace.characters)
  })
}

function collectFontFaceRulesFromList(
  rules: CSSRuleList,
  fontFaceRules: CSSFontFaceRule[]
) {
  Array.from(rules).forEach((rule) => {
    if (isFontFaceRule(rule)) {
      fontFaceRules.push(rule)
      return
    }

    const nestedRule = rule as CSSRule & { cssRules?: CSSRuleList }

    if (nestedRule.cssRules) {
      try {
        collectFontFaceRulesFromList(nestedRule.cssRules, fontFaceRules)
      } catch {
        // Some nested external rule lists are not readable in every browser.
      }
    }
  })
}

function isFontFaceRule(rule: CSSRule): rule is CSSFontFaceRule {
  if (typeof CSSFontFaceRule !== 'undefined') {
    return rule instanceof CSSFontFaceRule
  }

  return rule.type === CSSRule.FONT_FACE_RULE
}

function fontFaceRuleCoversText(rule: CSSFontFaceRule, characters: Set<number>) {
  const unicodeRanges = parseUnicodeRanges(rule.style.getPropertyValue('unicode-range'))

  if (!unicodeRanges.length || !characters.size) {
    return true
  }

  return Array.from(characters).some(codePoint =>
    unicodeRanges.some(range => codePoint >= range.start && codePoint <= range.end)
  )
}

function parseUnicodeRanges(value: string) {
  return value
    .split(',')
    .map(part => parseUnicodeRange(part.trim()))
    .filter((range): range is { end: number, start: number } => Boolean(range))
}

function parseUnicodeRange(value: string) {
  if (!value.toUpperCase().startsWith('U+')) {
    return null
  }

  const range = value.slice(2)

  if (range.includes('?')) {
    return {
      end: Number.parseInt(range.replace(/\?/g, 'F'), 16),
      start: Number.parseInt(range.replace(/\?/g, '0'), 16)
    }
  }

  const [start, end] = range.split('-')

  return {
    end: Number.parseInt(end ?? start ?? '', 16),
    start: Number.parseInt(start ?? '', 16)
  }
}

function getEmbeddedFontFaceRuleCss(rule: CSSFontFaceRule) {
  const cacheKey = `${rule.parentStyleSheet?.href ?? document.baseURI}:${rule.cssText}`
  let cachedRule = fontFaceRuleCache.get(cacheKey)

  if (!cachedRule) {
    cachedRule = inlineCssFontUrls(
      rule.cssText,
      rule.parentStyleSheet?.href ?? document.baseURI
    )
    fontFaceRuleCache.set(cacheKey, cachedRule)
  }

  return cachedRule
}

async function inlineCssFontUrls(cssText: string, baseUrl: string) {
  const fontUrlPattern = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g
  const matches = Array.from(cssText.matchAll(fontUrlPattern))

  if (!matches.length) {
    return null
  }

  let inlinedCss = ''
  let lastIndex = 0

  for (const match of matches) {
    const matchIndex = match.index ?? 0
    const rawUrl = match[2]!

    inlinedCss += cssText.slice(lastIndex, matchIndex)

    if (rawUrl.startsWith('data:')) {
      inlinedCss += match[0]
    } else {
      const fontUrl = new URL(rawUrl, baseUrl).href
      const dataUrl = await fetchFontDataUrl(fontUrl)

      inlinedCss += `url("${dataUrl}")`
    }

    lastIndex = matchIndex + match[0].length
  }

  inlinedCss += cssText.slice(lastIndex)

  return inlinedCss
}

function fetchFontDataUrl(url: string) {
  let dataUrl = fontAssetDataUrlCache.get(url)

  if (!dataUrl) {
    dataUrl = fetch(url).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Unable to load font for SVG export: ${url}`)
      }

      return blobToDataUrl(await response.blob())
    })
    fontAssetDataUrlCache.set(url, dataUrl)
  }

  return dataUrl
}

function getOrCreateSvgDefs(svg: SVGSVGElement) {
  const existingDefs = Array.from(svg.children).find(
    (child): child is SVGDefsElement => child.localName === 'defs'
  )

  if (existingDefs) {
    return existingDefs
  }

  const defs = document.createElementNS(svgNamespace, 'defs')

  svg.insertBefore(defs, svg.firstChild)

  return defs
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }

      reject(new Error('Unable to read asset.'))
    })
    reader.addEventListener('error', () =>
      reject(reader.error ?? new Error('Unable to read asset.'))
    )
    reader.readAsDataURL(blob)
  })
}
