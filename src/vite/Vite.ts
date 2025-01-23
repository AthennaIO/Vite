/**
 * @athenna/vite
 *
 * (c) João Lenon <lenon@athenna.io>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/**
 * Most of the code here was copy-pasted from https://github.com/adonisjs/vite/blob/4.x/src/vite.ts
 * @credit https://github.com/adonisjs/vite
 */

import path from 'node:path'

import { File, Is, Macroable, Parser } from '@athenna/common'
import type { FastifyViteOptions, SetAttributes } from '#src/types'
import type { Manifest, ModuleNode, ViteDevServer } from 'vite'

export function slash(path: string): string {
  const isExtendedLengthPath = path.startsWith('\\\\?\\')
  if (isExtendedLengthPath) {
    return path
  }
  return path.replace(/\\/g, '/')
}

export class Vite extends Macroable {
  /**
   * We cache the manifest file content in production
   * to avoid reading the file multiple times.
   */
  public manifestCache?: Manifest

  /**
   * We cache the SSR manifest file content in production
   * to avoid reading the file multiple times.
   */
  public ssrManifestCache?: Manifest

  /**
   * Vite dev server instance.
   */
  public devServer?: ViteDevServer

  /**
   * Hold fastify vite options.
   */
  public options: FastifyViteOptions

  public constructor(options: FastifyViteOptions, devServer?: ViteDevServer) {
    super()

    this.options = options
    this.devServer = devServer
  }

  /**
   * Reads the file contents as JSON.
   */
  public readFileAsJSON(filePath: string) {
    return new File(filePath).getContentAsJsonSync()
  }

  /**
   * Convert Record of attributes to a valid HTML string.
   */
  public makeAttributes(attributes: Record<string, string | boolean>) {
    return Object.keys(attributes)
      .map(key => {
        const value = attributes[key]

        if (value === true) {
          return key
        }

        if (!value) {
          return null
        }

        return `${key}="${value}"`
      })
      .filter(attr => attr !== null)
      .join(' ')
  }

  /**
   * Returns the script needed for the HMR working with Vite.
   */
  public getViteHmrScript(attributes?: any) {
    return Parser.jsonToHTML({
      tag: 'script',
      attributes: {
        type: 'module',
        src: '/@vite/client',
        ...attributes
      },
      children: []
    })
  }

  /**
   * If the module is a style module.
   */
  public isStyleModule(mod: ModuleNode) {
    if (Is.CssPath(mod.url) || (mod.id && /\?vue&type=style/.test(mod.id))) {
      return true
    }

    return false
  }

  /**
   * Unwrap attributes from the user defined function or return
   * the attributes as it is.
   */
  public unwrapAttributes(
    src: string,
    url: string,
    attributes?: SetAttributes
  ) {
    if (typeof attributes === 'function') {
      return attributes({ src, url })
    }

    return attributes
  }

  /**
   * Create a style tag for the given path.
   */
  public makeStyleTag(src: string, url: string, attributes?: any) {
    const customAttributes = this.unwrapAttributes(
      src,
      url,
      this.options?.styleAttributes
    )

    return Parser.jsonToHTML({
      tag: 'link',
      attributes: {
        rel: 'stylesheet',
        ...customAttributes,
        ...attributes,
        href: url
      }
    })
  }

  /**
   * Create a script tag for the given path
   */
  public makeScriptTag(src: string, url: string, attributes?: any) {
    const customAttributes = this.unwrapAttributes(
      src,
      url,
      this.options?.scriptAttributes
    )

    return Parser.jsonToHTML({
      tag: 'script',
      attributes: {
        type: 'module',
        ...customAttributes,
        ...attributes,
        src: url
      },
      children: []
    })
  }

  /**
   * Generate a HTML tag for the given asset.
   */
  public generateTag(asset: string, attributes?: any) {
    let url = ''

    if (this.devServer) {
      url = `/${asset}`
    } else {
      url = this.generateAssetUrl(asset)
    }

    if (Is.CssPath(asset)) {
      return this.makeStyleTag(asset, url, attributes)
    }

    return this.makeScriptTag(asset, url, attributes)
  }

  /**
   * Get a chunk from the manifest file for a given file name.
   */
  public chunk(manifest: Manifest, entrypoint: string) {
    const chunk = manifest[entrypoint]

    if (!chunk) {
      throw new Error(`Cannot find "${entrypoint}" chunk in the manifest file`)
    }

    return chunk
  }

  /**
   * Get a list of chunks for a given filename.
   */
  public chunksByFile(manifest: Manifest, file: string) {
    return Object.entries(manifest)
      .filter(([, chunk]) => chunk.file === file)
      .map(([_, chunk]) => chunk)
  }

  /**
   * Generate preload tag for a given url.
   */
  public makePreloadTagForUrl(url: string) {
    const attributes = Is.CssPath(url)
      ? { rel: 'preload', as: 'style', href: url }
      : { rel: 'modulepreload', href: url }

    return Parser.jsonToHTML({ tag: 'link', attributes })
  }

  /**
   * Collect CSS files from the module graph recursively.
   */
  public collectCss(
    mod: ModuleNode,
    styleUrls: Set<string>,
    visitedModules: Set<string>,
    importer?: ModuleNode
  ): void {
    if (!mod.url) return

    /**
     * Prevent visiting the same module twice.
     */
    if (visitedModules.has(mod.url)) return
    visitedModules.add(mod.url)

    if (
      this.isStyleModule(mod) &&
      (!importer || !this.isStyleModule(importer))
    ) {
      if (mod.url.startsWith('/')) {
        styleUrls.add(mod.url)
      } else if (mod.url.startsWith('\0')) {
        // virtual modules are prefixed with \0
        styleUrls.add(`/@id/__x00__${mod.url.substring(1)}`)
      } else {
        styleUrls.add(`/@id/${mod.url}`)
      }
    }

    mod.importedModules.forEach(dep =>
      this.collectCss(dep, styleUrls, visitedModules, mod)
    )
  }

  /**
   * Returns path to a given asset file using the manifest file.
   */
  public assetPath(asset: string): string {
    if (this.devServer) {
      return `/${asset}`
    }

    const chunk = this.chunk(this.manifest(), asset)

    return this.generateAssetUrl(chunk.file)
  }

  /**
   * Generate an asset URL for a given asset path.
   */
  public generateAssetUrl(path: string) {
    return `${this.options.assetsUrl}/${path}`
  }

  /**
   * Generate style and script tags for the given entrypoints
   * Also adds the @vite/client script.
   */
  public async generateEntryPointsTagsForDevMode(
    entryPoints: string[],
    attributes?: any
  ) {
    const tags = entryPoints.map(entrypoint =>
      this.generateTag(entrypoint, attributes)
    )
    const jsEntrypoints = entryPoints.filter(
      entrypoint => !Is.CssPath(entrypoint)
    )

    /**
     * If the module graph is empty, that means we didn't execute the entrypoint
     * yet : we just started the AdonisJS dev server.
     * So let's execute the entrypoints to populate the module graph.
     */
    if (this.devServer.moduleGraph.idToModuleMap.size === 0) {
      await Promise.allSettled(
        jsEntrypoints.map(entrypoint =>
          this.devServer.warmupRequest(`/${entrypoint}`)
        )
      )
    }

    /**
     * We need to collect the CSS files imported by the entrypoints
     * Otherwise, we gonna have a FOUC each time we full reload the page.
     */
    const preloadUrls = new Set<string>()
    const visitedModules = new Set<string>()
    const cssTagsElement = new Set<string>()

    /**
     * Let's search for the CSS files by browsing the module graph
     * generated by Vite.
     */
    for (const entryPoint of jsEntrypoints) {
      const filePath = path.join(this.devServer.config.root, entryPoint)
      const entryMod = this.devServer.moduleGraph.getModuleById(slash(filePath))
      if (entryMod) this.collectCss(entryMod, preloadUrls, visitedModules)
    }

    /**
     * Once we have the CSS files, generate associated tags
     * that will be injected into the HTML.
     */
    Array.from(preloadUrls)
      .map(href =>
        Parser.jsonToHTML({
          tag: 'link',
          attributes: { rel: 'stylesheet', as: 'style', href }
        })
      )
      .forEach(element => cssTagsElement.add(element))

    const viteHmr = this.getViteHmrScript(attributes)
    const result = [...cssTagsElement, viteHmr].concat(tags)

    return result.sort(tag => (tag.includes('<link') ? -1 : 1))
  }

  /**
   * Generate style and script tags for the given entrypoints
   * using the manifest file.
   */
  public generateEntryPointsTagsWithManifest(
    entryPoints: string[],
    attributes?: any
  ) {
    const manifest = this.manifest()
    const tags: { path: string; tag: any }[] = []
    const preloads: Array<{ path: string }> = []

    for (const entryPoint of entryPoints) {
      const chunk = this.chunk(manifest, entryPoint)
      preloads.push({ path: this.generateAssetUrl(chunk.file) })
      tags.push({
        path: chunk.file,
        tag: this.generateTag(chunk.file, {
          ...attributes,
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          integrity: chunk.integrity
        })
      })

      for (const css of chunk.css || []) {
        preloads.push({ path: this.generateAssetUrl(css) })
        tags.push({ path: css, tag: this.generateTag(css) })
      }

      for (const importNode of chunk.imports || []) {
        preloads.push({
          path: this.generateAssetUrl(manifest[importNode].file)
        })

        for (const css of manifest[importNode].css || []) {
          const subChunk = this.chunksByFile(manifest, css)

          preloads.push({ path: this.generateAssetUrl(css) })
          tags.push({
            path: this.generateAssetUrl(css),
            tag: this.generateTag(css, {
              ...attributes,
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              integrity: subChunk[0]?.integrity
            })
          })
        }
      }
    }

    const preloadsElements = preloads.athenna
      .unique('path')
      .sort(preload => (Is.CssPath(preload.path) ? -1 : 1))
      .map(preload => this.makePreloadTagForUrl(preload.path))

    return preloadsElements.concat(tags.map(({ tag }) => tag))
  }

  /**
   * Generate tags for the entry points.
   */
  public async generateEntryPointsTags(
    entryPoints: string[] | string,
    attributes?: any
  ) {
    entryPoints = Array.isArray(entryPoints) ? entryPoints : [entryPoints]

    if (this.devServer) {
      return this.generateEntryPointsTagsForDevMode(entryPoints, attributes)
    }

    return this.generateEntryPointsTagsWithManifest(entryPoints, attributes)
  }

  /**
   * Returns the manifest file contents.
   *
   * @throws Will throw an exception when running in dev.
   */
  public manifest(): Manifest {
    if (this.devServer) {
      throw new Error('Cannot read the manifest file when running in dev mode')
    }

    if (!this.manifestCache) {
      this.manifestCache = this.readFileAsJSON(this.options.manifestFile)
    }

    return this.manifestCache!
  }

  /**
   * Returns the SSR manifest file contents.
   *
   * @throws Will throw an exception when running in dev.
   */
  public ssrManifest(): Manifest {
    if (this.devServer) {
      throw new Error(
        'Cannot read the SSR manifest file when running in dev mode'
      )
    }

    if (!this.ssrManifestCache) {
      this.ssrManifestCache = this.readFileAsJSON(
        `${this.options.ssrBuildDirectory}${path.sep}.vite${path.sep}manifest.json`
      )
    }

    return this.ssrManifestCache!
  }

  /**
   * Returns the script needed for the HMR working with React.
   */
  public getReactHmrScript(attributes?: Record<string, any>) {
    if (!this.devServer) {
      return null
    }

    return Parser.jsonToHTML({
      tag: 'script',
      attributes: {
        type: 'module',
        ...attributes
      },
      children: [
        '',
        `import RefreshRuntime from '/@react-refresh'`,
        `RefreshRuntime.injectIntoGlobalHook(window)`,
        `window.$RefreshReg$ = () => {}`,
        `window.$RefreshSig$ = () => (type) => type`,
        `window.__vite_plugin_react_preamble_installed__ = true`,
        ''
      ]
    })
  }

  /**
   * Safely load an SSR module by looking to the dev
   * server or the SSR manifest file.
   */
  public async ssrLoadModule(modulePath: string) {
    if (this.devServer) {
      return this.devServer.ssrLoadModule(modulePath)
    }

    const ssrManifest = this.ssrManifest()
    const chunk = this.chunk(ssrManifest, modulePath)

    return import(`${this.options.ssrBuildDirectory}${path.sep}${chunk.file}`)
  }
}
