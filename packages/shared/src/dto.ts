import { z } from 'zod';
import {
  alertSeveritySchema,
  alertTypeSchema,
  approvalStatusSchema,
  assetConditionSchema,
  assetStatusSchema,
  batchStatusSchema,
  batchTypeSchema,
  cropInputTypeSchema,
  cropStatusSchema,
  financialRequestTypeSchema,
  investmentStatusSchema,
  investmentTypeSchema,
  landStatusSchema,
  livestockSexSchema,
  livestockStatusSchema,
  maintenanceStatusSchema,
  movementTypeSchema,
  requestEntityTypeSchema,
  saleChannelSchema,
  staffDepartmentSchema,
  staffStatusSchema,
  stockModeSchema,
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

export const createCategorySchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(300).optional().nullable(),
});
export type CreateCategoryDto = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = createCategorySchema.partial();
export type UpdateCategoryDto = z.infer<typeof updateCategorySchema>;

// ─── Product variants ─────────────────────────────────────────────────────

export const createProductVariantSchema = z.object({
  name: z.string().min(1).max(80),
  sku: z.string().max(60).optional().nullable(),
  /**
   * Base units consumed per unit sold — a 3 kg bag of a kg-based product is 3.
   * Only meaningful on POOLED products; forced to 1 on PER_VARIANT ones.
   */
  packSize: z.coerce.number().positive().default(1),
  unitPrice: z.coerce.number().nonnegative().default(0),
  costPrice: z.coerce.number().nonnegative().default(0),
  /** Ignored on POOLED products, where availability comes from the pool. */
  quantityOnHand: z.coerce.number().int().nonnegative().default(0),
  reorderLevel: z.coerce.number().int().nonnegative().default(0),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
});
export type CreateProductVariantDto = z.infer<typeof createProductVariantSchema>;

export const updateProductVariantSchema = createProductVariantSchema.partial();
export type UpdateProductVariantDto = z.infer<typeof updateProductVariantSchema>;

export const createProductSchema = z.object({
  subsidiaryId: z.string().optional().nullable(),
  name: z.string().min(1).max(160),
  sku: z.string().max(60).optional().nullable(),
  categoryId: z.string().optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  /** Base unit of measure. For POOLED products, the unit stock is counted in. */
  unit: z.string().min(1).max(20).default('pcs'),
  stockMode: stockModeSchema.default('PER_VARIANT'),
  unitPrice: z.coerce.number().nonnegative(),
  costPrice: z.coerce.number().nonnegative(),
  quantityOnHand: z.coerce.number().int().nonnegative().default(0),
  reorderLevel: z.coerce.number().int().nonnegative().default(0),
  imageUrl: z.string().max(500).optional().nullable(),
  /**
   * Optional variants to create alongside the product. When omitted, a single
   * "Default" variant is created carrying the product's price and stock, so
   * every product is sellable immediately.
   */
  variants: z.array(createProductVariantSchema).optional(),
});
export type CreateProductDto = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema.partial().omit({ variants: true });
export type UpdateProductDto = z.infer<typeof updateProductSchema>;

// ─── Inventory movements ──────────────────────────────────────────────────

export const createMovementSchema = z.object({
  productId: z.string().min(1),
  /** Defaults to the product's default variant when omitted. */
  variantId: z.string().optional().nullable(),
  type: movementTypeSchema,
  /** Counted in variant units (2 = two 3 kg bags), not base units. */
  quantity: z.coerce.number().int().positive(),
  unitCost: z.coerce.number().nonnegative().optional().nullable(),
  reference: z.string().max(120).optional().nullable(),
  note: z.string().max(300).optional().nullable(),
  occurredAt: z.coerce.date().optional(),
  receiptUrl: z.string().max(500).optional().nullable(),
});
export type CreateMovementDto = z.infer<typeof createMovementSchema>;

// ─── Sales ────────────────────────────────────────────────────────────────

export const saleItemSchema = z.object({
  productId: z.string().min(1),
  /** Defaults to the product's default variant when omitted. */
  variantId: z.string().optional().nullable(),
  quantity: z.coerce.number().int().positive(),
  /** Defaults to the variant's current selling price when omitted. */
  unitPrice: z.coerce.number().nonnegative().optional(),
});
export type SaleItemDto = z.infer<typeof saleItemSchema>;

export const createSaleSchema = z.object({
  items: z
    .array(saleItemSchema)
    .min(1, 'Add at least one product')
    .superRefine((items, ctx) => {
      // Keyed on product *and* variant: two sizes of the same rice on one
      // order are legitimate, the same size twice is a mistake.
      const seen = new Set<string>();
      for (const item of items) {
        const key = `${item.productId}:${item.variantId ?? 'default'}`;
        if (seen.has(key)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'The same product variant appears twice — merge the quantities instead',
          });
          return;
        }
        seen.add(key);
      }
    }),
  logisticsFee: z.coerce.number().nonnegative().default(0),
  channel: saleChannelSchema.default('ONLINE'),
  customerId: z.string().optional().nullable(),
  /** Walk-in buyer name, used when no customer record is linked. */
  customerName: z.string().max(120).optional().nullable(),
  note: z.string().max(300).optional().nullable(),
  soldAt: z.coerce.date().optional(),
  subsidiaryId: z.string().optional().nullable(),
  /** Payment/delivery proof attached when the sale is recorded. */
  proofUrl: z.string().max(500).optional().nullable(),
});
export type CreateSaleDto = z.infer<typeof createSaleSchema>;

export const verifySalesDaySchema = z.object({
  date: z.coerce.date(),
  proofUrl: z.string().max(500).optional().nullable(),
});
export type VerifySalesDayDto = z.infer<typeof verifySalesDaySchema>;

// ─── Customers ────────────────────────────────────────────────────────────

export const createCustomerSchema = z.object({
  name: z.string().min(1).max(160),
  company: z.string().max(160).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  email: z.string().email().max(160).optional().nullable(),
  addressLine: z.string().max(300).optional().nullable(),
  city: z.string().max(80).optional().nullable(),
  state: z.string().max(80).optional().nullable(),
  country: z.string().max(80).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  subsidiaryId: z.string().optional().nullable(),
});
export type CreateCustomerDto = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = createCustomerSchema.partial();
export type UpdateCustomerDto = z.infer<typeof updateCustomerSchema>;

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
  /** Feed is bought and counted in bags; total cost = bags × costPerBag. */
  quantityBags: z.coerce.number().nonnegative(),
  costPerBag: z.coerce.number().nonnegative().optional(),
});
export type CreateFeedDto = z.infer<typeof createFeedSchema>;

export const createFarmDispatchSchema = z.object({
  batchId: z.string().min(1),
  date: z.coerce.date(),
  /** Eggs (pieces) or birds processed, counted on the farm side. */
  quantity: z.coerce.number().int().positive(),
  /** Shop product the goods become; omit to record the dispatch only. */
  productId: z.string().optional().nullable(),
  variantId: z.string().optional().nullable(),
  /** Units of the shop variant to add (e.g. crates); defaults to `quantity`. */
  unitsAdded: z.coerce.number().int().positive().optional().nullable(),
  destination: z.string().max(160).optional().nullable(),
  note: z.string().max(300).optional().nullable(),
});
export type CreateFarmDispatchDto = z.infer<typeof createFarmDispatchSchema>;

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

export const createCropInputSchema = z.object({
  cropId: z.string().min(1),
  type: cropInputTypeSchema.default('SEED'),
  name: z.string().min(1).max(160),
  quantity: z.coerce.number().nonnegative().optional().nullable(),
  unit: z.string().max(20).optional().nullable(),
  cost: z.coerce.number().nonnegative().optional(),
  date: z.coerce.date(),
  notes: z.string().max(300).optional().nullable(),
});
export type CreateCropInputDto = z.infer<typeof createCropInputSchema>;

export const createCropRotationSchema = z.object({
  cropId: z.string().min(1),
  season: z.string().min(1).max(60),
  cropName: z.string().min(1).max(120),
  date: z.coerce.date().optional().nullable(),
  notes: z.string().max(300).optional().nullable(),
});
export type CreateCropRotationDto = z.infer<typeof createCropRotationSchema>;

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

// ─── Expenses ───────────────────────────────────────────────────────────────

export const createExpenseSchema = z.object({
  subsidiaryId: z.string().optional().nullable(),
  category: z.string().min(1).max(60),
  description: z.string().max(300).optional().nullable(),
  vendor: z.string().max(120).optional().nullable(),
  amount: z.coerce.number().positive(),
  incurredAt: z.coerce.date().optional(),
  receiptUrl: z.string().max(500).optional().nullable(),
});
export type CreateExpenseDto = z.infer<typeof createExpenseSchema>;

export const updateExpenseSchema = createExpenseSchema.partial();
export type UpdateExpenseDto = z.infer<typeof updateExpenseSchema>;
// ─── Approval requests ─────────────────────────────────────────────────────

export const approvalDecisionSchema = z.object({
  note: z.string().max(500).optional().nullable(),
});
export type ApprovalDecisionDto = z.infer<typeof approvalDecisionSchema>;

export const payOtpSchema = z.object({
  authorizationCode: z.string().min(1).max(20),
});
export type PayOtpDto = z.infer<typeof payOtpSchema>;

export const createRequestCommentSchema = z.object({
  entityType: requestEntityTypeSchema,
  entityId: z.string().min(1),
  message: z.string().min(1).max(1000),
  isInstruction: z.boolean().optional(),
});
export type CreateRequestCommentDto = z.infer<typeof createRequestCommentSchema>;

export const createStockRequestSchema = z.object({
  productId: z.string().min(1),
  /** Defaults to the product's default variant when omitted. */
  variantId: z.string().optional().nullable(),
  subsidiaryId: z.string().optional().nullable(),
  type: movementTypeSchema,
  /** Counted in variant units, matching the movement it will post. */
  quantity: z.coerce.number().int().positive(),
  unitCost: z.coerce.number().nonnegative().optional().nullable(),
  reference: z.string().max(120).optional().nullable(),
  note: z.string().max(500).optional().nullable(),
  receiptUrl: z.string().max(500).optional().nullable(),
});
export type CreateStockRequestDto = z.infer<typeof createStockRequestSchema>;

export const updateStockRequestSchema = createStockRequestSchema.partial().extend({
  status: approvalStatusSchema.optional(),
});
export type UpdateStockRequestDto = z.infer<typeof updateStockRequestSchema>;

const financialRequestBaseSchema = z.object({
  type: financialRequestTypeSchema,
  subsidiaryId: z.string().optional().nullable(),
  department: staffDepartmentSchema.optional().nullable(),
  amount: z.coerce.number().positive(),
  category: z.string().min(1).max(80),
  description: z.string().max(500).optional().nullable(),
  vendor: z.string().max(120).optional().nullable(),
  payeeName: z.string().max(120).optional().nullable(),
  bankName: z.string().max(120).optional().nullable(),
  bankCode: z.string().max(20).optional().nullable(),
  bankAccountNumber: z.string().max(20).optional().nullable(),
  requestedFor: z.coerce.date().optional().nullable(),
  attachmentUrl: z.string().max(500).optional().nullable(),
  phoneNumber: z.string().min(7).max(20).optional().nullable(),
  network: z.string().max(20).optional().nullable(),
  dataPlan: z.string().max(160).optional().nullable(),
  disco: z.string().max(60).optional().nullable(),
  customerId: z.string().max(80).optional().nullable(),
  meterType: z.string().max(20).optional().nullable(),
  payerName: z.string().max(120).optional().nullable(),
});

export const createFinancialRequestSchema = financialRequestBaseSchema.superRefine((value, ctx) => {
  if (value.type === 'AIRTIME' || value.type === 'DATA_BUNDLE') {
    if (!value.phoneNumber)
      ctx.addIssue({ code: 'custom', path: ['phoneNumber'], message: 'Phone number is required' });
    if (!value.network)
      ctx.addIssue({ code: 'custom', path: ['network'], message: 'Network is required' });
  }
  if (value.type === 'DATA_BUNDLE' && !value.dataPlan) {
    ctx.addIssue({ code: 'custom', path: ['dataPlan'], message: 'Data plan is required' });
  }
  if (value.type === 'ELECTRICITY_BILL') {
    if (!value.disco)
      ctx.addIssue({ code: 'custom', path: ['disco'], message: 'Disco is required' });
    if (!value.customerId)
      ctx.addIssue({
        code: 'custom',
        path: ['customerId'],
        message: 'Customer or meter number is required',
      });
    if (!value.meterType)
      ctx.addIssue({ code: 'custom', path: ['meterType'], message: 'Meter type is required' });
    if (!value.payerName)
      ctx.addIssue({ code: 'custom', path: ['payerName'], message: 'Payer name is required' });
  }
});
export type CreateFinancialRequestDto = z.infer<typeof createFinancialRequestSchema>;

export const updateFinancialRequestSchema = financialRequestBaseSchema.partial().extend({
  status: approvalStatusSchema.optional(),
});
export type UpdateFinancialRequestDto = z.infer<typeof updateFinancialRequestSchema>;
// ─── Staff ─────────────────────────────────────────────────────────────────

export const createStaffSchema = z.object({
  name: z.string().min(2).max(120),
  phone: z.string().max(30).optional().nullable(),
  email: z.string().email().optional().nullable(),
  jobTitle: z.string().max(120).optional().nullable(),
  department: staffDepartmentSchema.default('OTHER'),
  subsidiaryId: z.string().optional().nullable(),
  status: staffStatusSchema.optional(),
  startDate: z.coerce.date().optional().nullable(),
  bankName: z.string().max(120).optional().nullable(),
  bankCode: z.string().max(20).optional().nullable(),
  accountNumber: z.string().max(30).optional().nullable(),
  accountName: z.string().max(120).optional().nullable(),
  linkedUserId: z.string().optional().nullable(),
});
export type CreateStaffDto = z.infer<typeof createStaffSchema>;

export const updateStaffSchema = createStaffSchema.partial();
export type UpdateStaffDto = z.infer<typeof updateStaffSchema>;

// ─── Notifications ─────────────────────────────────────────────────────────

export const updateNotificationSchema = z.object({
  isRead: z.boolean().optional(),
});
export type UpdateNotificationDto = z.infer<typeof updateNotificationSchema>;
