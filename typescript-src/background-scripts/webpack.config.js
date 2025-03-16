// Based on https://webpack.js.org/guides/typescript/

const path = require('path')

module.exports = {
  extends: path.resolve(__dirname, '../base.webpack.config.js'),
  entry: './src/background.ts',
  output: {
    filename: 'background.js',
    path: path.resolve(
      __dirname,
      '..',
      '..',
      'extension',
      'background-scripts',
    ),
  },
}
