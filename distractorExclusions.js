const GROUPS_BY_WORD_ID = new Map([
  ["w_mag9ma3021n1", ["strong_dislike"]], // abhor
  ["w_27g5ewxgepf0", ["strong_dislike"]], // detest
  ["w_82l6t2dfa1xp", ["strong_dislike"]], // loathe

  ["w_qbu96nmafrvb", ["deceptive_appearance"]], // ostensible
  ["w_5gbe338fy6a0", ["deceptive_appearance"]], // seeming

  ["w_0hpobpx7nm8v", ["cunning_sly"]], // cunning
  ["w_6luzvle9153v", ["cunning_sly"]], // sly

  ["w_ko9fafvncuax", ["persistent_harassment"]], // harry
  ["w_yoke6faq1g5l", ["persistent_harassment"]], // pester

  ["w_fazlm6rlae6r", ["flawless_impeccable"]], // flawless
  ["w_jzbmzotulqbi", ["flawless_impeccable"]], // impeccable

  ["w_jmj12btnrupa", ["appalling_gruesome"]], // appalling
  ["w_kup1omsw3ltd", ["appalling_gruesome"]], // gruesome

  ["w_zzwyvvi8wrgh", ["furor_outrage"]], // furor
  ["w_bxrl4xjwsh1l", ["furor_outrage"]], // outrage

  ["w_ofkkgpl0gvji", ["attest_vouch"]], // attest
  ["w_ivrkx0x7l66d", ["attest_vouch"]], // vouch

  ["w_hodgua1s6lt6", ["rebuke_revile"]], // rebuke
  ["w_s9e182umfuyn", ["rebuke_revile"]], // revile

  ["w_vud2loff4i96", ["discerning_sagacious"]], // discerning
  ["w_oqtntbb6uniw", ["discerning_sagacious"]], // sagacious

  ["w_2yqev8sqd1ub", ["abbey_monastery"]], // abbey
  ["w_ypu3y3uliazc", ["abbey_monastery"]] // monastery
]);

function getGroups(item) {
  if (!item?.id) return [];
  return GROUPS_BY_WORD_ID.get(item.id) || [];
}

export function shareDistractorExclusionGroup(leftItem, rightItem) {
  const leftGroups = getGroups(leftItem);
  if (leftGroups.length === 0) return false;

  const rightGroups = new Set(getGroups(rightItem));
  return leftGroups.some((group) => rightGroups.has(group));
}
