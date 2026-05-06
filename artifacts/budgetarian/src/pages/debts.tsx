import { useState } from "react";
import {
  useListDebts,
  getListDebtsQueryKey,
  useCreateDebt,
  useUpdateDebt,
  useDeleteDebt,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Trash2,
  HandCoins,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Pencil,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
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
import { format, parseISO, differenceInDays } from "date-fns";

const debtSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    creditor: z.string().optional(),
    amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
    borrowedDate: z.string().min(1, "Borrowed date is required"),
    dueDate: z.string().min(1, "Due date is required"),
    interestPercent: z.union([z.coerce.number().min(0), z.literal("")]).optional(),
    status: z.enum(["pending", "paid"]),
    notes: z.string().optional(),
  })
  .refine((data) => new Date(data.dueDate) >= new Date(data.borrowedDate), {
    message: "Due date must be on or after the borrowed date",
    path: ["dueDate"],
  });

type DebtForm = z.infer<typeof debtSchema>;

export default function Debts() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: debtsData, isLoading } = useListDebts({
    query: { queryKey: getListDebtsQueryKey() },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListDebtsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  };

  const createDebt = useCreateDebt({
    mutation: {
      onSuccess: () => {
        invalidate();
        setIsAddOpen(false);
        form.reset(defaultValues());
        toast({ title: "Debt added" });
      },
      onError: (err: Error) => {
        toast({ title: "Failed to add debt", description: err.message, variant: "destructive" });
      },
    },
  });

  const updateDebt = useUpdateDebt({
    mutation: {
      onSuccess: () => {
        invalidate();
        setEditingId(null);
        setIsAddOpen(false);
        form.reset(defaultValues());
        toast({ title: "Debt updated" });
      },
      onError: (err: Error) => {
        toast({ title: "Failed to update debt", description: err.message, variant: "destructive" });
      },
    },
  });

  const deleteDebt = useDeleteDebt({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast({ title: "Debt deleted" });
      },
    },
  });

  const markAsPaid = (id: number) => {
    updateDebt.mutate({ id, data: { status: "paid" } });
  };

  function defaultValues(): DebtForm {
    return {
      name: "",
      creditor: "",
      amount: 0,
      borrowedDate: format(new Date(), "yyyy-MM-dd"),
      dueDate: format(new Date(), "yyyy-MM-dd"),
      interestPercent: "",
      status: "pending",
      notes: "",
    };
  }

  const form = useForm<DebtForm>({
    resolver: zodResolver(debtSchema),
    defaultValues: defaultValues(),
  });

  const dueDate = form.watch("dueDate");
  const status = form.watch("status");
  const today = new Date();
  const isOverdueNow =
    !!dueDate && status === "pending" && differenceInDays(today, parseISO(dueDate)) > 0;

  const openAdd = () => {
    setEditingId(null);
    form.reset(defaultValues());
    setIsAddOpen(true);
  };

  const openEdit = (d: ReturnType<typeof mapDebtForForm>) => {
    setEditingId(d.id);
    form.reset({
      name: d.name,
      creditor: d.creditor ?? "",
      amount: d.amount,
      borrowedDate: d.borrowedDate,
      dueDate: d.dueDate,
      interestPercent: d.interestPercent ?? "",
      status: d.status as "pending" | "paid",
      notes: d.notes ?? "",
    });
    setIsAddOpen(true);
  };

  const onSubmit = (data: DebtForm) => {
    const interest =
      data.interestPercent === "" || data.interestPercent === undefined
        ? null
        : Number(data.interestPercent);

    const payload = {
      name: data.name,
      creditor: data.creditor || undefined,
      amount: data.amount,
      borrowedDate: data.borrowedDate,
      dueDate: data.dueDate,
      interestPercent: interest,
      status: data.status,
      notes: data.notes || undefined,
    };

    if (editingId !== null) {
      updateDebt.mutate({ id: editingId, data: payload });
    } else {
      createDebt.mutate({ data: payload });
    }
  };

  const debts = debtsData?.debts ?? [];

  const pendingDebts = debts.filter((d) => d.status === "pending");
  const totalOwed = pendingDebts.reduce((sum, d) => {
    const days = differenceInDays(today, parseISO(d.dueDate));
    const interest = d.interestPercent && days > 0 ? (Number(d.amount) * Number(d.interestPercent)) / 100 : 0;
    return sum + Number(d.amount) + interest;
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Debt Tracker</h1>
          <p className="text-muted-foreground mt-1">
            Keep track of money you've borrowed and when it's due back.
          </p>
        </div>

        <Dialog
          open={isAddOpen}
          onOpenChange={(open) => {
            setIsAddOpen(open);
            if (!open) {
              setEditingId(null);
              form.reset(defaultValues());
            }
          }}
        >
          <DialogTrigger asChild>
            <Button
              className="rounded-full shadow-sm hover-elevate"
              onClick={openAdd}
              data-testid="button-add-debt"
            >
              <Plus className="h-4 w-4 mr-2" /> Add Debt
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId !== null ? "Edit Debt" : "Add Debt"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>What is this debt for?</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Emergency loan, rent, etc."
                          {...field}
                          data-testid="input-debt-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="creditor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lender (optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Who lent you the money?"
                          {...field}
                          data-testid="input-debt-creditor"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount (₱)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          {...field}
                          data-testid="input-debt-amount"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="borrowedDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>When did you borrow?</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                            data-testid="input-debt-borrowed-date"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Due date</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                            data-testid="input-debt-due-date"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {isOverdueNow && (
                  <FormField
                    control={form.control}
                    name="interestPercent"
                    render={({ field }) => (
                      <FormItem className="rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-900/30 p-3">
                        <FormLabel className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
                          <AlertTriangle className="h-4 w-4" />
                          This debt is past due — what's the interest rate?
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="e.g. 5"
                            {...field}
                            data-testid="input-debt-interest"
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Enter the percent (%) charged on the unpaid amount. Leave blank if none.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Any details to remember..."
                          {...field}
                          data-testid="textarea-debt-notes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={createDebt.isPending || updateDebt.isPending}
                    data-testid="button-submit-debt"
                  >
                    {editingId !== null ? "Save changes" : "Add debt"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary banner */}
      <Card
        className={`border-none shadow-sm ${
          pendingDebts.length === 0
            ? "bg-teal-50 dark:bg-teal-950/30"
            : "bg-rose-50 dark:bg-rose-950/30"
        }`}
        data-testid="card-debt-summary"
      >
        <CardContent className="p-5 flex items-center gap-4">
          <div
            className={`h-12 w-12 rounded-xl flex items-center justify-center ${
              pendingDebts.length === 0
                ? "bg-teal-100 dark:bg-teal-900/40 text-teal-600"
                : "bg-rose-100 dark:bg-rose-900/40 text-rose-600"
            }`}
          >
            {pendingDebts.length === 0 ? (
              <CheckCircle2 className="h-6 w-6" />
            ) : (
              <HandCoins className="h-6 w-6" />
            )}
          </div>
          <div>
            {pendingDebts.length === 0 ? (
              <>
                <p className="font-semibold text-foreground">You're debt-free!</p>
                <p className="text-sm text-muted-foreground">
                  No outstanding debts to worry about.
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold text-foreground">
                  ₱{totalOwed.toLocaleString("en-PH", { minimumFractionDigits: 2 })} owed across{" "}
                  {pendingDebts.length} {pendingDebts.length === 1 ? "debt" : "debts"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Includes accrued interest on overdue amounts.
                </p>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : debts.length === 0 ? (
        <div className="text-center py-16">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <HandCoins className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">No debts logged</h3>
          <p className="text-muted-foreground mb-6">
            Track money you owe so you never miss a payback date.
          </p>
          <Button onClick={openAdd} className="rounded-full" data-testid="button-add-first-debt">
            <Plus className="h-4 w-4 mr-2" /> Add Your First Debt
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {debts.map((d) => {
            const mapped = mapDebtForForm(d);
            const daysOverdue = differenceInDays(today, parseISO(mapped.dueDate));
            const isOverdue = mapped.status === "pending" && daysOverdue > 0;
            const isPaid = mapped.status === "paid";
            const interest =
              isOverdue && mapped.interestPercent
                ? (mapped.amount * mapped.interestPercent) / 100
                : 0;
            const total = mapped.amount + interest;
            const cfg = isPaid
              ? {
                  Icon: CheckCircle2,
                  color: "text-teal-600",
                  bg: "bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-900/30",
                }
              : isOverdue
                ? {
                    Icon: AlertTriangle,
                    color: "text-rose-600",
                    bg: "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/30",
                  }
                : {
                    Icon: Clock,
                    color: "text-amber-600",
                    bg: "border-border",
                  };
            const Icon = cfg.Icon;

            return (
              <Card
                key={mapped.id}
                className={`border shadow-sm group transition-all ${cfg.bg}`}
                data-testid={`card-debt-${mapped.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div
                        className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                          isPaid
                            ? "bg-teal-100 dark:bg-teal-900/30"
                            : isOverdue
                              ? "bg-rose-100 dark:bg-rose-900/30"
                              : "bg-muted"
                        }`}
                      >
                        <Icon className={`h-5 w-5 ${cfg.color}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-foreground truncate">{mapped.name}</p>
                          <Badge
                            variant="secondary"
                            className={`text-xs capitalize ${
                              isPaid
                                ? "text-teal-700 bg-teal-100 dark:bg-teal-900/30"
                                : isOverdue
                                  ? "text-rose-700 bg-rose-100 dark:bg-rose-900/30"
                                  : ""
                            }`}
                            data-testid={`status-debt-${mapped.id}`}
                          >
                            {isOverdue && !isPaid ? "Overdue" : mapped.status}
                          </Badge>
                          {isOverdue && !isPaid && (
                            <Badge
                              variant="outline"
                              className="text-xs border-rose-300 text-rose-700 dark:text-rose-400"
                            >
                              {daysOverdue}d late
                            </Badge>
                          )}
                        </div>
                        {mapped.creditor && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            From {mapped.creditor}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                          <span>
                            Borrowed {format(parseISO(mapped.borrowedDate), "MMM d, yyyy")}
                          </span>
                          <span>
                            Due {format(parseISO(mapped.dueDate), "MMM d, yyyy")}
                          </span>
                          {mapped.interestPercent !== null && (
                            <span>Interest: {mapped.interestPercent}%</span>
                          )}
                        </div>
                        {mapped.notes && (
                          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                            {mapped.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="font-semibold text-foreground">
                        ₱{total.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                      </p>
                      {interest > 0 && (
                        <p className="text-xs text-rose-600 dark:text-rose-400">
                          +₱{interest.toFixed(2)} interest
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 mt-3 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    {!isPaid && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-8"
                        onClick={() => markAsPaid(mapped.id)}
                        disabled={updateDebt.isPending}
                        data-testid={`button-mark-paid-debt-${mapped.id}`}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Mark Paid
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      onClick={() => openEdit(mapped)}
                      data-testid={`button-edit-debt-${mapped.id}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          data-testid={`button-delete-debt-${mapped.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this debt?</AlertDialogTitle>
                          <AlertDialogDescription>
                            "{mapped.name}" will be permanently removed. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel
                            data-testid={`button-cancel-delete-debt-${mapped.id}`}
                          >
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteDebt.mutate({ id: mapped.id })}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            data-testid={`button-confirm-delete-debt-${mapped.id}`}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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

function mapDebtForForm(d: {
  id: number;
  name: string;
  creditor?: string | null;
  amount: number;
  borrowedDate: string;
  dueDate: string;
  interestPercent?: number | null;
  status: string;
  notes?: string | null;
}) {
  return {
    id: d.id,
    name: d.name,
    creditor: d.creditor ?? null,
    amount: Number(d.amount),
    borrowedDate: d.borrowedDate,
    dueDate: d.dueDate,
    interestPercent: d.interestPercent ?? null,
    status: d.status,
    notes: d.notes ?? null,
  };
}
