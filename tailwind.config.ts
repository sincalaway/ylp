import type { Config } from 'tailwindcss'
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: { extend: {
    colors: { paper: '#f8f5f0', ink: '#272b24', herb: '#2d6a4f', jade: '#40916c', cinnabar: '#9b2226', gold: '#b79a63', mist: '#e8eee7' },
    fontFamily: { serif: ['"Noto Serif SC"', '"Source Han Serif SC"', 'Songti SC', 'STSong', 'serif'], sans: ['"Noto Sans SC"', '"PingFang SC"', 'Microsoft YaHei', 'sans-serif'] },
    boxShadow: { paper: '0 12px 35px rgba(44, 53, 42, .08)' },
    letterSpacing: { 'wide-cn': '.16em' }
  } },
  plugins: []
}
export default config
