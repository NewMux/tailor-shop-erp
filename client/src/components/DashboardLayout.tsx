import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import AuthGate from "@/components/AuthGate";
import { AlertCircle, ClipboardList, FileText, LayoutDashboard, Loader2, LogOut, MoreHorizontal, Package, ReceiptText, RefreshCw, Scissors, Settings, ShoppingCart, Users, Wifi, WifiOff } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { clientBrand } from "@/lib/branding";
import { useLanguage } from "@/contexts/LanguageContext";
import { useOfflineSync } from "@/contexts/OfflineSyncContext";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const navigation = [
  { label: "Overview", path: "/", icon: LayoutDashboard },
  { label: "Customers", path: "/customers", icon: Users },
  { label: "Inventory", path: "/inventory", icon: Package },
  { label: "Tailoring orders", path: "/tailoring", icon: Scissors },
  { label: "Point of Sale", path: "/sales", icon: ShoppingCart },
  { label: "Sales history", path: "/sales-history", icon: ReceiptText },
  { label: "Invoices", path: "/invoices", icon: FileText },
  { label: "Staff & Payroll", path: "/team", icon: Users },
  { label: "Shop Settings", path: "/settings", icon: Settings },
  { label: "Audit Trail", path: "/audit", icon: ClipboardList },
];

const mobileNavigation = ["/", "/customers", "/sales", "/tailoring"].map(path => navigation.find(item => item.path === path)!);

function ConnectionStatus() {
  const { isOnline, pendingCount, isSyncing, syncError, syncNow } = useOfflineSync();
  const { t } = useLanguage();
  const label = !isOnline ? "Offline" : isSyncing ? "Syncing…" : "Online";
  const statusText = pendingCount > 0 ? t(`${pendingCount} offline sale${pendingCount === 1 ? "" : "s"} waiting to sync`) : !isOnline ? t("Sales are saved on this device and will sync when internet returns.") : null;
  const Icon = !isOnline ? WifiOff : isSyncing ? RefreshCw : syncError ? AlertCircle : Wifi;
  return <div role="status" aria-live="polite" title={syncError || undefined} className={`flex min-w-0 items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs ${!isOnline ? "border-amber-300 bg-amber-50 text-amber-950" : syncError ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
    <Icon className={`h-3.5 w-3.5 shrink-0 ${isSyncing ? "animate-spin" : ""}`} />
    <div className="min-w-0"><p className="font-semibold">{t(label)}</p>{statusText && <p className="max-w-[180px] truncate text-[10px] opacity-80">{statusText}</p>}</div>
    {pendingCount > 0 && isOnline && !isSyncing && <button type="button" onClick={() => void syncNow()} className="rounded-md p-1 hover:bg-black/5" aria-label={t("Sync now")} title={t("Sync now")}><RefreshCw className="h-3.5 w-3.5" /></button>}
  </div>;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, isAuthenticated, logout, callbackError, recoveryMode, resetToken, completeRecovery } = useAuth();
  const { isArabic, t, toggleLanguage } = useLanguage();
  const [location] = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const currentPage = navigation.find(item => item.path === location) || navigation.find(item => item.path !== "/" && location.startsWith(item.path));
  const isActive = (path: string) => path === "/" ? location === "/" : location.startsWith(path);
  const moreItems = navigation.filter(item => !mobileNavigation.some(primary => primary.path === item.path));

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  if (recoveryMode) return <AuthGate recoveryMode resetToken={resetToken} onRecoveryComplete={completeRecovery} />;
  if (!isAuthenticated) return <AuthGate callbackError={callbackError} />;

  return <div className={`min-h-[100dvh] bg-stone-50 ${isArabic ? "text-right" : "text-left"}`}>
    <aside className={`fixed inset-y-0 hidden w-64 bg-white p-4 lg:block ${isArabic ? "right-0 border-l" : "left-0 border-r"}`}>
      <div className="flex items-center gap-3 px-3 py-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-white shadow-sm">
          <img src={clientBrand.logoSrc} alt={clientBrand.logoAlt} className="h-full w-full object-contain" />
        </div>
        <div><p className="font-semibold">{clientBrand.name}</p><p className="text-xs text-muted-foreground">Tailor ERP</p></div>
      </div>
      <nav className="mt-6 space-y-1" aria-label={t("Main navigation")}>
        {navigation.map(item => {
          const Icon = item.icon;
          return <Link key={item.path} href={item.path} aria-current={isActive(item.path) ? "page" : undefined} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${isActive(item.path) ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}><Icon className="h-4 w-4" />{t(item.label)}</Link>;
        })}
      </nav>
      <div className="absolute inset-x-4 bottom-4 rounded-xl bg-muted p-3">
        <p className="truncate text-sm font-semibold">{user?.name || t("Signed-in user")}</p>
        <div className="mt-2 flex gap-2">
          <Button data-no-translate variant="ghost" size="sm" className="h-9 flex-1 justify-center" onClick={toggleLanguage} aria-label={isArabic ? t("Switch to English") : t("Switch to Arabic")}>{isArabic ? "EN" : "عربي"}</Button>
          <Button variant="ghost" size="sm" className="h-9 flex-1 justify-center" onClick={() => logout()}><LogOut className="mr-2 h-4 w-4" />{t("Sign out")}</Button>
        </div>
      </div>
    </aside>

    <header className={`sticky top-0 z-30 border-b bg-white/95 px-4 py-3 backdrop-blur lg:static lg:bg-white lg:px-5 lg:py-4 ${isArabic ? "lg:mr-64 lg:ml-0" : "lg:ml-64 lg:mr-0"}`}>
      <div className="mx-auto flex max-w-7xl items-center gap-3">
        <div className="flex min-w-0 items-center gap-2.5 lg:hidden">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-white shadow-sm">
            <img src={clientBrand.logoSrc} alt={clientBrand.logoAlt} className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0"><p className="truncate text-sm font-semibold">{clientBrand.name}</p><p className="truncate text-xs text-muted-foreground">{currentPage ? t(currentPage.label) : t("Tailor ERP")}</p></div>
        </div>
        <p className="ml-auto hidden text-sm text-muted-foreground lg:block">{t("Secure business workspace")}</p>
        <ConnectionStatus />
        <div className="ml-auto flex items-center gap-2 lg:hidden">
          <Link href="/team" aria-label={t("Staff & Payroll")} className={`flex h-11 items-center gap-2 rounded-xl border px-3 text-xs font-semibold ${isActive("/team") ? "border-primary bg-primary text-primary-foreground" : "bg-white text-foreground"}`}>
            <Users className="h-4 w-4" />
            <span className="hidden min-[380px]:inline">{t("Team")}</span>
          </Link>
          <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl" onClick={() => setMoreOpen(true)} aria-label={t("More workspace tools")}><MoreHorizontal className="h-5 w-5" /></Button>
        </div>
      </div>
    </header>

    <main className={`px-4 py-5 pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:px-5 sm:py-6 lg:p-8 ${isArabic ? "lg:mr-64 lg:ml-0" : "lg:ml-64 lg:mr-0"}`}>{children}</main>

    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] pt-2 shadow-[0_-8px_24px_rgba(31,41,55,0.08)] backdrop-blur lg:hidden" aria-label={t("Main navigation")}>
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
        {mobileNavigation.map(item => {
          const Icon = item.icon;
          const active = isActive(item.path);
          const isPos = item.path === "/sales";
          return <Link key={item.path} href={item.path} aria-current={active ? "page" : undefined} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold transition ${active ? "text-primary" : "text-muted-foreground"}`}><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${isPos ? "-mt-5 h-12 w-12 rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30" : active ? "bg-primary/10" : ""}`}><Icon className={isPos ? "h-5 w-5" : "h-4 w-4"} /></span><span className={isPos ? "mt-[-2px]" : ""}>{isPos ? t("POS") : item.label === "Tailoring orders" ? t("Orders") : t(item.label)}</span></Link>;
        })}
        <button type="button" onClick={() => setMoreOpen(true)} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold transition ${moreItems.some(item => isActive(item.path)) ? "text-primary" : "text-muted-foreground"}`} aria-label={t("More workspace tools")}><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${moreItems.some(item => isActive(item.path)) ? "bg-primary/10" : ""}`}><MoreHorizontal className="h-5 w-5" /></span><span>{t("More")}</span></button>
      </div>
    </nav>

    <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
      <SheetContent side="bottom" className="max-h-[82dvh] rounded-t-[1.75rem] px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-2">
        <div className="mx-auto mb-1 h-1.5 w-10 rounded-full bg-muted" />
        <SheetHeader className={`px-1 pb-3 pt-2 ${isArabic ? "text-right" : "text-left"}`}><SheetTitle>{t("More workspace tools")}</SheetTitle><SheetDescription>{t("Open the rest of your tailor business workspace.")}</SheetDescription></SheetHeader>
        <nav className="grid grid-cols-2 gap-2 overflow-y-auto pb-4" aria-label="More navigation">
          {moreItems.map(item => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return <Link key={item.path} href={item.path} onClick={() => setMoreOpen(false)} aria-current={active ? "page" : undefined} className={`flex min-h-20 items-center gap-3 rounded-2xl border p-3.5 text-sm font-semibold transition active:scale-[0.98] ${active ? "border-primary bg-primary text-primary-foreground" : "bg-white text-foreground hover:bg-muted"}`}><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${active ? "bg-white/15" : "bg-primary/10 text-primary"}`}><Icon className="h-5 w-5" /></span><span className="leading-tight">{t(item.label)}</span></Link>;
          })}
        </nav>
        <div className="flex items-center justify-between rounded-2xl bg-muted px-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{user?.name || t("Signed-in user")}</p><p className="truncate text-xs text-muted-foreground">{user?.email || t("ERP workspace")}</p></div><div className="flex gap-2"><Button data-no-translate variant="ghost" size="sm" className="h-10 rounded-xl" onClick={toggleLanguage}>{isArabic ? "EN" : "عربي"}</Button><Button variant="ghost" size="sm" className="h-10 rounded-xl" onClick={() => logout()}><LogOut className="mr-2 h-4 w-4" />{t("Sign out")}</Button></div></div>
      </SheetContent>
    </Sheet>
  </div>;
}
