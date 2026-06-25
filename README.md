# Kozu Tabi Restaurant Map

スペイン旅行用の飲食店・予定地マップです。表示UIは `common_web_map` の共通コードを使います。

## ファイル構成

- `index.html`: 本番用HTML。`https://common-web-map.vercel.app/` の `map_app.css` / `map_app.js` を参照します。
- `index_dev.html`: ローカル開発用HTML。`../common_web_map/` の `map_app.css` / `map_app.js` を参照します。
- `store_data.json`: 地域一覧と、地域別JSON・ランドマークJSONへの参照を管理します。
- `regions/*.json`: 地域ごとの店舗データ本体です。
- `landmarks/*.json`: 宿泊地・観光地など、店舗以外の予定地データです。

## 現在の地域

- `barcelona`: バルセロナ
- `madrid`: マドリード

## ローカル確認

`fetch()` でJSONを読み込むため、HTMLを直接開かずHTTPサーバー経由で確認します。

```bash
cd /root/restaurant_map/kozu_tabi_restaurant_map
python3 -m http.server 8300 --bind 0.0.0.0
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
- `sources[].title` / `sources[].url`

未確認の値もキー自体は省略せず、`null` または `[]` で明示します。

## 検証

```bash
python -m json.tool store_data.json >/tmp/kozu_store_data_check.json
for f in regions/*.json landmarks/*.json; do python -m json.tool "$f" >/tmp/"$(basename "$f")".check; done
node --check /root/common_web_map/map_app.js
```
