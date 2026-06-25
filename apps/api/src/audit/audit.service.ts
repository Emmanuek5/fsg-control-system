import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  list(entity?: string, action?: string) {
    return this.prisma.auditLog.findMany({
      where: {
        ...(entity ? { entity } : {}),
        ...(action ? { action: action as 'CREATE' | 'UPDATE' | 'DELETE' } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
      include: { actor: { select: { name: true } } },
    });
  }
}
