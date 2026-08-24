import { shareDistractorExclusionGroup } from "./distractorExclusions.js";
import { getDistractorPriority, getMeaningFragments } from "./multipleChoice.js";

const ALLOWED_PARTS_OF_SPEECH = new Set([
  "noun",
  "verb",
  "adjective",
  "adverb",
  "preposition",
  "conjunction",
  "pronoun",
  "interjection",
  "determiner"
]);
const ALLOWED_VOLUMES = new Set(["vol1", "vol2", "vol3", "vol4"]);

function normalizePartOfSpeech(value) {
  return String(value ?? "")
    .toLowerCase()
    .split(/[,;|/]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function hasFragmentOverlap(left, right) {
  const rightSet = new Set(right);
  return left.some((fragment) => rightSet.has(fragment));
}

function getMinimumPriorityTier(choiceSets) {
  const available = new Set();
  for (let priority = 0; priority < choiceSets.length; priority += 1) {
    choiceSets[priority].forEach((choice) => available.add(choice));
    if (available.size >= 3) return priority;
  }
  return null;
}

function isLikelyVerbGloss(fragment) {
  if (/[～〜~]/.test(fragment)) return true;
  return /(?:する|される|させる|なる|れる|られる|む|ぶ|ぐ|く|す|つ|ぬ|う|る|える|いる|ある|める|せる|じる|ずる|ない|だ)$/.test(fragment);
}

function isIntentionalNounModifierGloss(fragment) {
  return /^(?:副[～〜~]|[～〜~](?:団|年生|への道|への手段))$/.test(fragment);
}

function isLikelyAdjectiveGloss(fragment) {
  const value = String(fragment ?? "").trim();
  if (!value || /[～〜~]/.test(value)) return false;
  return /(?:の|な|的な|用の|向けの|性の|状の|型の|製の|式の|中の|上の|間の|可能な|不能な|された|している)$/.test(value);
}

function isStrongStandaloneNounGloss(fragment) {
  const value = String(fragment ?? "").trim();
  if (!value || /[～〜~]/.test(value) || isLikelyVerbGloss(value) || isLikelyAdjectiveGloss(value)) {
    return false;
  }

  return /(?:者|人|物|もの|こと|剤|地|法|語|文|説|役|官|員|家|種|類|体|形|式|品|料|金|税|権|券|軍|隊|国|島|川|山|船|車|機|器|線|面|点|数|率|値|量|度|産業|主義|状態|制度|方法|行為|場所|地域|時期|期間|条件|用語|分野|学|術|名|称|職|職業|団体|組織|会社|企業|政府|社会|関係|原因|結果|問題|危機|苦境|困惑|怒り|喜び|悲しみ|不安|恐怖|希望|愛|憎しみ|香り|音|色|光|熱|力|速度|距離|面積|体積|重量|価格|費用|収入|支出|利益|損失|証拠|記録|文書|冊子|本|衣服|食器|容器|道路|建物|部屋|席|棚|穴|谷|沼|海|湖|空|星|鳥|虫|魚|植物|病気|症状|器官|筋肉|骨|皮膚|血|尿)$/.test(value);
}

// Advisory heuristic only. It intentionally favors precision over recall because
// a warning is useful only when it is materially more likely to indicate a real
// meaning/partOfSpeech mismatch than an ordinary polysemous translation.
export function hasStrongPartOfSpeechMismatch(item) {
  const parts = normalizePartOfSpeech(item?.partOfSpeech);
  if (parts.length !== 1) return false;

  const senses = String(item?.meaning ?? "")
    .split(/[;；]/)
    .map((sense) => sense.trim())
    .filter(Boolean);
  if (senses.length < 2) return false;

  const part = parts[0];
  if (part === "noun") {
    return senses.some((sense) => (
      /[～〜~]/.test(sense) && !isIntentionalNounModifierGloss(sense)
    ));
  }

  if (part === "verb") {
    return senses.some((sense) => {
      if (/[～〜~]/.test(sense)) return false;
      if (/する（英）$/.test(sense)) return false;
      return !isLikelyVerbGloss(sense);
    });
  }

  if (part === "adjective") {
    return senses.some((sense) => (
      (/[～〜~]/.test(sense) && /(?:する|させる|隠す)$/.test(sense)) ||
      isStrongStandaloneNounGloss(sense)
    ));
  }

  if (part === "adverb") {
    return senses.some((sense) => isLikelyAdjectiveGloss(sense) || isStrongStandaloneNounGloss(sense));
  }

  if (part === "preposition") {
    const hasObjectPlaceholder = senses.some((sense) => /[～〜~]/.test(sense));
    const hasStandaloneSense = senses.some((sense) => !/[～〜~]/.test(sense));
    return hasObjectPlaceholder && hasStandaloneSense;
  }

  return false;
}

export function auditMultipleChoiceDataset(words) {
  const items = Array.isArray(words) ? words : [];
  const invalidRows = [];
  const duplicateIds = [];
  const duplicateWords = [];
  const invalidPartsOfSpeech = [];
  const invalidVolumes = [];
  const partOfSpeechMismatches = [];
  const seenIds = new Set();
  const seenWords = new Set();

  const prepared = items.map((item, index) => {
    const rowNumber = index + 2;
    const id = String(item?.id ?? "").trim();
    const word = String(item?.word ?? "").trim();
    const meaning = String(item?.meaning ?? "").trim();
    const sourceVol = String(item?.sourceVol ?? "").trim();
    const semanticCategory = String(item?.semanticCategory ?? "").trim();
    const parts = normalizePartOfSpeech(item?.partOfSpeech);

    if (!id || !word || !meaning || !sourceVol || !semanticCategory || parts.length === 0) {
      invalidRows.push({ rowNumber, id, word });
    }
    if (id && seenIds.has(id)) duplicateIds.push({ rowNumber, id, word });
    if (word && seenWords.has(word.toLowerCase())) duplicateWords.push({ rowNumber, id, word });
    if (id) seenIds.add(id);
    if (word) seenWords.add(word.toLowerCase());

    const invalidParts = parts.filter((part) => !ALLOWED_PARTS_OF_SPEECH.has(part));
    if (invalidParts.length > 0) {
      invalidPartsOfSpeech.push({ rowNumber, id, word, invalidParts });
    }
    if (sourceVol && !ALLOWED_VOLUMES.has(sourceVol)) {
      invalidVolumes.push({ rowNumber, id, word, sourceVol });
    }
    if (hasStrongPartOfSpeechMismatch(item)) {
      partOfSpeechMismatches.push({ rowNumber, id, word, meaning, partOfSpeech: item.partOfSpeech });
    }

    return {
      ...item,
      id,
      word,
      meaning,
      sourceVol,
      semanticCategory,
      meaningFragments: getMeaningFragments(meaning)
    };
  });

  const directionStats = {
    wordToMeaning: { tierCounts: [0, 0, 0, 0], insufficient: [], priority3Required: [] },
    meaningToWord: { tierCounts: [0, 0, 0, 0], insufficient: [], priority3Required: [] }
  };

  for (const current of prepared) {
    const wordToMeaningChoices = [new Set(), new Set(), new Set(), new Set()];
    const meaningToWordChoices = [new Set(), new Set(), new Set(), new Set()];

    for (const candidate of prepared) {
      if (
        current.id === candidate.id ||
        current.word === candidate.word ||
        hasFragmentOverlap(current.meaningFragments, candidate.meaningFragments) ||
        shareDistractorExclusionGroup(current, candidate)
      ) {
        continue;
      }

      const priority = getDistractorPriority(current, candidate);
      if (candidate.meaning && candidate.meaning !== current.meaning) {
        wordToMeaningChoices[priority].add(candidate.meaning);
      }
      if (candidate.word && candidate.word !== current.word) {
        meaningToWordChoices[priority].add(candidate.word);
      }
    }

    const wordToMeaningTier = getMinimumPriorityTier(wordToMeaningChoices);
    const meaningToWordTier = getMinimumPriorityTier(meaningToWordChoices);

    for (const [key, tier] of [
      ["wordToMeaning", wordToMeaningTier],
      ["meaningToWord", meaningToWordTier]
    ]) {
      if (tier === null) {
        directionStats[key].insufficient.push({ id: current.id, word: current.word });
      } else {
        directionStats[key].tierCounts[tier] += 1;
        if (tier === 3) {
          directionStats[key].priority3Required.push({ id: current.id, word: current.word });
        }
      }
    }
  }

  return {
    totalWords: prepared.length,
    invalidRows,
    duplicateIds,
    duplicateWords,
    invalidPartsOfSpeech,
    invalidVolumes,
    partOfSpeechMismatches,
    directions: directionStats
  };
}
