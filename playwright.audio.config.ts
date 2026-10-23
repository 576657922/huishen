import { defineConfig } from '@playwright/test'

/**
 * 开发服务器：声音实验室的离线质检在这里跑。用 e2e-audio/vite.lab.config.ts（关掉热更新），
 * 端口也不与平时开着的开发服务器共用：那里一改文件，正在质检的页面就会被整个重载
 */
const DEV_PORT = 5176
/** 构建产物：确认限幅器 Worklet 和素材 Worker 在正式构建里也能载入 */
const BUILD_PORT = 5175

// 用本机安装的 Chrome；自动播放策略放开，实时的 AudioContext 不用手势也能开始
export default defineConfig({
  testDir: './e2e-audio',
  // 完整的离线质检要渲染几十个场景，校准更久
  timeout: 20 * 60_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    channel: 'chrome',
    locale: 'zh-CN',
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
  },
  projects: [
    {
      name: 'dev',
      testMatch: /(audio|live|calibrate|session)\.spec\.ts/,
      use: { baseURL: `http://localhost:${DEV_PORT}` },
    },
    { name: 'build', testMatch: /build\.spec\.ts/, use: { baseURL: `http://localhost:${BUILD_PORT}` } },
  ],
  webServer: [
    {
      command: `npx vite --config e2e-audio/vite.lab.config.ts --port ${DEV_PORT} --strictPort`,
      url: `http://localhost:${DEV_PORT}/audio-lab.html`,
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: `npx vite build --config e2e-audio/vite.lab.config.ts && npx vite preview --config e2e-audio/vite.lab.config.ts --port ${BUILD_PORT} --strictPort`,
      url: `http://localhost:${BUILD_PORT}/audio-lab.html`,
      reuseExistingServer: true,
      timeout: 300_000,
    },
  ],
})
