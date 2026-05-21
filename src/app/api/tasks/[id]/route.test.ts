import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdminUser = vi.fn();
const accessErrorResponse = vi.fn();
const taskFindFirst = vi.fn();
const taskDelete = vi.fn();

vi.mock("@/lib/current-user", () => ({
  requireAdminUser,
  accessErrorResponse,
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    task: {
      findFirst: taskFindFirst,
      delete: taskDelete,
    },
  },
}));

async function deleteTask(id = "task-1") {
  const { DELETE } = await import("./route");
  return DELETE(new NextRequest(`http://localhost/api/tasks/${id}`, {
    method: "DELETE",
  }), {
    params: Promise.resolve({ id }),
  });
}

describe("DELETE /api/tasks/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminUser.mockResolvedValue({ id: "admin-1", companyId: "company-1", role: "ADMIN" });
    accessErrorResponse.mockReturnValue(null);
    taskFindFirst.mockResolvedValue({ id: "task-1" });
    taskDelete.mockResolvedValue({ id: "task-1" });
  });

  it("rejects members before deleting tasks", async () => {
    requireAdminUser.mockRejectedValueOnce(new Error("Admin access required"));
    accessErrorResponse.mockReturnValueOnce(
      NextResponse.json({ error: "Admin access required" }, { status: 403 }),
    );

    const response = await deleteTask();

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Admin access required" });
    expect(taskDelete).not.toHaveBeenCalled();
  });

  it("deletes company-scoped tasks for admins", async () => {
    const response = await deleteTask();

    expect(response.status).toBe(200);
    expect(taskFindFirst).toHaveBeenCalledWith({
      where: { id: "task-1", companyId: "company-1" },
      select: { id: true },
    });
    expect(taskDelete).toHaveBeenCalledWith({ where: { id: "task-1" } });
  });

  it("returns 404 for tasks outside the admin company", async () => {
    taskFindFirst.mockResolvedValueOnce(null);

    const response = await deleteTask("other-task");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Task not found" });
    expect(taskDelete).not.toHaveBeenCalled();
  });
});
