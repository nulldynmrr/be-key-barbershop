/**
 * Helper to transform user object for API responses
 * Adds virtual fields like purchased_package_ids and aggregates features
 */
const transformUserResponse = (user) => {
  if (!user) return null;

  const purchased_package_ids = user.package_balances
    ? user.package_balances
        .filter(b => b.coins_remaining > 0)
        .map(b => b.package_id)
    : [];

  // If user has any purchased packages, treat them as premium for gating purposes
  let tipe_akun = user.tipe_akun;
  if (purchased_package_ids.length > 0) {
    tipe_akun = "premium";
  }

  return {
    ...user,
    tipe_akun,
    purchased_package_ids,
  };
};

module.exports = { transformUserResponse };
