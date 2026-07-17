const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export interface Task {
  id: number;
  title: string;
  description: string | null;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthUser {
  id: number;
  email: string;
  createdAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Mirrors the backend's error shape exactly, so the UI can show
// the same message a Postman test would assert on.
export class ApiClientError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("taskflow_token");

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message = body?.error?.message || "Something went wrong. Please try again.";
    const code = body?.error?.code || "UNKNOWN_ERROR";
    throw new ApiClientError(response.status, code, message);
  }

  return body as T;
}

export const api = {
  register: (email: string, password: string) =>
    request<{ user: AuthUser; token: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  login: (email: string, password: string) =>
    request<{ user: AuthUser; token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  listTasks: (params: { page?: number; completed?: boolean } = {}) => {
    const search = new URLSearchParams();
    if (params.page) search.set("page", String(params.page));
    if (params.completed !== undefined) search.set("completed", String(params.completed));
    const query = search.toString();
    return request<{ data: Task[]; pagination: Pagination }>(
      `/tasks${query ? `?${query}` : ""}`
    );
  },

  createTask: (title: string, description?: string) =>
    request<{ data: Task }>("/tasks", {
      method: "POST",
      body: JSON.stringify({ title, description }),
    }),

  updateTask: (id: number, updates: Partial<Pick<Task, "title" | "description" | "completed">>) =>
    request<{ data: Task }>(`/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    }),

  deleteTask: (id: number) =>
    request<void>(`/tasks/${id}`, {
      method: "DELETE",
    }),
};
