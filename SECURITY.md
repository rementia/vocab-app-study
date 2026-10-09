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

* The browser uses public Firebase client configuration, including its Firebase API key; this is **not** a server-side authentication secret. Firebase Auth, Firestore Security Rules and service permissions must enforce access restrictions.
  （ブラウザ内のFirebase設定値は公開情報です。アクセス制御はFirebase Auth、Firestoreのルールとサービス権限で行います。）
* The separate Google Apps Script synchronization flow requires service-account credentials in **Apps Script Script Properties**. Never commit the actual private key, access tokens or other server credentials to GitHub.
  （Apps Script側で使用するサービスアカウント秘密鍵等はScript Propertiesで管理し、GitHubには保存しません。）
* A token or sync URL included in public frontend source or a public repository is **not** a strong authorization boundary. Verify the actual Apps Script deployment access and execution identity independently.
  （公開コードに含まれる同期用トークンやURLだけでは、第三者からの利用を安全に防止できません。実デプロイの権限確認が必要です。）
* Under the current **repository** Firestore rules, `privateWords/{vol}` is readable by **any authenticated Firebase user**, not only its owner. Actual deployed rules require separate verification. Per-user `privateUsers/{uid}` reads/writes are UID-scoped.
  （リポジトリ上のルールでは単語データは認証済みユーザー全員が閲覧可能です。本番反映状況は未確認です。）
* If real server credentials have ever been exposed, removing them from the repository alone does not revoke them; rotate or revoke them in the relevant provider.
  （秘密鍵が流出した場合、GitHubからの削除だけでなく提供元での失効・ローテーションが必要です。）
