module.exports = {
  root: true,
  env: {
    es2022: true,
    node: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
    project: ['./web/tsconfig.json', './functions/tsconfig.json'],
    tsconfigRootDir: __dirname,
  },
  extends: [
    'airbnb',
    'airbnb-typescript',
    'airbnb/hooks',
    'plugin:react/recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  plugins: ['react', '@typescript-eslint', 'import'],
  settings: {
    react: { version: 'detect' },
  },
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'react/function-component-definition': 'off',
    'react/jsx-props-no-spreading': 'off',
    'react/jsx-no-bind': 'off',
    'react/require-default-props': 'off',
    'import/prefer-default-export': 'off',
    'no-nested-ternary': 'off',
    'no-restricted-syntax': 'off',
    'no-void': 'off',
    'consistent-return': 'off',
    'no-underscore-dangle': ['error', { allow: ['__name'] }],
  },
  overrides: [
    {
      files: ['web/src/**/*.{ts,tsx}'],
      env: { browser: true },
    },
    {
      files: ['functions/src/**/*.ts'],
      env: { node: true },
    },
  ],
};
