import { useState } from "react";
import {
  useListAccounts,
  getListAccountsQueryKey,
  useCreateAccount,
  useUpdateAccount,
  useDeleteAccount,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Trash2,
  Pencil,
  Wallet,
  Smartphone,
  Landmark,
  Banknote,
  PiggyBank,
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
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const accountTypes = [
  { value: "digital_wallet", label: "Digital Wallet", icon: Smartphone, hint: "GCash, Maya, PayPal, etc." },
  { value: "bank", label: "Bank", icon: Landmark, hint: "BPI, BDO, Metrobank, etc." },
  { value: "cash", label: "Cash", icon: Banknote, hint: "Physical cash on hand" },
  { value: "other", label: "Other", icon: Wallet, hint: "Anything else" },
] as const;

const typeLabel = (t: string) => accountTypes.find((x) => x.value === t)?.label ?? t;
const typeIcon = (t: string) => accountTypes.find((x) => x.value === t)?.icon ?? Wallet;

const accountSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["digital_wallet", "bank", "cash", "other"]),
  balance: z.coerce.number().min(0, "Balance must be 0 or greater"),
  notes: z.string().optional(),
});

type AccountForm = z.infer<typeof accountSchema>;

const defaultValues = (): AccountForm => ({
  name: "",
  type: "digital_wallet",
  balance: 0,
  notes: "",
});

export default function Accounts() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: accountsData, isLoading } = useListAccounts({
    query: { queryKey: getListAccountsQueryKey() },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  };

  const form = useForm<AccountForm>({
    resolver: zodResolver(accountSchema),
    defaultValues: defaultValues(),
  });

  const createAccount = useCreateAccount({
    mutation: {
      onSuccess: () => {
        invalidate();
        setIsAddOpen(false);
        form.reset(defaultValues());
        toast({ title: "Account added" });
      },
      onError: (err: Error) => {
        toast({ title: "Failed to add account", description: err.message, variant: "destructive" });
      },
    },
  });

  const updateAccount = useUpdateAccount({
    mutation: {
      onSuccess: () => {
        invalidate();
        setEditingId(null);
        setIsAddOpen(false);
        form.reset(defaultValues());
        toast({ title: "Account updated" });
      },
      onError: (err: Error) => {
        toast({ title: "Failed to update account", description: err.message, variant: "destructive" });
      },
    },
  });

  const deleteAccount = useDeleteAccount({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast({ title: "Account deleted" });
      },
      onError: (err: Error) => {
        toast({ title: "Failed to delete account", description: err.message, variant: "destructive" });
      },
    },
  });

  const accounts = accountsData?.accounts ?? [];
  const totalBalance = accounts.reduce((sum: number, a) => sum + Number(a.balance), 0);

  const onSubmit = (data: AccountForm) => {
    const payload = {
      name: data.name,
      type: data.type,
      balance: data.balance,
      notes: data.notes || undefined,
    };
    if (editingId !== null) {
      updateAccount.mutate({ id: editingId, data: payload });
    } else {
      createAccount.mutate({ data: payload });
    }
  };

  const openAdd = () => {
    setEditingId(null);
    form.reset(defaultValues());
    setIsAddOpen(true);
  };

  const openEdit = (a: (typeof accounts)[number]) => {
    setEditingId(a.id);
    form.reset({
      name: a.name,
      type: a.type as AccountForm["type"],
      balance: Number(a.balance),
      notes: a.notes ?? "",
    });
    setIsAddOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight" data-testid="text-accounts-heading">
            Accounts
          </h1>
          <p className="text-muted-foreground mt-1">
            Where do you keep your money? Track each wallet and bank balance.
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
            <Button onClick={openAdd} data-testid="button-add-account">
              <Plus className="h-4 w-4 mr-2" />
              Add Account
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId !== null ? "Edit Account" : "Add Account"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. GCash, BPI Savings, Cash on hand"
                          data-testid="input-account-name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-account-type">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {accountTypes.map((t) => (
                            <SelectItem key={t.value} value={t.value} data-testid={`option-account-type-${t.value}`}>
                              {t.label} — {t.hint}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="balance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current balance (₱)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          data-testid="input-account-balance"
                          {...field}
                        />
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
                        <Textarea
                          placeholder="Anything to remember about this account"
                          data-testid="input-account-notes"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={createAccount.isPending || updateAccount.isPending}
                    data-testid="button-submit-account"
                  >
                    {editingId !== null ? "Save changes" : "Add account"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Total balance banner */}
      <Card className="border-none shadow-sm bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-teal-950/30 dark:to-emerald-950/30">
        <CardContent className="p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 flex items-center justify-center">
            <PiggyBank className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">Total across all accounts</p>
            <p className="text-3xl font-bold text-foreground" data-testid="text-accounts-total">
              ₱{totalBalance.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {accounts.length} {accounts.length === 1 ? "account" : "accounts"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-10 text-center">
            <Wallet className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-foreground font-medium">No accounts yet</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Add your digital wallets, bank accounts, and cash to see how much budget you have in each.
            </p>
            <Button onClick={openAdd} data-testid="button-add-first-account">
              <Plus className="h-4 w-4 mr-2" />
              Add your first account
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {accounts.map((a) => {
            const Icon = typeIcon(a.type);
            const share = totalBalance > 0 ? (Number(a.balance) / totalBalance) * 100 : 0;
            return (
              <Card key={a.id} className="border-none shadow-sm group hover-elevate transition-all" data-testid={`card-account-${a.id}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate" data-testid={`text-account-name-${a.id}`}>
                          {a.name}
                        </p>
                        <Badge variant="secondary" className="text-xs mt-0.5">
                          {typeLabel(a.type)}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xl font-bold text-foreground" data-testid={`text-account-balance-${a.id}`}>
                        ₱{Number(a.balance).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-muted-foreground">{share.toFixed(0)}% of total</p>
                    </div>
                  </div>

                  {a.notes && (
                    <p className="text-sm text-muted-foreground mt-3 whitespace-pre-wrap">{a.notes}</p>
                  )}

                  <div className="flex items-center justify-end gap-2 mt-3 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(a)}
                      data-testid={`button-edit-account-${a.id}`}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      Edit
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          data-testid={`button-delete-account-${a.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this account?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove "{a.name}" and its tracked balance. This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteAccount.mutate({ id: a.id })}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            data-testid={`button-confirm-delete-account-${a.id}`}
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
