import { Injectable } from '@nestjs/common';
import { Pet } from '../generated/prisma/client';
import { forbidden, notFound } from '../common/app-exception';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Contrato do bloco do José: assertPetOwnership(petId, tutorId).
 * Implementação mínima até o PetsModule real entrar; a assinatura é a combinada.
 */
@Injectable()
export class PetOwnershipService {
  constructor(private readonly prisma: PrismaService) {}

  async assertPetOwnership(petId: string, tutorId: string): Promise<Pet> {
    const pet = await this.prisma.pet.findUnique({ where: { id: petId } });
    if (!pet || pet.deletedAt) throw notFound('PET_NOT_FOUND', 'Pet não encontrado.');
    if (pet.ownerId !== tutorId) throw forbidden('PET_NOT_OWNED', 'Este pet pertence a outro tutor.');
    return pet;
  }
}
