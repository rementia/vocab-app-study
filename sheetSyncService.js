export function hasSheetSyncConfig({ url }) {
  return typeof url === "string" && url.trim() !== "";
}

export function buildSheetSyncRequestBody({ token }) {
  return JSON.stringify({
    token: typeof token === "string" ? token : ""
  });
}

export function createSheetSyncNotConfiguredResult() {
  return {
    ok: true,
    skipped: true,
    message: "Sheets同期URLが未設定のため、Firestoreのみ再読み込みしました"
  };
}

export async function syncSheetToFirestore({ url, token, fetchFn = fetch }) {
  if (!hasSheetSyncConfig({ url })) {
    return createSheetSyncNotConfiguredResult();
  }

  let response;
  try {
    response = await fetchFn(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: buildSheetSyncRequestBody({ token })
    });
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "Apps Script同期に失敗しました"
    };
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    return {
      ok: false,
      error: "Apps Script同期レスポンスを読み取れませんでした"
    };
  }

  if (!response.ok || data?.ok === false) {
    return {
      ok: false,
      error: data?.error || `Apps Script同期に失敗しました (${response.status})`
    };
  }

  return {
    ok: true,
    skipped: false,
    syncedAt: data?.syncedAt || "",
    volumes: Array.isArray(data?.volumes) ? data.volumes : []
  };
}
