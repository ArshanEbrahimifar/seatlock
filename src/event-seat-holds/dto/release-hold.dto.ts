import { IsUUID } from 'class-validator';

export class ReleaseHoldDto {
  @IsUUID()
  holdToken!: string;
}
