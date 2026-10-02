export const formatRegistryFooterPrice = (creditCost: number) => {
    const cost = Number(creditCost || 0)
    if (cost <= 0) return '0 credits · Light task'
    return `${cost} credit${cost === 1 ? '' : 's'}`
}

export const stripFooterPriceSegment = (segment: string) => {
    let cleaned = segment.trim()

    cleaned = cleaned
        .replace(/\bcredits?\s+deducted\s+by\s+mode\b(?:\s*\([^)]*\))?/gi, '')
        .replace(/\bincluded\s+on\s+all\s+plans\b/gi, '')
        .replace(/\blight\s+task\b/gi, '')
        .replace(/\bfree\b/gi, '')
        .replace(/\b(?:starter|pro|operator)\+?\b/gi, '')
        .replace(/\b\d+\s*(?:-|–|to)\s*\d+\s+credits?\b/gi, '')
        .replace(/\b\d+\s+credits?\b/gi, '')
        .replace(/\bcredit\b/gi, '')
        .replace(/\bdepending\s+on\s+mode\b/gi, '')
        .replace(/^\s*per\s+/i, 'per ')
        .replace(/\s{2,}/g, ' ')
        .replace(/^[\s·,;:()/-]+|[\s·,;:()/-]+$/g, '')
        .trim()

    if (/^(?:per)?$/i.test(cleaned)) return ''
    return cleaned
}

export const getRegistryPricedFooterText = (footerText: string | undefined, creditCost: number) => {
    const price = formatRegistryFooterPrice(creditCost)
    const nonPriceHint = (footerText || '')
        .split('·')
        .map(stripFooterPriceSegment)
        .filter(Boolean)
        .join(' · ')

    return nonPriceHint ? `${price} · ${nonPriceHint}` : price
}
