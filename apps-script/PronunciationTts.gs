/**
 * High-confidence pronunciation audio endpoint for the study app.
 *
 * Deploy this file in the SAME Google Apps Script project as Code.gs.
 * The existing SYNC_TOKEN, CLIENT_EMAIL, and PRIVATE_KEY Script Properties
 * are reused. The service account must belong to the Firebase/GCP project
 * and Cloud Text-to-Speech API must be enabled for that project.
 *
 * Request:
 *   GET ?action=pronunciationTts&token=...&word=...&phonetic=...
 *
 * Response:
 *   { ok: true, audioContent: "<base64 mp3>", mimeType: "audio/mpeg", voice: "..." }
 *
 * The client only calls this endpoint for pronunciationStatus=verified rows.
 * Google Cloud Text-to-Speech is instructed with the verified en-US IPA,
 * so the synthesizer does not have to infer the word pronunciation itself.
 */

const PRONUNCIATION_TTS_ACTION = "pronunciationTts";
const PRONUNCIATION_TTS_VOICE = "en-US-Neural2-F";
const PRONUNCIATION_TTS_LANGUAGE = "en-US";
const PRONUNCIATION_TTS_CACHE_SECONDS = 21600;
const PRONUNCIATION_TTS_MAX_WORD_LENGTH = 120;
const PRONUNCIATION_TTS_MAX_PHONETIC_LENGTH = 240;

function doGet(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};

    if (params.action !== PRONUNCIATION_TTS_ACTION) {
      return createJsonResponse({
        ok: false,
        error: "Unsupported action"
      });
    }

    validatePronunciationTtsToken(params.token);

    const word = normalizePronunciationTtsWord(params.word);
    const phonetic = normalizePronunciationTtsPhonetic(params.phonetic);

    if (!word) {
      throw new Error("word が空です。");
    }
    if (!phonetic) {
      throw new Error("phonetic が空です。");
    }

    const cache = CacheService.getScriptCache();
    const cacheKey = makePronunciationTtsCacheKey(word, phonetic);
    const cached = cache.get(cacheKey);
    if (cached) {
      return createJsonResponse(JSON.parse(cached));
    }

    const result = synthesizeVerifiedPronunciation(word, phonetic);
    const responseData = {
      ok: true,
      audioContent: result.audioContent,
      mimeType: "audio/mpeg",
      voice: PRONUNCIATION_TTS_VOICE,
      languageCode: PRONUNCIATION_TTS_LANGUAGE
    };

    // CacheService has per-entry limits, so cache only when the short word audio fits.
    try {
      cache.put(cacheKey, JSON.stringify(responseData), PRONUNCIATION_TTS_CACHE_SECONDS);
    } catch (cacheError) {
      Logger.log(`発音音声キャッシュをスキップしました: ${cacheError}`);
    }

    return createJsonResponse(responseData);
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    Logger.log(`発音TTS失敗: ${message}`);
    Logger.log(error && error.stack ? error.stack : "");
    return createJsonResponse({
      ok: false,
      error: message
    });
  }
}

function synthesizeVerifiedPronunciation(word, phonetic) {
  const accessToken = getCloudTtsAccessToken();
  const payload = {
    input: {
      text: word,
      customPronunciations: {
        pronunciations: [{
          phrase: word,
          phoneticEncoding: "PHONETIC_ENCODING_IPA",
          pronunciation: phonetic
        }]
      }
    },
    voice: {
      languageCode: PRONUNCIATION_TTS_LANGUAGE,
      name: PRONUNCIATION_TTS_VOICE
    },
    audioConfig: {
      audioEncoding: "MP3",
      speakingRate: 0.9,
      pitch: 0.0
    }
  };

  const response = UrlFetchApp.fetch(
    "https://texttospeech.googleapis.com/v1/text:synthesize",
    {
      method: "post",
      contentType: "application/json",
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    }
  );

  const status = response.getResponseCode();
  const body = response.getContentText();

  if (status < 200 || status >= 300) {
    throw new Error(`Cloud Text-to-Speech失敗: status=${status}\n${body}`);
  }

  const data = JSON.parse(body);
  if (!data.audioContent) {
    throw new Error("Cloud Text-to-Speech応答に audioContent がありません。");
  }

  return data;
}

function getCloudTtsAccessToken() {
  const props = PropertiesService.getScriptProperties();
  const clientEmail = props.getProperty("CLIENT_EMAIL");
  const privateKey = props.getProperty("PRIVATE_KEY");

  if (!clientEmail || !privateKey) {
    throw new Error("CLIENT_EMAIL または PRIVATE_KEY が設定されていません。");
  }

  const formattedPrivateKey = privateKey.replace(/\\n/g, "\n");
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: "RS256",
    typ: "JWT"
  };
  const claimSet = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedClaimSet = base64UrlEncode(JSON.stringify(claimSet));
  const signatureInput = `${encodedHeader}.${encodedClaimSet}`;
  const signatureBytes = Utilities.computeRsaSha256Signature(
    signatureInput,
    formattedPrivateKey
  );
  const jwt = `${signatureInput}.${base64UrlEncode(signatureBytes)}`;

  const response = UrlFetchApp.fetch("https://oauth2.googleapis.com/token", {
    method: "post",
    payload: {
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    },
    muteHttpExceptions: true
  });

  const data = JSON.parse(response.getContentText());
  if (!data.access_token) {
    throw new Error("Cloud TTS用アクセストークン取得失敗:\n" + response.getContentText());
  }

  return data.access_token;
}

function validatePronunciationTtsToken(token) {
  const expectedToken = PropertiesService
    .getScriptProperties()
    .getProperty("SYNC_TOKEN");

  if (!expectedToken) {
    throw new Error("SYNC_TOKEN が設定されていません。");
  }
  if (String(token || "") !== expectedToken) {
    throw new Error("Invalid token");
  }
}

function normalizePronunciationTtsWord(value) {
  return String(value || "")
    .trim()
    .slice(0, PRONUNCIATION_TTS_MAX_WORD_LENGTH);
}

function normalizePronunciationTtsPhonetic(value) {
  return String(value || "")
    .trim()
    .replace(/^[/[]+|[\/\]]+$/g, "")
    .slice(0, PRONUNCIATION_TTS_MAX_PHONETIC_LENGTH);
}

function makePronunciationTtsCacheKey(word, phonetic) {
  const digestBytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    `${PRONUNCIATION_TTS_VOICE}\n${word}\n${phonetic}`,
    Utilities.Charset.UTF_8
  );
  return `pron_tts_${Utilities.base64EncodeWebSafe(digestBytes).replace(/=+$/, "")}`;
}
