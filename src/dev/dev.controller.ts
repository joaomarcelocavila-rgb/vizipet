import { Body, Controller, Get, Post } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Protected } from '../auth/decorators/protected.decorator';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { notFound } from '../common/app-exception';
import { PrismaService } from '../prisma/prisma.service';

class DevLoginDto {
  @IsEmail() email: string;
}

/**
 * Atalhos de desenvolvimento enquanto o login e o CRUD de pets do José não entram.
 * O módulo só é carregado com NODE_ENV=development.
 */
@ApiTags('Dev (só em desenvolvimento)')
@Controller('dev')
export class DevController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  @Get('users')
  @ApiOperation({ summary: 'Usuários do seed para o "entrar como"' })
  users() {
    return this.prisma.user.findMany({
      where: { email: { endsWith: '@vizipet.test' } },
      select: { email: true, name: true, role: true },
      orderBy: { role: 'asc' },
    });
  }

  @Post('login')
  @ApiOperation({ summary: 'Emite access token para um usuário do seed' })
  async login(@Body() dto: DevLoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (!user || !user.email.endsWith('@vizipet.test'))
      throw notFound('USER_NOT_FOUND', 'Usuário de seed não encontrado.');
    const accessToken = await this.jwt.signAsync({ sub: user.id, role: user.role, typ: 'access' }, { expiresIn: '8h' });
    return { accessToken, user: { id: user.id, name: user.name, role: user.role } };
  }

  @Get('pets')
  @Protected('TUTOR')
  @ApiOperation({ summary: 'Pets do tutor (provisório até o PetsModule do José)' })
  pets(@CurrentUser() user: AuthenticatedUser) {
    return this.prisma.pet.findMany({
      where: { ownerId: user.id, deletedAt: null },
      select: {
        id: true,
        name: true,
        breed: true,
        sex: true,
        birthDate: true,
        species: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });
  }
}
