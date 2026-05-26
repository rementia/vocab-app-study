import { signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js";

export async function signInWithGoogle(auth, provider) {
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error("Googleログイン失敗:", error);
    alert(`ログインに失敗しました。${error.code ? `\n${error.code}` : ""}`);
  }
}

export async function signOutUser(auth) {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("ログアウト失敗:", error);
    alert("ログアウトに失敗しました。");
  }
}
