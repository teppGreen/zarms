#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const targetRoot = path.join(repoRoot, 'projects', 'frontend', 'src');
const targetExtensions = new Set(['.html', '.js']);

/**
 * ディレクトリ配下の対象ファイルを再帰的に収集します。
 * @param {string} dirPath
 * @returns {string[]}
 */
function collectTargetFiles(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTargetFiles(fullPath));
      continue;
    }

    const ext = path.extname(entry.name);
    if (targetExtensions.has(ext)) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * 代入がガード付き初期化かどうかを判定します。
 * 同一行または直前2行に if (!<symbol>) があれば安全とみなします。
 * @param {string[]} lines
 * @param {number} lineIndex
 * @param {string} symbol
 * @returns {boolean}
 */
function isGuardedInitialization(lines, lineIndex, symbol) {
  const guardPattern = new RegExp(`if\\s*\\(\\s*!\\s*${symbol.replace(/\./g, '\\.')}\\s*\\)`);

  const start = Math.max(0, lineIndex - 2);
  for (let i = start; i <= lineIndex; i += 1) {
    if (guardPattern.test(lines[i])) {
      return true;
    }
  }
  return false;
}

/**
 * 1ファイル内の App.utils 再代入候補を抽出します。
 * @param {string} filePath
 * @returns {Array<{symbol: string, line: number, guarded: boolean}>}
 */
function findAssignmentsInFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const assignments = [];
  const assignRegex = /(App\.utils(?:\.[A-Za-z0-9_]+)*)\s*=\s*\{/g;

  lines.forEach((line, index) => {
    let match;
    while ((match = assignRegex.exec(line)) !== null) {
      const symbol = match[1];
      assignments.push({
        symbol,
        line: index + 1,
        guarded: isGuardedInitialization(lines, index, symbol)
      });
    }
  });

  return assignments;
}

function toRel(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join('/');
}

function main() {
  const files = collectTargetFiles(targetRoot);
  const unguardedBySymbol = new Map();

  for (const file of files) {
    const assignments = findAssignmentsInFile(file);
    for (const assignment of assignments) {
      if (assignment.guarded) continue;
      const key = assignment.symbol;
      const list = unguardedBySymbol.get(key) || [];
      list.push({ filePath: file, line: assignment.line });
      unguardedBySymbol.set(key, list);
    }
  }

  const duplicated = [...unguardedBySymbol.entries()]
    .filter(([, refs]) => refs.length > 1)
    .sort((a, b) => a[0].localeCompare(b[0]));

  if (duplicated.length === 0) {
    console.log('[OK] App.utils 系の危険な再代入は検出されませんでした。');
    process.exit(0);
  }

  console.error('[NG] App.utils 系の危険な再代入を検出しました。');
  for (const [symbol, refs] of duplicated) {
    console.error(`- ${symbol}`);
    refs
      .sort((a, b) => {
        const pa = toRel(a.filePath);
        const pb = toRel(b.filePath);
        if (pa === pb) return a.line - b.line;
        return pa.localeCompare(pb);
      })
      .forEach((ref) => {
        console.error(`  - ${toRel(ref.filePath)}:${ref.line}`);
      });
  }

  process.exit(1);
}

main();
