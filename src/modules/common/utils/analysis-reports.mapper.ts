/**
 * Shared shaping of report rows for analysis overview (used by GET /analyses/:id
 * and GET /reports/analysis-overview/:analysisId).
 */
function firstLocalizedString(localized: unknown): string {
    if (localized && typeof localized === 'object' && localized !== null) {
        const values = (localized as { values?: Record<string, string> }).values;
        if (values && typeof values === 'object') {
            const en = values['en']?.trim();
            if (en) return en;
            for (const v of Object.values(values)) {
                if (typeof v === 'string' && v.trim()) return v.trim();
            }
        }
    }
    return '';
}

export function resolveReportTypeDisplayName(
    rt: Record<string, unknown> | null | undefined,
    slug: string,
): string {
    if (!rt) return slug;
    const n = rt['name'];
    if (typeof n === 'string' && n.trim()) return n.trim();
    return firstLocalizedString(rt['localizedName']) || slug;
}

export function resolveReportTypeDescriptionText(rt: Record<string, unknown> | null | undefined): string {
    if (!rt) return '';
    const d = rt['description'];
    if (typeof d === 'string' && d.trim()) return d.trim();
    return firstLocalizedString(rt['localizedDescription']);
}

export function mapRawReportsForAnalysisView(
    rawReports: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
    return rawReports.map((r) => {
        const rt = r['reportTypeId'] as Record<string, unknown> | null | undefined;
        const slug = (rt?.['slug'] as string) || '';
        const name = resolveReportTypeDisplayName(rt, slug);
        const description = resolveReportTypeDescriptionText(rt);
        return {
            ...r,
            reportTypeId: rt?.['_id'] ?? r['reportTypeId'],
            reportType: rt
                ? {
                      _id: rt['_id'],
                      slug,
                      name,
                      description,
                  }
                : undefined,
        };
    });
}
