// Deno Edge Function stub: parses a source URL into a normalized BuildOrder.
// Currently returns mock data; real parsing (aoe4world/youtube/ageofempires) lands later.

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ParseRequest {
  url: string;
}

function mockBuildOrder(sourceUrl: string) {
  return {
    id: 'mock-build-order-01',
    civ: 'Holy Roman Empire',
    type: 'fast-castle',
    sourceUrl,
    sourceType: 'manual',
    phases: [
      {
        age: 'dark',
        timeStart: 0,
        targetResources: { food: 200, wood: 100, gold: 0, stone: 0 },
        targetVillagers: 6,
        actions: [
          { at: 0, description: 'Villagers start gathering sheep', kind: 'gather' },
          { at: 90, description: 'Build House', kind: 'build' },
        ],
      },
      {
        age: 'feudal',
        timeStart: 270,
        targetResources: { food: 300, wood: 250, gold: 50, stone: 0 },
        targetVillagers: 10,
        actions: [{ at: 270, description: 'Click Feudal Age', kind: 'age-up' }],
      },
    ],
    notes: 'Mock response from parse-build-order stub.',
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

  return new Response(JSON.stringify(mockBuildOrder(body.url)), {
    status: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
});
