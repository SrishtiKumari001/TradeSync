export type Role = "ADMIN" | "SALES" | "WAREHOUSE" | "ACCOUNTS";
export type CustomerType = "RETAIL" | "WHOLESALE" | "DISTRIBUTOR";
export type CustomerStatus = "LEAD" | "ACTIVE" | "INACTIVE";
export type ChallanStatus = "DRAFT" | "CONFIRMED" | "CANCELLED";
export type MovementType = "IN" | "OUT";

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  user: User;
}

export interface Paginated<T> {
  data: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface Customer {
  id: number;
  name: string;
  mobile: string;
  email: string | null;
  businessName: string | null;
  gstNumber: string | null;
  type: CustomerType;
  address: string | null;
  status: CustomerStatus;
  followUpDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: number; name: string };
}

export interface FollowUp {
  id: number;
  customerId: number;
  note: string;
  createdAt: string;
  createdBy: { id: number; name: string };
}

export interface Product {
  id: number;
  name: string;
  sku: string;
  category: string;
  unitPrice: number;
  currentStock: number;
  minStockAlert: number;
  location: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StockMovement {
  id: number;
  productId: number;
  quantityChange: number;
  movementType: MovementType;
  reason: string;
  createdAt: string;
  challanId: number | null;
  challan: { id: number; challanNumber: number } | null;
  createdBy: { id: number; name: string };
}

export interface ChallanItem {
  id: number;
  productId: number | null;
  productName: string;
  productSku: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface Challan {
  id: number;
  challanNumber: string;
  customerId: number;
  status: ChallanStatus;
  totalQuantity: number;
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
  customer?: Customer;
  createdBy?: { id: number; name: string };
  items?: ChallanItem[];
  _count?: { items: number };
}

export interface DashboardSummary {
  metrics: {
    customers: number;
    activeCustomers: number;
    products: number;
    lowStockCount: number;
    draftChallans: number;
    confirmedChallans: number;
  };
  lowStockProducts: { id: number; name: string; sku: string; currentStock: number; minStockAlert: number }[];
  recentChallans: {
    id: number;
    challanNumber: string;
    customer: string;
    status: ChallanStatus;
    totalQuantity: number;
    totalAmount: number;
    itemCount: number;
    createdAt: string;
  }[];
}
