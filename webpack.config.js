const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    background: './src/background/index.js',
    content: './src/content/index.js',
    popup: './src/popup/index.js'
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'src/manifest.json', to: 'manifest.json' },
        { from: 'src/content/style.css', to: 'content.style.css' },
        { from: 'src/popup/index.html', to: 'popup.html' },
        { from: 'src/popup/style.css', to: 'popup.style.css' },
        { from: 'src/icons', to: 'icons' }
      ],
    }),
  ],
  resolve: {
    extensions: ['.js'],
  },
};
