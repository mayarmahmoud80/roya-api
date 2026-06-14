import { Injectable } from '@nestjs/common';
import { MapperTransform } from '../common/enums/builder-node.enum';

@Injectable()
export class DynamicFlowMapperService {
    applyRules(
        data: Record<string, unknown>,
        rules: Array<{
            targetPath: string;
            sourcePath?: string;
            transform: MapperTransform;
            parameters?: Record<string, unknown>;
            required: boolean;
        }>,
    ): Record<string, unknown> {
        const out = { ...data };
        for (const rule of rules) {
            this.applyOne(out, rule);
        }
        return out;
    }

    private getPath(obj: Record<string, unknown>, path: string): unknown {
        const parts = path.split('.').filter(Boolean);
        let cur: unknown = obj;
        for (const p of parts) {
            if (cur == null || typeof cur !== 'object') {
                return undefined;
            }
            cur = (cur as Record<string, unknown>)[p];
        }
        return cur;
    }

    private setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
        const parts = path.split('.').filter(Boolean);
        let cur: Record<string, unknown> = obj;
        for (let i = 0; i < parts.length - 1; i++) {
            const p = parts[i]!;
            if (cur[p] == null || typeof cur[p] !== 'object') {
                cur[p] = {};
            }
            cur = cur[p] as Record<string, unknown>;
        }
        cur[parts[parts.length - 1]!] = value;
    }

    private applyOne(
        out: Record<string, unknown>,
        rule: { targetPath: string; sourcePath?: string; transform: MapperTransform; parameters?: Record<string, unknown>; required: boolean },
    ): void {
        switch (rule.transform) {
            case MapperTransform.DIRECT: {
                if (rule.sourcePath) {
                    this.setPath(out, rule.targetPath, this.getPath(out, rule.sourcePath));
                }
                break;
            }
            case MapperTransform.DEFAULT_VALUE: {
                if (this.getPath(out, rule.targetPath) == null) {
                    this.setPath(out, rule.targetPath, rule.parameters?.['value']);
                }
                break;
            }
            case MapperTransform.FORMAT_CONVERSION: {
                if (rule.sourcePath) {
                    const v = this.getPath(out, rule.sourcePath);
                    const to = (rule.parameters?.['to'] as string) ?? 'string';
                    this.setPath(out, rule.targetPath, to === 'string' ? String(v ?? '') : v);
                }
                break;
            }
            case MapperTransform.FILTER: {
                const field = rule.parameters?.['field'] as string | undefined;
                const arr = this.getPath(out, rule.sourcePath?.split('.')[0] ?? '') as unknown;
                if (field && Array.isArray(arr)) {
                    this.setPath(
                        out,
                        rule.targetPath,
                        arr.map(item => (item && typeof item === 'object' ? (item as Record<string, unknown>)[field] : item)),
                    );
                }
                break;
            }
            case MapperTransform.COMBINE_FIELDS: {
                const fields = (rule.parameters?.['fields'] as string[]) ?? [];
                this.setPath(
                    out,
                    rule.targetPath,
                    fields.map(f => this.getPath(out, f)),
                );
                break;
            }
            default:
                break;
        }
    }
}
