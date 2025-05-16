const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");

module.exports = (env) => {
  const noTypeCheck = env && env["no-typecheck"];

  return {
    mode: "production",
    target: "node",
    plugins: [
      new CopyPlugin({
        patterns: [{ from: "assets", to: path.resolve(__dirname, "dist") }],
      }),
    ],
    module: {
      rules: [
        {
          sideEffects: false,
        },
        {
          test: /\.(ts|tsx)$/,
          use: {
            loader: "ts-loader",
            options: {
              transpileOnly: noTypeCheck ? true : false,
            },
          },
          exclude: /node_modules/,
        },
      ],
    },
    resolve: {
      extensions: [".ts", ".tsx", ".js"],
    },
    optimization: {
      usedExports: true,
    },
    entry: "./src/index.ts",
    output: {
      filename: "index.js",
      path: path.resolve(__dirname, "dist"),
      libraryTarget: "commonjs2",
    },
  };
};
