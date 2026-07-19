import { Role } from '../../../generated/prisma/enums.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
  organizationId: string | null;
}
