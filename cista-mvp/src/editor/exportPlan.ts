import type { Project } from '../model/types';
import { add, dist, fmtCm, labelPoint, mul, norm, perp, sub } from '../model/geometry';
import { openingsOf, roomArea, roomPolygon, solidSpans, wallGeom } from '../model/project';
import { defOf } from '../model/furniture';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** planimetria quotata come SVG autonomo (stampabile), con quote misurate in blu e stimate in grigio con ≈ */
export function planSvg(p: Project, opts: { furniture?: boolean } = { furniture: true }): string {
  const xs = p.nodes.map((n) => n.x);
  const ys = p.nodes.map((n) => n.y);
  const [x0, x1, y0, y1] = xs.length ? [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)] : [0, 800, 0, 600];
  const pad = 90;
  const W = x1 - x0 + pad * 2;
  const H = y1 - y0 + pad * 2 + 70;
  const out: string[] = [];
  const C = { ink: '#1d2328', wall: '#1d2328', meas: '#14467a', est: '#8a949b', muted: '#66717a', rad: '#c2562e', floor: '#f2efe7', wet: '#e3ecef' };
  out.push(`<rect x="${x0 - pad}" y="${y0 - pad}" width="${W}" height="${H}" fill="#fbfbf8"/>`);
  for (const r of p.rooms) {
    const poly = roomPolygon(p, r);
    if (poly.length < 3) continue;
    const wet = r.floor === 'gres' || r.floor.startsWith('tiles');
    out.push(`<polygon points="${poly.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' ')}" fill="${wet ? C.wet : C.floor}"/>`);
  }
  for (const f of p.fixtures) {
    const tr = `translate(${f.x.toFixed(1)} ${f.y.toFixed(1)}) rotate(${f.rot})`;
    const r = `x="${-f.w / 2}" y="${-f.d / 2}" width="${f.w}" height="${f.d}"`;
    if (f.kind === 'pillar') out.push(`<rect transform="${tr}" ${r} fill="${C.wall}"/>`);
    else if (f.kind === 'radiator' || f.kind === 'outlet') out.push(`<rect transform="${tr}" ${r} fill="none" stroke="${C.rad}" stroke-width="1.4"/>`);
    else if (f.kind === 'closet' || f.kind === 'obstacle')
      out.push(`<g transform="${tr}"><rect ${r} fill="none" stroke="${C.muted}" stroke-dasharray="5 3" stroke-width="1"/><line x1="${-f.w / 2}" y1="${-f.d / 2}" x2="${f.w / 2}" y2="${f.d / 2}" stroke="${C.muted}" stroke-dasharray="5 3" stroke-width=".7"/></g>`);
    else out.push(`<rect transform="${tr}" ${r} fill="#fff" stroke="${C.muted}" stroke-width="1"/>`);
  }
  if (opts.furniture)
    for (const it of p.items) {
      const parts = defOf(it.type).parts(it);
      out.push(
        `<g transform="translate(${it.x.toFixed(1)} ${it.y.toFixed(1)}) rotate(${it.rot})" opacity=".9">${parts
          .map((q) => (q.shape === 'cyl' ? `<ellipse cx="${q.x}" cy="${q.y}" rx="${q.w / 2}" ry="${q.d / 2}" fill="#fff" stroke="${C.muted}" stroke-width=".6"/>` : `<rect x="${q.x - q.w / 2}" y="${q.y - q.d / 2}" width="${q.w}" height="${q.d}" fill="#fff" stroke="${C.muted}" stroke-width=".6"/>`))
          .join('')}</g>`,
      );
    }
  for (const w of p.walls) {
    const g = wallGeom(p, w);
    const ang = (Math.atan2(g.dir.y, g.dir.x) * 180) / Math.PI;
    for (const s of solidSpans(p, w)) {
      const c = add(g.a, mul(g.dir, (s.s0 + s.s1) / 2));
      out.push(`<rect transform="translate(${c.x.toFixed(1)} ${c.y.toFixed(1)}) rotate(${ang.toFixed(2)})" x="${(-(s.s1 - s.s0) / 2).toFixed(1)}" y="${-w.thickness / 2}" width="${(s.s1 - s.s0).toFixed(1)}" height="${w.thickness}" fill="${C.wall}"/>`);
    }
    for (const o of openingsOf(p, w.id)) {
      const at = (s: number, off = 0) => add(add(g.a, mul(g.dir, s)), mul(g.n, off));
      const s0 = o.offset - o.width / 2;
      const s1 = o.offset + o.width / 2;
      if (o.kind === 'window' || o.kind === 'window-fixed') {
        for (const off of [-g.half, -g.half / 3, g.half / 3, g.half]) {
          const a = at(s0, off);
          const b = at(s1, off);
          out.push(`<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="${C.wall}" stroke-width=".8"/>`);
        }
      } else if (o.kind === 'door') {
        const hs = o.hinge === 'end' ? s1 : s0;
        const os = o.hinge === 'end' ? s0 : s1;
        const hinge = at(hs, g.half * o.side);
        const leaf = add(hinge, mul(g.n, o.side * o.width));
        const other = at(os, g.half * o.side);
        const cr = (leaf.x - hinge.x) * (other.y - hinge.y) - (leaf.y - hinge.y) * (other.x - hinge.x);
        out.push(`<line x1="${hinge.x.toFixed(1)}" y1="${hinge.y.toFixed(1)}" x2="${leaf.x.toFixed(1)}" y2="${leaf.y.toFixed(1)}" stroke="${C.ink}" stroke-width="2"/>`);
        out.push(`<path d="M${leaf.x.toFixed(1)},${leaf.y.toFixed(1)} A${o.width},${o.width} 0 0 ${cr > 0 ? 1 : 0} ${other.x.toFixed(1)},${other.y.toFixed(1)}" fill="none" stroke="${C.muted}" stroke-width=".8" stroke-dasharray="4 3"/>`);
      }
    }
  }
  for (const r of p.rooms) {
    const poly = roomPolygon(p, r);
    if (poly.length < 3) continue;
    const c = labelPoint(poly);
    out.push(`<text x="${c.x.toFixed(1)}" y="${(c.y - 4).toFixed(1)}" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-weight="700" font-size="18" letter-spacing="1.5" text-anchor="middle" fill="${C.ink}">${esc(r.name.toUpperCase())}</text>`);
    out.push(`<text x="${c.x.toFixed(1)}" y="${(c.y + 14).toFixed(1)}" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-size="14" text-anchor="middle" fill="${C.muted}">${roomArea(p, r).toFixed(1).replace('.', ',')} m²</text>`);
  }
  for (const d of p.dims) {
    const dir = norm(sub(d.b, d.a));
    const n = perp(dir);
    const a = add(d.a, mul(n, d.offset));
    const b = add(d.b, mul(n, d.offset));
    const col = d.measured ? C.meas : C.est;
    const k = mul(add(dir, n), 3.5);
    const mid = mul(add(a, b), 0.5);
    let ang = (Math.atan2(dir.y, dir.x) * 180) / Math.PI;
    if (ang > 90 || ang <= -90) ang += 180;
    const text = d.label ?? `${d.measured ? '' : '≈'}${fmtCm(dist(d.a, d.b))}`;
    out.push(
      `<g stroke="${col}"><line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke-width=".8" ${d.measured ? '' : 'stroke-dasharray="4 3"'}/>` +
        [a, b].map((q) => `<line x1="${(q.x - k.x).toFixed(1)}" y1="${(q.y - k.y).toFixed(1)}" x2="${(q.x + k.x).toFixed(1)}" y2="${(q.y + k.y).toFixed(1)}" stroke-width="1.3"/>`).join('') +
        `</g><text transform="rotate(${ang.toFixed(1)} ${mid.x.toFixed(1)} ${mid.y.toFixed(1)}) translate(0 -4)" x="${mid.x.toFixed(1)}" y="${mid.y.toFixed(1)}" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-weight="${d.measured ? 700 : 500}" font-size="14" text-anchor="middle" fill="${col}" stroke="#fbfbf8" stroke-width="4" paint-order="stroke">${esc(text)}</text>`,
    );
  }
  const by = y1 + pad - 10;
  out.push(
    `<g font-family="Barlow Condensed, Arial Narrow, sans-serif" font-size="13" fill="${C.ink}">` +
      `<rect x="${x0}" y="${by}" width="50" height="7" fill="${C.ink}"/><rect x="${x0 + 50}" y="${by}" width="50" height="7" fill="#fff" stroke="${C.ink}"/><rect x="${x0 + 100}" y="${by}" width="100" height="7" fill="${C.ink}"/>` +
      `<text x="${x0}" y="${by + 22}">0</text><text x="${x0 + 100}" y="${by + 22}" text-anchor="middle">1 m</text><text x="${x0 + 200}" y="${by + 22}" text-anchor="middle">2 m</text>` +
      `<rect x="${x1 - 300}" y="${by - 6}" width="300" height="58" fill="#fff" stroke="${C.ink}"/>` +
      `<text x="${x1 - 290}" y="${by + 12}" font-weight="700" letter-spacing="1">${esc(p.name.toUpperCase())} · PIANTA QUOTATA</text>` +
      `<text x="${x1 - 290}" y="${by + 30}" fill="${C.muted}">Quote in cm: blu = misurate in casa, grigio ≈ = stimate dal disegno</text>` +
      `<text x="${x1 - 290}" y="${by + 46}" fill="${C.muted}">Generata con CiSta il ${new Date().toLocaleDateString('it-IT')}</text></g>`,
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0 - pad} ${y0 - pad} ${W} ${H}" width="${Math.round(W)}" height="${Math.round(H)}">${out.join('')}</svg>`;
}

function download(name: string, blob: Blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const fileName = (p: Project, ext: string) => `${p.name.replace(/\W+/g, '-').toLowerCase()}-planimetria.${ext}`;

export function exportSvg(p: Project) {
  download(fileName(p, 'svg'), new Blob([planSvg(p)], { type: 'image/svg+xml' }));
}

export function exportPng(p: Project) {
  const svg = planSvg(p);
  const img = new Image();
  img.onload = () => {
    const k = 2;
    const c = document.createElement('canvas');
    c.width = img.width * k;
    c.height = img.height * k;
    const g = c.getContext('2d')!;
    g.scale(k, k);
    g.drawImage(img, 0, 0);
    c.toBlob((b) => b && download(fileName(p, 'png'), b), 'image/png');
  };
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
