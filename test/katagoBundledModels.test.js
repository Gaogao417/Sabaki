/**
 * Katago 引擎适配 — 内置 model + 用户配置二进制
 *
 * Test contract: docs/design/2026-05-16/katago-engine-bundled-models/test-contract-v0.2.md
 *
 * Run with: npx mocha --require test/helpers/katagoTestSetup.js --require tsx test/katagoBundledModels.test.js
 *
 * 测试覆盖 6 个契约：
 *   Contract 1: getKatagoDataPath — dev/production 路径解析
 *   Contract 2: listBundledModels — model 发现与分类
 *   Contract 3: getBundledConfig — gtp.cfg 路径
 *   Contract 4: detectEngines 修改 — args 指向内置 model/config
 *   Contract 5: HumanSL — 从内置获取
 *   Contract 6: 打包配置 — extraResources
 *
 * Test Legitimacy:
 *   所有测试 import 生产代码路径，不本地重实现。
 *   生产模块不存在时测试应 FAIL（import 失败），而非 silent pass。
 */

import assert from 'assert'
import nodePath from 'path'
import fs from 'fs'

import {
  getKatagoDataPath,
  listBundledModels,
  selectDefaultAnalysisModel,
  getBundledHumanSLModel,
  getBundledConfig,
} from '../src/modules/katago/katagoBundledAssets.js'

import {detectEngines} from '../src/modules/enginesyncer.js'

// ─── Test helpers ────────────────────────────────────────

function existsFrom(paths) {
  let existing = new Set(paths)
  return (candidate) => existing.has(candidate)
}

function makeReaddir(files) {
  return () => files
}

function makeStat(files) {
  return (p) => {
    let entry = files.find((f) => f.path === p)
    if (entry) return {size: entry.size}
    throw new Error('ENOENT')
  }
}

// ─── Tests ───────────────────────────────────────────────

describe('katago bundled models', () => {
  // ─── Contract 1: getKatagoDataPath ────────────────────
  //
  // Production subject: src/modules/katago/katagoBundledAssets.js → getKatagoDataPath
  // Production bug that would fail: returning wrong path for either environment

  describe('Contract 1: getKatagoDataPath', () => {
    it('returns project root katago_data in dev mode', () => {
      let result = getKatagoDataPath({
        isPackaged: false,
        resourcesPath: '/fake/resources',
        appRoot: '/project',
      })
      assert.equal(result, '/project/katago_data')
    })

    it('returns resourcesPath/katago_data in production', () => {
      let result = getKatagoDataPath({
        isPackaged: true,
        resourcesPath: '/app/Sabaki.app/Contents/Resources',
        appRoot: '/project',
      })
      assert.equal(result, '/app/Sabaki.app/Contents/Resources/katago_data')
    })

    it('always returns an absolute path', () => {
      let dev = getKatagoDataPath({isPackaged: false, resourcesPath: '/f', appRoot: '/p'})
      let prod = getKatagoDataPath({isPackaged: true, resourcesPath: '/a/R', appRoot: '/p'})
      assert.ok(nodePath.isAbsolute(dev))
      assert.ok(nodePath.isAbsolute(prod))
    })

    it('does not throw when directory does not exist', () => {
      let result = getKatagoDataPath({
        isPackaged: true,
        resourcesPath: '/nonexistent/Resources',
        appRoot: '/nonexistent',
      })
      assert.equal(result, '/nonexistent/Resources/katago_data')
    })
  })

  // ─── Contract 2: listBundledModels ────────────────────
  //
  // Production subject: src/modules/katago/katagoBundledAssets.js → listBundledModels
  // Production bug that would fail: wrong file filtering, missing kind field, wrong classification

  describe('Contract 2: listBundledModels', () => {
    it('filters .bin.gz model files and excludes non-models', () => {
      let result = listBundledModels('/data', {
        readdirSync: makeReaddir([
          'gtp.cfg', 'model-a.bin.gz', 'model-b.bin.gz', 'readme.txt',
        ]),
        statSync: makeStat([
          {path: '/data/model-a.bin.gz', size: 100},
          {path: '/data/model-b.bin.gz', size: 200},
        ]),
      })
      assert.equal(result.length, 2)
      assert.equal(result[0].filename, 'model-a.bin.gz')
      assert.equal(result[1].filename, 'model-b.bin.gz')
    })

    it('includes .bin files without .gz', () => {
      let result = listBundledModels('/data', {
        readdirSync: makeReaddir(['model.bin', 'model.bin.gz']),
        statSync: makeStat([
          {path: '/data/model.bin', size: 50},
          {path: '/data/model.bin.gz', size: 100},
        ]),
      })
      assert.equal(result.length, 2)
    })

    it('excludes non-model files', () => {
      let result = listBundledModels('/data', {
        readdirSync: makeReaddir(['gtp.cfg', 'notes.md', '.DS_Store']),
        statSync: makeStat([]),
      })
      assert.deepEqual(result, [])
    })

    it('returns empty for empty directory', () => {
      let result = listBundledModels('/data', {
        readdirSync: makeReaddir([]),
        statSync: makeStat([]),
      })
      assert.deepEqual(result, [])
    })

    it('returns empty when directory does not exist', () => {
      let result = listBundledModels('/data', {
        readdirSync: () => { throw new Error('ENOENT') },
        statSync: makeStat([]),
      })
      assert.deepEqual(result, [])
    })

    it('returns objects with filename, path, size, and kind', () => {
      let result = listBundledModels('/data', {
        readdirSync: makeReaddir(['kata1.bin.gz']),
        statSync: makeStat([{path: '/data/kata1.bin.gz', size: 93952768}]),
      })
      assert.equal(result[0].filename, 'kata1.bin.gz')
      assert.equal(result[0].path, '/data/kata1.bin.gz')
      assert.equal(result[0].size, 93952768)
      assert.equal(result[0].kind, 'analysis')
    })

    it('classifies HumanSL model as kind=humanSL', () => {
      let result = listBundledModels('/data', {
        readdirSync: makeReaddir(['b18c384nbt-humanv0.bin.gz']),
        statSync: makeStat([{path: '/data/b18c384nbt-humanv0.bin.gz', size: 90000000}]),
      })
      assert.equal(result[0].kind, 'humanSL')
    })

    it('path is absolute', () => {
      let result = listBundledModels('/data', {
        readdirSync: makeReaddir(['model.bin.gz']),
        statSync: makeStat([{path: '/data/model.bin.gz', size: 100}]),
      })
      assert.ok(nodePath.isAbsolute(result[0].path))
    })
  })

  // ─── Contract 2b: selectDefaultAnalysisModel ─────────
  //
  // Production subject: src/modules/katago/katagoBundledAssets.js → selectDefaultAnalysisModel
  // Production bug that would fail: selecting humanSL model as analysis, or selecting nothing when analysis exists

  describe('selectDefaultAnalysisModel', () => {
    it('selects first analysis model from mixed list', () => {
      let models = [
        {filename: 'b18c384nbt-humanv0.bin.gz', kind: 'humanSL'},
        {filename: 'kata1-b18c384nbt-s9996.bin.gz', kind: 'analysis'},
        {filename: 'g170-b40c256x2-s5095.bin.gz', kind: 'analysis'},
      ]
      let selected = selectDefaultAnalysisModel(models)
      assert.equal(selected.filename, 'kata1-b18c384nbt-s9996.bin.gz')
    })

    it('never selects a humanSL model as analysis model', () => {
      let models = [
        {filename: 'b18c384nbt-humanv0.bin.gz', kind: 'humanSL'},
      ]
      let selected = selectDefaultAnalysisModel(models)
      assert.equal(selected, null)
    })

    it('returns null when no analysis models available', () => {
      assert.equal(selectDefaultAnalysisModel([]), null)
    })
  })

  // ─── Contract 2c: getBundledHumanSLModel ──────────────
  //
  // Production subject: src/modules/katago/katagoBundledAssets.js → getBundledHumanSLModel
  // Production bug that would fail: returning wrong model or null when humanSL exists

  describe('getBundledHumanSLModel', () => {
    it('finds HumanSL model among mixed models', () => {
      let models = [
        {filename: 'kata1-b18c384nbt-s9996.bin.gz', kind: 'analysis'},
        {filename: 'b18c384nbt-humanv0.bin.gz', kind: 'humanSL'},
      ]
      let humanSL = getBundledHumanSLModel(models)
      assert.equal(humanSL.filename, 'b18c384nbt-humanv0.bin.gz')
    })

    it('returns null when no HumanSL model available', () => {
      let models = [
        {filename: 'kata1-b18c384nbt-s9996.bin.gz', kind: 'analysis'},
      ]
      assert.equal(getBundledHumanSLModel(models), null)
    })
  })

  // ─── Contract 3: getBundledConfig ──────────────────────
  //
  // Production subject: src/modules/katago/katagoBundledAssets.js → getBundledConfig
  // Production bug that would fail: wrong path, wrong available flag

  describe('Contract 3: getBundledConfig', () => {
    it('returns available=true when config exists', () => {
      let result = getBundledConfig('/data', {
        existsSync: existsFrom(['/data/gtp.cfg']),
      })
      assert.equal(result.path, '/data/gtp.cfg')
      assert.equal(result.available, true)
    })

    it('returns available=false when config missing', () => {
      let result = getBundledConfig('/data', {existsSync: () => false})
      assert.equal(result.path, '/data/gtp.cfg')
      assert.equal(result.available, false)
    })

    it('always returns an absolute path', () => {
      let result = getBundledConfig('/data', {existsSync: () => false})
      assert.ok(nodePath.isAbsolute(result.path))
    })
  })

  // ─── Contract 4: detectEngines ─────────────────────────
  //
  // Production subject: src/modules/enginesyncer.js → detectEngines
  // Production bug that would fail: args containing /opt/homebrew/bin as model path,
  //   args not containing katago_data, -model pointing to humanSL

  describe('Contract 4: detectEngines', () => {
    it('returns an array', () => {
      let result = detectEngines()
      assert.ok(Array.isArray(result))
    })

    it('returned engine objects have required fields', () => {
      let result = detectEngines()
      for (let engine of result) {
        assert.ok('name' in engine, 'missing name')
        assert.ok('path' in engine, 'missing path')
        assert.ok('args' in engine, 'missing args')
        assert.ok('commands' in engine, 'missing commands')
        assert.equal(typeof engine.name, 'string')
        assert.equal(typeof engine.path, 'string')
        assert.equal(typeof engine.args, 'string')
        assert.equal(typeof engine.commands, 'string')
      }
    })

    it('engine name is capitalized', () => {
      let result = detectEngines()
      for (let engine of result) {
        assert.equal(engine.name[0], engine.name[0].toUpperCase())
      }
    })

    // Post-fix contracts: these assert on the NEW behavior.
    // Production bug: detectEngines still uses findModelFile(binaryDir)
    //   → args would contain /opt/homebrew/bin/ as model path → FAIL

    it('katago args reference katago_data, not binary directory', () => {
      let result = detectEngines()
      let katago = result.find((e) => /katago/i.test(e.name))
      if (!katago) {
        assert.fail(
          'KataGo binary found on this machine but detectEngines did not return it. ' +
          'Either katago is not installed, or detectEngines is broken.'
        )
      }

      assert.ok(!katago.args.includes('/opt/homebrew/bin/'),
        `args should not reference binary dir: ${katago.args}`)
      assert.ok(!katago.args.includes('/usr/local/bin/'),
        `args should not reference binary dir: ${katago.args}`)
      assert.ok(katago.args.includes('katago_data'),
        `args should reference katago_data: ${katago.args}`)
    })

    it('katago args include -config when bundled config exists', () => {
      let katagoDataPath = nodePath.join(process.cwd(), 'katago_data')
      if (!fs.existsSync(nodePath.join(katagoDataPath, 'gtp.cfg'))) {
        assert.fail('gtp.cfg not found in katago_data/ — this is a required bundled resource')
      }

      let result = detectEngines()
      let katago = result.find((e) => /katago/i.test(e.name))
      if (!katago) {
        assert.fail('KataGo not detected despite being installed')
      }

      assert.ok(katago.args.includes('-config'),
        `args should include -config: ${katago.args}`)
    })

    it('-model flag uses analysis model, never humanSL model', () => {
      let result = detectEngines()
      let katago = result.find((e) => /katago/i.test(e.name))
      if (!katago) {
        assert.fail('KataGo not detected despite being installed')
      }

      let modelMatch = katago.args.match(/-model\s+"?([^"\s]+)"?/)
      if (!modelMatch) {
        assert.fail(`args should contain -model flag: ${katago.args}`)
      }

      assert.ok(!modelMatch[1].includes('human'),
        `-model should not use humanSL model: ${modelMatch[1]}`)
    })
  })

  // ─── Contract 5: HumanSL model ─────────────────────────
  //
  // Production subject: src/modules/katago/katagoBundledAssets.js → listBundledModels + getBundledHumanSLModel
  // Production bug that would fail: humanSL file missing from katago_data

  describe('Contract 5: HumanSL bundled model', () => {
    it('humanSL model file exists in katago_data', () => {
      let katagoDataPath = nodePath.join(process.cwd(), 'katago_data')
      let humanSLPath = nodePath.join(katagoDataPath, 'b18c384nbt-humanv0.bin.gz')

      assert.ok(
        fs.existsSync(humanSLPath),
        `HumanSL model not found at ${humanSLPath}. Add b18c384nbt-humanv0.bin.gz to katago_data/`,
      )
    })

    it('listBundledModels finds the humanSL model and classifies it correctly', () => {
      let katagoDataPath = nodePath.join(process.cwd(), 'katago_data')
      let models = listBundledModels(katagoDataPath, {
        readdirSync: (dir) => fs.readdirSync(dir),
        statSync: (p) => fs.statSync(p),
      })

      let humanSL = getBundledHumanSLModel(models)
      assert.ok(humanSL, 'katago_data should contain a humanSL model')
      assert.equal(humanSL.kind, 'humanSL')
      assert.ok(humanSL.filename.includes('human'), `expected humanSL filename, got: ${humanSL.filename}`)
    })

    it('selectDefaultAnalysisModel does not select the humanSL model', () => {
      let katagoDataPath = nodePath.join(process.cwd(), 'katago_data')
      let models = listBundledModels(katagoDataPath, {
        readdirSync: (dir) => fs.readdirSync(dir),
        statSync: (p) => fs.statSync(p),
      })

      let analysis = selectDefaultAnalysisModel(models)
      if (analysis) {
        assert.notEqual(analysis.kind, 'humanSL',
          `analysis model should not be humanSL, got: ${analysis.filename}`)
      }
    })
  })

  // ─── Contract 6: packaging config ──────────────────────
  //
  // Production subject: package.json (static resource)
  // Production bug that would fail: missing extraResources entry, .bin.gz excluded

  describe('Contract 6: packaging config', () => {
    let packageJson

    before(async () => {
      let content = await fs.promises.readFile(
        nodePath.join(process.cwd(), 'package.json'),
        'utf-8',
      )
      packageJson = JSON.parse(content)
    })

    it('extraResources includes katago_data', () => {
      let extra = packageJson.build?.extraResources
      assert.ok(Array.isArray(extra), 'build.extraResources should be an array')

      let katagoEntry = extra.find(
        (e) => typeof e === 'object' && e.from === 'katago_data',
      )
      assert.ok(katagoEntry, 'extraResources should include katago_data entry')
      assert.equal(katagoEntry.to, 'katago_data')
    })

    it('files array does not exclude .bin.gz', () => {
      let files = packageJson.build?.files || []
      let excludesBinGz = files.some(
        (f) => typeof f === 'string' && f.includes('.bin.gz') && f.startsWith('!'),
      )
      assert.ok(!excludesBinGz, 'files should not exclude .bin.gz')
    })
  })
})
