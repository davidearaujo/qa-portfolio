import { FormEvent, useState } from "react";

interface TaskFormProps {
  onCreate: (title: string, description?: string) => Promise<void>;
}

export function TaskForm({ onCreate }: TaskFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Give the task a title first.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreate(title.trim(), description.trim() || undefined);
      setTitle("");
      setDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the task.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="task-form" onSubmit={handleSubmit} data-testid="task-form">
      <div className="task-form-row">
        <input
          type="text"
          placeholder="New task title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          data-testid="task-title-input"
          aria-label="Task title"
        />
        <button type="submit" data-testid="task-submit" disabled={isSubmitting}>
          {isSubmitting ? "Adding…" : "Add task"}
        </button>
      </div>
      <input
        type="text"
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        data-testid="task-description-input"
        aria-label="Task description"
        className="task-description-input"
      />
      {error && (
        <p className="form-error" role="alert" data-testid="task-form-error">
          {error}
        </p>
      )}
    </form>
  );
}
