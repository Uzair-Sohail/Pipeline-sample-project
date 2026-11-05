import { TestBed } from '@angular/core/testing';
import { CalculatorService } from './calculator.service';

describe('CalculatorService', () => {
  let service: CalculatorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CalculatorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('add', () => {
    it('adds two positive numbers', () => {
      expect(service.add(2, 3)).toBe(5);
    });

    it('handles negative numbers', () => {
      expect(service.add(-4, 1)).toBe(-3);
    });
  });

  describe('subtract', () => {
    it('subtracts the second number from the first', () => {
      expect(service.subtract(10, 4)).toBe(6);
    });

    it('can return a negative result', () => {
      expect(service.subtract(3, 8)).toBe(-5);
    });
  });

  describe('multiply', () => {
    it('multiplies two numbers', () => {
      expect(service.multiply(6, 7)).toBe(42);
    });

    it('returns 0 when multiplied by 0', () => {
      expect(service.multiply(99, 0)).toBe(0);
    });
  });

  describe('divide', () => {
    it('divides two numbers', () => {
      expect(service.divide(20, 4)).toBe(5);
    });

    it('returns decimals', () => {
      expect(service.divide(1, 4)).toBeCloseTo(0.25);
    });

    it('throws when dividing by zero', () => {
      expect(() => service.divide(5, 0)).toThrowError('Cannot divide by zero');
    });
  });

  describe('calculate', () => {
    it('routes each operation to the right method', () => {
      expect(service.calculate('add', 2, 2)).toBe(4);
      expect(service.calculate('subtract', 2, 2)).toBe(0);
      expect(service.calculate('multiply', 2, 3)).toBe(6);
      expect(service.calculate('divide', 9, 3)).toBe(3);
    });

    it('calls divide() under the hood for "divide"', () => {
      const spy = spyOn(service, 'divide').and.callThrough();
      service.calculate('divide', 8, 2);
      expect(spy).toHaveBeenCalledOnceWith(8, 2);
    });
  });

  describe('factorial', () => {
    it('computes n!', () => {
      expect(service.factorial(0)).toBe(1);
      expect(service.factorial(6)).toBe(720);
    });

    it('rejects negative and non-integer input', () => {
      expect(() => service.factorial(-1)).toThrowError();
      expect(() => service.factorial(2.5)).toThrowError();
    });

    it('rejects input whose factorial overflows', () => {
      expect(service.factorial(170)).toBeGreaterThan(1e306);
      expect(() => service.factorial(171)).toThrowError('Result too large');
    });
  });

  describe('evaluate', () => {
    const ev = (expr: string, mode: 'deg' | 'rad' = 'rad', ans = 0) => service.evaluate(expr, mode, ans);

    it('respects operator precedence', () => {
      expect(ev('2+3×4')).toBe(14);
      expect(ev('10−4÷2')).toBe(8);
      expect(ev('(2+3)×4')).toBe(20);
    });

    it('treats ^ as right-associative and binding tighter than unary minus', () => {
      expect(ev('2^3^2')).toBe(512);
      expect(ev('−2^2')).toBe(-4);
      expect(ev('2^−1')).toBe(0.5);
    });

    it('supports implicit multiplication', () => {
      expect(ev('2π')).toBeCloseTo(2 * Math.PI);
      expect(ev('3(4)')).toBe(12);
      expect(ev('(1+1)(2+2)')).toBe(8);
      expect(ev('2√(9)')).toBe(6);
    });

    it('evaluates trig in degrees and radians', () => {
      expect(ev('sin(30)', 'deg')).toBeCloseTo(0.5);
      expect(ev('cos(π)', 'rad')).toBeCloseTo(-1);
      expect(ev('tan⁻¹(1)', 'deg')).toBeCloseTo(45);
      expect(ev('sin⁻¹(1)', 'rad')).toBeCloseTo(Math.PI / 2);
    });

    it('defaults to radians and Ans = 0', () => {
      expect(service.evaluate('cos(π)')).toBeCloseTo(-1);
      expect(service.evaluate('Ans+1')).toBe(1);
    });

    it('evaluates tan and cos⁻¹', () => {
      expect(ev('tan(45)', 'deg')).toBeCloseTo(1);
      expect(ev('cos⁻¹(0)', 'deg')).toBeCloseTo(90);
    });

    it('supports unary plus', () => {
      expect(ev('+3')).toBe(3);
      expect(ev('2×+3')).toBe(6);
    });

    it('throws for tan at an asymptote', () => {
      expect(() => ev('tan(90)', 'deg')).toThrowError('Undefined');
    });

    it('evaluates logs, roots, constants, ! and %', () => {
      expect(ev('ln(e)')).toBeCloseTo(1);
      expect(ev('log(1000)')).toBeCloseTo(3);
      expect(ev('√(16)')).toBe(4);
      expect(ev('4!')).toBe(24);
      expect(ev('50%')).toBe(0.5);
      expect(ev('200×10%')).toBe(20);
    });

    it('parses scientific notation', () => {
      expect(ev('1.5E3')).toBe(1500);
      expect(ev('2E−2')).toBe(0.02);
    });

    it('substitutes Ans', () => {
      expect(ev('Ans×2', 'rad', 21)).toBe(42);
    });

    it('auto-closes missing parentheses', () => {
      expect(ev('√(16')).toBe(4);
      expect(ev('2×(3+4')).toBe(14);
    });

    it('accepts ASCII operators', () => {
      expect(ev('6*7-2/2')).toBe(41);
    });

    it('throws on bad input', () => {
      expect(() => ev('')).toThrowError();
      expect(() => ev('2+')).toThrowError();
      expect(() => ev('2)')).not.toThrowError(); // stray ")" at the end is tolerated
      expect(() => ev('2)3')).toThrowError('Syntax error');
      expect(() => ev('×3')).toThrowError();
      expect(() => ev('5÷0')).toThrowError('Cannot divide by zero');
      expect(() => ev('ln(−1)')).toThrowError();
      expect(() => ev('abc')).toThrowError();
    });
  });
});
