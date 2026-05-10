#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');

const authPath = path.join(os.homedir(), '.clasprc.json');
const globalOauth2ClientSettings = {
  clientId: '1072944905499-vm2v2i5dvn0a0d2o4ca36i1vge8cvbn0.apps.googleusercontent.com',
  clientSecret: 'v6V3fKV_zWU7iw1DrpO1rknX',
  redirectUri: 'http://localhost'
};

function loadAuthFile() {
  if (!fs.existsSync(authPath)) {
    throw new Error(`認証ファイルが見つかりません: ${authPath}`);
  }

  const raw = fs.readFileSync(authPath, 'utf8');
  const parsed = JSON.parse(raw);

  // tokens.default を最優先（最新のトークン）
  if (parsed && parsed.tokens && typeof parsed.tokens === 'object') {
    const candidate = parsed.tokens.default || Object.values(parsed.tokens).find((value) => value && typeof value === 'object');
    if (candidate && candidate.access_token) {
      return { parsed, token: candidate, migrated: true };
    }
  }

  // 次に token （旧形式）を試す
  if (parsed && typeof parsed.token === 'object' && parsed.token && parsed.token.access_token) {
    return { parsed, token: parsed.token, migrated: false };
  }

  // 最後に top-level の access_token
  if (parsed && typeof parsed.access_token === 'string') {
    return { parsed, token: parsed, migrated: true };
  }

  throw new Error('認証情報から token を復元できませんでした。clasp login をやり直してください。');
}

try {
  const { token, migrated } = loadAuthFile();
  if (!migrated) {
    console.log(`✓ clasp 認証ファイルは既に旧形式です: ${authPath}`);
    process.exit(0);
  }

  const normalized = {
    token,
    oauth2ClientSettings: globalOauth2ClientSettings,
    isLocalCreds: false
  };

  fs.writeFileSync(authPath, `${JSON.stringify(normalized, null, 2)}\n`);
  console.log(`✓ clasp 認証ファイルを旧形式へ正規化しました: ${authPath}`);
} catch (error) {
  console.error(`❌ clasp 認証ファイルの正規化に失敗しました: ${error.message}`);
  process.exit(1);
}