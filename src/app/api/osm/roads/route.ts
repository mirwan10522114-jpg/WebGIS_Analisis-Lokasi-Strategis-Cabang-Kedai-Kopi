import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const CACHE_TTL = 10 * 60 * 1000;
const cache = new Map<string, { ts: number; data: any }>();

type RC = 'Jalan Utama' | 'Jalan Sedang' | 'Jalan Kecil / Gang';
function cls(h: string): { c: RC; s: number } {
  const x = (h || '').toLowerCase();
  if (['motorway','motorway_link','trunk','trunk_link','primary','primary_link'].includes(x)) return { c: 'Jalan Utama', s: 5 };
  if (['secondary','secondary_link','tertiary','tertiary_link','unclassified','residential','road'].includes(x)) return { c: 'Jalan Sedang', s: 3 };
  return { c: 'Jalan Kecil / Gang', s: 1 };
}
function hav(la1:number,lo1:number,la2:number,lo2:number) { const R=6371000; const dL=(la2-la1)*Math.PI/180; const dG=(lo2-lo1)*Math.PI/180; const a=Math.sin(dL/2)**2+Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(dG/2)**2; return 2*R*Math.asin(Math.sqrt(a)); }
function distToWay(la:number,lo:number,g:[number,number][]) { let m=Infinity; for(let i=0;i<g.length;i++){const d=hav(la,lo,g[i][0],g[i][1]);if(d<m)m=d;if(i<g.length-1){const ml=(g[i][0]+g[i+1][0])/2;const mg=(g[i][1]+g[i+1][1])/2;const dm=hav(la,lo,ml,mg);if(dm<m)m=dm;}} return m; }

const EPS = ['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter'];
async function fetchOP(q:string) { for(const ep of EPS){try{const r=await fetch(`${ep}?data=${encodeURIComponent(q)}`,{headers:{'User-Agent':'WebGIS-KedaiKopi/1.0'}});if(!r.ok)continue;const t=await r.text();try{return JSON.parse(t);}catch{continue;}}catch{continue;}}throw new Error('All failed'); }

export async function GET(req: NextRequest) {
  const la = parseFloat(req.nextUrl.searchParams.get('lat')||'');
  const lo = parseFloat(req.nextUrl.searchParams.get('lng')||'');
  const r = parseInt(req.nextUrl.searchParams.get('radius')||'200');
  if(isNaN(la)||isNaN(lo)) return NextResponse.json({error:'lat,lng required'},{status:400});
  const ck=`road:${la.toFixed(5)},${lo.toFixed(5)},${r}`;
  const c=cache.get(ck); if(c&&Date.now()-c.ts<CACHE_TTL) return NextResponse.json(c.data,{headers:{'X-Cache':'HIT'}});
  const q=`[out:json][timeout:30];way(around:${r},${la},${lo})["highway"];out geom 200;`;
  try {
    const d=await fetchOP(q);
    const items=(d.elements||[]).filter((e:any)=>e.geometry&&e.geometry.length>0).map((e:any)=>{
      const tags=e.tags||{}; const g=e.geometry.map((x:any)=>[x.lat,x.lon] as [number,number]);
      const dist=distToWay(la,lo,g); const cl=cls(tags.highway);
      let bv=g[0]; let bd=Infinity; for(const v of g){const dd=hav(la,lo,v[0],v[1]);if(dd<bd){bd=dd;bv=v;}}
      return {id:e.id,name:tags.name||'(Tanpa Nama)',highway:tags.highway,width:tags.width||'-',lanes:tags.lanes||'-',lat:bv[0],lng:bv[1],dist:Math.round(dist),category:cl.c,score:cl.s};
    }).sort((a:any,b:any)=>a.dist-b.dist);
    const nearest=items.find((i:any)=>i.category!=='Jalan Kecil / Gang')||items[0]||null;
    const result={count:items.length,nearest,items,source:'OpenStreetMap'};
    cache.set(ck,{ts:Date.now(),data:result});
    return NextResponse.json(result,{headers:{'X-Cache':'MISS'}});
  } catch(err:any) {
    return NextResponse.json({error:err.message,count:0,items:[],nearest:null},{status:502});
  }
}
