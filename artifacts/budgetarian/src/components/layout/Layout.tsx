import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useClerk, useUser } from "@clerk/react";
import { 
  LayoutDashboard, 
  Receipt, 
  Target, 
  CalendarClock, 
  ShieldCheck, 
  Lightbulb, 
  LogOut,
  Menu,
  Wallet,
  HandCoins,
  PiggyBank
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Expenses", href: "/expenses", icon: Receipt },
  { name: "Goals", href: "/goals", icon: Target },
  { name: "Accounts", href: "/accounts", icon: PiggyBank },
  { name: "Installments", href: "/installments", icon: CalendarClock },
  { name: "Debts", href: "/debts", icon: HandCoins },
  { name: "Warranties", href: "/warranties", icon: ShieldCheck },
  { name: "Tips & Ideas", href: "/tips", icon: Lightbulb },
];

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const { user } = useUser();

  const NavLinks = () => (
    <nav className="space-y-1 px-2" data-testid="nav-links">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location === item.href;
        return (
          <Link 
            key={item.href} 
            href={item.href}
            className={`
              flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
              ${isActive 
                ? "bg-primary/10 text-primary" 
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              }
            `}
            data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
          >
            <Icon className="h-5 w-5" />
            {item.name}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background flex w-full">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-sidebar shrink-0 h-screen sticky top-0">
        <div className="p-6 flex items-center gap-2">
          <div className="bg-primary p-2 rounded-lg text-primary-foreground">
            <Wallet className="h-5 w-5" />
          </div>
          <span className="font-bold text-xl tracking-tight text-foreground">Budgetarian</span>
        </div>
        
        <div className="flex-1 overflow-y-auto py-4">
          <NavLinks />
        </div>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 px-3 py-2">
            <Avatar className="h-9 w-9 bg-primary/10 text-primary">
              <AvatarImage src={user?.imageUrl} />
              <AvatarFallback>{user?.firstName?.charAt(0) || user?.emailAddresses[0]?.emailAddress?.charAt(0) || "U"}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {user?.fullName || "User"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {user?.primaryEmailAddress?.emailAddress}
              </p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10 mt-2" 
            onClick={() => signOut()}
            data-testid="button-sign-out"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Mobile Header & Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between p-4 border-b border-border bg-background sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <div className="bg-primary p-1.5 rounded-md text-primary-foreground">
              <Wallet className="h-5 w-5" />
            </div>
            <span className="font-bold text-lg text-foreground">Budgetarian</span>
          </div>
          
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" data-testid="button-mobile-menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 flex flex-col bg-sidebar">
              <div className="p-6 flex items-center gap-2">
                <div className="bg-primary p-2 rounded-lg text-primary-foreground">
                  <Wallet className="h-5 w-5" />
                </div>
                <span className="font-bold text-xl tracking-tight text-foreground">Budgetarian</span>
              </div>
              <div className="flex-1 overflow-y-auto py-4">
                <NavLinks />
              </div>
              <div className="p-4 border-t border-border">
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10" 
                  onClick={() => signOut()}
                  data-testid="button-mobile-sign-out"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </header>

        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <div className="max-w-5xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
