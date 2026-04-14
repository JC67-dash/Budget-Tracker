import { useState } from "react";
import {
  useListTips,
  getListTipsQueryKey,
} from "@workspace/api-client-react";
import { Lightbulb, DollarSign, TrendingUp, BarChart2, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const CATEGORIES = [
  { value: "all", label: "All Tips", icon: Lightbulb },
  { value: "saving", label: "Saving", icon: Wallet },
  { value: "income", label: "Income", icon: DollarSign },
  { value: "budgeting", label: "Budgeting", icon: BarChart2 },
  { value: "investing", label: "Investing", icon: TrendingUp },
];

const categoryConfig = {
  saving: { color: "text-teal-600", bg: "bg-teal-50 dark:bg-teal-950/30", icon: Wallet },
  income: { color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30", icon: DollarSign },
  budgeting: { color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-950/30", icon: BarChart2 },
  investing: { color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-950/30", icon: TrendingUp },
};

export default function Tips() {
  const [activeCategory, setActiveCategory] = useState("all");

  const { data: tipsData, isLoading } = useListTips({
    query: { queryKey: getListTipsQueryKey() },
  });

  const filteredTips = (tipsData?.tips ?? []).filter(
    (tip) => activeCategory === "all" || tip.category === activeCategory
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Tips & Ideas</h1>
        <p className="text-muted-foreground mt-1">Money-saving strategies and income ideas to grow your wealth.</p>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2" data-testid="category-filter">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.value;
          return (
            <button
              key={cat.value}
              onClick={() => setActiveCategory(cat.value)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                isActive
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
              }`}
              data-testid={`filter-${cat.value}`}
            >
              <Icon className="h-4 w-4" />
              {cat.label}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
        </div>
      ) : filteredTips.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No tips in this category.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTips.map((tip) => {
            const catCfg = categoryConfig[tip.category as keyof typeof categoryConfig] || categoryConfig.saving;
            const Icon = catCfg.icon;

            return (
              <Card
                key={tip.id}
                className="border-none shadow-sm hover-elevate transition-all group"
                data-testid={`card-tip-${tip.id}`}
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className={`h-11 w-11 rounded-xl ${catCfg.bg} ${catCfg.color} flex items-center justify-center shrink-0 mt-0.5`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-foreground leading-tight">{tip.title}</h3>
                        <Badge
                          variant="secondary"
                          className={`text-xs capitalize shrink-0 ${catCfg.color} ${catCfg.bg}`}
                          data-testid={`badge-tip-category-${tip.id}`}
                        >
                          {tip.category}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{tip.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
