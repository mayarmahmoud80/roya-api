import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
    success: boolean;
    message: string;
    data: T;
    pagination?: {
        total: number;
        page: number;
        limit: number;
    };
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
    intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
        return next.handle().pipe(
            map((data) => {
                if (data && typeof data === 'object' && 'items' in data && 'total' in data) {
                    const { items, total, page, limit, ...rest } = data as any;
                    return {
                        success: true,
                        message: 'Success',
                        data: items,
                        pagination: { total, page, limit },
                        ...rest,
                    };
                }
                return {
                    success: true,
                    message: 'Success',
                    data,
                };
            }),
        );
    }
}
