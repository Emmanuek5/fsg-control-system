import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';

const LABELS: Record<string, string> = {
  products: 'Product',
  'inventory-movements': 'Stock movement',
  sales: 'Sale',
  customers: 'Customer',
  expenses: 'Expense',
  crops: 'Crop',
  livestock: 'Livestock',
  assets: 'Asset',
  maintenance: 'Maintenance',
  investments: 'Investment',
  alerts: 'Alert',
  subsidiaries: 'Subsidiary',
  users: 'User',
  roles: 'Role',
  notifications: 'Notification',
  'stock-requests': 'Stock request',
  'financial-requests': 'Financial request',
  staff: 'Staff',
};
const FARM: Record<string, string> = {
  batches: 'Farm batch',
  eggs: 'Egg record',
  mortality: 'Mortality record',
  feed: 'Feed record',
};
const LAND: Record<string, string> = { plots: 'Land plot', payments: 'Land payment' };
const CROP_SUB: Record<string, string> = { inputs: 'Crop input', rotations: 'Crop rotation' };
const SUBKEYS = new Set([
  'inputs',
  'rotations',
  'permissions',
  'generate',
  'payments',
  'eggs',
  'mortality',
  'feed',
  'batches',
  'summary',
]);

/**
 * Records a row in the audit log for every successful mutating request
 * (POST/PATCH/PUT/DELETE). Read requests and auth/upload/audit endpoints are skipped.
 * Logging is fire-and-forget so it never delays or fails the actual request.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const method: string = req.method;
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) return next.handle();

    return next.handle().pipe(
      tap((result) => {
        void this.record(req, method, result).catch(() => undefined);
      }),
    );
  }

  private async record(req: any, method: string, result: any) {
    const url: string = (req.originalUrl ?? req.url ?? '').split('?')[0];
    if (
      url.includes('/auth/') ||
      url.includes('/audit') ||
      url.includes('/uploads') ||
      url.includes('/alerts/generate')
    ) {
      return;
    }

    const segs = url.replace(/^\/api\//, '').split('/').filter(Boolean);
    const resourceKey = segs[0] ?? '';
    const sub = segs[1];

    let entity = LABELS[resourceKey] ?? resourceKey ?? 'Record';
    if (resourceKey === 'farm') entity = FARM[sub] ?? 'Farm record';
    else if (resourceKey === 'land') entity = LAND[sub] ?? 'Land record';
    else if (resourceKey === 'crops' && (sub === 'inputs' || sub === 'rotations')) entity = CROP_SUB[sub];

    const action = method === 'POST' ? 'CREATE' : method === 'DELETE' ? 'DELETE' : 'UPDATE';
    const verb = action === 'CREATE' ? 'Created' : action === 'DELETE' ? 'Deleted' : 'Updated';
    const name: string | null = result?.name ?? result?.title ?? result?.email ?? null;

    const lastSeg = segs[segs.length - 1];
    const entityId =
      result?.id ?? (lastSeg && !SUBKEYS.has(lastSeg) && lastSeg !== resourceKey ? lastSeg : null);

    const user = req.user as { id?: string; email?: string } | undefined;

    await this.prisma.auditLog.create({
      data: {
        actorId: user?.id ?? null,
        actorEmail: user?.email ?? null,
        action,
        entity,
        entityId,
        summary: `${verb} ${entity}${name ? `: ${name}` : ''}`,
      },
    });
  }
}

