import { IsMongoId, IsNotEmpty } from 'class-validator';

export class UpgradeSubscriptionDto {
    @IsMongoId()
    @IsNotEmpty()
    planId: string;
}
