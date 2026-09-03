import { Request, Response } from "express";
import { ChallanStatus, MovementType, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { BadRequestError, ConflictError, NotFoundError } from "../utils/errors.js";
import { formatChallanNumber, getPagination, getSearchString } from "../utils/pagination.js";

function serializeChallan(challan: {
  id: number;
  challanNumber: number;
  status: ChallanStatus;
  totalQuantity: number;
  totalAmount: Prisma.Decimal;
  createdAt: Date;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
}) {
  const { challanNumber, totalAmount, ...rest } = challan;
  return { ...rest, challanNumber: formatChallanNumber(challanNumber), totalAmount: Number(totalAmount) };
}

function serializeChallanItem(item: {
  id: number;
  productId: number | null;
  productName: string;
  productSku: string;
  unitPrice: Prisma.Decimal;
  quantity: number;
  lineTotal: Prisma.Decimal;
}) {
  const { unitPrice, lineTotal, ...rest } = item;
  return { ...rest, unitPrice: Number(unitPrice), lineTotal: Number(lineTotal) };
}

export async function listChallans(req: Request, res: Response) {
  const { page, pageSize, skip, take } = getPagination(req.query);
  const search = getSearchString(req.query);
  const status = String(req.query.status ?? "");

  const where: Prisma.ChallanWhereInput = {};
  if (status) where.status = status as never;

  if (search) {
    const numberMatch = search.toUpperCase().match(/^CHL-(\d+)$/);
    if (numberMatch) {
      where.challanNumber = parseInt(numberMatch[1], 10);
    } else if (/^\d+$/.test(search)) {
      where.challanNumber = parseInt(search, 10);
    } else {
      where.customer = { name: { contains: search, mode: "insensitive" } };
    }
  }

  const [total, challans] = await prisma.$transaction([
    prisma.challan.count({ where }),
    prisma.challan.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, businessName: true } },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
  ]);

  res.json({
    success: true,
    data: challans.map(serializeChallan),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

export async function getChallan(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10);
  const challan = await prisma.challan.findUnique({
    where: { id },
    include: {
      customer: true,
      createdBy: { select: { id: true, name: true } },
      items: true,
    },
  });
  if (!challan) throw new NotFoundError("Challan not found");

  res.json({
    success: true,
    data: {
      ...serializeChallan(challan),
      customer: challan.customer,
      createdBy: challan.createdBy,
      items: challan.items.map(serializeChallanItem),
    },
  });
}

async function buildLineItems(
  tx: Prisma.TransactionClient,
  customerId: number,
  items: { productId: number; quantity: number }[]
) {
  const customer = await tx.customer.findUnique({ where: { id: customerId } });
  if (!customer) throw new BadRequestError("Customer not found");

  const productIds = items.map((i) => i.productId);
  if (new Set(productIds).size !== productIds.length) {
    throw new BadRequestError("Duplicate product in line items");
  }

  const products = await tx.product.findMany({ where: { id: { in: productIds } } });
  if (products.length !== productIds.length) {
    throw new BadRequestError("One or more products in the challan do not exist");
  }

  const byId = new Map(products.map((p) => [p.id, p]));
  return items.map(({ productId, quantity }) => {
    const product = byId.get(productId)!;
    const unitPrice = product.unitPrice;
    return {
      productId,
      productName: product.name,
      productSku: product.sku,
      unitPrice,
      quantity,
      lineTotal: unitPrice.mul(quantity),
    };
  });
}

export async function createChallan(req: Request, res: Response) {
  const { customerId, items } = req.body;

  const challan = await prisma.$transaction(async (tx) => {
    const lineItems = await buildLineItems(tx, customerId, items);
    const totalQuantity = lineItems.reduce((s, i) => s + i.quantity, 0);
    const totalAmount = lineItems.reduce((s, i) => s.add(i.lineTotal), new Prisma.Decimal(0));

    return tx.challan.create({
      data: {
        customerId,
        status: ChallanStatus.DRAFT,
        totalQuantity,
        totalAmount,
        createdById: req.user!.id,
        items: { create: lineItems },
      },
    });
  });

  res.status(201).json({ success: true, data: serializeChallan(challan) });
}

export async function updateChallan(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10);
  const { customerId, items } = req.body;

  const existing = await prisma.challan.findUnique({ where: { id }, include: { items: true } });
  if (!existing) throw new NotFoundError("Challan not found");
  if (existing.status !== ChallanStatus.DRAFT) {
    throw new ConflictError("Only DRAFT challans can be edited");
  }

  const challan = await prisma.$transaction(async (tx) => {
    const nextCustomerId = customerId ?? existing.customerId;
    const nextItems = items ?? existing.items.map((i) => ({ productId: i.productId ?? 0, quantity: i.quantity }));

    let lineItems: { productId: number; productName: string; productSku: string; unitPrice: Prisma.Decimal; quantity: number; lineTotal: Prisma.Decimal }[];
    if (Array.isArray(items)) {
      lineItems = await buildLineItems(tx, nextCustomerId, items);
    } else {
      lineItems = nextItems.map(({ productId, quantity }: { productId: number; quantity: number }) => {
        const existingItem = existing.items.find((i) => i.productId === productId);
        if (!existingItem) {
          throw new BadRequestError("One or more products in the challan do not exist");
        }
        return {
          productId: existingItem.productId!,
          productName: existingItem.productName,
          productSku: existingItem.productSku,
          unitPrice: existingItem.unitPrice,
          quantity,
          lineTotal: existingItem.unitPrice.mul(quantity),
        };
      });
    }

    const totalQuantity = lineItems.reduce((s, i) => s + i.quantity, 0);
    const totalAmount = lineItems.reduce((s, i) => s.add(i.lineTotal), new Prisma.Decimal(0));

    await tx.challanItem.deleteMany({ where: { challanId: id } });

    return tx.challan.update({
      where: { id },
      data: {
        customerId: nextCustomerId,
        totalQuantity,
        totalAmount,
        items: { create: lineItems },
      },
    });
  });

  res.json({ success: true, data: serializeChallan(challan) });
}

export async function confirmChallan(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10);

  const challan = await prisma.$transaction(async (tx) => {
    const current = await tx.challan.findUnique({ where: { id }, include: { items: true } });
    if (!current) throw new NotFoundError("Challan not found");
    if (current.status === ChallanStatus.CANCELLED) {
      throw new ConflictError("A cancelled challan cannot be confirmed");
    }
    if (current.status === ChallanStatus.CONFIRMED) {
      throw new ConflictError("Challan is already confirmed");
    }

    for (const item of current.items) {
      if (!item.productId) {
        throw new ConflictError(
          `Cannot confirm: the product "${item.productName}" (SKU ${item.productSku}) has been deleted from the catalogue`
        );
      }
      const updated = await tx.product.updateMany({
        where: { id: item.productId, currentStock: { gte: item.quantity } },
        data: { currentStock: { decrement: item.quantity } },
      });
      if (updated.count === 0) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        throw new ConflictError(
          `Insufficient stock for "${item.productName}" (SKU ${item.productSku}): current stock is ${product?.currentStock ?? 0}, needed ${item.quantity}`
        );
      }
    }

    await tx.stockMovement.createMany({
      data: current.items.map((item) => ({
        productId: item.productId!,
        quantityChange: -item.quantity,
        movementType: MovementType.OUT,
        reason: `Challan confirm (${formatChallanNumber(current.challanNumber)})`,
        createdById: req.user!.id,
        challanId: id,
      })),
    });

    return tx.challan.update({
      where: { id },
      data: { status: ChallanStatus.CONFIRMED, confirmedAt: new Date() },
    });
  });

  res.json({ success: true, message: "Challan confirmed and stock deducted", data: serializeChallan(challan) });
}

export async function cancelChallan(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10);

  const { cancelledFromConfirmed, challan } = await prisma.$transaction(async (tx) => {
    const current = await tx.challan.findUnique({ where: { id }, include: { items: true } });
    if (!current) throw new NotFoundError("Challan not found");
    if (current.status === ChallanStatus.CANCELLED) {
      throw new ConflictError("Challan is already cancelled");
    }

    const wasConfirmed = current.status === ChallanStatus.CONFIRMED;
    if (wasConfirmed) {
      for (const item of current.items) {
        if (item.productId) {
          await tx.product.update({
            where: { id: item.productId },
            data: { currentStock: { increment: item.quantity } },
          });
        }
      }
      await tx.stockMovement.createMany({
        data: current.items
          .filter((item) => item.productId)
          .map((item) => ({
            productId: item.productId!,
            quantityChange: item.quantity,
            movementType: MovementType.IN,
            reason: `Challan cancelled (${formatChallanNumber(current.challanNumber)})`,
            createdById: req.user!.id,
            challanId: id,
          })),
      });
    }

    return { cancelledFromConfirmed: wasConfirmed, challan: await tx.challan.update({
      where: { id },
      data: { status: ChallanStatus.CANCELLED, cancelledAt: new Date() },
    }) };
  });

  res.json({
    success: true,
    message: cancelledFromConfirmed ? "Challan cancelled and stock restored" : "Challan cancelled",
    data: serializeChallan(challan),
  });
}
