module.exports = {
  plugins: [
    {
      plugin: require('@secretlint/secretlint-rule-preset-recommend')
    }
  ],
  rules: {
    '@secretlint/secretlint-rule-preset-recommend': true
  },
  overrides: [
    {
      files: ["public/env.local.json"],
      rules: {
        '@secretlint/secretlint-rule-preset-recommend': false
      }
    }
  ]
};

