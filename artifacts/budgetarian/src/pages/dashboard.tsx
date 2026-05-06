import { Link } from "wouter";
import {
  useGetDashboardSummary,
  getGetDashboardSummaryQueryKey,
  useGetUpcomingInstallments,
  getGetUpcomingInstallmentsQueryKey,
  useListInstallments,
  getListInstallmentsQueryKey,
  useGetExpiringSoonWarranties,
  getGetExpiringSoonWarrantiesQueryKey,
  useGetExpenseSummary,
  getGetExpenseSummaryQueryKey,
} from "@workspace/api-client-react";
import {
  TrendingDown,
  Target,
  CalendarClock,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  DollarSign,
  PiggyBank,
  HandCoins,
  CheckCircle2,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { format, addDays, parseISO, differenceInDays } from "date-fns";

const CHART_COLORS = ["#86b981", "#5e9a5a", "#a8cfa3", "#6ba368", "#c5dec1"];

export default function Dashboard() {
  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary({
    query: { queryKey: getGetDashboardSummaryQueryKey() },
  });

  const { data: upcomingData } = useGetUpcomingInstallments({
    query: { queryKey: getGetUpcomingInstallmentsQueryKey() },
  });

  const { data: allInstallmentsData } = useListInstallments({
    query: { queryKey: getListInstallmentsQueryKey() },
  });

  const { data: expiringSoonData } = useGetExpiringSoonWarranties({
    query: { queryKey: getGetExpiringSoonWarrantiesQueryKey() },
  });

  const { data: expenseSummary } = useGetExpenseSummary({
    query: { queryKey: getGetExpenseSummaryQueryKey() },
  });

  const upcoming = upcomingData?.installments ?? [];
  const expiringSoon = expiringSoonData?.warranties ?? [];
  const categoryData = summary?.categoryBreakdown ?? [];

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const reminders = (allInstallmentsData?.installments ?? [])
    .filter((i) => {
      if (i.status === "paid") return false;
      const remaining = Number(i.amount) - Number(i.paidAmount ?? 0);
      if (remaining <= 0) return false;
      const days = differenceInDays(parseISO(i.dueDate), todayStart);
      const lead = i.reminderDays ?? 3;
      return i.status === "overdue" || days < 0 || days <= lead;
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  if (summaryLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-9 w-40 mb-2" />
          <Skeleton className="h-5 w-56" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  const stats = [
    {
      label: "Spent This Month",
      value: `₱${(summary?.totalExpensesThisMonth ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`,
      icon: TrendingDown,
      color: "text-rose-500",
      bg: "bg-rose-50 dark:bg-rose-950/30",
      testId: "stat-spent-month",
    },
    {
      label: "Total Saved",
      value: `₱${(summary?.totalSaved ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`,
      icon: PiggyBank,
      color: "text-green-600",
      bg: "bg-green-50 dark:bg-green-950/30",
      testId: "stat-total-saved",
    },
    {
      label: "Active Goals",
      value: summary?.activeGoals ?? 0,
      icon: Target,
      color: "text-indigo-500",
      bg: "bg-indigo-50 dark:bg-indigo-950/30",
      testId: "stat-active-goals",
    },
    {
      label: "Upcoming Dues",
      value: summary?.upcomingDues ?? 0,
      icon: CalendarClock,
      color: summary?.upcomingDues ? "text-amber-500" : "text-muted-foreground",
      bg: summary?.upcomingDues ? "bg-amber-50 dark:bg-amber-950/30" : "bg-muted",
      testId: "stat-upcoming-dues",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight" data-testid="text-dashboard-heading">
          Dashboard
        </h1>
        <p className="text-muted-foreground mt-1">
          {format(new Date(), "EEEE, MMMM d, yyyy")} — here&apos;s your financial snapshot.
        </p>
      </div>

      {reminders.length > 0 && (
        <Card
          className="border border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/20 shadow-sm"
          data-testid="card-installment-reminders"
        >
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center justify-center">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">
                    {reminders.length} installment{reminders.length === 1 ? "" : "s"} need{reminders.length === 1 ? "s" : ""} attention
                  </p>
                  <p className="text-xs text-muted-foreground">Due in the next 3 days or already overdue.</p>
                </div>
              </div>
              <Link href="/installments">
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1 self-start" data-testid="link-reminders-view-all">
                  Pay now <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
            <div className="space-y-2">
              {reminders.slice(0, 3).map((inst) => {
                const days = differenceInDays(parseISO(inst.dueDate), todayStart);
                const remaining = Number(inst.amount) - Number(inst.paidAmount ?? 0);
                const isOverdue = inst.status === "overdue" || days < 0;
                return (
                  <div
                    key={inst.id}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-white dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/30"
                    data-testid={`reminder-installment-${inst.id}`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{inst.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(inst.dueDate), "MMM d")} · ₱{remaining.toFixed(2)} left
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-xs shrink-0 ${
                        isOverdue
                          ? "border-rose-300 text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30"
                          : "border-amber-300 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40"
                      }`}
                    >
                      {isOverdue ? `Overdue ${Math.abs(days)}d` : days === 0 ? "Due today" : `${days}d left`}
                    </Badge>
                  </div>
                );
              })}
              {reminders.length > 3 && (
                <p className="text-xs text-muted-foreground text-center pt-1">
                  + {reminders.length - 3} more
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="border-none shadow-sm hover-elevate transition-all" data-testid={stat.testId}>
              <CardContent className="p-5">
                <div className={`h-10 w-10 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center mb-3`}>
                  <Icon className="h-5 w-5" />
                </div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{stat.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Spending by Category Chart */}
        <Card className="border-none shadow-sm lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Spending This Month</CardTitle>
            <CardDescription>Breakdown by category</CardDescription>
          </CardHeader>
          <CardContent>
            {categoryData.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                No spending data yet. Add your first expense.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={categoryData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="category"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    formatter={(v: number) => [`₱${Number(v).toFixed(2)}`, "Amount"]}
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                    {categoryData.map((_, index) => (
                      <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Alerts Column */}
        <div className="space-y-4">
          {/* Upcoming Dues */}
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-amber-500" />
                  Upcoming Dues
                </CardTitle>
                <Link href="/installments">
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" data-testid="link-view-installments">
                    View all <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground">No dues within 7 days.</p>
              ) : (
                upcoming.slice(0, 3).map((inst) => {
                  const daysLeft = differenceInDays(parseISO(inst.dueDate), new Date());
                  return (
                    <div key={inst.id} className="flex items-start justify-between p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30" data-testid={`alert-installment-${inst.id}`}>
                      <div>
                        <p className="text-sm font-medium text-foreground">{inst.name}</p>
                        <p className="text-xs text-muted-foreground">{format(parseISO(inst.dueDate), "MMM d")}</p>
                      </div>
                      <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 shrink-0 ml-2">
                        {daysLeft === 0 ? "Today" : `${daysLeft}d`}
                      </Badge>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Accounts (where the money is) */}
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-green-600" />
                  Accounts
                </CardTitle>
                <Link href="/accounts">
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" data-testid="link-view-accounts">
                    View all <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {(summary?.accountsCount ?? 0) === 0 ? (
                <div className="p-2.5 rounded-lg bg-muted border border-border" data-testid="alert-no-accounts">
                  <p className="text-sm font-medium text-foreground">No accounts yet</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Add your wallets and bank accounts to track balances.
                  </p>
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-100 dark:border-green-900/30" data-testid="alert-accounts-balance">
                  <p className="text-sm font-medium text-foreground">
                    ₱{(summary?.accountsTotalBalance ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Across {summary?.accountsCount}{" "}
                    {summary?.accountsCount === 1 ? "account" : "accounts"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Outstanding Debts */}
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <HandCoins
                    className={`h-4 w-4 ${
                      (summary?.outstandingDebtsCount ?? 0) > 0
                        ? "text-rose-500"
                        : "text-green-500"
                    }`}
                  />
                  Debts
                </CardTitle>
                <Link href="/debts">
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" data-testid="link-view-debts">
                    View all <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {(summary?.outstandingDebtsCount ?? 0) === 0 ? (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-100 dark:border-green-900/30" data-testid="alert-debt-free">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  <p className="text-sm font-medium text-foreground">You're debt-free!</p>
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30" data-testid="alert-outstanding-debts">
                  <p className="text-sm font-medium text-foreground">
                    ₱{(summary?.outstandingDebtsTotal ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Across {summary?.outstandingDebtsCount}{" "}
                    {summary?.outstandingDebtsCount === 1 ? "debt" : "debts"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Expiring Warranties */}
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-rose-500" />
                  Expiring Soon
                </CardTitle>
                <Link href="/warranties">
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" data-testid="link-view-warranties">
                    View all <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {expiringSoon.length === 0 ? (
                <p className="text-sm text-muted-foreground">No warranties expiring in 30 days.</p>
              ) : (
                expiringSoon.slice(0, 3).map((w) => (
                  <div key={w.id} className="flex items-start justify-between p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30" data-testid={`alert-warranty-${w.id}`}>
                    <div>
                      <p className="text-sm font-medium text-foreground">{w.productName}</p>
                      <p className="text-xs text-muted-foreground">Expires {format(parseISO(w.expiryDate), "MMM d")}</p>
                    </div>
                    <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Expenses */}
      <Card className="border-none shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Recent Expenses</CardTitle>
            <Link href="/expenses">
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" data-testid="link-view-expenses">
                View all <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {(summary?.recentExpenses ?? []).length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">No expenses yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {(summary?.recentExpenses ?? []).map((expense) => (
                <div key={expense.id} className="px-6 py-3 flex items-center justify-between" data-testid={`row-recent-expense-${expense.id}`}>
                  <div>
                    <p className="text-sm font-medium text-foreground">{expense.description}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">{format(parseISO(expense.date), "MMM d")}</span>
                      <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">{expense.category}</span>
                    </div>
                  </div>
                  <span className="font-semibold text-sm text-foreground">₱{Number(expense.amount).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
