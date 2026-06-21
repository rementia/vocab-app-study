# Manual Test Checklist

このドキュメントは、study版アプリを修正した後に手動で確認する項目です。

## 目的

今後、favorites mode、difficults mode、pronunciation cache、mobile layout などを修正したときに、既存機能が壊れていないか確認するために使います。

## 1. 起動確認

* [ ] GitHub Pages でアプリが開ける
* [ ] ローカル環境でアプリが開ける
* [ ] JavaScript エラーがコンソールに出ていない
* [ ] 単語データが表示される
* [ ] 最初の単語が正しく表示される
* [ ] 意味が正しく表示される
* [ ] ボタンやメニューが表示される

## 2. Firestore 読み込み

* [ ] `privateWords/vol1` の単語が読み込まれる
* [ ] `privateWords/vol2` の単語が読み込まれる
* [ ] `privateWords/vol3` の単語が読み込まれる
* [ ] `privateWords/vol4` の単語が読み込まれる
* [ ] 読み込み失敗時にアプリ全体が止まらない
* [ ] 読み込み中の表示が不自然でない

## 3. volume 切り替え

* [ ] vol.1 に切り替えられる
* [ ] vol.2 に切り替えられる
* [ ] vol.3 に切り替えられる
* [ ] vol.4 に切り替えられる
* [ ] volume 切り替え後に単語が表示される
* [ ] volume 切り替え後に index が不自然にならない
* [ ] 再読み込み後、最後に選んだ volume が復元される

## 4. 単語移動

* [ ] 次の単語へ移動できる
* [ ] 前の単語へ移動できる
* [ ] 最初の単語で前へ戻ったときに壊れない
* [ ] 最後の単語で次へ進んだときに壊れない
* [ ] volume ごとに現在位置が保存される
* [ ] 再読み込み後、前回の位置が復元される

## 5. mode 切り替え

* [ ] level mode が動く
* [ ] random mode が動く
* [ ] favorites mode が動く
* [ ] difficults mode が動く
* [ ] mode 切り替え後に単語表示が壊れない
* [ ] mode 切り替え後にボタン状態が不自然でない
* [ ] 再読み込み後、最後に選んだ mode が復元される

## Multiple Choice Mode

* [ ] 四択問題モードに切り替えられる
* [ ] UI上の表示が「四択問題」になっている
* [ ] 英→日で、問題文が英単語、選択肢が日本語訳になる
* [ ] 日→英で、問題文が日本語訳、選択肢が英単語になる
* [ ] 正解時に正解色・正解スタイルが表示される
* [ ] 正解時に「正解」テキストが表示されない
* [ ] 不正解時に不正解色と正解色が表示される
* [ ] 回答後、不正解選択肢を再タップすると訳語に切り替わる
* [ ] もう一度タップすると元の表示に戻る
* [ ] 回答後に不正解選択肢を何度タップしても correct / wrong が再加算されない
* [ ] 次の問題に進むと表示切替状態がリセットされる
* [ ] `vocab_app_study_review_scores` に正誤履歴が保存される
* [ ] reload 後も正誤履歴が復元される
* [ ] frequency mode で不正解の多い単語が出やすくなる

## 6. お気に入り

* [ ] ★ を押すとお気に入りに追加される
* [ ] もう一度 ★ を押すとお気に入りから外れる
* [ ] お気に入り状態が画面に反映される
* [ ] favorites mode に追加した単語が表示される
* [ ] favorites mode でお気に入り解除したときに表示が壊れない
* [ ] 再読み込み後もお気に入りが残っている
* [ ] Googleログイン後、Firestore `privateUsers/{uid}` に保存される

## 7. 苦手単語

* [ ] 苦手単語に追加できる
* [ ] 苦手単語から削除できる
* [ ] 苦手単語状態が画面に反映される
* [ ] difficults mode に苦手単語が表示される
* [ ] difficults mode で苦手解除したときに表示が壊れない
* [ ] 再読み込み後も苦手単語が残っている
* [ ] Googleログイン後、Firestore `privateUsers/{uid}` に保存される

## 8. localStorage 復元

* [ ] `vocab_app_study_current_vol` が保存される
* [ ] `vocab_app_study_current_mode` が保存される
* [ ] `vocab_app_study_index_by_vol` が保存される
* [ ] `vocab_app_study_sidebar_open` が保存される
* [ ] `vocab_app_study_auto_speak` が保存される
* [ ] `vocab_app_study_review_scores` is saved
* [ ] `vocab_app_study_multiple_choice_mode` is saved
* [ ] 再読み込み後、volume が復元される
* [ ] 再読み込み後、mode が復元される
* [ ] 再読み込み後、単語位置が復元される
* [ ] 再読み込み後、UI設定が復元される
* [ ] Review scores are restored after reload
* [ ] Multiple choice mode setting is restored after reload

## 9. 発音

* [ ] 発音ボタンを押すと音声が再生される
* [ ] auto speak ON で自動再生される
* [ ] auto speak OFF で自動再生されない
* [ ] 単語を移動したときに発音状態が不自然でない
* [ ] 発音取得に失敗してもアプリ全体が止まらない
* [ ] 発音同期ONのまま再読み込み後、最初のタップまたはスワイプで音声有効化を試みる
* [ ] iPhone Safariで、再読み込み後の最初の成立スワイプだけ通常delayなしの発音同期を試みる
* [ ] ブラウザ制限で鳴らない場合も、音声有効化の案内が表示される
* [ ] 一度タップまたは音声有効化後、単語移動で発音同期される
* [ ] 発音同期OFFではスワイプしても勝手に発音されない
* [ ] ブラウザ仕様上、完全な自動再生は保証されないため、鳴らない場合は一度タップしてから再試行する

## 10. UI 操作

* [ ] sidebar を開ける
* [ ] sidebar を閉じられる
* [ ] sidebar の開閉状態が保存される
* [ ] ボタンの見た目が現在状態と一致する
* [ ] 画面サイズを変えても大きく崩れない

## 11. モバイル表示

* [ ] スマホ幅で表示が崩れない
* [ ] 横画面で見やすい
* [ ] ボタンが押しやすい
* [ ] sidebar が操作できる
* [ ] 文字が小さすぎない
* [ ] 画面外にはみ出す要素がない

## 12. Googleログイン

* [ ] Googleログインできる
* [ ] ログアウトできる
* [ ] ログイン前でも最低限アプリが使える
* [ ] ログイン後、ユーザー別データが読み込まれる
* [ ] 別ユーザーのデータが混ざらない
* [ ] ログアウト後に表示が不自然にならない

## 13. GitHub Pages 反映後

* [ ] `git push` 後、GitHub Pages に反映される
* [ ] 公開URLでアプリが開ける
* [ ] Firestore読み込みが動く
* [ ] localStorage復元が動く
* [ ] ログインが動く
* [ ] コンソールに重大なエラーが出ていない

## 14. 変更後の最終確認

* [ ] `git status` で意図しない変更がない
* [ ] 変更したファイルを確認した
* [ ] ローカルで動作確認した
* [ ] GitHub Pages 反映後にも動作確認した
* [ ] README または docs に必要な説明を追加した
