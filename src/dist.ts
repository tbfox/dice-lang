// Exact probability distributions. Each outcome gets a whole-number count of the ways to roll it,
// kept as a BigInt; probabilities are count / total, so nothing is rounded until printing.

import { flatten, type Flat, type Notation } from "./notation.ts";
import { Rational } from "./rational.ts";

export interface Dist {
  /** Smallest outcome. Outcomes are contiguous: min, min + 1, ... */
  min: number;
  /** counts[i] = number of ways to roll min + i. */
  counts: bigint[];
  /** Sum of counts. */
  total: bigint;
}

const cache = new Map<string, Dist>();

export function distribution(n: Notation): Dist {
  const flat = flatten(n);
  const key = cacheKey(flat);
  let dist = cache.get(key);
  if (!dist) {
    dist = compute(flat);
    cache.set(key, dist);
  }
  return dist;
}

function cacheKey(flat: Flat): string {
  return flat.terms.map((t) => `${t.sign}:${t.count}d${t.sides}`).join(",") + `|${flat.constant}`;
}

function compute(flat: Flat): Dist {
  // Merge dice of the same size and sign, e.g. 1d4 + 1d4 = 2d4.
  const groups = new Map<string, { count: bigint; sides: bigint; sign: bigint }>();
  for (const t of flat.terms) {
    const key = `${t.sign}:${t.sides}`;
    const g = groups.get(key);
    if (g) g.count += t.count;
    else groups.set(key, { ...t });
  }

  let dist: Dist = { min: 0, counts: [1n], total: 1n };
  for (const g of groups.values()) {
    let part = sameDice(Number(g.count), Number(g.sides));
    if (g.sign < 0n) part = negate(part);
    dist = convolve(dist, part);
  }
  return { ...dist, min: dist.min + Number(flat.constant) };
}

/** NdM by adding one die at a time. A die adds a sliding window of M counts, so each step is linear. */
function sameDice(count: number, sides: number): Dist {
  let counts = [1n];
  for (let i = 0; i < count; i++) {
    const next: bigint[] = new Array(counts.length + sides - 1);
    let window = 0n;
    for (let k = 0; k < next.length; k++) {
      if (k < counts.length) window += counts[k]!;
      if (k - sides >= 0) window -= counts[k - sides]!;
      next[k] = window;
    }
    counts = next;
  }
  return { min: count, counts, total: BigInt(sides) ** BigInt(count) };
}

function negate(d: Dist): Dist {
  return { min: -(d.min + d.counts.length - 1), counts: [...d.counts].reverse(), total: d.total };
}

function convolve(a: Dist, b: Dist): Dist {
  if (b.counts.length === 1) return { min: a.min + b.min, counts: a.counts.map((c) => c * b.counts[0]!), total: a.total * b.total };
  const counts: bigint[] = new Array(a.counts.length + b.counts.length - 1).fill(0n);
  a.counts.forEach((x, i) => {
    b.counts.forEach((y, j) => {
      counts[i + j]! += x * y;
    });
  });
  return { min: a.min + b.min, counts, total: a.total * b.total };
}

export function mean(n: Notation): Rational {
  const flat = flatten(n);
  let sum = new Rational(flat.constant);
  for (const t of flat.terms) sum = sum.add(new Rational(t.sign * t.count * (t.sides + 1n), 2n));
  return sum;
}

export function min(n: Notation): bigint {
  const flat = flatten(n);
  return flat.terms.reduce((s, t) => s + (t.sign > 0n ? t.count : -t.count * t.sides), flat.constant);
}

export function max(n: Notation): bigint {
  const flat = flatten(n);
  return flat.terms.reduce((s, t) => s + (t.sign > 0n ? t.count * t.sides : -t.count), flat.constant);
}
