// Next 16 removed the built-in `next lint` command. Lint via the ESLint CLI
// using the native flat config shipped by eslint-config-next@16.
import next from 'eslint-config-next/core-web-vitals';

const eslintConfig = [
  ...next,
  {
    ignores: ['.next/**', 'node_modules/**', 'dist/**'],
  },
];

export default eslintConfig;
