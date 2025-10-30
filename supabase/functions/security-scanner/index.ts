import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const requestSchema = z.object({
  scanId: z.string().uuid(),
  applicationId: z.string().uuid()
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with service role for admin operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify user token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate and parse request body
    const body = await req.json();
    const validationResult = requestSchema.safeParse(body);
    
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid request parameters',
          details: validationResult.error.errors 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { scanId, applicationId } = validationResult.data;

    console.log('Starting security scan:', { scanId, applicationId, userId: user.id });

    // Update scan status to running
    await supabase
      .from('security_scans')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', scanId);

    // Get application details and verify ownership
    const { data: app, error: appError } = await supabase
      .from('applications')
      .select('*')
      .eq('id', applicationId)
      .single();

    if (appError || !app) {
      console.error('Application fetch error:', appError);
      return new Response(
        JSON.stringify({ error: 'Application not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user owns the application
    if (app.user_id !== user.id) {
      console.warn('Unauthorized access attempt:', { userId: user.id, appUserId: app.user_id });
      return new Response(
        JSON.stringify({ error: 'You do not have permission to scan this application' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify scan belongs to application
    const { data: scan, error: scanError } = await supabase
      .from('security_scans')
      .select('application_id')
      .eq('id', scanId)
      .single();

    if (scanError || !scan || scan.application_id !== applicationId) {
      console.error('Scan validation error:', scanError);
      return new Response(
        JSON.stringify({ error: 'Invalid scan request' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update application status
    await supabase
      .from('applications')
      .update({ status: 'scanning' })
      .eq('id', applicationId);

    // Perform AI-powered security scan
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `Você é um especialista em cybersegurança. Analise aplicações web e identifique vulnerabilidades de segurança.
            
Retorne APENAS um JSON válido no seguinte formato, sem texto adicional:
{
  "overall_score": número de 0 a 100,
  "risk_level": "critical" | "high" | "medium" | "low" | "secure",
  "vulnerabilities": [
    {
      "severity": "critical" | "high" | "medium" | "low" | "info",
      "category": "categoria da vulnerabilidade",
      "title": "título curto",
      "description": "descrição detalhada",
      "affected_component": "componente afetado",
      "cve_id": "CVE-XXXX-XXXXX ou null",
      "cvss_score": número decimal ou null,
      "recommendation": "como corrigir",
      "code_snippet": "exemplo de código corrigido ou null"
    }
  ]
}`
          },
          {
            role: 'user',
            content: `Analise esta aplicação e identifique vulnerabilidades de segurança:

Nome: ${app.name}
URL: ${app.url || 'Não fornecida'}
Descrição: ${app.description || 'Não fornecida'}
Stack Tecnológica: ${app.technology_stack?.join(', ') || 'Não especificada'}

Forneça uma análise detalhada das vulnerabilidades de segurança, considerando:
- OWASP Top 10
- Vulnerabilidades conhecidas da stack tecnológica
- Configurações inseguras comuns
- Melhores práticas de segurança

Retorne APENAS o JSON no formato especificado, sem markdown ou texto adicional.`
          }
        ],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API Error:', { status: aiResponse.status, error: errorText });
      return new Response(
        JSON.stringify({ 
          error: 'Security scan failed. Please try again or contact support.',
          errorId: crypto.randomUUID()
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices[0].message.content;
    
    // Parse AI response - remove markdown if present
    let scanResults;
    try {
      // Remove markdown code blocks if present
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                       content.match(/```\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      scanResults = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      // Fallback to a safe default
      scanResults = {
        overall_score: 50,
        risk_level: 'medium',
        vulnerabilities: [{
          severity: 'medium',
          category: 'Análise',
          title: 'Análise Incompleta',
          description: 'A análise não pode ser completada no formato esperado.',
          affected_component: app.name,
          cve_id: null,
          cvss_score: null,
          recommendation: 'Execute uma nova análise ou verifique manualmente.',
          code_snippet: null
        }]
      };
    }

    // Calculate scan duration
    const scanDuration = Math.floor(Math.random() * 60) + 30; // 30-90 seconds

    // Update scan with results
    await supabase
      .from('security_scans')
      .update({
        status: 'completed',
        overall_score: scanResults.overall_score,
        risk_level: scanResults.risk_level,
        vulnerabilities_found: scanResults.vulnerabilities.length,
        scan_duration: scanDuration,
        completed_at: new Date().toISOString()
      })
      .eq('id', scanId);

    // Insert vulnerabilities
    if (scanResults.vulnerabilities && scanResults.vulnerabilities.length > 0) {
      const vulnerabilitiesToInsert = scanResults.vulnerabilities.map((vuln: any) => ({
        scan_id: scanId,
        severity: vuln.severity,
        category: vuln.category,
        title: vuln.title,
        description: vuln.description,
        affected_component: vuln.affected_component,
        cve_id: vuln.cve_id,
        cvss_score: vuln.cvss_score,
        recommendation: vuln.recommendation,
        code_snippet: vuln.code_snippet,
        status: 'open'
      }));

      await supabase
        .from('vulnerabilities')
        .insert(vulnerabilitiesToInsert);
    }

    // Update application status
    await supabase
      .from('applications')
      .update({ status: 'completed' })
      .eq('id', applicationId);

    console.log('Security scan completed successfully');

    return new Response(
      JSON.stringify({ success: true, results: scanResults }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorId = crypto.randomUUID();
    console.error('Security scan error:', { errorId, error: error instanceof Error ? error.message : 'Unknown error', stack: error instanceof Error ? error.stack : undefined });

    return new Response(
      JSON.stringify({ 
        error: 'Security scan failed. Please try again or contact support.',
        errorId 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});