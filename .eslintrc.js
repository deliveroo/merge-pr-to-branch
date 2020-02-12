module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "jest"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier/@typescript-eslint",
    "plugin:jest/recommended"
  ],
  rules: {
    "@typescript-eslint/explicit-function-return-type": ["off"],
    "@typescript-eslint/no-use-before-define": ["off"],
    "@typescript-eslint/no-explicit-any": ["off"],
    "@typescript-eslint/camelcase": ["off"],
    "jest/expect-expect": [
      "error",
      {
        assertFunctionNames: ["expect", "assert.*"]
      }
    ]
  }
};
