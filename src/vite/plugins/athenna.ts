/**
 * @athenna/vite
 *
 * (c) João Lenon <lenon@athenna.io>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import PluginRestart from 'vite-plugin-restart'

import type { PluginOption } from 'vite'
import type { ConfigOptions } from '#src/types'
import { config } from '#src/vite/plugins/config'

export default function athenna(options: ConfigOptions): PluginOption[] {
  const fullOptions = Object.assign(
    {
      assetsUrl: '/assets',
      buildDirectory: 'public/assets',
      reload: ['./src/resources/views/**/*.edge']
    },
    options
  )

  return [PluginRestart({ reload: fullOptions.reload }), config(fullOptions)]
}
