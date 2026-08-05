import abbasidDynasty from '@/assets/flags/ABBASID_DYNASTY.png';
import ayyubids from '@/assets/flags/AYYUBIDS.png';
import byzantines from '@/assets/flags/BYZANTINES.png';
import chinese from '@/assets/flags/CHINESE.png';
import delhiSultanate from '@/assets/flags/DELHI_SULTANATE.png';
import english from '@/assets/flags/ENGLISH.png';
import french from '@/assets/flags/FRENCH.png';
import goldenHorde from '@/assets/flags/GOLDEN_HORDE.png';
import holyRomanEmpire from '@/assets/flags/HOLY_ROMAN_EMPIRE.png';
import houseOfLancaster from '@/assets/flags/HOUSE_OF_LANCASTER.png';
import japanese from '@/assets/flags/JAPANESE.png';
import jeanneDarc from '@/assets/flags/JEANNE_DARC.png';
import jinDynasty from '@/assets/flags/JIN_DYNASTY.png';
import knightsTemplar from '@/assets/flags/KNIGHTS_TEMPLAR.png';
import macedonianDynasty from '@/assets/flags/MACEDONIAN_DYNASTY.png';
import malians from '@/assets/flags/MALIANS.png';
import mongols from '@/assets/flags/MONGOLS.png';
import orderOfTheDragon from '@/assets/flags/ORDER_OF_THE_DRAGON.png';
import ottomans from '@/assets/flags/OTTOMANS.png';
import rus from '@/assets/flags/RUS.png';
import sengokuDaimyo from '@/assets/flags/SENGOKU_DAIMYO.png';
import tughlaqDynasty from '@/assets/flags/TUGHLAQ_DYNASTY.png';
import zhuXisLegacy from '@/assets/flags/ZHU_XIS_LEGACY.png';

export const CIV_FLAGS: Record<string, string> = {
  'Abbasid Dynasty': abbasidDynasty.src,
  Ayyubids: ayyubids.src,
  Byzantines: byzantines.src,
  Chinese: chinese.src,
  'Delhi Sultanate': delhiSultanate.src,
  English: english.src,
  French: french.src,
  'Golden Horde': goldenHorde.src,
  'Holy Roman Empire': holyRomanEmpire.src,
  'House of Lancaster': houseOfLancaster.src,
  Japanese: japanese.src,
  "Jeanne d'Arc": jeanneDarc.src,
  'Jin Dynasty': jinDynasty.src,
  'Knights Templar': knightsTemplar.src,
  'Macedonian Dynasty': macedonianDynasty.src,
  Malians: malians.src,
  Mongols: mongols.src,
  'Order of the Dragon': orderOfTheDragon.src,
  Ottomans: ottomans.src,
  Rus: rus.src,
  'Sengoku Daimyo': sengokuDaimyo.src,
  'Tughlaq Dynasty': tughlaqDynasty.src,
  "Zhu Xi's Legacy": zhuXisLegacy.src,
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
  'zhu xis legacy': "Zhu Xi's Legacy",
  jeanne: "Jeanne d'Arc",
  jeannedarc: "Jeanne d'Arc",
  ootd: 'Order of the Dragon',
  otd: 'Order of the Dragon',
  orderofthedragon: 'Order of the Dragon',
  dragon: 'Order of the Dragon',
  templar: 'Knights Templar',
  templars: 'Knights Templar',
  lancaster: 'House of Lancaster',
  macedonian: 'Macedonian Dynasty',
  macedonians: 'Macedonian Dynasty',
  sengoku: 'Sengoku Daimyo',
  tughlaq: 'Tughlaq Dynasty',
  horde: 'Golden Horde',
  goldenhorde: 'Golden Horde',
  jin: 'Jin Dynasty',
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

export function civFlag(civ: string | undefined | null): string {
  if (!civ || !civ.trim()) return '';
  const key = normalize(civ);

  const direct = FLAG_LOOKUP.get(key);
  if (direct) return direct;

  for (const [name, flag] of FLAG_LOOKUP) {
    if (key.includes(name) || name.includes(key)) return flag;
  }

  return '';
}
