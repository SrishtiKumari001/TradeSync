import api from "./client";
import type { ApiResponse, Customer, Paginated, Product, Challan, FollowUp, DashboardSummary, LoginResponse, User } from "../types";

export const authApi = {
  login: (email: string, password: string) =>
    api.post<LoginResponse>("/api/auth/login", { email, password }).then((r) => r.data),
  me: () => api.get<{ success: boolean; user: User }>("/api/auth/me").then((r) => r.data.user),
  listUsers: () => api.get<ApiResponse<User[]>>("/api/auth").then((r) => r.data.data),
};

export const customerApi = {
  list: (params: Record<string, string | number | boolean | undefined>) =>
    api.get<Paginated<Customer>>("/api/customers", { params }).then((r) => r.data),
  get: (id: number) => api.get<ApiResponse<Customer>>(`/api/customers/${id}`).then((r) => r.data.data),
  create: (data: Partial<Customer>) =>
    api.post<ApiResponse<Customer>>("/api/customers", data).then((r) => r.data.data),
  update: (id: number, data: Partial<Customer>) =>
    api.patch<ApiResponse<Customer>>(`/api/customers/${id}`, data).then((r) => r.data.data),
  followUps: (id: number) => api.get<ApiResponse<FollowUp[]>>(`/api/customers/${id}/follow-ups`).then((r) => r.data.data),
  addFollowUp: (id: number, note: string) =>
    api.post<ApiResponse<FollowUp>>(`/api/customers/${id}/follow-ups`, { note }).then((r) => r.data.data),
};

export const productApi = {
  list: (params: Record<string, string | number | boolean | undefined>) =>
    api.get<Paginated<Product>>("/api/products", { params }).then((r) => r.data),
  get: (id: number) => api.get<ApiResponse<Product>>(`/api/products/${id}`).then((r) => r.data.data),
  create: (data: Partial<Product>) =>
    api.post<ApiResponse<Product>>("/api/products", data).then((r) => r.data.data),
  update: (id: number, data: Partial<Product>) =>
    api.patch<ApiResponse<Product>>(`/api/products/${id}`, data).then((r) => r.data.data),
  stockMovements: (id: number, params: Record<string, string | number | undefined>) =>
    api.get<Paginated<import("../types").StockMovement>>(`/api/products/${id}/stock-movements`, { params }).then((r) => r.data),
  adjustStock: (id: number, data: { movementType: "IN" | "OUT"; quantity: number; reason: string }) =>
    api.post(`/api/products/${id}/stock-movements`, data).then((r) => r.data.data),
};

export const challanApi = {
  list: (params: Record<string, string | number | undefined>) =>
    api.get<Paginated<Challan>>("/api/challans", { params }).then((r) => r.data),
  get: (id: number) => api.get<ApiResponse<Challan>>(`/api/challans/${id}`).then((r) => r.data.data),
  create: (data: { customerId: number; items: { productId: number; quantity: number }[] }) =>
    api.post<ApiResponse<Challan>>("/api/challans", data).then((r) => r.data.data),
  update: (id: number, data: { customerId: number; items: { productId: number; quantity: number }[] }) =>
    api.patch<ApiResponse<Challan>>(`/api/challans/${id}`, data).then((r) => r.data.data),
  confirm: (id: number) => api.post<ApiResponse<Challan>>(`/api/challans/${id}/confirm`).then((r) => r.data),
  cancel: (id: number) => api.post<ApiResponse<Challan>>(`/api/challans/${id}/cancel`).then((r) => r.data),
};

export const dashboardApi = {
  summary: () => api.get<ApiResponse<DashboardSummary>>("/api/dashboard/summary").then((r) => r.data.data),
};
