# Sesli sohbet için TURN (Cloudflare)

Mobil veride telefonlar birbirine doğrudan bağlanamayabilir. Cloudflare'in TURN
servisi sesi aradan aktarır. Her ay ilk 1.000 GB ücretsiz; sesli sohbet saatte
birkaç on MB harcar.

## 1. TURN anahtarı
1. https://dash.cloudflare.com adresinde ücretsiz hesap aç, giriş yap.
2. Sol menüde **Realtime** (bazı hesaplarda "Calls") > **TURN Server** > **Create**.
3. Bir ad ver (ör. `tavla`). Açılan pencerede iki değer çıkar:
   - **Turn Token ID**
   - **API Token** (bir kez gösterilir, bir yere kopyala)

## 2. Worker
1. Sol menüde **Workers & Pages** > **Create** > **Create Worker** > ad: `tavla-turn` > **Deploy**.
2. **Edit code**'a gir, içindekileri sil, bu klasördeki `turn-worker.js` dosyasının tamamını yapıştır, **Deploy**.
3. Worker'ın **Settings > Variables and Secrets** bölümüne ekle:
   - `TURN_KEY_ID` (Text): Turn Token ID
   - `TURN_KEY_API_TOKEN` (Secret): API Token
   - `ALLOWED_ORIGINS` (Text): `https://sadrettin86.github.io`
4. Worker adresi şuna benzer: `https://tavla-turn.KULLANICI.workers.dev`

## 3. Siteye bağla
`js/voice-config.js` içindeki `turnUrl` değerine Worker adresini yaz.

Deneme: tarayıcıda Worker adresini doğrudan açarsan "izin yok" görmen normal;
site üzerinden istendiğinde kimlik verir.
