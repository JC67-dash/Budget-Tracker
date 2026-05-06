import { useState } from "react";
import { format } from "date-fns";
import {
  useListIncome,
  useCreateIncome,
  useUpdateIncome,
  useDeleteIncome,
  getListIncomeQueryKey,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, Wallet, Search, TrendingUp, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const incomeSchema = z.object({
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  source: z.string().min(1, "Source is required"),
  date: z.string().min(1, "Date is required"),
  notes: z.string().optional(),
});

type IncomeForm = z.infer<typeof incomeSchema>;

export default function Income() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: incomeData, isLoading } = useListIncome(undefined, {
    query: { queryKey: getListIncomeQueryKey() },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListIncomeQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  };

  const createIncome = useCreateIncome({
    mutation: {
      onSuccess: () => {
        invalidate();
        setIsAddOpen(false);
        form.reset();
        toast({ title: "Income added" });
      },
      onError: (err) =>
        toast({ title: "Failed to add income", description: err.message, variant: "destructive" }),
    },
  });

  const updateIncome = useUpdateIncome({
    mutation: {
      onSuccess: () => {
        invalidate();
        setIsAddOpen(false);
        setEditingId(null);
        form.reset();
        toast({ title: "Income updated" });
      },
      onError: (err) =>
        toast({ title: "Failed to update income", description: err.message, variant: "destructive" }),
    },
  });

  const deleteIncome = useDeleteIncome({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast({ title: "Income deleted" });
      },
    },
  });

  const form = useForm<IncomeForm>({
    resolver: zodResolver(incomeSchema),
    defaultValues: {
      amount: 0,
      source: "",
      date: format(new Date(), "yyyy-MM-dd"),
      notes: "",
    },
  });

  const openAdd = () => {
    setEditingId(null);
    form.reset({
      amount: 0,
      source: "",
      date: format(new Date(), "yyyy-MM-dd"),
      notes: "",
    });
    setIsAddOpen(true);
  };

  const openEdit = (entry: { id: number; amount: number; source: string; date: string; notes?: string | null }) => {
    setEditingId(entry.id);
    form.reset({
      amount: Number(entry.amount),
      source: entry.source,
      date: entry.date,
      notes: entry.notes ?? "",
    });
    setIsAddOpen(true);
  };

  const onSubmit = (data: IncomeForm) => {
    if (editingId !== null) {
      updateIncome.mutate({ id: editingId, data });
    } else {
      createIncome.mutate({ data });
    }
  };

  const entries = incomeData?.income ?? [];
  const totalAmount = incomeData?.totalAmount ?? 0;

  const filtered = entries.filter(
    (e) =>
      e.source.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.notes ?? "").toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const monthStart = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd");
  const thisMonthTotal = entries
    .filter((e) => e.date >= monthStart && e.date <= todayStr)
    .reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Income</h1>
          <p className="text-muted-foreground mt-1">Track all the money coming in.</p>
        </div>

        <Dialog
          open={isAddOpen}
          onOpenChange={(open) => {
            setIsAddOpen(open);
            if (!open) setEditingId(null);
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={openAdd} data-testid="button-add-income" className="rounded-full shadow-sm hover-elevate">
              <Plus className="h-4 w-4 mr-2" /> Add Income
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId !== null ? "Edit income" : "Add new income"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount (₱)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} data-testid="input-income-amount" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="source"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source</FormLabel>
                      <FormControl>
                        <Input placeholder="Salary, freelance, gift…" {...field} data-testid="input-income-source" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date received</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-income-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Additional details…" {...field} data-testid="textarea-income-notes" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={createIncome.isPending || updateIncome.isPending}
                    data-testid="button-submit-income"
                  >
                    {editingId !== null ? "Save changes" : "Add Income"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-none shadow-sm bg-gradient-to-br from-green-50 to-green-100/40 dark:from-green-950/30 dark:to-green-950/10">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground">Total income (all time)</p>
              <div className="h-8 w-8 rounded-full bg-green-200/60 dark:bg-green-900/40 text-green-700 dark:text-green-300 flex items-center justify-center">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground" data-testid="text-total-income">
              ₱{Number(totalAmount).toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground">This month</p>
              <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <Calendar className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground" data-testid="text-month-income">
              ₱{thisMonthTotal.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground">Entries</p>
              <div className="h-8 w-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center">
                <Wallet className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground" data-testid="text-income-count">
              {entries.length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm bg-card overflow-hidden">
        <div className="p-3 sm:p-4 border-b border-border bg-muted/20">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by source or notes…"
              className="pl-9 bg-background"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="input-search-income"
            />
          </div>
        </div>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="divide-y divide-border">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="p-4 flex justify-between items-center">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <Wallet className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-1">No income entries yet</h3>
              <p className="text-muted-foreground">Add your first income to start tracking what comes in.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((entry) => (
                <div
                  key={entry.id}
                  className="p-4 hover:bg-muted/30 transition-colors group"
                  data-testid={`row-income-${entry.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 flex items-center justify-center shrink-0">
                      <TrendingUp className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground break-words">{entry.source}</p>
                          {entry.notes && (
                            <p className="text-xs text-muted-foreground mt-0.5 break-words">{entry.notes}</p>
                          )}
                        </div>
                        <span className="font-semibold text-green-700 dark:text-green-400 whitespace-nowrap shrink-0">
                          +₱{Number(entry.amount).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-1.5">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(entry.date), "MMM d, yyyy")}
                        </span>
                        <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => openEdit(entry)}
                            data-testid={`button-edit-income-${entry.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                disabled={deleteIncome.isPending}
                                data-testid={`button-delete-income-${entry.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete this income?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  "{entry.source}" (+₱{Number(entry.amount).toFixed(2)}) will be permanently removed.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel data-testid={`button-cancel-delete-income-${entry.id}`}>
                                  Cancel
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteIncome.mutate({ id: entry.id })}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  data-testid={`button-confirm-delete-income-${entry.id}`}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </div>
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
