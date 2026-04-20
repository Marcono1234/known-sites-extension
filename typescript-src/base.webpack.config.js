// Based on https://webpack.js.org/guides/typescript/

module.exports = {
  // Use development mode to disable mangling of names, see requirements on https://extensionworkshop.com/documentation/publish/source-code-submission/
  mode: 'development',
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: 'ts-loader',
          options: {
            // Print used TypeScript version for easier troubleshooting
            logLevel: 'info',
          },
        },
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
}
