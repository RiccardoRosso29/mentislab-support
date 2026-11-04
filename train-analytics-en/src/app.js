(function () {
  const D = window.DATA;
  const C = { T: '#4682F5', I: '#D24682', Tl: '#C7D9FC', Il: '#FFD2E3', ink: '#0A0A0A', line: '#E6E6E6', muted: '#969696', bg: '#F7F7F7' };
  const fmt = d3.format(',');
  const fk = (v) => (v === 0 ? '0' : d3.format(',')(v));
  const pc = (v) => `${v}%`;
  const pc2 = (v) => (v === 0 ? '<0.01%' : `${v}%`);
  const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };
  const root = document.getElementById('root');
  const TOTAL_PAGES = 4;

  const legend = () => `<div class="legendbar"><span><i class="sw" style="background:${C.I}"></i>Italo</span><span><i class="sw" style="background:${C.T}"></i>Trenitalia</span></div>`;

  function page(n, title, sub) {
    const el = h(`<section class="page" data-page="${n}">
      <header class="top"><div class="brand">${window.LOGO}<span class="sep"></span><h1>Train Analytics</h1></div>
        <div class="pg">${sub} · ${n}/${TOTAL_PAGES}</div></header>
      <div class="filters">
        <span class="chip">Period: <b>${D.filters.period}</b></span>
        <span class="chip">From: <b>${D.filters.from}</b></span>
        <span class="chip">To: <b>${D.filters.to}</b></span>
        <span class="chip on">High-speed</span><span class="chip on">Bidirectional</span><span class="chip on">Top 60 markets</span>
        ${legend()}
      </div>
      <div class="wrap"></div>
      <footer class="foot"><span>CKDELTA · TRAIN ANALYTICS · ${title.toUpperCase()}</span><span>MILAN ⇄ ROME · JUNE 2024</span></footer>
    </section>`);
    root.appendChild(el);
    return el.querySelector('.wrap');
  }
  let secN = 0;
  function section(wrap, title, sub = '') {
    secN += 1;
    wrap.appendChild(h(`<div class="section-title"><span class="num">${String(secN).padStart(2, '0')}</span><h2>${title}</h2>${sub ? `<span class="sub">${sub}</span>` : ''}</div>`));
  }
  function card(parent, title, cap, cls = '') {
    const el = h(`<div class="card ${cls}">${title ? `<h3>${title}</h3>` : ''}${cap ? `<div class="cap">${cap}</div>` : ''}</div>`);
    parent.appendChild(el);
    return el;
  }
  function svg(parent, w, hgt) {
    return d3.select(parent).append('svg').attr('width', w).attr('height', hgt).attr('viewBox', `0 0 ${w} ${hgt}`);
  }

  // ---------- chart primitives ----------
  function donut(parent, parts, size, inner = 0.62, labels = true) {
    const s = svg(parent, size, size).append('g').attr('transform', `translate(${size / 2},${size / 2})`);
    const r = size / 2;
    const pie = d3.pie().sort(null).value((d) => d.v);
    const arc = d3.arc().innerRadius(r * inner).outerRadius(r).padAngle(0.012);
    const arcs = pie(parts);
    s.selectAll('path').data(arcs).join('path').attr('d', arc).attr('fill', (d) => d.data.c);
    if (labels) {
      const la = d3.arc().innerRadius(r * (inner ? (1 + inner) / 2 : 0.62)).outerRadius(r * (inner ? (1 + inner) / 2 : 0.62));
      s.selectAll('text').data(arcs.filter((d) => d.data.label)).join('text')
        .attr('transform', (d) => `translate(${la.centroid(d)})`).attr('text-anchor', 'middle').attr('dy', '0.35em')
        .attr('font-size', 13).attr('font-weight', 600).attr('fill', (d) => d.data.tc || '#fff').text((d) => d.data.label);
    }
    return s;
  }

  function lineChart(parent, { w, h: H, series, xs, xTicks, xFmt, yMax, yTicks = 5, yFmt = d3.format(','), area = true, m = { t: 14, r: 16, b: 34, l: 64 }, medians }) {
    const s = svg(parent, w, H);
    const x = d3.scaleLinear().domain(d3.extent(xs)).range([m.l, w - m.r]);
    const y = d3.scaleLinear().domain([0, yMax]).nice(yTicks).range([H - m.b, m.t]);
    s.append('g').attr('class', 'ax').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).tickValues(xTicks).tickFormat(xFmt).tickSize(4))
      .call((g) => g.select('.domain').attr('stroke', C.ink));
    s.append('g').attr('class', 'ax').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(yTicks).tickFormat(yFmt).tickSize(-(w - m.l - m.r)))
      .call((g) => g.select('.domain').remove()).call((g) => g.selectAll('line').attr('stroke', C.line));
    series.forEach((sr) => {
      const pts = sr.v.map((v, i) => [xs[i], v]);
      if (area) {
        const gid = `g${Math.random().toString(36).slice(2)}`;
        const grad = s.append('defs').append('linearGradient').attr('id', gid).attr('x1', 0).attr('x2', 0).attr('y1', 0).attr('y2', 1);
        grad.append('stop').attr('offset', 0).attr('stop-color', sr.c).attr('stop-opacity', 0.28);
        grad.append('stop').attr('offset', 1).attr('stop-color', sr.c).attr('stop-opacity', 0.03);
        s.append('path').datum(pts).attr('fill', `url(#${gid})`).attr('d', d3.area().x((d) => x(d[0])).y0(y(0)).y1((d) => y(d[1])).curve(d3.curveMonotoneX));
      }
      s.append('path').datum(pts).attr('fill', 'none').attr('stroke', sr.c).attr('stroke-width', sr.sw || 2.2)
        .attr('d', d3.line().x((d) => x(d[0])).y((d) => y(d[1])).curve(d3.curveMonotoneX));
    });
    if (medians) medians.forEach((md) => {
      s.append('line').attr('x1', x(md.x)).attr('x2', x(md.x)).attr('y1', m.t).attr('y2', H - m.b).attr('stroke', md.c).attr('stroke-dasharray', '4 3').attr('stroke-width', 1.2);
    });
    return { s, x, y };
  }

  const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(Math.round(min % 60)).padStart(2, '0')}`;

  function barChart(parent, { w, h: H, cats, groups, yMax, yTickVals, m = { t: 24, r: 10, b: 30, l: 44 }, labelFmt = (v) => `${v}%`, fontSize = 12, stagger = false }) {
    const s = svg(parent, w, H);
    const x0 = d3.scaleBand().domain(cats).range([m.l, w - m.r]).paddingInner(0.22).paddingOuter(0.1);
    const x1 = d3.scaleBand().domain(groups.map((g) => g.k)).range([0, x0.bandwidth()]).padding(0.08);
    const y = d3.scaleLinear().domain([0, yMax]).range([H - m.b, m.t]);
    s.append('g').attr('class', 'ax').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).tickValues(yTickVals).tickFormat((v) => `${v}%`).tickSize(-(w - m.l - m.r)))
      .call((g) => g.select('.domain').remove()).call((g) => g.selectAll('line').attr('stroke', C.line));
    s.append('g').attr('class', 'ax').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x0).tickSize(0).tickPadding(8))
      .call((g) => g.select('.domain').attr('stroke', C.ink)).selectAll('text').attr('font-size', fontSize - 1).attr('dy', (d, i) => (stagger && i % 2 ? '1.9em' : '0.71em'));
    groups.forEach((g) => {
      cats.forEach((c, i) => {
        const v = g.v[i];
        const bx = x0(c) + x1(g.k);
        s.append('rect').attr('x', bx).attr('y', y(v)).attr('width', x1.bandwidth()).attr('height', y(0) - y(v)).attr('rx', 3).attr('fill', g.c);
        s.append('text').attr('x', bx + x1.bandwidth() / 2).attr('y', y(v) - 6).attr('text-anchor', 'middle').attr('font-size', fontSize).attr('font-weight', 600).attr('fill', g.tc || g.c).text(labelFmt(v));
      });
    });
    return s;
  }

  function heatTable(parent, { rows, cols, data, rowTot, colTot, color, cell, tot, barColor, barMax, colBarMax }) {
    const lum = (c) => { const r = d3.rgb(c); return 0.2126 * r.r + 0.7152 * r.g + 0.0722 * r.b; };
    let html = `<table class="t heat"><thead><tr><th class="l">Time</th>${cols.map((c) => `<th style="text-align:center">${c}</th>`).join('')}<th style="width:200px">Total</th></tr></thead><tbody>`;
    rows.forEach((r, i) => {
      html += `<tr><td class="l mono" style="font-size:12px">${r}</td>`;
      data[i].forEach((v) => { const bg = color(v); html += `<td class="c" style="background:${bg};color:${lum(bg) < 150 ? '#fff' : C.ink}">${cell(v)}</td>`; });
      const bw = Math.max(2, (rowTot[i] / barMax) * 110);
      html += `<td><span>${tot(rowTot[i])}</span><span class="bar" style="width:${bw}px;background:${barColor}"></span></td></tr>`;
    });
    html += `<tr class="tot"><td class="l">Total</td>${colTot.map((v) => `<td style="text-align:center;vertical-align:bottom"><div style="height:${Math.max(3, colBarMax(v))}px;background:${barColor};border-radius:3px 3px 0 0;margin:0 14px 4px"></div>${tot(v)}</td>`).join('')}<td></td></tr>`;
    html += '</tbody></table>';
    parent.insertAdjacentHTML('beforeend', html);
  }

  const opDot = (op) => `<span class="op"><i style="background:${op === 'Italo' ? C.I : C.T}"></i>${op}</span>`;

  // ---------- maps ----------
  const world = window.WORLD50;
  const countries = topojson.feature(world, world.objects.countries);
  const italy = countries.features.find((f) => f.properties.name === 'Italy');

  function italyBubbleMap(parent, { w, h: H, points, labelTop = 6, maxR = 34 }) {
    const s = svg(parent, w, H);
    const proj = d3.geoMercator().fitExtent([[10, 10], [w - 10, H - 10]], { type: 'MultiPoint', coordinates: [[6.6, 47.1], [18.6, 36.6]] });
    const path = d3.geoPath(proj);
    s.append('rect').attr('width', w).attr('height', H).attr('fill', '#EEF3F6').attr('rx', 10);
    s.append('g').selectAll('path').data(countries.features.filter((f) => f !== italy)).join('path').attr('d', path).attr('fill', '#F7F7F7').attr('stroke', '#D9D9D9').attr('stroke-width', 0.6);
    s.append('path').datum(italy).attr('d', path).attr('fill', '#FFFFFF').attr('stroke', '#A9A9A9').attr('stroke-width', 0.9);
    const r = d3.scaleSqrt().domain([0, d3.max(points, (p) => p.total)]).range([0, maxR]);
    const sorted = [...points].sort((a, b) => b.total - a.total);
    const LBL = { Milan: 't', Turin: 'l', Venice: 'r', Bologna: 'r', Florence: 'r', Rome: 'r', Naples: 'bl' };
    const placed = [];
    sorted.forEach((p) => {
      const [cx, cy] = proj(D.COORD[p.name]);
      const g = s.append('g').attr('transform', `translate(${cx},${cy})`);
      const rr = r(p.total);
      const arcs = d3.pie().sort(null).value((d) => d.v)([{ v: p.T, c: C.T }, { v: p.I, c: C.I }]);
      g.selectAll('path').data(arcs).join('path').attr('d', d3.arc().innerRadius(0).outerRadius(rr)).attr('fill', (d) => d.data.c).attr('fill-opacity', 0.9).attr('stroke', '#fff').attr('stroke-width', 1.2);
      if (LBL[p.name]) placed.push({ p, cx, cy, rr, pos: LBL[p.name] });
    });
    placed.forEach(({ p, cx, cy, rr, pos }) => {
      let x = cx, y = cy + 4, a = 'middle';
      if (pos === 'r') { x = cx + rr + 5; a = 'start'; }
      if (pos === 'l') { x = cx - rr - 5; a = 'end'; }
      if (pos === 't') { y = cy - rr - 6; }
      if (pos === 'bl') { x = cx - rr * 0.6; y = cy + rr + 14; a = 'end'; }
      s.append('text').attr('x', x).attr('y', y).attr('text-anchor', a).attr('font-size', 12).attr('font-weight', 600).attr('fill', C.ink)
        .attr('paint-order', 'stroke').attr('stroke', '#fff').attr('stroke-width', 3.5).attr('stroke-linejoin', 'round').text(p.name);
    });
    return s;
  }

  // ======================= PAGE 1 =======================
  function page1() {
    secN = 0;
    const w = page(1, 'Overview', 'Passenger overview');
    section(w, 'Passengers', 'Italo vs Trenitalia');
    const g = h('<div class="grid2"></div>'); w.appendChild(g);
    [['Passengers', D.kpi.passengers], ['Unique passengers', D.kpi.unique]].forEach(([lbl, k]) => {
      const c = card(g, '', ''); c.classList.add('kpi');
      const d = h('<div></div>'); c.appendChild(d);
      donut(d, [{ v: k.italo, c: C.I, label: `${k.italo}%` }, { v: k.trenitalia, c: C.T, label: `${k.trenitalia}%` }], 170, 0.55);
      c.appendChild(h(`<div><div class="lbl">${lbl}</div><div class="val">${fmt(k.total)}</div>
        <div class="split"><span><i class="sw" style="background:${C.I}"></i>Italo <b>${fmt(Math.round(k.total * k.italo / 100))}</b></span>
        <span><i class="sw" style="background:${C.T}"></i>Trenitalia <b>${fmt(Math.round(k.total * k.trenitalia / 100))}</b></span></div>
        <div class="note">Operator figures derived from the reported shares</div></div>`));
    });

    section(w, 'Daily passengers', '1–30 June 2024');
    const c2 = card(w, '', 'Passengers per day by operator');
    const days = d3.range(1, 31);
    lineChart(c2, { w: 1074, h: 300, xs: days, xTicks: d3.range(1, 31, 2), xFmt: (d) => `${d} Jun`, yMax: 140000, yTicks: 7,
      series: [{ v: D.daily.T, c: C.T }, { v: D.daily.I, c: C.I }] });

    section(w, 'Trip distribution', 'Passengers by departure weekday and time slot');
    const c3 = card(w, '', 'Operator: Italo, Trenitalia');
    const maxCell = d3.max(D.trips.flat());
    heatTable(c3, { rows: D.slots, cols: D.days, data: D.trips, rowTot: D.tripsRowTot, colTot: D.tripsColTot,
      color: d3.scaleSequential(d3.interpolateRgb('#F1F6FF', '#1F4FB5')).domain([0, maxCell]),
      cell: fmt, tot: fmt, barColor: C.T, barMax: d3.max(D.tripsRowTot), colBarMax: (v) => (v / 830000) * 60 });

    section(w, 'Italo market share distribution', 'Italo share by departure weekday and time slot');
    const c4 = card(w, '', 'Market share Italo');
    heatTable(c4, { rows: D.slots, cols: D.days, data: D.share, rowTot: D.shareRowTot, colTot: D.shareColTot,
      color: d3.scaleSequential(d3.interpolateRgb('#FFF4F8', '#A8285E')).domain([18, 43]),
      cell: pc, tot: pc, barColor: C.I, barMax: 40, colBarMax: (v) => ((v - 30) / 8) * 60 });

    section(w, 'Trip duration & time in station');
    const g5 = h('<div class="grid2"></div>'); w.appendChild(g5);
    const cd = card(g5, 'Trip duration', 'Passengers by journey time (1-minute bins)');
    const durX = D.duration.T.map((_, i) => D.duration.startMin + i);
    const row = h('<div style="display:flex;gap:10px;align-items:flex-start"></div>'); cd.appendChild(row);
    const chartBox = h('<div></div>'); row.appendChild(chartBox);
    lineChart(chartBox, { w: 400, h: 330, xs: durX, xTicks: d3.range(60, 300, 30), xFmt: hhmm, yMax: 45000, yTicks: 5, area: false,
      series: [{ v: D.duration.T, c: C.T, sw: 1.6 }, { v: D.duration.I, c: C.I, sw: 1.6 }], m: { t: 10, r: 8, b: 30, l: 52 },
      medians: [{ x: 114, c: C.T }, { x: 116, c: C.I }] });
    row.appendChild(h(`<div class="medians" style="padding-top:8px"><div class="med"><div class="k">Median · Italo</div><div class="v" style="color:${C.I}">${D.duration.medianI}</div></div>
      <div class="med"><div class="k">Median · Trenitalia</div><div class="v" style="color:${C.T}">${D.duration.medianT}</div></div></div>`));

    const cs = card(g5, 'Time spent in station', 'Passengers by dwell time (3-minute bins)');
    [['At departure', D.dwellDep, 150000, d3.range(0, 450, 60)], ['At arrival', D.dwellArr, 350000, d3.range(0, 300, 60)]].forEach(([lbl, dd, ymax, ticks]) => {
      const r = h('<div style="display:flex;gap:10px;align-items:flex-start;margin-top:4px"></div>'); cs.appendChild(r);
      const b = h('<div></div>'); r.appendChild(b);
      const xs = dd.T.map((_, i) => i * dd.step);
      lineChart(b, { w: 360, h: 160, xs, xTicks: ticks, xFmt: hhmm, yMax: ymax, yTicks: 3, area: true, yFmt: d3.format('~s'),
        series: [{ v: dd.T, c: C.T, sw: 1.6 }, { v: dd.I, c: C.I, sw: 1.6 }], m: { t: 8, r: 8, b: 26, l: 42 } });
      r.appendChild(h(`<div class="medians"><span class="pill">${lbl}</span><div class="med"><div class="k">Median · Italo</div><div class="v" style="color:${C.I};font-size:18px">${dd.medianI}</div></div>
        <div class="med"><div class="k">Median · Trenitalia</div><div class="v" style="color:${C.T};font-size:18px">${dd.medianT}</div></div></div>`));
    });

    section(w, 'Travel frequency', 'Share of passengers by travel habit');
    const c6 = card(w, '', '');
    barChart(c6, { w: 1074, h: 250, cats: D.frequency.map((f) => f.k), groups: [{ k: 'Italo', c: C.I, v: D.frequency.map((f) => f.I) }, { k: 'Trenitalia', c: C.T, v: D.frequency.map((f) => f.T) }], yMax: 65, yTickVals: [0, 10, 20, 30, 40, 50, 60], fontSize: 13 });
  }

  // ======================= PAGE 2 =======================
  function page2() {
    secN = 0;
    const w = page(2, 'Home location', 'Traveller home location');
    section(w, 'Home province of Italian travellers', 'Consumer & Business');
    const g = h('<div class="grid2" style="grid-template-columns:470px 1fr"></div>'); w.appendChild(g);
    const cm = card(g, 'Passengers by home province', 'Bubble size = total · split by operator');
    italyBubbleMap(cm, { w: 424, h: 470, points: D.itFull.map((r) => ({ name: r[0], label: r[0] === 'Monza and Brianza' ? 'Monza' : r[0], I: r[1], T: r[2], total: r[3] })), maxR: 30 });
    cm.appendChild(h('<div class="note">Top 13 provinces shown · basemap © Natural Earth</div>'));
    const ct = card(g, 'Split by market segment', 'Market segment / operator / passengers / %');
    const mx = d3.max(D.itSplit, (r) => Math.max(r[1], r[3]));
    let t = `<table class="t sm"><thead><tr><th class="l"></th><th class="grp" colspan="2"><span class="op"><i style="background:${C.T}"></i>Trenitalia</span></th><th class="grp" colspan="2"><span class="op"><i style="background:${C.I}"></i>Italo</span></th></tr>
      <tr><th class="l">Home province</th><th>Passengers</th><th>%</th><th>Passengers</th><th>%</th></tr></thead><tbody>`;
    D.itSplit.forEach((r) => {
      t += `<tr><td class="l">${r[0]}</td><td>${fmt(r[1])}<span class="bar" style="width:${(r[1] / mx) * 60}px;background:${C.T}"></span></td><td>${pc(r[2])}</td>
        <td>${fmt(r[3])}<span class="bar" style="width:${(r[3] / mx) * 60}px;background:${C.I}"></span></td><td>${pc(r[4])}</td></tr>`;
    });
    t += `<tr class="tot"><td class="l">Grand total</td><td>${fmt(D.itSplitTot[0])}</td><td>100%</td><td>${fmt(D.itSplitTot[2])}</td><td>100%</td></tr></tbody></table>`;
    ct.insertAdjacentHTML('beforeend', t);

    const cf = card(w, 'Market share by home province', 'Italo / Trenitalia / grand total / market share');
    cf.style.marginTop = '18px';
    cf.insertAdjacentHTML('beforeend', shareTable('Home province', D.itFull.map((r) => ['', r[0], ...r.slice(1)]), ['', 'Grand total', ...D.itFullTot], false));

    section(w, 'Home country of foreign travellers', 'Roamers');
    const g2 = h('<div class="grid2" style="grid-template-columns:1fr 1fr"></div>'); w.appendChild(g2);
    const cw = card(g2, 'Passengers by home country', 'Total passengers (log scale)');
    worldMap(cw);
    const ct2 = card(g2, 'Split by operator', 'Operator / passengers / %');
    const mx2 = 517763;
    const itTot = D.foreignTot[0];
    let t2 = `<table class="t sm"><thead><tr><th class="l"></th><th class="l"></th><th class="grp" colspan="2"><span class="op"><i style="background:${C.T}"></i>Trenitalia</span></th><th class="grp" colspan="2"><span class="op"><i style="background:${C.I}"></i>Italo</span></th></tr>
      <tr><th class="l">Region</th><th class="l">Country</th><th>Passengers</th><th>%</th><th>Passengers</th><th>%</th></tr></thead><tbody>`;
    D.foreignSplit.forEach((r) => {
      const ip = +(r[4] / itTot * 100).toFixed(2);
      t2 += `<tr><td class="l" style="color:${C.muted};font-size:12px">${r[0]}</td><td class="l">${r[1]}</td><td>${fk(r[2])}<span class="bar" style="width:${Math.max(1, (r[2] / mx2) * 50)}px;background:${C.T}"></span></td><td>${pc2(r[3])}</td>
        <td>${fk(r[4])}<span class="bar" style="width:${Math.max(1, (r[4] / mx2) * 50)}px;background:${C.I}"></span></td><td>${pc2(ip)}</td></tr>`;
    });
    t2 += `<tr class="tot"><td class="l" colspan="2">Grand total</td><td>${fmt(D.foreignSplitTot[0])}</td><td>${D.foreignSplitTot[1]}%</td><td>${fmt(D.foreignSplitTot[2])}</td><td>100%</td></tr></tbody></table>`;
    ct2.insertAdjacentHTML('beforeend', t2);

    const cf2 = card(w, 'Market share by home country', 'Italo / Trenitalia / grand total / market share');
    cf2.style.marginTop = '18px';
    cf2.insertAdjacentHTML('beforeend', shareTable('Country', D.foreign.map((r) => [r[0], r[1], r[3], r[4], r[5], r[6], r[7]]), ['', 'Grand total', ...D.foreignTot], true));
  }

  function shareTable(label, rows, tot, withRegion) {
    let t = `<table class="t"><thead><tr>${withRegion ? '<th class="l">Region</th>' : ''}<th class="l">${label}</th><th>Italo</th><th>Trenitalia</th><th>Grand total</th><th>Market share Italo</th><th>Market share Trenitalia</th><th class="l" style="width:230px">Share split</th></tr></thead><tbody>`;
    let lastReg = null;
    rows.forEach((r) => {
      const reg = r[0] !== lastReg ? r[0] : ''; lastReg = r[0];
      t += `<tr>${withRegion ? `<td class="l" style="color:${C.muted};font-size:12px">${reg}</td>` : ''}<td class="l">${r[1]}</td><td>${fk(r[2])}</td><td>${fk(r[3])}</td><td>${fk(r[4])}</td>
        <td style="color:${C.I};font-weight:600">${pc(r[5])}</td><td style="color:${C.T};font-weight:600">${pc(r[6])}</td>
        <td class="l"><div style="display:flex;height:10px;border-radius:3px;overflow:hidden;width:210px"><div style="width:${r[5]}%;background:${C.I}"></div><div style="width:${r[6]}%;background:${C.T}"></div></div></td></tr>`;
    });
    t += `<tr class="tot">${withRegion ? '<td class="l"></td>' : ''}<td class="l">${tot[1]}</td><td>${fmt(tot[2])}</td><td>${fmt(tot[3])}</td><td>${fmt(tot[4])}</td><td>${pc(tot[5])}</td><td>${pc(tot[6])}</td>
      <td class="l"><div style="display:flex;height:10px;border-radius:3px;overflow:hidden;width:210px"><div style="width:${tot[5]}%;background:${C.I}"></div><div style="width:${tot[6]}%;background:${C.T}"></div></div></td></tr></tbody></table>`;
    return t;
  }

  function worldMap(parent) {
    const W = 520, H = 330;
    const s = svg(parent, W, H);
    const nameMap = { USA: 'United States of America', 'Dominican Rep.': 'Dominican Rep.' };
    const vals = new Map(D.foreign.map((r) => [nameMap[r[1]] || r[1], r[5]]));
    const feats = countries.features.filter((f) => f.properties.name !== 'Antarctica');
    const proj = d3.geoNaturalEarth1().fitExtent([[4, 4], [W - 4, H - 4]], { type: 'FeatureCollection', features: feats });
    const path = d3.geoPath(proj);
    const col = d3.scaleSequentialLog(d3.interpolateRgb('#DCE7FD', '#173E94')).domain([3, 730000]);
    s.append('g').selectAll('path').data(feats).join('path').attr('d', path)
      .attr('fill', (f) => (f.properties.name === 'Italy' ? C.ink : vals.has(f.properties.name) ? col(vals.get(f.properties.name)) : '#EFEFEF'))
      .attr('stroke', '#fff').attr('stroke-width', 0.4);
    // legend
    const lg = h(`<div style="display:flex;align-items:center;gap:8px;font-size:11px" class="mono"><span>3</span><span style="width:160px;height:8px;border-radius:4px;background:linear-gradient(90deg,#DCE7FD,#173E94)"></span><span>729,996</span>
      <span style="margin-left:14px"><i class="sw" style="background:${C.ink}"></i>Italy</span><span><i class="sw" style="background:#EFEFEF;border:1px solid #ddd"></i>Not in top markets</span></div>`);
    parent.appendChild(lg);
  }

  // ======================= PAGE 3 =======================
  function page3() {
    secN = 0;
    const w = page(3, 'Origins & destinations', 'Origins & destinations');
    w.appendChild(h('<div style="margin-top:22px"><span class="chip">Operator: <b>Italo, Trenitalia</b></span></div>'));
    const blocks = [
      { t: 'Origin before departure', pts: D.originTot, routes: D.routesOrigin, rTot: D.routesOriginTot, rN: D.routesOriginN, tot: D.originTot, totT: D.originTotTot, pct: D.originPct },
      { t: 'Destination after arrival', pts: D.destTot, routes: D.routesDest, rTot: D.routesDestTot, rN: D.routesDestN, tot: D.destTot, totT: D.destTotTot, pct: D.destPct },
    ];
    const titles = h('<div class="grid2"></div>'); w.appendChild(titles);
    blocks.forEach((b, i) => {
      secN = i; const holder = h('<div></div>'); titles.appendChild(holder);
      section(holder, b.t);
      const c = card(holder, 'Province distribution', 'Bubble size = share of passengers · split by operator');
      italyBubbleMap(c, { w: 512, h: 470, points: b.pts.map((r) => ({ name: r[0], label: r[0] === 'Monza and Brianza' ? 'Monza' : r[0], T: r[1], I: r[2], total: r[3] })), maxR: 32 });
      c.appendChild(h('<div class="note">Top 13 provinces shown · basemap © Natural Earth</div>'));
    });
    const g2 = h('<div class="grid2" style="margin-top:18px"></div>'); w.appendChild(g2);
    blocks.forEach((b) => {
      const c = card(g2, 'Top routes', 'Route / province / municipality / operator / segment / passengers');
      let t = `<table class="t sm" style="font-size:11.5px"><thead><tr><th class="l">#</th><th class="l">Route</th><th class="l">Province</th><th class="l">Municipality</th><th class="l">Operator</th><th class="l">Segment</th><th>Passengers</th></tr></thead><tbody>`;
      b.routes.forEach((r, i) => { t += `<tr><td class="l mono" style="color:${C.muted}">${i + 1}</td><td class="l">${r[0]}</td><td class="l">${r[1]}</td><td class="l">${r[2]}</td><td class="l">${opDot(r[3])}</td><td class="l">${r[4]}</td><td>${fmt(r[5])}</td></tr>`; });
      t += `<tr class="tot"><td class="l" colspan="6">Grand total</td><td>${fmt(b.rTot)}</td></tr></tbody></table><div class="note" style="text-align:right">Rows 1–100 of ${fmt(b.rN)} · top 13 shown</div>`;
      c.insertAdjacentHTML('beforeend', t);
    });
    const g3 = h('<div class="grid2" style="margin-top:18px"></div>'); w.appendChild(g3);
    blocks.forEach((b) => {
      const c = card(g3, 'Operator / passengers', '% of grand total');
      const colT = d3.scaleSequential(d3.interpolateRgb('#F1F6FF', '#1F4FB5')).domain([0, 16]);
      const colI = d3.scaleSequential(d3.interpolateRgb('#FFF4F8', '#A8285E')).domain([0, 16]);
      c.insertAdjacentHTML('beforeend', pctHeat(b.tot, ['Trenitalia', 'Italo', 'Grand total'], [colT, colI, null], b.totT));
    });
    const g4 = h('<div class="grid2" style="margin-top:18px"></div>'); w.appendChild(g4);
    blocks.forEach((b) => {
      const c = card(g4, 'Operator / passengers %', '% within each operator');
      const colT = d3.scaleSequential(d3.interpolateRgb('#F1F6FF', '#1F4FB5')).domain([0, 26]);
      const colI = d3.scaleSequential(d3.interpolateRgb('#FFF4F8', '#A8285E')).domain([0, 26]);
      c.insertAdjacentHTML('beforeend', pctHeat(b.pct, ['Trenitalia', 'Italo'], [colT, colI], [100, 100]));
    });
  }

  function pctHeat(rows, cols, scales, tot) {
    const lum = (c) => { const r = d3.rgb(c); return 0.2126 * r.r + 0.7152 * r.g + 0.0722 * r.b; };
    let t = `<table class="t heat"><thead><tr><th class="l">Province</th>${cols.map((c) => `<th style="text-align:center">${c}</th>`).join('')}</tr></thead><tbody>`;
    rows.forEach((r) => {
      t += `<tr><td class="l">${r[0]}</td>${cols.map((_, j) => {
        const v = r[j + 1];
        if (!scales[j]) return `<td style="font-weight:600">${pc(v)}</td>`;
        const bg = scales[j](v); return `<td class="c" style="background:${bg};color:${lum(bg) < 150 ? '#fff' : C.ink}">${pc(v)}</td>`;
      }).join('')}</tr>`;
    });
    t += `<tr class="tot"><td class="l">Grand total</td>${tot.map((v) => `<td style="text-align:${tot.length === 3 && v === 100 ? 'right' : 'center'}">${pc(v)}</td>`).join('')}</tr></tbody></table>`;
    return t;
  }

  // ======================= PAGE 4 =======================
  function page4() {
    secN = 0;
    const w = page(4, 'Socio-demographics', 'Socio-demographic profile');
    const palI = ['#D24682', '#E07FA8', '#EDB3CB', '#F8DCE8'];
    const palT = ['#4682F5', '#7EA7F8', '#B3CCFB', '#DDE8FD'];
    const pies = [
      ['Residence', D.residence], ['Gender', D.gender], ['Market segment', D.segment], ['Nationality (nationals)', D.nationality],
    ];
    for (let k = 0; k < pies.length; k += 2) {
      const g = h('<div class="grid2"></div>'); w.appendChild(g);
      pies.slice(k, k + 2).forEach(([title, d]) => {
        const holder = h('<div></div>'); g.appendChild(holder);
        section(holder, title);
        const inner = h('<div class="grid2" style="gap:14px"></div>'); holder.appendChild(inner);
        [['Italo', d.I, palI, C.I], ['Trenitalia', d.T, palT, C.T]].forEach(([op, vals, pal, oc]) => {
          const c = card(inner, '', '');
          c.appendChild(h(`<div class="opcard-h"><span class="optag" style="background:${oc}">${op}</span></div>`));
          const box = h('<div style="display:flex;justify-content:center;padding:6px 0"></div>'); c.appendChild(box);
          const show = d.show ?? vals.length;
          donut(box, vals.map((v, i) => ({ v, c: pal[i], label: i < show ? `${v}%` : '', tc: i === 0 ? '#fff' : C.ink })), 190, 0.5);
          c.appendChild(h(`<div style="display:flex;flex-wrap:wrap;gap:6px 14px;justify-content:center;font-size:12px">${d.labels.map((l, i) => `<span><i class="sw" style="background:${pal[i]}"></i>${l}</span>`).join('')}</div>`));
        });
      });
    }
    const g = h('<div class="grid2"></div>'); w.appendChild(g);
    [['Age', D.age, 30, [0, 10, 20, 30]], ['Spending bracket', D.spending, 45, [0, 20, 40]]].forEach(([title, d, ymax, ticks]) => {
      const holder = h('<div></div>'); g.appendChild(holder);
      section(holder, title, 'Unique passengers');
      const inner = h('<div class="grid2" style="gap:14px"></div>'); holder.appendChild(inner);
      [['Italo', d.I, C.I], ['Trenitalia', d.T, C.T]].forEach(([op, vals, oc]) => {
        const c = card(inner, '', '');
        c.appendChild(h(`<div class="opcard-h"><span class="optag" style="background:${oc}">${op}</span></div>`));
        barChart(c, { w: c.clientWidth - 44, h: 240, cats: d.labels, groups: [{ k: op, c: oc, v: vals }], yMax: ymax * 1.08, yTickVals: ticks, m: { t: 22, r: 4, b: 40, l: 34 }, fontSize: 9.5, stagger: true });
      });
    });
  }

  const want = (location.hash || '').replace('#', '');
  const pages = { 1: page1, 2: page2, 3: page3, 4: page4 };
  if (want && pages[want]) pages[want](); else Object.values(pages).forEach((f) => f());
  document.fonts.ready.then(() => { document.body.dataset.ready = '1'; });
})();
