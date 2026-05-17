# English Vocabulary App

英単語学習を効率化するために制作した、ブラウザ上で動作する英単語帳アプリです。  
単語の確認、意味の表示、発音、ランダム学習、お気に入り登録、想起学習などを通して、英単語を効率よく復習できるように設計しました。

## Demo

GitHub Pagesで公開しています。

https://rementia.github.io/vocab-app-study/

## Overview

このアプリは、英単語を単に日本語訳で暗記するのではなく、繰り返し思い出す「想起学習」を取り入れることで、記憶の定着を高めることを目的としています。

単語データはGoogle Sheetsで管理し、Google Apps Scriptを用いてCSV形式に変換したうえでCloud Firestoreへ同期しています。  
アプリ本体はFirestoreから単語データを取得する構成にしており、公開リポジトリ上にスプレッドシートURLや管理用データを直接置かないようにしています。

## Features

- vol.1〜vol.4の英単語リスト切り替え
- 英単語と意味の表示
- 発音機能
- 自動発音機能
- お気に入り登録機能
- お気に入り一覧表示
- ランダム学習モード
- 想起学習モード
- 想起時間の調整
- 学習中の進捗表示
- Googleログイン機能
- ログイン状態に応じた利用制限
- お気に入り情報のクラウド保存
- 前回の表示状態の復元
- PC・スマートフォン対応のレスポンシブデザイン

## Screenshots

### Main Screen

![Main Screen](./images/main.png)

## Technologies Used

- HTML
- CSS
- JavaScript
- Firebase Authentication
- Cloud Firestore
- Google Apps Script
- Google Sheets
- GitHub Pages

## Data Flow

このアプリでは、単語データを以下の流れで管理しています。

```txt
Google Sheets
↓
Google Apps Script
↓
CSV形式に変換
↓
Cloud Firestore
↓
Web App
