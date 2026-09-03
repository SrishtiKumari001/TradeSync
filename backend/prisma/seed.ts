import { PrismaClient, Prisma, Role, CustomerType, CustomerStatus, MovementType, ChallanStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("[seed] Seeding database...");

  const users = [
    { name: "Admin User", email: "admin@minierp.com", password: "Admin@123", role: Role.ADMIN },
    { name: "Sales User", email: "sales@minierp.com", password: "Sales@123", role: Role.SALES },
    { name: "Warehouse User", email: "warehouse@minierp.com", password: "Warehouse@123", role: Role.WAREHOUSE },
    { name: "Accounts User", email: "accounts@minierp.com", password: "Accounts@123", role: Role.ACCOUNTS },
  ];

  for (const u of users) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (existing) {
      console.log(`[seed] User ${u.email} already exists, skipping`);
      continue;
    }
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.create({
      data: { name: u.name, email: u.email, passwordHash, role: u.role },
    });
    console.log(`[seed] Created user ${u.email} (${u.role})`);
  }

  const salesUser = await prisma.user.findUniqueOrThrow({ where: { email: "sales@minierp.com" } });

  const customers = [
    {
      name: "Rajesh Traders",
      mobile: "9812345670",
      email: "rajesh@rajeshtraders.in",
      businessName: "Rajesh Traders",
      gstNumber: "27ABCDE1234F1Z5",
      type: CustomerType.WHOLESALE,
      address: "Shop 12, Gandhi Market, Jaipur",
      status: CustomerStatus.ACTIVE,
      followUpDate: null,
      notes: "Monthly order of packaged goods. Prefers early morning delivery.",
    },
    {
      name: "Priya General Store",
      mobile: "9822012345",
      email: "priya@priyastore.com",
      businessName: "Priya General Store",
      gstNumber: null,
      type: CustomerType.RETAIL,
      address: "MG Road, Indore",
      status: CustomerStatus.ACTIVE,
      followUpDate: null,
      notes: "Weekly reorders. Small credit limit.",
    },
    {
      name: "Sharma Distributors",
      mobile: "9988776655",
      email: "info@sharmadistro.com",
      businessName: "Sharma Distributors Pvt Ltd",
      gstNumber: "29AABCS1234Q1Z9",
      type: CustomerType.DISTRIBUTOR,
      address: "Industrial Area Phase 1, Chandigarh",
      status: CustomerStatus.LEAD,
      followUpDate: new Date(Date.now() + 5 * 86400000),
      notes: "Interested in bulk rates for grocery items. Follow up after price list.",
    },
    {
      name: "Kiran Kirana",
      mobile: "9876501234",
      email: "kiran.kirana@gmail.com",
      businessName: "Kiran Kirana",
      gstNumber: null,
      type: CustomerType.RETAIL,
      address: "Station Road, Nagpur",
      status: CustomerStatus.ACTIVE,
      followUpDate: null,
      notes: null,
    },
    {
      name: "Mehta Wholesale Mart",
      mobile: "9765432109",
      email: "mehta@wholesalemart.co.in",
      businessName: "Mehta Wholesale Mart",
      gstNumber: "24AAACM9999M1Z2",
      type: CustomerType.WHOLESALE,
      address: "APMC Yard, Pune",
      status: CustomerStatus.INACTIVE,
      followUpDate: null,
      notes: "Paused orders for 2 months. Re-activate after Diwali.",
    },
  ];

  let customerCount = 0;
  for (const c of customers) {
    const existing = await prisma.customer.findFirst({ where: { mobile: c.mobile } });
    if (existing) continue;
    await prisma.customer.create({
      data: {
        ...c,
        followUpDate: c.followUpDate ?? null,
        createdById: salesUser.id,
      },
    });
    customerCount++;
  }
  if (customerCount > 0) console.log(`[seed] Created ${customerCount} demo customers`);

  const lead = await prisma.customer.findFirstOrThrow({ where: { status: CustomerStatus.LEAD } });
  const leadFollowUps = await prisma.followUp.count({ where: { customerId: lead.id } });
  if (leadFollowUps === 0) {
    await prisma.followUp.createMany({
      data: [
        { customerId: lead.id, note: "Initial contact made, sent catalog.", createdById: salesUser.id },
        { customerId: lead.id, note: "Shared bulk pricing sheet. Awaiting response.", createdById: salesUser.id },
      ],
    });
    console.log("[seed] Created demo follow-up notes");
  }

  const warehouseUser = await prisma.user.findUniqueOrThrow({ where: { email: "warehouse@minierp.com" } });

  const products = [
    { name: "Basmati Rice 5kg", sku: "RICE-BAS-5", category: "Grains", unitPrice: 480, currentStock: 120, minStockAlert: 30, location: "Aisle A1" },
    { name: "Toor Dal 1kg", sku: "DAL-TOOR-1", category: "Grains", unitPrice: 145, currentStock: 25, minStockAlert: 40, location: "Aisle A2" },
    { name: "Sunflower Oil 1L", sku: "OIL-SUN-1", category: "Oils", unitPrice: 135, currentStock: 200, minStockAlert: 50, location: "Aisle B1" },
    { name: "Refined Sugar 1kg", sku: "SUG-REF-1", category: "Essentials", unitPrice: 42, currentStock: 500, minStockAlert: 100, location: "Aisle C1" },
    { name: "Tea Powder 250g", sku: "TEA-PWD-250", category: "Beverages", unitPrice: 95, currentStock: 8, minStockAlert: 25, location: "Aisle C2" },
    { name: "Atta (Wheat Flour) 10kg", sku: "ATTA-WHT-10", category: "Grains", unitPrice: 420, currentStock: 60, minStockAlert: 20, location: "Aisle A3" },
    { name: "Milk Powder 500g", sku: "MILK-PWD-500", category: "Dairy", unitPrice: 260, currentStock: 45, minStockAlert: 15, location: "Aisle B2" },
    { name: "Instant Noodles 12-pack", sku: "NOOD-INS-12", category: "Snacks", unitPrice: 150, currentStock: 300, minStockAlert: 60, location: "Aisle D1" },
    { name: "Detergent Powder 1kg", sku: "DET-PWD-1", category: "Household", unitPrice: 110, currentStock: 12, minStockAlert: 30, location: "Aisle E1" },
    { name: "Biscuits Assorted 500g", sku: "BIS-ASRT-500", category: "Snacks", unitPrice: 75, currentStock: 150, minStockAlert: 40, location: "Aisle D2" },
  ];

  let productCount = 0;
  for (const p of products) {
    const existing = await prisma.product.findUnique({ where: { sku: p.sku } });
    if (existing) continue;
    await prisma.product.create({ data: p });
    productCount++;
  }
  if (productCount > 0) console.log(`[seed] Created ${productCount} demo products`);

  const seededProduct = await prisma.product.findUnique({ where: { sku: "RICE-BAS-5" } });
  if (seededProduct) {
    const movements = await prisma.stockMovement.count({ where: { productId: seededProduct.id } });
    if (movements === 0) {
      const allProducts = await prisma.product.findMany();
      await prisma.stockMovement.createMany({
        data: allProducts.map((p) => ({
          productId: p.id,
          quantityChange: p.currentStock,
          movementType: MovementType.IN,
          reason: "Opening stock (seed)",
          createdById: warehouseUser.id,
        })),
      });
      console.log(`[seed] Created opening stock movements for ${allProducts.length} products`);
    }
  }

  const demoChallans = await prisma.challan.count();
  if (demoChallans === 0) {
    const customer = await prisma.customer.findFirstOrThrow({ where: { status: CustomerStatus.ACTIVE } });
    const rice = await prisma.product.findUniqueOrThrow({ where: { sku: "RICE-BAS-5" } });
    const oil = await prisma.product.findUniqueOrThrow({ where: { sku: "OIL-SUN-1" } });
    const noodles = await prisma.product.findUniqueOrThrow({ where: { sku: "NOOD-INS-12" } });

    const confirmedItems = [
      { productId: rice.id, productName: rice.name, productSku: rice.sku, unitPrice: rice.unitPrice, quantity: 20, lineTotal: rice.unitPrice.mul(20) },
      { productId: oil.id, productName: oil.name, productSku: oil.sku, unitPrice: oil.unitPrice, quantity: 30, lineTotal: oil.unitPrice.mul(30) },
    ];
    const draftItems = [
      { productId: noodles.id, productName: noodles.name, productSku: noodles.sku, unitPrice: noodles.unitPrice, quantity: 15, lineTotal: noodles.unitPrice.mul(15) },
    ];

    await prisma.challan.create({
      data: {
        customerId: customer.id,
        status: ChallanStatus.CONFIRMED,
        totalQuantity: 50,
        totalAmount: confirmedItems.reduce((s, i) => s.add(i.lineTotal), new Prisma.Decimal(0)),
        createdById: salesUser.id,
        confirmedAt: new Date(Date.now() - 3 * 86400000),
        items: { create: confirmedItems },
      },
    });

    await prisma.challan.create({
      data: {
        customerId: customer.id,
        status: ChallanStatus.DRAFT,
        totalQuantity: 15,
        totalAmount: draftItems[0].lineTotal,
        createdById: salesUser.id,
        items: { create: draftItems },
      },
    });

    await prisma.product.update({
      where: { id: rice.id },
      data: { currentStock: { decrement: 20 } },
    });
    await prisma.product.update({
      where: { id: oil.id },
      data: { currentStock: { decrement: 30 } },
    });

    await prisma.stockMovement.createMany({
      data: confirmedItems.map((i) => ({
        productId: i.productId,
        quantityChange: -i.quantity,
        movementType: MovementType.OUT,
        reason: "Challan confirm (seed)",
        createdById: salesUser.id,
      })),
    });

    console.log("[seed] Created demo challans (1 confirmed, 1 draft) and adjusted stock");
  }

  console.log("[seed] Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
