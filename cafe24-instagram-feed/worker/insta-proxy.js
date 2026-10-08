/**
 * (선택) Cloudflare Worker 프록시 — 토큰 숨김 + 60일 토큰 자동 갱신 + 응답 캐시
 *
 * 설정
 *  1) Cloudflare 가입(무료) → Workers & Pages → Worker 생성 후 이 코드 붙여넣기
 *  2) KV 네임스페이스 생성 후 Worker 에 바인딩 이름 INSTA_KV 로 연결
 *  3) KV 에 key "token" / value "<최초 장기 토큰>" 저장
 *  4) Settings > Triggers > Cron 에 "0 3 * * 1" (매주 월 03:00 UTC) 추가
 *  5) 환경변수 ALLOW_ORIGIN = https://업체도메인.com (여러 개면 콤마 구분)
 *  6) 쇼핑몰 HTML 의 data-endpoint 에 Worker 주소 입력, data-token 은 비워둔다
 */
const API = 'https://graph.instagram.com';
const FIELDS = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp';

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    const allow = (env.ALLOW_ORIGIN || '').split(',').map((s) => s.trim());
    const cors = {
      'Access-Control-Allow-Origin': allow.includes(origin) ? origin : allow[0] || '*',
      'Vary': 'Origin',
    };

    const cache = caches.default;
    const cacheKey = new Request(request.url, { method: 'GET' });
    const hit = await cache.match(cacheKey);
    if (hit) return hit;

    const limit = Math.min(parseInt(new URL(request.url).searchParams.get('limit'), 10) || 12, 30);
    const token = await env.INSTA_KV.get('token');
    const res = await fetch(`${API}/me/media?fields=${FIELDS}&limit=${limit}&access_token=${token}`);
    const body = await res.text();

    const out = new Response(body, {
      status: res.status,
      headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=1800' },
    });
    if (res.ok) ctx.waitUntil(cache.put(cacheKey, out.clone()));
    return out;
  },

  // 크론: 장기 토큰 갱신 (발급 24시간 이후 ~ 만료 전까지 갱신 가능, 갱신 시 다시 60일)
  async scheduled(event, env) {
    const token = await env.INSTA_KV.get('token');
    const res = await fetch(`${API}/refresh_access_token?grant_type=ig_refresh_token&access_token=${token}`);
    const json = await res.json();
    if (json.access_token) await env.INSTA_KV.put('token', json.access_token);
  },
};
