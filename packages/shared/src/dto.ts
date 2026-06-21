import { z } from 'zod';
import {
  alertSeveritySchema,
  alertTypeSchema,
  assetConditionSchema,
  assetStatusSchema,
  batchStatusSchema,
  batchTypeSchema,
  cropStatusSchema,
  investmentStatusSchema,
  investmentTypeSchema,
  landStatusSchema,
  livestockSexSchema,
  livestockStatusSchema,
  maintenanceStatusSchema,
  movementTypeSchema,
  saleChannelSchema,
  subsidiaryTypeSchema,
} from './enums';

// ─── Common ───────────────────────────────────────────────────────────────

export const idParamSchema = z.object({ id: z.string().min(1) });

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  search: z.string().trim().optional(),
});
export type Pagination = z.infer<typeof paginationSchema>;

// ─── Auth ───────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginDto = z.infer<typeof loginSchema>;

// ─── Roles ──────────────────────────────────────────────────────────────────

export const createRoleSchema = z.object({
  name: z.string().min(2).max(60),
  description: z.string().max(300).optional().nullable(),
  permissionKeys: z.array(z.string()).optional(),
});
export type CreateRoleDto = z.infer<typeof createRoleSchema>;

export const updateRoleSchema = z.object({
  name: z.string().min(2).max(60).optional(),
  description: z.string().max(300).optional().nullable(),
});
export type UpdateRoleDto = z.infer<typeof updateRoleSchema>;

export const setRolePermissionsSchema = z.object({
  permissionKeys: z.array(z.string()),
});
export type SetRolePermissionsDto = z.infer<typeof setRolePermissionsSchema>;

// ─── Users ──────────────────────────────────────────────────────────────────

export const createUserSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(6).max(100),
  roleId: z.string().min(1),
  subsidiaryId: z.string().optional().nullable(),
});
export type CreateUserDto = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).max(100).optional(),
  roleId: z.string().min(1).optional(),
  subsidiaryId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});
export type UpdateUserDto = z.infer<typeof updateUserSchema>;

// ─── Subsidiaries ─────────────────────────────────────────────────────────

export const createSubsidiarySchema = z.object({
  name: z.string().min(2).max(120),
  type: subsidiaryTypeSchema,
  description: z.string().max(300).optional().nullable(),
});
export type CreateSubsidiaryDto = z.infer<typeof createSubsidiarySchema>;

// ─── Products ─────────────────────────────────────────────────────────────

export const createProductSchema = z.object({
  subsidiaryId: z.string().optional().nullable(),
  name: z.string().min(1).max(160),
  sku: z.string().max(60).optional().nullable(),
  category: z.string().max(80).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  unit: z.string().min(1).max(20).default('pcs'),
  unitPrice: z.coerce.number().nonnegative(),
  costPrice: z.coerce.number().nonnegative(),
  quantityOnHand: z.coerce.number().int().nonnegative().default(0),
  reorderLevel: z.coerce.number().int().nonnegative().default(0),
  imageUrl: z.string().max(500).optional().nullable(),
});
export type CreateProductDto = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema.partial();
export type UpdateProductDto = z.infer<typeof updateProductSchema>;

// ─── Inventory movements ──────────────────────────────────────────────────

export const createMovementSchema = z.object({
  productId: z.string().min(1),
  type: movementTypeSchema,
  quantity: z.coerce.number().int().positive(),
  unitCost: z.coerce.number().nonnegative().optional().nullable(),
  reference: z.string().max(120).optional().nullable(),
  note: z.string().max(300).optional().nullable(),
  occurredAt: z.coerce.date().optional(),
  receiptUrl: z.string().max(500).optional().nullable(),
});
export type CreateMovementDto = z.infer<typeof createMovementSchema>;

// ─── Sales ────────────────────────────────────────────────────────────────

export const createSaleSchema = z.object({
  subsidiaryId: z.string().optional().nullable(),
  productId: z.string().optional().nullable(),
  quantity: z.coerce.number().int().positive(),
  unitPrice: z.coerce.number().nonnegative(),
  channel: saleChannelSchema.optional(),
  customer: z.string().max(160).optional().nullable(),
  soldAt: z.coerce.date().optional(),
});
export type CreateSaleDto = z.infer<typeof createSaleSchema>;

// ─── Farm batches ─────────────────────────────────────────────────────────

export const createFarmBatchSchema = z.object({
  subsidiaryId: z.string().optional().nullable(),
  name: z.string().min(1).max(120),
  type: batchTypeSchema,
  breed: z.string().max(80).optional().nullable(),
  initialCount: z.coerce.number().int().positive(),
  startDate: z.coerce.date(),
  expectedHarvest: z.coerce.date().optional().nullable(),
  status: batchStatusSchema.optional(),
  notes: z.string().max(500).optional().nullable(),
});
export type CreateFarmBatchDto = z.infer<typeof createFarmBatchSchema>;
export const updateFarmBatchSchema = createFarmBatchSchema.partial();
export type UpdateFarmBatchDto = z.infer<typeof updateFarmBatchSchema>;

export const createEggProductionSchema = z.object({
  batchId: z.string().min(1),
  date: z.coerce.date(),
  eggsCollected: z.coerce.number().int().nonnegative(),
  traysCollected: z.coerce.number().int().nonnegative().optional(),
  damaged: z.coerce.number().int().nonnegative().optional(),
  gradeA: z.coerce.number().int().nonnegative().optional(),
  gradeB: z.coerce.number().int().nonnegative().optional(),
});
export type CreateEggProductionDto = z.infer<typeof createEggProductionSchema>;

export const createMortalitySchema = z.object({
  batchId: z.string().min(1),
  date: z.coerce.date(),
  count: z.coerce.number().int().positive(),
  cause: z.string().max(160).optional().nullable(),
});
export type CreateMortalityDto = z.infer<typeof createMortalitySchema>;

export const createFeedSchema = z.object({
  batchId: z.string().min(1),
  date: z.coerce.date(),
  feedType: z.string().max(120).optional().nullable(),
  quantityKg: z.coerce.number().nonnegative(),
  cost: z.coerce.number().nonnegative().optional(),
});
export type CreateFeedDto = z.infer<typeof createFeedSchema>;

// ─── Crops ────────────────────────────────────────────────────────────────

export const createCropSchema = z.object({
  subsidiaryId: z.string().optional().nullable(),
  name: z.string().min(1).max(120),
  variety: z.string().max(120).optional().nullable(),
  plot: z.string().max(120).optional().nullable(),
  areaHectares: z.coerce.number().nonnegative().optional(),
  plantingDate: z.coerce.date().optional().nullable(),
  expectedHarvest: z.coerce.date().optional().nullable(),
  expectedYield: z.coerce.number().nonnegative().optional().nullable(),
  actualYield: z.coerce.number().nonnegative().optional().nullable(),
  status: cropStatusSchema.optional(),
});
export type CreateCropDto = z.infer<typeof createCropSchema>;
export const updateCropSchema = createCropSchema.partial();
export type UpdateCropDto = z.infer<typeof updateCropSchema>;

// ─── Livestock ────────────────────────────────────────────────────────────

export const createLivestockSchema = z.object({
  subsidiaryId: z.string().optional().nullable(),
  species: z.string().min(1).max(80),
  tagNumber: z.string().max(60).optional().nullable(),
  breed: z.string().max(80).optional().nullable(),
  sex: livestockSexSchema.optional().nullable(),
  dob: z.coerce.date().optional().nullable(),
  acquisitionCost: z.coerce.number().nonnegative().optional().nullable(),
  weightKg: z.coerce.number().nonnegative().optional().nullable(),
  status: livestockStatusSchema.optional(),
});
export type CreateLivestockDto = z.infer<typeof createLivestockSchema>;
export const updateLivestockSchema = createLivestockSchema.partial();
export type UpdateLivestockDto = z.infer<typeof updateLivestockSchema>;

// ─── Assets ───────────────────────────────────────────────────────────────

export const createAssetSchema = z.object({
  subsidiaryId: z.string().optional().nullable(),
  name: z.string().min(1).max(160),
  category: z.string().max(80).optional().nullable(),
  serialNumber: z.string().max(120).optional().nullable(),
  purchaseDate: z.coerce.date().optional().nullable(),
  purchaseCost: z.coerce.number().nonnegative().optional(),
  currentValue: z.coerce.number().nonnegative().optional(),
  condition: assetConditionSchema.optional(),
  location: z.string().max(160).optional().nullable(),
  imageUrl: z.string().max(500).optional().nullable(),
  status: assetStatusSchema.optional(),
});
export type CreateAssetDto = z.infer<typeof createAssetSchema>;
export const updateAssetSchema = createAssetSchema.partial();
export type UpdateAssetDto = z.infer<typeof updateAssetSchema>;

// ─── Maintenance ──────────────────────────────────────────────────────────

export const createMaintenanceSchema = z.object({
  assetId: z.string().min(1),
  type: z.string().max(120).optional().nullable(),
  scheduledDate: z.coerce.date(),
  completedDate: z.coerce.date().optional().nullable(),
  cost: z.coerce.number().nonnegative().optional(),
  vendor: z.string().max(120).optional().nullable(),
  status: maintenanceStatusSchema.optional(),
  note: z.string().max(300).optional().nullable(),
});
export type CreateMaintenanceDto = z.infer<typeof createMaintenanceSchema>;
export const updateMaintenanceSchema = createMaintenanceSchema.partial();
export type UpdateMaintenanceDto = z.infer<typeof updateMaintenanceSchema>;

// ─── Land ─────────────────────────────────────────────────────────────────

export const createLandPlotSchema = z.object({
  name: z.string().min(1).max(160),
  location: z.string().max(160).optional().nullable(),
  sizeAcres: z.coerce.number().nonnegative().optional(),
  purchasePrice: z.coerce.number().nonnegative().optional(),
  totalDue: z.coerce.number().nonnegative().optional(),
  titleDocUrl: z.string().max(500).optional().nullable(),
  acquisitionDate: z.coerce.date().optional().nullable(),
  status: landStatusSchema.optional(),
});
export type CreateLandPlotDto = z.infer<typeof createLandPlotSchema>;
export const updateLandPlotSchema = createLandPlotSchema.partial();
export type UpdateLandPlotDto = z.infer<typeof updateLandPlotSchema>;

export const createLandPaymentSchema = z.object({
  plotId: z.string().min(1),
  amount: z.coerce.number().positive(),
  paidAt: z.coerce.date().optional(),
  method: z.string().max(80).optional().nullable(),
  reference: z.string().max(120).optional().nullable(),
});
export type CreateLandPaymentDto = z.infer<typeof createLandPaymentSchema>;

// ─── Investments ──────────────────────────────────────────────────────────

export const createInvestmentSchema = z.object({
  name: z.string().min(1).max(160),
  type: investmentTypeSchema.optional(),
  institution: z.string().max(120).optional().nullable(),
  principal: z.coerce.number().nonnegative().optional(),
  interestRate: z.coerce.number().nonnegative().optional(),
  startDate: z.coerce.date().optional().nullable(),
  maturityDate: z.coerce.date().optional().nullable(),
  expectedReturn: z.coerce.number().nonnegative().optional().nullable(),
  documentUrl: z.string().max(500).optional().nullable(),
  status: investmentStatusSchema.optional(),
});
export type CreateInvestmentDto = z.infer<typeof createInvestmentSchema>;
export const updateInvestmentSchema = createInvestmentSchema.partial();
export type UpdateInvestmentDto = z.infer<typeof updateInvestmentSchema>;

// ─── Alerts ───────────────────────────────────────────────────────────────

export const createAlertSchema = z.object({
  type: alertTypeSchema.optional(),
  severity: alertSeveritySchema.optional(),
  title: z.string().min(1).max(160),
  message: z.string().max(500).optional().nullable(),
  subsidiaryId: z.string().optional().nullable(),
  relatedEntity: z.string().max(80).optional().nullable(),
});
export type CreateAlertDto = z.infer<typeof createAlertSchema>;

export const updateAlertSchema = z.object({
  isRead: z.boolean().optional(),
  isResolved: z.boolean().optional(),
  severity: alertSeveritySchema.optional(),
  title: z.string().min(1).max(160).optional(),
  message: z.string().max(500).optional().nullable(),
});
export type UpdateAlertDto = z.infer<typeof updateAlertSchema>;
