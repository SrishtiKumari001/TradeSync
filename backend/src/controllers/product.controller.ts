import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { NotFoundError, ConflictError } from "../utils/errors.js";
import { getPagination, getSearchString } from "../utils/pagination.js";

function serializeProduct(p: {
  id: number;
  name: string;
  sku: string;
  category: string;
  unitPrice: Prisma.Decimal;
  currentStock: number;
  minStockAlert: number;
  location: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const { unitPrice, ...rest } = p;
  return { ...rest, unitPrice: Number(unitPrice) };
}

export async function listProducts(req: Request, res: Response) {
  const { page, pageSize, skip, take } = getPagination(req.query);
  const search = getSearchString(req.query);
  const category = String(req.query.category ?? "");
  const lowStock = req.query.lowStock === "true";

  const where: Prisma.ProductWhereInput = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { sku: { contains: search, mode: "insensitive" } },
    ];
  }
  if (category) where.category = { equals: category, mode: "insensitive" };
  if (lowStock) where.currentStock = { lte: prisma.product.fields.minStockAlert };

  const [total, products] = await prisma.$transaction([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
  ]);

  res.json({
    success: true,
    data: products.map(serializeProduct),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

export async function getProduct(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10);
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw new NotFoundError("Product not found");
  res.json({ success: true, data: serializeProduct(product) });
}

export async function createProduct(req: Request, res: Response) {
  const product = await prisma.product.create({ data: req.body });
  res.status(201).json({ success: true, data: serializeProduct(product) });
}

export async function updateProduct(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10);
  await prisma.product.findUniqueOrThrow({ where: { id } });
  const product = await prisma.product.update({ where: { id }, data: req.body });
  res.json({ success: true, data: serializeProduct(product) });
}

export async function listStockMovements(req: Request, res: Response) {
  const productId = parseInt(req.params.id, 10);
  const { page, pageSize, skip, take } = getPagination(req.query);

  const where: Prisma.StockMovementWhereInput = { productId };
  const [total, movements] = await prisma.$transaction([
    prisma.stockMovement.count({ where }),
    prisma.stockMovement.findMany({
      where,
      include: { createdBy: { select: { id: true, name: true } }, challan: { select: { id: true, challanNumber: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
  ]);

  res.json({
    success: true,
    data: movements,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

export async function addManualStockMovement(req: Request, res: Response) {
  const productId = parseInt(req.params.id, 10);
  const { movementType, quantity, reason } = req.body;

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new NotFoundError("Product not found");

  if (movementType === "IN") {
    await prisma.product.update({
      where: { id: productId },
      data: { currentStock: { increment: quantity } },
    });
  } else {
    const updated = await prisma.product.updateMany({
      where: { id: productId, currentStock: { gte: quantity } },
      data: { currentStock: { decrement: quantity } },
    });
    if (updated.count === 0) {
      throw new ConflictError(
        `Insufficient stock for "${product.name}": current stock is ${product.currentStock}, requested ${quantity}`
      );
    }
  }

  const movement = await prisma.stockMovement.create({
    data: {
      productId,
      movementType,
      quantityChange: movementType === "IN" ? quantity : -quantity,
      reason,
      createdById: req.user!.id,
    },
    include: { createdBy: { select: { id: true, name: true } } },
  });

  res.status(201).json({ success: true, data: movement });
}
