import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../db";
import { ApiError } from "../utils/ApiError";
import { registerSchema, loginSchema } from "../utils/validation";
import { User } from "../types";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h";

// POST /auth/register
// 201 on success, 400 on validation error, 409 if email already taken.
router.post("/register", async (req, res, next) => {
  try {
    const { email, password } = registerSchema.parse(req.body);

    const existing = db
      .prepare("SELECT id FROM users WHERE email = ?")
      .get(email) as { id: number } | undefined;

    if (existing) {
      throw ApiError.conflict("An account with this email already exists");
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = db
      .prepare("INSERT INTO users (email, password_hash) VALUES (?, ?)")
      .run(email, passwordHash);

    const user = db
      .prepare("SELECT id, email, created_at FROM users WHERE id = ?")
      .get(result.lastInsertRowid) as Pick<User, "id" | "email" | "created_at">;

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    } as jwt.SignOptions);

    res.status(201).json({
      user: { id: user.id, email: user.email, createdAt: user.created_at },
      token,
    });
  } catch (err) {
    next(err);
  }
});

// POST /auth/login
// 200 on success, 400 on validation error, 401 on bad credentials.
// Deliberately returns the SAME message for "no such user" and "wrong password"
// so the API doesn't leak which emails are registered (a real-world security detail
// that also makes a nice, precise thing to assert on in Postman).
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = db
      .prepare("SELECT * FROM users WHERE email = ?")
      .get(email) as User | undefined;

    if (!user) {
      throw ApiError.unauthorized("Invalid email or password");
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      throw ApiError.unauthorized("Invalid email or password");
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    } as jwt.SignOptions);

    res.status(200).json({
      user: { id: user.id, email: user.email, createdAt: user.created_at },
      token,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
