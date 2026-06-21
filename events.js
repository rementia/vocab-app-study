export function bindKeyboardEvents({
  prevWord,
  nextWord,
  speakWord,
  handleToggleFavoriteCurrentWord,
  handleToggleDifficultCurrentWord,
  decreaseReviewScore,
  resetReviewScore,
  increaseReviewScore,
  focusSearch,
  clearSearch,
  selectNextSearchResult,
  selectPreviousSearchResult,
  closeSidebar,
  toggleSidebar,
  toggleRandomMode
}) {
  const handlers = {
    prevWord,
    nextWord,
    speakWord,
    handleToggleFavoriteCurrentWord,
    handleToggleDifficultCurrentWord,
    decreaseReviewScore,
    resetReviewScore,
    increaseReviewScore,
    focusSearch,
    clearSearch,
    selectNextSearchResult,
    selectPreviousSearchResult,
    closeSidebar,
    toggleSidebar,
    toggleRandomMode
  };

  document.addEventListener("keydown", (event) => {
    if (event.isComposing) return;

    if (isTextInputTarget(event.target)) {
      handleTextInputKeydown(event, handlers);
      return;
    }

    handleAppShortcutKeydown(event, handlers);
  });
}

function isTextInputTarget(target) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

function isModifiedShortcut(event) {
  return event.ctrlKey || event.metaKey || event.altKey;
}

function preventAndRun(event, callback) {
  event.preventDefault();
  callback();
}

function handleTextInputKeydown(event, handlers) {
  if (event.key === "Escape") {
    preventAndRun(event, () => {
      if (!handlers.clearSearch()) event.target.blur();
    });
    return;
  }

  if (event.key === "Enter") {
    preventAndRun(event, () => {
      if (event.shiftKey) {
        handlers.selectPreviousSearchResult();
      } else {
        handlers.selectNextSearchResult();
      }
    });
  }
}

function handleAppShortcutKeydown(event, handlers) {
  if (isModifiedShortcut(event)) return;

  if (event.key === "ArrowLeft") {
    preventAndRun(event, handlers.prevWord);
    return;
  }

  if (event.key === "ArrowRight") {
    preventAndRun(event, handlers.nextWord);
    return;
  }

  if (event.key === " " || event.code === "Space") {
    preventAndRun(event, handlers.speakWord);
    return;
  }

  if (event.key.toLowerCase() === "f") {
    preventAndRun(event, handlers.handleToggleFavoriteCurrentWord);
    return;
  }

  if (event.key.toLowerCase() === "d") {
    preventAndRun(event, handlers.handleToggleDifficultCurrentWord);
    return;
  }

  if (event.key === "+") {
    preventAndRun(event, handlers.increaseReviewScore);
    return;
  }

  if (event.key === "-" || event.key === "－") {
    preventAndRun(event, handlers.decreaseReviewScore);
    return;
  }

  if (event.key === "0") {
    preventAndRun(event, handlers.resetReviewScore);
    return;
  }

  if (event.key === "/") {
    preventAndRun(event, handlers.focusSearch);
    return;
  }

  if (event.key === "Escape") {
    preventAndRun(event, handlers.closeSidebar);
    return;
  }

  if (event.key.toLowerCase() === "l") {
    preventAndRun(event, handlers.toggleSidebar);
    return;
  }

  if (event.key.toLowerCase() === "r") {
    preventAndRun(event, handlers.toggleRandomMode);
  }
}

export function bindTouchEvents({ prevWord, nextWord, isSwipeAllowedTarget }) {
  let touchStartX = 0;
  let touchStartY = 0;
  let touchEndX = 0;
  let touchEndY = 0;
  let lastTouchEnd = 0;
  let touchStartTime = 0;
  let swipeEnabled = false;
  let firstSwipeSpeechSyncAttempted = false;

  document.addEventListener(
    "touchstart",
    (event) => {
      touchStartTime = Date.now();
      const touch = event.changedTouches[0];
      if (!touch) return;

      const startTarget = event.target instanceof Element ? event.target : null;
      swipeEnabled = isSwipeAllowedTarget(startTarget);
      touchStartX = touch.screenX;
      touchStartY = touch.screenY;
    },
    { passive: true }
  );

  document.addEventListener(
    "touchend",
    (event) => {
      const touch = event.changedTouches[0];
      if (!touch) return;

      const touchDuration = Date.now() - touchStartTime;
      if (touchDuration >= 1000) {
        swipeEnabled = false;
        return;
      }

      touchEndX = touch.screenX;
      touchEndY = touch.screenY;

      if (swipeEnabled) {
        const diffX = touchEndX - touchStartX;
        const diffY = Math.abs(touchEndY - touchStartY);
        const thresholdX = 50;
        const thresholdY = 50;

        if (Math.abs(diffX) >= thresholdX && diffY <= thresholdY) {
          const wordOptions = {
            immediateSpeechSync: !firstSwipeSpeechSyncAttempted,
            reason: "swipe"
          };
          let moved = false;
          if (diffX > 0) {
            moved = Boolean(prevWord(wordOptions));
          } else {
            moved = Boolean(nextWord(wordOptions));
          }
          if (moved) {
            firstSwipeSpeechSyncAttempted = true;
          }
        }
      }

      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        event.preventDefault();
      }
      lastTouchEnd = now;
      swipeEnabled = false;
    },
    { passive: false }
  );
}

export function isSwipeAllowedTarget(target) {
  if (!(target instanceof Element)) return true;
  if (target.closest("button, a, input, textarea, select, label")) return false;
  if (target.closest("#sidebar")) return false;
  return true;
}

function resetPageOffset() {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

export function handleViewportChange(render) {
  let viewportResizeTimer = null;

  return () => {
    clearTimeout(viewportResizeTimer);
    resetPageOffset();
    requestAnimationFrame(resetPageOffset);
    viewportResizeTimer = setTimeout(() => {
      resetPageOffset();
      render();
    }, 180);
  };
}
