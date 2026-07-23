import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { ALL_PERMISSIONS, ALL_PERMISSION_KEYS, DEFAULT_ROLES, SubsidiaryType } from '@fsg/shared';

const prisma = new PrismaClient();

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);
const daysFromNow = (n: number) => new Date(Date.now() + n * DAY);

async function seedAccessControl() {
  // Permissions (idempotent)
  for (const p of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { resource: p.resource, action: p.action, description: p.description },
      create: { key: p.key, resource: p.resource, action: p.action, description: p.description },
    });
  }
  const allPerms = await prisma.permission.findMany();
  const permIdByKey = new Map(allPerms.map((p) => [p.key, p.id]));

  // Roles + role permissions
  const roleByName = new Map<string, string>();
  for (const r of DEFAULT_ROLES) {
    const role = await prisma.role.upsert({
      where: { name: r.name },
      update: { description: r.description, isSystem: r.isSystem },
      create: { name: r.name, description: r.description, isSystem: r.isSystem },
    });
    roleByName.set(r.name, role.id);

    const keys = r.permissions === 'ALL' ? ALL_PERMISSION_KEYS : r.permissions;
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: keys
        .map((k) => ({ roleId: role.id, permissionId: permIdByKey.get(k) }))
        .filter((x): x is { roleId: string; permissionId: string } => Boolean(x.permissionId)),
      skipDuplicates: true,
    });
  }

  // Users (one per default role)
  const passwordHash = await bcrypt.hash('password123', 10);
  const users = [
    { name: 'System Admin', email: 'admin@fsg.local', role: 'Admin' },
    { name: 'Operations Manager', email: 'manager@fsg.local', role: 'Manager' },
    { name: 'Data Entry Staff', email: 'staff@fsg.local', role: 'Staff' },
  ];
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, roleId: roleByName.get(u.role) ?? null },
      create: {
        name: u.name,
        email: u.email,
        passwordHash,
        roleId: roleByName.get(u.role) ?? null,
      },
    });
  }

  return { roleByName };
}

async function seedBusinessData() {
  const existing = await prisma.subsidiary.count();
  if (existing > 0) {
    console.log('Business data already present — skipping sample data.');
    return;
  }

  const [admin, manager, staff] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: 'admin@fsg.local' } }),
    prisma.user.findUniqueOrThrow({ where: { email: 'manager@fsg.local' } }),
    prisma.user.findUniqueOrThrow({ where: { email: 'staff@fsg.local' } }),
  ]);

  // ─── Subsidiaries ───────────────────────────────────────────────────────
  const shop = await prisma.subsidiary.create({
    data: { name: 'FSG Online Shop', type: SubsidiaryType.ONLINE_SHOP },
  });
  const layers = await prisma.subsidiary.create({
    data: { name: 'Layers Farm', type: SubsidiaryType.FARM_LAYERS },
  });
  const broilers = await prisma.subsidiary.create({
    data: { name: 'Broilers Farm', type: SubsidiaryType.FARM_BROILERS },
  });
  const cropsDiv = await prisma.subsidiary.create({
    data: { name: 'Crops Division', type: SubsidiaryType.FARM_CROPS },
  });
  const livestockDiv = await prisma.subsidiary.create({
    data: { name: 'Livestock Division', type: SubsidiaryType.FARM_LIVESTOCK },
  });
  const assetsDiv = await prisma.subsidiary.create({
    data: { name: 'Asset Management', type: SubsidiaryType.ASSETS },
  });
  const landDiv = await prisma.subsidiary.create({
    data: { name: 'Land & Estate', type: SubsidiaryType.LAND_ESTATE },
  });
  await prisma.subsidiary.create({
    data: { name: 'Investments', type: SubsidiaryType.INVESTMENTS },
  });

  const [farmProduceCategory, poultryCategory, grainsCategory, feedCategory] = await Promise.all([
    prisma.category.create({ data: { name: 'Farm Produce' } }),
    prisma.category.create({ data: { name: 'Poultry' } }),
    prisma.category.create({ data: { name: 'Grains' } }),
    prisma.category.create({ data: { name: 'Feed' } }),
  ]);

  // ─── Products (online shop + farm produce) ──────────────────────────────
  const products = await Promise.all([
    prisma.product.create({
      data: {
        subsidiaryId: shop.id,
        name: 'Crate of Eggs (30s)',
        sku: 'EGG-30',
        categoryId: farmProduceCategory.id,
        unit: 'crate',
        unitPrice: 2800,
        costPrice: 1800,
        quantityOnHand: 120,
        reorderLevel: 40,
      },
    }),
    prisma.product.create({
      data: {
        subsidiaryId: shop.id,
        name: 'Dressed Broiler (1.8kg)',
        sku: 'BRO-18',
        categoryId: poultryCategory.id,
        unit: 'pcs',
        unitPrice: 6500,
        costPrice: 4200,
        quantityOnHand: 25,
        reorderLevel: 30, // below reorder -> low stock
      },
    }),
    prisma.product.create({
      data: {
        subsidiaryId: shop.id,
        name: 'Bag of Maize (50kg)',
        sku: 'MAZ-50',
        categoryId: grainsCategory.id,
        unit: 'bag',
        unitPrice: 32000,
        costPrice: 24000,
        quantityOnHand: 60,
        reorderLevel: 20,
      },
    }),
    prisma.product.create({
      data: {
        subsidiaryId: shop.id,
        name: 'Layer Feed (25kg)',
        sku: 'FEED-25',
        categoryId: feedCategory.id,
        unit: 'bag',
        unitPrice: 14500,
        costPrice: 11000,
        quantityOnHand: 8,
        reorderLevel: 15, // below reorder -> low stock
      },
    }),
  ]);

  // ─── Inventory movements ────────────────────────────────────────────────
  await prisma.inventoryMovement.createMany({
    data: [
      {
        productId: products[0].id,
        type: 'IN',
        quantity: 150,
        unitCost: 1800,
        reference: 'Farm transfer',
        occurredAt: daysAgo(3),
      },
      {
        productId: products[0].id,
        type: 'OUT',
        quantity: 30,
        reference: 'Online orders',
        occurredAt: daysAgo(1),
      },
      {
        productId: products[2].id,
        type: 'IN',
        quantity: 80,
        unitCost: 24000,
        reference: 'Supplier delivery',
        occurredAt: daysAgo(5),
      },
    ],
  });

  // ─── Sales (today + this month) ─────────────────────────────────────────
  await prisma.sale.createMany({
    data: [
      {
        subsidiaryId: shop.id,
        productId: products[0].id,
        quantity: 10,
        unitPrice: 2800,
        totalAmount: 28000,
        channel: 'ONLINE',
        customer: 'Walk-in',
        soldAt: new Date(),
        createdById: staff.id,
      },
      {
        subsidiaryId: shop.id,
        productId: products[1].id,
        quantity: 5,
        unitPrice: 6500,
        totalAmount: 32500,
        channel: 'ONLINE',
        customer: 'Mrs. Ade',
        soldAt: new Date(),
        createdById: staff.id,
      },
      {
        subsidiaryId: shop.id,
        productId: products[2].id,
        quantity: 3,
        unitPrice: 32000,
        totalAmount: 96000,
        channel: 'WHOLESALE',
        customer: 'Grace Stores',
        soldAt: daysAgo(2),
        createdById: manager.id,
        verifiedAt: daysAgo(1),
        verifiedById: admin.id,
      },
      {
        subsidiaryId: layers.id,
        productId: products[0].id,
        quantity: 40,
        unitPrice: 2800,
        totalAmount: 112000,
        channel: 'WHOLESALE',
        customer: 'Market vendor',
        soldAt: daysAgo(6),
        createdById: manager.id,
        verifiedAt: daysAgo(5),
        verifiedById: admin.id,
      },
      {
        subsidiaryId: broilers.id,
        productId: products[1].id,
        quantity: 20,
        unitPrice: 6500,
        totalAmount: 130000,
        channel: 'IN_STORE',
        customer: 'Hotel order',
        soldAt: daysAgo(9),
        createdById: manager.id,
        verifiedAt: daysAgo(8),
        verifiedById: admin.id,
      },
    ],
  });

  // ─── Farm batches + records ─────────────────────────────────────────────
  const layerBatch = await prisma.farmBatch.create({
    data: {
      subsidiaryId: layers.id,
      name: 'Layer Batch A-2025',
      type: 'LAYERS',
      breed: 'ISA Brown',
      initialCount: 500,
      startDate: daysAgo(180),
      expectedHarvest: daysFromNow(200),
      status: 'ACTIVE',
    },
  });
  const broilerBatch = await prisma.farmBatch.create({
    data: {
      subsidiaryId: broilers.id,
      name: 'Broiler Batch B-12',
      type: 'BROILERS',
      breed: 'Cobb 500',
      initialCount: 1000,
      startDate: daysAgo(28),
      expectedHarvest: daysFromNow(14),
      status: 'ACTIVE',
    },
  });

  // 14 days of egg production for the layer batch
  const eggRows = Array.from({ length: 14 }, (_, i) => {
    const eggs = 360 + Math.round(Math.random() * 90);
    return {
      batchId: layerBatch.id,
      date: daysAgo(13 - i),
      eggsCollected: eggs,
      traysCollected: Math.round(eggs / 30),
      damaged: Math.round(Math.random() * 8),
      gradeA: Math.round(eggs * 0.8),
      gradeB: Math.round(eggs * 0.2),
    };
  });
  await prisma.eggProduction.createMany({ data: eggRows });

  await prisma.mortalityRecord.createMany({
    data: [
      { batchId: layerBatch.id, date: daysAgo(10), count: 4, cause: 'Heat stress' },
      { batchId: layerBatch.id, date: daysAgo(3), count: 2, cause: 'Unknown' },
      { batchId: broilerBatch.id, date: daysAgo(5), count: 12, cause: 'Transport stress' },
    ],
  });

  await prisma.feedRecord.createMany({
    data: [
      {
        batchId: layerBatch.id,
        date: daysAgo(7),
        feedType: 'Layer mash',
        quantityKg: 350,
        cost: 154000,
      },
      {
        batchId: broilerBatch.id,
        date: daysAgo(4),
        feedType: 'Broiler finisher',
        quantityKg: 500,
        cost: 230000,
      },
    ],
  });

  // ─── Crops ───────────────────────────────────────────────────────────────
  await prisma.crop.createMany({
    data: [
      {
        subsidiaryId: cropsDiv.id,
        name: 'Maize',
        variety: 'SAMMAZ 15',
        plot: 'Field 1',
        areaHectares: 5,
        plantingDate: daysAgo(60),
        expectedHarvest: daysFromNow(40),
        expectedYield: 18,
        status: 'GROWING',
      },
      {
        subsidiaryId: cropsDiv.id,
        name: 'Tomatoes',
        variety: 'Roma VF',
        plot: 'Greenhouse 2',
        areaHectares: 1.5,
        plantingDate: daysAgo(30),
        expectedHarvest: daysFromNow(20),
        expectedYield: 25,
        status: 'GROWING',
      },
    ],
  });

  // ─── Livestock ─────────────────────────────────────────────────────────
  await prisma.livestock.createMany({
    data: [
      {
        subsidiaryId: livestockDiv.id,
        species: 'Cattle',
        tagNumber: 'CTL-001',
        breed: 'White Fulani',
        sex: 'FEMALE',
        acquisitionCost: 320000,
        weightKg: 280,
        status: 'ALIVE',
      },
      {
        subsidiaryId: livestockDiv.id,
        species: 'Goat',
        tagNumber: 'GT-014',
        breed: 'Red Sokoto',
        sex: 'MALE',
        acquisitionCost: 45000,
        weightKg: 32,
        status: 'ALIVE',
      },
      {
        subsidiaryId: livestockDiv.id,
        species: 'Cattle',
        tagNumber: 'CTL-002',
        breed: 'White Fulani',
        sex: 'MALE',
        acquisitionCost: 350000,
        weightKg: 310,
        status: 'SOLD',
      },
    ],
  });

  // ─── Assets + maintenance ────────────────────────────────────────────────
  const generator = await prisma.asset.create({
    data: {
      subsidiaryId: assetsDiv.id,
      name: 'Diesel Generator 15kVA',
      category: 'Power',
      serialNumber: 'GEN-15-882',
      purchaseDate: daysAgo(400),
      purchaseCost: 2500000,
      currentValue: 1800000,
      condition: 'GOOD',
      location: 'Main farm',
      status: 'ACTIVE',
    },
  });
  const truck = await prisma.asset.create({
    data: {
      subsidiaryId: assetsDiv.id,
      name: 'Delivery Truck',
      category: 'Vehicle',
      serialNumber: 'TRK-2019-31',
      purchaseDate: daysAgo(900),
      purchaseCost: 8500000,
      currentValue: 5200000,
      condition: 'FAIR',
      location: 'Depot',
      status: 'ACTIVE',
    },
  });

  await prisma.maintenanceLog.createMany({
    data: [
      // overdue (scheduled in the past, not completed)
      {
        assetId: generator.id,
        type: 'Oil change & service',
        scheduledDate: daysAgo(6),
        cost: 45000,
        vendor: 'PowerFix Ltd',
        status: 'SCHEDULED',
      },
      {
        assetId: truck.id,
        type: 'Tyre replacement',
        scheduledDate: daysAgo(2),
        cost: 180000,
        vendor: 'AutoCare',
        status: 'SCHEDULED',
      },
      // upcoming
      {
        assetId: truck.id,
        type: 'Full service',
        scheduledDate: daysFromNow(20),
        cost: 120000,
        vendor: 'AutoCare',
        status: 'SCHEDULED',
      },
      // completed
      {
        assetId: generator.id,
        type: 'Filter replacement',
        scheduledDate: daysAgo(40),
        completedDate: daysAgo(38),
        cost: 25000,
        vendor: 'PowerFix Ltd',
        status: 'COMPLETED',
      },
    ],
  });

  // ─── Land plots + payments ──────────────────────────────────────────────
  const plot = await prisma.landPlot.create({
    data: {
      name: 'Epe Farmland Plot 4',
      location: 'Epe, Lagos',
      sizeAcres: 10,
      purchasePrice: 25000000,
      totalDue: 25000000,
      status: 'FINANCING',
      acquisitionDate: daysAgo(120),
    },
  });
  await prisma.landPayment.createMany({
    data: [
      {
        plotId: plot.id,
        amount: 10000000,
        paidAt: daysAgo(120),
        method: 'Bank transfer',
        reference: 'INV-001',
      },
      {
        plotId: plot.id,
        amount: 5000000,
        paidAt: daysAgo(60),
        method: 'Bank transfer',
        reference: 'INV-002',
      },
    ],
  });
  // Fully-owned plot (no balance)
  await prisma.landPlot.create({
    data: {
      name: 'Ibadan Plot 1',
      location: 'Ibadan, Oyo',
      sizeAcres: 4,
      purchasePrice: 8000000,
      totalDue: 8000000,
      status: 'OWNED',
      acquisitionDate: daysAgo(700),
      payments: { create: [{ amount: 8000000, paidAt: daysAgo(700), method: 'Cash' }] },
    },
  });

  // ─── Investments ─────────────────────────────────────────────────────────
  await prisma.investment.createMany({
    data: [
      {
        name: 'GTBank Fixed Deposit',
        type: 'FIXED_DEPOSIT',
        institution: 'GTBank',
        principal: 5000000,
        interestRate: 12,
        startDate: daysAgo(160),
        maturityDate: daysFromNow(20),
        expectedReturn: 5600000,
        status: 'ACTIVE',
      },
      {
        name: 'FGN Savings Bond',
        type: 'BONDS',
        institution: 'DMO',
        principal: 3000000,
        interestRate: 14,
        startDate: daysAgo(300),
        maturityDate: daysFromNow(400),
        expectedReturn: 4200000,
        status: 'ACTIVE',
      },
    ],
  });

  // ─── Alerts ────────────────────────────────────────────────────────────
  // Condition-based alerts (low stock, overdue maintenance, land balances,
  // maturing investments) are produced automatically by AlertsGeneratorService
  // on API startup. Seed only a single manual/general alert here.
  await prisma.alert.create({
    data: {
      type: 'GENERAL',
      severity: 'INFO',
      title: 'Welcome to the FSG Control System',
      message:
        'Operational alerts for low stock, overdue maintenance, outstanding land balances and maturing investments are generated automatically.',
    },
  });

  // ─── Expenses (across zones) ─────────────────────────────────────────────
  await prisma.expense.createMany({
    data: [
      {
        subsidiaryId: layers.id,
        category: 'Feed',
        description: 'Layer mash',
        vendor: 'AgroFeeds',
        amount: 154000,
        incurredAt: daysAgo(7),
      },
      {
        subsidiaryId: broilers.id,
        category: 'Feed',
        description: 'Broiler finisher',
        vendor: 'AgroFeeds',
        amount: 230000,
        incurredAt: daysAgo(4),
      },
      {
        subsidiaryId: assetsDiv.id,
        category: 'Fuel',
        description: 'Diesel for generator',
        vendor: 'TotalEnergies',
        amount: 85000,
        incurredAt: daysAgo(3),
      },
      {
        subsidiaryId: assetsDiv.id,
        category: 'Fuel',
        description: 'Diesel for delivery truck',
        vendor: 'TotalEnergies',
        amount: 60000,
        incurredAt: daysAgo(1),
      },
      {
        subsidiaryId: shop.id,
        category: 'Utilities',
        description: 'Electricity bill',
        vendor: 'IKEDC',
        amount: 42000,
        incurredAt: daysAgo(10),
      },
      {
        subsidiaryId: livestockDiv.id,
        category: 'Veterinary',
        description: 'Vaccinations & vet visit',
        vendor: 'VetCare',
        amount: 38000,
        incurredAt: daysAgo(6),
      },
      {
        subsidiaryId: cropsDiv.id,
        category: 'Supplies',
        description: 'Fertilizer & seedlings',
        vendor: 'GreenGrow',
        amount: 95000,
        incurredAt: daysAgo(12),
      },
      {
        category: 'Salaries',
        description: 'Casual labour wages',
        amount: 120000,
        incurredAt: daysAgo(2),
      },
    ],
  });
}

async function main() {
  // The seed rebuilds default role permissions, recreates the @fsg.local demo
  // logins, and re-inserts sample business data on an emptied database — all
  // destructive against a curated production DB. New permission keys reach
  // existing databases via the API's startup catalog sync instead.
  if (process.env.NODE_ENV === 'production' && process.env.SEED_FORCE !== 'true') {
    console.error('NODE_ENV=production — refusing to seed. Set SEED_FORCE=true to override.');
    process.exit(1);
  }
  console.log('Seeding access control (permissions, roles, users)...');
  await seedAccessControl();
  console.log('Seeding business sample data...');
  await seedBusinessData();
  console.log('Seed complete.');
  console.log(
    'Logins: admin@fsg.local / manager@fsg.local / staff@fsg.local  (password: password123)',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
