import { Injectable } from '@angular/core';

export type Operation = 'add' | 'subtract' | 'multiply' | 'divide';
export type AngleMode = 'deg' | 'rad';

type Token =
  | { type: 'num'; value: number }
  | { type: 'op'; value: string }
  | { type: 'func'; value: FunctionName }
  | { type: 'lparen' }
  | { type: 'rparen' };

/** Function names as they appear in the display; each is followed by "(". */
export const FUNCTIONS = ['sin⁻¹', 'cos⁻¹', 'tan⁻¹', 'sin', 'cos', 'tan', 'ln', 'log', '√'] as const;
type FunctionName = (typeof FUNCTIONS)[number];

@Injectable({ providedIn: 'root' })
export class CalculatorService {
  add(a: number, b: number): number {
    return a + b;
  }

  subtract(a: number, b: number): number {
    return a - b;
  }

  multiply(a: number, b: number): number {
    return a * b;
  }

  divide(a: number, b: number): number {
    if (b === 0) {
      throw new Error('Cannot divide by zero');
    }
    return a / b;
  }

  calculate(op: Operation, a: number, b: number): number {
    switch (op) {
      case 'add':
        return this.add(a, b);
      case 'subtract':
        return this.subtract(a, b);
      case 'multiply':
        return this.multiply(a, b);
      case 'divide':
        return this.divide(a, b);
    }
  }

  factorial(n: number): number {
    if (!Number.isInteger(n) || n < 0) {
      throw new Error('Factorial needs a non-negative integer');
    }
    if (n > 170) {
      throw new Error('Result too large');
    }
    let result = 1;
    for (let i = 2; i <= n; i++) result *= i;
    return result;
  }

  /**
   * Evaluates an expression as shown on the display, e.g. "2sin(30)+√(16)×π".
   * Supports + − × ÷ ^ ! %, parentheses (missing ")" are auto-closed),
   * implicit multiplication, π, e, Ans and scientific notation (1.5E−3).
   */
  evaluate(expression: string, angleMode: AngleMode = 'rad', ans = 0): number {
    const tokens = this.tokenize(expression, ans);
    if (tokens.length === 0) {
      throw new Error('Empty expression');
    }
    const parser = new Parser(tokens, this, angleMode);
    const value = parser.parse();
    if (!Number.isFinite(value)) {
      throw new Error('Result is not a finite number');
    }
    return value;
  }

  private tokenize(input: string, ans: number): Token[] {
    const tokens: Token[] = [];
    const s = input.replace(/\s+/g, '');
    let i = 0;

    while (i < s.length) {
      const rest = s.slice(i);

      const num = /^(\d+\.?\d*|\.\d+)(E[−+-]?\d+)?/.exec(rest);
      if (num) {
        tokens.push({ type: 'num', value: Number(num[0].replace('−', '-')) });
        i += num[0].length;
        continue;
      }

      const func = FUNCTIONS.find((f) => rest.startsWith(f + '('));
      if (func) {
        tokens.push({ type: 'func', value: func }, { type: 'lparen' });
        i += func.length + 1;
        continue;
      }

      if (rest.startsWith('Ans')) {
        tokens.push({ type: 'num', value: ans });
        i += 3;
        continue;
      }

      const ch = s[i];
      i++;
      switch (ch) {
        case 'π':
          tokens.push({ type: 'num', value: Math.PI });
          break;
        case 'e':
          tokens.push({ type: 'num', value: Math.E });
          break;
        case '(':
          tokens.push({ type: 'lparen' });
          break;
        case ')':
          tokens.push({ type: 'rparen' });
          break;
        case '+':
        case '^':
        case '!':
        case '%':
          tokens.push({ type: 'op', value: ch });
          break;
        case '−':
        case '-':
          tokens.push({ type: 'op', value: '−' });
          break;
        case '×':
        case '*':
          tokens.push({ type: 'op', value: '×' });
          break;
        case '÷':
        case '/':
          tokens.push({ type: 'op', value: '÷' });
          break;
        default:
          throw new Error(`Unexpected "${ch}"`);
      }
    }
    return tokens;
  }
}

/** Recursive-descent parser. Precedence (low → high): + −, × ÷, unary −, ^, postfix ! %. */
class Parser {
  private pos = 0;

  constructor(
    private readonly tokens: Token[],
    private readonly calc: CalculatorService,
    private readonly angleMode: AngleMode,
  ) {}

  parse(): number {
    const value = this.expression();
    // Auto-close any parentheses the user left open.
    while (this.peek()?.type === 'rparen') this.pos++;
    if (this.pos < this.tokens.length) {
      throw new Error('Syntax error');
    }
    return value;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private isOp(value: string): boolean {
    const t = this.peek();
    return t?.type === 'op' && t.value === value;
  }

  private expression(): number {
    let value = this.term();
    while (this.isOp('+') || this.isOp('−')) {
      const op = (this.tokens[this.pos++] as { value: string }).value;
      const rhs = this.term();
      value = op === '+' ? this.calc.add(value, rhs) : this.calc.subtract(value, rhs);
    }
    return value;
  }

  private term(): number {
    let value = this.unary();
    for (;;) {
      if (this.isOp('×') || this.isOp('÷')) {
        const op = (this.tokens[this.pos++] as { value: string }).value;
        const rhs = this.unary();
        value = op === '×' ? this.calc.multiply(value, rhs) : this.calc.divide(value, rhs);
      } else if (this.startsOperand()) {
        // Implicit multiplication: 2π, 3(4), (1)(2), 2sin(30)
        value = this.calc.multiply(value, this.unary());
      } else {
        return value;
      }
    }
  }

  private startsOperand(): boolean {
    const t = this.peek();
    return t?.type === 'num' || t?.type === 'func' || t?.type === 'lparen';
  }

  private unary(): number {
    if (this.isOp('−')) {
      this.pos++;
      return -this.unary();
    }
    if (this.isOp('+')) {
      this.pos++;
      return this.unary();
    }
    return this.power();
  }

  private power(): number {
    const base = this.postfix();
    if (this.isOp('^')) {
      this.pos++;
      return Math.pow(base, this.unary()); // right-associative
    }
    return base;
  }

  private postfix(): number {
    let value = this.primary();
    for (;;) {
      if (this.isOp('!')) {
        this.pos++;
        value = this.calc.factorial(value);
      } else if (this.isOp('%')) {
        this.pos++;
        value = value / 100;
      } else {
        return value;
      }
    }
  }

  private primary(): number {
    const t = this.tokens[this.pos++];
    if (!t) throw new Error('Syntax error');

    switch (t.type) {
      case 'num':
        return t.value;
      case 'lparen':
        return this.group();
      case 'func':
        this.pos++; // skip the "(" that always follows a function
        return this.applyFunction(t.value, this.group());
      default:
        throw new Error('Syntax error');
    }
  }

  private group(): number {
    const value = this.expression();
    // expression() only stops at ")" or the end of input; a missing ")" is auto-closed.
    if (this.peek()?.type === 'rparen') this.pos++;
    return value;
  }

  private applyFunction(name: FunctionName, x: number): number {
    const toRad = (v: number) => (this.angleMode === 'deg' ? (v * Math.PI) / 180 : v);
    const fromRad = (v: number) => (this.angleMode === 'deg' ? (v * 180) / Math.PI : v);

    const functions: Record<FunctionName, (v: number) => number> = {
      sin: (v) => Math.sin(toRad(v)),
      cos: (v) => Math.cos(toRad(v)),
      tan: (v) => {
        if (Math.abs(Math.cos(toRad(v))) < 1e-12) throw new Error('Undefined');
        return Math.tan(toRad(v));
      },
      'sin⁻¹': (v) => fromRad(Math.asin(v)),
      'cos⁻¹': (v) => fromRad(Math.acos(v)),
      'tan⁻¹': (v) => fromRad(Math.atan(v)),
      ln: Math.log,
      log: Math.log10,
      '√': Math.sqrt,
    };
    return functions[name](x);
  }
}
