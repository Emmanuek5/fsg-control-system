import { z } from 'zod';

/**
 * Enum string values mirror the Prisma enums exactly so the same literals flow
 * from DB → API → web without translation.
 */

export const SubsidiaryType = {
  ONLINE_SHOP: 'ONLINE_SHOP',
  FARM_LAYERS: 'FARM_LAYERS',
  FARM_BROILERS: 'FARM_BROILERS',
  FARM_CROPS: 'FARM_CROPS',
  FARM_LIVESTOCK: 'FARM_LIVESTOCK',
  ASSETS: 'ASSETS',
  LAND_ESTATE: 'LAND_ESTATE',
  INVESTMENTS: 'INVESTMENTS',
} as const;
export type SubsidiaryType = (typeof SubsidiaryType)[keyof typeof SubsidiaryType];
export const subsidiaryTypeSchema = z.nativeEnum(SubsidiaryType);

export const SubsidiaryStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;
export type SubsidiaryStatus = (typeof SubsidiaryStatus)[keyof typeof SubsidiaryStatus];
export const subsidiaryStatusSchema = z.nativeEnum(SubsidiaryStatus);

export const MovementType = {
  IN: 'IN',
  OUT: 'OUT',
  ADJUSTMENT: 'ADJUSTMENT',
} as const;
export type MovementType = (typeof MovementType)[keyof typeof MovementType];
export const movementTypeSchema = z.nativeEnum(MovementType);

export const SaleChannel = {
  ONLINE: 'ONLINE',
  IN_STORE: 'IN_STORE',
  WHOLESALE: 'WHOLESALE',
} as const;
export type SaleChannel = (typeof SaleChannel)[keyof typeof SaleChannel];
export const saleChannelSchema = z.nativeEnum(SaleChannel);

export const BatchType = {
  LAYERS: 'LAYERS',
  BROILERS: 'BROILERS',
} as const;
export type BatchType = (typeof BatchType)[keyof typeof BatchType];
export const batchTypeSchema = z.nativeEnum(BatchType);

export const BatchStatus = {
  ACTIVE: 'ACTIVE',
  HARVESTED: 'HARVESTED',
  CLOSED: 'CLOSED',
} as const;
export type BatchStatus = (typeof BatchStatus)[keyof typeof BatchStatus];
export const batchStatusSchema = z.nativeEnum(BatchStatus);

export const CropStatus = {
  PLANNED: 'PLANNED',
  PLANTED: 'PLANTED',
  GROWING: 'GROWING',
  HARVESTED: 'HARVESTED',
} as const;
export type CropStatus = (typeof CropStatus)[keyof typeof CropStatus];
export const cropStatusSchema = z.nativeEnum(CropStatus);

export const LivestockSex = {
  MALE: 'MALE',
  FEMALE: 'FEMALE',
} as const;
export type LivestockSex = (typeof LivestockSex)[keyof typeof LivestockSex];
export const livestockSexSchema = z.nativeEnum(LivestockSex);

export const LivestockStatus = {
  ALIVE: 'ALIVE',
  SOLD: 'SOLD',
  DECEASED: 'DECEASED',
} as const;
export type LivestockStatus = (typeof LivestockStatus)[keyof typeof LivestockStatus];
export const livestockStatusSchema = z.nativeEnum(LivestockStatus);

export const AssetCondition = {
  NEW: 'NEW',
  GOOD: 'GOOD',
  FAIR: 'FAIR',
  POOR: 'POOR',
} as const;
export type AssetCondition = (typeof AssetCondition)[keyof typeof AssetCondition];
export const assetConditionSchema = z.nativeEnum(AssetCondition);

export const AssetStatus = {
  ACTIVE: 'ACTIVE',
  IN_REPAIR: 'IN_REPAIR',
  RETIRED: 'RETIRED',
  DISPOSED: 'DISPOSED',
} as const;
export type AssetStatus = (typeof AssetStatus)[keyof typeof AssetStatus];
export const assetStatusSchema = z.nativeEnum(AssetStatus);

export const MaintenanceStatus = {
  SCHEDULED: 'SCHEDULED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
export type MaintenanceStatus = (typeof MaintenanceStatus)[keyof typeof MaintenanceStatus];
export const maintenanceStatusSchema = z.nativeEnum(MaintenanceStatus);

export const LandStatus = {
  OWNED: 'OWNED',
  FINANCING: 'FINANCING',
  LEASED: 'LEASED',
} as const;
export type LandStatus = (typeof LandStatus)[keyof typeof LandStatus];
export const landStatusSchema = z.nativeEnum(LandStatus);

export const InvestmentType = {
  FIXED_DEPOSIT: 'FIXED_DEPOSIT',
  BONDS: 'BONDS',
  EQUITY: 'EQUITY',
  REAL_ESTATE: 'REAL_ESTATE',
  OTHER: 'OTHER',
} as const;
export type InvestmentType = (typeof InvestmentType)[keyof typeof InvestmentType];
export const investmentTypeSchema = z.nativeEnum(InvestmentType);

export const InvestmentStatus = {
  ACTIVE: 'ACTIVE',
  MATURED: 'MATURED',
  WITHDRAWN: 'WITHDRAWN',
} as const;
export type InvestmentStatus = (typeof InvestmentStatus)[keyof typeof InvestmentStatus];
export const investmentStatusSchema = z.nativeEnum(InvestmentStatus);

export const AlertSeverity = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  CRITICAL: 'CRITICAL',
} as const;
export type AlertSeverity = (typeof AlertSeverity)[keyof typeof AlertSeverity];
export const alertSeveritySchema = z.nativeEnum(AlertSeverity);

export const AlertType = {
  LOW_STOCK: 'LOW_STOCK',
  MAINTENANCE_DUE: 'MAINTENANCE_DUE',
  LAND_PAYMENT_DUE: 'LAND_PAYMENT_DUE',
  INVESTMENT_MATURITY: 'INVESTMENT_MATURITY',
  GENERAL: 'GENERAL',
} as const;
export type AlertType = (typeof AlertType)[keyof typeof AlertType];
export const alertTypeSchema = z.nativeEnum(AlertType);
