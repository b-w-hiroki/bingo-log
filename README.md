# B·log — ビンゴ × 旅の記録 (MVP)

観光地での体験を「マス目」というフレームに記録していく Web アプリ。
Phase 0〜1 (MVP) の実装。SPA / Vanilla JS / ハッシュルーティング。

## 起動方法

このディレクトリ直下にすべてのファイルが配置されています。
ローカル HTTP サーバーで起動してください (`file://` では IndexedDB / fetch が制限される場合があります)。

```bash
# Python (推奨)
python3 -m http.server 8000
# または
python -m http.server 8000
```

ブラウザで `http://localhost:8000/` を開きます。
モバイル想定のレイアウトですが、PC ブラウザでも中央にカードフレームで表示されます。

## ファイル構成

```
Bingo-Log/
├── index.html        エントリポイント (SPA)
├── styles.css        デザイントークン + 全画面スタイル
├── app.js            ルーティング + 画面レンダリング + イベント処理
├── storage.js        localStorage / IndexedDB 抽象 API
├── locations.js      観光地マスターデータ (清水寺・東大寺奈良公園)
├── utils.js          UUID / 日時 / DOM / toast ヘルパ
└── README.md         本ファイル
```

## ルーティング

| ハッシュ | 画面 | フェーズ |
|---|---|---|
| `#top` | 01 TOP (観光地一覧) | MVP |
| `#spot/:id` | 10 観光地詳細 | MVP |
| `#sheet/:id` | 02 シート | MVP |
| `#cell/:sid/:cid` | 06 マス詳細 | MVP |
| `#mandala/:id` | 04 思い出を広げる (表示のみ) | Phase 2 |
| `#mysheets` | 05 マイシート一覧 | MVP |
| `#mypage` | A2 マイページ | Phase 3 スタブ |
| `#auth` | A1 認証 | Phase 3 スタブ |
| `#settings` | A3 設定 | Phase 3 スタブ |
| `#privacy` `#terms` `#tokushoho` | L1〜L3 法務 | スタブ (静的) |

オーバーレイ系 (URL なし、JS で表示制御):
- 03 記録モーダル (シート画面の未達成マスをタップで表示)
- 07 オンボーディング (初回起動時、TOP の上に1回だけ表示)
- 09 撮影前警告 (記録モーダルから呼び出し / 「今後表示しない」可)
- S1 シェア (シート画面の共有ボタンから)
- C1 お祝い演出 (9/9 達成直後に1回)

## 主要機能

### 実装済み (MVP)
- 観光地カード一覧 + カードタップで詳細へ
- 観光地詳細 → 「ビンゴ開始」でシート生成
- シート画面: 達成率カード + 3×3 グリッド + 写真サムネ表示
- マス記録モーダル: 写真 + コメント(140字) 保存
- マス詳細: 大写真 + コメント + 編集
- マイシート一覧: 全シート + 達成率 + COMPLETE スタンプ
- オンボーディング (初回のみ)
- 撮影警告 (再表示OFF対応)
- 9/9 達成お祝い演出 (1回)

### スタブ (UI のみ・タップで「Phase N で実装予定」 toast)
- A1〜A4 アカウント系
- S1 シェア / T1 取り込み
- C2 サマリー / C3 プリント CTA / P1〜P5 プリント注文
- L1〜L3 法務ページ (静的テキストのみ)

## デザイントークン

`styles.css` の `:root` に CSS カスタムプロパティで定義。

| トークン | 値 | 用途 |
|---|---|---|
| `--ink` | `#1a1a1a` | 主要テキスト・枠線 |
| `--ink-2` | `#555` | 副次テキスト |
| `--ink-3` | `#999` | 最弱テキスト・装飾 |
| `--paper` | `#fefdf9` | 紙の白 (背景) |
| `--paper-2` | `#f4f1e8` | 紙のクリーム (くすみ背景) |
| `--accent` | `#d94f3a` | スタンプレッド (達成・CTA) |
| `--accent-2` | `#fde6e1` | アクセント淡背景 |
| `--solid` / `--dashed` | `1.5px solid/dashed --ink` | 枠線 |

フォント: `Klee One` (本文) / `Caveat` (ロゴ・数値・注釈) / `Yusei Magic` (フォールバック)

## デバッグ

ブラウザのコンソールで:

```js
await debugStore()
```

を実行すると、以下が表示されます:
- 全シートの JSON
- IndexedDB の写真キー一覧
- フラグ (`onboarding_done` / `photo_warning_seen` 等)
- 予約フィールドの初期化状況 (`ownerId` / `isPublic` / `sourceSheetId` / `stats` / `children` / `referenceCell`)

## Phase 3 (Supabase 移行) の布石

handoff の必須5項目を厳守:

1. **すべての ID は `crypto.randomUUID()`** で発番 (`Utils.uuid` 経由)
2. **storage.js を抽象 API として閉じる** — UI から `localStorage` / `IndexedDB` を直接触らない
3. **写真は `Storage.getPhotoURL(photoKey)` 経由でのみ取得**
4. **予約フィールドを `null` / 初期値で必ずセット** — `ownerId` / `isPublic` / `sourceSheetId` / `stats` / `Cell.children` / `Cell.referenceCell`
5. **タイムスタンプは `new Date().toISOString()`** (`Utils.nowIso`)

`// Phase N:` コメントを下記の箇所に残しています:
- `storage.js` `savePhoto` / `getPhotoURL` → Supabase Storage 差し替え点
- `storage.js` `saveSheet` / `listSheets` → Supabase DB 差し替え点
- `app.js` `createSheet` 内の `ownerId` / `isPublic` / `sourceSheetId` / `stats` / `children` / `referenceCell` 行
- `app.js` 「他の人のこのマス」タブ (`cell-tabs .tab.locked`) → Phase 4 ソーシャル機能
- `app.js` シェア / 取り込み / プリント ボタン群

## 既知の制約 (MVP のため)

- 「思い出を広げる」(マンダラ拡張) は表示のみ (Phase 2 で派生マス追加機能を実装)
- 「他人のシート」「取り込み」「公開URL」は Phase 3〜4
- お祝い演出はアニメーションのみ。サマリー画面 (C2) は Phase 5
- LP ページ (LP01 / LP02) は本MVPに含まず

## デプロイ

すべて静的ファイルなので、GitHub Pages / Vercel / Cloudflare Pages 等にそのままデプロイ可能。
ビルドステップは不要。

## 画像で保存（2026-11）
シートの共有ボタンから写真・お題を3×3のPNGへ書き出せます。プレビュー・写真の欠損表示・再試行を備え、コメント・位置情報は画像に含めません。記録は端末内保存であり、URLは他端末への配信を実装したものではありません。既存の公開シート画面は同一端末内の試作です。
