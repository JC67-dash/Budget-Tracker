import { useState } from "react";
import {
  useListInstallments,
  getListInstallmentsQueryKey,
  useCreateInstallment,
  useUpdateInstallment,
  useDeleteInstallment,
  useRecordInstallmentPayment,
  getGetUpcomingInstallmentsQueryKey,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, CalendarClock, CheckCircle2, AlertTriangle, Clock, Wallet, Pencil } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { format, parseISO, differenceInDays, addMonths } from "date-fns";

const installmentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  amount: z.coerce.number().min(0.01, "Total amount must be greater than 0"),
  termMonths: z.coerce.number().int().min(1, "Must be at least 1 month").optional(),
  monthlyAmount: z.coerce.number().min(0.01, "Must be greater than 0").optional(),
  dueDate: z.string().min(1, "Due date is required"),
  status: z.enum(["pending", "paid", "overdue"]),
  notes: z.string().optional(),
});

const statusConfig = {
  pending: { label: "Pending", icon: Clock, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/30" },
  paid: { label: "Paid", icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900/30" },
  overdue: { label: "Overdue", icon: AlertTriangle, color: "text-rose-600", bg: "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/30" },
};

export default function Installments() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [payingId, setPayingId] = useState<number | null>(null);
  const [payAmount, setPayAmount] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: installmentsData, isLoading } = useListInstallments({
    query: { queryKey: getListInstallmentsQueryKey() },
  });

  const createInstallment = useCreateInstallment({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListInstallmentsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetUpcomingInstallmentsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        setIsAddOpen(false);
        form.reset();
        toast({ title: "Installment added" });
      },
      onError: (err: Error) => {
        toast({ title: "Failed to add installment", description: err.message, variant: "destructive" });
      },
    },
  });

  const updateInstallment = useUpdateInstallment({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListInstallmentsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetUpcomingInstallmentsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        if (editingId !== null) {
          setIsAddOpen(false);
          setEditingId(null);
          form.reset();
        }
        toast({ title: "Installment updated" });
      },
      onError: (err: Error) => {
        toast({ title: "Failed to update installment", description: err.message, variant: "destructive" });
      },
    },
  });

  const recordPayment = useRecordInstallmentPayment({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListInstallmentsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetUpcomingInstallmentsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        setPayingId(null);
        setPayAmount("");
        toast({ title: "Payment recorded" });
      },
      onError: (err: Error) => {
        toast({ title: "Failed to record payment", description: err.message, variant: "destructive" });
      },
    },
  });

  const deleteInstallment = useDeleteInstallment({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListInstallmentsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetUpcomingInstallmentsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        toast({ title: "Installment deleted" });
      },
    },
  });

  const form = useForm<z.infer<typeof installmentSchema>>({
    resolver: zodResolver(installmentSchema),
    defaultValues: {
      name: "",
      amount: 0,
      termMonths: undefined,
      monthlyAmount: undefined,
      dueDate: format(new Date(), "yyyy-MM-dd"),
      status: "pending",
      notes: "",
    },
  });

  const onSubmit = (data: z.infer<typeof installmentSchema>) => {
    const { termMonths, monthlyAmount: enteredMonthly, amount, ...rest } = data;
    const monthlyAmount =
      enteredMonthly && enteredMonthly > 0
        ? enteredMonthly
        : termMonths && termMonths > 0
          ? Number((amount / termMonths).toFixed(2))
          : undefined;
    const payload = {
      ...rest,
      amount,
      ...(monthlyAmount ? { monthlyAmount } : {}),
    };
    if (editingId !== null) {
      updateInstallment.mutate({ id: editingId, data: payload });
    } else {
      createInstallment.mutate({ data: payload });
    }
  };

  const openAdd = () => {
    setEditingId(null);
    form.reset({
      name: "",
      amount: 0,
      termMonths: undefined,
      monthlyAmount: undefined,
      dueDate: format(new Date(), "yyyy-MM-dd"),
      status: "pending",
      notes: "",
    });
    setIsAddOpen(true);
  };

  const openEdit = (inst: typeof installments[number]) => {
    setEditingId(inst.id);
    form.reset({
      name: inst.name,
      amount: Number(inst.amount),
      termMonths: undefined,
      monthlyAmount: inst.monthlyAmount != null ? Number(inst.monthlyAmount) : undefined,
      dueDate: inst.dueDate,
      status: inst.status as "pending" | "paid" | "overdue",
      notes: inst.notes ?? "",
    });
    setIsAddOpen(true);
  };

  const watchedAmount = form.watch("amount");
  const watchedTerm = form.watch("termMonths");
  const watchedMonthly = form.watch("monthlyAmount");
  const previewMonthly =
    watchedMonthly && watchedMonthly > 0
      ? Number(watchedMonthly)
      : watchedTerm && watchedTerm > 0 && watchedAmount > 0
        ? Number(watchedAmount) / Number(watchedTerm)
        : null;

  const markAsPaid = (id: number) => {
    updateInstallment.mutate({ id, data: { status: "paid" } });
  };

  const submitPayment = () => {
    if (payingId === null) return;
    const amt = Number(payAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    recordPayment.mutate({ id: payingId, data: { amount: amt } });
  };

  const installments = installmentsData?.installments ?? [];
  const today = new Date();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Paylater & Installments</h1>
          <p className="text-muted-foreground mt-1">Track upcoming payment due dates.</p>
        </div>

        <Dialog
          open={isAddOpen}
          onOpenChange={(open) => {
            setIsAddOpen(open);
            if (!open) {
              setEditingId(null);
              form.reset();
            }
          }}
        >
          <DialogTrigger asChild>
            <Button
              onClick={openAdd}
              className="rounded-full shadow-sm hover-elevate"
              data-testid="button-add-installment"
            >
              <Plus className="h-4 w-4 mr-2" /> Add Payment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId !== null ? "Edit Installment" : "Add Installment / Payment"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Name</FormLabel>
                      <FormControl>
                        <Input placeholder="iPhone installment" {...field} data-testid="input-installment-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Amount</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} data-testid="input-installment-amount" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="termMonths"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel># of Months</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="1"
                            min="1"
                            placeholder="e.g. 12"
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value === "" ? undefined : e.target.value)}
                            data-testid="input-installment-term"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="monthlyAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Amount Per Month{" "}
                        <span className="text-muted-foreground font-normal">
                          (optional — leave blank to auto-calculate)
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder={
                            previewMonthly && !watchedMonthly
                              ? `Auto: ₱${previewMonthly.toFixed(2)}`
                              : "e.g. 5000"
                          }
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value === "" ? undefined : e.target.value)}
                          data-testid="input-installment-monthly"
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
                      <FormLabel>First Due Date <span className="text-muted-foreground font-normal">(then due every month)</span></FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-installment-due-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-installment-status">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="overdue">Overdue</SelectItem>
                        </SelectContent>
                      </Select>
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
                        <Textarea placeholder="Additional details..." {...field} data-testid="textarea-installment-notes" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={createInstallment.isPending || updateInstallment.isPending}
                    data-testid="button-submit-installment"
                  >
                    {editingId !== null ? "Save changes" : "Add Payment"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : installments.length === 0 ? (
        <div className="text-center py-16">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <CalendarClock className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">No installments yet</h3>
          <p className="text-muted-foreground mb-6">Add upcoming payments to stay on top of due dates.</p>
          <Button onClick={() => setIsAddOpen(true)} className="rounded-full" data-testid="button-add-first-installment">
            <Plus className="h-4 w-4 mr-2" /> Add Payment
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {installments.map((inst) => {
            const daysLeft = differenceInDays(parseISO(inst.dueDate), today);
            const isUrgent = inst.status === "pending" && daysLeft >= 0 && daysLeft <= 7;
            const cfg = statusConfig[inst.status as keyof typeof statusConfig] || statusConfig.pending;
            const Icon = cfg.icon;
            const total = Number(inst.amount);
            const paid = Number(inst.paidAmount ?? 0);
            const remaining = Math.max(0, total - paid);
            const pct = total > 0 ? Math.min(100, (paid / total) * 100) : 0;
            const hasPartial = paid > 0 && paid < total;

            return (
              <Card
                key={inst.id}
                className={`border shadow-sm group transition-all ${isUrgent ? cfg.bg : "border-border"}`}
                data-testid={`card-installment-${inst.id}`}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className={`h-10 w-10 rounded-full ${isUrgent ? "bg-amber-100 dark:bg-amber-900/30" : "bg-muted"} flex items-center justify-center shrink-0`}>
                      <Icon className={`h-5 w-5 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium text-foreground break-words min-w-0 flex-1">{inst.name}</p>
                        <div className="text-right shrink-0">
                          <div className="font-semibold text-foreground whitespace-nowrap">₱{remaining.toFixed(2)}</div>
                          <div className="text-[11px] text-muted-foreground whitespace-nowrap">
                            of ₱{total.toFixed(2)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">Due {format(parseISO(inst.dueDate), "MMM d, yyyy")}</span>
                        {isUrgent && (
                          <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 dark:text-amber-400">
                            {daysLeft === 0 ? "Due Today" : `${daysLeft}d left`}
                          </Badge>
                        )}
                        <Badge
                          variant="secondary"
                          className={`text-xs capitalize ${inst.status === "paid" ? "text-green-700 bg-green-50 dark:bg-green-950/30" : inst.status === "overdue" ? "text-rose-700 bg-rose-50 dark:bg-rose-950/30" : ""}`}
                          data-testid={`status-installment-${inst.id}`}
                        >
                          {inst.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    {inst.status !== "paid" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-8"
                        onClick={() => {
                          setPayingId(inst.id);
                          const m = inst.monthlyAmount;
                          setPayAmount(m != null && m > 0 ? Math.min(Number(m), remaining).toFixed(2) : "");
                        }}
                        data-testid={`button-pay-${inst.id}`}
                      >
                        <Wallet className="h-3.5 w-3.5 mr-1" /> Pay
                      </Button>
                    )}
                    {inst.status === "pending" && remaining === total && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-8"
                        onClick={() => markAsPaid(inst.id)}
                        data-testid={`button-mark-paid-${inst.id}`}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Mark Paid
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      onClick={() => openEdit(inst)}
                      data-testid={`button-edit-installment-${inst.id}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          data-testid={`button-delete-installment-${inst.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this installment?</AlertDialogTitle>
                          <AlertDialogDescription>
                            "{inst.name}" will be permanently removed. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel data-testid={`button-cancel-delete-installment-${inst.id}`}>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteInstallment.mutate({ id: inst.id })}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            data-testid={`button-confirm-delete-installment-${inst.id}`}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                  {inst.monthlyAmount != null && Number(inst.monthlyAmount) > 0 && (() => {
                    const monthly = Number(inst.monthlyAmount);
                    const totalMonths = Math.max(1, Math.round(total / monthly));
                    const monthsPaid = Math.min(totalMonths, Math.floor(paid / monthly));
                    const monthsLeft = Math.max(0, totalMonths - monthsPaid);
                    return (
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground pt-2 border-t border-border/50">
                        <span>
                          ₱{monthly.toFixed(2)} due every month
                        </span>
                        <span>
                          <span className="font-medium text-foreground">{monthsPaid}</span> of{" "}
                          <span className="font-medium text-foreground">{totalMonths}</span> month{totalMonths === 1 ? "" : "s"} paid
                          {monthsLeft > 0 && inst.status !== "paid" && (
                            <span className="ml-1">· {monthsLeft} left</span>
                          )}
                        </span>
                      </div>
                    );
                  })()}
                  {(hasPartial || inst.status === "paid") && (
                    <Progress value={pct} className="h-1.5" />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={payingId !== null} onOpenChange={(o) => { if (!o) { setPayingId(null); setPayAmount(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record a payment</DialogTitle>
          </DialogHeader>
          {(() => {
            const inst = installments.find((i) => i.id === payingId);
            if (!inst) return null;
            const total = Number(inst.amount);
            const paid = Number(inst.paidAmount ?? 0);
            const remaining = Math.max(0, total - paid);
            return (
              <div className="space-y-4">
                <div className="rounded-lg bg-muted p-3 text-sm">
                  <div className="font-medium text-foreground">{inst.name}</div>
                  <div className="text-muted-foreground mt-1">
                    Paid ₱{paid.toFixed(2)} of ₱{total.toFixed(2)} · Remaining{" "}
                    <span className="font-semibold text-foreground">₱{remaining.toFixed(2)}</span>
                  </div>
                  {inst.monthlyAmount != null && inst.monthlyAmount > 0 && (
                    <div className="text-muted-foreground mt-0.5">
                      Monthly: ₱{Number(inst.monthlyAmount).toFixed(2)}
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Amount paid this time (₱)</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    autoFocus
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder={remaining.toFixed(2)}
                    data-testid="input-payment-amount"
                  />
                  <div className="flex flex-wrap gap-2 pt-1">
                    {inst.monthlyAmount != null && inst.monthlyAmount > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => setPayAmount(Math.min(Number(inst.monthlyAmount), remaining).toFixed(2))}
                      >
                        1 month (₱{Number(inst.monthlyAmount).toFixed(2)})
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => setPayAmount(remaining.toFixed(2))}
                    >
                      Pay full remaining
                    </Button>
                  </div>
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPayingId(null); setPayAmount(""); }}>
              Cancel
            </Button>
            <Button onClick={submitPayment} disabled={recordPayment.isPending} data-testid="button-submit-payment">
              Record payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
