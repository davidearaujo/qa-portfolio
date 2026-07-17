import { useCallback, useEffect, useState } from "react";
import { api, Task, Pagination, ApiClientError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { TaskForm } from "../components/TaskForm";
import { TaskItem } from "../components/TaskItem";

type Filter = "all" | "active" | "completed";

export function TasksPage() {
  const { user, logout } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const completed = filter === "all" ? undefined : filter === "completed";
      const result = await api.listTasks({ page, completed });
      setTasks(result.data);
      setPagination(result.pagination);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not load tasks.");
    } finally {
      setIsLoading(false);
    }
  }, [filter, page]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  async function handleCreate(title: string, description?: string) {
    await api.createTask(title, description);
    if (page !== 1) {
      setPage(1);
    } else {
      await loadTasks();
    }
  }

  async function handleToggle(id: number, completed: boolean) {
    await api.updateTask(id, { completed });
    await loadTasks();
  }

  async function handleDelete(id: number) {
    await api.deleteTask(id);
    await loadTasks();
  }

  function changeFilter(next: Filter) {
    setFilter(next);
    setPage(1);
  }

  return (
    <div className="tasks-screen">
      <header className="tasks-header">
        <div>
          <span className="eyebrow">TaskFlow</span>
          <h1>Your tasks</h1>
        </div>
        <div className="tasks-header-right">
          <span className="user-email" data-testid="current-user-email">
            {user?.email}
          </span>
          <button onClick={logout} data-testid="logout-button" className="secondary-button">
            Log out
          </button>
        </div>
      </header>

      <TaskForm onCreate={handleCreate} />

      <div className="filter-bar" role="tablist" aria-label="Filter tasks" data-testid="filter-bar">
        {(["all", "active", "completed"] as Filter[]).map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            className={`filter-tab ${filter === f ? "filter-tab--active" : ""}`}
            onClick={() => changeFilter(f)}
            data-testid={`filter-${f}`}
          >
            {f[0].toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {error && (
        <p className="form-error" role="alert" data-testid="tasks-error">
          {error}
        </p>
      )}

      {isLoading ? (
        <p className="empty-state" data-testid="tasks-loading">
          Loading tasks…
        </p>
      ) : tasks.length === 0 ? (
        <p className="empty-state" data-testid="tasks-empty">
          {filter === "all"
            ? "No tasks yet. Add your first one above."
            : `No ${filter} tasks.`}
        </p>
      ) : (
        <ul className="task-list" data-testid="task-list">
          {tasks.map((task) => (
            <TaskItem key={task.id} task={task} onToggle={handleToggle} onDelete={handleDelete} />
          ))}
        </ul>
      )}

      {pagination && pagination.totalPages > 1 && (
        <nav className="pagination" data-testid="pagination">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={pagination.page <= 1}
            data-testid="pagination-prev"
          >
            Previous
          </button>
          <span data-testid="pagination-status">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={pagination.page >= pagination.totalPages}
            data-testid="pagination-next"
          >
            Next
          </button>
        </nav>
      )}
    </div>
  );
}
