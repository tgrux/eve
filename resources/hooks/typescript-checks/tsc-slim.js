#!/usr/bin/env node

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const logFile = '/tmp/tsc-hook.log';

function log(message) {
  fs.appendFileSync(logFile, `${new Date().toISOString()} - ${message}\n`);
}

function main() {
  try {
    log('=== Hook started ===');
    
    const input = fs.readFileSync(0, 'utf-8');
    const inputData = JSON.parse(input);
    
    const toolInput = inputData.tool_input || {};
    const filePath = toolInput.file_path;
    const cwd = inputData.cwd || process.cwd();

    // Only run on TypeScript files
    if (!filePath || !(filePath.endsWith('.ts') || filePath.endsWith('.tsx'))) {
      log(`Skipping non-TypeScript file: ${filePath}`);
      process.exit(0);
    }

    // Find tsconfig to use
    let tsconfigPath = 'tsconfig.json';
    if (!fs.existsSync(path.join(cwd, tsconfigPath))) {
      tsconfigPath = 'tsconfig.base.json';
      if (!fs.existsSync(path.join(cwd, tsconfigPath))) {
        log('No tsconfig found');
        console.error('⚠️  No tsconfig.json found, skipping type check');
        process.exit(0);
      }
    }

    // Run tsc on the entire project
    const cmd = `npx tsc --noEmit --project ${tsconfigPath}`;
    log(`Running: ${cmd}`);
    
    const result = execSync(cmd, {
      cwd: cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });

    log('No errors found');
    console.error('✅ No type errors found');
    process.exit(0);

  } catch (error) {
    log(`Caught error: ${error.message}`);
    
    if (error.stdout || error.stderr) {
      const output = error.stdout || error.stderr;
      log(`Output: ${output.substring(0, 1000)}`);
      
      // Parse errors - look for actual error lines, not help text
      const lines = output.split('\n').filter(line => line.trim());
      const errors = [];
      
      for (const line of lines) {
        // Match error format: path/file.ts(line,col): error TS####: message
        const match = line.match(/^(.+?\.tsx?)\((\d+),(\d+)\): error TS\d+: (.+)$/);
        if (match) {
          const [, errorFilePath, lineNum, , message] = match;
          const fileName = errorFilePath.split('/').pop();
          errors.push(`  ${fileName}:${lineNum}: ${message}`);
        }
      }

      log(`Found ${errors.length} errors`);

      if (errors.length > 0) {
        console.error('Type errors found that MUST be fixed, regardless of whether or not you caused them:');
        console.error(errors.join('\n'));
        log('Exiting with code 2');
        process.exit(2);
      }
    }

    log('No parseable errors found (fallback)');
    console.error('✅ No type errors found');
    process.exit(0);
  }
}

main();