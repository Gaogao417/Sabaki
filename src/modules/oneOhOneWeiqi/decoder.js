/**
 * 101weiqi.com XOR payload decoder.
 *
 * The board content is encrypted with a key derived from the "r" field:
 *   key = "101" + (r+1).toString().repeat(3)
 * Each byte of the base64-decoded payload is XORed with the cycling key.
 */

/**
 * Decode an encrypted 101weiqi payload.
 * @param {string} encodedText - Base64-encoded encrypted content
 * @param {number} r - Numeric key seed from the page
 * @returns {string} Decoded plaintext
 */
export function decodePayload(encodedText, r) {
  const n = String(Number(r) + 1)
  const key = `101${n}${n}${n}`
  const bytes = Buffer.from(encodedText, 'base64')

  let result = ''
  for (let i = 0; i < bytes.length; i++) {
    result += String.fromCharCode(bytes[i] ^ key.charCodeAt(i % key.length))
  }
  return result
}

/**
 * Extract question data (qqdata) from a problem page HTML.
 * @param {string} html - Full HTML source of a problem page
 * @returns {{ r: number, c: string, content?: string, qid?: string, publicid?: string, prepos?: any[], lu?: number, blackfirst?: boolean, ok_answers?: string, fail_answers?: string, ans_count?: number, yes_count?: number, no_count?: number, qtypename?: string, levelname?: string, title?: string, desc?: string, username?: string, vote?: number, answers?: any[] } | null}
 */
export function extractQuestionData(html) {
  const match = html.match(/var qqdata\s*=\s*(\{[\s\S]*?\})\s*;\s*\n/)
  if (!match) return null

  try {
    return JSON.parse(match[1])
  } catch {
    try {
      return JSON.parse(match[1].replace(/,\s*([}\]])/g, '$1'))
    } catch {
      return null
    }
  }
}

/**
 * Extract the CSRF token from a login page HTML.
 * @param {string} html - Full HTML source of the login page
 * @returns {string|null}
 */
export function extractCsrfToken(html) {
  const match = html.match(/name=['"]csrfmiddlewaretoken['"][^>]*value=['"]([^'"]+)['"]/)
    || html.match(/value=['"]([^'"]+)['"][^>]*name=['"]csrfmiddlewaretoken['"]/)
  return match ? match[1] : null
}

/**
 * Extract problem cards from the error book page HTML.
 * @param {string} html - Full HTML source of the /error/ page
 * @returns {Array<{problemId: string, problemUrl: string, thumbnailUrl: string|null, problemCode: string, rank: string, correctCount: number|null, wrongCount: number|null}>}
 */
export function extractProblemCards(html) {
  const cards = []
  // Split HTML by the card class marker, then extract each chunk
  const parts = html.split(/<div[^>]*class=['"][^'"]*col-md-2[^'"]*col-xs-6[^'"]*col-sm-3[^'"]*['"][^>]*>/)

  for (let i = 1; i < parts.length; i++) {
    const cardHtml = parts[i]

    // Extract problem ID and URL from link
    const linkMatch = cardHtml.match(/href=['"]\/error\/(\d+)\/['"]/)
    if (!linkMatch) continue
    const problemId = linkMatch[1]
    const problemUrl = `https://www.101weiqi.com/error/${problemId}/`

    // Extract thumbnail
    const imgMatch = cardHtml.match(/<img[^>]+src=['"]([^'"]+)['"]/)
    const thumbnailUrl = imgMatch ? imgMatch[1] : null

    // Extract problem code, rank, and stats from .warptext divs
    const warpTexts = []
    const warpRegex = /class=['"]warptext['"][^>]*>([\s\S]*?)<\/div>/g
    let warpMatch
    while ((warpMatch = warpRegex.exec(cardHtml)) !== null) {
      warpTexts.push(warpMatch[1].replace(/<[^>]+>/g, '').trim())
    }

    let problemCode = ''
    let rank = ''
    let correctCount = null
    let wrongCount = null

    // First warptext: "Q-409082  4K"
    if (warpTexts[0]) {
      const codeParts = warpTexts[0].split(/\s+/)
      problemCode = codeParts[0] || ''
      rank = codeParts.slice(1).join(' ')
    }

    // Second warptext: "1052对/485错"
    if (warpTexts[1]) {
      const statsMatch = warpTexts[1].match(/(\d+)对\/(\d+)错/)
      if (statsMatch) {
        correctCount = parseInt(statsMatch[1], 10)
        wrongCount = parseInt(statsMatch[2], 10)
      }
    }

    cards.push({
      problemId,
      problemUrl,
      thumbnailUrl,
      problemCode,
      rank,
      correctCount,
      wrongCount,
    })
  }

  return cards
}

/**
 * Extract pagination "next" URL from the error book page HTML.
 * @param {string} html - Full HTML source of the /error/ page
 * @returns {string|null} Relative URL of the next page, or null
 */
export function extractNextPageUrl(html) {
  // Look for pagination links - 101weiqi uses various pagination patterns
  const nextMatch = html.match(/<a[^>]*href=['"]([^'"]*)['"][^>]*>\s*下一页\s*<\/a>/)
    || html.match(/<a[^>]*href=['"]([^'"]*)['"][^>]*>\s*Next\s*<\/a>/i)
    || html.match(/<li[^>]*class=['"][^'"]*next[^'"]*['"][^>]*>\s*<a[^>]*href=['"]([^'"]*)['"]/)

  if (nextMatch && nextMatch[1] && nextMatch[1] !== '#') {
    return nextMatch[1]
  }

  return null
}

/**
 * Convert 101weiqi coord format (e.g. "pa", "sf") to SGF coord format.
 * @param {string} coord - 101weiqi coordinate string
 * @param {number} boardSize - Board size
 * @returns {string} SGF coordinate
 */
export function coordToSgf(coord, boardSize) {
  if (!coord || coord.length < 2) return ''
  const col = coord.charCodeAt(0) - 'a'.charCodeAt(0)
  const row = coord.charCodeAt(1) - 'a'.charCodeAt(0)
  if (col < 0 || col >= boardSize || row < 0 || row >= boardSize) return ''
  const sgfCol = String.fromCharCode('a'.charCodeAt(0) + col)
  const sgfRow = String.fromCharCode('a'.charCodeAt(0) + (boardSize - 1 - row))
  return sgfCol + sgfRow
}

/**
 * Generate an SGF string from decoded 101weiqi question data.
 * @param {object} qdata - Decoded question data object
 * @returns {string|null} SGF string, or null if data is insufficient
 */
export function questionToSgf(qdata) {
  if (!qdata) return null

  const lu = qdata.lu || 19
  let sgf = `(;GM[1]FF[4]SZ[${lu}]`

  if (qdata.title) sgf += `GN[${qdata.title}]`
  if (qdata.desc) sgf += `PB[${qdata.desc}]`
  if (qdata.qtypename) sgf += `RE[${qdata.qtypename}]`

  // Pre-position stones
  if (qdata.prepos && qdata.prepos.length >= 2) {
    const blacks = qdata.prepos[0] || []
    const whites = qdata.prepos[1] || []
    if (blacks.length > 0) sgf += `AB${blacks.map(p => `[${coordToSgf(p, lu)}]`).join('')}`
    if (whites.length > 0) sgf += `AW${whites.map(p => `[${coordToSgf(p, lu)}]`).join('')}`
  }

  sgf += ')'
  return sgf
}
