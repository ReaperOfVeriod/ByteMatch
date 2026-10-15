/**
 * Keeps the output of CPU-heavy renders (PNG badges, social cards) in memory, keyed by everything
 * that goes into them, so the same picture isn't drawn again for every request. Drawing one takes
 * tens to hundreds of milliseconds of CPU, and the web process can't answer anything else meanwhile.
 * A small least-recently-used map per kind; each process has its own.
 */
export class RenderCache<V> {
  private map = new Map<string, V>();
  constructor(private readonly max: number) {}

  get(key: string): V | undefined {
    const v = this.map.get(key);
    if (v !== undefined) {
      // Refresh its place as most recently used.
      this.map.delete(key);
      this.map.set(key, v);
    }
    return v;
  }

  set(key: string, value: V) {
    this.map.delete(key);
    this.map.set(key, value);
    while (this.map.size > this.max) this.map.delete(this.map.keys().next().value!);
  }

  /** The cached value, or render it once and keep it. */
  async getOrRender(key: string, render: () => Promise<V> | V): Promise<V> {
    const hit = this.get(key);
    if (hit !== undefined) return hit;
    const v = await render();
    this.set(key, v);
    return v;
  }
}

/** Social cards change only when a project's numbers do; crawlers and link previews may keep them an hour. */
export const SOCIAL_IMAGE_CACHE = "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400";
