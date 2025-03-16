// Based on https://webpack.js.org/guides/typescript/

const path = require('path')

module.exports = {
  extends: path.resolve(__dirname, '../base.webpack.config.js'),
  entry: './src/blocked-unknown.ts',
  output: {
    filename: 'blocked-unknown.js',
    path: path.resolve(__dirname, '..', '..', 'extension', 'pages'),
  },
}
