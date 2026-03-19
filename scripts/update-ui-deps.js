#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const cssHtmlPath = path.join(repoRoot, 'projects', 'frontend', 'src', 'css.html');
const membersScriptPath = path.join(repoRoot, 'projects', 'frontend', 'src', 'pages', 'members-script.html');

const args = process.argv.slice(2);
const options = {
  beercss: null,
  materialDynamicColors: null,
  tabulator: null
};

function parseArgs(argv) {
  argv.forEach((arg) => {
    if (arg.startsWith('--beercss=')) {
      options.beercss = arg.split('=')[1];
      return;
    }
    if (arg.startsWith('--material-dynamic-colors=')) {
      options.materialDynamicColors = arg.split('=')[1];
      return;
    }
    if (arg.startsWith('--tabulator=')) {
      options.tabulator = arg.split('=')[1];
    }
  });
}

function replaceAllChecked(content, regex, replacer, label) {
  let count = 0;
  const next = content.replace(regex, (...params) => {
    count += 1;
    return typeof replacer === 'function' ? replacer(...params) : replacer;
  });
  if (count === 0) {
    throw new Error(`更新対象が見つかりませんでした: ${label}`);
  }
  return { next, count };
}

function updateCssHtml(content) {
  let next = content;
  const summary = [];

  if (options.beercss) {
    const cssResult = replaceAllChecked(
      next,
      /beercss@([0-9]+\.[0-9]+\.[0-9]+)/g,
      `beercss@${options.beercss}`,
      'css.html beercss'
    );
    next = cssResult.next;
    summary.push(`beercss@${options.beercss} (${cssResult.count}箇所)`);
  }

  if (options.materialDynamicColors) {
    const mdcResult = replaceAllChecked(
      next,
      /material-dynamic-colors@([0-9]+\.[0-9]+\.[0-9]+)/g,
      `material-dynamic-colors@${options.materialDynamicColors}`,
      'css.html material-dynamic-colors'
    );
    next = mdcResult.next;
    summary.push(`material-dynamic-colors@${options.materialDynamicColors} (${mdcResult.count}箇所)`);
  }

  return { next, summary };
}

function updateMembersScript(content) {
  let next = content;
  const summary = [];

  if (options.tabulator) {
    const tabulatorResult = replaceAllChecked(
      next,
      /tabulator-tables@([0-9]+\.[0-9]+\.[0-9]+)/g,
      `tabulator-tables@${options.tabulator}`,
      'members-script.html tabulator'
    );
    next = tabulatorResult.next;
    summary.push(`tabulator-tables@${options.tabulator} (${tabulatorResult.count}箇所)`);
  }

  return { next, summary };
}

function main() {
  parseArgs(args);
  if (!options.beercss && !options.materialDynamicColors && !options.tabulator) {
    console.error('使い方: node scripts/update-ui-deps.js [--beercss=4.0.19] [--material-dynamic-colors=1.1.2] [--tabulator=6.3.0]');
    process.exit(1);
  }

  const cssHtml = fs.readFileSync(cssHtmlPath, 'utf8');
  const membersScript = fs.readFileSync(membersScriptPath, 'utf8');

  const cssUpdated = updateCssHtml(cssHtml);
  const membersUpdated = updateMembersScript(membersScript);

  fs.writeFileSync(cssHtmlPath, cssUpdated.next, 'utf8');
  fs.writeFileSync(membersScriptPath, membersUpdated.next, 'utf8');

  const applied = [...cssUpdated.summary, ...membersUpdated.summary];
  if (applied.length === 0) {
    console.log('指定された更新対象はありませんでした。');
    return;
  }
  console.log('[OK] UI依存バージョンを更新しました:');
  applied.forEach((line) => console.log(`- ${line}`));
}

main();
