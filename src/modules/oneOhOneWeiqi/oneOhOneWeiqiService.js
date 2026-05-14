/**
 * 101weiqi.com integration service.
 *
 * Handles login, error book fetching, problem page decoding, and local caching.
 * Runs in the renderer process (nodeIntegration is enabled).
 */

import EventEmitter from 'events'
import https from 'https'
import {decodePayload, extractQuestionData, extractProblemCards, extractNextPageUrl, questionToSgf} from './decoder.js'

const BASE_URL = 'https://www.101weiqi.com'
const ERROR_BOOK_URL = `${BASE_URL}/error/`
const RETRY_COUNT = 3
const RETRY_DELAY_MS = 2000
const REQUEST_DELAY_MS = 300

/**
 * @typedef {Object} OneOhOneWeiqiProblem
 * @property {string} source - Always '101weiqi'
 * @property {string} problemId
 * @property {string} problemCode
 * @property {string|null} rank
 * @property {string} problemUrl
 * @property {string|null} thumbnailUrl
 * @property {number|null} correctCount
 * @property {number|null} wrongCount
 * @property {string} decodedPayload
 * @property {string} sgf
 * @property {string} syncedAt
 * @property {string} contentHash
 */

/**
 * @typedef {Object} SyncProgress
 * @property {string} phase - 'discovering' | 'fetching' | 'decoding' | 'done' | 'error'
 * @property {number} total
 * @property {number} completed
 * @property {number} succeeded
 * @property {number} failed
 * @property {string|null} currentItem
 * @property {string|null} error
 */

/**
 * Make an HTTP GET request with cookie jar support.
 */
function httpGet(url, cookies = {}, followRedirects = true) {
  return new Promise((resolve, reject) => {
    const attempt = (n) => {
      const cookieHeader = Object.entries(cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ')

      const doRequest = (reqUrl) => {
        https.get(reqUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Cookie': cookieHeader,
          },
        }, (res) => {
          // Collect set-cookie headers
          const setCookies = res.headers['set-cookie'] || []
          const newCookies = {...cookies}
          for (const sc of setCookies) {
            const parts = sc.split(';')[0].split('=')
            if (parts.length >= 2) {
              newCookies[parts[0].trim()] = parts.slice(1).join('=').trim()
            }
          }

          if (followRedirects && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            const nextUrl = res.headers.location.startsWith('http') ? res.headers.location : BASE_URL + res.headers.location
            res.resume()
            return doRequest(nextUrl)
          }

          let data = ''
          res.on('data', (chunk) => { data += chunk })
          res.on('end', () => resolve({
            status: res.statusCode,
            body: data,
            cookies: newCookies,
          }))
        }).on('error', (err) => {
          if (n > 0) setTimeout(() => attempt(n - 1), RETRY_DELAY_MS)
          else reject(err)
        })
      }
      doRequest(url)
    }
    attempt(RETRY_COUNT)
  })
}

/**
 * Make an HTTP POST request with form data.
 */
function httpPost(url, formData, cookies = {}) {
  return new Promise((resolve, reject) => {
    const cookieHeader = Object.entries(cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ')

    const body = Object.entries(formData)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&')

    const urlObj = new URL(url)

    const req = https.request({
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cookie': cookieHeader,
        'Referer': BASE_URL + '/',
      },
    }, (res) => {
      const setCookies = res.headers['set-cookie'] || []
      const newCookies = {...cookies}
      for (const sc of setCookies) {
        const parts = sc.split(';')[0].split('=')
        if (parts.length >= 2) {
          newCookies[parts[0].trim()] = parts.slice(1).join('=').trim()
        }
      }

      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => resolve({
        status: res.statusCode,
        body: data,
        cookies: newCookies,
      }))
    })

    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

function simpleHash(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + c
    hash |= 0
  }
  return hash.toString(36)
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Create a 101weiqi service instance.
 * @param {object} deps
 * @param {object} deps.db - window.sabaki.db bridge
 * @param {object} [deps.logger] - Logger instance
 * @returns {object}
 */
export function createOneOhOneWeiqiService(deps = {}) {
  const {db, logger, setting} = deps
  const emitter = new EventEmitter()

  let cookies = {}
  let isLoggedIn = false
  let username = ''

  /** @type {SyncProgress} */
  let syncProgress = {
    phase: 'done',
    total: 0,
    completed: 0,
    succeeded: 0,
    failed: 0,
    currentItem: null,
    error: null,
  }

  let lastSyncTime = null

  function getState() {
    return {
      isLoggedIn,
      username,
      syncProgress: {...syncProgress},
      lastSyncTime,
    }
  }

  function onStateChange(callback) {
    emitter.on('change', callback)
    return () => emitter.removeListener('change', callback)
  }

  function emitChange() {
    emitter.emit('change', getState())
  }

  function log(level, msg, meta) {
    if (logger) logger[level](`[101weiqi] ${msg}`, meta)
  }

  function saveSession() {
    if (!setting) return
    setting.set('101weiqi.session', JSON.stringify({cookies, username}))
  }

  function clearSavedSession() {
    if (!setting) return
    setting.set('101weiqi.session', null)
  }

  function restoreSession() {
    try {
      const savedSession = setting ? setting.get('101weiqi.session') : null
      if (savedSession) {
        const parsed = JSON.parse(savedSession)
        cookies = parsed.cookies || {}
        username = parsed.username || ''
        isLoggedIn = true
        log('info', 'Restored saved session')
        return true
      }
    } catch { /* no saved session */ }
    return false
  }

  // Auto-restore on creation
  restoreSession()

  // --- Auth ---

  async function login(user, password) {
    log('info', `Attempting login for user: ${user.substring(0, 2)}***`)

    // Step 1: GET / to establish initial cookies
    const pageRes = await httpGet(BASE_URL + '/')
    cookies = pageRes.cookies

    // Step 2: POST /wq/login/ (JSON API, no CSRF needed)
    const loginRes = await httpPost(`${BASE_URL}/wq/login/`, {
      username: user,
      password: password,
    }, cookies)

    cookies = loginRes.cookies

    // Parse JSON response
    let loginData
    try {
      loginData = JSON.parse(loginRes.body)
    } catch {
      throw new Error('登录响应解析失败，请检查网络连接')
    }

    // Check API response: result=0 means success, non-zero or missing sessionid means failure
    if (loginData.result !== 0 && loginData.result !== 'success' && loginData.status !== 'success' && !loginData.success) {
      throw new Error(loginData.msg || loginData.message || '用户名或密码错误')
    }

    // Verify we got a session cookie
    if (!loginRes.cookies.sessionid) {
      throw new Error('登录未获得会话，请重试')
    }

    isLoggedIn = true
    username = user
    saveSession()
    log('info', 'Login successful')
    emitChange()
    return {success: true}
  }

  function logout() {
    cookies = {}
    isLoggedIn = false
    username = ''
    clearSavedSession()
    log('info', 'Logged out')
    emitChange()
  }

  async function checkSession() {
    if (!cookies || !cookies.sessionid) {
      isLoggedIn = false
      emitChange()
      return false
    }

    try {
      const res = await httpGet(ERROR_BOOK_URL, cookies)
      // If we can fetch error book and it has problem cards, session is valid
      const valid = res.status === 200 && res.body.includes('col-md-2')
      if (!valid) {
        isLoggedIn = false
        clearSavedSession()
        emitChange()
      }
      return valid
    } catch {
      return false
    }
  }

  // --- Error Book Sync ---

  /**
   * Sync all problems from the error book.
   * @param {object} [options]
   * @param {boolean} [options.forceAll=false] - Re-download all problems
   * @param {function} [options.onProgress] - Progress callback
   * @returns {Promise<{total: number, succeeded: number, failed: number, skipped: number}>}
   */
  async function syncErrorBook(options = {}) {
    if (!isLoggedIn) {
      throw new Error('请先登录')
    }

    syncProgress = {phase: 'discovering', total: 0, completed: 0, succeeded: 0, failed: 0, currentItem: null, error: null}
    emitChange()

    try {
      // Phase 1: Discover all problem cards
      const allCards = await discoverAllProblems()
      syncProgress.total = allCards.length
      syncProgress.phase = 'fetching'
      emitChange()

      log('info', `Discovered ${allCards.length} problems in error book`)

      // Phase 2: Load existing cache to check for unchanged problems
      let existingCache = {}
      if (!options.forceAll) {
        try {
          const cached = await db.getWeiqi101Problems()
          existingCache = Object.fromEntries(cached.map(p => [p.problemId, p.contentHash]))
        } catch {
          // No existing cache, fetch all
        }
      }

      let succeeded = 0
      let failed = 0
      let skipped = 0

      // Phase 3: Fetch and decode each problem
      for (let i = 0; i < allCards.length; i++) {
        const card = allCards[i]
        syncProgress.currentItem = `#${card.problemId} (${card.problemCode})`
        syncProgress.completed = i
        emitChange()
        if (options.onProgress) options.onProgress(getState())

        try {
          // Quick content hash check - skip if card data unchanged
          const cardHash = simpleHash(`${card.problemId}:${card.problemCode}:${card.correctCount}:${card.wrongCount}`)

          if (!options.forceAll && existingCache[card.problemId] === cardHash) {
            skipped++
            syncProgress.succeeded = succeeded
            syncProgress.failed = failed
            continue
          }

          // Fetch problem page
          await delay(REQUEST_DELAY_MS)
          const pageUrl = `${BASE_URL}/error/${card.problemId}/`
          const pageRes = await httpGet(pageUrl, cookies)

          if (pageRes.status !== 200) {
            throw new Error(`HTTP ${pageRes.status}`)
          }

          // Extract and decode
          const qdata = extractQuestionData(pageRes.body)
          let decodedPayload = ''
          let sgf = ''

          if (qdata) {
            if (qdata.c && typeof qdata.r === 'number') {
              decodedPayload = decodePayload(qdata.c, qdata.r)
            }
            sgf = questionToSgf(qdata) || ''
          }

          const now = new Date().toISOString()

          /** @type {OneOhOneWeiqiProblem} */
          const problem = {
            source: '101weiqi',
            problemId: card.problemId,
            problemCode: card.problemCode,
            rank: card.rank || null,
            problemUrl: card.problemUrl,
            thumbnailUrl: card.thumbnailUrl || null,
            correctCount: card.correctCount,
            wrongCount: card.wrongCount,
            decodedPayload,
            sgf,
            syncedAt: now,
            contentHash: cardHash,
          }

          await db.saveWeiqi101Problem(problem)
          succeeded++
        } catch (err) {
          log('warn', `Failed to sync problem ${card.problemId}: ${err.message}`)
          failed++
        }

        syncProgress.succeeded = succeeded
        syncProgress.failed = failed
      }

      syncProgress.phase = 'done'
      syncProgress.completed = allCards.length
      syncProgress.succeeded = succeeded
      syncProgress.failed = failed
      lastSyncTime = new Date().toISOString()
      emitChange()

      log('info', `Sync complete: ${succeeded} ok, ${failed} failed, ${skipped} skipped`)

      return {total: allCards.length, succeeded, failed, skipped}
    } catch (err) {
      syncProgress.phase = 'error'
      syncProgress.error = err.message
      emitChange()
      throw err
    }
  }

  /**
   * Discover all problem cards by paginating through the error book.
   */
  async function discoverAllProblems() {
    const allCards = []
    let pageUrl = ERROR_BOOK_URL
    const seenUrls = new Set()

    while (pageUrl) {
      if (seenUrls.has(pageUrl)) break
      seenUrls.add(pageUrl)

      const absUrl = pageUrl.startsWith('http') ? pageUrl : BASE_URL + pageUrl
      const res = await httpGet(absUrl, cookies)

      if (res.status !== 200) break

      const cards = extractProblemCards(res.body)
      allCards.push(...cards)

      const nextUrl = extractNextPageUrl(res.body)
      pageUrl = nextUrl || null

      if (pageUrl) await delay(REQUEST_DELAY_MS)
    }

    // Deduplicate by problemId
    const seen = new Set()
    return allCards.filter(card => {
      if (seen.has(card.problemId)) return false
      seen.add(card.problemId)
      return true
    })
  }

  return {
    getState,
    onStateChange,
    login,
    logout,
    checkSession,
    syncErrorBook,
  }
}
