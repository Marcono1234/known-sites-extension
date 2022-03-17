// Based on https://webpack.js.org/guides/typescript/

const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
    mode: 'development',
    entry: './background-scripts/background.ts',
    devtool: 'inline-source-map',
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
    output: {
        filename: 'background.js',
        path: path.resolve(__dirname, '..', 'extension', 'background-scripts'),
    },
    plugins: [
        // Include polyfill to support Chrome, see https://github.com/mozilla/webextension-polyfill#usage-with-webpack-without-bundling
        // TODO: Maybe move this task to top-level folder of this project because it is not specific to TypeScript sources
        new CopyWebpackPlugin({
            patterns: [{
                from: 'node_modules/webextension-polyfill/dist/browser-polyfill.js',
                to: path.resolve(__dirname, '..', 'extension', 'web-ext-polyfill')
            }],
        })
    ]
};
