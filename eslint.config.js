import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';

export default [
  { ignores: ['dist/', '.astro/', 'node_modules/', 'wireframe/', 'test-results/', 'playwright-report/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  {
    files: ['scripts/**/*.mjs', 'qa/**/*.mjs', '*.config.*'],
    // Scripts Node; window/document aparecem dentro de page.evaluate (rodam no navegador)
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        URL: 'readonly',
        window: 'readonly',
        document: 'readonly',
      },
    },
  },
];
