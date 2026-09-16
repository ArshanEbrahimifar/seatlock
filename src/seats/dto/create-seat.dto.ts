import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class CreateSeatDto {
  @IsString()
  @IsNotEmpty()
  section!: string;

  @IsString()
  @IsNotEmpty()
  row!: string;

  @IsInt()
  @Min(1)
  number!: number;
}
