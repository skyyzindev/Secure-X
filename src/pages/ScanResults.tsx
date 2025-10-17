import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, ArrowLeft, AlertTriangle, CheckCircle, Info, XCircle, Loader2, RefreshCw } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { toast } from "sonner";

export default function ScanResults() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState<any>(null);
  const [scans, setScans] = useState<any[]>([]);
  const [vulnerabilities, setVulnerabilities] = useState<any[]>([]);

  useEffect(() => {
    checkAuth();
    loadData();
  }, [id]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const loadData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: app } = await supabase
      .from("applications")
      .select("*")
      .eq("id", id)
      .eq("user_id", session.user.id)
      .single();

    if (!app) {
      toast.error("Aplicação não encontrada");
      navigate("/applications");
      return;
    }

    setApplication(app);

    const { data: scansData } = await supabase
      .from("security_scans")
      .select("*")
      .eq("application_id", id)
      .order("created_at", { ascending: false });

    setScans(scansData || []);

    if (scansData && scansData.length > 0) {
      const latestScan = scansData[0];
      const { data: vulnsData } = await supabase
        .from("vulnerabilities")
        .select("*")
        .eq("scan_id", latestScan.id)
        .order("severity");

      setVulnerabilities(vulnsData || []);
    }

    setLoading(false);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-500/20 text-red-500 border-red-500/50";
      case "high":
        return "bg-orange-500/20 text-orange-500 border-orange-500/50";
      case "medium":
        return "bg-yellow-500/20 text-yellow-500 border-yellow-500/50";
      case "low":
        return "bg-blue-500/20 text-blue-500 border-blue-500/50";
      default:
        return "bg-muted text-muted-foreground border-muted";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
      case "high":
        return <XCircle className="h-4 w-4" />;
      case "medium":
        return <AlertTriangle className="h-4 w-4" />;
      case "low":
      case "info":
        return <Info className="h-4 w-4" />;
      default:
        return <CheckCircle className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Shield className="h-12 w-12 text-primary animate-pulse" />
      </div>
    );
  }

  const latestScan = scans[0];
  const criticalCount = vulnerabilities.filter(v => v.severity === "critical").length;
  const highCount = vulnerabilities.filter(v => v.severity === "high").length;
  const mediumCount = vulnerabilities.filter(v => v.severity === "medium").length;
  const lowCount = vulnerabilities.filter(v => v.severity === "low").length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-secondary/5">
      <header className="border-b border-primary/20 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/applications")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Shield className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold text-gradient">SecureX</h1>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">{application.name}</h2>
          <p className="text-muted-foreground">{application.description || "Análise de Segurança"}</p>
        </div>

        {!latestScan || latestScan.status === "pending" ? (
          <Card className="text-center py-12">
            <CardContent className="space-y-4">
              <Loader2 className="h-16 w-16 text-primary mx-auto animate-spin" />
              <div>
                <h3 className="text-xl font-semibold mb-2">Scan em Andamento</h3>
                <p className="text-muted-foreground">
                  Estamos analisando sua aplicação. Isso pode levar alguns minutos...
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-6 md:grid-cols-4 mb-8">
              <Card className="border-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Score Geral</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-primary">{latestScan.overall_score || 0}/100</div>
                  <Progress value={latestScan.overall_score || 0} className="mt-2" />
                </CardContent>
              </Card>

              <Card className="border-red-500/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Críticas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-red-500">{criticalCount}</div>
                </CardContent>
              </Card>

              <Card className="border-orange-500/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Altas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-orange-500">{highCount}</div>
                </CardContent>
              </Card>

              <Card className="border-yellow-500/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Médias</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-yellow-500">{mediumCount}</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Vulnerabilidades Encontradas</CardTitle>
                <CardDescription>
                  {vulnerabilities.length === 0
                    ? "Nenhuma vulnerabilidade encontrada. Sua aplicação está segura! 🎉"
                    : `${vulnerabilities.length} vulnerabilidade(s) detectada(s)`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {vulnerabilities.map((vuln) => (
                    <Card key={vuln.id} className="border-l-4 border-l-transparent hover:border-l-primary transition-colors">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            {getSeverityIcon(vuln.severity)}
                            <CardTitle className="text-lg">{vuln.title}</CardTitle>
                          </div>
                          <Badge className={getSeverityColor(vuln.severity)}>
                            {vuln.severity.toUpperCase()}
                          </Badge>
                        </div>
                        <CardDescription>
                          Categoria: {vuln.category}
                          {vuln.cvss_score && ` • CVSS: ${vuln.cvss_score}`}
                          {vuln.cve_id && ` • ${vuln.cve_id}`}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <h4 className="font-semibold mb-2">Descrição:</h4>
                          <p className="text-sm text-muted-foreground">{vuln.description}</p>
                        </div>
                        
                        {vuln.affected_component && (
                          <div>
                            <h4 className="font-semibold mb-2">Componente Afetado:</h4>
                            <code className="text-sm bg-muted px-2 py-1 rounded">
                              {vuln.affected_component}
                            </code>
                          </div>
                        )}

                        <div>
                          <h4 className="font-semibold mb-2 text-green-500">✓ Recomendação:</h4>
                          <p className="text-sm text-muted-foreground">{vuln.recommendation}</p>
                        </div>

                        {vuln.code_snippet && (
                          <div>
                            <h4 className="font-semibold mb-2">Código:</h4>
                            <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
                              {vuln.code_snippet}
                            </pre>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}