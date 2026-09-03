import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { NotFoundError } from "../utils/errors.js";
import { getPagination, getSearchString } from "../utils/pagination.js";

const customerSelect = {
  id: true,
  name: true,
  mobile: true,
  email: true,
  businessName: true,
  gstNumber: true,
  type: true,
  address: true,
  status: true,
  followUpDate: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.CustomerSelect;

export async function listCustomers(req: Request, res: Response) {
  const { page, pageSize, skip, take } = getPagination(req.query);
  const search = getSearchString(req.query);
  const type = String(req.query.type ?? "");
  const status = String(req.query.status ?? "");

  const where: Prisma.CustomerWhereInput = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { mobile: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { businessName: { contains: search, mode: "insensitive" } },
    ];
  }
  if (type) where.type = type as never;
  if (status) where.status = status as never;

  const [total, customers] = await prisma.$transaction([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      select: customerSelect,
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
  ]);

  res.json({ success: true, data: customers, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
}

export async function getCustomer(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10);
  const customer = await prisma.customer.findUnique({
    where: { id },
    select: { ...customerSelect, _count: { select: { followUps: true, challans: true } } },
  });
  if (!customer) throw new NotFoundError("Customer not found");
  res.json({ success: true, data: customer });
}

export async function createCustomer(req: Request, res: Response) {
  const { followUpDate, ...rest } = req.body;
  const customer = await prisma.customer.create({
    data: {
      ...rest,
      followUpDate: followUpDate ? new Date(followUpDate) : null,
      createdById: req.user!.id,
    },
    select: customerSelect,
  });
  res.status(201).json({ success: true, data: customer });
}

export async function updateCustomer(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10);
  await prisma.customer.findUniqueOrThrow({ where: { id } });

  const { followUpDate, ...rest } = req.body;
  const customer = await prisma.customer.update({
    where: { id },
    data: {
      ...rest,
      followUpDate: followUpDate ? new Date(followUpDate) : null,
    },
    select: customerSelect,
  });
  res.json({ success: true, data: customer });
}

export async function addFollowUp(req: Request, res: Response) {
  const customerId = parseInt(req.params.id, 10);
  await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });

  const followUp = await prisma.followUp.create({
    data: {
      customerId,
      note: req.body.note,
      createdById: req.user!.id,
    },
    include: { createdBy: { select: { id: true, name: true } } },
  });
  res.status(201).json({ success: true, data: followUp });
}

export async function listFollowUps(req: Request, res: Response) {
  const customerId = parseInt(req.params.id, 10);
  const followUps = await prisma.followUp.findMany({
    where: { customerId },
    include: { createdBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json({ success: true, data: followUps });
}
