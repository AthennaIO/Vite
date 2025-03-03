/**
 * @athenna/vite
 *
 * (c) João Lenon <lenon@athenna.io>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

export interface ConfigOptions {
  /**
   * The URL where the assets will be served. This is particularly
   * useful if you are using a CDN to deploy your assets.
   *
   * @default ''
   */
  assetsUrl?: string

  /**
   * Files that should trigger a page reload when changed.
   *
   * @default ['./src/resources/views/** /*.edge']
   */
  reload?: string[]

  /**
   * Paths to the entrypoints files
   */
  entrypoints: string[]

  /**
   * Public directory where the assets will be compiled.
   *
   * @default 'public/assets'
   */
  buildDirectory?: string
}
