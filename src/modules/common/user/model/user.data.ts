import { Role } from '../../enums/role.enum';
import { UserDocument } from './user.schema';

export class UserData {

    public id: string;
    public email: string;
    public role: Role;
    public name: string;
    public organizationId: string;

    public constructor(user: UserDocument) {
        this.id = `${user.id}`;
        this.email = user.email;
        this.role = user.role;
        this.name = user.name;
        this.organizationId = user.organizationId?.toString() || '';
    }

}
