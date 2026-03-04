// Supabaseクライアント設定
// GitHub Pages などの静的ホスティングを想定し、
// CDN から読み込んだ @supabase/supabase-js v2 の `createClient`
// を使用してブラウザ側でクライアントを初期化します。

(function initializeSupabaseClientWithRetry() {
  // プロジェクト固有の Supabase 接続情報（supabase-config.js と同期）
  const SUPABASE_URL = "https://hefayilffszrczxhnpii.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhlZmF5aWxmZnN6cmN6eGhucGlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NDI5NDEsImV4cCI6MjA4NzUxODk0MX0.qUsuQOIZzdlFLXtR-i1d9TX5c3P9QKPdhv34QGt4V_k";

  const MAX_RETRY = 10;
  const RETRY_DELAY_MS = 150;

  function attemptInit(tryCount) {
    try {
      const hasCreateClient =
        (typeof createClient === "function") ||
        (typeof window !== "undefined" &&
          window.supabase &&
          typeof window.supabase.createClient === "function");

      if (!hasCreateClient) {
        if (tryCount < MAX_RETRY) {
          setTimeout(() => attemptInit(tryCount + 1), RETRY_DELAY_MS);
          return;
        }
        const msg = "Supabase JS が読み込まれていません（createClient が見つかりません）。ランキング機能は無効ですがプレイ可能です。";
        console.error(msg);
        if (typeof window !== "undefined" && typeof window.showGameError === "function") {
          window.showGameError(msg);
        }
        window.supabaseClient = undefined;
        return;
      }

      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        const msg = "Supabase 接続情報が未設定です。ランキング機能は無効ですがプレイ可能です。";
        console.warn(msg);
        if (typeof window !== "undefined" && typeof window.showGameError === "function") {
          window.showGameError(msg);
        }
        window.supabaseClient = undefined;
        return;
      }

      const factory = (typeof createClient === "function")
        ? createClient
        : window.supabase.createClient.bind(window.supabase);

      window.supabaseClient = factory(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log("Supabase接続成功");
    } catch (e) {
      console.error("Supabaseクライアントの初期化に失敗しました:", e);
      if (typeof window !== "undefined" && typeof window.showGameError === "function") {
        window.showGameError(`Supabaseクライアントの初期化に失敗しました: ${e && e.message ? e.message : e}`);
      }
    }
  }

  const startInit = () => attemptInit(0);
  if (document.readyState === "complete") {
    startInit();
  } else {
    window.addEventListener("load", startInit, { once: true });
  }
})();

// Supabaseクライアント設定
// GitHub Pages などの静的ホスティングを想定し、
// CDN から読み込んだ @supabase/supabase-js v2 の `createClient`
// を使用してブラウザ側でクライアントを初期化します。

(function initializeSupabaseClient() {
  // ★ここをあなたの Supabase プロジェクトの値に置き換えてください
  // 例:
  //   const SUPABASE_URL = "https://xxxx.supabase.co";
  //   const SUPABASE_ANON_KEY = "public-anon-key";
  const SUPABASE_URL = "https://YOUR_PROJECT_ID.supabase.co";
  const SUPABASE_ANON_KEY = "YOUR_PUBLIC_ANON_KEY";

  try {
    if (typeof createClient !== "function") {
      console.error("Supabase JS が読み込まれていません（createClient が見つかりません）。");
      return;
    }

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY ||
        SUPABASE_URL.includes("YOUR_PROJECT_ID") ||
        SUPABASE_ANON_KEY.includes("YOUR_PUBLIC_ANON_KEY")) {
      console.warn("Supabase 接続情報が未設定です。SUPABASE_URL / SUPABASE_ANON_KEY を設定してください。");
      return;
    }

    // ブラウザ全体から利用できるように window に公開
    window.supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log("Supabase接続成功");
  } catch (e) {
    console.error("Supabaseクライアントの初期化に失敗しました:", e);
  }
})();

