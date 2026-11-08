// Zar adları (Farsça kökenli kahvehane adları; yöreden yöreye küçük farklar olabilir)
const NAMES = {
  '1-1': 'Hepyek', '2-1': 'Yekidü', '2-2': 'Dubara', '3-1': 'Seyek', '3-2': 'Sebadü', '3-3': 'Düse',
  '4-1': 'Ciharıyek', '4-2': 'Ciharıdü', '4-3': 'Ciharüse', '4-4': 'Dörtcihar',
  '5-1': 'Pençiyek', '5-2': 'Pençidü', '5-3': 'Pençüse', '5-4': 'Pençcihar', '5-5': 'Dübeş',
  '6-1': 'Şeşiyek', '6-2': 'Şeşidü', '6-3': 'Şeşüse', '6-4': 'Şeşcihar', '6-5': 'Şeşbeş', '6-6': 'Düşeş',
};

export function diceName(a, b) {
  const hi = Math.max(a, b), lo = Math.min(a, b);
  return NAMES[`${hi}-${lo}`] || `${hi}-${lo}`;
}

export const upperTR = (s) => s.toLocaleUpperCase('tr-TR');

export const PHRASES = [
  'Zar sende mi kaldı?',
  'Çaylar benden',
  'Mars kokusu alıyorum',
  'Hadi oyna artık',
  'Kapıları kapattım',
  'Şansa bak sen!',
  'Güzel oynadın',
  'Bu el benim',
];

export const REACTIONS = [
  { key: 'cay', label: 'Çay' },
  { key: 'alev', label: 'Alev' },
  { key: 'kahkaha', label: 'Kahkaha' },
  { key: 'saskin', label: 'Şaşkın' },
  { key: 'pes', label: 'Pes' },
];
