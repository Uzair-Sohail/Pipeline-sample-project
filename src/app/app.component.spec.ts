import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { CalculatorService } from './calculator.service';

describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;
  let component: AppComponent;
  let el: HTMLElement;

  // Helper: find an element by its data-testid attribute
  const byTestId = <T extends HTMLElement>(id: string) =>
    el.querySelector(`[data-testid="${id}"]`) as T | null;

  // Helper: click a sequence of keypad buttons, e.g. press('1', 'add', '2', 'equals')
  const press = (...ids: string[]) => {
    ids.forEach((id) => byTestId<HTMLButtonElement>(`key-${id}`)!.click());
    fixture.detectChanges();
  };

  const display = () => byTestId('display')!.textContent!.trim();
  const subline = () => byTestId('subline')!.textContent!.trim();

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('should create the app', () => {
    expect(component).toBeTruthy();
  });

  it('renders the full scientific keypad (33 keys + Deg/Rad)', () => {
    expect(el.querySelectorAll('.keypad button').length).toBe(35);
  });

  it('shows 0 and AC initially', () => {
    expect(display()).toBe('0');
    expect(byTestId('key-clear')!.textContent!.trim()).toBe('AC');
  });

  it('builds the expression as keys are pressed', () => {
    press('1', '2', 'add', '3');
    expect(display()).toBe('12+3');
    expect(byTestId('key-clear')!.textContent!.trim()).toBe('CE');
  });

  const cases = [
    { keys: ['1', '2', 'add', '3', 'equals'], expected: '15' },
    { keys: ['1', '2', 'subtract', '3', 'equals'], expected: '9' },
    { keys: ['1', '2', 'multiply', '3', 'equals'], expected: '36' },
    { keys: ['1', '2', 'divide', '3', 'equals'], expected: '4' },
    { keys: ['2', 'add', '3', 'multiply', '4', 'equals'], expected: '14' },
    { keys: ['lparen', '2', 'add', '3', 'rparen', 'multiply', '4', 'equals'], expected: '20' },
    { keys: ['sin', '3', '0', 'equals'], expected: '0.5' },
    { keys: ['5', 'fact', 'equals'], expected: '120' },
    { keys: ['2', 'pow', '1', '0', 'equals'], expected: '1024' },
    { keys: ['sqrt', '8', '1', 'equals'], expected: '9' },
    { keys: ['log', '1', '0', '0', '0', 'equals'], expected: '3' },
    { keys: ['5', '0', 'percent', 'equals'], expected: '0.5' },
    { keys: ['2', 'pi', 'equals'], expected: String(parseFloat((2 * Math.PI).toPrecision(12))) },
    { keys: ['1', 'exp', '3', 'equals'], expected: '1000' },
    { keys: ['dot', '1', 'add', 'dot', '2', 'equals'], expected: '0.3' },
  ];

  cases.forEach(({ keys, expected }) => {
    it(`${keys.join(' ')} → ${expected}`, () => {
      press(...keys);
      expect(display()).toBe(expected);
    });
  });

  it('shows the evaluated expression above the result', () => {
    press('1', '2', 'add', '3', 'equals');
    expect(subline()).toBe('12+3 =');
  });

  it('auto-closes open parentheses', () => {
    press('cos', '6', '0', 'equals');
    expect(subline()).toBe('cos(60) =');
    expect(display()).toBe('0.5');
  });

  it('respects Rad mode', () => {
    press('rad', 'cos', 'pi', 'equals');
    expect(display()).toBe('−1');
  });

  it('Inv switches function labels and behaviour', () => {
    press('inv');
    expect(byTestId('key-sin')!.textContent!.trim()).toBe('sin⁻¹');
    expect(byTestId('key-sqrt')!.textContent!.trim()).toBe('x²');

    press('sin', '1', 'equals');
    expect(display()).toBe('90');

    press('3', 'sqrt', 'equals');
    expect(display()).toBe('9');
  });

  it('continues from Ans when an operator follows a result', () => {
    press('2', 'add', '3', 'equals', 'multiply', '2');
    expect(display()).toBe('Ans×2');
    expect(subline()).toBe('Ans = 5');
    press('equals');
    expect(display()).toBe('10');
  });

  it('starts a fresh expression when a digit follows a result', () => {
    press('2', 'add', '3', 'equals', '7');
    expect(display()).toBe('7');
  });

  it('shows Error for invalid input and recovers on the next key', () => {
    press('5', 'divide', '0', 'equals');
    expect(display()).toBe('Error');
    press('4');
    expect(display()).toBe('4');
  });

  it('CE deletes one token and AC clears everything', () => {
    press('1', '2', 'sin');
    expect(display()).toBe('12sin(');
    press('clear');
    expect(display()).toBe('12');
    press('equals', 'clear');
    expect(display()).toBe('0');
  });

  it('ignores a second decimal point in the same number', () => {
    press('1', 'dot', '5', 'dot', '2');
    expect(display()).toBe('1.52');
  });

  it('replaces a trailing operator with the new one', () => {
    press('8', 'add', 'multiply', '2', 'equals');
    expect(display()).toBe('16');
  });

  it('records history and restores an entry', () => {
    press('4', 'multiply', '4', 'equals');
    byTestId<HTMLButtonElement>('btn-history')!.click();
    fixture.detectChanges();

    const item = byTestId('history')!.querySelector('button')!;
    expect(item.textContent).toContain('4×4 =');
    expect(item.textContent).toContain('16');

    item.click();
    fixture.detectChanges();
    expect(display()).toBe('4×4');
  });

  it('inserts e, ln, Ans and the inverse eˣ / 10ˣ functions', () => {
    press('e');
    expect(display()).toBe('e');
    press('clear', 'ln', 'e', 'equals');
    expect(display()).toBe('1');

    press('ans', 'add', '1', 'equals');
    expect(display()).toBe('2');

    press('inv', 'ln', '2');
    expect(display()).toBe('e^(2');

    press('clear', 'clear', 'clear', 'clear', 'log', '3', 'equals');
    expect(subline()).toBe('10^(3) =');
    expect(display()).toBe('1000');
  });

  it('adds × before 10ˣ and Rnd when they follow a digit', () => {
    press('2', 'inv', 'log', '3', 'equals');
    expect(subline()).toBe('2×10^(3) =');
    expect(display()).toBe('2000');

    spyOn(Math, 'random').and.returnValue(0.25);
    press('4', 'ans');
    expect(display()).toBe('4×0.25');
  });

  it('ignores EXP when it does not follow a number', () => {
    press('exp', 'pi', 'exp');
    expect(display()).toBe('π');
  });

  it('allows a leading operator', () => {
    press('add', '5', 'equals');
    expect(display()).toBe('5');
  });

  it('does nothing when = is pressed with nothing new to evaluate', () => {
    press('equals');
    expect(display()).toBe('0');
    expect(subline()).toBe('');

    press('3', 'equals', 'equals');
    expect(display()).toBe('3');
    expect(component.history().length).toBe(1);
  });

  it('shows 0 rather than −0', () => {
    press('subtract', '0', 'equals');
    expect(display()).toBe('0');
  });

  it('formats very large and very small results in E notation', () => {
    press('1', 'exp', '2', '0', 'equals');
    expect(display()).toBe('1E20');
    press('1', 'exp', 'subtract', '1', '0', 'equals');
    expect(display()).toBe('1E−10');
  });

  describe('keyboard', () => {
    const key = (k: string, init: KeyboardEventInit = {}) => {
      const event = new KeyboardEvent('keydown', { key: k, cancelable: true, ...init });
      document.dispatchEvent(event);
      fixture.detectChanges();
      return event;
    };

    it('types and evaluates', () => {
      ['9', '-', '4', 'Enter'].forEach((k) => key(k));
      expect(display()).toBe('5');
    });

    it('Backspace deletes a token, or clears after a result', () => {
      ['1', '2'].forEach((k) => key(k));
      key('Backspace');
      expect(display()).toBe('1');
      key('Enter');
      key('Backspace');
      expect(display()).toBe('0');
    });

    it('Escape clears everything', () => {
      ['7', '+'].forEach((k) => key(k));
      key('Escape');
      expect(display()).toBe('0');
    });

    it('ignores unmapped keys and shortcuts with modifiers', () => {
      expect(key('a').defaultPrevented).toBeFalse();
      expect(key('1', { ctrlKey: true }).defaultPrevented).toBeFalse();
      expect(display()).toBe('0');
      expect(key('1').defaultPrevented).toBeTrue();
    });
  });
});

// Isolated version: the service is replaced with a Jasmine spy,
// so this only tests the component's own behaviour.
describe('AppComponent (with mocked service)', () => {
  let calcSpy: jasmine.SpyObj<CalculatorService>;

  beforeEach(async () => {
    calcSpy = jasmine.createSpyObj<CalculatorService>('CalculatorService', ['evaluate']);

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [{ provide: CalculatorService, useValue: calcSpy }],
    }).compileComponents();
  });

  it('delegates to CalculatorService.evaluate with the expression, angle mode and Ans', () => {
    calcSpy.evaluate.and.returnValue(100);
    const component = TestBed.createComponent(AppComponent).componentInstance;

    ['4', '0', 'add', '6', '0', 'equals'].forEach((id) => component.press(id));

    expect(calcSpy.evaluate).toHaveBeenCalledOnceWith('40+60', 'deg', 0);
    expect(component.ans()).toBe(100);
  });
});
