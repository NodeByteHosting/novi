import { logger } from './logger';

/**
 * Heuristic detector for crypto/payout giveaway scams (e.g. fake MrBeast
 * "giving away $500,000 in crypto" messages, advance-fee wallet scams).
 * Unlike the malware filter, these scams rarely rely on a fixed domain list -
 * they're distinguished by a combination of signals, so we score messages
 * instead of doing a single substring match.
 */

interface ScamCheckResult {
  isScam: boolean;
  score: number;
  reasons: string[];
}

const SCAM_THRESHOLD = 3;

// Public figures commonly impersonated in crypto/payout giveaway scams
const IMPERSONATED_NAMES = [
  'mr beast', 'mrbeast', 'mr. beast',
  'elon musk', 'elonmusk',
  'jeff bezos',
  'jimmy donaldson',
  'binance ceo', 'cz binance',
  'vitalik buterin',
  'kai cenat', 'kaicenat',
  'ishowspeed',
  'adin ross',
  'xqc',
  'pewdiepie',
];

// Crypto/payout terms
const CRYPTO_TERMS = [
  'bitcoin', 'btc', 'ethereum', 'eth wallet', 'usdt', 'crypto giveaway',
  'crypto wallet', 'binance', 'metamask', 'trust wallet', 'airdrop',
  'cash app giveaway', 'paypal giveaway', 'usd giveaway',
];

// Giveaway / prize framing
const GIVEAWAY_TERMS = [
  'giveaway', 'giving away', 'i\'m giving', 'im giving', 'free money',
  'you have been selected', 'you\'ve been selected', 'congratulations you',
  'claim your prize', 'claim now', 'winner announcement', 'lucky winner',
  'first come first served', 'limited slots', 'subscribers giveaway',
  'reward received', 'withdrawal successful', 'successful withdrawal',
  'activate code', 'promo code', 'how to claim your reward',
  'withdraw the bonus instantly', 'withdraw the bonus immediately',
];

// Fake crypto-casino terms (common in "MrBeast casino" screenshot scams)
const CASINO_TERMS = [
  'crypto casino', 'cryptocurrency casino', 'rakeback', 'vip club',
  'available bonuses', 'welcome back, champion',
  'beast games', 'withdraw to your wallet',
];

// Call-to-action / advance-fee patterns typical of these scams
const CTA_PATTERNS = [
  /dm me( now)? to claim/i,
  /message me (to|and) claim/i,
  /click (the )?link (below|in bio) to claim/i,
  /send (a small |a )?(fee|amount|gas fee) to (receive|claim|unlock)/i,
  /verify your wallet (to|before) (receive|claim)/i,
  /add me on (whatsapp|telegram) to claim/i,
  /screenshot (this|and dm) to claim/i,
  /enter the (special )?promo code/i,
  /this post will be deleted\b/i,
  /giving away \$?[\d,]+ to everyone who registers/i,
];

// Crypto wallet address shapes (BTC / ETH) — only meaningful alongside other signals
const WALLET_ADDRESS_PATTERNS = [
  /\b(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}\b/, // BTC
  /\b0x[a-fA-F0-9]{40}\b/, // ETH
];

function countMatches(lowerText: string, terms: string[]): string[] {
  return terms.filter(term => lowerText.includes(term));
}

/**
 * Score a message for crypto/payout giveaway scam signals.
 * Requires multiple independent signal categories to trigger, keeping
 * false positives low on normal crypto/giveaway chat.
 */
export function checkScamMessage(text: string): ScamCheckResult {
  if (!text) {
    return { isScam: false, score: 0, reasons: [] };
  }

  const lowerText = text.toLowerCase();
  const reasons: string[] = [];
  let score = 0;

  const nameHits = countMatches(lowerText, IMPERSONATED_NAMES);
  if (nameHits.length > 0) {
    score += 2;
    reasons.push(`impersonated name: ${nameHits[0]}`);
  }

  const cryptoHits = countMatches(lowerText, CRYPTO_TERMS);
  if (cryptoHits.length > 0) {
    score += 1;
    reasons.push(`crypto term: ${cryptoHits[0]}`);
  }

  const giveawayHits = countMatches(lowerText, GIVEAWAY_TERMS);
  if (giveawayHits.length > 0) {
    score += 1;
    reasons.push(`giveaway term: ${giveawayHits[0]}`);
  }

  const casinoHits = countMatches(lowerText, CASINO_TERMS);
  if (casinoHits.length > 0) {
    score += 1;
    reasons.push(`casino term: ${casinoHits[0]}`);
  }

  const ctaMatch = CTA_PATTERNS.find(pattern => pattern.test(text));
  if (ctaMatch) {
    score += 2;
    reasons.push('advance-fee/claim call-to-action');
  }

  const hasWalletAddress = WALLET_ADDRESS_PATTERNS.some(pattern => pattern.test(text));
  if (hasWalletAddress && (cryptoHits.length > 0 || giveawayHits.length > 0)) {
    score += 1;
    reasons.push('wallet address present');
  }

  // Large dollar amount + giveaway/crypto/casino framing (e.g. "$500,000")
  if (/\$\s?[\d,]{3,}(\.\d+)?\s?(k|thousand|million)?\b/i.test(text) && (giveawayHits.length > 0 || cryptoHits.length > 0 || casinoHits.length > 0)) {
    score += 1;
    reasons.push('large cash amount claim');
  }

  const isScam = score >= SCAM_THRESHOLD;

  if (isScam) {
    logger.debug('Scam message flagged', { context: 'ScamFilter', score, reasons });
  }

  return { isScam, score, reasons };
}
