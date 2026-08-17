import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

const hashbangCommentTypes = new Set(['Hashbang', 'Shebang']);

const noCommentsRule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Forbid comments in shipped source and tests; documentation belongs in docs/.',
    },
    schema: [],
    messages: {
      commentFound:
        'Comments are not allowed here. Rename for clarity or document the behaviour in docs/.',
    },
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (hashbangCommentTypes.has(comment.type)) {
            continue;
          }
          context.report({ loc: comment.loc, messageId: 'commentFound' });
        }
      },
    };
  },
};

const hexaskyPlugin = {
  meta: { name: 'hexasky', version: '1.0.0' },
  rules: { 'no-comments': noCommentsRule },
};

export default tseslint.config(
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**'],
  },
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['tests/**/*.ts', 'eslint.config.js', 'vitest.config.ts'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    plugins: { hexasky: hexaskyPlugin },
    rules: {
      'hexasky/no-comments': 'error',
    },
  },
  {
    files: ['src/**/*.ts'],
    rules: {
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
    },
  },
);
