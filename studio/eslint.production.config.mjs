import tsPlugin from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import globals from 'globals';

export default [
    {
        files: ['**/*.ts', '**/*.tsx'],
        plugins: {
            '@typescript-eslint': tsPlugin
        },
        languageOptions: {
            parser: typescriptParser,
            parserOptions: {
                project: null,
                ecmaVersion: 'latest',
                sourceType: 'module',
                ecmaFeatures: {
                    jsx: true
                }
            },
            globals: {
                ...globals.browser,
                ...globals.node,
                config: 'readonly',
                editor: 'readonly',
                log: 'readonly',
                metrics: 'readonly',
                pc: 'readonly',
                pcx: 'readonly',
                pcBootstrap: 'readonly'
            }
        },
        rules: {
            'no-undef': 'error',
            'no-redeclare': 'error',
            '@typescript-eslint/no-unused-vars': ['error', {
                args: 'none',
                caughtErrors: 'none'
            }]
        }
    },
    {
        files: ['**/*.mjs'],
        languageOptions: {
            globals: {
                ...globals.node
            }
        },
        rules: {
            'no-undef': 'error',
            'no-redeclare': 'error',
            'no-unused-vars': ['error', {
                args: 'none',
                caughtErrors: 'none'
            }]
        }
    }
];
