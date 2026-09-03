import { Request, Response } from "express";
import { ChallanStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export async function dashboardSummary(_req: Request, res: Response) {
  const [customerCount, activeCustomerCount, productCount, lowStockProducts, draftChallans, confirmedChallans, recentChallans] =
    await prisma.$transaction([
      prisma.customer.count(),
      prisma.customer.count({ where: { status: "ACTIVE" } }),
      prisma.product.count(),
      prisma.product.findMany({
        where: { currentStock: { lte: prisma.product.fields.minStockAlert } },
        orderBy: [{ currentStock: "asc" }],
        take: 10,
      }),
      prisma.challan.count({ where: { status: ChallanStatus.DRAFT } }),
      prisma.challan.count({ where: { status: ChallanStatus.CONFIRMED } }),
      prisma.challan.findMany({
        include: { customer: { select: { name: true } }, _count: { select: { items: true } } },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
    ]);

  res.json({
    success: true,
    data: {
      metrics: {
        customers: customerCount,
        activeCustomers: activeCustomerCount,
        products: productCount,
        lowStockCount: lowStockProducts.length,
        draftChallans: draftChallans,
        confirmedChallans: confirmedChallans,
      },
      lowStockProducts: lowStockProducts.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        currentStock: p.currentStock,
        minStockAlert: p.minStockAlert,
      })),
      recentChallans: recentChallans.map((c) => ({
        id: c.id,
        challanNumber: `CHL-${String(c.challanNumber).padStart(4, "0")}`,
        customer: c.customer.name,
        status: c.status,
        totalQuantity: c.totalQuantity,
        totalAmount: Number(c.totalAmount),
        itemCount: c._count.items,
        createdAt: c.createdAt,
      })),
    },
  });
}
