/** Shared API types, mirroring the response shapes the Express API returns. */

export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export interface Organization {
  id: string;
  name: string;
  defaultLowStockThreshold: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  organization: Organization;
}

export interface Product {
  id: string;
  organizationId: string;
  name: string;
  sku: string;
  description: string | null;
  quantityOnHand: number;
  /** Fixed-2 decimal strings — money is never a float on the wire. */
  costPrice: string;
  sellingPrice: string;
  lowStockThreshold: number | null;
  effectiveLowStockThreshold: number;
  stockStatus: StockStatus;
  lastStockNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface DashboardSummary {
  totalProducts: number;
  totalStockUnits: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  inventoryCostValue: string;
  inventoryRetailValue: string;
  organization: Organization;
}

export interface LowStockItem {
  id: string;
  name: string;
  sku: string;
  quantityOnHand: number;
  lowStockThreshold: number | null;
  effectiveLowStockThreshold: number;
  stockStatus: StockStatus;
}

export type ProductSortKey =
  | 'name'
  | 'sku'
  | 'quantityOnHand'
  | 'sellingPrice'
  | 'costPrice'
  | 'createdAt'
  | 'updatedAt';

export type SortOrder = 'asc' | 'desc';

export type StatusFilter = 'ALL' | StockStatus;

export interface ProductFormValues {
  name: string;
  sku: string;
  description: string;
  quantityOnHand: string;
  costPrice: string;
  sellingPrice: string;
  lowStockThreshold: string;
}
