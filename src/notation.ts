// A dice expression's shape: what it prints as (GRAMMAR.md §4.1.1) and which dice it rolls.

export type Notation =
  | { t: "die"; count: bigint; sides: bigint }
  | { t: "const"; value: bigint }
  | { t: "+" | "-"; left: Notation; right: Notation };

/** `2d4`, `1d20+5`, `10-(1d4+1)`. Parentheses only around a `+` / `-` on the right of a `-`. */
export function formatNotation(n: Notation): string {
  switch (n.t) {
    case "die":
      return `${n.count}d${n.sides}`;
    case "const":
      return String(n.value);
    case "+":
      if (n.right.t === "const" && n.right.value < 0n) return `${formatNotation(n.left)}-${-n.right.value}`;
      return `${formatNotation(n.left)}+${formatNotation(n.right)}`;
    case "-": {
      if (n.right.t === "const" && n.right.value < 0n) return `${formatNotation(n.left)}+${-n.right.value}`;
      const right = n.right.t === "die" || n.right.t === "const" ? formatNotation(n.right) : `(${formatNotation(n.right)})`;
      return `${formatNotation(n.left)}-${right}`;
    }
  }
}

export interface Term {
  count: bigint;
  sides: bigint;
  sign: 1n | -1n;
}

export interface Flat {
  /** Dice in the order they appear. */
  terms: Term[];
  constant: bigint;
  hasConstant: boolean;
}

/** Flattens to a signed list of dice plus one constant: `10-(1d4+1)` → `-1d4`, constant 9. */
export function flatten(n: Notation): Flat {
  const flat: Flat = { terms: [], constant: 0n, hasConstant: false };
  const walk = (n: Notation, sign: 1n | -1n) => {
    switch (n.t) {
      case "die":
        flat.terms.push({ count: n.count, sides: n.sides, sign });
        break;
      case "const":
        flat.constant += sign * n.value;
        flat.hasConstant = true;
        break;
      case "+":
        walk(n.left, sign);
        walk(n.right, sign);
        break;
      case "-":
        walk(n.left, sign);
        walk(n.right, sign === 1n ? -1n : 1n);
        break;
    }
  };
  walk(n, 1n);
  return flat;
}
