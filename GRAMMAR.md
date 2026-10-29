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

- **Keywords:** `let`
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
args      = expr { "," expr } ;

primary   = DICE
          | VALUE
          | NUMBER
          | IDENT
          | "(" expr ")" ;
```

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
- The program's result is its last expression. It is written to stdout using the formats in 4.4.
  If the program ends with `;`, the result is `nil` and nothing is written.

| program | stdout |
|---|---|
| `2d4.roll()` | `5` (the roll) |
| `2d4.roll();` | nothing (result is `nil`) |
| `print(2d4.roll())` | `5`, printed by `print`. `print` returns `nil`, so nothing more is written. |
| `print(let outcome = dmg.roll_values());` | `[2, 4] - 6` |
| `let outcome = dmg.roll_values(); print(outcome);` | `[2, 4] - 6` (same as above) |

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
| `bool` | `.roll(n)`, `.roll_against(d)` | prints `success` / `fail` |
| `nil` | `expr;`, `print(x)` | prints nothing |

### 4.1.1 Dice arithmetic

`+` and `-` combine any mix of `dice` and `number`, in any order and any number of terms.
The result's outcomes are every possible sum or difference, weighted by probability.

| expression | outcomes | label |
|---|---|---|
| `5d12 - 2d4` | -3 to 58 | `5d12-2d4` |
| `d20 + 5 - 1d4` | 2 to 24 | `1d20+5-1d4` |
| `10 - d6` | 4 to 9 | `10-1d6` |
| `1d4 - 2d4` | -7 to 2 | `1d4-2d4` |

- Outcomes can be negative or zero. Tables list them in ascending order.
- `value` (`v17`) can't be used with `+` / `-` yet.
- The label is the expression with spaces removed and every die written with a count (`d20` → `1d20`).
  This is a guess; see Q3.

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
| `dice` | `.roll(n)` | `bool` | roll once; success if the total equals `n` |
| `dice` | `.roll_values()` | `roll` | roll once, keeping each die |
| `roll` | `.values` | `list` | each die's result, e.g. `[2, 4]` |
| `roll` | `.sum` | `number` | total of `.values` |
| `value` | `.roll_against(d)` | `bool` | roll `d`; success if the total ≥ this value |

### 4.4 Print formats

A distribution report (`dice`, `.at_least`, `.at_most`, `.mean`, `.min`, `.max`) starts with a label,
which is the dice's notation and the report kind, and ends with a `---` line:

```
2d4 (normal):
2    6.25
3    12.50
...
---
2d4 (mean): 5
---
```

- A table row is the outcome, 4 spaces, then the percentage with 2 decimals.
- Plain results print with no label or separator: a `number` prints as `4`, a `bool` as `success` / `fail`,
  a `list` as `[2, 4]`, and a `roll` as its values, ` - `, then its sum: `[2, 4] - 6`.

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

The program ends with `;`, so its result is `nil`. Everything below comes from `print`.

Output (the last five lines are random):

```
2d4 (normal):
2    6.25
3    12.50
4    18.75
5    25.00
6    18.75
7    12.50
8    6.25
---
2d4 (at_least):
2    100.00
3    93.75
4    81.25
5    62.50
6    37.50
7    18.75
8    6.25
---
2d4 (at_most):
2    6.25
3    18.75
4    37.50
5    62.50
6    81.25
7    93.75
8    100.00
---
2d4 (mean): 5
---
2d4 (min): 2
---
2d4 (max): 8
---
4
fail
[2, 4]
6
success
```

---

## 6. Open questions

- **Q1: How `nil` shows up.** If the program's result is `nil`, does stdout show nothing (this spec) or the
  word `nil`? Relatedly, should `print(x)` return `nil` (this spec) or `x`? If it returned `x`, a final
  `print(x)` with no `;` would write `x` twice.
- **Q2: `roll_against` ties.** Is meeting the DC a success (`save >= 17`, as in D&D), or must the roll beat it?
- **Q3: Labels for combined dice.** What should `print(d20+5)` show as its label: `d20+5`, `1d20+5`, or
  the variable name `save`?
- **Q4: Non-whole means.** `2d4` has mean 5. How should `print(d20.mean)` show 10.5: as `10.5` or `10.50`?
- **Q5: Trailing spaces.** Your sample output had trailing spaces after each table row. I treated them as
  accidental and left them out.
