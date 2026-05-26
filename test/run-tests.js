const tests = [
  "./data.test.js",
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
