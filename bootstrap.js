import { init, finishInitialLoading } from './app.js';

(async () => {
  try {
    await init();
  } catch (error) {
    console.error('初期化失敗:', error);
    finishInitialLoading();
    alert(`初期化失敗: ${error.message}`);
  }
})();
