# Sample output: spreadsheet-builder — Sienna · Spreadsheet Builder

**Test input used:**
```
Build a SaaS metrics tracking spreadsheet. Columns: Month, MRR, New Customers, Churned Customers, Expansion Revenue, Net MRR Change, MRR Growth %. Include sample data for 3 months.
```

**Generation time:** 7s
**Credits deducted:** 0 (direct API call — bypassed task system for batch generation)
**Output tokens:** 348
**Output char count:** 1019

**Full output below:**

---

## Sheet: SaaS Metrics Tracker

| Month | MRR | New Customers | Churned Customers | Expansion Revenue | Net MRR Change | MRR Growth % |
| --- | --- | --- | --- | --- | --- | --- |
| January 2025 | 42000 | 18 | 3 | 3200 | 0 | 0 |
| February 2025 | 47800 | 24 | 2 | 4100 | =B3-B2 | =((B3-B2)/B2)*100 |
| March 2025 | 53500 | 31 | 4 | 5600 | =B4-B3 | =((B4-B3)/B3)*100 |

## Notes

- **Net MRR Change** subtracts the prior month MRR from the current month MRR to show raw dollar growth or decline
- **MRR Growth %** divides the Net MRR Change by the prior month MRR and multiplies by 100 to express growth as a percentage
- January is left as 0 for both formula columns since there is no prior month in this dataset to calculate against
- Expansion Revenue represents upsells and upgrades from existing customers and is tracked separately from new customer MRR for visibility into growth levers
- To extend the tracker, add new rows below March and copy the formulas in columns F and G down to keep calculations consistent