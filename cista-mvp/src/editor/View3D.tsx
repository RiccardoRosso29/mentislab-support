import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Fixture, Item, Project, Room } from '../model/types';
import { useStore } from '../model/store';
import { defOf, type Part } from '../model/furniture';
import { roomPolygon, solidSpans, wallGeom, openingsOf } from '../model/project';
import { labelPoint } from '../model/geometry';

const M = 0.01; // cm → m

const FLOOR_COL: Record<Room['floor'], string> = {
  parquet: '#b9875e',
  gres: '#9b9792',
  'tiles-warm': '#d38a3c',
  'tiles-light': '#dfe3e5',
  concrete: '#b7b2aa',
};

function floorTexture(kind: Room['floor']) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const base = FLOOR_COL[kind];
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  if (kind === 'parquet') {
    for (let r = 0; r < 8; r++) {
      let x = -rnd() * 128;
      while (x < 256) {
        g.fillStyle = `hsla(25 40% ${38 + rnd() * 14}% / .55)`;
        g.fillRect(x, r * 32, 128, 32);
        g.fillStyle = 'rgba(40,20,8,.35)';
        g.fillRect(x, r * 32, 1.5, 32);
        x += 128;
      }
      g.fillStyle = 'rgba(40,20,8,.3)';
      g.fillRect(0, r * 32, 256, 1.2);
    }
  } else if (kind !== 'concrete') {
    const n = kind === 'tiles-light' ? 4 : 2;
    g.fillStyle = 'rgba(255,255,255,.55)';
    for (let i = 0; i <= n; i++) {
      g.fillRect((i * 256) / n - 1.5, 0, 3, 256);
      g.fillRect(0, (i * 256) / n - 1.5, 256, 3);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const MATS: Record<Exclude<Part['mat'], 'main' | 'cushion'>, THREE.MeshStandardMaterialParameters> = {
  wood: { color: '#b98f5d', roughness: 0.6 },
  metal: { color: '#c3c6c8', roughness: 0.3, metalness: 0.7 },
  white: { color: '#f2f1ec', roughness: 0.5 },
  dark: { color: '#2a2d31', roughness: 0.4 },
  glass: { color: '#cfe3ee', roughness: 0.05, transparent: true, opacity: 0.35 },
  ceramic: { color: '#fbfbf9', roughness: 0.15 },
  linen: { color: '#efece6', roughness: 0.95 },
  screen: { color: '#0c0e12', roughness: 0.1 },
  green: { color: '#6f8f47', roughness: 0.9 },
};

function partMaterial(p: Part, color: string) {
  if (p.mat === 'main') return { color, roughness: 0.75 };
  if (p.mat === 'cushion') return { color: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.15), roughness: 0.95 };
  return MATS[p.mat];
}

function ItemMesh({ it, selected }: { it: Item; selected: boolean }) {
  const def = defOf(it.type);
  const parts = useMemo(() => def.parts(it), [it, def]);
  const color = it.color ?? def.color;
  const { select, set } = useStore.getState();
  return (
    <group
      position={[it.x * M, (it.z ?? 0) * M, it.y * M]}
      rotation={[0, (-it.rot * Math.PI) / 180, 0]}
      onClick={(e) => {
        e.stopPropagation();
        select({ kind: 'item', id: it.id });
        set({ panel: 'inspector' });
      }}
    >
      {parts.map((p, i) => (
        <mesh key={i} position={[p.x * M, (p.z + p.h / 2) * M, p.y * M]} castShadow receiveShadow>
          {p.shape === 'cyl' ? <cylinderGeometry args={[(p.w / 2) * M, (p.w / 2) * M, p.h * M, 24]} /> : <boxGeometry args={[p.w * M, p.h * M, p.d * M]} />}
          <meshStandardMaterial {...partMaterial(p, color)} />
        </mesh>
      ))}
      {selected && (
        <lineSegments position={[0, (it.h / 2) * M, 0]}>
          <edgesGeometry args={[new THREE.BoxGeometry(it.w * M + 0.02, it.h * M + 0.02, it.d * M + 0.02)]} />
          <lineBasicMaterial color="#2453c7" />
        </lineSegments>
      )}
    </group>
  );
}

function FixtureMesh({ f, low }: { f: Fixture; low: boolean }) {
  const z1 = low ? Math.min(f.z1, 110) : f.z1;
  if (f.z0 >= z1 || f.kind === 'outlet') {
    if (f.kind !== 'outlet') return null;
  }
  const col =
    f.kind === 'radiator' ? '#f4f4f2' : f.kind === 'kitchen' ? '#b4c21c' : f.kind === 'pillar' ? '#f3f2ef' : f.kind === 'outlet' ? '#ffffff' : f.kind === 'closet' ? '#f5f5f2' : '#e7e8e6';
  const h = Math.max(1, z1 - f.z0);
  return (
    <group position={[f.x * M, 0, f.y * M]} rotation={[0, (-f.rot * Math.PI) / 180, 0]}>
      <mesh position={[0, (f.z0 + h / 2) * M, 0]} castShadow receiveShadow>
        <boxGeometry args={[f.w * M, h * M, Math.max(f.d, 1) * M]} />
        <meshStandardMaterial color={col} roughness={0.6} />
      </mesh>
      {f.kind === 'kitchen' && !low && (
        <mesh position={[0, (f.z1 + 2) * M, 0]} receiveShadow>
          <boxGeometry args={[f.w * M, 0.04, f.d * M + 0.02]} />
          <meshStandardMaterial color="#f4f3ef" roughness={0.3} />
        </mesh>
      )}
      {f.kind === 'closet' &&
        Array.from({ length: Math.max(1, Math.round(f.w / 50)) - 1 }, (_, k) => (
          <mesh key={k} position={[(-f.w / 2 + ((k + 1) * f.w) / Math.max(1, Math.round(f.w / 50))) * M, (h / 2) * M, (f.d / 2 + 0.3) * M]}>
            <boxGeometry args={[0.004, h * M * 0.98, 0.004]} />
            <meshStandardMaterial color="#9aa0a4" />
          </mesh>
        ))}
    </group>
  );
}

function Walls({ p, low }: { p: Project; low: boolean }) {
  const wallMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f3f2ef', roughness: 0.9 }), []);
  const frameMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2b3035', roughness: 0.5 }), []);
  const glassMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d8e8f0', transparent: true, opacity: 0.25, roughness: 0 }), []);
  const doorMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f4f3ef', roughness: 0.5 }), []);
  const cut = (h: number) => (low ? Math.min(h, 110) : h);
  return (
    <group>
      {p.walls.map((w) => {
        const g = wallGeom(p, w);
        const ang = -Math.atan2(g.dir.y, g.dir.x);
        const box = (s0: number, s1: number, z0: number, z1: number, mat: THREE.Material, t = w.thickness, key = '') => {
          const zt = cut(z1);
          if (zt - z0 < 0.5 || s1 - s0 < 0.2) return null;
          const c = { x: g.a.x + g.dir.x * ((s0 + s1) / 2), y: g.a.y + g.dir.y * ((s0 + s1) / 2) };
          return (
            <mesh key={key} position={[c.x * M, ((z0 + zt) / 2) * M, c.y * M]} rotation={[0, ang, 0]} material={mat} castShadow receiveShadow>
              <boxGeometry args={[(s1 - s0) * M, (zt - z0) * M, t * M]} />
            </mesh>
          );
        };
        return (
          <group key={w.id}>
            {solidSpans(p, w).map((s, i) => box(s.s0, s.s1, 0, w.height, wallMat, w.thickness, `s${i}`))}
            {openingsOf(p, w.id).map((o) => {
              const s0 = o.offset - o.width / 2;
              const s1 = o.offset + o.width / 2;
              const top = o.kind === 'gap' ? o.height : o.sill + o.height;
              const parts = [box(s0, s1, top, w.height, wallMat, w.thickness, 'lintel')];
              if (o.kind === 'window' || o.kind === 'window-fixed') {
                parts.push(box(s0, s1, 0, o.sill, wallMat, w.thickness, 'sill'));
                parts.push(box(s0, s1, o.sill, o.sill + 5, frameMat, 6, 'fb'));
                parts.push(box(s0, s1, top - 5, top, frameMat, 6, 'ft'));
                parts.push(box(s0, s0 + 5, o.sill, top, frameMat, 6, 'fl'));
                parts.push(box(s1 - 5, s1, o.sill, top, frameMat, 6, 'fr'));
                parts.push(box(s0 + 5, s1 - 5, o.sill + 5, top - 5, glassMat, 1, 'g'));
              } else if (o.kind === 'door' && !low) {
                // anta aperta a 75° verso il lato di apertura
                const hs = o.hinge === 'end' ? s1 : s0;
                const sign = o.hinge === 'end' ? -1 : 1;
                const hx = g.a.x + g.dir.x * hs + g.n.x * g.half * o.side;
                const hy = g.a.y + g.dir.y * hs + g.n.y * g.half * o.side;
                const a = (75 * Math.PI) / 180;
                const dx = g.dir.x * sign * Math.cos(a) + g.n.x * o.side * Math.sin(a);
                const dy = g.dir.y * sign * Math.cos(a) + g.n.y * o.side * Math.sin(a);
                const len = o.width - 6;
                parts.push(
                  <mesh key="leaf" position={[(hx + (dx * len) / 2) * M, (o.height / 2) * M, (hy + (dy * len) / 2) * M]} rotation={[0, -Math.atan2(dy, dx), 0]} material={doorMat} castShadow>
                    <boxGeometry args={[len * M, (o.height - 2) * M, 0.04]} />
                  </mesh>,
                );
              } else if (o.kind === 'sliding') {
                parts.push(box(s0, o.offset + 3, 0, o.height, doorMat, 4, 'sl1'));
              }
              return <group key={o.id}>{parts}</group>;
            })}
          </group>
        );
      })}
    </group>
  );
}

function Floors({ p }: { p: Project }) {
  const tex = useMemo(() => {
    const kinds: Room['floor'][] = ['parquet', 'gres', 'tiles-warm', 'tiles-light', 'concrete'];
    return Object.fromEntries(kinds.map((k) => [k, floorTexture(k)])) as unknown as Record<Room['floor'], THREE.Texture>;
  }, []);
  return (
    <group>
      {p.rooms.map((r) => {
        const poly = roomPolygon(p, r);
        if (poly.length < 3) return null;
        const shape = new THREE.Shape(poly.map((q) => new THREE.Vector2(q.x * M, q.y * M)));
        const geo = new THREE.ShapeGeometry(shape);
        // UV in metri: una ripetizione della texture ogni 1,6 m (parquet) o 0,9 m (piastrelle)
        const rep = r.floor === 'parquet' ? 1.6 : 0.9;
        const pos = geo.attributes.position;
        const uv = geo.attributes.uv;
        for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / rep, pos.getY(i) / rep);
        return (
          <mesh key={r.id} geometry={geo} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.002, 0]} receiveShadow>
            <meshStandardMaterial map={tex[r.floor]} roughness={0.7} side={THREE.DoubleSide} />
          </mesh>
        );
      })}
    </group>
  );
}

function Controls({ center, span }: { center: THREE.Vector3; span: number }) {
  const cam = useStore((s) => s.cam);
  const sel = useStore((s) => s.sel);
  const project = useStore((s) => s.project);
  const { camera, gl, invalidate } = useThree();
  const ctl = useRef<OrbitControls>();
  const keys = useRef(new Set<string>());
  const look = useRef({ yaw: 0, pitch: 0 });

  useEffect(() => {
    const c = new OrbitControls(camera, gl.domElement);
    c.enableDamping = true;
    c.dampingFactor = 0.1;
    c.addEventListener('change', () => invalidate());
    ctl.current = c;
    return () => c.dispose();
  }, [camera, gl, invalidate]);

  useEffect(() => {
    const c = ctl.current!;
    if (cam === 'walk') {
      c.enabled = false;
      // parte dal centro della stanza selezionata o di quella con il mobile selezionato
      let start = center.clone();
      const room =
        sel?.kind === 'room'
          ? project.rooms.find((r) => r.id === sel.id)
          : sel?.kind === 'item'
            ? project.rooms.find((r) => {
                const it = project.items.find((i) => i.id === sel.id);
                if (!it) return false;
                const poly = roomPolygon(project, r);
                return poly.length > 2 && insidePoly(it, poly);
              })
            : undefined;
      if (room) {
        const lp = labelPoint(roomPolygon(project, room));
        start = new THREE.Vector3(lp.x * M, 0, lp.y * M);
      }
      camera.position.set(start.x, 1.6, start.z);
      look.current = { yaw: 0, pitch: -0.05 };
      (camera as THREE.PerspectiveCamera).fov = 70;
    } else {
      c.enabled = true;
      (camera as THREE.PerspectiveCamera).fov = 40;
      c.target.copy(center);
      const d = Math.max(span, 7);
      if (cam === 'top') camera.position.set(center.x, d * 1.6, center.z + 0.01);
      else camera.position.set(center.x + d * 0.5, d * 0.95, center.z + d * 0.9);
      c.update();
    }
    (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
    invalidate();
  }, [cam, center, span]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (cam !== 'walk') return;
    const el = gl.domElement;
    let last: { x: number; y: number } | null = null;
    const down = (e: PointerEvent) => (last = { x: e.clientX, y: e.clientY });
    const move = (e: PointerEvent) => {
      if (!last) return;
      look.current.yaw -= (e.clientX - last.x) * 0.005;
      look.current.pitch = Math.max(-1.2, Math.min(1.2, look.current.pitch - (e.clientY - last.y) * 0.005));
      last = { x: e.clientX, y: e.clientY };
      invalidate();
    };
    const up = () => (last = null);
    const kd = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      keys.current.add(e.key.toLowerCase());
      invalidate();
    };
    const ku = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const pad = (e: Event) => {
      const k = (e as CustomEvent<string>).detail;
      keys.current.add(k);
      setTimeout(() => keys.current.delete(k), 220);
      invalidate();
    };
    el.addEventListener('pointerdown', down);
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
    addEventListener('keydown', kd);
    addEventListener('keyup', ku);
    addEventListener('cista-walk', pad);
    return () => {
      el.removeEventListener('pointerdown', down);
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      removeEventListener('keydown', kd);
      removeEventListener('keyup', ku);
      removeEventListener('cista-walk', pad);
    };
  }, [cam, gl, invalidate]);

  useFrame((_, dt) => {
    if (cam === 'walk') {
      const k = keys.current;
      const fwd = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0);
      const side = (k.has('d') ? 1 : 0) - (k.has('a') ? 1 : 0);
      const turn = (k.has('arrowleft') ? 1 : 0) - (k.has('arrowright') ? 1 : 0);
      look.current.yaw += turn * dt * 1.6;
      const sp = 1.4 * Math.min(dt, 0.05);
      const { yaw, pitch } = look.current;
      camera.position.x += (-Math.sin(yaw) * fwd + Math.cos(yaw) * side) * sp;
      camera.position.z += (-Math.cos(yaw) * fwd - Math.sin(yaw) * side) * sp;
      camera.rotation.set(pitch, yaw, 0, 'YXZ');
      if (fwd || side || turn) invalidate();
    } else ctl.current?.update();
  });
  return null;
}

function insidePoly(pt: { x: number; y: number }, poly: { x: number; y: number }[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export default function View3D() {
  const project = useStore((s) => s.project);
  const sel = useStore((s) => s.sel);
  const low = useStore((s) => s.lowWalls);
  const cam = useStore((s) => s.cam);
  const { center, span } = useMemo(() => {
    const xs = project.nodes.map((n) => n.x);
    const ys = project.nodes.map((n) => n.y);
    if (!xs.length) return { center: new THREE.Vector3(4, 0, 3), span: 10 };
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    return { center: new THREE.Vector3(((x0 + x1) / 2) * M, 0, ((y0 + y1) / 2) * M), span: Math.max(x1 - x0, y1 - y0) * M };
  }, [project.id, project.nodes.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="three" data-testid="view3d">
      <Canvas shadows frameloop="demand" camera={{ fov: 40, near: 0.05, far: 200, position: [8, 8, 12] }} onPointerMissed={() => cam !== 'walk' && useStore.getState().select(null)} gl={{ preserveDrawingBuffer: true }}>
        <color attach="background" args={[cam === 'walk' ? '#dfe6ec' : '#e9ecee']} />
        <hemisphereLight args={['#fffaf2', '#a89c8c', 0.9]} />
        <directionalLight position={[center.x + 6, 12, center.z + 8]} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12} />
        <ambientLight intensity={0.25} />
        <Floors p={project} />
        <Walls p={project} low={low} />
        {project.fixtures.map((f) => (
          <FixtureMesh key={f.id} f={f} low={low} />
        ))}
        {project.items.map((it) => (
          <ItemMesh key={it.id} it={it} selected={sel?.kind === 'item' && sel.id === it.id} />
        ))}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[center.x, -0.01, center.z]} receiveShadow>
          <planeGeometry args={[60, 60]} />
          <shadowMaterial opacity={0.15} />
        </mesh>
        <Controls center={center} span={span} />
      </Canvas>
      {cam === 'walk' && (
        <div className="walkpad" aria-label="Muoviti">
          <span />
          <button onPointerDown={() => dispatchEvent(new CustomEvent('cista-walk', { detail: 'w' }))} aria-label="Avanti">
            ▲
          </button>
          <span />
          <button onPointerDown={() => dispatchEvent(new CustomEvent('cista-walk', { detail: 'arrowleft' }))} aria-label="Gira a sinistra">
            ⟲
          </button>
          <button onPointerDown={() => dispatchEvent(new CustomEvent('cista-walk', { detail: 's' }))} aria-label="Indietro">
            ▼
          </button>
          <button onPointerDown={() => dispatchEvent(new CustomEvent('cista-walk', { detail: 'arrowright' }))} aria-label="Gira a destra">
            ⟳
          </button>
        </div>
      )}
    </div>
  );
}
