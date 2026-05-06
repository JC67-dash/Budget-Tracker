import { useState } from "react";
import {
  useListInstallments,
  getListInstallmentsQueryKey,
  useCreateInstallment,
  useUpdateInstallment,
  useDeleteInstallment,
  getGetUpcomingInstallmentsQueryKey,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, CalendarClock, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
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
import { format, parseISO, differenceInDays } from "date-fns";

const installmentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  dueDate: z.string().min(1, "Due date is required"),
  status: z.enum(["pending", "paid", "overdue"]),
  notes: z.string().optional(),
});

const statusConfig = {
  pending: { label: "Pending", icon: Clock, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/30" },
  paid: { label: "Paid", icon: CheckCircle2, color: "text-teal-600", bg: "bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-900/30" },
  overdue: { label: "Overdue", icon: AlertTriangle, color: "text-rose-600", bg: "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/30" },
};

export default function Installments() {
  const [isAddOpen, setIsAddOpen] = useState(false);
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
        toast({ title: "Installment updated" });
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
      dueDate: format(new Date(), "yyyy-MM-dd"),
      status: "pending",
      notes: "",
    },
  });

  const onSubmit = (data: z.infer<typeof installmentSchema>) => {
    createInstallment.mutate({ data });
  };

  const markAsPaid = (id: number) => {
    updateInstallment.mutate({ id, data: { status: "paid" } });
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

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full shadow-sm hover-elevate" data-testid="button-add-installment">
              <Plus className="h-4 w-4 mr-2" /> Add Payment
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Installment / Payment</DialogTitle>
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
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} data-testid="input-installment-amount" />
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
                        <FormLabel>Due Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-installment-due-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
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
                  <Button type="submit" disabled={createInstallment.isPending} data-testid="button-submit-installment">
                    Add Payment
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

            return (
              <Card
                key={inst.id}
                className={`border shadow-sm group transition-all ${isUrgent ? cfg.bg : "border-border"}`}
                data-testid={`card-installment-${inst.id}`}
              >
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={`h-10 w-10 rounded-full ${isUrgent ? "bg-amber-100 dark:bg-amber-900/30" : "bg-muted"} flex items-center justify-center shrink-0`}>
                      <Icon className={`h-5 w-5 ${cfg.color}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{inst.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-muted-foreground">Due {format(parseISO(inst.dueDate), "MMM d, yyyy")}</span>
                        {isUrgent && (
                          <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 dark:text-amber-400">
                            {daysLeft === 0 ? "Due Today" : `${daysLeft}d left`}
                          </Badge>
                        )}
                        <Badge
                          variant="secondary"
                          className={`text-xs capitalize ${inst.status === "paid" ? "text-teal-700 bg-teal-50 dark:bg-teal-950/30" : inst.status === "overdue" ? "text-rose-700 bg-rose-50 dark:bg-rose-950/30" : ""}`}
                          data-testid={`status-installment-${inst.id}`}
                        >
                          {inst.status}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-semibold text-foreground">₱{Number(inst.amount).toFixed(2)}</span>
                    {inst.status === "pending" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => markAsPaid(inst.id)}
                        data-testid={`button-mark-paid-${inst.id}`}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Mark Paid
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
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
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
