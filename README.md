# AuraVault — Wealth Intelligence

An Angular mortgage-planning dashboard for exploring loan costs, affordability, and homeownership scenarios.

## Features

- Live EMI, total-interest, loan-to-value, and estimated cash-to-close calculations
- Adjustable property value, down payment, rate, and tenure
- Prepayment planner with monthly extras, annual lump sums, and annual EMI step-ups
- Yearly amortization schedule with CSV export
- Buy-versus-rent model with an amortizing loan, home appreciation, rent inflation, maintenance, and invested cash-flow differences
- FOIR affordability view and an interest-rate shock test
- Indicative India home, personal, car, two-wheeler, and gold loan comparisons
- **Scenario Vault:** name, save, compare, reload, and remove up to 12 scenarios, stored locally in the current browser
- INR, USD, EUR, and GBP display formats, plus light/dark themes
- Responsive desktop and mobile layouts

## Run locally

Requires Node.js 20.19+ or 22.12+ and npm.

```bash
npm install
npm start
```

Open the local URL printed by Angular CLI (usually `http://localhost:4200`). Run `npm test` for the calculator unit tests. For a production build, run `npm run build`; output is written to `dist/`.

## Deploy to Netlify

The recommended option is to import this GitHub repository into Netlify. Choose **Add new site → Import an existing project**, connect GitHub, select `AimanMomin07/aura-vault`, and deploy the `main` branch. Netlify reads `netlify.toml` for the build command and publish directory.

For a manual drag-and-drop deploy, run `npm install` and `npm run build`, then drag the **`dist/auravault/browser`** folder into Netlify's manual deploy area. Do not drag the project root or the parent `dist/auravault` folder; Netlify needs `index.html` at the root of the folder you upload.

## Project structure

```text
AuraVault-Calculator/
├── src/
│   ├── app/
│   │   ├── app.ts
│   │   ├── app.html
│   │   └── app.css
│   ├── index.html
│   └── styles.css
├── css/
│   └── style.css
├── netlify.toml
├── angular.json
└── package.json
```

## Assumptions and limitations

- Currency selection changes number formatting only; it does not convert INR-based assumptions using exchange rates.
- The buy-versus-rent view is illustrative, uses user-entered annual assumptions, estimates maintenance at 1% of property value, and does not model taxes, transaction fees beyond the closing-cost estimate, or changing investment returns.
- Closing costs are estimated at 1.2% of property value. Actual lender, legal, tax, insurance, and maintenance costs vary.
- Loan-product rate bands are indicative labels, not live lender offers. Confirm rates, fees, tax rules, eligibility, and prepayment terms with the relevant lender.
- Scenario data is saved in browser local storage on this device. Clearing site data removes saved scenarios.
- AuraVault is a planning tool, not financial advice or a loan offer.
