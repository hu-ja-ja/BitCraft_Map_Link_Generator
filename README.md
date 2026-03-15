# BitCraft Map Link Generator

BitCraft のリソース ID / エネミー ID を選択し、マップURLを生成する Astro + SolidJS アプリです。

## 技術スタック

- フレームワーク
  - Astro 6 (`astro`)
  - SolidJS (`solid-js`)
- Astro 統合 / デプロイ
  - Solid 連携: `@astrojs/solid-js`
  - Vercel アダプタ: `@astrojs/vercel` (API 配信用)
- UI / デザイン
  - Kobalte (`@kobalte/core`): `Dialog` / `Checkbox` / `Search` などのヘッドレス UI
  - Lucide (`lucide-solid`): アイコン
  - Fontsource (`@fontsource/ibm-plex-sans`): フォント配信
- データ / ユーティリティ
  - `yaml`: リソース定義 YAML の読み書き
  - `scripts/fetch-resources.mjs`: リソース定義更新スクリプト
- 言語
  - TypeScript

## 主要コンポーネント

- `src/components/App.tsx`
  - 画面全体のメインコンポーネント。
  - リソース選択、URL 生成、プレビュー iframe、プレイヤーID設定ダイアログを統括。
- `src/components/ResourceTable.tsx`
  - Tier 別リソース一覧テーブル。
  - セルクリックで選択状態を切り替え。
- `src/components/PlayerSearch.tsx`
  - プレイヤー検索 UI。
  - 検索 API 呼び出し、レート制御、ローカル保存を担当。
- `src/components/hooks/useSelection.ts`
  - リソース / ユニーク選択状態の管理フック。
  - 追加・削除・選択判定・全解除ロジックを提供。
- `src/components/hooks/useMapUrl.ts`
  - 選択状態からマップ URL を生成するフック。
  - `resourceId` / `enemyId` / `playerId` のクエリ組み立てと iframe 更新を担当。

## API / データ構成

- `api/api/players.ts`
  - Vercel Functions で動作するプレイヤー検索プロキシ。
  - フロントからの検索クエリを上流 API へ中継。
- `src/data/resources.ts`
  - リソース定義データの読み込みと整形。
- `src/i18n/`
  - `context.tsx` と `locales/en.yaml`, `locales/ja.yaml` による i18n 管理。

## 開発コマンド

| Command | Action |
| :-- | :-- |
| `pnpm install` | 依存関係をインストール |
| `pnpm dev` | 開発サーバー起動 (`http://localhost:4321`) |
| `pnpm lint` | Oxlint を実行 (warn も表示) |
| `pnpm lint:fix` | Oxlint の自動修正を適用 |
| `pnpm lint:ci` | Oxlint を警告で失敗させる CI 用チェック |
| `pnpm build` | 本番ビルド |
| `pnpm preview` | ビルド成果物のローカル確認 |
| `pnpm fetch:resources` | リソース定義の更新スクリプト実行 |

## 配信構成

- フロントエンド: GitHub Pages (`https://hu-ja-ja.github.io/BitCraft_Map_Link_Generator`)
- プレイヤー検索 API: Vercel (`https://bitcraft-map-link-generator.vercel.app/api/players`)

Astro 側は GitHub Pages 用の static 出力のみです。Vercel では Astro をビルドせず、リポジトリ直下の `api/` ディレクトリを Vercel Functions として配信します。

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
