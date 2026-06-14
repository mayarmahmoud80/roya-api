import { IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { PlanTier } from '../../common/enums/plan-tier.enum';
import { BillingCycle } from '../../common/enums/billing-cycle.enum';

export class CreatePlanDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsEnum(PlanTier)
    tier: PlanTier;

    @IsNumber()
    @IsOptional()
    price?: number;

    @IsEnum(BillingCycle)
    @IsOptional()
    billingCycle?: BillingCycle;

    @IsBoolean()
    @IsOptional()
    apiAccessEnabled?: boolean;

    @IsNumber()
    @IsOptional()
    maxUsers?: number;
}
