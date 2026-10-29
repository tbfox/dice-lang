# dice-lang grammar (draft v0)

A small language for rolling dice and computing exact probability distributions.
It takes its ideas from AnyDice, but the syntax follows C-family languages, mainly TypeScript and Rust.

**Design goals**
- Code should look familiar to TS/Rust developers: `let`, `fn`, braces, `;`, `if`/`match` as expressions.
- Dice notation is part of the syntax: `3d6`, `d20`, `4d6 kh 3`, `d[1, 1, 2, 3]`.
- Every value is a distribution. `d20 >= 15` is the *probability* of rolling 15 or higher, not a yes/no answer.
- Optional type annotations decide when a function is evaluated once per outcome of a die (AnyDice's `n` vs `d` parameters).

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

Expressions are **not** written as nested EBNF rules. They're defined by the precedence table
in section 4, which is easier to read and maps directly onto the parser.

---

## 2. Lexical grammar (tokens)

```ebnf
NUMBER   = digit { digit } ;                      (* integers only: 0, 6, 100 *)
STRING   = '"' { any char except '"' or newline | '\"' } '"' ;
IDENT    = (letter | "_") { letter | digit | "_" } ;   (* minus keywords and dice words *)
comment  = "//" { any char } newline
         | "/*" { any char } "*/" ;
```

Whitespace and comments are ignored between tokens.

**Keywords (reserved):**
`let const fn return if else match for in output as true false int dice seq bool`

**Punctuation:**
`( ) { } [ ] , ; : . => -> .. ..= + - * / % == != < <= > >= && || ! = += -= *= /= | _`

### Dice words

This one lexer rule makes `3d6`, `d20`, and `4d6kh3` work without spaces, while
names like `damage` and `dex` stay ordinary identifiers.

1. A number stops at the first letter, so `3d6` lexes as `3` and then the word `d6`.
2. A word that matches `(d | kh | kl | dh | dl)` followed by **digits only** is split into an
   operator and a number:

| source | tokens |
|---|---|
| `3d6` | `3` `d` `6` |
| `d20` | `d` `20` |
| `4d6kh3` | `4` `d` `6` `kh` `3` |
| `d[1,2,3]` | `d` `[` `1` `,` ... |
| `(n)d6`, `n d 6` | `(` `n` `)` `d` `6` / `n` `d` `6` |
| `damage`, `dex`, `khan` | one `IDENT` each |
| `d6x` | `IDENT` (not digits only), see open question Q4 |

As a result, `d`, `kh`, `kl`, `dh`, `dl` (and `d6`, `d20`, ...) can't be used as variable names.

---

## 3. Syntactic grammar

```ebnf
(* ---------- program structure ---------- *)
program     = { item } ;
item        = fn_decl | stmt ;                    (* functions are top-level only *)

fn_decl     = "fn" IDENT "(" [ params ] ")" [ "->" type ] block ;
params      = param { "," param } [ "," ] ;
param       = IDENT [ ":" type ] ;                (* no type = accept anything as-is *)
type        = "int" | "dice" | "seq" | "bool" ;

(* ---------- statements ---------- *)
stmt        = let_stmt
            | assign_stmt
            | output_stmt
            | return_stmt
            | for_stmt
            | expr_stmt ;

let_stmt    = ( "let" | "const" ) IDENT [ ":" type ] "=" expr ";" ;
assign_stmt = IDENT ( "=" | "+=" | "-=" | "*=" | "/=" ) expr ";" ;  (* `let` vars only *)
output_stmt = "output" expr [ "as" STRING ] ";" ;  (* print a distribution report *)
return_stmt = "return" [ expr ] ";" ;
for_stmt    = "for" IDENT "in" expr block ;        (* iterate a range or seq *)
expr_stmt   = block_like                           (* no ';' needed after a block *)
            | expr ";" ;

(* ---------- blocks and block-like expressions ---------- *)
block       = "{" { stmt } [ expr ] "}" ;          (* trailing expr, no ';' = block's value *)
block_like  = block | if_expr | match_expr ;

if_expr     = "if" expr block [ "else" ( if_expr | block ) ] ;

match_expr  = "match" expr "{" [ arm { "," arm } [ "," ] ] "}" ;
arm         = pattern { "|" pattern } "=>" expr ;
pattern     = int_lit [ ( ".." | "..=" ) int_lit ] (* 1, 2..=19 *)
            | "_" ;                                (* wildcard *)
int_lit     = [ "-" ] NUMBER ;

(* ---------- expressions (operators: see section 4) ---------- *)
expr        = (* see the precedence table *) ;

primary     = NUMBER
            | STRING
            | "true" | "false"
            | IDENT
            | "(" expr ")"
            | seq_lit
            | block_like ;

seq_lit     = "[" [ expr { "," expr } [ "," ] ] "]" ;   (* ranges inside are spread: [1..=3, 6] = [1,2,3,6] *)
args        = [ expr { "," expr } [ "," ] ] ;
```

**The block-statement rule (same as Rust):** if a statement *starts* with `{`, `if`, or `match`,
that block ends the statement. So

```
if x > 3 { 1 } else { 2 }
- 1;
```

is two statements: the `if`, then `-1;`. Wrap it in parentheses if you mean `(if ...) - 1`.

---

## 4. Operators and precedence

Lowest to highest. A higher row binds tighter. Operators are left-associative unless the
table says otherwise.

| bp | operators | kind | associativity | example | parses as |
|---|---|---|---|---|---|
| 1 | `..` `..=` | infix | none | `1..=n + 1` | `1..=(n + 1)` |
| 2 | `\|\|` | infix | left | `a \|\| b && c` | `a \|\| (b && c)` |
| 3 | `&&` | infix | left | `x > 1 && x < 5` | `(x > 1) && (x < 5)` |
| 4 | `==` `!=` `<` `<=` `>` `>=` | infix | none | `d20 + 5 >= 15` | `((d20) + 5) >= 15` |
| 5 | `+` `-` | infix | left | `2d6 + 1` | `(2d6) + 1` |
| 6 | `*` `/` `%` | infix | left | `2 * d6 + 1` | `(2 * (d6)) + 1` |
| 7 | `kh` `kl` `dh` `dl` | infix | left | `4d6 kh 3 + 2` | `((4d6) kh 3) + 2` |
| 8 | `d` | infix and prefix | left | `2d6d4`, `d20` | `(2d6)d4`, `d(20)` |
| 9 | `-` `!` | prefix | n/a | `-d4`, `!(x > 3)` | `-(d4)` |
| 10 | `(args)` `[i]` `.name(args)` | postfix | left | `f(x)[0]`, `x.sum()` | `(f(x))[0]`, `(x).sum()` |

Notes:
- **Non-associative** means chaining is a syntax error: `a < b < c` is rejected, and so is `1..2..3`.
- **`d` binds tighter than arithmetic**, so `2d6 * 2` doubles the total of a 2d6 roll.
  Use `2 * d6` or `(2 * 2)d6` when you want something else.
- **The right side of `d`** can be a number, a name, a parenthesized expression, or a seq:
  `d6`, `n d sides`, `d(x + 1)`, `d[1, 1, 2, 3]`.
- **Keep/drop** read as "*pool* keep-highest *count*": `kh` = keep highest, `kl` = keep lowest,
  `dh` = drop highest, `dl` = drop lowest.
- **Postfix binds tightest**, so `3d6[0]` parses as `3d(6[0])`. Write `(3d6)[0]`.
  See open question Q5.

### What the parser produces

Every expression becomes a tree. For example, `4d6 kh 3 + d4 >= 12`:

```
            >=
          /    \
         +      12
       /   \
     kh     d (prefix)
    /  \     \
   d    3     4
  / \
 4   6
```

---

## 5. Example programs

### 5.1 Basic rolls
```rust
output 3d6 as "3d6";
output d20 + 5 as "attack bonus +5";
output 2d6 + 1d8 + 3 as "greatsword + bonus";
```

### 5.2 Ability scores: 4d6, drop lowest
```rust
let stat = 4d6 kh 3;   // same as 4d6 dl 1
output stat as "ability score";
```

### 5.3 Advantage and disadvantage
```rust
output 2d20 kh 1 as "advantage";
output 2d20 kl 1 as "disadvantage";
```

### 5.4 Hit chance (comparison = probability)
```rust
const ac = 15;
output d20 + 5 >= ac as "chance to hit AC 15";
```

### 5.5 Custom dice faces
```rust
let fudge = d[-1, 0, 1];
output 4 d fudge as "fate dice";

let weird = d[1..=4, 10];   // faces 1, 2, 3, 4, 10
output weird;
```

### 5.6 Crits with `match`
```rust
fn attack(roll: int) -> dice {
    match roll {
        1 => 0,              // natural 1: miss
        20 => 2d8 + 3,       // crit: double dice
        2..=19 => if roll + 5 >= 15 { 1d8 + 3 } else { 0 },
    }
}

output attack(d20) as "damage per attack";
```
`roll: int` receives a `dice` argument (`d20`), so `attack` runs once for each face
and the results are combined using each face's probability. This is AnyDice's
`function: attack ROLL:n` behavior.

### 5.7 Exploding dice via recursion
```rust
fn explode(roll: int, depth: int) -> dice {
    if roll == 6 && depth > 0 {
        roll + explode(d6, depth - 1)
    } else {
        roll
    }
}

output explode(d6, 3) as "exploding d6 (3 deep)";
```

### 5.8 Loops and mutation
```rust
let total = 0;
for i in 1..=3 {
    total += i d 6;          // 1d6 + 2d6 + 3d6
}
output total;
```

### 5.9 Indexing a pool (sorted highest first)
```rust
let pool = 3d6;
output pool[0] as "highest of 3d6";
output pool[1] as "middle of 3d6";
output (3d6)[2] as "lowest of 3d6";
```

### 5.10 Counting successes
```rust
fn successes(pool: seq, target: int) -> int {
    let n = 0;
    for die in pool {
        n += die >= target;  // true counts as 1
    }
    n
}

output successes(6d10, 8) as "successes on 6d10, TN 8";
```
`pool: seq` makes `6d10` arrive as each possible sorted roll, e.g. `[10, 9, 8, 3, 2, 1]`, one at a time.

---

## 6. Open questions

Each of these is a choice for you to make.

- **Q1: Semicolons.** Required after every non-block statement (Rust). Should they be optional, as in TS? That
  would make the grammar depend on newlines and the parser harder to write.
- **Q2: The `output` keyword.** `output x as "label";` vs. a function call `output(x, "label")` / `print(x)`.
  A keyword is closer to AnyDice; a function call is more TS-like.
- **Q3: Types.** Is `int | dice | seq | bool` the right set? Should `bool` exist, or is everything an int
  (comparisons give 0/1)? Do you want type annotations on `let`?
- **Q4: Dice words.** `d`, `kh`, `kl`, `dh`, `dl` become reserved. Is that acceptable, or should keep/drop be
  methods (`(4d6).keep_highest(3)`)? Should `d6x` be an error instead of an identifier?
- **Q5: Indexing.** `(3d6)[0]` needs parentheses, and index 0 = highest. Do you want highest-first or lowest-first,
  0-based or 1-based (AnyDice is 1-based, written `1@3d6`)? Should `@` be an infix operator for this?
- **Q6: Numbers.** Integers only, with `/` rounding toward zero (like AnyDice)? Or do you want fractions?
- **Q7: Exploding / rerolls.** Built-in syntax (`d6!`, `d6 r 1`) or library functions (`explode(d6)`)?
- **Q8: Loops.** Only `for ... in` (always ends). Should there be `while`, `break`, `continue`?
- **Q9: Settings.** AnyDice has `set "explode depth" to 3`. Should there be a syntax for config like that?
- **Q10: Mutability.** `let` is mutable and `const` is not (TS). Or Rust's `let` / `let mut`?
