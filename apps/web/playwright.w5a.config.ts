import base from './playwright.config';
// Config locale du lot w5a : la même, SANS serveurs gérés (piles lancées à la main).
export default { ...base, webServer: undefined };
