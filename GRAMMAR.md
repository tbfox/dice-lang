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
- **Punctuation:** `=` `;` `+` `.` `(` `)` `,`
- Whitespace and comments are skipped between tokens.

**Dice and value words.** A word that is exactly `d` + digits or `v` + digits is a `DICE` or `VALUE`
token, not an identifier. That means `d20` and `v17` are literals, while `dmg`, `dc` and `save` are names.
Words like `d4x` or `v1a` are ordinary identifiers.

| source | tokens |
|---|---|
| `2d4` | `DICE(2, 4)` |
| `d20+5` | `DICE(1, 20)` `+` `NUMBER(5)` |
| `v17` | `VALUE(17)` |
| `dmg.at_least` | `IDENT(dmg)` `.` `IDENT(at_least)` |

---

## 3. Syntax

```ebnf
program   = { stmt } ;

stmt      = let_stmt
          | expr_stmt ;

let_stmt  = "let" IDENT "=" expr ";" ;
expr_stmt = expr ";" ;                      (* e.g. print(dmg); *)

expr      = postfix { "+" postfix } ;       (* left-associative: a + b + c = (a + b) + c *)

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
| 1 | `+` (infix, left) | `d20 + 5` | `(d20) + 5` |
| 2 | `.name`, `(args)` (postfix, left) | `dmg.roll(3)` | `((dmg).roll)(3)` |

So `d20 + 5.min` parses as `d20 + (5.min)`. Use `(d20 + 5).min` for the minimum of the total.

---

## 4. Built-ins

The grammar treats every name the same way. This section lists the names that actually mean something
in v0.1.

### 4.1 Types

| type | made by | example |
|---|---|---|
| `number` | `NUMBER`, `.mean`, `.min`, `.max`, `.sum`, `.roll()` | `5` |
| `dice` | `DICE`, `dice + dice`, `dice + number` | `2d4`, `d20+5` |
| `value` | `VALUE` | `v17` |
| `table` | `.at_least`, `.at_most` | |
| `roll` | `.roll_values()` | |
| `list` | `roll.values` | `[2, 4]` |
| `bool` | `.roll(n)`, `.roll_against(d)` | prints `success` / `fail` |

### 4.2 Functions

| name | meaning |
|---|---|
| `print(x)` | print `x` (formats in 4.4) |

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
  and a `list` as `[2, 4]`.

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

- **Q1: Semicolons.** Your original example left the `;` off `print(outcome.values)` and `print(outcome.sum)`.
  This spec requires `;` and adds them. Should semicolons be optional?
- **Q2: `roll_against` ties.** Is meeting the DC a success (`save >= 17`, as in D&D), or must the roll beat it?
- **Q3: Labels for combined dice.** What should `print(d20+5)` show as its label: `d20+5`, `1d20+5`, or
  the variable name `save`?
- **Q4: Non-whole means.** `2d4` has mean 5. How should `print(d20.mean)` show 10.5: as `10.5` or `10.50`?
- **Q5: Trailing spaces.** Your sample output had trailing spaces after each table row. I treated them as
  accidental and left them out.
