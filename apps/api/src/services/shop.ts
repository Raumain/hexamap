/**
 * Écus à reprendre pour un remboursement Stripe.
 *
 * `amountRefundedCents` est le cumul rémunéré par Stripe, jamais le delta du
 * dernier événement : deux remboursements partiels successifs doivent produire
 * la même cible que le remboursement total qui les suit.
 */
export function refundEcus(input: {
  originalEcus: number;
  alreadyRefunded: number;
  amountRefundedCents: number;
  originalAmountCents: number;
}): number {
  const { originalEcus, alreadyRefunded, originalAmountCents } = input;
  if (originalAmountCents <= 0 || originalEcus <= 0) return 0;

  // Stripe peut annoncer un cumul supérieur au montant initial (partiel puis total).
  const refundedCents = Math.min(input.amountRefundedCents, originalAmountCents);
  if (refundedCents <= 0) return 0;

  const target = Math.floor((originalEcus * refundedCents) / originalAmountCents);
  return Math.max(0, Math.min(target - alreadyRefunded, originalEcus - alreadyRefunded));
}

/** Un achat qui ferait dépasser le plafond quotidien est refusé avant Stripe. */
export function dailyCapReached(input: {
  purchasedToday: number;
  packEcus: number;
  cap: number;
}): boolean {
  if (input.packEcus <= 0) return false;
  return input.purchasedToday + input.packEcus > input.cap;
}
