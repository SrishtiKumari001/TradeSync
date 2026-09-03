import { Router } from "express";
import { Role } from "@prisma/client";
import { login, me, createUser, listUsers } from "../controllers/auth.controller.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { loginSchema, createUserSchema } from "../schemas/auth.schema.js";

const router = Router();

router.post("/login", validate(loginSchema), login);
router.get("/me", requireAuth, me);

router.post("/", requireAuth, requireRoles(Role.ADMIN), validate(createUserSchema), createUser);
router.get("/", requireAuth, requireRoles(Role.ADMIN), listUsers);

export default router;
