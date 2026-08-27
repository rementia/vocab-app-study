import { init, finishInitialLoading } from './app.js?v=20260815-9';
import { initMultipleChoiceLongPressEtymology } from './multipleChoiceLongPress.js?v=20260827-2';
import { initMorphemeDoubleTapClose } from './morphemeDoubleTapClose.js?v=20260827-1';

function loadSidebarLayoutStyles() {
  const href = './sidebarLayout.css?v=20260824-1';
  if (document.querySelector(`link[href="${href}"]`)) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.addEventListener('load', resolve, { once: true });
    link.addEventListener('error', () => reject(new Error('sidebarLayout.css の読み込みに失敗しました')), { once: true });
    document.head.appendChild(link);
  });
}

(async () => {
  try {
    await loadSidebarLayoutStyles();
    await init();
    initMultipleChoiceLongPressEtymology();
    initMorphemeDoubleTapClose();
  } catch (error) {
    console.error('初期化失敗:', error);
    finishInitialLoading();
    alert(`初期化失敗: ${error.message}`);
  }
})();
