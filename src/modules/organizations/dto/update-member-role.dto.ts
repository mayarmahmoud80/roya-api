import { IsEnum } from 'class-validator';
import { Role } from '../../common/enums/role.enum';

export class UpdateMemberRoleDto {
    @IsEnum(Role)
    role: Role;
}
