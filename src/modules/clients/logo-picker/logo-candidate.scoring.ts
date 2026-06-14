/**
 * Heuristics to prefer real brand marks over decorative photos, ads, and tracking pixels.
 * Used by {@link LogoPickerService}; can be re-used from tests.
 */

const RE_LOGO_STRONG = new RegExp(
    [
        'logo',
        'wordmark',
        'lockup',
        'logotype',
        'word-mark',
        'brandmark',
        'brand-mark',
        'monogram',
        'logomark',
        'site[-_]?title',
        'primary[-_]?logo',
        'header[-_]?logo',
        'nav[-_]?bar[-_]?brand',
        'navbar[-_]?brand',
        'site[-_]?logo',
        'company[-_]?logo',
        'org[-_]?logo',
        'emblem',
        'crest',
        'seal',
        'trademark',
        'identity',
        'svg-logo',
    ].join('|'),
    'i',
);

const RE_BRAND_MILD = /(brand(?!-partners?)|trademark|identity|trademark|corporate|official)/i;
const RE_BAD_PATH = new RegExp(
    [
        'doubleclick',
        'googlesyndication',
        'adnxs',
        '2mdn',
        'adserv',
        'adserver',
        'facebook\\.com/tr',
        'gravatar',
        'pixel\\.',
        '1x1',
        '2x2',
        '0x0',
        'spacer',
        'blank\\.(?:gif|png|webp|svg)',
        'transparent\\.(?:gif|png)',
        'favicon-16x16',
        'favicon-32x32',
        'emoji',
        'loading',
        'placeholder',
    ].join('|'),
    'i',
);

const RE_HERO_OR_SOCIAL = new RegExp(
    [
        'hero(?!-logo)',
        'banner(?!-logo)',
        'slider(?!-logo)',
        'carousel(?!-logo)',
        'background',
        'parallax',
        'og-image',
        'opengraph',
        'social-?share',
        'sponsor(?!-logo)',
        'partner(?!-logo)',
        'headshot',
        'avatar(?!-logo)',
        'profile[-_]photo',
        'team(?!-logo)',
    ].join('|'),
    'i',
);

const RE_AD_OR_TRACK = new RegExp(
    [
        'ads?[-_]?',
        'advert',
        'banner-ad',
        'sponsor(?!ed)',
        'tracking',
        'analytics',
    ].join('|'),
    'i',
);

export type LogoImageContext = {
    /** outer HTML slice where this img appeared, lowercased (header, nav, footer, etc.) */
    regionHint: string;
    /** full <img> tag lowercased for class/id/alt */
    tagLower: string;
};

/**
 * Scores 0 – ~150+; negative means “almost certainly not a site logo.”
 */
export function scoreImageTagForBrandLogo(
    href: string,
    ctx: LogoImageContext,
    jsonLdSource = false,
): number {
    if (!href || href.length < 4) {
        return -1000;
    }
    const h = href.toLowerCase();
    const { regionHint, tagLower } = ctx;

    if (RE_BAD_PATH.test(h) || RE_AD_OR_TRACK.test(h)) {
        return -200;
    }

    if (RE_HERO_OR_SOCIAL.test(h) && !RE_LOGO_STRONG.test(h) && !RE_LOGO_STRONG.test(tagLower)) {
        return -40;
    }

    let score = 0;

    if (jsonLdSource) {
        score += 120;
    }
    if (regionHint === 'header' || regionHint === 'header_nav') {
        score += 35;
    } else if (regionHint === 'nav') {
        score += 28;
    } else if (regionHint === 'footer') {
        score += 8;
    } else {
        score += 0;
    }

    if (RE_LOGO_STRONG.test(tagLower)) {
        score += 55;
    } else if (RE_LOGO_STRONG.test(h)) {
        score += 50;
    }
    if (RE_BRAND_MILD.test(tagLower)) {
        score += 12;
    }
    if (RE_BRAND_MILD.test(h) && (RE_LOGO_STRONG.test(tagLower) || RE_LOGO_STRONG.test(h))) {
        score += 8;
    }

    if (h.endsWith('.svg') || h.includes('format=svg') || h.includes('image/svg')) {
        score += 6;
    }
    if (h.includes('sprite') && !RE_LOGO_STRONG.test(h)) {
        score -= 25;
    }
    if (RE_HERO_OR_SOCIAL.test(h)) {
        score -= 20;
    }

    if (h.includes('favicon') && !RE_LOGO_STRONG.test(tagLower) && !RE_LOGO_STRONG.test(h)) {
        score -= 15;
    }
    if (/\b16x16\b|\b32x32\b|\b24x24\b/.test(h)) {
        score -= 25;
    }
    if (h.includes('apple-touch') && !RE_LOGO_STRONG.test(tagLower)) {
        score -= 10;
    }

    if (h.includes('googleusercontent') || h.includes('ggpht.com')) {
        if (!RE_LOGO_STRONG.test(h) && !RE_LOGO_STRONG.test(tagLower)) {
            score -= 30;
        }
    }
    if (h.includes('data:image/')) {
        return -500;
    }

    return score;
}

export function scoreInlineSvg(svgBlock: string, contextLower: string): number {
    const s = svgBlock.toLowerCase();
    let score = 0;
    if (contextLower.includes('<header') || contextLower.includes('role="banner"') || contextLower.includes("role='banner'")) {
        score += 30;
    }
    if (contextLower.includes('<nav') || contextLower.includes('role="navigation"')) {
        score += 20;
    }
    if (RE_LOGO_STRONG.test(s) || RE_LOGO_STRONG.test(contextLower)) {
        score += 50;
    }
    if (RE_HERO_OR_SOCIAL.test(s) && !RE_LOGO_STRONG.test(s)) {
        return -20;
    }
    if (s.length < 80) {
        score -= 5;
    }
    return score;
}

/**
 * Reject only obvious non-logo remote URLs (ads, avatars) before S3. Uncertain → allow.
 */
export function isClearlyNonLogoImageUrl(href: string): boolean {
    if (!href || href.length < 8) {
        return true;
    }
    const h = href.toLowerCase();
    if (RE_BAD_PATH.test(h) && !RE_LOGO_STRONG.test(h)) {
        return true;
    }
    if (RE_AD_OR_TRACK.test(h) && !/logo/i.test(h)) {
        return true;
    }
    return false;
}

/**
 * Best-effort JSON-LD: only strings explicitly under a `logo` key (or ImageObject only under logo).
 * Avoids pulling generic `image` / `photo` from WebPage or Article.
 */
export function extractJsonLdLogoUrls(html: string): string[] {
    const out: string[] = [];
    const reScript = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    for (const m of html.matchAll(reScript)) {
        const raw = m[1];
        if (!raw) {
            continue;
        }
        const s = raw.replace(/[\u0000-\u001F\u007F]/g, ' ');
        for (const re of [
            /["']logo["']\s*:\s*["'](https?:\/\/[^"']+)["']/gi,
            /["']logo["']\s*:\s*\{[^}]{0,1200}["']url["']\s*:\s*["'](https?:\/\/[^"']+)["']/gi,
        ]) {
            re.lastIndex = 0;
            let mm: RegExpExecArray | null;
            while ((mm = re.exec(s)) !== null) {
                if (mm[1]) {
                    out.push(mm[1]);
                }
            }
        }
    }
    return [...new Set(out)];
}
