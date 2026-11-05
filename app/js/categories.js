import { state, normMerchant } from './store.js';

// group: needs vs wants, used for the 50/30/20 check.
export const CATEGORIES = [
  { id: 'food', name: 'Food & Dining', short: 'Food', emoji: '🍔', group: 'wants' },
  { id: 'groceries', name: 'Groceries', short: 'Groceries', emoji: '🛒', group: 'needs' },
  { id: 'coffee', name: 'Coffee & Snacks', short: 'Coffee', emoji: '☕', group: 'wants' },
  { id: 'transport', name: 'Transport', short: 'Transport', emoji: '🚕', group: 'needs' },
  { id: 'gas', name: 'Gas & Car', short: 'Gas', emoji: '⛽', group: 'needs' },
  { id: 'bills', name: 'Bills & Utilities', short: 'Bills', emoji: '💡', group: 'needs' },
  { id: 'subscriptions', name: 'Subscriptions', short: 'Subs', emoji: '📺', group: 'wants' },
  { id: 'shopping', name: 'Shopping', short: 'Shopping', emoji: '🛍️', group: 'wants' },
  { id: 'housing', name: 'Rent & Housing', short: 'Rent', emoji: '🏠', group: 'needs' },
  { id: 'health', name: 'Health & Pharmacy', short: 'Health', emoji: '💊', group: 'needs' },
  { id: 'family', name: 'Family & Padala', short: 'Family', emoji: '👨‍👩‍👧', group: 'needs' },
  { id: 'personal', name: 'Personal Care', short: 'Personal', emoji: '💇', group: 'wants' },
  { id: 'entertainment', name: 'Entertainment', short: 'Fun', emoji: '🎬', group: 'wants' },
  { id: 'education', name: 'Education', short: 'School', emoji: '📚', group: 'needs' },
  { id: 'travel', name: 'Travel', short: 'Travel', emoji: '✈️', group: 'wants' },
  { id: 'gifts', name: 'Gifts & Donations', short: 'Gifts', emoji: '🎁', group: 'wants' },
  { id: 'other', name: 'Other', short: 'Other', emoji: '📦', group: 'wants' },
];
const BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
export const cat = (id) => BY_ID[id] || BY_ID.other;

export const METHODS = [
  { id: 'Cash', emoji: '💵' },
  { id: 'GCash', emoji: '📱' },
  { id: 'Maya', emoji: '📱' },
  { id: 'Debit card', emoji: '💳' },
  { id: 'Credit card', emoji: '💳' },
  { id: 'Bank transfer', emoji: '🏦' },
];
export const methodEmoji = (m) => (METHODS.find((x) => x.id === m) || { emoji: '💵' }).emoji;

// Known merchants (Philippines-first, plus global brands). Order matters: specific before general.
const MERCHANTS = [
  // Food delivery first so "Grab Food" doesn't become a ride
  ['GrabFood', 'food', ['grabfood', 'grab food']],
  ['foodpanda', 'food', ['foodpanda', 'food panda']],
  ['Jollibee', 'food', ['jollibee']],
  ["McDonald's", 'food', ['mcdonald', 'mcdonalds', 'mcdo', 'golden arches']],
  ['Chowking', 'food', ['chowking']],
  ['Mang Inasal', 'food', ['mang inasal']],
  ['Greenwich', 'food', ['greenwich']],
  ['KFC', 'food', ['kfc']],
  ["Shakey's", 'food', ['shakey', 'shakeys']],
  ['Red Ribbon', 'food', ['red ribbon']],
  ['Goldilocks', 'food', ['goldilocks']],
  ['Max\'s Restaurant', 'food', ['max s restaurant', 'maxs restaurant']],
  ['Army Navy', 'food', ['army navy']],
  ['Yellow Cab', 'food', ['yellow cab']],
  ['Pizza Hut', 'food', ['pizza hut']],
  ['Burger King', 'food', ['burger king']],
  ['Wendy\'s', 'food', ['wendy s', 'wendys']],
  ['Kenny Rogers', 'food', ['kenny rogers']],
  ['Bonchon', 'food', ['bonchon']],
  ['Samgyupsal', 'food', ['samgyup', 'samgyupsal']],
  ['Starbucks', 'coffee', ['starbucks']],
  ['The Coffee Bean', 'coffee', ['coffee bean']],
  ['Tim Hortons', 'coffee', ['tim hortons']],
  ['Dunkin\'', 'coffee', ['dunkin']],
  ['Bo\'s Coffee', 'coffee', ['bo s coffee', 'bos coffee']],
  ['But First, Coffee', 'coffee', ['but first coffee']],
  ['Tiger Sugar', 'coffee', ['tiger sugar']],
  ['Macao Imperial Tea', 'coffee', ['macao imperial']],
  ['Chatime', 'coffee', ['chatime']],
  ['Gong Cha', 'coffee', ['gong cha']],
  ['7-Eleven', 'coffee', ['7 eleven', '7eleven', 'seven eleven']],
  ['Ministop', 'coffee', ['ministop']],
  ['FamilyMart', 'coffee', ['familymart', 'family mart']],
  ['Lawson', 'coffee', ['lawson']],
  ['SM Supermarket', 'groceries', ['sm supermarket', 'sm hypermarket', 'savemore', 'save more']],
  ['Puregold', 'groceries', ['puregold']],
  ['Robinsons Supermarket', 'groceries', ['robinsons supermarket', 'robinsons easymart']],
  ['S&R', 'groceries', ['s r membership', 's r warehouse', 'snr']],
  ['Landers', 'groceries', ['landers']],
  ['Metro Supermarket', 'groceries', ['metro supermarket', 'metro gaisano']],
  ['Waltermart', 'groceries', ['waltermart', 'walter mart']],
  ['Rustan\'s', 'groceries', ['rustan', 'rustans']],
  ['Shopwise', 'groceries', ['shopwise']],
  ['Alfamart', 'groceries', ['alfamart']],
  ['Palengke', 'groceries', ['palengke', 'wet market', 'market']],
  ['Petron', 'gas', ['petron']],
  ['Shell', 'gas', ['shell', 'pilipinas shell']],
  ['Caltex', 'gas', ['caltex']],
  ['Seaoil', 'gas', ['seaoil']],
  ['Phoenix', 'gas', ['phoenix petroleum', 'phoenix fuels']],
  ['Cleanfuel', 'gas', ['cleanfuel']],
  ['Unioil', 'gas', ['unioil']],
  ['Gas', 'gas', ['gasoline', 'diesel', 'fuel', 'unleaded', 'car wash', 'carwash', 'casa', 'change oil']],
  ['Grab', 'transport', ['grab', 'grabcar', 'grab car']],
  ['Angkas', 'transport', ['angkas']],
  ['JoyRide', 'transport', ['joyride']],
  ['MRT/LRT', 'transport', ['mrt', 'lrt', 'beep']],
  ['Jeep', 'transport', ['jeep', 'jeepney', 'tricycle', 'trike', 'bus', 'fx', 'uv express']],
  ['Toll', 'transport', ['autosweep', 'easytrip', 'toll', 'nlex', 'slex', 'skyway']],
  ['Parking', 'transport', ['parking']],
  ['Taxi', 'transport', ['taxi', 'uber', 'lyft']],
  ['Meralco', 'bills', ['meralco']],
  ['Maynilad', 'bills', ['maynilad']],
  ['Manila Water', 'bills', ['manila water']],
  ['PLDT', 'bills', ['pldt']],
  ['Globe', 'bills', ['globe', 'globe telecom', 'gomo', 'tm load']],
  ['Smart', 'bills', ['smart communications', 'smart load', 'tnt']],
  ['Converge', 'bills', ['converge']],
  ['DITO', 'bills', ['dito']],
  ['Sky', 'bills', ['sky cable', 'skycable', 'sky fiber']],
  ['Electricity', 'bills', ['electric', 'electricity', 'water bill', 'internet', 'postpaid', 'load']],
  ['Netflix', 'subscriptions', ['netflix']],
  ['Spotify', 'subscriptions', ['spotify']],
  ['YouTube Premium', 'subscriptions', ['youtube premium', 'youtube']],
  ['Disney+', 'subscriptions', ['disney']],
  ['HBO Max', 'subscriptions', ['hbo']],
  ['Prime Video', 'subscriptions', ['prime video', 'amazon prime']],
  ['Viu', 'subscriptions', ['viu']],
  ['Apple', 'subscriptions', ['icloud', 'apple com bill', 'apple music', 'apple one', 'app store']],
  ['Google One', 'subscriptions', ['google one', 'google storage', 'google play']],
  ['ChatGPT', 'subscriptions', ['chatgpt', 'openai']],
  ['Claude', 'subscriptions', ['claude ai', 'anthropic']],
  ['Canva', 'subscriptions', ['canva']],
  ['Adobe', 'subscriptions', ['adobe']],
  ['Microsoft 365', 'subscriptions', ['microsoft 365', 'office 365', 'xbox']],
  ['Shopee', 'shopping', ['shopee']],
  ['Lazada', 'shopping', ['lazada']],
  ['TikTok Shop', 'shopping', ['tiktok shop']],
  ['Zalora', 'shopping', ['zalora']],
  ['Uniqlo', 'shopping', ['uniqlo']],
  ['H&M', 'shopping', ['h m', 'h and m']],
  ['SM Store', 'shopping', ['sm store', 'sm department', 'the sm store']],
  ['Ace Hardware', 'shopping', ['ace hardware']],
  ['Handyman', 'shopping', ['handyman']],
  ['Wilcon', 'shopping', ['wilcon']],
  ['Miniso', 'shopping', ['miniso']],
  ['Daiso', 'shopping', ['daiso']],
  ['National Book Store', 'education', ['national book store', 'national bookstore', 'fully booked']],
  ['Mercury Drug', 'health', ['mercury drug', 'mercury']],
  ['Watsons', 'health', ['watsons']],
  ['Southstar Drug', 'health', ['southstar']],
  ['Rose Pharmacy', 'health', ['rose pharmacy']],
  ['Generika', 'health', ['generika']],
  ['The Generics Pharmacy', 'health', ['generics pharmacy', 'tgp']],
  ['Clinic', 'health', ['clinic', 'hospital', 'dental', 'dentist', 'doctor', 'medical', 'laboratory', 'hi precision']],
  ['Gym', 'health', ['gym', 'anytime fitness', 'fitness first', 'gold s gym']],
  ['Palawan Express', 'family', ['palawan express', 'palawan pawnshop']],
  ['Cebuana Lhuillier', 'family', ['cebuana']],
  ['M Lhuillier', 'family', ['lhuillier']],
  ['Padala', 'family', ['padala', 'remittance', 'western union', 'lbc', 'allowance']],
  ['Salon', 'personal', ['salon', 'barber', 'barbershop', 'spa', 'massage', 'nail', 'david s salon']],
  ['Cinema', 'entertainment', ['cinema', 'movie', 'sm cinema', 'ayala cinema', 'imax', 'timezone', 'steam', 'playstation', 'nintendo', 'concert', 'ticketnet', 'smtickets']],
  ['Cebu Pacific', 'travel', ['cebu pacific', 'cebupacific']],
  ['Philippine Airlines', 'travel', ['philippine airlines', 'flypal']],
  ['AirAsia', 'travel', ['airasia', 'air asia']],
  ['Agoda', 'travel', ['agoda']],
  ['Booking.com', 'travel', ['booking com']],
  ['Airbnb', 'travel', ['airbnb']],
  ['Hotel', 'travel', ['hotel', 'resort', 'klook']],
  ['Rent', 'housing', ['rent', 'condo', 'apartment', 'association dues', 'hoa', 'amortization', 'pag ibig housing']],
  ['Tuition', 'education', ['tuition', 'school', 'university', 'college', 'udemy', 'coursera']],
  ['Restaurant', 'food', ['restaurant', 'resto', 'carinderia', 'kainan', 'grill', 'lechon', 'bbq', 'pizza', 'burger', 'ramen', 'sushi', 'lunch', 'dinner', 'breakfast', 'merienda']],
  ['Cafe', 'coffee', ['cafe', 'coffee', 'milk tea', 'milktea', 'bakery', 'bakeshop', 'snack', 'snacks', 'drinks']],
];

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const COMPILED = MERCHANTS.map(([name, category, keys]) => ({
  name,
  category,
  re: new RegExp(`(^|\\s)(${keys.map(escRe).join('|')})(\\s|$)`),
}));

/** Find a known merchant inside any text (merchant name, OCR output, SMS). */
export function findMerchant(text) {
  const t = ' ' + normMerchant(text) + ' ';
  for (const m of COMPILED) if (m.re.test(t)) return m;
  return null;
}

/** Best-guess category for a merchant: what you picked before > known list > null. */
export function guessCategory(merchant) {
  const k = normMerchant(merchant);
  if (!k) return null;
  if (state.merchantMap[k]) return state.merchantMap[k];
  // Partial match against learned merchants (e.g. "jollibee sm north" → "jollibee")
  for (const [mk, c] of Object.entries(state.merchantMap)) {
    if (mk.length >= 4 && (k.startsWith(mk + ' ') || mk.startsWith(k + ' '))) return c;
  }
  const m = findMerchant(merchant);
  return m ? m.category : null;
}

/** Categories ordered by how often you use them (most used first). */
export function categoriesByUse() {
  const count = {};
  const cutoff = Date.now() - 90 * 86400000;
  for (const e of state.expenses) if (!e.recurringId && (e.createdAt || 0) > cutoff) count[e.category] = (count[e.category] || 0) + 1;
  return [...CATEGORIES].sort((a, b) => (count[b.id] || 0) - (count[a.id] || 0));
}
