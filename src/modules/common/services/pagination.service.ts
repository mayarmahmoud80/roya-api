import { Injectable } from '@nestjs/common';

export interface PaginationInput {
    page?: number;
    limit?: number;
}

@Injectable()
export class PaginationService {
    normalize(input: PaginationInput) {
        const page = Math.max(1, Number(input.page ?? 1));
        const limit = Math.min(100, Math.max(1, Number(input.limit ?? 25)));
        return { page, limit, skip: (page - 1) * limit };
    }
}

