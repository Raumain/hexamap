export interface ChargeRules {
  cap: number;
  regenMs: number;
}

export interface ChargeLedger {
  charges: number;
  lastRegenAt: number;
}

export interface ChargeBalance extends ChargeLedger {
  nextChargeAt: number | null;
}

export function regenerateCharges(
  ledger: ChargeLedger,
  rules: ChargeRules,
  now: number,
): ChargeBalance {
  const earned =
    rules.regenMs > 0 ? Math.floor(Math.max(0, now - ledger.lastRegenAt) / rules.regenMs) : 0;
  const charges = Math.min(rules.cap, ledger.charges + earned);

  if (rules.regenMs <= 0) {
    return { charges, lastRegenAt: ledger.lastRegenAt, nextChargeAt: null };
  }

  if (charges >= rules.cap) {
    return { charges: rules.cap, lastRegenAt: now, nextChargeAt: null };
  }

  const credited = charges - ledger.charges;
  const lastRegenAt =
    credited > 0 ? ledger.lastRegenAt + credited * rules.regenMs : ledger.lastRegenAt;

  return { charges, lastRegenAt, nextChargeAt: lastRegenAt + rules.regenMs };
}

export function chargesAt(
  charges: number,
  nextChargeAt: number | null,
  rules: ChargeRules,
  now: number,
): { charges: number; nextChargeAt: number | null } {
  let current = Math.min(charges, rules.cap);

  if (rules.regenMs <= 0) {
    return { charges: current, nextChargeAt: null };
  }

  let next = nextChargeAt;

  while (next !== null && now >= next && current < rules.cap) {
    current += 1;
    next += rules.regenMs;
  }

  if (current >= rules.cap) {
    next = null;
  }

  return { charges: current, nextChargeAt: next };
}
