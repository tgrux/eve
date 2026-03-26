# requirements.md — To-Do Application

## Overview

A simple to-do application for learning purposes, built and run locally inside a single Docker container via Colima. No network calls. No external services.

---

## Constraints

See `pin.md` for environment constraints. Key points:

- Local only — no network calls, no GitHub pushes
- Runtime: Colima (single Docker container)

---

## Tech Stack

| Layer     | Choice              | Notes                                      |
|-----------|---------------------|--------------------------------------------|
| Frontend  | Svelte (Vite)       | SPA served from the same container         |
| Backend   | Node.js + Express   | REST API, runs in the same container       |
| Storage   | JSON file (data/tasks.json) | File-based — persists across restarts (better-sqlite3 unavailable without Python) |
| UI        | shadcn-svelte + Tailwind | Component library for a polished look  |
| Container | Single Docker image | Frontend built and served via Express      |

---

## Features — v1

### 1. Create a Task ✅
- User can type a task title and submit it
- Required fields: **title** (non-empty string)
- Optional fields at creation: **due date**, **priority**
- New tasks default to `status: incomplete`

### 2. Complete a Task ✅
- User can toggle a task between `incomplete` and `complete`
- Completed tasks are visually distinguished (e.g., strikethrough)

### 3. Edit a Task ✅
- User can update the **title**, **due date**, or **priority** of any existing task
- Edits are confirmed explicitly (e.g., save button or Enter key)

### 4. Delete a Task ✅
- User can permanently remove a task
- No soft-delete or undo required for v1

### 5. Due Dates ✅
- Due date is an optional date field (no time component)
- Tasks with a due date display it in the UI
- Past-due incomplete tasks are visually flagged (e.g., red text)

### 6. Priority Levels ✅
- Three levels: `Low`, `Medium`, `High`
- Default priority: `Medium`
- Priority is displayed as a badge or color indicator on the task card

---

## Data Model

```ts
interface Task {
  id: string;           // UUID, generated on creation
  title: string;        // Required, non-empty
  status: 'incomplete' | 'complete';
  priority: 'low' | 'medium' | 'high';
  dueDate?: string;     // ISO date string (YYYY-MM-DD), optional
  createdAt: string;    // ISO timestamp
}
```

---

## API Endpoints

| Method | Path             | Description              |
|--------|------------------|--------------------------|
| GET    | /api/tasks       | Return all tasks         |
| POST   | /api/tasks       | Create a new task        |
| PUT    | /api/tasks/:id   | Update a task            |
| DELETE | /api/tasks/:id   | Delete a task            |

---

## Out of Scope (v1)

- User authentication
- Multiple lists or categories
- Task reordering / drag-and-drop
- Search or filtering
- Notifications or reminders
- Data persistence across container restarts *(now supported via SQLite)*
