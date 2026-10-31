import { constants } from 'node:fs';
import { mkdir, open, rename, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { gzip, gunzip } from 'node:zlib';
import { isSupportedGeometry } from '../../shared/municipal-boundaries/geometry-validation';
import type { RecifeStreet } from '../../shared/recife-geometry/recife-geometry.types';
import type { Geometry } from 'geojson';

const compress = promisify(gzip);
const decompress = promisify(gunzip);
const TTL = 24 * 60 * 60 * 1000;
const MAX_COMPRESSED = 8_000_000;
const MAX_JSON = 18_000_000;

/** Public data only: bounded, validated, versioned and replaceable cache. */
export class RecifeStreetCache {
  private readonly target: string;
  constructor(directory: string, private readonly now = () => Date.now()) { this.target = join(directory, 'recife-streets-v1.json.gz'); }

  async read(): Promise<{ items: RecifeStreet[]; expires: number } | null> {
    try {
      const file = await open(this.target, constants.O_RDONLY | constants.O_NOFOLLOW);
      let compressed: Buffer;
      try {
        const stat = await file.stat();
        if (!stat.isFile() || stat.size <= 0 || stat.size > MAX_COMPRESSED) return null;
        compressed = Buffer.alloc(stat.size);
        let offset = 0;
        while (offset < compressed.length) {
          const { bytesRead } = await file.read(compressed, offset, compressed.length - offset, offset);
          if (!bytesRead) return null;
          offset += bytesRead;
        }
      } finally { await file.close(); }
      const bytes = await decompress(compressed, { maxOutputLength: MAX_JSON });
      const data: unknown = JSON.parse(bytes.toString('utf8'));
      if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
      const value = data as Record<string, unknown>;
      if (value.version !== 1 || typeof value.savedAt !== 'number' || !Number.isFinite(value.savedAt) || value.savedAt > this.now() || value.savedAt + TTL <= this.now() || !Array.isArray(value.items) || !value.items.length || value.items.length > 25_000) return null;
      const items: RecifeStreet[] = [];
      for (const item of value.items) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
        const row = item as Record<string, unknown>;
        if (typeof row.code !== 'string' || !/^\d{1,8}$/.test(row.code) || Number(row.code) <= 0 || typeof row.name !== 'string' || !row.name.trim() || row.name.length > 200 || row.version !== '2026-03-02' || !row.geometry || typeof row.geometry !== 'object' || !('type' in row.geometry) || !['LineString', 'MultiLineString'].includes(String(row.geometry.type)) || !isSupportedGeometry(row.geometry as Geometry)) return null;
        items.push(row as unknown as RecifeStreet);
      }
      return { items, expires: value.savedAt + TTL };
    } catch { return null; }
  }

  async write(items: RecifeStreet[]): Promise<void> {
    const serialized = Buffer.from(JSON.stringify({ version: 1, savedAt: this.now(), items }));
    if (serialized.length > MAX_JSON) return;
    const compressed = await compress(serialized);
    if (compressed.length > MAX_COMPRESSED) return;
    const directory = dirname(this.target);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const temporary = `${this.target}.${randomUUID()}.tmp`;
    try {
      const file = await open(temporary, 'wx', 0o600);
      try { await file.writeFile(compressed); } finally { await file.close(); }
      await rename(temporary, this.target);
    } finally { await unlink(temporary).catch((): void => { /* Best-effort cleanup. */ }); }
  }
}
