# Security Policy

## Supported Versions

This project is maintained on a best-effort basis.
（本プロジェクトは善意ベースでメンテナンスされています。）

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |

---

## Reporting a Vulnerability

If you discover a potential security issue, you may report it through a non-public channel.
（セキュリティ上の問題の可能性を発見した場合は、公開されない方法でご報告ください。）

* Please avoid posting sensitive details in public GitHub Issues
  （機密情報をGitHub Issuesに公開しないでください）
* You may use:
  （以下の方法でご連絡いただけます）

  * GitHub Private vulnerability reporting (if available)
  * Direct contact with the maintainer

---

## Response

* Responses are provided on a best-effort basis and may take time
  （対応は善意ベースのため、時間がかかる場合があります）
* Fixes are not guaranteed
  （修正対応を保証するものではありません）
* Reports may be closed without action if they are out of scope
  （内容によっては対応せずクローズする場合があります）

---

## Notes

* Firebase client configuration is public, not a substitute for authentication or Firestore Security Rules.
  （Firebaseクライアント設定は公開情報であり、アクセス制御の代替にはなりません。）
* Google Apps Script synchronization uses service-account credentials in Script Properties. Never place real private keys, access tokens, privileged synchronization tokens or privileged Web App URLs in GitHub or browser-visible JavaScript.
  （Apps Scriptのサービス資格情報と特権同期トークンは公開コードへ置かず、Script Properties等で保管します。）
* The current study app reloads Firestore only; it does not use the old browser-side synchronization configuration. Publicly exposed historical tokens require revocation or rotation, not merely source deletion. Independently verify the active Apps Script deployment and its access settings before changing production credentials.
  （旧ブラウザ側同期設定は未使用です。公開履歴にあるトークンは削除だけで無効化されず、本番デプロイを確認してから失効させます。）
* Repository Firestore rules currently let any authenticated Firebase user read `privateWords/{vol}`, while `privateUsers/{uid}` is UID-scoped. The rules actually deployed to production need separate verification.
  （リポジトリのルールと本番適用中のルールは区別します。）
