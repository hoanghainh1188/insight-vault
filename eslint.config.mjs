import tseslint from 'typescript-eslint'

// Flat config (ESLint 9). Chỉ typescript-eslint recommended — đủ cho gate lint cơ bản.
// Không làm yếu rule để giấu lỗi (config-protection); chỉ bỏ qua build output.
export default tseslint.config(
  {
    ignores: [
      'out/**',
      'dist/**',
      'build/**',
      'node_modules/**',
      'coverage/**',
      'test-results/**',
      'playwright-report/**',
    ],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  }
)
