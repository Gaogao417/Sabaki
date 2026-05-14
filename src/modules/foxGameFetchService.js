const {net} = require('electron')

function foxRequest(url, timeout = 10000) {
  return new Promise((resolve, reject) => {
    let request = net.request(url)
    let finished = false

    let timer = setTimeout(() => {
      if (!finished) {
        finished = true
        request.abort()
        reject(Object.assign(new Error('Request timed out'), {code: 'TIMEOUT'}))
      }
    }, timeout)

    request.on('response', (response) => {
      let content = ''

      response.on('data', (chunk) => {
        content += chunk
      })

      response.on('end', () => {
        if (!finished) {
          finished = true
          clearTimeout(timer)
          if (response.statusCode >= 400) {
            reject(
              Object.assign(
                new Error(`HTTP ${response.statusCode}`),
                {code: 'NETWORK_ERROR'},
              ),
            )
          } else {
            resolve(content)
          }
        }
      })
    })

    request.on('error', (err) => {
      if (!finished) {
        finished = true
        clearTimeout(timer)
        reject(Object.assign(err, {code: 'NETWORK_ERROR'}))
      }
    })

    request.end()
  })
}

function extractSgf(raw) {
  let text = typeof raw === 'string' ? raw : ''

  // 1. Direct SGF
  if (text.trimStart().startsWith('(;')) {
    return {success: true, data: text}
  }

  // 2. JSON-wrapped
  try {
    let json = JSON.parse(text)

    if (json.errorCode != null && json.errorCode !== 0 && json.errorCode !== '') {
      return {
        success: false,
        error: json.errMsg || json.msg || 'FoxWQ API error',
        code: 'NO_SGF_FOUND',
      }
    }

    let candidates = [
      json.chess,
      json.msg,
      json.data,
      json.sgf,
      json.content,
    ]

    if (json.msg && typeof json.msg === 'object') {
      candidates.push(json.msg.sgf, json.msg.chess, json.msg.content)
    }

    for (let c of candidates) {
      if (typeof c === 'string' && c.trimStart().startsWith('(;')) {
        return {success: true, data: c}
      }
    }

    // JSON parsed but no SGF found
    return {success: false, error: 'No SGF found in response', code: 'NO_SGF_FOUND', raw: json}
  } catch (_) {
    // Not JSON
  }

  // 3. Unknown format — return raw with uncertainty flag
  return {success: true, data: text, parseUncertain: true}
}

// 野狐段位编码: 1-18 = 18级~1级, 19-27 = 1段~9段
function foxDanLabel(code) {
  let n = Number(code)
  if (!Number.isFinite(n) || n <= 0) return ''
  if (n <= 18) return `${18 - n}级`
  return `${n - 17}段`
}

exports.queryUserByName = async function (username) {
  if (!username || typeof username !== 'string' || !username.trim()) {
    return {success: false, error: 'Please enter a FoxWQ ID', code: 'EMPTY_INPUT'}
  }

  let url =
    'https://newframe.foxwq.com/cgi/QueryUserInfoPanel' +
    `?srcuid=0&username=${encodeURIComponent(username.trim())}`

  let raw
  try {
    raw = await foxRequest(url)
  } catch (err) {
    return {success: false, error: err.message, code: err.code || 'NETWORK_ERROR'}
  }

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (_) {
    return {success: false, error: 'Invalid response from FoxWQ', code: 'PARSE_ERROR', raw}
  }

  console.log('[fox] queryUserByName response:', JSON.stringify(parsed, null, 2).slice(0, 2000))

  let uid = parsed.uid || parsed.msg?.uid || parsed.data?.uid
  if (!uid) {
    return {success: false, error: 'User not found', code: 'USER_NOT_FOUND', raw: parsed}
  }

  return {success: true, uid: String(uid), username, raw: parsed}
}

exports.fetchGameList = async function (uid, lastcode = '') {
  if (!/^\d+$/.test(String(uid))) {
    return {success: false, error: 'Invalid FoxWQ ID', code: 'INVALID_UID'}
  }

  let url =
    'https://h5.foxwq.com/yehuDiamond/chessbook_local/YHWQFetchChessList' +
    `?srcuid=0&dstuid=${uid}&type=1&lastcode=${lastcode}&searchkey=&uin=${uid}`

  let raw
  try {
    raw = await foxRequest(url)
  } catch (err) {
    return {success: false, error: err.message, code: err.code || 'NETWORK_ERROR'}
  }

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (_) {
    return {success: false, error: 'Invalid response from FoxWQ', code: 'PARSE_ERROR', raw}
  }

  console.log('[fox] fetchGameList response:', JSON.stringify(parsed, null, 2).slice(0, 2000))

  let games = parsed.chesslist || parsed.msg
  if (!Array.isArray(games)) {
    games = Array.isArray(parsed.data) ? parsed.data : []
  }

  if (games.length === 0) {
    return {success: false, error: 'No public games found', code: 'EMPTY_LIST', raw: parsed}
  }

  let nextLastcode = null
  let last = games[games.length - 1]
  if (last && last.chessid != null) {
    nextLastcode = String(last.chessid)
  }

  games.forEach((g) => {
    g.blackdanLabel = foxDanLabel(g.blackdan)
    g.whitedanLabel = foxDanLabel(g.whitedan)
  })

  return {success: true, games, nextLastcode, raw: parsed}
}

exports.fetchSgf = async function (chessid) {
  if (!/^\d+$/.test(String(chessid))) {
    return {success: false, error: 'Invalid chessid', code: 'INVALID_CHESSID'}
  }

  let url =
    'https://h5.foxwq.com/yehuDiamond/chessbook_local/YHWQFetchChess' +
    `?chessid=${chessid}`

  let raw
  try {
    raw = await foxRequest(url)
  } catch (err) {
    return {success: false, error: err.message, code: err.code || 'NETWORK_ERROR'}
  }

  let result = extractSgf(raw)
  return result
}
