# English Vocabulary App

ブラウザ上で動作する英単語学習アプリです。

英単語を眺めるだけではなく、想起学習、発音、自動再生、ランダム復習、頻度調整、お気に入り、苦手単語管理を組み合わせて、繰り返し復習しやすい形にしています。

## Demo

GitHub Pages:

https://rementia.github.io/vocab-app-study/

## Overview

このアプリは、HTML / CSS / JavaScript で作成した静的フロントエンドアプリです。

単語データは Google Sheets で管理し、Google Apps Script で Cloud Firestore に同期しています。Web アプリ本体は Firestore から単語 CSV を取得し、ブラウザ側で表示用データに変換します。

ユーザーごとの学習状態は、Firebase Authentication の UID を使って Firestore に分離保存します。一方で、現在の表示位置や一部の表示設定は `localStorage` に保存し、同じ端末・同じブラウザで復元できるようにしています。

## Features

- vol.1〜vol.4 の単語リスト切り替え
- 英単語・意味の表示
- 単語検索
- 訳語切替
- 発音機能
- 発音同期
- 自動再生
- 想起学習モード
- 想起時間・表示時間の調整
- お気に入り登録・解除
- 苦手単語登録・解除
- 頻度調整 `+ / - / 0`
- 頻度順レビュー
- 乱数配列レビュー
- 進捗表示
- Google ログイン
- Firestore によるユーザー別データ保存
- localStorage による端末別状態復元
- PC / スマートフォン対応

## Screenshot

![Main Screen](./images/main.png)

## Technologies

- HTML
- CSS
- JavaScript
- Firebase Authentication
- Cloud Firestore
- Google Sheets
- Google Apps Script
- GitHub Pages
- Node.js test runner

## Data Flow

単語データは以下の流れで管理しています。

```txt
Google Sheets
  ↓
Google Apps Script
  ↓
Cloud Firestore: privateWords/{vol}
  ↓
Web App
  ↓
Browser UI
```

Firestore 側では、各 volume の CSV を次のような document に保存します。

```txt
privateWords/vol1
privateWords/vol2
privateWords/vol3
privateWords/vol4
```

アプリはログイン後、必要な volume の CSV を取得し、`word`, `meaning`, `sourceVol` を持つ単語データとして扱います。

## User Data

ユーザーごとの学習状態は Firestore に保存します。

```txt
privateUsers/{uid}
```

主な保存内容:

- `favorites`
- `favoritesUpdatedAt`
- `difficults`
- `difficultsUpdatedAt`

保存キーには、スプレッドシート上の英単語を小文字化した word key を使います。これにより、スプレッドシート側に専用 ID 列を追加しなくても、同じ英単語を同じ学習状態として扱えます。

## localStorage

`localStorage` には、主に端末・ブラウザ単位の状態を保存します。

例:

- 現在の volume
- 現在の表示モード
- volume ごとの表示位置
- サイドバー開閉状態
- 発音同期設定
- 想起学習設定
- 自動再生設定
- 乱数配列 / 頻度配列設定
- 発音記号キャッシュ

`localStorage` は端末内のブラウザ保存領域なので、別端末には共有されません。お気に入り・苦手単語は Firestore に保存されるため、同じ Google アカウントでログインすれば別端末でも共有されます。

## Security Notes

このアプリは Firebase Authentication による Google ログインを使用します。

ユーザー別データは Firebase UID を使って分離しています。Firestore のアクセス制御は Firestore Security Rules に依存するため、運用時は Rules 側で次のような制御が必要です。

- 未ログインユーザーに private data を読ませない
- `privateUsers/{uid}` は `request.auth.uid == uid` の本人だけ読み書きできる
- 単語データ `privateWords/{vol}` は許可されたユーザーだけ読める

この README では具体的な UID や private な管理情報は記載していません。

## Development

このプロジェクトは静的フロントエンドアプリです。通常の実行にビルド手順は不要です。

テストを実行する場合:

```bash
npm test
```

構文確認の例:

```bash
node --check app.js
```

## Project Structure

```txt
app.js                Main application flow
data.js               Vocabulary CSV loading and parsing
wordIdentity.js       Word key normalization
storage.js            localStorage helpers
savedState.js         Startup state restoration
userMarksCloud.js     Firestore sync for favorites and difficult words
favoritesManager.js   Favorite word behavior
difficultsManager.js  Difficult word behavior
reviewManager.js      Review score behavior
wordOrder.js          Random and frequency-based ordering
wordList.js           Shared word-list helpers
ui.js                 DOM rendering
events.js             Keyboard, touch, and viewport events
navigation.js         Word navigation history
pronunciation.js      Speech and pronunciation symbol loading
```

## Notes

このアプリは個人学習とポートフォリオを目的としたプロジェクトです。

単語データの管理元や管理用 URL は公開リポジトリに含めず、実装・認証・保存設計・UI・テスト構成を中心に確認できるようにしています。
