import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CapitalController } from './capital.controller';
import { CapitalService } from './capital.service';
import { MarketplaceAccountsService } from './marketplace-accounts.service';
import { NetworkCapitalService } from './network-capital.service';
import { NetworkController } from './network.controller';

@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [CapitalController, NetworkController],
  providers: [CapitalService, MarketplaceAccountsService, NetworkCapitalService],
  exports: [CapitalService, MarketplaceAccountsService, NetworkCapitalService],
})
export class CapitalModule {}
