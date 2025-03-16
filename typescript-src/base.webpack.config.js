// Based on https://webpack.js.org/guides/typescript/

module.exports = {
  // Use development mode to disable mangling of names, see requirements on https://extensionworkshop.com/documentation/publish/source-code-submission/
  mode: 'development',
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
}
