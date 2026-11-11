import type { Project } from './types';

/** link di condivisione: il progetto compresso (deflate) e codificato in base64url nell'hash */
const b64url = (buf: Uint8Array) => {
  let s = '';
  for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64url = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const res = new Response(new Blob([data]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}

export async function encodeProject(p: Project): Promise<string> {
  const { background: _bg, ...rest } = p; // l'immagine di sfondo non entra nel link
  const json = new TextEncoder().encode(JSON.stringify(rest));
  if (typeof CompressionStream === 'undefined') return `j${b64url(json)}`;
  return `z${b64url(await pipe(json, new CompressionStream('deflate-raw')))}`;
}

export async function decodeProject(s: string): Promise<Project> {
  const kind = s[0];
  const bytes = fromB64url(s.slice(1));
  const raw = kind === 'z' ? await pipe(bytes, new DecompressionStream('deflate-raw')) : bytes;
  const p = JSON.parse(new TextDecoder().decode(raw)) as Project;
  if (p.version !== 1 || !Array.isArray(p.walls)) throw new Error('progetto non valido');
  return p;
}
