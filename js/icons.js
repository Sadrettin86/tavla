// Çizgi simgeler (stroke: currentColor)
const svg = (inner, size = 22, sw = 1.8) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${inner}</svg>`;

export const icon = {
  menu: (s) => svg('<path d="M4 6h16"></path><path d="M4 12h16"></path><path d="M4 18h16"></path>', s),
  sound: (s) => svg('<path d="M11 5L6 9H2v6h4l5 4V5z"></path><path d="M15.5 8.5a5 5 0 0 1 0 7"></path><path d="M19 5a10 10 0 0 1 0 14"></path>', s),
  mute: (s) => svg('<path d="M11 5L6 9H2v6h4l5 4V5z"></path><path d="M22 9l-6 6"></path><path d="M16 9l6 6"></path>', s),
  chat: (s) => svg('<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"></path>', s),
  undo: (s) => svg('<path d="M9 14L4 9l5-5"></path><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"></path>', s),
  check: (s) => svg('<path d="M5 12.5l4.5 4.5L19 7.5"></path>', s, 2.4),
  dice: (s) => svg('<rect x="3" y="3" width="18" height="18" rx="4"></rect><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor"></circle><circle cx="15.5" cy="15.5" r="1.2" fill="currentColor"></circle><circle cx="12" cy="12" r="1.2" fill="currentColor"></circle>', s),
  share: (s) => svg('<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><path d="M16 6l-4-4-4 4"></path><path d="M12 2v13"></path>', s),
  copy: (s) => svg('<rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>', s),
  back: (s) => svg('<path d="M15 5l-7 7 7 7"></path>', s, 2.2),
  close: (s) => svg('<path d="M6 6l12 12"></path><path d="M18 6L6 18"></path>', s),
  link: (s) => svg('<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"></path><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"></path>', s),
  user: (s) => svg('<circle cx="12" cy="8" r="4"></circle><path d="M4 21c1.2-4 4.3-6 8-6s6.8 2 8 6"></path>', s),
  crown: (s) => svg('<path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"></path><path d="M5 20h14"></path>', s),
  flag: (s) => svg('<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><path d="M4 22v-7"></path>', s),
  phone: (s) => svg('<rect x="2.5" y="6.5" width="19" height="11" rx="2.5"></rect><path d="M18 3.5a3 3 0 0 1 2.5 2.5"></path>', s),
  eye: (s) => svg('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"></path><circle cx="12" cy="12" r="3"></circle>', s),
  palette: (s) => svg('<circle cx="13.5" cy="6.5" r="1.3" fill="currentColor"></circle><circle cx="17.5" cy="10.5" r="1.3" fill="currentColor"></circle><circle cx="8.5" cy="7.5" r="1.3" fill="currentColor"></circle><circle cx="6.5" cy="12.5" r="1.3" fill="currentColor"></circle><path d="M12 2a10 10 0 1 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.4A5.6 5.6 0 0 0 22 9.8C22 5.5 17.5 2 12 2z"></path>', s),
  voice: (s) => svg('<path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z"></path><path d="M19 11a7 7 0 0 1-14 0"></path><path d="M12 18v3"></path>', s),
  exit: (s) => svg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><path d="M16 17l5-5-5-5"></path><path d="M21 12H9"></path>', s),
  // tepkiler
  cay: (s) => svg('<path d="M7.7 5.8c.3 2.4 1 4.4 2.5 6.7-.8 1.7-1 3.3-1 5h5.6c0-1.7-.2-3.3-1-5 1.5-2.3 2.2-4.3 2.5-6.7z" fill="currentColor" fill-opacity="0.4" stroke="none"></path><path d="M7.5 3.5c-.2 3 .5 6 2.7 9-.8 1.7-1 3.3-1 5h5.6c0-1.7-.2-3.3-1-5 2.2-3 2.9-6 2.7-9z"></path><ellipse cx="12" cy="19.3" rx="7.8" ry="1.7"></ellipse>', s),
  alev: (s) => svg('<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4.1 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path>', s),
  kahkaha: (s) => svg('<circle cx="12" cy="12" r="9.5"></circle><path d="M17.5 13a5.5 5.5 0 0 1-11 0h11z"></path><path d="M8.5 9.2l1.4-.9 1.4.9"></path><path d="M12.7 9.2l1.4-.9 1.4.9"></path>', s),
  saskin: (s) => svg('<circle cx="12" cy="12" r="9.5"></circle><circle cx="9" cy="9.8" r="1" fill="currentColor"></circle><circle cx="15" cy="9.8" r="1" fill="currentColor"></circle><ellipse cx="12" cy="15.2" rx="2" ry="2.5"></ellipse>', s),
  pes: (s) => svg('<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><path d="M4 22v-7"></path>', s),
};

export const logoDice = `<svg xmlns="http://www.w3.org/2000/svg" width="46" height="40" viewBox="0 0 46 40" aria-hidden="true"><g transform="rotate(-12 14 20)"><rect x="3" y="9" width="22" height="22" rx="5" fill="#f7f0e1" stroke="#a7865a" stroke-width="1"></rect><circle cx="9" cy="15" r="2.1" fill="#2a140b"></circle><circle cx="14" cy="20" r="2.1" fill="#2a140b"></circle><circle cx="19" cy="25" r="2.1" fill="#2a140b"></circle></g><g transform="rotate(14 32 20)"><rect x="21" y="7" width="22" height="22" rx="5" fill="#f2bb4e" stroke="#a36f1d" stroke-width="1"></rect><circle cx="27" cy="13" r="2.1" fill="#24150a"></circle><circle cx="37" cy="13" r="2.1" fill="#24150a"></circle><circle cx="27" cy="23" r="2.1" fill="#24150a"></circle><circle cx="37" cy="23" r="2.1" fill="#24150a"></circle></g></svg>`;
