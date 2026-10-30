// Seeded random numbers (GRAMMAR.md §6). xoshiro128** seeded through splitmix32.
// Changing this algorithm changes every seeded output, so leave it alone.

export class Rng {
  private s: Uint32Array;

  constructor(seed: bigint) {
    // Feed the seed into splitmix32 32 bits at a time, so any size of seed works.
    let state = 0;
    let rest = seed;
    do {
      state = (state ^ Number(rest & 0xffffffffn)) >>> 0;
      state = splitmix32(state).state;
      rest >>= 32n;
    } while (rest > 0n);

    this.s = new Uint32Array(4);
    for (let i = 0; i < 4; i++) {
      const next = splitmix32(state);
      state = next.state;
      this.s[i] = next.value;
    }
  }

  /** Next 32 random bits. */
  next(): number {
    let [s0, s1, s2, s3] = this.s as unknown as [number, number, number, number];
    const result = Math.imul(rotl(Math.imul(s1, 5) >>> 0, 7), 9) >>> 0;
    const t = s1 << 9;
    s2 ^= s0;
    s3 ^= s1;
    s1 ^= s2;
    s0 ^= s3;
    s2 ^= t;
    s3 = rotl(s3 >>> 0, 11);
    this.s.set([s0 >>> 0, s1 >>> 0, s2 >>> 0, s3]);
    return result;
  }

  /** Uniform whole number from 1 to sides, with no bias. */
  die(sides: bigint): bigint {
    const bits = sides.toString(2).length;
    const words = Math.ceil(bits / 32);
    const mask = (1n << BigInt(bits)) - 1n;
    for (;;) {
      let x = 0n;
      for (let i = 0; i < words; i++) x = (x << 32n) | BigInt(this.next());
      x &= mask;
      if (x < sides) return x + 1n;
    }
  }
}

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

function splitmix32(state: number): { state: number; value: number } {
  state = (state + 0x9e3779b9) >>> 0;
  let z = state;
  z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
  z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
  return { state, value: (z ^ (z >>> 16)) >>> 0 };
}

/** A seed for runs without `--seed`. */
export function randomSeed(): bigint {
  const words = crypto.getRandomValues(new Uint32Array(2));
  return (BigInt(words[0]!) << 32n) | BigInt(words[1]!);
}
