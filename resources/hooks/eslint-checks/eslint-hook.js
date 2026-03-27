#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

const LINTABLE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs'];

async function main() {
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
  }

  const hookInput = JSON.parse(input);
  const filePath = hookInput.tool_input?.file_path;
  const cwd = hookInput.cwd || process.cwd();

  if (!filePath) {
    process.exit(0);
  }

  // Skip files outside the project directory
  if (!filePath.startsWith(cwd)) {
    process.exit(0);
  }

  const ext = path.extname(filePath);
  if (!LINTABLE_EXTENSIONS.includes(ext)) {
    process.exit(0);
  }

  try {
    execSync(`npx eslint "${filePath}" --max-warnings 0 --format json`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    console.log(`✓ ${path.basename(filePath)}`);
    process.exit(0);
  } catch (error) {
    console.error('ESLint errors found that MUST be fixed, regardless of whether or not you caused them:');
    try {
      const results = JSON.parse(error.stdout);
      const file = results[0];
      if (file && file.messages.length > 0) {
        const basename = path.basename(filePath);
        file.messages.forEach(msg => {
          console.error(`${basename}:${msg.line}:${msg.column} ${msg.ruleId}`);
        });
      } else {
        console.error(error.stdout || error.stderr || 'ESLint failed');
      }
    } catch {
      console.error(error.stdout || error.stderr || 'ESLint failed');
    }
    process.exit(2);
  }
}

main();
