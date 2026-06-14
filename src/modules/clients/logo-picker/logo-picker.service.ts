import { Injectable } from '@nestjs/common';
import {
    extractJsonLdLogoUrls,
    isClearlyNonLogoImageUrl,
    scoreImageTagForBrandLogo,
    scoreInlineSvg,
} from './logo-candidate.scoring';

@Injectable()
export class LogoPickerService {
    private readonly imgTagRe = /<img\b([^>]*)>/gi;

    private resolveUrl(src: string, baseUrl?: string): string | null {
        if (!src) {
            return null;
        }
        const t = src.trim();
        if (t.startsWith('http://') || t.startsWith('https://')) {
            return t;
        }
        if (t.startsWith('//')) {
            return `https:${t}`;
        }
        if (t.startsWith('data:')) {
            return null;
        }
        if (baseUrl) {
            try {
                return new URL(t, baseUrl).href;
            } catch {
                return null;
            }
        }
        return null;
    }

    private attrValue(tagPart: string, name: string): string {
        const re = new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i');
        const m = tagPart.match(re);
        return m ? m[1]! : '';
    }

    private regionForPosition(
        pos: number,
        sections: { name: 'header' | 'nav' | 'footer' | 'header_nav'; start: number; end: number }[],
    ): 'header' | 'nav' | 'footer' | 'header_nav' | 'other' {
        const inside = sections.filter(s => pos >= s.start && pos < s.end);
        if (inside.some(s => s.name === 'header_nav')) {
            return 'header_nav';
        }
        if (inside.some(s => s.name === 'header')) {
            return 'header';
        }
        if (inside.some(s => s.name === 'nav')) {
            return 'nav';
        }
        if (inside.some(s => s.name === 'footer')) {
            return 'footer';
        }
        return 'other';
    }

    private buildPageSections(
        html: string,
    ): { name: 'header' | 'nav' | 'footer' | 'header_nav'; start: number; end: number }[] {
        const out: { name: 'header' | 'nav' | 'footer' | 'header_nav'; start: number; end: number }[] = [];
        for (const re of [/<header\b[^>]*>[\s\S]*?<\/header>/gi, /<div\b[^>]+(?:class|id)=[^>]*header[^>]*>[\s\S]*?<\/div>/gi]) {
            re.lastIndex = 0;
            for (const m of html.matchAll(re)) {
                if (m.index != null) {
                    out.push({ name: 'header', start: m.index, end: m.index + m[0].length });
                }
            }
        }
        for (const m of html.matchAll(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi)) {
            if (m.index == null) {
                continue;
            }
            const start = m.index;
            const end = m.index + m[0].length;
            if (out.some(s => s.name === 'header' && start >= s.start && end <= s.end)) {
                out.push({ name: 'header_nav', start, end });
            } else {
                out.push({ name: 'nav', start, end });
            }
        }
        for (const m of html.matchAll(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi)) {
            if (m.index != null) {
                out.push({ name: 'footer', start: m.index, end: m.index + m[0].length });
            }
        }
        return out;
    }

    private mapRegionToHint(
        r: 'header' | 'nav' | 'footer' | 'header_nav' | 'other',
    ): 'header' | 'header_nav' | 'nav' | 'footer' | 'other' {
        if (r === 'header_nav') {
            return 'header_nav';
        }
        if (r === 'header') {
            return 'header';
        }
        if (r === 'nav') {
            return 'nav';
        }
        if (r === 'footer') {
            return 'footer';
        }
        return 'other';
    }

    private getLogoFromHtml(html?: string, baseUrl?: string): string | null {
        if (!html) {
            return null;
        }

        type Candidate = { value: string; kind: 'url' | 'inline-svg'; score: number };
        const cands: Candidate[] = [];
        const sections = this.buildPageSections(html);
        const fromJsonLd = extractJsonLdLogoUrls(html);
        const hadJsonLd = fromJsonLd.length > 0;

        for (const u of fromJsonLd) {
            if (isClearlyNonLogoImageUrl(u)) {
                continue;
            }
            cands.push({
                value: u,
                kind: 'url',
                score: 130,
            });
        }

        this.imgTagRe.lastIndex = 0;
        for (const m of html.matchAll(this.imgTagRe)) {
            const pos = m.index ?? 0;
            const inner = m[1] ?? '';
            const src =
                this.attrValue(inner, 'src') || this.attrValue(inner, 'data-src') || this.attrValue(inner, 'data-lazy-src');
            const href = this.resolveUrl(src, baseUrl);
            if (!href || isClearlyNonLogoImageUrl(href)) {
                continue;
            }
            const tagLower = m[0].toLowerCase();
            const reg = this.regionForPosition(pos, sections);
            const regionHint = this.mapRegionToHint(reg);
            const s = scoreImageTagForBrandLogo(
                href,
                {
                    regionHint,
                    tagLower: `${tagLower} ${this.attrValue(inner, 'alt')} ${this.attrValue(inner, 'class')} ${this.attrValue(inner, 'id')}`,
                },
                false,
            );
            cands.push({ value: href, kind: 'url', score: s });
        }

        for (const m of html.matchAll(/<svg\b[\s\S]*?<\/svg>/gi)) {
            const pos = m.index ?? 0;
            const block = m[0];
            if (block.length > 1_200_000) {
                continue;
            }
            const pre = html.slice(Math.max(0, pos - 500), pos).toLowerCase();
            const reg = this.regionForPosition(pos, sections);
            const preWithRegion = pre + (reg === 'header' || reg === 'header_nav' ? ' header' : reg === 'nav' ? ' nav' : reg === 'footer' ? ' footer' : ' body');
            const s = scoreInlineSvg(block, preWithRegion);
            if (s < 5) {
                continue;
            }
            cands.push({ value: block, kind: 'inline-svg', score: s + (reg === 'header' || reg === 'header_nav' ? 10 : 0) });
        }

        cands.sort((a, b) => b.score - a.score);
        const best = cands[0];
        if (!best) {
            return null;
        }
        if (best.score < 0) {
            return null;
        }
        if (best.score < 8 && !hadJsonLd) {
            return null;
        }
        return best.value;
    }

    async pickLogo(html?: string, url?: string): Promise<string | null> {
        if (!html) {
            return null;
        }
        return this.getLogoFromHtml(html, url);
    }
}
