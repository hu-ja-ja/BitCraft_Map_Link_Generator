# BitCraft Map Link Generator

BitCraft のリソース ID / エネミー ID を選択し、マップURLを生成する Astro + SolidJS アプリです。

## 開発コマンド

| Command | Action |
| :-- | :-- |
| `pnpm install` | 依存関係をインストール |
| `pnpm dev` | 開発サーバー起動 (`http://localhost:4321`) |
| `pnpm build` | 本番ビルド |
| `pnpm preview` | ビルド成果物のローカル確認 |
| `pnpm fetch:resources` | リソース定義の更新スクリプト実行 |

## 配信構成

- フロントエンド: GitHub Pages (`https://hu-ja-ja.github.io/BitCraft_Map_Link_Generator`)
- プレイヤー検索 API: Vercel (`https://bitcraft-map-link-generator.vercel.app/api/players`)

Astro 側は GitHub Pages 用の static 出力のみです。Vercel では Astro をビルドせず、
リポジトリ直下の `api/` ディレクトリを Vercel Functions として配信します。

### Vercel 設定

- Root Directory: `api`
- API Function: `api/api/players.ts` (公開 URL: `/api/players`)

### 環境変数

- `PLAYER_API_APP_IDENTIFIER` (Server only, optional)
  - 上流 API (`https://bitjita.com/api/players`) へ送る `x-app-identifier` ヘッダー値
  - 未設定時は既定値: `Map_Link_Generator (discord: hu_ja_ja_)`

- `PUBLIC_PLAYER_SEARCH_ENDPOINT` (Client, optional)
  - フロントエンド側の検索先を上書きしたいときのみ設定
  - 通常は未設定で `https://bitcraft-map-link-generator.vercel.app/api/players` を使う

## ディレクトリ概要

- `src/components`: SolidJS UI
- `api/api/players.ts`: Vercel Functions で動作するプレイヤー検索プロキシ
- `src/data`: リソース定義の読み込み
- `scripts/fetch-resources.mjs`: データ更新用スクリプト
