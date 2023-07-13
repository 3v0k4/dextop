import type { Configuration } from "webpack";

import { rules } from "./webpack.rules";
import { plugins } from "./webpack.plugins";

rules.push({
  test: /\.css$/i,
  use: ["style-loader", "css-loader", "postcss-loader"],
});

export const rendererConfig: Configuration = {
  module: {
    rules,
  },
  plugins,
  output: {
    publicPath: "../",
  },
  resolve: {
    extensions: [".js", ".ts", ".jsx", ".tsx", ".css"],
  },
};
