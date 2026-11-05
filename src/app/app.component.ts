import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  inject,
  signal,
} from '@angular/core';
import { AngleMode, CalculatorService } from './calculator.service';

interface Key {
  id: string;
  label: string;
  /** Label shown while Inv is active (falls back to `label`). */
  invLabel?: string;
  style: 'fn' | 'num' | 'eq';
}

export interface HistoryEntry {
  expression: string;
  tokens: string[];
  result: string;
}

/** Operators that need a value on their left; after "=" they continue from Ans. */
const LEFT_OPERAND_OPS = ['+', '−', '×', '÷', '^', '^2', '!', '%'];
const BINARY_OPS = ['+', '−', '×', '÷'];

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  private readonly calculator = inject(CalculatorService);

  readonly keys: Key[] = [
    { id: 'fact', label: 'x!', style: 'fn' },
    { id: 'lparen', label: '(', style: 'fn' },
    { id: 'rparen', label: ')', style: 'fn' },
    { id: 'percent', label: '%', style: 'fn' },
    { id: 'clear', label: 'AC', style: 'fn' },

    { id: 'inv', label: 'Inv', style: 'fn' },
    { id: 'sin', label: 'sin', invLabel: 'sin⁻¹', style: 'fn' },
    { id: 'ln', label: 'ln', invLabel: 'eˣ', style: 'fn' },
    { id: '7', label: '7', style: 'num' },
    { id: '8', label: '8', style: 'num' },
    { id: '9', label: '9', style: 'num' },
    { id: 'divide', label: '÷', style: 'fn' },

    { id: 'pi', label: 'π', style: 'fn' },
    { id: 'cos', label: 'cos', invLabel: 'cos⁻¹', style: 'fn' },
    { id: 'log', label: 'log', invLabel: '10ˣ', style: 'fn' },
    { id: '4', label: '4', style: 'num' },
    { id: '5', label: '5', style: 'num' },
    { id: '6', label: '6', style: 'num' },
    { id: 'multiply', label: '×', style: 'fn' },

    { id: 'e', label: 'e', style: 'fn' },
    { id: 'tan', label: 'tan', invLabel: 'tan⁻¹', style: 'fn' },
    { id: 'sqrt', label: '√', invLabel: 'x²', style: 'fn' },
    { id: '1', label: '1', style: 'num' },
    { id: '2', label: '2', style: 'num' },
    { id: '3', label: '3', style: 'num' },
    { id: 'subtract', label: '−', style: 'fn' },

    { id: 'ans', label: 'Ans', invLabel: 'Rnd', style: 'fn' },
    { id: 'exp', label: 'EXP', style: 'fn' },
    { id: 'pow', label: 'xʸ', style: 'fn' },
    { id: '0', label: '0', style: 'num' },
    { id: 'dot', label: '.', style: 'num' },
    { id: 'equals', label: '=', style: 'eq' },
    { id: 'add', label: '+', style: 'fn' },
  ];

  readonly tokens = signal<string[]>([]);
  readonly angleMode = signal<AngleMode>('deg');
  readonly inverse = signal(false);
  readonly ans = signal(0);
  readonly error = signal(false);
  readonly justEvaluated = signal(false);
  readonly lastExpression = signal<string | null>(null);
  readonly history = signal<HistoryEntry[]>([]);
  readonly showHistory = signal(false);

  readonly display = computed(() => {
    if (this.error()) return 'Error';
    if (this.justEvaluated()) return this.format(this.ans());
    return this.tokens().join('') || '0';
  });

  /** Small line above the main display, like "12+3 =" or "Ans = 15". */
  readonly subline = computed(() => {
    if (this.justEvaluated() || this.error()) {
      return `${this.lastExpression()} =`;
    }
    return this.lastExpression() !== null ? `Ans = ${this.format(this.ans())}` : '';
  });

  readonly clearLabel = computed(() =>
    this.justEvaluated() || this.error() || this.tokens().length === 0 ? 'AC' : 'CE',
  );

  labelFor(key: Key): string {
    if (key.id === 'clear') return this.clearLabel();
    return this.inverse() && key.invLabel ? key.invLabel : key.label;
  }

  setAngleMode(mode: AngleMode): void {
    this.angleMode.set(mode);
  }

  press(id: string): void {
    const inv = this.inverse();
    switch (id) {
      case 'clear':
        return this.clearLabel() === 'AC' ? this.allClear() : this.backspace();
      case 'inv':
        return this.inverse.update((v) => !v);
      case 'equals':
        return this.evaluate();
      case 'fact':
        return this.insert('!');
      case 'lparen':
        return this.insert('(');
      case 'rparen':
        return this.insert(')');
      case 'percent':
        return this.insert('%');
      case 'divide':
        return this.insert('÷');
      case 'multiply':
        return this.insert('×');
      case 'subtract':
        return this.insert('−');
      case 'add':
        return this.insert('+');
      case 'pow':
        return this.insert('^');
      case 'pi':
        return this.insert('π');
      case 'e':
        return this.insert('e');
      case 'dot':
        return this.insert('.');
      case 'exp':
        return this.insert('E');
      case 'sin':
      case 'cos':
      case 'tan':
        return this.insert(inv ? `${id}⁻¹(` : `${id}(`);
      case 'ln':
        return inv ? this.insert('e', '^(') : this.insert('ln(');
      case 'log':
        return inv ? this.insert('10^(') : this.insert('log(');
      case 'sqrt':
        return this.insert(inv ? '^2' : '√(');
      case 'ans':
        return this.insert(inv ? String(Math.round(Math.random() * 1e7) / 1e7) : 'Ans');
      default:
        if (/^\d$/.test(id)) this.insert(id);
    }
  }

  private insert(...newTokens: string[]): void {
    const first = newTokens[0];

    if (this.error()) {
      this.tokens.set([]);
      this.error.set(false);
    }
    if (this.justEvaluated()) {
      // After "=", operators continue from the answer; anything else starts fresh.
      this.tokens.set(LEFT_OPERAND_OPS.includes(first) ? ['Ans'] : []);
      this.justEvaluated.set(false);
    }

    const current = this.tokens();
    const last = current[current.length - 1];

    if (first === '.' && this.currentNumberHasDot(current)) return;
    if (first === 'E' && !(last && /^[\d.]$/.test(last))) return;

    // A multi-digit literal right after a digit would merge with it ("2" + "10^(" → "210^(").
    if (first.length > 1 && /^\d/.test(first) && last && /[\d.]$/.test(last)) {
      newTokens = ['×', ...newTokens];
    }

    // Pressing a different binary operator replaces the previous one (but allow "×−" for negatives).
    if (BINARY_OPS.includes(first) && BINARY_OPS.includes(last ?? '') && first !== '−') {
      this.tokens.set([...current.slice(0, -1), ...newTokens]);
      return;
    }

    this.tokens.set([...current, ...newTokens]);
  }

  private currentNumberHasDot(tokens: string[]): boolean {
    for (let i = tokens.length - 1; i >= 0; i--) {
      if (tokens[i] === '.') return true;
      if (!/^\d$/.test(tokens[i])) return false;
    }
    return false;
  }

  backspace(): void {
    if (this.justEvaluated() || this.error()) return this.allClear();
    this.tokens.update((t) => t.slice(0, -1));
  }

  allClear(): void {
    this.tokens.set([]);
    this.error.set(false);
    this.justEvaluated.set(false);
  }

  evaluate(): void {
    const tokens = this.tokens();
    if (tokens.length === 0 || this.justEvaluated() || this.error()) return;

    // Show auto-closed parentheses in the expression line, like Google does.
    const open = tokens.join('').split('(').length - tokens.join('').split(')').length;
    const expression = tokens.join('') + ')'.repeat(Math.max(0, open));
    this.lastExpression.set(expression);

    try {
      const value = this.round(this.calculator.evaluate(expression, this.angleMode(), this.ans()));
      this.ans.set(value);
      this.justEvaluated.set(true);
      this.history.update((h) => [{ expression, tokens, result: this.format(value) }, ...h].slice(0, 20));
    } catch {
      this.error.set(true);
    }
  }

  toggleHistory(): void {
    this.showHistory.update((v) => !v);
  }

  restore(entry: HistoryEntry): void {
    this.tokens.set([...entry.tokens]);
    this.error.set(false);
    this.justEvaluated.set(false);
    this.showHistory.set(false);
  }

  /** Trims floating-point noise: 0.1+0.2 → 0.3, sin(180°) → 0. Also turns −0 into 0. */
  private round(value: number): number {
    return parseFloat(value.toPrecision(12));
  }

  format(value: number): string {
    const abs = Math.abs(value);
    const text =
      abs !== 0 && (abs >= 1e15 || abs < 1e-9)
        ? value.toExponential().replace('e+', 'E').replace('e', 'E')
        : String(value);
    return text.replace(/-/g, '−');
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const map: Record<string, string> = {
      '+': 'add',
      '-': 'subtract',
      '*': 'multiply',
      x: 'multiply',
      '/': 'divide',
      '^': 'pow',
      '(': 'lparen',
      ')': 'rparen',
      '%': 'percent',
      '!': 'fact',
      '.': 'dot',
      ',': 'dot',
      p: 'pi',
      e: 'e',
      '=': 'equals',
      Enter: 'equals',
    };

    if (event.key === 'Backspace') {
      this.backspace();
    } else if (event.key === 'Escape' || event.key === 'Delete') {
      this.allClear();
    } else if (/^\d$/.test(event.key)) {
      this.press(event.key);
    } else if (map[event.key]) {
      this.press(map[event.key]);
    } else {
      return;
    }
    event.preventDefault();
  }
}
