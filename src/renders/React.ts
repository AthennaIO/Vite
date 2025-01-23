/**
 * @athenna/vite
 *
 * (c) João Lenon <lenon@athenna.io>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { Config } from '@athenna/config'
import type { Vite } from '#src/vite/Vite'
import { Macroable } from '@athenna/common'

export class React extends Macroable {
  /**
   * The same as using `React.loadComponent()` method:
   *
   * @example
   * ```ts
   * // 'src/resources/app/app.tsx'
   * const entrypoint = Config.get('http.vite.ssrEntrypoint')
   *
   * const { createApp } = await React.loadComponent(entrypoint)
   * ```
   */
  public static async loadEntrypoint<T = any>() {
    const entrypoint = Config.get('http.vite.ssrEntrypoint')

    return React.loadComponent<T>(entrypoint)
  }

  /**
   * Automatically compile a React component using Vite
   * dev server and import it. In production the server
   * manifest.json file will be read instead.
   *
   * @example
   * ```ts
   * const { createApp } = await React.loadComponent('src/resources/app/app.tsx')
   * ```
   */
  public static async loadComponent<T = any>(path: string): Promise<T> {
    const vite: Vite = ioc
      .safeUse('Athenna/Core/HttpServer')
      .getVitePlugin()
      .getVite()

    return vite.ssrLoadModule(path)
  }

  /**
   * Render a React component to an HTML string.
   *
   * @example
   * ```ts
   * const { createApp } = await React.loadComponent('src/resources/app/app.tsx')
   *
   * const htmlElement = await React.renderComponent(createApp(request.baseUrl))
   * ```
   */
  public static async renderComponent(component: any) {
    const reactDom = await import('react-dom/server')

    if (!reactDom) {
      throw new Error(
        'ReactDOM is not installed to process rendering, please run "npm install react react-dom".'
      )
    }

    return reactDom.renderToString(component)
  }
}
