import { Prisma, PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

/**
 * Development seed.
 *
 * Creates two organizations so tenant isolation is visible in the running app:
 * sign in as either owner and you only ever see that organization's catalog.
 * Re-running the seed replaces the demo tenants and leaves other data alone.
 */
const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Password123!';

interface SeedProduct {
  name: string;
  sku: string;
  description?: string;
  quantityOnHand: number;
  costPrice: string;
  sellingPrice: string;
  lowStockThreshold?: number;
}

const NORTHWIND_PRODUCTS: SeedProduct[] = [
  { name: 'Ceramic Pour-Over Dripper', sku: 'CPD-001', description: 'Single-cup ceramic cone, 02 size', quantityOnHand: 142, costPrice: '9.40', sellingPrice: '24.00' },
  { name: 'Gooseneck Kettle 1L', sku: 'GNK-002', description: 'Variable temperature, stainless steel', quantityOnHand: 38, costPrice: '41.00', sellingPrice: '89.00' },
  { name: 'Burr Grinder — Manual', sku: 'BGM-003', description: '38mm conical stainless burrs', quantityOnHand: 7, costPrice: '28.50', sellingPrice: '69.00' },
  { name: 'Paper Filters (100ct)', sku: 'PF-004', description: 'Unbleached, 02 size', quantityOnHand: 0, costPrice: '2.10', sellingPrice: '6.50' },
  { name: 'Digital Scale 0.1g', sku: 'DS-005', description: 'Built-in timer, USB-C', quantityOnHand: 64, costPrice: '15.75', sellingPrice: '38.00' },
  { name: 'Double-Wall Glass 240ml', sku: 'DWG-006', quantityOnHand: 210, costPrice: '4.20', sellingPrice: '12.00' },
  { name: 'Insulated Travel Tumbler', sku: 'ITT-007', description: 'Vacuum sealed, 16oz', quantityOnHand: 4, costPrice: '11.00', sellingPrice: '28.00', lowStockThreshold: 15 },
  { name: 'Espresso Tamper 58mm', sku: 'ET-008', quantityOnHand: 26, costPrice: '13.00', sellingPrice: '32.00' },
  { name: 'Milk Frothing Pitcher', sku: 'MFP-009', description: '600ml, stainless steel', quantityOnHand: 51, costPrice: '7.80', sellingPrice: '19.50' },
  { name: 'Cold Brew Carafe 1.5L', sku: 'CBC-010', quantityOnHand: 2, costPrice: '18.00', sellingPrice: '44.00' },
  { name: 'Knock Box', sku: 'KB-011', quantityOnHand: 33, costPrice: '14.50', sellingPrice: '35.00' },
  { name: 'Reusable Mesh Filter', sku: 'RMF-012', quantityOnHand: 88, costPrice: '3.40', sellingPrice: '11.00' },
  { name: 'Bean Storage Vault 500g', sku: 'BSV-013', description: 'CO2 valve, airtight', quantityOnHand: 9, costPrice: '16.20', sellingPrice: '42.00' },
  { name: 'Barista Apron', sku: 'BA-014', quantityOnHand: 120, costPrice: '12.00', sellingPrice: '34.00' },
  { name: 'Siphon Brewer 3-Cup', sku: 'SB-015', description: 'Borosilicate glass, butane burner', quantityOnHand: 6, costPrice: '52.00', sellingPrice: '125.00', lowStockThreshold: 8 },
];

const HARBOR_PRODUCTS: SeedProduct[] = [
  // Deliberately reuses CPD-001 to demonstrate that SKUs are unique per tenant,
  // not globally.
  { name: 'Harbor Dripper (same SKU, different org)', sku: 'CPD-001', quantityOnHand: 75, costPrice: '8.00', sellingPrice: '21.00' },
  { name: 'Marine Rope 10m', sku: 'MR-100', quantityOnHand: 3, costPrice: '22.00', sellingPrice: '55.00' },
  { name: 'Deck Cleat 6in', sku: 'DC-101', quantityOnHand: 0, costPrice: '6.50', sellingPrice: '18.00' },
];

async function seedTenant(options: {
  organizationName: string;
  defaultLowStockThreshold: number;
  userName: string;
  email: string;
  products: SeedProduct[];
}) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // One transaction so a tenant is never left half-created.
  return prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: {
        name: options.organizationName,
        defaultLowStockThreshold: options.defaultLowStockThreshold,
      },
    });

    await tx.user.create({
      data: {
        name: options.userName,
        email: options.email,
        password: passwordHash,
        organizationId: organization.id,
      },
    });

    await tx.product.createMany({
      data: options.products.map((product) => ({
        organizationId: organization.id,
        name: product.name,
        sku: product.sku,
        description: product.description ?? null,
        quantityOnHand: product.quantityOnHand,
        costPrice: new Prisma.Decimal(product.costPrice),
        sellingPrice: new Prisma.Decimal(product.sellingPrice),
        lowStockThreshold: product.lowStockThreshold ?? null,
      })),
    });

    return organization;
  });
}

async function main() {
  const demoEmails = ['owner@northwind.test', 'owner@harbor.test'];

  // Remove any previous run's demo tenants (cascades to users and products).
  const existing = await prisma.user.findMany({
    where: { email: { in: demoEmails } },
    select: { organizationId: true },
  });

  if (existing.length > 0) {
    await prisma.organization.deleteMany({
      where: { id: { in: existing.map((user) => user.organizationId) } },
    });
    console.log(`Removed ${existing.length} existing demo organization(s)`);
  }

  await seedTenant({
    organizationName: 'Northwind Coffee Supply',
    defaultLowStockThreshold: 10,
    userName: 'Dana Reyes',
    email: 'owner@northwind.test',
    products: NORTHWIND_PRODUCTS,
  });

  await seedTenant({
    organizationName: 'Harbor Outfitters',
    defaultLowStockThreshold: 5,
    userName: 'Sam Okafor',
    email: 'owner@harbor.test',
    products: HARBOR_PRODUCTS,
  });

  console.log('\nSeed complete. Two demo organizations are available:\n');
  console.log('  Northwind Coffee Supply   owner@northwind.test   (15 products, default threshold 10)');
  console.log('  Harbor Outfitters         owner@harbor.test      (3 products,  default threshold 5)');
  console.log(`\n  Password for both: ${DEMO_PASSWORD}`);
  console.log('\nBoth organizations contain SKU "CPD-001" — proof that SKUs are unique per');
  console.log('organization, and that neither tenant can see the other\'s catalog.\n');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
