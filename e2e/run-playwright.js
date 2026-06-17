const {spawnSync} = require('child_process')

function hasCommand(command) {
  return spawnSync('sh', ['-lc', `command -v ${command} >/dev/null 2>&1`], {
    stdio: 'ignore',
  }).status === 0
}

const passthroughArgs = process.argv.slice(2)
const command = hasCommand('xvfb-run') ? 'xvfb-run' : 'npx'
const args = command === 'xvfb-run'
  ? ['npx', 'playwright', 'test', ...passthroughArgs]
  : ['playwright', 'test', ...passthroughArgs]

const result = spawnSync(command, args, {stdio: 'inherit'})
process.exit(result.status ?? 1)
