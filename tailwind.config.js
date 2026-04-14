/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // NexusIDE — Pure black/charcoal dark theme
        base:     '#0f0f0f',  // editor background
        mantle:   '#080808',  // sidebar/panel bg
        crust:    '#040404',  // deepest bg
        surface0: '#1a1a1a',  // inactive tabs, borders
        surface1: '#242424',  // hover backgrounds
        surface2: '#2e2e2e',  // active borders
        overlay0: '#484848',  // very muted
        overlay1: '#5e5e5e',  // muted
        overlay2: '#767676',  // secondary
        subtext0: '#969696',  // tertiary text
        subtext1: '#b8b8b8',  // secondary text
        text:     '#e2e2e2',  // primary text
        // Vibrant accent colors for syntax & UI
        lavender: '#8fa8f5',
        blue:     '#6b8ff7',
        sapphire: '#56b8dc',
        sky:      '#5ad4e8',
        teal:     '#3dcfb0',
        green:    '#6acc70',
        yellow:   '#f0d068',
        peach:    '#f09848',
        maroon:   '#e07888',
        red:      '#e66060',
        mauve:    '#ad70ec',
        pink:     '#e070dc',
        flamingo: '#ec9898',
        rosewater: '#f5c8c8',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.65rem', { lineHeight: '1rem' }],
      },
    },
  },
  plugins: [],
}
