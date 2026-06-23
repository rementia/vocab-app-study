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

const SWIPE_MOVE_INTENT_MIN_X = 12;
const SWIPE_MOVE_HORIZONTAL_RATIO = 1.5;
const SWIPE_NAVIGATION_THRESHOLD_X = 70;
const SWIPE_VERTICAL_CANCEL_THRESHOLD_Y = 50;
const SWIPE_SLIDE_DURATION_MS = 180;

export function getSwipeIntent(deltaX, deltaY, {
  moveIntentMinX = SWIPE_MOVE_INTENT_MIN_X,
  horizontalRatio = SWIPE_MOVE_HORIZONTAL_RATIO,
  navigationThresholdX = SWIPE_NAVIGATION_THRESHOLD_X,
  verticalCancelThresholdY = SWIPE_VERTICAL_CANCEL_THRESHOLD_Y
} = {}) {
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);
  const isHorizontal = absX > moveIntentMinX && absX > absY * horizontalRatio;
  const shouldNavigate = isHorizontal && absX >= navigationThresholdX && absY <= verticalCancelThresholdY;
  const direction = shouldNavigate
    ? (deltaX > 0 ? "right" : "left")
    : null;

  return { isHorizontal, shouldNavigate, direction };
}

export function resetSwipeElementState(swipeElement) {
  if (!swipeElement) return;
  swipeElement.classList.remove("is-dragging", "is-returning", "is-sliding");
  swipeElement.style.transform = "";
}

export function bindTouchEvents({ prevWord, nextWord, isSwipeAllowedTarget, swipeElement = null }) {
  let touchStartX = 0;
  let touchStartY = 0;
  let touchEndX = 0;
  let touchEndY = 0;
  let lastTouchEnd = 0;
  let swipeEnabled = false;
  let isHorizontalSwipe = false;
  let isDraggingCard = false;
  let isAnimatingCard = false;

  function resetSwipeState() {
    touchStartX = 0;
    touchStartY = 0;
    touchEndX = 0;
    touchEndY = 0;
    swipeEnabled = false;
    isHorizontalSwipe = false;
    isDraggingCard = false;
  }

  function clearCardSwipeClasses() {
    resetSwipeElementState(swipeElement);
  }

  function resetCardPosition({ animated = false } = {}) {
    if (!swipeElement) return;
    swipeElement.classList.toggle("is-returning", animated);
    swipeElement.classList.remove("is-dragging");
    swipeElement.style.transform = "";

    if (animated) {
      const setTimeoutFn = typeof window !== "undefined" && typeof window.setTimeout === "function"
        ? window.setTimeout.bind(window)
        : globalThis.setTimeout;
      setTimeoutFn(() => {
        swipeElement?.classList.remove("is-returning");
      }, SWIPE_SLIDE_DURATION_MS);
    }
  }

  function moveCard(deltaX) {
    if (!swipeElement) return;
    swipeElement.classList.add("is-dragging");
    swipeElement.classList.remove("is-returning", "is-sliding");
    swipeElement.style.transform = `translate3d(${deltaX}px, 0, 0)`;
  }

  function getSlideDistance() {
    if (typeof window !== "undefined" && window.innerWidth) return window.innerWidth;
    if (swipeElement && typeof swipeElement.getBoundingClientRect === "function") {
      const rect = swipeElement.getBoundingClientRect();
      if (rect.width) return rect.width + 80;
    }
    return 360;
  }

  function animateCardChange(direction, moveWord) {
    if (!swipeElement) {
      moveWord();
      return;
    }

    const distance = getSlideDistance();
    const outX = direction === "right" ? distance : -distance;
    const inX = -outX;
    const setTimeoutFn = typeof window !== "undefined" && typeof window.setTimeout === "function"
      ? window.setTimeout.bind(window)
      : globalThis.setTimeout;

    isAnimatingCard = true;
    swipeElement.classList.remove("is-dragging", "is-returning");
    swipeElement.classList.add("is-sliding");
    swipeElement.style.transform = `translate3d(${outX}px, 0, 0)`;

    setTimeoutFn(() => {
      moveWord();
      swipeElement.classList.remove("is-sliding");
      swipeElement.classList.add("is-dragging");
      swipeElement.style.transform = `translate3d(${inX}px, 0, 0)`;

      // Force the off-screen starting point to apply before sliding into center.
      void swipeElement.offsetWidth;

      swipeElement.classList.remove("is-dragging");
      swipeElement.classList.add("is-sliding");
      swipeElement.style.transform = "";

      setTimeoutFn(() => {
        swipeElement?.classList.remove("is-sliding");
        isAnimatingCard = false;
      }, SWIPE_SLIDE_DURATION_MS);
    }, SWIPE_SLIDE_DURATION_MS);
  }

  document.addEventListener(
    "touchstart",
    (event) => {
      if (isAnimatingCard) {
        swipeEnabled = false;
        return;
      }
      const touch = event.changedTouches[0];
      if (!touch) return;

      const startTarget = event.target instanceof Element ? event.target : null;
      swipeEnabled = isSwipeAllowedTarget(startTarget);
      touchStartX = touch.screenX;
      touchStartY = touch.screenY;
      isHorizontalSwipe = false;
      isDraggingCard = false;
      clearCardSwipeClasses();
    },
    { passive: true }
  );

  document.addEventListener(
    "touchmove",
    (event) => {
      if (!swipeEnabled) return;
      const touch = event.changedTouches[0];
      if (!touch) return;

      const deltaX = touch.screenX - touchStartX;
      const deltaY = touch.screenY - touchStartY;
      const intent = getSwipeIntent(deltaX, deltaY);

      if (!isHorizontalSwipe && intent.isHorizontal) {
        isHorizontalSwipe = true;
      }

      if (!isHorizontalSwipe) return;

      event.preventDefault();
      isDraggingCard = true;
      moveCard(deltaX);
    },
    { passive: false }
  );

  document.addEventListener(
    "touchend",
    (event) => {
      const touch = event.changedTouches[0];
      if (!touch) return;

      touchEndX = touch.screenX;
      touchEndY = touch.screenY;

      if (swipeEnabled) {
        const diffX = touchEndX - touchStartX;
        const diffY = touchEndY - touchStartY;
        const intent = getSwipeIntent(diffX, diffY);

        if (intent.shouldNavigate) {
          if (intent.direction === "right") {
            animateCardChange("right", prevWord);
          } else {
            animateCardChange("left", nextWord);
          }
        } else {
          resetCardPosition({ animated: isDraggingCard || isHorizontalSwipe });
        }
      }

      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        event.preventDefault();
      }
      lastTouchEnd = now;
      resetSwipeState();
    },
    { passive: false }
  );

  document.addEventListener(
    "touchcancel",
    () => {
      resetCardPosition({ animated: isDraggingCard });
      resetSwipeState();
    },
    { passive: true }
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
