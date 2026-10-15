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
