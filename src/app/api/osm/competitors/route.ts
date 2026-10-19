import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const CACHE_TTL = 10 * 60 * 1000;
const cache = new Map<string, { ts: number; data: any }>();

interface Item { id: number; name: string; type: string; subtype: string; lat: number; lng: number; addr: string; }

function classify(tags: any) {
  const name = (tags.name || '').toLowerCase();
  if (/starbucks|janji jiwa|tomoro|kenangan|excelso|anomali|fore|jco/.test(name)) return { type: 'Coffee shop', subtype: 'Branded' };
  if (tags.shop === 'coffee' || tags.shop === 'coffee_shop') return { type: 'Kedai kopi', subtype: 'Independen' };
  if (tags.amenity === 'cafe') return { type: 'Cafe', subtype: 'Umum' };
  return { type: 'Kedai kopi', subtype: 'Lainnya' };
}

const EPS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
async function fetchOP(q: string) {
  for (const ep of EPS) { try { const r = await fetch(`${ep}?data=${encodeURIComponent(q)}`, { headers: { 'User-Agent': 'WebGIS-KedaiKopi/1.0' } }); if (!r.ok) continue; const t = await r.text(); try { return JSON.parse(t); } catch { continue; } } catch { continue; } }
  throw new Error('All endpoints failed');
}

export async function GET(req: NextRequest) {
  const bbox = req.nextUrl.searchParams.get('bbox');
  if (!bbox) return NextResponse.json({ error: 'bbox required' }, { status: 400 });
  const [s, w, n, e] = bbox.split(',').map(Number);
  const ck = `comp:${bbox}`;
  const c = cache.get(ck);
  if (c && Date.now() - c.ts < CACHE_TTL) return NextResponse.json(c.data, { headers: { 'X-Cache': 'HIT' } });

  const q = `[out:json][timeout:90];(node["amenity"~"cafe|coffee_shop",i](${s},${w},${n},${e});way["amenity"~"cafe|coffee_shop",i](${s},${w},${n},${e});node["shop"~"coffee|coffee_shop",i](${s},${w},${n},${e});way["shop"~"coffee|coffee_shop",i](${s},${w},${n},${e});node["name"~"coffee|kopi|cafe|kafe|espresso|starbucks|janji|tomoro|kenangan|excelso|anomali|fore|jco",i](${s},${w},${n},${e});way["name"~"coffee|kopi|cafe|kafe|espresso|starbucks|janji|tomoro|kenangan|excelso|anomali|fore|jco",i](${s},${w},${n},${e}););out center 800;`;
  try {
    const data = await fetchOP(q);
    const seen = new Set<number>();
    const items: Item[] = [];
    for (const el of (data.elements || [])) {
      const lat = el.lat ?? el.center?.lat; const lng = el.lon ?? el.center?.lon;
      if (lat == null || lng == null || seen.has(el.id)) continue;
      seen.add(el.id);
      const tags = el.tags || {};
      const { type, subtype } = classify(tags);
      items.push({ id: el.id, name: tags.name || 'Tanpa Nama', type, subtype, lat, lng, addr: [tags['addr:street'], tags['addr:suburb']].filter(Boolean).join(', ') || '-' });
    }
    const result = { count: items.length, items, source: 'OpenStreetMap' };
    cache.set(ck, { ts: Date.now(), data: result });
    return NextResponse.json(result, { headers: { 'X-Cache': 'MISS' } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, count: 0, items: [] }, { status: 502 });
  }
}
