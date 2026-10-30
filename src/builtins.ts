// Built-in functions and members (GRAMMAR.md §4.2, §4.3), shared by the checker and the evaluator.

export type TypeName =
  | "number"
  | "dice"
  | "value"
  | "table"
  | "roll"
  | "list"
  | "bool"
  | "result"
  | "nil"
  | "debug";

export interface Param {
  name: string;
  type: TypeName | "any";
  optional?: boolean;
}

export interface FunctionSpec {
  params: Param[];
  returns: TypeName;
}

export interface MemberSpec {
  kind: "field" | "method";
  /** Fields have no params. */
  params: Param[];
  /** Return type, given how many arguments were passed (only `.roll(n)` cares). */
  returns: (argCount: number) => TypeName;
}

export const FUNCTIONS: Record<string, FunctionSpec> = {
  print: { params: [{ name: "x", type: "any" }], returns: "nil" },
};

const field = (returns: TypeName): MemberSpec => ({ kind: "field", params: [], returns: () => returns });
const method = (params: Param[], returns: MemberSpec["returns"]): MemberSpec => ({
  kind: "method",
  params,
  returns,
});

export const MEMBERS: Partial<Record<TypeName, Record<string, MemberSpec>>> = {
  dice: {
    at_least: field("table"),
    at_most: field("table"),
    mean: field("number"),
    min: field("number"),
    max: field("number"),
    roll: method([{ name: "n", type: "number", optional: true }], (n) => (n === 0 ? "number" : "result")),
    roll_values: method([], () => "roll"),
  },
  roll: {
    values: field("list"),
    sum: method([], () => "number"),
  },
  number: {
    debug: field("debug"),
  },
  value: {
    roll_against: method(
      [
        { name: "d", type: "dice" },
        { name: "must_exceed", type: "bool", optional: true },
      ],
      () => "result",
    ),
  },
};
