package com.budgetarian.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
public class TipsController {

    private static final List<Map<String, Object>> TIPS = List.of(
        tip(1, "Track every expense", "Write down every purchase, no matter how small. Awareness is the first step to saving.", "budgeting"),
        tip(2, "Follow the 50/30/20 rule", "Allocate 50% of income to needs, 30% to wants, and 20% to savings and debt repayment.", "budgeting"),
        tip(3, "Pay yourself first", "Set up automatic transfers to savings the day your paycheck arrives, before spending on anything else.", "saving"),
        tip(4, "Cancel unused subscriptions", "Review all recurring charges monthly. Cutting even 2-3 unused subscriptions can save ₱500-₱2000/month.", "saving"),
        tip(5, "Meal prep on weekends", "Preparing meals in advance drastically reduces food delivery and restaurant spending.", "saving"),
        tip(6, "Use the 24-hour rule", "Wait 24 hours before making any non-essential purchase over ₱1000. Impulse buys drop significantly.", "saving"),
        tip(7, "Sell unused items online", "Declutter and sell unused items on Carousell, Facebook Marketplace, or Shopee. Turn clutter into cash.", "income"),
        tip(8, "Freelance your skills", "Offer services like writing, design, tutoring, or programming on platforms like Upwork or Fiverr.", "income"),
        tip(9, "Start a small side business", "Even a small online reselling business can bring in an extra ₱3000-₱10000 per month.", "income"),
        tip(10, "Invest in index funds", "Low-cost index funds consistently outperform actively managed funds over the long term.", "investing"),
        tip(11, "Build a 3-6 month emergency fund", "Keep 3-6 months of living expenses in an easily accessible savings account before investing.", "saving"),
        tip(12, "Shop with a list", "Never grocery shop without a list. Stick to it to avoid impulse purchases that inflate your bill by 20-30%.", "budgeting"),
        tip(13, "Buy in bulk strategically", "Purchase non-perishables and frequently used items in bulk from Costco or similar stores to cut per-unit costs.", "saving"),
        tip(14, "Use cashback credit cards wisely", "Pay your balance in full monthly and earn 1-5% cashback on all purchases. Never carry a balance.", "saving"),
        tip(15, "Negotiate your bills", "Call providers for internet, insurance, and utilities annually. Ask for loyalty discounts — most will oblige.", "saving"),
        tip(16, "Rent out a room or space", "Renting a spare room, parking spot, or storage space can generate passive income every month.", "income"),
        tip(17, "Create a digital product", "eBooks, templates, or online courses can generate ongoing passive income with minimal maintenance.", "income"),
        tip(18, "Max out employer matching", "If your employer matches retirement contributions, contribute enough to get the full match — it's free money.", "investing"),
        tip(19, "Use zero-based budgeting", "Assign every peso of income a purpose at the start of each month so nothing goes unaccounted for.", "budgeting"),
        tip(20, "Compare prices before buying", "Use price comparison tools and browser extensions to ensure you're always getting the best deal.", "saving")
    );

    private static Map<String, Object> tip(int id, String title, String description, String category) {
        return Map.of("id", id, "title", title, "description", description, "category", category);
    }

    @GetMapping("/tips")
    public ResponseEntity<Map<String, Object>> getTips() {
        return ResponseEntity.ok(Map.of("tips", TIPS));
    }
}
