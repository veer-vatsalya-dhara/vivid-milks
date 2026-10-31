/** All amounts are integer paise. */
export function formatRupees(paise: number): string {
  const sign = paise < 0 ? '−' : '';
  const abs = Math.abs(paise);
  const rupees = abs % 100 === 0 ? String(abs / 100) : (abs / 100).toFixed(2);
  return `${sign}₹${rupees}`;
}
