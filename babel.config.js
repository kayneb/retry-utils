function foldBabelEnv(prodEsm, prodCjs, dev, test) {
  switch (process.env.BABEL_ENV) {
    case "production:esm":
      return prodEsm();
    case "production:cjs":
      return prodCjs();
    case "development":
      return dev();
    case "test":
      return test();
  }
}

const prodIgnores = [
  "**/__tests__/*",
  "**/__mocks__/*"
];

module.exports = (api) => {
  api.cache(() => `BABEL_ENV=${process.env.BABEL_ENV}`);

  return {
    presets: [
      [
        "@babel/preset-env",
        {
          modules: foldBabelEnv(() => false, () => "cjs", () => "cjs", () => "cjs"),
        },
      ],
      "@babel/preset-flow",
    ],
    plugins: [
      "@babel/plugin-transform-runtime",
      "@babel/plugin-proposal-optional-chaining",
      "@babel/plugin-proposal-object-rest-spread",
    ],
    ignore: foldBabelEnv(() => prodIgnores, () => prodIgnores, () => [], () => []),
  };
};
