# Kozu Tabi Restaurant Map

スペイン旅行用の飲食店・予定地マップです。表示UIは `common_web_map` の共通コードを使います。

## ファイル構成

- `index.html`: 本番用HTML。共通ページシェルに `https://common-web-map.vercel.app/` の `map_app.css` / `map_app.js` を参照する設定を渡します。
- `index_dev.html`: ローカル開発用HTML。共通ページシェルに `../common_web_map/` の `map_app.css` / `map_app.js` を参照する設定を渡します。
- `page_shell.js`: `index.html` と `index_dev.html` の共通ページ構造、CSS、Leaflet、共通アプリJSの読み込みを管理します。
- `personal_features.js`: 都市投稿・共有店舗メモ・共有お気に入りを `/api/community` 経由で読み書きします。
- `api/community.js`: Neonへ接続するVercel Serverless Functionです。接続文字列はブラウザへ公開しません。
- `database/schema.sql`: 共有機能用のNeonテーブル定義です。
- `store_data.json`: 地域一覧と、地域別JSON・ランドマークJSONへの参照を管理します。
- `regions/*.json`: 地域ごとの店舗データ本体です。
- `landmarks/*.json`: 宿泊地・観光地など、店舗以外の予定地データです。

## 現在の地域

- `barcelona`: バルセロナ
- `granada`: グラナダ
- `toledo`: トレド
- `aranjuez`: アランフェス
- `segovia`: セゴビア
- `madrid`: マドリード

## ローカル確認

共有APIを含めて確認するため、同梱のローカル開発サーバーを使用します。

```bash
cd /root/restaurant_map/kozu_tabi_restaurant_map
npm install
source ~/.bashrc
npm run dev -- --listen 8300
```

ブラウザで開きます。

```text
http://127.0.0.1:8300/index_dev.html
```

本番用HTMLの参照先も確認する場合は、同じサーバーで次のURLを開きます。

```text
http://127.0.0.1:8300/index.html
```

コンテナ外のホストから確認する場合は、ポートフォワード後に次のURLを開きます。

```text
http://192.168.1.2:8300/index_dev.html
```

```text
http://192.168.1.2:8300/index.html
```

## Neon共有データ

初回のみ、Neonへ共有テーブルを作成します。

```bash
source ~/.bashrc
psql "$KOZUTABI_DATABASE_URL" -v ON_ERROR_STOP=1 -f database/schema.sql
```

作成されるテーブルは次の3つです。

- `kozu_city_posts`: 都市ごとの共有投稿
- `kozu_store_memos`: 店舗ごとに1件の共有メモ
- `kozu_favorites`: 店舗ごとの共有お気に入りON/OFF

既存のブラウザに `localStorage` 保存されている内容は、都市を初めて表示したときに1回だけNeonへ移行されます。店舗メモの移行時にNeon側に同じ店舗のメモがすでにある場合は、共有中の内容を上書きしません。

Vercelへデプロイするときは、Project SettingsのEnvironment Variablesに `KOZUTABI_DATABASE_URL` または `DATABASE_URL` を登録してから再デプロイしてください。接続文字列をHTMLやJavaScriptへ直接記載しないでください。

## 店舗データ形式

`regions/*.json` は `bar_hopping_map` と同じ統一スキーマです。

各店舗は全地域で同じ構造に揃えます。最低限、次の項目を入れます。

- `id`
- `store_name`
- `basic_info.address`
- `basic_info.area`
- `basic_info.genre`
- `basic_info.saturday_hours_note`
- `basic_info.saturday_hours_last_checked`
- `basic_info.saturday_hours_sources`
- `map_position.lat` / `map_position.lng`
- `map_position.source` / `map_position.confidence` / `map_position.correction_note`
- `notes.coordinate_status`
- `sources[].title` / `sources[].url`

未確認の値もキー自体は省略せず、`null` または `[]` で明示します。

座標は POI 由来を優先します。住所ジオコーディングや住所近傍から推定した座標は、`map_position.correction_note` と `notes.coordinate_status` にその旨を記録します。`index_dev.html` では、住所推定など精度に注意が必要な店舗に座標精度バッジを表示します。

## 検証

```bash
python -m json.tool store_data.json >/tmp/kozu_store_data_check.json
for f in regions/*.json landmarks/*.json; do python -m json.tool "$f" >/tmp/"$(basename "$f")".check; done
node --check /root/restaurant_map/common_web_map/map_app.js
npm run check
npm run test:frontend
source ~/.bashrc && npm run test:integration
```
