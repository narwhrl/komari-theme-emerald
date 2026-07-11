import antfu from '@antfu/eslint-config'

export default antfu(
  {
    formatters: true,
    nextjs: true,
    react: true,
    rules: {
      'next/no-img-element': 'off',
    },
    vue: false,
  },
  {
    name: 'markdown-code/react-refresh',
    files: ['**/*.md/**/*.{js,jsx,ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
)
