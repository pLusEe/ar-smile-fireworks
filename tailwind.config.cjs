/** @type {import('tailwindcss').Config} */
const tuxPreset = require('@byted-tiktok/tux-web/tailwind-preset')

module.exports = {
  presets: [tuxPreset],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // 让 Tailwind 的 font-sans / font-display 工具类与 preflight 默认字体
      // 统一指向项目语义 token（最终 = TUX 的 TikTok Sans）。token 定义见
      // src/index.css 的 :root。
      fontFamily: {
        sans: 'var(--app-font-sans)',
        display: 'var(--app-font-display)',
      },
    },
  },
  plugins: [],
}
