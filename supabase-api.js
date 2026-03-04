// ランキング用のSupabase APIラッパ
// 実際のSupabaseクライアントは supabase-config.js (開発者が作成) で
// window.supabaseClient として注入されている想定です。

const RANKING_TABLE = "diver_scores";

/**
 * Supabaseクライアントの初期化待ち・取得ヘルパー
 * ライブラリ読み込みや supabase-config.js の初期化が少し遅れても、
 * 一定時間まではリトライしてから offline 判定にする。
 * @param {number} maxWaitMs
 * @param {number} intervalMs
 * @returns {Promise<any|null>}
 */
async function getSupabaseClientWithRetry(maxWaitMs = 2000, intervalMs = 100) {
  const start = Date.now();
  // すでに存在していれば即返す
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

  let query = client
    .from(RANKING_TABLE)
    .select("*")
    .order("score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(100);

  if (fromDate) {
    query = query.gte("created_at", fromDate.toISOString());
  }

  const { data, error } = await query;

  if (error || !Array.isArray(data)) {
    return { data, error };
  }

  // ニックネームごとに自己ベスト（最高スコア）のみ残す
  const bestByName = data.reduce((acc, row) => {
    const name = row.nickname ?? "";
    if (!name) return acc;
    const existing = acc[name];
    if (!existing || (row.score ?? 0) > (existing.score ?? 0)) {
      acc[name] = row;
    }
    return acc;
  }, /** @type {Record<string, any>} */ ({}));

  const deduped = Object.values(bestByName).sort((a, b) => {
    const sa = a.score ?? 0;
    const sb = b.score ?? 0;
    if (sb !== sa) return sb - sa; // スコア降順
    const ta = new Date(a.created_at || 0).getTime();
    const tb = new Date(b.created_at || 0).getTime();
    return ta - tb; // 同スコアなら古い方を上に
  });

  return { data: deduped, error: null };
}

