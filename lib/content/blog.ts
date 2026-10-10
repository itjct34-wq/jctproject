export type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
  category: string;
  coverGradient: string;
  content: string[];
};

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'how-to-buy-used-cars-from-japan',
    title: 'How to Buy Used Cars from Japan: A Complete Guide',
    excerpt: 'From auction inspection to FOB shipping — the practical path for overseas dealers and private buyers.',
    date: '2026-09-12',
    readTime: '8 min',
    category: 'Buying Guide',
    coverGradient: 'from-red-700 to-zinc-900',
    content: [
      'Japan remains one of the most trusted sources of quality used vehicles worldwide. Strict inspection culture, high maintenance standards, and a transparent auction system make Japanese stock highly sought after in Africa, the Middle East, Oceania, and Latin America.',
      'At Japan Circular Trading, we handle the full export workflow: auction bidding, purchase, inland transport, documentation, and RORO or container shipping from Nagoya and other major ports.',
      'Key steps for buyers: (1) define budget and destination regulations, (2) select chassis with clean auction sheets, (3) agree Incoterms (FOB, C&F, or CIF), (4) arrange payment, (5) receive BL and export documents.',
      'We recommend pre-shipment inspection for high-value units and always verify the chassis number against export certificates before final payment release.',
    ],
  },
  {
    slug: 'roro-vs-container-shipping',
    title: 'RORO vs Container: Which Shipping Mode Fits Your Order?',
    excerpt: 'Cost, speed, and risk differences between roll-on/roll-off and container shipping for used vehicles.',
    date: '2026-08-28',
    readTime: '6 min',
    category: 'Logistics',
    coverGradient: 'from-zinc-800 to-red-900',
    content: [
      'RORO (roll-on/roll-off) is the standard for most used-car exports from Japan. Vehicles drive onto the vessel under their own power, which keeps cost efficient for single units and mixed lots.',
      'Containers (20ft / 40ft) suit high-value cars, disassembled units, or destinations where RORO schedules are limited. Freight is higher, but protection from weather and handling is stronger.',
      'Japan Circular Trading supports both modes from Nagoya and partner ports. We advise based on your volume, destination, and insurance preference under FOB, C&F, or CIF terms.',
    ],
  },
  {
    slug: 'reading-japanese-auction-sheets',
    title: 'Reading Japanese Auction Sheets Like a Pro',
    excerpt: 'Grade scores, interior marks, and what “R” or “A” really mean before you place a bid.',
    date: '2026-07-15',
    readTime: '7 min',
    category: 'Auctions',
    coverGradient: 'from-red-800 to-black',
    content: [
      'Auction sheets are the backbone of Japan’s used-car market. A grade of 4.5 or 5 typically indicates a clean exterior and interior with minimal panel work.',
      'Always cross-check mileage, accident history flags, and equipment codes. Our team translates sheets and flags red-risk units before bidding.',
      'If you are new to USS, CAA, or similar houses, start with clear grade targets and a max bid limit. We can execute bids on your behalf with daily reporting.',
    ],
  },
];

export function getPost(slug: string) {
  return BLOG_POSTS.find((p) => p.slug === slug);
}
