import { http } from "@/services/api";
import type { CreateUserInput, User } from "./user.types";

/**
 * Pure data-access layer for the Users resource. No React, no caching — just
 * endpoint definitions. This is the seam tests mock and hooks consume,
 * keeping transport concerns out of components (Single Responsibility).
 */
export const userService = {
  list: (params?: { page?: number; search?: string }) =>
    http.get<User[]>("/users", { params }),

  getById: (id: string) => http.get<User>(`/users/${id}`),

  create: (input: CreateUserInput) =>
    http.post<User, CreateUserInput>("/users", input),

  update: (id: string, input: Partial<CreateUserInput>) =>
    http.patch<User, Partial<CreateUserInput>>(`/users/${id}`, input),

  remove: (id: string) => http.delete<void>(`/users/${id}`),
};
