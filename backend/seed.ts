import 'dotenv/config';
import { db } from './db/store.ts';

async function main() {
  await db.init();
  await db.resetForSeed();
  const state = db.getState();
  console.log(
    `Veltrix Commerce seeded: ${state.products.length} products, ${state.categories.length} categories, ${state.orders.length} orders, ${state.coupons.length} coupons.`
  );
  console.log(`Super Admin owner: ${state.settings.ownerName} <${state.settings.ownerEmail}>`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
