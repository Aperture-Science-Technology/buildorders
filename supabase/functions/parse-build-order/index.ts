// Deno Edge Function: parses an aoeivbuilds.com build order page into a normalized BuildOrder.

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

const AOEIVBUILDS_URL_RE = /^https:\/\/(?:www\.)?aoeivbuilds\.com\/build_orders\/\d+\/?$/;

const CIV_NAMES = [
  'Holy Roman Empire',
  'HRE',
  'Zhu Xi\'s Legacy',
  'Order of the Dragon',
  "Jeanne d'Arc",
  'English',
  'French',
  'Chinese',
  'Delhi',
  'Abbasid',
  'Mongols',
  'Rus',
  'Ottomans',
  'Malians',
  'Japanese',
  'Byzantines',
  'Ayyubids',
];

interface ParseRequest {
  url: string;
}

interface ParsedAction {
  at: number;
  description: string;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ' '));
}

function timeToSeconds(time: string): number {
  const [minutes, seconds] = time.split(':').map((part) => parseInt(part, 10));
  return minutes * 60 + seconds;
}

function detectCiv(title: string): string {
  let best = '';
  for (const civ of CIV_NAMES) {
    if (civ.length > best.length && title.toLowerCase().includes(civ.toLowerCase())) {
      best = civ;
    }
  }
  return best || 'Unknown';
}

function detectType(text: string): 'rush' | 'boom' | 'turtle' | 'fast-castle' | 'defensive' | 'other' {
  const lower = text.toLowerCase();
  if (lower.includes('fast castle')) return 'fast-castle';
  if (lower.includes('rush') || lower.includes('pressure') || lower.includes('aggress')) return 'rush';
  if (lower.includes('boom') || lower.includes('fast eco') || lower.includes('eco')) return 'boom';
  if (lower.includes('turtle')) return 'turtle';
  if (lower.includes('defensive')) return 'defensive';
  return 'other';
}

function parseBuildOrderHtml(html: string, sourceUrl: string) {
  const titleMatch = html.match(/<h1>\s*([\s\S]*?)\s*<\/h1>/);
  if (!titleMatch) throw new Error('Could not find title (h1) in page');
  const title = decodeEntities(titleMatch[1]);

  const descriptionMatch = html.match(/<h3>\s*Description\s*<\/h3>\s*<p>([\s\S]*?)<\/p>/);
  const description = descriptionMatch ? decodeEntities(descriptionMatch[1]) : '';

  const videoMatch = html.match(
    /<h3>\s*Video\s*<\/h3>[\s\S]*?<a[^>]*href="(https:\/\/www\.youtube\.com\/watch\?v=[^"]+)"/,
  );
  const videoUrl = videoMatch ? videoMatch[1] : null;

  const tableMatch = html.match(/<h3>\s*Build Order\s*<\/h3>[\s\S]*?<table>([\s\S]*?)<\/table>/);
  if (!tableMatch) throw new Error('Could not find build order table');
  const tableHtml = tableMatch[1];

  const actions: ParsedAction[] = [];
  const rowRe = /<tr>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<\/tr>/g;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(tableHtml)) !== null) {
    const time = stripTags(rowMatch[1]);
    if (!/^\d{1,2}:\d{2}$/.test(time)) continue;
    const description = stripTags(rowMatch[2]);
    actions.push({ at: timeToSeconds(time), description });
  }

  if (actions.length === 0) throw new Error('No build order rows found');

  const civ = detectCiv(title);
  const type = detectType(`${title} ${description}`);

  return {
    civ,
    type,
    sourceUrl,
    sourceType: 'aoeivbuilds',
    phases: [
      {
        age: 'dark',
        timeStart: 0,
        actions: actions.map((action) => ({ at: action.at, description: action.description, kind: null })),
      },
    ],
    notes: [description, videoUrl].filter(Boolean).join('\n\n') || undefined,
    scenarios: null,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  let body: ParseRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  if (!body.url || typeof body.url !== 'string') {
    return new Response(JSON.stringify({ error: 'Missing "url" field' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  if (!AOEIVBUILDS_URL_RE.test(body.url)) {
    return new Response(
      JSON.stringify({ error: 'URL must match https://www.aoeivbuilds.com/build_orders/<id>' }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  let html: string;
  try {
    const response = await fetch(body.url, {
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch source page (status ${response.status})` }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }
    html = await response.text();
  } catch (error) {
    return new Response(
      JSON.stringify({ error: `Failed to fetch source page: ${error instanceof Error ? error.message : String(error)}` }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  try {
    const buildOrder = parseBuildOrderHtml(html, body.url);
    return new Response(JSON.stringify(buildOrder), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: `Failed to parse build order: ${error instanceof Error ? error.message : String(error)}` }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }
});
