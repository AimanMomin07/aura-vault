import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './app';

describe('AuraVault calculator', () => {
  let app: App;

  beforeEach(() => {
    localStorage.clear();
    app = new App();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    localStorage.clear();
  });

  it('calculates the default monthly payment and affordability ratio', () => {
    expect(app.base.emi).toBeCloseTo(69_426, 0);
    expect(app.foir).toBeCloseTo(31.6, 0);
    expect(app.stressStatus).toBe('Comfortable');
  });

  it('aggregates amortization by year and reduces interest with prepayments', () => {
    app.extraMonthly = 5_000;
    app.recalculate();

    expect(app.plan.totalInterest).toBeLessThan(app.base.totalInterest);
    expect(app.scheduleRows.length).toBeLessThan(app.tenure);
    expect(app.scheduleRows.at(-1)?.closing).toBe(0);
    expect(
      app.scheduleRows.reduce((sum, row) => sum + row.interest, 0)
    ).toBeCloseTo(app.plan.totalInterest, 5);
  });

  it('marks FOIR unavailable when monthly income is zero', () => {
    app.income = 0;

    expect(app.foir).toBeNull();
    expect(app.stressStatus).toBe('Add monthly income');
  });

  it('saves and restores a loan scenario without stale prepayments', () => {
    vi.useFakeTimers();
    app.scenarioName = 'Starter home';
    app.saveScenario();

    const saved = app.scenarios[0];
    expect(saved?.name).toBe('Starter home');
    expect(JSON.parse(localStorage.getItem('auravault-scenarios') ?? '[]')).toHaveLength(1);

    app.property = 20_000_000;
    app.extraMonthly = 5_000;
    app.recalculate();
    if (!saved) throw new Error('Expected the scenario to be saved');
    app.loadScenario(saved);

    expect(app.property).toBe(10_000_000);
    expect(app.extraMonthly).toBe(0);
    expect(app.plan.totalInterest).toBeCloseTo(app.base.totalInterest, 2);
  });
});
