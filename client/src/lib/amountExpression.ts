const MAX_AMOUNT = 1_000_000;
const DECIMAL_PLACES = 3;

type Token = number | "+" | "-" | "*" | "/" | "(" | ")";

function tokenize(expression: string): Token[] | null {
  const compact = expression.replace(/[\s,]/g, "").replace(/×/g, "*").replace(/÷/g, "/");
  if (!compact) return null;

  const tokens: Token[] = [];
  let index = 0;
  while (index < compact.length) {
    const character = compact[index];
    if ("+-*/()".includes(character)) {
      tokens.push(character as Exclude<Token, number>);
      index += 1;
      continue;
    }
    if (!/[0-9.]/.test(character)) return null;
    const start = index;
    let decimalPoints = 0;
    while (index < compact.length && /[0-9.]/.test(compact[index])) {
      if (compact[index] === ".") decimalPoints += 1;
      if (decimalPoints > 1) return null;
      index += 1;
    }
    const value = Number(compact.slice(start, index));
    if (!Number.isFinite(value)) return null;
    tokens.push(value);
  }
  return tokens;
}

export function evaluateAmountExpression(raw: string): number | null {
  const tokens = tokenize(raw);
  if (!tokens) return null;
  let position = 0;

  const peek = () => tokens[position];
  const consume = () => tokens[position++];

  const parsePrimary = (): number | null => {
    const token = peek();
    if (typeof token === "number") {
      consume();
      return token;
    }
    if (token !== "(") return null;
    consume();
    const value = parseAdditive();
    if (peek() !== ")") return null;
    consume();
    return value;
  };

  const parseUnary = (): number | null => {
    const token = peek();
    if (token === "+" || token === "-") {
      consume();
      const value = parseUnary();
      return value === null ? null : token === "-" ? -value : value;
    }
    return parsePrimary();
  };

  const parseMultiplicative = (): number | null => {
    let value = parseUnary();
    while (value !== null && (peek() === "*" || peek() === "/")) {
      const operator = consume();
      const right = parseUnary();
      if (right === null || (operator === "/" && right === 0)) return null;
      value = operator === "*" ? value * right : value / right;
    }
    return value;
  };

  const parseAdditive = (): number | null => {
    let value = parseMultiplicative();
    while (value !== null && (peek() === "+" || peek() === "-")) {
      const operator = consume();
      const right = parseMultiplicative();
      if (right === null) return null;
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  };

  const value = parseAdditive();
  if (value === null || position !== tokens.length || !Number.isFinite(value) || value < 0 || value > MAX_AMOUNT) return null;
  return Math.round((value + Number.EPSILON) * 10 ** DECIMAL_PLACES) / 10 ** DECIMAL_PLACES;
}
