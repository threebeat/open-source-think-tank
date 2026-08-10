/**
 * Role/seat change audits involve both actor and subject.
 * Mark synthetic only when every involved account is synthetic — a real
 * administrator acting on a synthetic subject must not be labeled synthetic.
 */
export function classifyMultiAccountSynthetic(
  ...accountSyntheticFlags: boolean[]
): boolean {
  if (accountSyntheticFlags.length === 0) {
    throw new Error("classifyMultiAccountSynthetic requires at least one flag");
  }
  return accountSyntheticFlags.every(Boolean);
}
