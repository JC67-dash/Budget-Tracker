import { useState } from "react";
import {
  useListGoals,
  getListGoalsQueryKey,
  useCreateGoal,
  useUpdateGoal,
  useDeleteGoal,
  getGetDashboardSummaryQueryKey,
  type ListGoalsQueryResult,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Target, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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

const goalSchema = z.object({
  name: z.string().min(1, "Goal name is required"),
  targetAmount: z.coerce.number().min(0.01, "Target amount must be greater than 0"),
  savedAmount: z.coerce.number().min(0, "Saved amount cannot be negative"),
  period: z.enum(["weekly", "monthly"]),
  notes: z.string().optional(),
});

const updateSavedSchema = z.object({
  savedAmount: z.coerce.number().min(0, "Amount cannot be negative"),
});

type Goal = ListGoalsQueryResult["goals"][number];

export default function Goals() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: goalsData, isLoading } = useListGoals({
    query: { queryKey: getListGoalsQueryKey() },
  });

  const createGoal = useCreateGoal({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListGoalsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        setIsAddOpen(false);
        addForm.reset();
        toast({ title: "Goal created successfully" });
      },
      onError: (err: Error) => {
        toast({ title: "Failed to create goal", description: err.message, variant: "destructive" });
      },
    },
  });

  const updateGoal = useUpdateGoal({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListGoalsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        setEditGoal(null);
        toast({ title: "Goal updated" });
      },
    },
  });

  const deleteGoal = useDeleteGoal({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListGoalsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        toast({ title: "Goal deleted" });
      },
    },
  });

  const addForm = useForm<z.infer<typeof goalSchema>>({
    resolver: zodResolver(goalSchema),
    defaultValues: { name: "", targetAmount: 0, savedAmount: 0, period: "monthly", notes: "" },
  });

  const editForm = useForm<z.infer<typeof updateSavedSchema>>({
    resolver: zodResolver(updateSavedSchema),
    defaultValues: { savedAmount: 0 },
  });

  const onAddSubmit = (data: z.infer<typeof goalSchema>) => {
    createGoal.mutate({ data });
  };

  const onEditSubmit = (data: z.infer<typeof updateSavedSchema>) => {
    if (!editGoal) return;
    updateGoal.mutate({ id: editGoal.id, data: { savedAmount: data.savedAmount } });
  };

  const openEdit = (goal: Goal) => {
    setEditGoal(goal);
    editForm.setValue("savedAmount", goal.savedAmount);
  };

  const goals = goalsData?.goals ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Savings Goals</h1>
          <p className="text-muted-foreground mt-1">Set targets and track your progress.</p>
        </div>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full shadow-sm hover-elevate" data-testid="button-add-goal">
              <Plus className="h-4 w-4 mr-2" /> New Goal
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Goal</DialogTitle>
            </DialogHeader>
            <Form {...addForm}>
              <form onSubmit={addForm.handleSubmit(onAddSubmit)} className="space-y-4">
                <FormField
                  control={addForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Goal Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Emergency Fund" {...field} data-testid="input-goal-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={addForm.control}
                    name="targetAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target Amount</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} data-testid="input-goal-target" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addForm.control}
                    name="savedAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Saved So Far</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} data-testid="input-goal-saved" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={addForm.control}
                  name="period"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Period</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-goal-period">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={addForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Why this goal matters..." {...field} data-testid="textarea-goal-notes" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={createGoal.isPending} data-testid="button-submit-goal">
                    Create Goal
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
        </div>
      ) : goals.length === 0 ? (
        <div className="text-center py-16">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Target className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">No goals yet</h3>
          <p className="text-muted-foreground mb-6">Set your first savings goal to start tracking progress.</p>
          <Button onClick={() => setIsAddOpen(true)} className="rounded-full" data-testid="button-add-first-goal">
            <Plus className="h-4 w-4 mr-2" /> Add Goal
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.map((goal) => {
            const pct = Math.min(100, goal.targetAmount > 0 ? (goal.savedAmount / goal.targetAmount) * 100 : 0);
            return (
              <Card key={goal.id} className="border-none shadow-sm group" data-testid={`card-goal-${goal.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground text-lg leading-tight">{goal.name}</h3>
                      <Badge variant="secondary" className="mt-1 capitalize">{goal.period}</Badge>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => openEdit(goal)}
                        data-testid={`button-edit-goal-${goal.id}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            data-testid={`button-delete-goal-${goal.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this savings goal?</AlertDialogTitle>
                            <AlertDialogDescription>
                              "{goal.name}" will be permanently removed along with its progress. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel data-testid={`button-cancel-delete-goal-${goal.id}`}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteGoal.mutate({ id: goal.id })}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              data-testid={`button-confirm-delete-goal-${goal.id}`}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium text-foreground">{pct.toFixed(0)}%</span>
                    </div>
                    <Progress value={pct} className="h-2" data-testid={`progress-goal-${goal.id}`} />
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Saved</span>
                    <span className="font-semibold text-teal-600">₱{goal.savedAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Target</span>
                    <span className="font-medium text-foreground">₱{goal.targetAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
                  </div>
                  {goal.notes && <p className="text-xs text-muted-foreground italic border-t border-border pt-2">{goal.notes}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit saved amount dialog */}
      <Dialog open={!!editGoal} onOpenChange={(o) => !o && setEditGoal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Saved Amount</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <p className="text-sm text-muted-foreground">Updating goal: <strong>{editGoal?.name}</strong></p>
              <FormField
                control={editForm.control}
                name="savedAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Saved Amount</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} data-testid="input-update-saved" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={updateGoal.isPending} data-testid="button-submit-update-goal">
                  Update
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
