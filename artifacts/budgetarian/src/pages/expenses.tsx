import { useState } from "react";
import { format } from "date-fns";
import { 
  useListExpenses, 
  useCreateExpense, 
  useDeleteExpense,
  getListExpensesQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetExpenseSummaryQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Receipt, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

const expenseSchema = z.object({
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  category: z.string().min(1, "Category is required"),
  description: z.string().min(1, "Description is required"),
  date: z.string().min(1, "Date is required"),
  notes: z.string().optional()
});

const CATEGORIES = [
  "Food & Dining",
  "Transportation",
  "Housing",
  "Utilities",
  "Entertainment",
  "Shopping",
  "Personal Care",
  "Health & Fitness",
  "Education",
  "Other"
];

export default function Expenses() {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: expensesData, isLoading } = useListExpenses(
    { category: categoryFilter !== "all" ? categoryFilter : undefined },
    { query: { queryKey: getListExpensesQueryKey({ category: categoryFilter !== "all" ? categoryFilter : undefined }) } }
  );

  const createExpense = useCreateExpense({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListExpensesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetExpenseSummaryQueryKey() });
        setIsAddOpen(false);
        form.reset();
        toast({ title: "Expense added successfully" });
      },
      onError: (err) => {
        toast({ title: "Failed to add expense", description: err.message || "An error occurred", variant: "destructive" });
      }
    }
  });

  const deleteExpense = useDeleteExpense({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListExpensesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetExpenseSummaryQueryKey() });
        toast({ title: "Expense deleted" });
      }
    }
  });

  const form = useForm<z.infer<typeof expenseSchema>>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      amount: 0,
      category: "",
      description: "",
      date: format(new Date(), "yyyy-MM-dd"),
      notes: ""
    }
  });

  const onSubmit = (data: z.infer<typeof expenseSchema>) => {
    createExpense.mutate({ data });
  };

  const filteredExpenses = expensesData?.expenses?.filter(e => 
    e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.category.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Expenses</h1>
          <p className="text-muted-foreground mt-1">Track and manage your spending.</p>
        </div>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-expense" className="rounded-full shadow-sm hover-elevate">
              <Plus className="h-4 w-4 mr-2" /> Add Expense
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Expense</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} data-testid="input-expense-amount" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Input placeholder="Lunch at cafe" {...field} data-testid="input-expense-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-expense-category">
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CATEGORIES.map(c => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-expense-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={createExpense.isPending} data-testid="button-submit-expense">
                    Save Expense
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-none shadow-sm bg-card overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/20 flex flex-col sm:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search expenses..." 
              className="pl-9 bg-background"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="input-search-expenses"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[180px] bg-background" data-testid="select-filter-category">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="divide-y divide-border">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="p-4 flex justify-between items-center">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <Skeleton className="h-6 w-16" />
                </div>
              ))}
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <Receipt className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-1">No expenses found</h3>
              <p className="text-muted-foreground">Try adjusting your filters or add a new expense.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredExpenses.map((expense) => (
                <div key={expense.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors group" data-testid={`row-expense-${expense.id}`}>
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Receipt className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{expense.description}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">{format(new Date(expense.date), "MMM d, yyyy")}</span>
                        <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">{expense.category}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-semibold text-foreground">${expense.amount.toFixed(2)}</span>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => deleteExpense.mutate({ id: expense.id })}
                      disabled={deleteExpense.isPending}
                      data-testid={`button-delete-expense-${expense.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
