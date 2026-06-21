const tests = [
  "./wordIdentity.test.js",
  "./state.test.js",
  "./savedState.test.js",
  "./wordList.test.js",
  "./wordOrder.test.js",
  "./wordReloadService.test.js",
  "./reloadStatusService.test.js",
  "./sheetSyncService.test.js",
  "./data.test.js",
  "./pronunciation.test.js",
  "./multipleChoice.test.js",
  "./navigation.test.js",
  "./storage.test.js",
  "./favoritesManager.test.js",
  "./difficultsManager.test.js",
  "./reviewManager.test.js",
  "./ui.test.js",
  "./events.test.js"
];

for (const testPath of tests) {
  await import(testPath);
}
