import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ParseIdPipe } from '../common/pipes/parse-uuid.pipe';
import { PublicSlotsQuery, SearchClinicsQuery, SearchProvidersQuery } from './dto/search.dto';
import { SearchService } from './search.service';

@ApiTags('Busca')
@Controller('search')
@Throttle({ default: { limit: 60, ttl: 60_000 } })
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get('professionals')
  @ApiOperation({
    summary: 'Busca profissionais aprovados',
    description:
      'Texto sem acento, filtros combináveis e próxima disponibilidade. lat/lng são opcionais e não são armazenados.',
  })
  professionals(@Query() query: SearchProvidersQuery) {
    return this.search.searchProviders(query);
  }

  @Get('professionals/:id')
  professional(@Param('id', ParseIdPipe) id: string) {
    return this.search.getProfessional(id);
  }

  @Get('professionals/:id/slots')
  @ApiOperation({ summary: 'Próximos horários livres do profissional (até 100)' })
  slots(@Param('id', ParseIdPipe) id: string, @Query() query: PublicSlotsQuery) {
    return this.search.listPublicSlots(id, query);
  }

  @Get('clinics')
  clinics(@Query() query: SearchClinicsQuery) {
    return this.search.searchClinics(query);
  }
}
