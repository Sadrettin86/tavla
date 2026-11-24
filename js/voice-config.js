// Sesli sohbet için TURN kimlik bilgisi veren Cloudflare Worker adresi.
// Kurulum: worker/README.md. Boş bırakılırsa yalnızca STUN kullanılır
// (Wi-Fi'de çoğunlukla çalışır, mobil veride bazı bağlantılar kurulamaz).
export const turnUrl = '';
