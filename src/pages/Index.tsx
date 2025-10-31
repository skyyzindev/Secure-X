import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, FileSearch, CheckCircle } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import secureXLogo from "@/assets/securex-logo.jpg";

const Index = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-secondary/5">
      {/* Header */}
      <header className="border-b border-primary/20 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={secureXLogo} alt="SecureX Logo" className="h-8 w-8 object-contain" />
            <h1 className="text-2xl font-bold text-gradient">SecureX</h1>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            {user ? (
              <Button onClick={() => navigate("/dashboard")}>
                Dashboard
              </Button>
            ) : (
              <Button onClick={() => navigate("/auth")}>
                Entrar
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center animate-fade-in">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full animate-pulse" />
              <img 
                src={secureXLogo} 
                alt="SecureX Logo" 
                className="relative h-20 w-20 sm:h-24 sm:w-24 md:h-28 md:w-28 lg:h-32 lg:w-32 object-contain rounded-2xl shadow-2xl shadow-primary/30 animate-float ring-4 ring-primary/10 hover:ring-primary/30 transition-all duration-300 hover:scale-110" 
              />
            </div>
          </div>
          
          <h2 className="text-5xl md:text-6xl font-bold leading-tight">
            Segurança de <span className="text-gradient">Classe Mundial</span>
            <br />para suas Aplicações
          </h2>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Plataforma profissional de cybersegurança que analisa, detecta e corrige vulnerabilidades 
            em tempo real usando inteligência artificial avançada.
          </p>

          <div className="flex gap-4 justify-center pt-4">
            <Button 
              size="lg" 
              className="gap-2 text-lg px-8"
              onClick={() => navigate(user ? "/dashboard" : "/auth")}
            >
              <Shield className="h-5 w-5" />
              Começar Agora
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="text-lg px-8"
            >
              Saiba Mais
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20">
        <h3 className="text-3xl font-bold text-center mb-12">
          Recursos Poderosos
        </h3>
        
        <div className="grid md:grid-cols-3 gap-8">
          <Card className="border-primary/20 hover:border-primary/40 transition-all hover:shadow-lg hover:shadow-primary/10 animate-slide-up">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Scan Inteligente com IA</CardTitle>
              <CardDescription>
                Scanner avançado com inteligência artificial que detecta vulnerabilidades conhecidas e desconhecidas
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-secondary/20 hover:border-secondary/40 transition-all hover:shadow-lg hover:shadow-secondary/10 animate-slide-up" style={{ animationDelay: "0.1s" }}>
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-secondary/10 flex items-center justify-center mb-4">
                <FileSearch className="h-6 w-6 text-secondary" />
              </div>
              <CardTitle>Análise em Tempo Real</CardTitle>
              <CardDescription>
                Monitore suas aplicações 24/7 com relatórios detalhados e alertas instantâneos de segurança
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-accent/20 hover:border-accent/40 transition-all hover:shadow-lg hover:shadow-accent/10 animate-slide-up" style={{ animationDelay: "0.2s" }}>
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                <CheckCircle className="h-6 w-6 text-accent" />
              </div>
              <CardTitle>Correções Automáticas</CardTitle>
              <CardDescription>
                Receba recomendações precisas e código pronto para corrigir vulnerabilidades identificadas
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <Card className="border-primary/20 bg-gradient-to-br from-card via-primary/5 to-secondary/5">
          <CardContent className="text-center py-16">
            <h3 className="text-4xl font-bold mb-4">
              Pronto para Proteger suas Aplicações?
            </h3>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Junte-se a milhares de desenvolvedores que confiam na SecureX para manter suas aplicações seguras
            </p>
            <Button 
              size="lg" 
              className="gap-2 text-lg px-8"
              onClick={() => navigate("/auth")}
            >
              <Shield className="h-5 w-5" />
              Criar Conta Grátis
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-primary/20 mt-20">
        <div className="container mx-auto px-4 py-8 text-center text-muted-foreground">
          <p>&copy; 2025 SecureX. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
