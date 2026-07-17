import { Router } from "express";
import { db } from "../db";
import { requireAuth } from "../middleware/auth";
import { ApiError } from "../utils/ApiError";
import { createTaskSchema, updateTaskSchema, paginationSchema } from "../utils/validation";
import { Task, TaskResponse } from "../types";

const router = Router();

// Every route below requires a valid JWT.
router.use(requireAuth);

function toTaskResponse(task: Task): TaskResponse {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    completed: Boolean(task.completed),
    createdAt: task.created_at,
    updatedAt: task.updated_at,
  };
}

// GET /tasks?page=1&limit=10&completed=true
// Supports pagination + optional completed filter. Always scoped to req.user.
router.get("/", (req, res, next) => {
  try {
    const { page, limit, completed } = paginationSchema.parse(req.query);
    const offset = (page - 1) * limit;
    const userId = req.user!.userId;

    let where = "WHERE user_id = ?";
    const params: (string | number)[] = [userId];

    if (completed !== undefined) {
      where += " AND completed = ?";
      params.push(completed ? 1 : 0);
    }

    const total = (
      db.prepare(`SELECT COUNT(*) as count FROM tasks ${where}`).get(...params) as {
        count: number;
      }
    ).count;

    const rows = db
      .prepare(`SELECT * FROM tasks ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .all(...params, limit, offset) as Task[];

    res.status(200).json({
      data: rows.map(toTaskResponse),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /tasks/:id
router.get("/:id", (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw ApiError.badRequest("Task id must be a positive integer");
    }

    const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as Task | undefined;

    if (!task) {
      throw ApiError.notFound(`Task with id ${id} not found`);
    }
    if (task.user_id !== req.user!.userId) {
      // 404 instead of 403 on purpose: don't reveal that a task ID exists
      // but belongs to someone else.
      throw ApiError.notFound(`Task with id ${id} not found`);
    }

    res.status(200).json({ data: toTaskResponse(task) });
  } catch (err) {
    next(err);
  }
});

// POST /tasks
router.post("/", (req, res, next) => {
  try {
    const { title, description } = createTaskSchema.parse(req.body);
    const userId = req.user!.userId;

    const result = db
      .prepare("INSERT INTO tasks (user_id, title, description) VALUES (?, ?, ?)")
      .run(userId, title, description ?? null);

    const task = db
      .prepare("SELECT * FROM tasks WHERE id = ?")
      .get(result.lastInsertRowid) as Task;

    res.status(201).json({ data: toTaskResponse(task) });
  } catch (err) {
    next(err);
  }
});

// PATCH /tasks/:id
router.patch("/:id", (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw ApiError.badRequest("Task id must be a positive integer");
    }

    const updates = updateTaskSchema.parse(req.body);

    const existing = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as Task | undefined;
    if (!existing || existing.user_id !== req.user!.userId) {
      throw ApiError.notFound(`Task with id ${id} not found`);
    }

    const merged = {
      title: updates.title ?? existing.title,
      description: updates.description ?? existing.description,
      completed:
        updates.completed === undefined ? existing.completed : updates.completed ? 1 : 0,
    };

    db.prepare(
      "UPDATE tasks SET title = ?, description = ?, completed = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(merged.title, merged.description, merged.completed, id);

    const updated = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as Task;

    res.status(200).json({ data: toTaskResponse(updated) });
  } catch (err) {
    next(err);
  }
});

// DELETE /tasks/:id
router.delete("/:id", (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw ApiError.badRequest("Task id must be a positive integer");
    }

    const existing = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as Task | undefined;
    if (!existing || existing.user_id !== req.user!.userId) {
      throw ApiError.notFound(`Task with id ${id} not found`);
    }

    db.prepare("DELETE FROM tasks WHERE id = ?").run(id);

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
