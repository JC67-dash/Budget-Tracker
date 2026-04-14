import { Router, type IRouter } from "express";

const router: IRouter = Router();

const tips = [
  { id: 1, title: "Track every expense", description: "Write down every purchase, no matter how small. Awareness is the first step to saving.", category: "budgeting" },
  { id: 2, title: "Follow the 50/30/20 rule", description: "Allocate 50% of income to needs, 30% to wants, and 20% to savings and debt repayment.", category: "budgeting" },
  { id: 3, title: "Pay yourself first", description: "Set up automatic transfers to savings the day your paycheck arrives, before spending on anything else.", category: "saving" },
  { id: 4, title: "Cancel unused subscriptions", description: "Review all recurring charges monthly. Cutting even 2-3 unused subscriptions can save ₱500-₱2000/month.", category: "saving" },
  { id: 5, title: "Meal prep on weekends", description: "Preparing meals in advance drastically reduces food delivery and restaurant spending.", category: "saving" },
  { id: 6, title: "Use the 24-hour rule", description: "Wait 24 hours before making any non-essential purchase over ₱1000. Impulse buys drop significantly.", category: "saving" },
  { id: 7, title: "Sell unused items online", description: "Declutter and sell unused items on Carousell, Facebook Marketplace, or Shopee. Turn clutter into cash.", category: "income" },
  { id: 8, title: "Freelance your skills", description: "Offer services like writing, design, tutoring, or programming on platforms like Upwork or Fiverr.", category: "income" },
  { id: 9, title: "Start a small side business", description: "Even a small online reselling business can bring in an extra ₱3000-₱10000 per month.", category: "income" },
  { id: 10, title: "Invest in index funds", description: "Low-cost index funds consistently outperform actively managed funds over the long term.", category: "investing" },
  { id: 11, title: "Build a 3-6 month emergency fund", description: "Keep 3-6 months of living expenses in an easily accessible savings account before investing.", category: "saving" },
  { id: 12, title: "Shop with a list", description: "Never grocery shop without a list. Stick to it to avoid impulse purchases that inflate your bill by 20-30%.", category: "budgeting" },
  { id: 13, title: "Buy in bulk strategically", description: "Purchase non-perishables and frequently used items in bulk from Costco or similar stores to cut per-unit costs.", category: "saving" },
  { id: 14, title: "Use cashback credit cards wisely", description: "Pay your balance in full monthly and earn 1-5% cashback on all purchases. Never carry a balance.", category: "saving" },
  { id: 15, title: "Negotiate your bills", description: "Call providers for internet, insurance, and utilities annually. Ask for loyalty discounts — most will oblige.", category: "saving" },
  { id: 16, title: "Rent out a room or space", description: "Renting a spare room, parking spot, or storage space can generate passive income every month.", category: "income" },
  { id: 17, title: "Create a digital product", description: "eBooks, templates, or online courses can generate ongoing passive income with minimal maintenance.", category: "income" },
  { id: 18, title: "Max out employer matching", description: "If your employer matches retirement contributions, contribute enough to get the full match — it's free money.", category: "investing" },
  { id: 19, title: "Use zero-based budgeting", description: "Assign every peso of income a purpose at the start of each month so nothing goes unaccounted for.", category: "budgeting" },
  { id: 20, title: "Compare prices before buying", description: "Use price comparison tools and browser extensions to ensure you're always getting the best deal.", category: "saving" },
];

router.get("/tips", async (_req, res): Promise<void> => {
  res.json({ tips });
});

export default router;
