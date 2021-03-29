const colors = require('tailwindcss/colors')

module.exports = {
  purge: {
    mode: 'all',
    content: [
      './src/pages/**/*.{js,ts,jsx,tsx}',
      './src/components/**/*.{js,ts,jsx,tsx}',
    ],
  },
  darkMode: false, // or 'media' or 'class'
  theme: {
    extend: {
      colors: {
        gray: colors.trueGray,
      },
      typography: (theme) => ({
        DEFAULT: {
          css: {
            color: theme('colors.gray.200'),
            code: {
              color: theme('colors.gray.300'),
            },
            strong: {
              color: theme('colors.gray.300'),
            },
          },
        },
      }),
    },
  },
  variants: {
    extend: {},
  },
  plugins: [require('@tailwindcss/typography')],
};
