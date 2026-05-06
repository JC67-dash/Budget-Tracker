import { Link } from "wouter";
import { ArrowRight, ShieldCheck, Target, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoUrl from "@assets/LOGO_OOP2_1778085443172.png";

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="py-6 px-4 sm:px-8 flex items-center justify-between border-b border-border/50 max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <img src={logoUrl} alt="Budgetarian" className="h-10 w-10 object-contain" />
          <span className="font-extrabold text-2xl tracking-tight text-[#113320] dark:text-green-300">Budgetarian</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/sign-in" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors" data-testid="link-signin">
            Sign In
          </Link>
          <Link href="/sign-up" data-testid="link-signup">
            <Button className="rounded-full px-6">Get Started</Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm font-medium text-primary mb-8">
          <span className="flex h-2 w-2 rounded-full bg-primary mr-2"></span>
          Your personal financial companion
        </div>
        
        <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight text-foreground mb-6 leading-[1.1]">
          Money managed with <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-green-400">intention.</span>
        </h1>
        
        <p className="text-lg sm:text-xl text-muted-foreground mb-10 max-w-2xl leading-relaxed">
          Budgetarian helps you track expenses, save for what matters, stay on top of installments, and never lose a warranty again. A calm, organized space for your finances.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 mb-20 w-full sm:w-auto">
          <Link href="/sign-up" className="w-full sm:w-auto" data-testid="link-hero-signup">
            <Button size="lg" className="w-full sm:w-auto rounded-full text-base px-8 h-14">
              Start Your Journey <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full text-left mt-8">
          <div className="p-6 rounded-2xl bg-card border border-card-border shadow-sm hover-elevate">
            <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
              <Target className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold mb-2 text-card-foreground">Meaningful Goals</h3>
            <p className="text-muted-foreground leading-relaxed">Set savings targets for the things you care about and track your progress weekly or monthly.</p>
          </div>
          
          <div className="p-6 rounded-2xl bg-card border border-card-border shadow-sm hover-elevate">
            <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
              <TrendingUp className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold mb-2 text-card-foreground">Clear Insights</h3>
            <p className="text-muted-foreground leading-relaxed">Understand exactly where your money goes with elegant category breakdowns and trends.</p>
          </div>
          
          <div className="p-6 rounded-2xl bg-card border border-card-border shadow-sm hover-elevate">
            <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold mb-2 text-card-foreground">Warranty Keeper</h3>
            <p className="text-muted-foreground leading-relaxed">Store receipts and track expiry dates so you're always protected when things break.</p>
          </div>
        </div>
      </main>

      <footer className="py-8 border-t border-border mt-auto">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Budgetarian. Designed for your financial peace of mind.
        </div>
      </footer>
    </div>
  );
}
