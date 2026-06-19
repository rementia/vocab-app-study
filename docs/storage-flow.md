# Storage Flow

このドキュメントは、study版アプリの保存先と復元フローを整理するためのものです。

## Conclusion

study版では、単語データ、ユーザー別学習データ、ブラウザ内状態を分けて保存します。

```txt
Vocabulary data
→ Firestore privateWords/{vol}

User-specific learning data
→ Firestore privateUsers/{uid}

Browser-local UI state and review scores
→ localStorage vocab_app_study_*
```

## Storage Roles

| Storage                        | Data                         | Scope               | Purpose                                      |
| ------------------------------ | ---------------------------- | ------------------- | -------------------------------------------- |
| Firestore `privateWords/{vol}` | Vocabulary data              | Study app           | Stores vol.1-vol.4 vocabulary CSV data       |
| Firestore `privateUsers/{uid}` | User-specific learning data  | Same Google account | Saves favorites, difficult words, timestamps |
| localStorage                   | Browser-local UI state       | Same browser only   | Restores the previous browser state          |

## Firestore Flow

The study version loads vocabulary data from Firestore `privateWords/{vol}`.

```txt
Google Sheets
  ↓
Google Apps Script
  ↓
Firestore privateWords/{vol}
  ↓
Web App
```

User-specific learning data is available after Google login and is saved under `privateUsers/{uid}`.

```txt
Firebase Authentication
  ↓
uid
  ↓
Firestore privateUsers/{uid}
```

Example user data:

```txt
privateUsers
└─ {uid}
   ├─ favorites
   ├─ favoritesUpdatedAt
   ├─ difficults
   └─ difficultsUpdatedAt
```

## localStorage Flow

Without login, the app can still restore browser-local UI state such as the selected volume, current mode, word position, and display settings through localStorage.

The study version uses this prefix to avoid conflicts with the public portfolio version.

```txt
vocab_app_study_
```

Main keys:

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

localStorage restores state only in the same browser. Firestore is used for Google-login user learning data.

## Multiple Choice Review Flow

In 四択問題 mode, the app records whether each answer was correct or incorrect as review scores / review stats in `vocab_app_study_review_scores`.

Correct answer:

* increases `correct`
* increases `streakCorrect`
* resets `streakWrong`
* updates `lastAnsweredAt`

Wrong answer:

* increases `wrong`
* increases `streakWrong`
* resets `streakCorrect`
* updates `lastAnsweredAt`

Frequency mode uses these review scores to make words with more wrong answers appear more often. Words with repeated correct answers become slightly less frequent, but the weight has a lower bound so a word does not disappear completely.

## Startup Flow

When the app starts, the data is loaded in this general order.

```txt
1. Open the app
2. Load saved browser state from localStorage
3. Initialize navigation, UI events, and pronunciation
4. Check Firebase Authentication login state
5. Load vocabulary data from Firestore privateWords/{vol}
6. If logged in, load user data from Firestore privateUsers/{uid}
7. Render the current word and UI state
```

## Summary

`privateWords/{vol}` is for vocabulary data. `privateUsers/{uid}` is for Google-login user learning data. `vocab_app_study_` localStorage keys are for same-browser state restoration and local review scores used by 四択問題 and frequency mode.
