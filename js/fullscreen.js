// Tam ekran. Android ve çoğu tarayıcıda Fullscreen API ile açılır.
// iPhone'da bu API yok: tam ekran yalnızca "Ana Ekrana Ekle" ile kurulan uygulamada olur.
const ua = navigator.userAgent;
const root = document.documentElement;

export const IOS = /iP(hone|ad|od)/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const IPHONE = /iPhone|iPod/.test(ua);
const IOS_CHROME = IOS && /CriOS/.test(ua);

// Ana ekrandan açılan uygulama mı? (Fullscreen API ile tam ekran da "fullscreen" sayıldığı için ayrılır)
export function standalone() {
  try {
    if (navigator.standalone === true || matchMedia('(display-mode: standalone)').matches) return true;
    return matchMedia('(display-mode: fullscreen)').matches && !active();
  } catch (e) { return false; }
}

export const supported = () => !IPHONE && !!(root.requestFullscreen || root.webkitRequestFullscreen);
export const active = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
export const touch = () => { try { return matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } };

export async function enter() {
  if (!supported() || active()) return active();
  try {
    if (root.requestFullscreen) await root.requestFullscreen({ navigationUI: 'hide' });
    else root.webkitRequestFullscreen();
  } catch (e) { return false; }
  return active();
}

export async function exit() {
  try {
    if (document.exitFullscreen) await document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
  } catch (e) { /* zaten çıkılmış */ }
}

export function onChange(fn) {
  document.addEventListener('fullscreenchange', fn);
  document.addEventListener('webkitfullscreenchange', fn);
}

// iPhone'da ana ekrana ekleme tarifi
export function installSteps() {
  const where = IOS_CHROME ? 'Chrome’da adres çubuğundaki paylaş simgesine' : 'Safari’de paylaş simgesine';
  return `${where} dokun, “Ana Ekrana Ekle”yi seç. Sonra Tavla’yı ana ekrandaki simgeden aç; tarayıcı çubukları kalkar.`;
}
