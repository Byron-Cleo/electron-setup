# Eraeva POS — Business Value Summary

## Why This System Exists

Restaurants and food service businesses lose money when the flow from **procurement → cooking → selling → cash** is disconnected. Most small-to-medium Kenyan restaurants track nothing — food disappears between store and kitchen, cooked portions are never reconciled against what was sold, and cash collected doesn't match what should have been earned.

## The Problem — 4 Gaps

| Gap | What Happens |
|-----|--------------|
| **No procurement tracking** | Raw food comes in, nobody knows what was bought, how much, at what cost |
| **No yield accountability** | Kitchen cooks 10kg beef, gets 150 portions instead of expected 200 — nobody notices |
| **No menu-to-stock link** | Waiter sells items that kitchen hasn't cooked, or kitchen cooks items nobody orders |
| **No cash reconciliation** | Money comes in at the counter, but nobody can trace it back to what was sold vs what was cooked |

## The Solution — 5 Layer Tracking

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  1. STORE   │ →  │  2. KITCHEN │ →  │  3. WAITER  │ →  │  4. SALES   │ →  │  5. CASHIER │
│  Procurement│    │  Production │    │  Service    │    │  Receipt    │    │  Finance    │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
  Record raw         Cook raw →        Order from         Print receipt     Reconcile cash
  ingredients        finished food     available food     for customer      with production
  with cost          Track yield       (what kitchen      Track payment     vs actual sales
                                            produced)
```

| Layer | User | Business Value |
|-------|------|----------------|
| **1. Store** | Store Manager | Know exactly what raw food came in, at what cost, when it expires |
| **2. Kitchen** | Chef/Kitchen Staff | Track **expected yield vs actual** — know where food goes missing |
| **3. Waiter** | Waiter | Order from **only what kitchen produced today** — no phantom orders |
| **4. Sales** | Waiter/Cashier | Receipt printed, customer pays, order matched to kitchen batch |
| **5. Cashier** | Cashier/Admin | Every shilling collected traces back to a specific cooked portion sold |

## Bottom Line

> **Eraeva POS tracks every shilling from raw food purchase → cooking → selling → cash collected, so restaurant owners know exactly where their money goes and where it disappears.**

The 4 roles (Admin, Store, Kitchen, Waiter/Cashier) each handle their layer, but every action feeds into one unified data chain — **procurement → production → service → finance**.
