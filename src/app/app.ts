import { AfterViewInit, Component, ElementRef, HostListener, ViewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

type Currency = 'INR' | 'USD' | 'EUR' | 'GBP';
type Page = 'overview' | 'prepayment' | 'buyrent' | 'stress' | 'india' | 'vault';

interface PaymentRow {
  month: number;
  opening: number;
  principal: number;
  interest: number;
  prepayment: number;
  closing: number;
}

interface Amortization {
  rows: PaymentRow[];
  totalInterest: number;
  months: number;
  emi: number;
}

interface Scenario {
  id: string;
  name: string;
  savedAt: string;
  property: number;
  margin: number;
  rate: number;
  tenure: number;
  currency: Currency;
  emi: number;
  interest: number;
  downPayment: number;
  foir: number | null;
}

@Component({
  selector: 'app-root',
  imports: [DatePipe, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements AfterViewInit {
  readonly Math = Math;
  @ViewChild('buyRentChart') private buyRentChart?: ElementRef<HTMLCanvasElement>;

  readonly pages: { id: Page; icon: string; label: string }[] = [
    { id: 'overview', icon: '◫', label: 'Overview' },
    { id: 'prepayment', icon: '↗', label: 'Prepayment' },
    { id: 'buyrent', icon: '⇄', label: 'Buy vs rent' },
    { id: 'stress', icon: '◇', label: 'Stress test' },
    { id: 'india', icon: '₹', label: 'India loan suite' },
    { id: 'vault', icon: '▤', label: 'Scenario vault' }
  ];
  readonly currencies: Currency[] = ['INR', 'USD', 'EUR', 'GBP'];
  readonly products = [
    { name: 'Home Loan', category: 'HOME', rate: 8.5, range: '8.00% – 10.50% p.a.' },
    { name: 'Personal Loan', category: 'PERSONAL', rate: 14, range: '10.50% – 24.00% p.a.' },
    { name: 'Car Loan', category: 'CAR', rate: 10, range: '8.50% – 13.00% p.a.' },
    { name: 'Two-Wheeler Loan', category: 'BIKE', rate: 12, range: '9.00% – 18.00% p.a.' },
    { name: 'Gold Loan', category: 'GOLD', rate: 9.5, range: '7.00% – 12.00% p.a.' }
  ];

  page: Page = 'overview';
  currency: Currency = 'INR';
  property = 10_000_000;
  margin = 20;
  rate = 8.5;
  tenure = 20;
  ownership = false;
  dark = false;
  extraMonthly = 0;
  lumpSum = 0;
  stepUp = 0;
  rent = 28_000;
  rentInflation = 6;
  appreciation = 7;
  sipReturn = 12;
  income = 220_000;
  existingEmi = 0;
  shock = 2;
  selectedProduct = 'Home Loan';
  scenarioName = '';
  scenarios: Scenario[] = [];
  toastMessage = '';
  base!: Amortization;
  plan!: Amortization;
  toastTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    this.loadScenarios();
    this.recalculate();
  }

  ngAfterViewInit(): void {
    this.drawBuyRent();
  }

  get principal(): number {
    return this.property * (1 - this.margin / 100);
  }

  get downPayment(): number {
    return this.property * this.margin / 100;
  }

  get savedInterest(): number {
    return Math.max(0, this.base.totalInterest - this.plan.totalInterest);
  }

  get monthsSaved(): number {
    return Math.max(0, this.base.months - this.plan.months);
  }

  get ownershipCost(): number {
    return this.ownership ? this.property * 0.012 : 0;
  }

  get foir(): number | null {
    return this.income > 0 ? ((this.existingEmi + this.base.emi) / this.income) * 100 : null;
  }

  get scheduleRows(): PaymentRow[] {
    const annualRows: PaymentRow[] = [];
    for (let start = 0; start < this.plan.rows.length; start += 12) {
      const year = this.plan.rows.slice(start, start + 12);
      const first = year[0];
      const last = year[year.length - 1];
      if (!first || !last) continue;
      annualRows.push({
        month: last.month,
        opening: first.opening,
        principal: year.reduce((sum, row) => sum + row.principal, 0),
        interest: year.reduce((sum, row) => sum + row.interest, 0),
        prepayment: year.reduce((sum, row) => sum + row.prepayment, 0),
        closing: last.closing
      });
    }
    return annualRows;
  }

  get stressedEmi(): number {
    return this.emiFor(this.principal, this.rate + this.shock, this.tenure * 12);
  }

  get disposableIncome(): number {
    return this.income - this.existingEmi - this.base.emi;
  }

  get stressStatus(): string {
    if (this.foir === null) return 'Add monthly income';
    return this.foir < 40 ? 'Comfortable' : this.foir < 55 ? 'Moderate' : 'High risk';
  }

  get payoffDate(): Date {
    const date = new Date();
    date.setMonth(date.getMonth() + this.plan.months);
    return date;
  }

  get selectedProductRate(): number {
    return this.rate;
  }

  money(value: number, currency = this.currency): string {
    return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0
    }).format(Number.isFinite(value) ? value : 0);
  }

  compact(value: number, currency = this.currency): string {
    const symbol: Record<Currency, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };
    const absolute = Math.abs(value);
    if (currency === 'INR' && absolute >= 10_000_000) return `${symbol[currency]}${(value / 10_000_000).toFixed(2)} Cr`;
    if (currency === 'INR' && absolute >= 100_000) return `${symbol[currency]}${(value / 100_000).toFixed(2)} L`;
    if (absolute >= 1_000_000) return `${symbol[currency]}${(value / 1_000_000).toFixed(2)} M`;
    if (absolute >= 1_000) return `${symbol[currency]}${Math.round(value).toLocaleString('en-US')}`;
    return `${symbol[currency]}${Math.round(value)}`;
  }

  setPage(page: Page): void {
    this.page = page;
    if (page === 'buyrent') requestAnimationFrame(() => this.drawBuyRent());
  }

  setCurrency(currency: Currency): void {
    this.currency = currency;
    this.recalculate();
  }

  setProduct(name: string): void {
    const product = this.products.find(item => item.name === name);
    if (!product) return;
    this.selectedProduct = name;
    this.rate = product.rate;
    this.recalculate();
  }

  recalculate(): void {
    this.base = this.amortize(this.principal, this.rate, this.tenure * 12);
    this.plan = this.amortize(
      this.principal,
      this.rate,
      this.tenure * 12,
      this.extraMonthly,
      this.lumpSum,
      this.stepUp
    );
    if (this.page === 'buyrent') requestAnimationFrame(() => this.drawBuyRent());
  }

  reset(): void {
    this.property = 10_000_000;
    this.margin = 20;
    this.rate = 8.5;
    this.tenure = 20;
    this.ownership = false;
    this.extraMonthly = 0;
    this.lumpSum = 0;
    this.stepUp = 0;
    this.selectedProduct = 'Home Loan';
    this.recalculate();
    this.notify('Loan parameters reset');
  }

  toggleTheme(): void {
    this.dark = !this.dark;
    document.body.classList.toggle('dark', this.dark);
  }

  saveScenario(): void {
    if (this.scenarios.length >= 12) {
      this.notify('Your vault is full. Remove a scenario before saving another.');
      return;
    }

    const scenario: Scenario = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: this.scenarioName.trim() || `Scenario ${this.scenarios.length + 1}`,
      savedAt: new Date().toISOString(),
      property: this.property,
      margin: this.margin,
      rate: this.rate,
      tenure: this.tenure,
      currency: this.currency,
      emi: this.base.emi,
      interest: this.base.totalInterest,
      downPayment: this.downPayment,
      foir: this.foir
    };

    const updated = [...this.scenarios, scenario];
    if (this.persistScenarios(updated)) {
      this.scenarios = updated;
      this.scenarioName = '';
      this.notify(`“${scenario.name}” added to your Scenario Vault`);
    }
  }

  loadScenario(scenario: Scenario): void {
    this.property = scenario.property;
    this.margin = scenario.margin;
    this.rate = scenario.rate;
    this.tenure = scenario.tenure;
    this.currency = scenario.currency;
    this.extraMonthly = 0;
    this.lumpSum = 0;
    this.stepUp = 0;
    this.ownership = false;
    this.recalculate();
    this.setPage('overview');
    this.notify(`“${scenario.name}” loaded`);
  }

  removeScenario(id: string): void {
    const updated = this.scenarios.filter(scenario => scenario.id !== id);
    if (this.persistScenarios(updated)) {
      this.scenarios = updated;
      this.notify('Scenario removed from your vault');
    }
  }

  exportCsv(): void {
    const lines = [
      'Period,Opening balance,Principal,Interest,Prepayment,Closing balance',
      ...this.plan.rows.map(row => [
        row.month,
        row.opening.toFixed(2),
        row.principal.toFixed(2),
        row.interest.toFixed(2),
        row.prepayment.toFixed(2),
        row.closing.toFixed(2)
      ].join(','))
    ];
    this.download(lines.join('\n'), 'auravault-amortization.csv', 'text/csv');
    this.notify('Amortization schedule exported');
  }

  async shareScenario(): Promise<void> {
    const summary = `AuraVault scenario | Property: ${this.money(this.property)} | Loan: ${this.money(this.principal)} | Rate: ${this.rate}% | Tenure: ${this.tenure} years | EMI: ${this.money(this.base.emi)} | Total interest: ${this.compact(this.base.totalInterest)}`;
    try {
      await navigator.clipboard.writeText(summary);
      this.notify('Scenario summary copied');
    } catch {
      this.notify('Clipboard access is unavailable in this browser.');
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    if (this.page === 'buyrent') this.drawBuyRent();
  }

  private loadScenarios(): void {
    try {
      const saved = localStorage.getItem('auravault-scenarios');
      if (!saved) return;
      const parsed: unknown = JSON.parse(saved);
      if (!Array.isArray(parsed) || !parsed.every(item => this.isScenario(item))) {
        this.notify('Saved scenarios could not be read because their data is invalid.');
        return;
      }
      this.scenarios = parsed;
    } catch {
      this.notify('Saved scenarios could not be loaded from this browser.');
    }
  }

  private isScenario(value: unknown): value is Scenario {
    if (typeof value !== 'object' || value === null) return false;
    const scenario = value as Record<string, unknown>;
    return typeof scenario['id'] === 'string'
      && typeof scenario['name'] === 'string'
      && typeof scenario['savedAt'] === 'string'
      && ['INR', 'USD', 'EUR', 'GBP'].includes(String(scenario['currency']))
      && ['property', 'margin', 'rate', 'tenure', 'emi', 'interest', 'downPayment']
        .every(key => typeof scenario[key] === 'number' && Number.isFinite(scenario[key]))
      && (scenario['foir'] === null
        || (typeof scenario['foir'] === 'number' && Number.isFinite(scenario['foir'])));
  }

  private persistScenarios(scenarios: Scenario[]): boolean {
    try {
      localStorage.setItem('auravault-scenarios', JSON.stringify(scenarios));
      return true;
    } catch {
      this.notify('Could not save your scenario. Check browser storage and try again.');
      return false;
    }
  }

  private emiFor(principal: number, annualRate: number, months: number): number {
    if (months <= 0) return 0;
    const monthlyRate = annualRate / 1200;
    if (monthlyRate === 0) return principal / months;
    const growth = (1 + monthlyRate) ** months;
    return principal * monthlyRate * growth / (growth - 1);
  }

  private amortize(
    principal: number,
    annualRate: number,
    months: number,
    extra = 0,
    lump = 0,
    stepUp = 0
  ): Amortization {
    const emi = this.emiFor(principal, annualRate, months);
    const rows: PaymentRow[] = [];
    let balance = principal;
    let totalInterest = 0;
    let currentEmi = emi;

    while (balance > 0.01 && rows.length < months + 240) {
      const month = rows.length + 1;
      if (month > 1 && (month - 1) % 12 === 0) currentEmi *= 1 + stepUp / 100;
      const opening = balance;
      const interest = balance * annualRate / 1200;
      const scheduledPayment = Math.min(balance + interest, currentEmi);
      const principalPaid = Math.min(balance, scheduledPayment - interest);
      const availablePrepayment = Math.max(0, balance - principalPaid);
      const prepayment = Math.min(availablePrepayment, extra + (month % 12 === 0 ? lump : 0));
      balance = Math.max(0, balance - principalPaid - prepayment);
      totalInterest += interest;
      rows.push({ month, opening, principal: principalPaid, interest, prepayment, closing: balance });
    }

    return { rows, totalInterest, months: rows.length, emi };
  }

  private drawBuyRent(): void {
    const canvas = this.buyRentChart?.nativeElement;
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    if (bounds.width < 1 || bounds.height < 1) return;

    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(300, Math.round(bounds.width * ratio));
    canvas.height = Math.max(160, Math.round(bounds.height * ratio));
    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    const buy: number[] = [];
    const rentAndInvest: number[] = [];
    const monthlyRate = this.rate / 1200;
    const investmentRate = this.sipReturn / 1200;
    const maintenance = this.property * 0.01 / 12;
    let homeValue = this.property;
    let loanBalance = this.principal;
    let rentalPortfolio = this.downPayment + this.property * 0.012;
    let ownerPortfolio = 0;
    let rent = this.rent;
    const monthlyEmi = this.base.emi;

    for (let month = 0; month <= 240; month++) {
      if (month > 0) {
        const interest = loanBalance * monthlyRate;
        const principalPaid = Math.min(loanBalance, Math.max(0, monthlyEmi - interest));
        loanBalance = Math.max(0, loanBalance - principalPaid);
        homeValue *= 1 + this.appreciation / 100 / 12;
        rent *= 1 + this.rentInflation / 100 / 12;
        rentalPortfolio = rentalPortfolio * (1 + investmentRate) + Math.max(0, monthlyEmi + maintenance - rent);
        ownerPortfolio = ownerPortfolio * (1 + investmentRate) + Math.max(0, rent - monthlyEmi - maintenance);
      }
      if (month % 12 === 0) {
        buy.push(homeValue - loanBalance + ownerPortfolio);
        rentAndInvest.push(rentalPortfolio);
      }
    }

    const width = bounds.width;
    const height = bounds.height;
    const left = 12;
    const right = 10;
    const top = 10;
    const bottom = 15;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const max = Math.max(...buy, ...rentAndInvest, 1) * 1.12;
    const styles = getComputedStyle(document.body);
    context.clearRect(0, 0, width, height);
    context.strokeStyle = styles.getPropertyValue('--line');
    context.lineWidth = 1;
    for (let line = 1; line <= 3; line++) {
      const y = top + plotHeight * line / 4;
      context.beginPath();
      context.moveTo(left, y);
      context.lineTo(width - right, y);
      context.stroke();
    }
    const drawLine = (values: number[], color: string): void => {
      context.beginPath();
      values.forEach((value, index) => {
        const x = left + index * plotWidth / (values.length - 1);
        const y = top + plotHeight - value / max * plotHeight;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.strokeStyle = color;
      context.lineWidth = 2.4;
      context.stroke();
    };
    drawLine(buy, '#263f68');
    drawLine(rentAndInvest, '#d5a34e');
  }

  private download(content: string, name: string, type: string): void {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private notify(message: string): void {
    this.toastMessage = message;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastMessage = '', 3000);
  }
}
