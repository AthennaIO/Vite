/**
 * @athenna/vite
 *
 * (c) João Lenon <lenon@athenna.io>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/**
 * Most of the code here was copy-pasted from https://github.com/adonisjs/vite/blob/4.x/src/plugins/edge.ts
 * @credit https://github.com/adonisjs/vite
 */

/* eslint-disable @typescript-eslint/ban-ts-comment */

import path from 'node:path'
import fastifyPlugin from 'fastify-plugin'
import fastifyMiddie from '@fastify/middie'

import { debug } from '#src/debug'
import { View } from '@athenna/view'
import { Vite } from '#src/vite/Vite'
import { EdgeError } from 'edge-error'
import { Config } from '@athenna/config'
import type { ViteDevServer } from 'vite'
import type { FastifyInstance } from 'fastify'
import type { FastifyViteOptions } from '#src/types'
import { Path, Options, Macroable } from '@athenna/common'

export class FastifyVite extends Macroable {
  public scope: FastifyInstance
  public vite: Vite
  public devServer: ViteDevServer
  public options: FastifyViteOptions

  public constructor(scope: FastifyInstance, options: FastifyViteOptions) {
    super()

    this.scope = scope
    this.options = Options.create(options, {
      root: Path.pwd(),
      assetsUrl: '/public/assets',
      buildDirectory: Path.public('assets'),
      dev: Config.is('app.environment', 'production'),
      manifestFile: this.options?.buildDirectory
        ? path.join(this.options.buildDirectory, '.vite/manifest.json')
        : 'public/assets/.vite/manifest.json'
    })
  }

  /**
   * Return vite dev server instance. Only available
   * after calling `ready()` method.
   */
  public getServer() {
    return this.devServer
  }

  /**
   * Return vite helper instance. Only available
   * after calling `ready()` method.
   */
  public getVite() {
    return this.vite
  }

  /**
   * Load vite configuration file and start the dev server.
   * Will not start the dev server if in production.
   */
  public async ready() {
    /**
     * Don't start vite server under production.
     */
    if (this.options.dev) {
      const { mergeConfig, defineConfig, createServer, loadConfigFromFile } =
        await import('vite')

      const defaultConfig = defineConfig({
        // @ts-ignore
        configFile: false,
        server: {
          middlewareMode: true,
          hmr: {
            server: this.scope.server
          }
        },
        appType: 'custom'
      })

      const { config } = await loadConfigFromFile(
        {
          command: 'serve',
          mode: 'development'
        },
        undefined,
        this.options.root
      )

      // @ts-ignore
      this.devServer = await createServer(mergeConfig(defaultConfig, config))

      await this.scope.register(fastifyMiddie, { hook: 'onRequest' })

      this.scope.use(this.devServer.middlewares)

      this.scope.addHook('onClose', () => this.devServer.close())
    } else {
      debug('vite server creation bypassed because app is in production mode.')
    }

    this.vite = new Vite(this.options, this.devServer)

    View.addProperty('vite', this.vite)
    View.addProperty('asset', this.vite.assetPath.bind(this.vite))
    View.addTag('viteReactRefresh', {
      seekable: true,
      block: false,
      compile(parser, buffer, token) {
        let attributes = ''
        if (token.properties.jsArg.trim()) {
          /**
           * Converting a single argument to a SequenceExpression so that we
           * work around the following edge cases.
           *
           * - If someone passes an object literal to the tag, ie { nonce: 'foo' }
           *   it will be parsed as a LabeledStatement and not an object.
           * - If we wrap the object literal inside parenthesis, ie ({nonce: 'foo'})
           *   then we will end up messing other expressions like a variable reference
           *   , or a member expression and so on.
           * - So the best bet is to convert user supplied argument to a sequence expression
           *   and hence ignore it during stringification.
           */
          const jsArg = `a,${token.properties.jsArg}`

          const parsed = parser.utils.transformAst(
            parser.utils.generateAST(jsArg, token.loc, token.filename),
            token.filename,
            parser
          )
          attributes = parser.utils.stringify(parsed.expressions[1])
        }

        /**
         * Get HMR script
         */
        buffer.writeExpression(
          `const __vite_hmr_script = state.vite.getReactHmrScript(${attributes})`,
          token.filename,
          token.loc.start.line
        )

        /**
         * Check if the script exists (only in hot mode)
         */
        buffer.writeStatement(
          'if(__vite_hmr_script) {',
          token.filename,
          token.loc.start.line
        )

        /**
         * Write output
         */
        buffer.outputExpression(
          `__vite_hmr_script.toString()`,
          token.filename,
          token.loc.start.line,
          false
        )

        /**
         * Close if block
         */
        buffer.writeStatement('}', token.filename, token.loc.start.line)
      }
    })

    View.addTag('vite', {
      seekable: true,
      block: false,
      compile(parser, buffer, token) {
        /**
         * Ensure an argument is defined
         */
        if (!token.properties.jsArg.trim()) {
          throw new EdgeError(
            'Missing entrypoint name',
            'E_RUNTIME_EXCEPTION',
            {
              filename: token.filename,
              line: token.loc.start.line,
              col: token.loc.start.col
            }
          )
        }

        const parsed = parser.utils.transformAst(
          parser.utils.generateAST(
            token.properties.jsArg,
            token.loc,
            token.filename
          ),
          token.filename,
          parser
        )

        const entrypoints = parser.utils.stringify(parsed)
        const methodCall =
          parsed.type === 'SequenceExpression'
            ? `generateEntryPointsTags${entrypoints}`
            : `generateEntryPointsTags(${entrypoints})`

        buffer.outputExpression(
          `(await state.vite.${methodCall}).join('\\n')`,
          token.filename,
          token.loc.start.line,
          false
        )
      }
    })
  }
}

export default fastifyPlugin(
  async (scope, options) => {
    scope.decorate('vite', new FastifyVite(scope, options))
  },
  {
    fastify: '5.x',
    name: '@athenna/vite'
  }
)
