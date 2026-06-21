# English Vocabulary App

[![Test](https://github.com/rementia/vocab-app-study/actions/workflows/test.yml/badge.svg)](https://github.com/rementia/vocab-app-study/actions/workflows/test.yml)

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

## Difference From Public Version

| Area | vocab-app | vocab-app-study |
| --- | --- | --- |
| Purpose | Public portfolio demo | Private study version |
| Vocabulary source | Google Sheets CSV direct fetch | Firestore `privateWords/{vol}` synced by Apps Script |
| Reload button | Refetches Google Sheets CSV | Optionally runs Apps Script sync, then refetches Firestore |
| User collection | `portfolioUsers/{uid}` | `privateUsers/{uid}` |
| Word collection | none | `privateWords/{vol}` |
| localStorage prefix | `portfolio_tango_` | `vocab_app_study_` |

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

アプリ上の `単語データ同期` ボタンを使うと、設定済みの Apps Script Web App を呼び出して Google Sheets から Firestore `privateWords/{vol}` へ同期し、その後に現在の mode に必要な Firestore の CSV を再取得できます。Apps Script Web App URL が未設定の場合は、従来通り Firestore `privateWords/{vol}` の再取得だけを行います。

訳語だけの修正は比較的安全です。英単語そのものを変更すると word key が変わるため、お気に入り・苦手単語・復習スコアとの対応が別単語扱いになる可能性があります。

Apps Script sync example: see `apps-script/README.md`.

Webアプリ側のApps Script連携は `syncConfig.js` で設定します。

```js
export const SHEET_SYNC_WEB_APP_URL = "";
export const SHEET_SYNC_TOKEN = "";
```

`SHEET_SYNC_WEB_APP_URL` を空のままにすると、ボタンは Firestore のみ再読み込みます。`SHEET_SYNC_TOKEN` は個人用の簡易防止用で、フロントエンドに置く値なので完全な秘密としては扱えません。

Apps Script Web Appを使う場合は、Apps Scriptエディタで `apps-script/Code.gs` を貼り付け、Web Appとしてデプロイします。

- デプロイ > 新しいデプロイ
- 種類: ウェブアプリ
- 実行ユーザー: 自分
- アクセスできるユーザー: 運用方針に合わせる
- 発行されたWeb App URLを `SHEET_SYNC_WEB_APP_URL` に設定する
- Apps Script Propertiesに `CLIENT_EMAIL`, `PRIVATE_KEY`, `SYNC_TOKEN` を設定する
- `SYNC_TOKEN` と同じ値を `SHEET_SYNC_TOKEN` に設定する

この同期は Google Sheets をWebアプリが直接fetchするものではありません。Webアプリは Apps Script Web App を呼び出し、Apps Script が Firestore `privateWords/{vol}.csv` を更新し、その後Webアプリが Firestore を再取得します。

### スプレッドシート修正が反映されない場合

Webアプリは Google Sheets を直接読みません。`単語データ同期` は、Apps Script Web App URL が設定されている場合だけ Google Sheets → Firestore 同期を呼び出し、その後 Firestore `privateWords/{vol}` を再取得します。

反映されない場合は、次を確認します。

- `syncConfig.js` の Apps Script Web App URL が設定されている
- Apps Script Web App としてデプロイ済みである
- `apps-script/Code.gs` のような同期処理を実行した
- Firebase Console で `privateWords/vol1`, `privateWords/vol2`, `privateWords/vol3`, `privateWords/vol4` の document ID がコード側の volume 名と一致している
- 各 document の `csv` field が更新されている
- Apps Script 側も単語CSVを `csv` field に保存している
- `csv` field が古いままなら、アプリ側で再読み込みしても古い内容のままになる

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

GitHub Actions の `Test` workflow は、`main` への push、`main` 向け pull request、手動実行（`workflow_dispatch`）で同じ `npm test` を実行します。CI では `package-lock.json` に基づいて `npm ci` を使い、依存関係を再現します。現在のテスト状態は README 上部の badge で確認できます。手動実行する場合は GitHub の Actions タブで `Test` workflow を選び、`Run workflow` を押します。

## 動作確認チェックリスト

### Authentication / access

- [ ] Googleログインできる
- [ ] 未ログイン時は単語データにアクセスできず、既存のロックUIになる
- [ ] 許可されていないユーザーでは `privateWords/{vol}` を読めない
- [ ] ログアウト後に学習UIと単語データ再読み込みボタンがロックされる

### Word data loading

- [ ] ログイン後、vol1〜vol4 の単語データを読み込める
- [ ] volume切り替え時に単語・意味・発音表示が崩れない
- [ ] Firestore `privateWords/{vol}` の `csv` field 更新後、`単語データ再読み込み` で反映される
- [ ] Google Sheets編集後は、Apps ScriptによるFirestore同期完了後に再読み込みする
- [ ] Firebase Consoleで `privateWords/{vol}.csv` が更新されていることを確認してから再読み込みする
- [ ] 再読み込み後、件数や更新メッセージが期待どおり変わる

### Reload behavior

- [ ] 通常volume表示中の再読み込みでは、現在のvolumeだけ再取得される
- [ ] favorites modeで再読み込みしてもお気に入り一覧が壊れない
- [ ] difficults modeで再読み込みしても苦手単語一覧が壊れない
- [ ] 再読み込み後、同じ単語IDが残っていれば同じ単語位置を維持する
- [ ] 対象単語が消えた場合もアプリが落ちず、indexが範囲内に丸められる
- [ ] 成功メッセージが数秒後に消える
- [ ] 失敗メッセージが分かりやすく表示される
- [ ] `privateUsers/{uid}` のお気に入り・苦手単語・復習スコアが再読み込みで消えない

### Learning state

- [ ] お気に入り追加・解除が保存される
- [ ] 苦手単語追加・解除が保存される
- [ ] 復習スコアが保存される
- [ ] ページ再読み込み後も学習状態が復元される
- [ ] 別のGoogleログインユーザーと学習状態が混ざらない
- [ ] `privateUsers/{uid}` の学習データが、単語データ再読み込みで消えない

### Study modes

- [ ] ランダムモードが動く
- [ ] 頻度順モードが動く
- [ ] 四択モードが動く
- [ ] お気に入りモードが動く
- [ ] 苦手単語モードが動く
- [ ] 想起モードが動く
- [ ] 自動再生中に再読み込みした場合、安全に停止する
- [ ] 発音同期中に再読み込みしても壊れない

### Browser / UI

- [ ] PCブラウザで主要操作ができる
- [ ] スマホ幅でレイアウトが崩れない
- [ ] サイドバー、検索、volumeボタンが使える
- [ ] reload status message が自然に表示・消去される
- [ ] console に重大なエラーが出ていない

### CI

- [ ] `npm test` がローカルで通る
- [ ] GitHub Actions の `Test` workflow が緑チェックになる
- [ ] Actions タブから `workflow_dispatch` で手動実行できる

構文確認の例:

```bash
node --check app.js
```

## Project Structure

```txt
app.js                         App initialization and module wiring
bootstrap.js                   Startup entry point
data.js                        Firestore privateWords CSV fetching and parsing
syncConfig.js                  Apps Script Web App URL/token configuration
sheetSyncService.js            Apps Script Web App sync request helper
apps-script/Code.gs            Google Sheets -> Firestore sync Apps Script sample
apps-script/README.md          Apps Script setup and deployment notes
dom.js                         DOM element lookup
ui.js                          DOM rendering and button state updates
events.js                      Keyboard, touch, and viewport events
storage.js                     localStorage keys and safe storage helpers
savedState.js                  Saved localStorage state restore and validation
wordReloadService.js           Current word position handling after Firestore reload
reloadStatusService.js         Reload status messages and auto-clear timers
wordIdentity.js                Stable word key normalization
wordList.js                    Shared word-list helpers
wordOrder.js                   Random and frequency-based ordering
navigation.js                  Word navigation history
pronunciation.js               Pronunciation lookup and speech playback
multipleChoice.js              四択問題 option generation
favoritesManager.js            Favorite word behavior
difficultsManager.js           Difficult word behavior
reviewManager.js               Review score behavior
userMarksCloud.js              privateUsers Firestore sync helpers
firebaseClient.js              Firebase client setup
test/                          Node-based tests
docs/                          Storage flow and manual test notes
.github/workflows/test.yml     GitHub Actions workflow for npm test
package.json                   npm scripts, including npm test
package-lock.json              Locked npm dependency resolution for reproducible CI
```

## Notes

このアプリは個人学習とポートフォリオを目的としたプロジェクトです。

単語データの管理元や管理用 URL は公開リポジトリに含めず、実装・認証・保存設計・UI・テスト構成を中心に確認できるようにしています。
