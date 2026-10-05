import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { badRequest, notFound } from '../common/app-exception';
import { paginated } from '../common/interceptors/response-envelope.interceptor';
import { APP_TIME_ZONE, addDays, zonedToUtc } from '../common/utils/time';
import { escapeLike, normalizeText } from '../common/utils/text';
import { PrismaService } from '../prisma/prisma.service';
import { PublicSlotsQuery, SearchClinicsQuery, SearchProvidersQuery } from './dto/search.dto';

// Paginação profunda é limitada para a busca não virar varredura da tabela.
const MAX_OFFSET = 1000;

interface ProviderRow {
  id: string;
  public_profile: Record<string, unknown> | null;
  city: string | null;
  neighborhood: string | null;
  next_available_at: Date | null;
  distance_km: number | null;
}

const like = (column: Prisma.Sql, term: string) =>
  Prisma.sql`lower(f_unaccent(${column})) LIKE ${`%${escapeLike(normalizeText(term))}%`} ESCAPE '\\'`;

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async searchProviders(query: SearchProvidersQuery) {
    if (query.skip >= MAX_OFFSET) {
      throw badRequest('PAGE_TOO_DEEP', 'Refine a busca em vez de paginar tão fundo.');
    }
    if ((query.lat === undefined) !== (query.lng === undefined)) {
      throw badRequest('VALIDATION_ERROR', 'Informe lat e lng juntos.');
    }
    if (query.sort === 'distance' && query.lat === undefined) {
      throw badRequest('LOCATION_REQUIRED', 'Ordenar por distância exige lat e lng.');
    }

    // Subconsulta de horários que satisfazem todos os filtros de serviço/data.
    const slotConditions: Prisma.Sql[] = [
      Prisma.sql`s.professional_id = p.id`,
      Prisma.sql`s.status = 'AVAILABLE'`,
      Prisma.sql`s.starts_at > now()`,
      Prisma.sql`sv.active`,
    ];
    if (query.modality) slotConditions.push(Prisma.sql`sv.modality = ${query.modality}::"Modality"`);
    if (query.speciesId) {
      slotConditions.push(
        Prisma.sql`EXISTS (SELECT 1 FROM service_species ss WHERE ss.service_id = sv.id AND ss.species_id = ${query.speciesId}::uuid)`,
      );
    }
    if (query.date) {
      slotConditions.push(Prisma.sql`s.starts_at >= ${zonedToUtc(query.date, '00:00', APP_TIME_ZONE)}`);
      slotConditions.push(Prisma.sql`s.starts_at < ${zonedToUtc(addDays(query.date, 1), '00:00', APP_TIME_ZONE)}`);
    }
    const slotFilter = Prisma.join(slotConditions, ' AND ');
    const nextSlot = Prisma.sql`(SELECT min(s.starts_at) FROM availability_slots s JOIN services sv ON sv.id = s.service_id WHERE ${slotFilter})`;

    const where: Prisma.Sql[] = [Prisma.sql`p.verification_status = 'APPROVED'`, Prisma.sql`u.status = 'ACTIVE'`];
    if (query.city) where.push(like(Prisma.sql`p.city`, query.city));
    if (query.neighborhood) where.push(like(Prisma.sql`p.neighborhood`, query.neighborhood));
    if (query.q) {
      where.push(Prisma.sql`(
        ${like(Prisma.sql`p.display_name`, query.q)}
        OR ${like(Prisma.sql`coalesce(p.specialty, '')`, query.q)}
        OR ${like(Prisma.sql`coalesce(p.city, '')`, query.q)}
        OR ${like(Prisma.sql`coalesce(p.neighborhood, '')`, query.q)}
        OR EXISTS (SELECT 1 FROM service_professionals sp JOIN services sv ON sv.id = sp.service_id
                   WHERE sp.professional_id = p.id AND sv.active AND ${like(Prisma.sql`sv.name`, query.q)})
        OR EXISTS (SELECT 1 FROM clinic_professionals cp JOIN clinics c ON c.id = cp.clinic_id
                   WHERE cp.professional_id = p.id AND c.verification_status = 'APPROVED' AND ${like(Prisma.sql`c.name`, query.q)})
      )`);
    }
    // modalidade/espécie sem data: basta oferecer o serviço, mesmo sem horário livre agora
    if ((query.modality || query.speciesId) && !query.date) {
      where.push(Prisma.sql`EXISTS (
        SELECT 1 FROM service_professionals sp JOIN services sv ON sv.id = sp.service_id
        WHERE sp.professional_id = p.id AND sv.active
          ${query.modality ? Prisma.sql`AND sv.modality = ${query.modality}::"Modality"` : Prisma.empty}
          ${query.speciesId ? Prisma.sql`AND EXISTS (SELECT 1 FROM service_species ss WHERE ss.service_id = sv.id AND ss.species_id = ${query.speciesId}::uuid)` : Prisma.empty}
      )`);
    }
    if (query.date) where.push(Prisma.sql`${nextSlot} IS NOT NULL`);

    const distance =
      query.lat !== undefined && query.lng !== undefined
        ? Prisma.sql`CASE WHEN p.latitude IS NULL OR p.longitude IS NULL THEN NULL ELSE
            6371 * 2 * asin(sqrt(
              power(sin(radians((p.latitude::float8 - ${query.lat}::float8) / 2)), 2) +
              cos(radians(${query.lat}::float8)) * cos(radians(p.latitude::float8)) *
              power(sin(radians((p.longitude::float8 - ${query.lng}::float8) / 2)), 2))) END`
        : Prisma.sql`NULL::float8`;

    const orderBy =
      query.sort === 'name'
        ? Prisma.sql`lower(f_unaccent(p.display_name)) ASC, p.id ASC`
        : query.sort === 'distance'
          ? Prisma.sql`distance_km ASC NULLS LAST, p.display_name ASC, p.id ASC`
          : Prisma.sql`next_available_at ASC NULLS LAST, lower(f_unaccent(p.display_name)) ASC, p.id ASC`;

    const whereSql = Prisma.join(where, ' AND ');
    const [rows, totalRows] = await Promise.all([
      this.prisma.$queryRaw<ProviderRow[]>`
        SELECT p.id, p.public_profile, p.city, p.neighborhood,
               ${nextSlot} AS next_available_at,
               ${distance} AS distance_km
          FROM professionals p JOIN users u ON u.id = p.user_id
         WHERE ${whereSql}
         ORDER BY ${orderBy}
         LIMIT ${query.limit} OFFSET ${query.skip}`,
      this.prisma.$queryRaw<{ total: bigint }[]>`
        SELECT count(*) AS total FROM professionals p JOIN users u ON u.id = p.user_id WHERE ${whereSql}`,
    ]);

    const ids = rows.map((row) => row.id);
    const [services, clinics] = ids.length
      ? await Promise.all([this.servicesFor(ids), this.clinicsFor(ids)])
      : [new Map(), new Map()];

    const items = rows.map((row) => ({
      id: row.id,
      ...(row.public_profile ?? {}),
      services: services.get(row.id) ?? [],
      clinics: clinics.get(row.id) ?? [],
      nextAvailableAt: row.next_available_at,
      ...(row.distance_km !== null ? { distanceKm: Math.round(row.distance_km * 10) / 10 } : {}),
    }));
    return paginated(items, query.page, query.limit, Number(totalRows[0]?.total ?? 0));
  }

  async getProfessional(id: string) {
    const professional = await this.prisma.professional.findFirst({
      where: { id, verificationStatus: 'APPROVED', user: { status: 'ACTIVE' } },
      select: { id: true, publicProfile: true },
    });
    if (!professional) throw notFound('PROFESSIONAL_NOT_FOUND', 'Profissional não encontrado.');
    const [services, clinics] = await Promise.all([this.servicesFor([id]), this.clinicsFor([id])]);
    return {
      ...(professional.publicProfile as object),
      services: services.get(id) ?? [],
      clinics: clinics.get(id) ?? [],
    };
  }

  async listPublicSlots(professionalId: string, query: PublicSlotsQuery) {
    await this.getProfessional(professionalId);
    const slots = await this.prisma.availabilitySlot.findMany({
      where: {
        professionalId,
        status: 'AVAILABLE',
        service: { active: true },
        ...(query.serviceId ? { serviceId: query.serviceId } : {}),
        startsAt: {
          gt: query.from && new Date(query.from) > new Date() ? new Date(query.from) : new Date(),
          ...(query.to ? { lt: new Date(query.to) } : {}),
        },
      },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      take: 100,
      select: { id: true, serviceId: true, clinicId: true, startsAt: true, endsAt: true },
    });
    return slots;
  }

  async searchClinics(query: SearchClinicsQuery) {
    if (query.skip >= MAX_OFFSET) throw badRequest('PAGE_TOO_DEEP', 'Refine a busca em vez de paginar tão fundo.');
    const where: Prisma.Sql[] = [Prisma.sql`c.verification_status = 'APPROVED'`];
    if (query.city) where.push(like(Prisma.sql`c.city`, query.city));
    if (query.neighborhood) where.push(like(Prisma.sql`c.neighborhood`, query.neighborhood));
    if (query.q)
      where.push(
        Prisma.sql`(${like(Prisma.sql`c.name`, query.q)} OR ${like(Prisma.sql`c.city`, query.q)} OR ${like(Prisma.sql`c.neighborhood`, query.q)})`,
      );
    const whereSql = Prisma.join(where, ' AND ');
    const [rows, total] = await Promise.all([
      this.prisma.$queryRaw<{ id: string; public_profile: unknown }[]>`
        SELECT c.id, c.public_profile FROM clinics c WHERE ${whereSql}
         ORDER BY lower(f_unaccent(c.name)) ASC, c.id ASC LIMIT ${query.limit} OFFSET ${query.skip}`,
      this.prisma.$queryRaw<{ total: bigint }[]>`SELECT count(*) AS total FROM clinics c WHERE ${whereSql}`,
    ]);
    return paginated(
      rows.map((r) => r.public_profile ?? { id: r.id }),
      query.page,
      query.limit,
      Number(total[0]?.total ?? 0),
    );
  }

  // Uma consulta por relação para a página inteira, sem N+1.
  private async servicesFor(professionalIds: string[]) {
    const rows = await this.prisma.serviceProfessional.findMany({
      where: { professionalId: { in: professionalIds }, service: { active: true } },
      select: {
        professionalId: true,
        service: {
          select: {
            id: true,
            name: true,
            description: true,
            modality: true,
            durationMinutes: true,
            priceCents: true,
            species: { select: { species: { select: { id: true, slug: true, name: true } } } },
          },
        },
      },
      orderBy: { service: { name: 'asc' } },
    });
    const map = new Map<string, unknown[]>();
    for (const row of rows) {
      const { species, ...service } = row.service;
      const list = map.get(row.professionalId) ?? [];
      list.push({ ...service, species: species.map((s) => s.species) });
      map.set(row.professionalId, list);
    }
    return map;
  }

  private async clinicsFor(professionalIds: string[]) {
    const rows = await this.prisma.clinicProfessional.findMany({
      where: { professionalId: { in: professionalIds }, clinic: { verificationStatus: 'APPROVED' } },
      select: { professionalId: true, clinic: { select: { id: true, publicProfile: true } } },
    });
    const map = new Map<string, unknown[]>();
    for (const row of rows) {
      const list = map.get(row.professionalId) ?? [];
      list.push(row.clinic.publicProfile ?? { id: row.clinic.id });
      map.set(row.professionalId, list);
    }
    return map;
  }
}
