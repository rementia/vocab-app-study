export function createReloadStatusController({
  setStatus,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout
}) {
  let statusTimer = null;

  function clearStatusTimer() {
    if (statusTimer === null) return;
    clearTimeoutFn(statusTimer);
    statusTimer = null;
  }

  function set(message, { clearAfterMs = 0 } = {}) {
    clearStatusTimer();
    setStatus(message);

    if (Number.isFinite(clearAfterMs) && clearAfterMs > 0) {
      statusTimer = setTimeoutFn(() => {
        statusTimer = null;
        setStatus("");
      }, clearAfterMs);
    }
  }

  return {
    set,
    clear() {
      clearStatusTimer();
      setStatus("");
    },
    clearStatusTimer
  };
}
