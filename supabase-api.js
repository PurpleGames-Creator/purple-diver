// ランキング用のSupabase APIラッパ
// 実際のSupabaseクライアントは supabase-config.js (開発者が作成) で
// window.supabaseClient として注入されている想定です。

const RANKING_TABLE = "diver_scores";

/**
 * Supabase の接続完了を待つ（supabase-config の init 完了後にリトライ）。
 * ランキング取得前に必ず呼ぶことで、接続前に取得が走って失敗するのを防ぐ。
 * @param {number} maxWaitMs 接続確認の最大待機時間（ミリ秒）
 * @returns {Promise<{ connected: boolean }>} 接続できたかどうか
 */
async function waitForSupabaseConnection(maxWaitMs = 5000) {
  if (window.supabaseReadyPromise) {
    await window.supabaseReadyPromise;
  }
  const client = await getSupabaseClientWithRetry(maxWaitMs, 100);
  return { connected: !!client };
}
if (typeof window !== "undefined") {
  window.waitForSupabaseConnection = waitForSupabaseConnection;
}

/**
 * Supabaseクライアントの初期化待ち・取得ヘルパー
 * ライブラリ読み込みや supabase-config.js の初期化が少し遅れても、
 * 一定時間まではリトライしてから offline 判定にする。
 * @param {number} maxWaitMs
 * @param {number} intervalMs
 * @returns {Promise<any|null>}
 */
async function getSupabaseClientWithRetry(maxWaitMs = 5000, intervalMs = 100) {
  const start = Date.now();
  if (window.supabaseClient) return window.supabaseClient;

  while (Date.now() - start < maxWaitMs) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    if (window.supabaseClient) {
      return window.supabaseClient;
    }
  }

  console.warn(
    "Supabaseクライアントが指定時間内に初期化されませんでした。ランキング機能はオフラインモードとして動作します。"
  );
  return null;
}

/**
 * スコア送信
 * @param {Object} params
 * @param {string} params.nickname
 * @param {number} params.depthMeters
 */
async function submitScore({ nickname, depthMeters }) {
  const client = await getSupabaseClientWithRetry();
  if (!client) {
    console.warn("Supabaseクライアントが未初期化のため、スコア送信をスキップします。");
    return { error: null, skipped: true };
  }

  const { data, error } = await client
    .from(RANKING_TABLE)
    .insert({
      nickname,
      score: depthMeters,
    })
    .select()
    .single();

  return { data, error };
}

/**
 * ランキング取得
 * @param {"today" | "week" | "all"} range
 */
async function fetchRanking(range) {
  const client = await getSupabaseClientWithRetry();
  if (!client) {
    console.warn("Supabaseクライアントが未初期化のため、ランキング取得をスキップします。");
    return { data: [], error: null, skipped: true };
  }

  const now = new Date();
  let fromDate = null;

  if (range === "today") {
    fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (range === "week") {
    fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
  }

  // テーブル定義に合わせてカラムは score（depth_m は未使用）
  // 「100人のユニークな最高スコア」を得るため、多めに取得してから重複排除
  let query = client
    .from(RANKING_TABLE)
    .select("*")
    .order("score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(500);

  if (fromDate) {
    query = query.gte("created_at", fromDate.toISOString());
  }

  const { data, error } = await query;

  if (error || !Array.isArray(data)) {
    return { data: [], error, skipped: false };
  }

  // 一人一枠：同じ nickname は「一番高い score」の1件だけ残す
  const bestByName = data.reduce((acc, row) => {
    const name = String(row.nickname ?? "").trim();
    if (!name) return acc;
    const sc = Number(row.score ?? 0);
    const existing = acc[name];
    if (!existing || sc > Number(existing.score ?? 0)) {
      acc[name] = row;
    }
    return acc;
  }, /** @type {Record<string, any>} */ ({}));

  const deduped = Object.values(bestByName)
    .sort((a, b) => {
      const sa = Number(a.score ?? 0);
      const sb = Number(b.score ?? 0);
      if (sb !== sa) return sb - sa;
      const ta = new Date(a.created_at || 0).getTime();
      const tb = new Date(b.created_at || 0).getTime();
      return ta - tb;
    })
    .slice(0, 100);

  return { data: deduped, error: null };
}

