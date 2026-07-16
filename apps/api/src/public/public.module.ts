import { Module } from '@nestjs/common';
import { PublicToolsController } from './public-tools.controller';

@Module({
  controllers: [PublicToolsController],
})
export class PublicModule {}
