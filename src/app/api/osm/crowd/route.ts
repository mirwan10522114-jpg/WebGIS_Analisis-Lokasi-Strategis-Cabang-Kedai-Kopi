import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const CACHE_TTL = 10 * 60 * 1000;
const cache = new Map<string, { ts: number; data: any }>();

type CrowdCat = 'Pendidikan' | 'Perdagangan' | 'Perkantoran' | 'Kesehatan' | 'Wisata' | 'Transportasi' | 'Hunian';
interface Item { id: number; name: string; category: CrowdCat; type: string; lat: number; lng: number; addr: string; }

function cat(tags: any): { category: CrowdCat; type: string } | null {
  const t = tags;
  if (t.amenity === 'university') return { category: 'Pendidikan', type: 'Kampus' };
  if (t.amenity === 'college') return { category: 'Pendidikan', type: 'Kampus' };
  if (t.amenity === 'school') return { category: 'Pendidikan', type: 'Sekolah' };
  if (t.amenity === 'kindergarten') return { category: 'Pendidikan', type: 'TK' };
  if (t.shop === 'mall') return { category: 'Perdagangan', type: 'Mall' };
  if (t.shop === 'supermarket') return { category: 'Perdagangan', type: 'Supermarket' };
  if (t.shop === 'convenience' || t.shop === 'convenience_store') return { category: 'Perdagangan', type: 'Minimarket' };
  if (t.amenity === 'marketplace') return { category: 'Perdagangan', type: 'Pasar' };
  if (t.office || t.amenity === 'government') return { category: 'Perkantoran', type: 'Kantor' };
  if (t.amenity === 'bank') return { category: 'Perkantoran', type: 'Bank' };
  if (t.amenity === 'hospital') return { category: 'Kesehatan', type: 'Rumah Sakit' };
  if (t.amenity === 'clinic') return { category: 'Kesehatan', type: 'Klinik' };
  if (t.tourism === 'museum') return { category: 'Wisata', type: 'Museum' };
  if (t.tourism === 'attraction' || t.tourism === 'artwork' || t.tourism === 'viewpoint') return { category: 'Wisata', type: 'Tempat Wisata' };
  if (t.leisure === 'park') return { category: 'Wisata', type: 'Taman' };
  if (t.amenity === 'bus_station') return { category: 'Transportasi', type: 'Terminal' };
  if (t.railway === 'station' || t.railway === 'halt') return { category: 'Transportasi', type: 'Stasiun' };
  if (t.public_transport === 'station') return { category: 'Transportasi', type: 'Stasiun/Halte' };
  if (t.building === 'apartments') return { category: 'Hunian', type: 'Apartemen' };
  if (t.tourism === 'hotel') return { category: 'Hunian', type: 'Hotel' };
  if (/kos|kost/i.test(t.name || '') || t.tourism === 'guest_house') return { category: 'Hunian', type: 'Area kos' };
  return null;
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
  const ck = `crowd:${bbox}`;
  const c = cache.get(ck);
  if (c && Date.now() - c.ts < CACHE_TTL) return NextResponse.json(c.data, { headers: { 'X-Cache': 'HIT' } });

  const q = `[out:json][timeout:120];(node["amenity"~"university|college|school|kindergarten"](${s},${w},${n},${e});way["amenity"~"university|college|school|kindergarten"](${s},${w},${n},${e});node["shop"~"mall|supermarket|convenience|convenience_store"](${s},${w},${n},${e});way["shop"~"mall|supermarket|convenience|convenience_store"](${s},${w},${n},${e});node["amenity"="marketplace"](${s},${w},${n},${e});node["office"](${s},${w},${n},${e});node["amenity"~"bank|government"](${s},${w},${n},${e});node["amenity"~"hospital|clinic"](${s},${w},${n},${e});node["tourism"~"museum|attraction|artwork|viewpoint|guest_house|hotel"](${s},${w},${n},${e});node["leisure"="park"](${s},${w},${n},${e});node["amenity"="bus_station"](${s},${w},${n},${e});node["railway"~"station|halt"](${s},${w},${n},${e});node["building"="apartments"](${s},${w},${n},${e}););out center 1500;`;
  try {
    const data = await fetchOP(q);
    const seen = new Set<number>();
    const items: Item[] = [];
    for (const el of (data.elements || [])) {
      const lat = el.lat ?? el.center?.lat; const lng = el.lon ?? el.center?.lon;
      if (lat == null || lng == null || seen.has(el.id)) continue;
      seen.add(el.id);
      const tags = el.tags || {};
      const c = cat(tags);
      if (!c) continue;
      items.push({ id: el.id, name: tags.name || tags.brand || c.type, category: c.category, type: c.type, lat, lng, addr: [tags['addr:street'], tags['addr:suburb']].filter(Boolean).join(', ') || '-' });
    }
    const result = { count: items.length, items, source: 'OpenStreetMap' };
    cache.set(ck, { ts: Date.now(), data: result });
    return NextResponse.json(result, { headers: { 'X-Cache': 'MISS' } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, count: 0, items: [] }, { status: 502 });
  }
}
