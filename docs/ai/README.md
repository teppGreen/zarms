# AI Agent Configuration Structure

このディレクトリは、現在の運用構造（GitHub Copilot 向け）を説明します。

## 役割

- AGENTS.md: 全エージェント共通の正本ルール
- .github/copilot-instructions.md: GitHub Copilot 向け入口
- .github/skills/: Copilot が読むスキル

## 運用方針

- 規約本文は AGENTS.md にのみ記載する
- 入口ファイルは参照先のみ記載し、規約を重複しない
- スキル追加時は .github/skills/ 配下に配置する
