/**
 * Squarified treemap layout (Bruls, Huizing & van Wijk, 2000): lays rectangles with areas
 * proportional to their values into a W×H box, keeping them as close to square as it can.
 */

export interface Rect<T> {
  item: T;
  x: number;
  y: number;
  w: number;
  h: number;
}

function worst(row: number[], side: number): number {
  const sum = row.reduce((a, b) => a + b, 0);
  const max = Math.max(...row);
  const min = Math.min(...row);
  const s2 = side * side;
  const sum2 = sum * sum;
  return Math.max((s2 * max) / sum2, sum2 / (s2 * min));
}

export function squarify<T>(items: T[], value: (t: T) => number, width: number, height: number): Rect<T>[] {
  const nodes = items.map((item) => ({ item, v: Math.max(0, value(item)) })).filter((n) => n.v > 0);
  nodes.sort((a, b) => b.v - a.v);
  const total = nodes.reduce((a, n) => a + n.v, 0);
  if (total === 0 || width <= 0 || height <= 0) return [];
  const scale = (width * height) / total;
  const areas = nodes.map((n) => n.v * scale);

  const out: Rect<T>[] = [];
  let x = 0;
  let y = 0;
  let w = width;
  let h = height;
  let i = 0;
  while (i < areas.length) {
    const side = Math.min(w, h);
    const row = [areas[i]];
    let j = i + 1;
    while (j < areas.length && worst([...row, areas[j]], side) <= worst(row, side)) {
      row.push(areas[j]);
      j++;
    }
    const rowSum = row.reduce((a, b) => a + b, 0);
    if (w >= h) {
      // Lay the row as a column on the left.
      const colW = rowSum / h;
      let cy = y;
      for (let k = 0; k < row.length; k++) {
        const rh = row[k] / colW;
        out.push({ item: nodes[i + k].item, x, y: cy, w: colW, h: rh });
        cy += rh;
      }
      x += colW;
      w -= colW;
    } else {
      // Lay the row along the top.
      const rowH = rowSum / w;
      let cx = x;
      for (let k = 0; k < row.length; k++) {
        const rw = row[k] / rowH;
        out.push({ item: nodes[i + k].item, x: cx, y, w: rw, h: rowH });
        cx += rw;
      }
      y += rowH;
      h -= rowH;
    }
    i = j;
  }
  return out;
}

/**
 * Order-preserving treemap: splits the list where the running total is closest to half, cuts the
 * box along its longer side, and recurses. Neighbours in the list stay neighbours on screen, at
 * the cost of less square tiles than squarify.
 */
export function ordered<T>(items: T[], value: (t: T) => number, width: number, height: number, x0 = 0, y0 = 0): Rect<T>[] {
  const nodes = items.map((item) => ({ item, v: Math.max(0, value(item)) })).filter((n) => n.v > 0);
  const out: Rect<T>[] = [];
  const place = (lo: number, hi: number, x: number, y: number, w: number, h: number) => {
    if (hi - lo === 1) {
      out.push({ item: nodes[lo].item, x, y, w, h });
      return;
    }
    let total = 0;
    for (let i = lo; i < hi; i++) total += nodes[i].v;
    // The split whose left part is closest to half of the total.
    let acc = 0;
    let split = lo + 1;
    let best = Infinity;
    for (let i = lo; i < hi - 1; i++) {
      acc += nodes[i].v;
      const d = Math.abs(acc - total / 2);
      if (d < best) {
        best = d;
        split = i + 1;
      }
    }
    let left = 0;
    for (let i = lo; i < split; i++) left += nodes[i].v;
    const r = left / total;
    if (w >= h) {
      place(lo, split, x, y, w * r, h);
      place(split, hi, x + w * r, y, w * (1 - r), h);
    } else {
      place(lo, split, x, y, w, h * r);
      place(split, hi, x, y + h * r, w, h * (1 - r));
    }
  };
  if (nodes.length && width > 0 && height > 0) place(0, nodes.length, x0, y0, width, height);
  return out;
}

interface Group<T> {
  key: string;
  items: T[];
  children: Group<T>[];
  value: number;
}

/**
 * Groups items by their path ("core/math/vec.c" → core → math), keeping first-seen order, then
 * lays groups out with `ordered` and recurses into each group's box. GROUPS returns each group's
 * box too, so the caller can outline them.
 */
export function grouped<T>(
  items: T[],
  path: (t: T) => string,
  value: (t: T) => number,
  width: number,
  height: number,
): { tiles: Rect<T>[]; groups: Rect<string>[] } {
  const build = (list: T[], depth: number, key: string): Group<T> => {
    const leaves: T[] = [];
    const byName = new Map<string, T[]>();
    const order: (string | T)[] = [];
    for (const t of list) {
      const parts = path(t).split("/");
      if (parts.length - 1 <= depth) {
        leaves.push(t);
        order.push(t);
        continue;
      }
      const seg = parts[depth];
      if (!byName.has(seg)) {
        byName.set(seg, []);
        order.push(seg);
      }
      byName.get(seg)!.push(t);
    }
    // A single sub-folder with nothing beside it adds no information: flatten it.
    if (leaves.length === 0 && byName.size === 1) {
      const [[seg, only]] = [...byName];
      return build(only, depth + 1, key ? `${key}/${seg}` : seg);
    }
    const children: Group<T>[] = [];
    const g: Group<T> = { key, items: [], children, value: 0 };
    for (const o of order) {
      if (typeof o === "string") children.push(build(byName.get(o)!, depth + 1, key ? `${key}/${o}` : o));
      else children.push({ key: "", items: [o], children: [], value: Math.max(0, value(o)) });
    }
    g.value = children.reduce((n, c) => n + c.value, 0);
    return g;
  };
  const sum = (g: Group<T>): number => (g.children.length ? (g.value = g.children.reduce((n, c) => n + sum(c), 0)) : g.value);
  const root = build(items, 0, "");
  sum(root);
  const tiles: Rect<T>[] = [];
  const groups: Rect<string>[] = [];
  const layout = (g: Group<T>, x: number, y: number, w: number, h: number) => {
    for (const r of ordered(g.children, (c) => c.value, w, h, x, y)) {
      const c = r.item;
      if (c.children.length) {
        groups.push({ item: c.key, x: r.x, y: r.y, w: r.w, h: r.h });
        layout(c, r.x, r.y, r.w, r.h);
      } else if (c.items.length) {
        tiles.push({ item: c.items[0], x: r.x, y: r.y, w: r.w, h: r.h });
      }
    }
  };
  if (width > 0 && height > 0) layout(root, 0, 0, width, height);
  return { tiles, groups };
}
