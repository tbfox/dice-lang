// Exact numbers. dice-lang only adds and subtracts, so a numerator/denominator pair keeps every
// number exact until it is printed.

export class Rational {
  readonly n: bigint;
  readonly d: bigint;

  constructor(n: bigint, d: bigint = 1n) {
    if (d === 0n) throw new Error("zero denominator");
    if (d < 0n) {
      n = -n;
      d = -d;
    }
    const g = gcd(n < 0n ? -n : n, d);
    this.n = n / g;
    this.d = d / g;
  }

  add(o: Rational): Rational {
    return new Rational(this.n * o.d + o.n * this.d, this.d * o.d);
  }

  sub(o: Rational): Rational {
    return new Rational(this.n * o.d - o.n * this.d, this.d * o.d);
  }

  equals(o: Rational): boolean {
    return this.n === o.n && this.d === o.d;
  }

  compare(o: Rational): number {
    const diff = this.n * o.d - o.n * this.d;
    return diff < 0n ? -1 : diff > 0n ? 1 : 0;
  }

  /** Up to 4 decimals, rounded half away from zero, no trailing zeros (GRAMMAR.md §4.4). */
  format(): string {
    const negative = this.n < 0n;
    const abs = negative ? -this.n : this.n;
    const scaled = (abs * 10000n * 2n + this.d) / (this.d * 2n); // round half up on |x|
    const whole = scaled / 10000n;
    const frac = (scaled % 10000n).toString().padStart(4, "0").replace(/0+$/, "");
    const text = frac ? `${whole}.${frac}` : `${whole}`;
    return negative && scaled !== 0n ? `-${text}` : text;
  }
}

function gcd(a: bigint, b: bigint): bigint {
  while (b !== 0n) [a, b] = [b, a % b];
  return a === 0n ? 1n : a;
}
