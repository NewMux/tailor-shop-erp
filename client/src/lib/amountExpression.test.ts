import { describe, expect, it } from "vitest";
import { evaluateAmountExpression } from "./amountExpression";

describe("evaluateAmountExpression", () => {
  it("adds multiple amounts", () => {
    expect(evaluateAmountExpression("13+4+5")).toBe(22);
  });

  it("supports operator precedence, parentheses, decimals, and display operators", () => {
    expect(evaluateAmountExpression("10 + 2 * 3")).toBe(16);
    expect(evaluateAmountExpression("(10 + 2) × 3")).toBe(36);
    expect(evaluateAmountExpression("10.125 ÷ 2")).toBe(5.063);
  });

  it("rejects unsafe or incomplete expressions", () => {
    expect(evaluateAmountExpression("13+")) .toBeNull();
    expect(evaluateAmountExpression("alert(1)")) .toBeNull();
    expect(evaluateAmountExpression("10/0")) .toBeNull();
    expect(evaluateAmountExpression("5-8")) .toBeNull();
  });

  it("accepts zero as a valid collected amount", () => {
    expect(evaluateAmountExpression("0")).toBe(0);
  });
});
