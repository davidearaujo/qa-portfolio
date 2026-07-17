import { useState } from "react";
import { Task } from "../api/client";

interface TaskItemProps {
  task: Task;
  onToggle: (id: number, completed: boolean) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

function formatDate(iso: string) {
  return new Date(iso.replace(" ", "T") + "Z").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function TaskItem({ task, onToggle, onDelete }: TaskItemProps) {
  const [isBusy, setIsBusy] = useState(false);

  async function handleToggle() {
    setIsBusy(true);
    try {
      await onToggle(task.id, !task.completed);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDelete() {
    setIsBusy(true);
    try {
      await onDelete(task.id);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <li
      className={`task-ticket ${task.completed ? "task-ticket--done" : ""}`}
      data-testid="task-item"
      data-task-id={task.id}
      data-completed={task.completed}
    >
      <button
        className="task-stamp"
        onClick={handleToggle}
        disabled={isBusy}
        data-testid="task-toggle"
        aria-pressed={task.completed}
        aria-label={task.completed ? "Mark task incomplete" : "Mark task complete"}
      >
        {task.completed ? "✓" : ""}
      </button>

      <div className="task-body">
        <span className="task-id">#{String(task.id).padStart(4, "0")}</span>
        <p className="task-title" data-testid="task-title">
          {task.title}
        </p>
        {task.description && <p className="task-description">{task.description}</p>}
        <span className="task-meta">
          Created {formatDate(task.createdAt)}
          {task.updatedAt !== task.createdAt && ` · Updated ${formatDate(task.updatedAt)}`}
        </span>
      </div>

      <button
        className="task-delete"
        onClick={handleDelete}
        disabled={isBusy}
        data-testid="task-delete"
        aria-label={`Delete task ${task.title}`}
      >
        Delete
      </button>
    </li>
  );
}
