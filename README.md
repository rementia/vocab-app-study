# English Vocabulary App

ブラウザ上で動作する英単語学習アプリです。

英単語を眺めるだけではなく、想起学習、四択問題、発音、自動再生、ランダム復習、頻度調整、お気に入り、苦手単語管理を組み合わせて、繰り返し復習しやすい形にしています。

## Demo

GitHub Pages:

https://rementia.github.io/vocab-app-study/

## Overview

このアプリは、HTML / CSS / JavaScript で作成した静的フロントエンドアプリです。

単語データは Google Sheets で管理し、Google Apps Script で Cloud Firestore に同期しています。Web アプリ本体は Firestore から単語 CSV を取得し、ブラウザ側で表示用データに変換します。

ユーザーごとの学習状態は、Firebase Authentication の UID を使って Firestore に分離保存します。一方で、現在の表示位置や一部の表示設定は `localStorage` に保存し、同じ端末・同じブラウザで復元できるようにしています。

## Study Version Design

このリポジトリは、個人学習用の英単語アプリ study 版です。

公開用アプリとは保存先を分けるため、Firestore collection と localStorage key prefix を study 版専用にしています。ユーザー別学習データは `privateUsers/{uid}`、localStorage は `vocab_app_study_` prefix に分けています。

ログインなしでもアプリの基本表示は利用でき、選択中の volume、mode、表示位置、表示設定などのブラウザ内状態は localStorage で復元できます。お気に入り・苦手単語などのユーザー別学習データは、Googleログイン後に利用・保存され、Firestore `privateUsers/{uid}` に保存されます。

## Data Storage Overview

このアプリでは、保存するデータの性質に応じて Firestore と localStorage を使い分けています。

| 保存先                            | 保存内容       | 共有範囲          | 主な目的                    |
| ------------------------------ | ---------- | ------------- | ----------------------- |
| Firestore `privateWords/{vol}` | 単語データ      | アプリ全体         | vol.1〜vol.4 の単語データを管理する |
| Firestore `privateUsers/{uid}` | ユーザー別の学習状態 | 同じGoogleアカウント | お気に入り・苦手単語などを保存する       |
| localStorage                   | 画面状態・表示設定  | 同じブラウザのみ      | 前回開いていた状態を復元する          |

## Firestore Design

Firestore では、単語データとユーザー別データを分けて保存しています。

```txt
privateWords/{vol}
privateUsers/{uid}
```

### `privateWords/{vol}`

`privateWords/{vol}` は、vol.1〜vol.4 の単語データを保存する collection です。

```txt
privateWords
├─ vol1
├─ vol2
├─ vol3
└─ vol4
```

主な役割は、アプリで表示する単語データを一元管理することです。

### `privateUsers/{uid}`

`privateUsers/{uid}` は、Googleログインしたユーザーごとの学習状態を保存する collection です。

```txt
privateUsers
└─ {uid}
   ├─ favorites
   ├─ favoritesUpdatedAt
   ├─ difficults
   └─ difficultsUpdatedAt
```

主な役割は、同じGoogleアカウントでログインしたときに、別端末でも学習状態を共有できるようにすることです。

## localStorage Design

study 版では、公開版や旧版の保存データと衝突しないように、localStorage の key に study 版専用 prefix を付けています。

```txt
vocab_app_study_
```

主な localStorage key は次の通りです。

```txt
vocab_app_study_current_vol
vocab_app_study_current_mode
vocab_app_study_index_by_vol
vocab_app_study_sidebar_open
vocab_app_study_auto_speak
vocab_app_study_review_scores
vocab_app_study_challenge_mode
vocab_app_study_challenge_time
vocab_app_study_display_time
vocab_app_study_translation_mode
vocab_app_study_multiple_choice_mode
vocab_app_study_auto_play
vocab_app_study_random_mode
vocab_app_study_frequency_mode
```

localStorage に保存するものは、基本的に「そのブラウザで前回状態を復元するための情報」です。

例:

| key                            | 役割                    |
| ------------------------------ | --------------------- |
| `vocab_app_study_current_vol`  | 最後に開いていた volume を復元する |
| `vocab_app_study_current_mode` | 最後に使っていた mode を復元する   |
| `vocab_app_study_index_by_vol` | volume ごとの現在位置を復元する   |
| `vocab_app_study_sidebar_open` | sidebar の開閉状態を復元する    |
| `vocab_app_study_auto_speak`   | 発音自動再生のON/OFFを復元する    |

## Why Firestore and localStorage are separated

Firestore と localStorage は役割が違うため、保存するデータを分けています。

Firestore は、Googleアカウントに紐づけて長期的に残したいデータに使います。
localStorage は、そのブラウザだけで復元できればよい表示状態や設定に使います。

```txt
Firestore
= アカウントに紐づく学習データ

localStorage
= ブラウザに紐づく画面状態・表示設定
```

このように分けることで、アプリのデータ設計を整理しやすくし、公開版・study版・旧版の保存データが混ざらないようにしています。


## Features

- vol.1〜vol.4 の単語リスト切り替え
- 英単語・意味の表示
- 単語検索
- 訳語切替
- 四択問題モード（英→日 / 日→英）
- 四択問題の正誤履歴保存と頻度順レビューへの反映
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
- 四択問題モード設定
- 四択問題の正誤履歴
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
