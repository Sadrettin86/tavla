// Tavla sesli sohbeti için TURN kimlik bilgisi veren Cloudflare Worker.
// Gizli anahtar burada, sitede değil: site her açılışta buradan 24 saat geçerli bir kimlik alır.
// Ortam değişkenleri (Cloudflare panelinde, "Settings > Variables and Secrets"):
//   TURN_KEY_ID         TURN anahtarının kimliği (düz metin)
//   TURN_KEY_API_TOKEN  TURN anahtarının API jetonu (Secret olarak)
//   ALLOWED_ORIGINS     izin verilen siteler, virgülle (ör. https://sadrettin86.github.io)
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || 'https://sadrettin86.github.io').split(',').map((s) => s.trim());
    const ok = allowed.includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': ok ? origin : allowed[0],
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (!ok) return new Response('izin yok', { status: 403, headers: cors });

    const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_KEY_ID}/credentials/generate-ice-servers`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.TURN_KEY_API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl: 86400 }),
    });
    if (!r.ok) return new Response('turn hatası', { status: 502, headers: cors });
    const body = await r.json();
    return new Response(JSON.stringify(body), { headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  },
};
