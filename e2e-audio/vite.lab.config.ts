/**
 * 声音实验室的端到端测试用的 Vite 配置，与产品用同一份 vite.config.ts（同样的插件、目标和打包方式）：
 * - 构建：只换入口和输出目录，确认 `?worker&url` 打包出的限幅器 Worklet 和素材 Worker 在构建产物里能载入
 *   （不只是开发服务器）。只构建实验室这一个入口：声音模块的检查不该被应用其他部分的构建状态卡住，
 *   Worklet 的打包方式两者一样；
 * - 开发服务器：关掉热更新。离线质检要连续渲染几分钟，期间别处改了代码（其他模块、内容目录），
 *   页面整个重载，质检就半途作废；下一次打开页面时读到的仍是最新的文件。
 */
import { fileURLToPath, URL } from 'node:url'
import { mergeConfig } from 'vite'
import base from '../vite.config.ts'

const root = fileURLToPath(new URL('..', import.meta.url))

export default mergeConfig(base, {
  root,
  server: { hmr: false },
  build: {
    outDir: 'node_modules/.cache/audio-lab-dist',
    emptyOutDir: true,
    rollupOptions: {
      input: { lab: fileURLToPath(new URL('../audio-lab.html', import.meta.url)) },
    },
  },
})
