// Civs confirmed as of this codebase's knowledge cutoff (Jan 2026). AOE4 is
// reported to have 23 playable civs by mid-2026, but the ~7 newest DLC/season
// civs beyond this list could not be verified — see the caller's note.
export const CIV_FLAGS: Record<string, string> = {
  'Abbasid Dynasty': '🇸🇦',
  Ayyubids: '🇪🇬',
  Byzantines: '🇬🇷',
  Chinese: '🇨🇳',
  'Delhi Sultanate': '🇮🇳',
  English: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  French: '🇫🇷',
  'Holy Roman Empire': '🇩🇪',
  Japanese: '🇯🇵',
  "Jeanne d'Arc": '⚜️',
  Malians: '🇲🇱',
  Mongols: '🇲🇳',
  'Order of the Dragon': '🐉',
  Ottomans: '🇹🇷',
  Rus: '🇷🇺',
  "Zhu Xi's Legacy": '📜',
};

export const CIV_NAMES: string[] = Object.keys(CIV_FLAGS).sort((a, b) => a.localeCompare(b));

const ALIASES: Record<string, string> = {
  hre: 'Holy Roman Empire',
  delhi: 'Delhi Sultanate',
  abbasid: 'Abbasid Dynasty',
  abbasids: 'Abbasid Dynasty',
  zhuxi: "Zhu Xi's Legacy",
  'zhu xi': "Zhu Xi's Legacy",
  zhuxislegacy: "Zhu Xi's Legacy",
  jeanne: "Jeanne d'Arc",
  jeannedarc: "Jeanne d'Arc",
  ootd: 'Order of the Dragon',
  otd: 'Order of the Dragon',
  orderofthedragon: 'Order of the Dragon',
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const FLAG_LOOKUP = new Map<string, string>();
for (const [name, flag] of Object.entries(CIV_FLAGS)) {
  FLAG_LOOKUP.set(normalize(name), flag);
}
for (const [alias, canonical] of Object.entries(ALIASES)) {
  const flag = CIV_FLAGS[canonical];
  if (flag) FLAG_LOOKUP.set(normalize(alias), flag);
}

const FALLBACK_FLAG = '🎮';

export function civFlag(civ: string | undefined | null): string {
  if (!civ || !civ.trim()) return FALLBACK_FLAG;
  const key = normalize(civ);

  const direct = FLAG_LOOKUP.get(key);
  if (direct) return direct;

  for (const [name, flag] of FLAG_LOOKUP) {
    if (key.includes(name) || name.includes(key)) return flag;
  }

  const firstLetter = civ.trim().charAt(0).toUpperCase();
  return firstLetter || FALLBACK_FLAG;
}
