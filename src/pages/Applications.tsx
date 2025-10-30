import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Shield, ArrowLeft, Plus, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { z } from "zod";

export default function Applications() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState<any[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    url: "",
    technology_stack: "",
  });

  const applicationSchema = z.object({
    name: z.string().trim().min(1, "Nome é obrigatório").max(100, "Nome deve ter no máximo 100 caracteres"),
    url: z.string().trim().max(2048, "URL deve ter no máximo 2048 caracteres").refine(
      (val) => !val || val === "" || z.string().url().safeParse(val).success,
      "URL inválida"
    ),
    description: z.string().max(500, "Descrição deve ter no máximo 500 caracteres"),
    technology_stack: z.string().max(500, "Stack tecnológica deve ter no máximo 500 caracteres"),
  });

  useEffect(() => {
    checkAuth();
    loadApplications();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    setLoading(false);
  };

  const loadApplications = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data, error } = await supabase
      .from("applications")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar aplicações");
      return;
    }

    setApplications(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Validate form data
      const validationResult = applicationSchema.safeParse(formData);
      if (!validationResult.success) {
        toast.error(validationResult.error.errors[0].message);
        setSubmitting(false);
        return;
      }

      const validated = validationResult.data;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      // Sanitize and validate technology stack
      const techStack = validated.technology_stack
        .split(",")
        .map(t => t.trim().slice(0, 50))
        .filter(Boolean)
        .slice(0, 20);

      const { data: app, error } = await supabase
        .from("applications")
        .insert({
          user_id: session.user.id,
          name: validated.name,
          description: validated.description || null,
          url: validated.url || null,
          technology_stack: techStack.length > 0 ? techStack : null,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;

      // Iniciar scan automaticamente
      const { data: scan, error: scanError } = await supabase
        .from("security_scans")
        .insert({
          application_id: app.id,
          scan_type: "full",
          status: "pending",
        })
        .select()
        .single();

      if (scanError) throw scanError;

      // Chamar edge function para executar o scan
      const { error: functionError } = await supabase.functions.invoke("security-scanner", {
        body: { scanId: scan.id, applicationId: app.id },
      });

      if (functionError) {
        console.error("Erro ao iniciar scan:", functionError);
      }

      toast.success("Aplicação adicionada! Iniciando análise de segurança...");
      setShowDialog(false);
      setFormData({ name: "", description: "", url: "", technology_stack: "" });
      loadApplications();
    } catch (error: any) {
      toast.error(error.message || "Erro ao adicionar aplicação");
    } finally {
      setSubmitting(false);
    }
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
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
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
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold mb-2">Minhas Aplicações</h2>
            <p className="text-muted-foreground">
              Gerencie e monitore a segurança de suas aplicações
            </p>
          </div>

          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button size="lg" className="gap-2">
                <Plus className="h-5 w-5" />
                Nova Aplicação
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Adicionar Nova Aplicação</DialogTitle>
                <DialogDescription>
                  Informe os detalhes da sua aplicação para iniciar a análise de segurança
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Aplicação *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="url">URL da Aplicação</Label>
                  <Input
                    id="url"
                    type="url"
                    placeholder="https://exemplo.com"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    placeholder="Descreva sua aplicação..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tech">Stack Tecnológica</Label>
                  <Input
                    id="tech"
                    placeholder="React, Node.js, PostgreSQL (separado por vírgula)"
                    value={formData.technology_stack}
                    onChange={(e) => setFormData({ ...formData, technology_stack: e.target.value })}
                    disabled={submitting}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adicionando...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Adicionar e Iniciar Scan
                    </>
                  )}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {applications.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent className="space-y-4">
              <Shield className="h-16 w-16 text-muted-foreground mx-auto" />
              <div>
                <h3 className="text-xl font-semibold mb-2">Nenhuma aplicação adicionada</h3>
                <p className="text-muted-foreground mb-4">
                  Comece adicionando sua primeira aplicação para análise de segurança
                </p>
                <Button onClick={() => setShowDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Primeira Aplicação
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {applications.map((app) => (
              <Card
                key={app.id}
                className="border-primary/20 hover:border-primary/40 transition-all cursor-pointer hover:shadow-lg hover:shadow-primary/10"
                onClick={() => navigate(`/scan/${app.id}`)}
              >
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {app.name}
                    <span className={`text-xs px-2 py-1 rounded ${
                      app.status === "completed" ? "bg-green-500/20 text-green-500" :
                      app.status === "scanning" ? "bg-primary/20 text-primary" :
                      app.status === "failed" ? "bg-destructive/20 text-destructive" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {app.status === "completed" ? "Concluído" :
                       app.status === "scanning" ? "Analisando" :
                       app.status === "failed" ? "Erro" :
                       "Pendente"}
                    </span>
                  </CardTitle>
                  <CardDescription className="line-clamp-2">
                    {app.description || "Sem descrição"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {app.url && (
                    <p className="text-sm text-primary truncate mb-2">{app.url}</p>
                  )}
                  {app.technology_stack && app.technology_stack.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {app.technology_stack.slice(0, 3).map((tech: string, i: number) => (
                        <span key={i} className="text-xs px-2 py-1 bg-secondary/20 text-secondary rounded">
                          {tech}
                        </span>
                      ))}
                      {app.technology_stack.length > 3 && (
                        <span className="text-xs px-2 py-1 bg-muted text-muted-foreground rounded">
                          +{app.technology_stack.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}