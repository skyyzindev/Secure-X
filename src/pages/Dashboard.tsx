import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, FileSearch, AlertTriangle, CheckCircle, LogOut, Plus, Moon, Sun } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState({
    totalApps: 0,
    activeScans: 0,
    vulnerabilities: 0,
    secure: 0,
  });

  useEffect(() => {
    checkAuth();
    loadStats();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    setUser(session.user);
    setLoading(false);
  };

  const loadStats = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: apps } = await supabase
      .from("applications")
      .select("id, status")
      .eq("user_id", session.user.id);

    const { data: scans } = await supabase
      .from("security_scans")
      .select("id, status, risk_level, application_id")
      .in("application_id", apps?.map(a => a.id) || []);

    const { data: vulns } = await supabase
      .from("vulnerabilities")
      .select("severity")
      .in("scan_id", scans?.map(s => s.id) || [])
      .in("severity", ["critical", "high"]);

    setStats({
      totalApps: apps?.length || 0,
      activeScans: apps?.filter(a => a.status === "scanning").length || 0,
      vulnerabilities: vulns?.length || 0,
      secure: scans?.filter(s => s.risk_level === "secure" || s.risk_level === "low").length || 0,
    });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Shield className="h-12 w-12 text-primary animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-secondary/5">
      <header className="border-b border-primary/20 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold text-gradient">SecureX</h1>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 animate-fade-in">
          <h2 className="text-3xl font-bold mb-2">Dashboard</h2>
          <p className="text-muted-foreground">
            Bem-vindo de volta, {user?.email}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8 animate-slide-up">
          <Card className="border-primary/20 hover:border-primary/40 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total de Apps</CardTitle>
              <FileSearch className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalApps}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Aplicações monitoradas
              </p>
            </CardContent>
          </Card>

          <Card className="border-secondary/20 hover:border-secondary/40 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Scans Ativos</CardTitle>
              <Shield className="h-4 w-4 text-secondary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.activeScans}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Em andamento
              </p>
            </CardContent>
          </Card>

          <Card className="border-destructive/20 hover:border-destructive/40 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Vulnerabilidades</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.vulnerabilities}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Críticas e altas
              </p>
            </CardContent>
          </Card>

          <Card className="border-green-500/20 hover:border-green-500/40 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Seguras</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.secure}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Apps protegidas
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-4 animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <Button 
            size="lg" 
            className="gap-2"
            onClick={() => navigate("/applications")}
          >
            <Plus className="h-5 w-5" />
            Nova Aplicação
          </Button>
          <Button 
            size="lg" 
            variant="outline"
            onClick={() => navigate("/applications")}
          >
            Ver Todas as Aplicações
          </Button>
        </div>
      </main>
    </div>
  );
}