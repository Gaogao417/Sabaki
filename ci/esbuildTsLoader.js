const esbuild = require('esbuild')

module.exports = function esbuildTsLoader(source) {
  const callback = this.async()

  try {
    const result = esbuild.transformSync(source, {
      loader: this.resourcePath.endsWith('.tsx') ? 'tsx' : 'ts',
      sourcemap: this.sourceMap,
      sourcefile: this.resourcePath,
      target: 'es2020',
    })

    callback(null, result.code, result.map)
  } catch (err) {
    callback(err)
  }
}
