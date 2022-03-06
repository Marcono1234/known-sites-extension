// Based on https://webpack.js.org/guides/typescript/

const path = require('path');

module.exports = {
    mode: 'development',
    entry: './src/background.ts',
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
        path: path.resolve(__dirname, 'dist'),
    },
};
