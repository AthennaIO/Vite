/**
 * @athenna/vite
 *
 * (c) João Lenon <lenon@athenna.io>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/**
 * Parameters passed to the setAttributes callback
 */
export type SetAttributesCallbackParams = {
  src: string
  url: string
}

/**
 * Attributes to be set on the script/style tags.
 * Can be either a record or a callback that returns a record.
 */
export type SetAttributes =
  | Record<string, string | boolean>
  | ((params: SetAttributesCallbackParams) => Record<string, string | boolean>)

export type FastifyViteOptions = {
  /**
   * The location of your Vite configuration file.
   *
   * @default Path.pwd()
   */
  root?: string

  /**
   * Verify if is in development mode.
   *
   * @default Config.is('app.environment', 'production')
   */
  dev?: boolean

  /**
   * The URL to prefix when generating assets URLs. For example: This
   * could the CDN URL when generating the production build.
   *
   * @default '/public/assets'
   */
  assetsUrl?: string

  /**
   * Public directory where the assets will be compiled.
   *
   * @default Path.public('assets')
   */
  buildDirectory?: string

  /**
   * Path to the manifest file relative from the root of
   * the application.
   *
   * @default Path.public('assets/.vite/manifest.json')
   */
  manifestFile?: string

  /**
   * Path to the SSR entrypoint file that will be used to compile
   * using `--ssr` option.
   *
   * @default 'src/resources/app/app.tsx'
   */
  ssrEntrypoint?: string

  /**
   * Public directory where the SSR assets will be compiled.
   *
   * @default Path.public('assets/server')
   */
  ssrBuildDirectory?: string

  /**
   * A custom set of attributes to apply on all
   * script tags injected by edge `@vite()` tag.
   */
  styleAttributes?: SetAttributes

  /**
   * A custom set of attributes to apply on all
   * style tags injected by edge `@vite()` tag.
   */
  scriptAttributes?: SetAttributes
}
