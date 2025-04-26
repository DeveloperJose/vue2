const path = require('path')
const alias = require('@rollup/plugin-alias')
const cjs = require('@rollup/plugin-commonjs')
const replace = require('@rollup/plugin-replace')
const node = require('@rollup/plugin-node-resolve').nodeResolve
const ts = require('rollup-plugin-typescript2')

const version = process.env.VERSION || require('../package.json').version
const featureFlags = require('./feature-flags')

const banner =
  '/*!\n' +
  ` * (Custom AWBW) Vue.js v${version}\n` +
  ` * (c) 2014-${new Date().getFullYear()} Evan You\n` +
  ' * Released under the MIT License.\n' +
  ' */'

const aliases = require('./alias')
const resolve = p => {
  const base = p.split('/')[0]
  if (aliases[base]) {
    return path.resolve(aliases[base], p.slice(base.length + 1))
  } else {
    return path.resolve(__dirname, '../', p)
  }
}

// we are bundling forked consolidate.js in compiler-sfc which dynamically
// requires a ton of template engines which should be ignored.
const consolidatePath = require.resolve('@vue/consolidate/package.json', {
  paths: [path.resolve(__dirname, '../packages/compiler-sfc')]
})

const builds = {
  // Runtime+compiler development build (Browser)
  'full-dev': {
    entry: resolve('web/entry-runtime-with-compiler.ts'),
    dest: resolve(
      '/home/developerjose/local-debian/awbw/public_html/js/vue.js'
    ),
    format: 'umd',
    env: 'development',
    alias: { he: './entity-decoder' },
    banner
  },
  // Runtime+compiler production build  (Browser)
  'full-prod': {
    entry: resolve('web/entry-runtime-with-compiler.ts'),
    dest: resolve(
      '/home/developerjose/local-debian/awbw/public_html/js/vue.min.js'
    ),
    format: 'umd',
    env: 'production',
    alias: { he: './entity-decoder' },
    banner
  }
}

function genConfig(name) {
  const opts = builds[name]
  const isTargetingBrowser = !(
    opts.transpile === false || opts.format === 'cjs'
  )

  // console.log('__dir', __dirname)
  const config = {
    input: opts.entry,
    external: opts.external,
    plugins: [
      alias({
        entries: Object.assign({}, aliases, opts.alias)
      }),
      ts({
        tsconfig: path.resolve(__dirname, '../', 'tsconfig.json'),
        cacheRoot: path.resolve(__dirname, '../', 'node_modules/.rts2_cache'),
        tsconfigOverride: {
          compilerOptions: {
            // if targeting browser, target es5
            // if targeting node, es2017 means Node 8
            target: isTargetingBrowser ? 'es5' : 'es2017'
          },
          include: isTargetingBrowser ? ['src'] : ['src', 'packages/*/src'],
          exclude: ['test', 'test-dts']
        }
      })
    ].concat(opts.plugins || []),
    output: {
      file: opts.dest,
      format: opts.format,
      banner: opts.banner,
      name: opts.moduleName || 'Vue',
      exports: 'auto'
    },
    onwarn: (msg, warn) => {
      if (!/Circular/.test(msg)) {
        warn(msg)
      }
    }
  }

  // console.log('pluging', config.plugins)

  // built-in vars
  const vars = {
    __VERSION__: version,
    __DEV__: `process.env.NODE_ENV !== 'production'`,
    __TEST__: false,
    __GLOBAL__: opts.format === 'umd' || name.includes('browser')
  }
  // feature flags
  Object.keys(featureFlags).forEach(key => {
    vars[`process.env.${key}`] = featureFlags[key]
  })
  // build-specific env
  if (opts.env) {
    vars['process.env.NODE_ENV'] = JSON.stringify(opts.env)
    vars.__DEV__ = opts.env !== 'production'
  }

  vars.preventAssignment = true
  config.plugins.push(replace(vars))

  Object.defineProperty(config, '_name', {
    enumerable: false,
    value: name
  })

  return config
}

if (process.env.TARGET) {
  module.exports = genConfig(process.env.TARGET)
} else {
  exports.getBuild = genConfig
  exports.getAllBuilds = () => Object.keys(builds).map(genConfig)
}
