import { Global, Module } from '@nestjs/common';
import { PetOwnershipService } from './pet-ownership.service';

@Global()
@Module({ providers: [PetOwnershipService], exports: [PetOwnershipService] })
export class PetsModule {}
