# dice-lang grammar (v0.1)

A small language for rolling dice and computing their probabilities.
This version only covers enough to run the program in section 5. More features will be added later.

---

## 1. How to read this document

The grammar uses EBNF:

| notation | meaning |
|---|---|
| `a b` | `a` followed by `b` |
| `a \| b` | `a` or `b` |
| `[ a ]` | optional `a` (zero or one) |
| `{ a }` | zero or more `a` |
| `"let"` | literal text |
| `UPPER` | a token produced by the lexer (section 2) |
| `(* ... *)` | comment |

---

## 2. Tokens

```ebnf
DICE     = [ digits ] "d" digits ;          (* 2d4, d20  (no count = 1) *)
VALUE    = "v" digits ;                     (* v17: a fixed target value, e.g. a DC *)
NUMBER   = digits ;                         (* 3, 5 *)
IDENT    = ( letter | "_" ) { letter | digit | "_" } ;
digits   = digit { digit } ;
comment  = "//" { any char except newline } ;
```

- **Keywords:** `let` `true` `false`
- **Punctuation:** `=` `;` `+` `-` `.` `(` `)` `,`
- Whitespace and comments are skipped between tokens.

**Dice and value words.** A word that is exactly `d` + digits or `v` + digits is a `DICE` or `VALUE`
token, not an identifier. That means `d20` and `v17` are literals, while `dmg`, `dc` and `save` are names.
Words like `d4x` or `v1a` are ordinary identifiers.

| source | tokens |
|---|---|
| `2d4` | `DICE(2, 4)` |
| `d20+5` | `DICE(1, 20)` `+` `NUMBER(5)` |
| `5d12-2d4` | `DICE(5, 12)` `-` `DICE(2, 4)` |
| `v17` | `VALUE(17)` |
| `dmg.at_least` | `IDENT(dmg)` `.` `IDENT(at_least)` |

---

## 3. Syntax

Everything is an expression. There are no statements.

```ebnf
program   = { expr ";" } [ expr ] ;         (* last expr without ';' = program result *)

expr      = let_expr
          | sum ;

let_expr  = "let" IDENT "=" expr ;          (* binds IDENT; evaluates to the bound value *)

sum       = postfix { ( "+" | "-" ) postfix } ;   (* left-associative: a - b + c = (a - b) + c *)

postfix   = primary { "." IDENT             (* member:  dmg.mean *)
                    | "(" [ args ] ")" } ;  (* call:    print(x), dmg.roll(3) *)
args      = arg { "," arg } ;
arg       = [ IDENT "=" ] expr ;             (* named:   must_exceed = true *)

primary   = DICE
          | VALUE
          | NUMBER
          | "true" | "false"
          | IDENT
          | "(" expr ")" ;
```

**Named arguments.** Inside a call, `name = expr` passes an argument by name. Positional arguments
come first, then named ones: `f(a, b, x = 1)` is valid but `f(x = 1, a)` is an error. This doesn't clash
with `let`, because a bare `name = expr` is only allowed as a call argument.

Precedence, lowest to highest:

| level | operators | example | parses as |
|---|---|---|---|
| 0 | `let x =` (prefix) | `let x = d20 + 5` | `let x = (d20 + 5)` |
| 1 | `+` `-` (infix, left) | `5d12 - 2d4 + 3` | `((5d12) - (2d4)) + 3` |
| 2 | `.name`, `(args)` (postfix, left) | `dmg.roll(3)` | `((dmg).roll)(3)` |

So `d20 + 5.min` parses as `d20 + (5.min)`. Use `(d20 + 5).min` for the minimum of the total.

`-` is only infix. There is no negation yet, so `-2d4` alone is an error.

`let` takes everything to its right, so it can't appear inside a `+` or `-` without parentheses:
`1 + let x = 2` is an error, but `1 + (let x = 2)` is valid and evaluates to `3`.

### 3.1 Semicolons and the program result

- `;` separates expressions. By convention, put one at the end of each line.
- `;` discards a value. An expression followed by `;` produces `nil`.
- The program's result is its last expression. It is always written to stdout using the formats in 4.4.
  If the program ends with `;`, the result is `nil`, so the last line of stdout is `nil`.

| program | stdout |
|---|---|
| `2d4.roll()` | `5` (the roll) |
| `2d4.roll();` | `nil` |
| `print(2d4.roll())` | `5` from `print`, then `nil`, because `print` returns `nil` |
| `print(let outcome = dmg.roll_values());` | `[2, 4] - 6`, then `nil` |
| `let outcome = dmg.roll_values(); print(outcome);` | `[2, 4] - 6`, then `nil` (same as above) |

---

## 4. Built-ins

The grammar treats every name the same way. This section lists the names that actually mean something
in v0.1.

### 4.1 Types

| type | made by | example |
|---|---|---|
| `number` | `NUMBER`, `.mean`, `.min`, `.max`, `.sum`, `.roll()`, `number ± number` | `5` |
| `dice` | `DICE`, any `+` / `-` with a `dice` on either side | `2d4`, `d20+5`, `5d12-2d4` |
| `value` | `VALUE` | `v17` |
| `table` | `.at_least`, `.at_most` | |
| `roll` | `.roll_values()` | prints `[2, 4] - 6` |
| `list` | `roll.values` | `[2, 4]` |
| `bool` | `true`, `false` | prints `true` / `false` |
| `result` | `.roll(n)`, `.roll_against(d)` | prints `success` / `fail` |
| `nil` | `expr;`, `print(x)` | prints `nil` |

### 4.1.1 Dice arithmetic

`+` and `-` combine any mix of `dice` and `number`, in any order and any number of terms.
The result's outcomes are every possible sum or difference, weighted by probability.

| expression | outcomes | notation |
|---|---|---|
| `5d12 - 2d4` | -3 to 58 | `5d12-2d4` |
| `d20 + 5 - 1d4` | 2 to 24 | `1d20+5-1d4` |
| `10 - d6` | 4 to 9 | `10-1d6` |
| `1d4 - 2d4` | -7 to 2 | `1d4-2d4` |

- Outcomes can be negative or zero. Tables list them in ascending order.
- `value` (`v17`) can't be used with `+` / `-` yet.
- **Notation** is the expression with spaces removed and every die written with its count
  (`d20` becomes `1d20`). Variables are replaced by their notation: if `dmg = 2d4`, then `dmg + 1` is `2d4+1`.

### 4.2 Functions

| name | returns | meaning |
|---|---|---|
| `print(x)` | `nil` | print `x` (formats in 4.4) |

### 4.3 Members

| on | member | returns | meaning |
|---|---|---|---|
| `dice` | `.at_least` | `table` | P(outcome ≥ n) for each n |
| `dice` | `.at_most` | `table` | P(outcome ≤ n) for each n |
| `dice` | `.mean` | `number` | expected value |
| `dice` | `.min` | `number` | smallest possible outcome |
| `dice` | `.max` | `number` | largest possible outcome |
| `dice` | `.roll()` | `number` | roll once and return the total |
| `dice` | `.roll(n)` | `result` | roll once; success if the total equals `n` |
| `dice` | `.roll_values()` | `roll` | roll once, keeping each die |
| `roll` | `.values` | `list` | each die's result, e.g. `[2, 4]` |
| `roll` | `.sum` | `number` | total of `.values` |
| `value` | `.roll_against(d, must_exceed = false)` | `result` | roll `d`; see below (`must_exceed` is a `bool`) |

**`roll_against`** rolls `d` once and compares the total to the value:

| call | success when |
|---|---|
| `dc.roll_against(save)` | total ≥ value (meets or beats, the default) |
| `dc.roll_against(save, must_exceed = true)` | total > value (must beat) |

### 4.4 Print formats

A distribution report (`dice`, `.at_least`, `.at_most`, `.mean`, `.min`, `.max`) starts with a label
and ends with a `---` line. The label is:

- `name : notation (kind)` when the dice is read from a variable: `print(save)` → `save : 1d20+5 (normal):`
- `notation (kind)` otherwise: `print(d20 + 5)` → `1d20+5 (normal):`

`kind` is `normal`, `at_least`, `at_most`, `mean`, `min` or `max`. A member access keeps the
variable's name, so `print(dmg.mean)` → `dmg : 2d4 (mean): 5`.

The name is always the variable the dice is read from, even when it was copied from another variable:

```dice
let dmg = 2d4;
let a = dmg;
print(dmg);   // dmg : 2d4 (normal):
print(a);     // a : 2d4 (normal):
```

```
dmg : 2d4 (normal):
2    6.25
3    12.5
...
---
dmg : 2d4 (mean): 5
---
```

- **Numbers** everywhere, including table percentages, print with up to 4 decimals, rounded, with no
  trailing zeros: `5`, `12.5`, `10.2345`, `100`.
- A table row is the outcome, 4 spaces, then the percentage. Rows have no trailing spaces.
  Column alignment will be decided later.
- Plain results print with no label or separator: a `bool` prints as `true` / `false`, a `result` as
  `success` / `fail`, a `list` as `[2, 4]`, a `roll` as its values, ` - `, then its sum (`[2, 4] - 6`),
  and `nil` as `nil`.
- A `result` has no other data yet. Extra details may be attached to it later.

---

## 5. Example program

```dice
let dmg = 2d4;

print(dmg);           // probability of each outcome
print(dmg.at_least);  // probability of rolling at least each outcome
print(dmg.at_most);   // probability of rolling at most each outcome
print(dmg.mean);
print(dmg.min);
print(dmg.max);

print(dmg.roll());        // a random total
print(dmg.roll(3));       // success if the roll is exactly 3
let outcome = dmg.roll_values();
print(outcome.values);
print(outcome.sum);

let dc = v17;
let save = d20+5;

print(dc.roll_against(save)); // success if save >= 17
```

Everything up to `success` comes from `print`. The program ends with `;`, so its result is `nil`,
which is written as the last line.

Output (lines 4 to 8 from the end are random):

```
dmg : 2d4 (normal):
2    6.25
3    12.5
4    18.75
5    25
6    18.75
7    12.5
8    6.25
---
dmg : 2d4 (at_least):
2    100
3    93.75
4    81.25
5    62.5
6    37.5
7    18.75
8    6.25
---
dmg : 2d4 (at_most):
2    6.25
3    18.75
4    37.5
5    62.5
6    81.25
7    93.75
8    100
---
dmg : 2d4 (mean): 5
---
dmg : 2d4 (min): 2
---
dmg : 2d4 (max): 8
---
4
fail
[2, 4]
6
success
nil
```

---

## 6. Open questions

None right now.
