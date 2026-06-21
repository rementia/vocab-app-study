export function createSpeechSyncController({
  delayMs,
  saveSpeechSyncState,
  updateSpeechSyncButton,
  speakWord,
  shouldBlockSpeech,
  unlockPronunciationAudio = () => {},
  requestFrame = requestAnimationFrame
}) {
  let speechSync = false;
  let speechSyncTimer = null;
  let waitingForUserActivation = false;
  let activationEventsBound = false;

  function clearTimer() {
    if (speechSyncTimer) {
      clearTimeout(speechSyncTimer);
      speechSyncTimer = null;
    }
  }

  function canStartNow() {
    if (typeof navigator === "undefined" || !navigator.userActivation) return true;
    return navigator.userActivation.hasBeenActive || navigator.userActivation.isActive;
  }

  function bindActivationEvents() {
    if (activationEventsBound || typeof document === "undefined") return;
    activationEventsBound = true;
    document.addEventListener("pointerdown", handleActivation, true);
    document.addEventListener("touchstart", handleActivation, true);
    document.addEventListener("click", handleActivation, true);
    document.addEventListener("keydown", handleActivation, true);
  }

  function unbindActivationEvents() {
    if (!activationEventsBound || typeof document === "undefined") return;
    activationEventsBound = false;
    document.removeEventListener("pointerdown", handleActivation, true);
    document.removeEventListener("touchstart", handleActivation, true);
    document.removeEventListener("click", handleActivation, true);
    document.removeEventListener("keydown", handleActivation, true);
  }

  function waitForActivation() {
    waitingForUserActivation = true;
    bindActivationEvents();
  }

  function speakNow() {
    if (!speechSync) return;
    if (shouldBlockSpeech()) return;
    waitingForUserActivation = false;
    unbindActivationEvents();
    clearTimer();
    speakWord();
  }

  function handleActivation() {
    if (!speechSync || !waitingForUserActivation) return;
    unlockPronunciationAudio();
    waitingForUserActivation = false;
    unbindActivationEvents();
  }

  function schedule({ immediate = false } = {}) {
    if (!speechSync) return;
    if (shouldBlockSpeech()) {
      clearTimer();
      return;
    }
    if (!canStartNow()) {
      waitForActivation();
      return;
    }

    waitingForUserActivation = false;
    unbindActivationEvents();
    if (immediate) {
      speakNow();
      return;
    }
    clearTimer();
    speechSyncTimer = setTimeout(() => {
      speakWord();
    }, delayMs);
  }

  function scheduleAfterRender() {
    if (!speechSync) return;
    requestFrame(() => {
      requestFrame(() => {
        schedule();
      });
    });
  }

  function setEnabled(value) {
    speechSync = Boolean(value);
  }

  function toggle() {
    speechSync = !speechSync;
    saveSpeechSyncState(speechSync);
    updateSpeechSyncButton();

    if (!speechSync) {
      waitingForUserActivation = false;
      unbindActivationEvents();
      clearTimer();
    } else {
      schedule();
    }
  }

  return {
    clearTimer,
    isEnabled: () => speechSync,
    schedule,
    scheduleAfterRender,
    setEnabled,
    speakNow,
    toggle
  };
}
