import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { auth as supabaseAuth } from "@/api/supabaseData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  UserPlus, Mail, Lock, Loader2, Building2, User, Phone,
  ArrowRight, ArrowLeft, Check, CheckCircle2,
} from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

const currency = (v) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function onlyDigits(s) {
  return (s || "").replace(/\D/g, "");
}

export default function Register() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  // Dados da conta / empresa
  const [fullName, setFullName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [orgCnpj, setOrgCnpj] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Planos
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [loadingPlans, setLoadingPlans] = useState(true);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("plans")
        .select("*")
        .eq("is_active", true)
        .order("price_monthly", { ascending: true });
      const list = data || [];
      setPlans(list);
      // Pré-seleciona o primeiro plano pago, senão o trial.
      const preferred = list.find((p) => p.slug === "starter") || list[0];
      if (preferred) setSelectedPlan(preferred.slug);
      setLoadingPlans(false);
    })();
  }, []);

  const validateStep1 = () => {
    if (!fullName.trim()) return "Informe seu nome completo.";
    if (!orgName.trim()) return "Informe o nome da empresa.";
    if (!email.trim()) return "Informe um e-mail valido.";
    if (password.length < 8) return "A senha deve ter ao menos 8 caracteres.";
    if (password !== confirmPassword) return "As senhas nao conferem.";
    return "";
  };

  const goToPlans = (e) => {
    e.preventDefault();
    const msg = validateStep1();
    if (msg) {
      setError(msg);
      return;
    }
    setError("");
    setStep(2);
  };

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      const { data } = await supabaseAuth.register({
        email: email.trim(),
        password,
        full_name: fullName.trim(),
        phone: onlyDigits(phone),
        org_name: orgName.trim(),
        org_cnpj: onlyDigits(orgCnpj),
        org_phone: onlyDigits(phone),
        plan_slug: selectedPlan || "trial",
      });

      // Se a sessao ja veio (confirmacao de e-mail desativada), entra direto.
      if (data?.session) {
        navigate("/dashboard", { replace: true });
      } else {
        setDone(true);
      }
    } catch (err) {
      const msg = err?.message || "";
      if (/already registered|already been registered|user already/i.test(msg)) {
        setError("Este e-mail ja esta cadastrado. Tente entrar.");
      } else {
        setError(msg || "Nao foi possivel concluir o cadastro.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Tela de confirmacao (quando exige verificacao de e-mail).
  if (done) {
    return (
      <AuthLayout
        icon={CheckCircle2}
        title="Confirme seu e-mail"
        subtitle={`Enviamos um link de confirmacao para ${email}`}
        footer={
          <Link to="/login" className="text-primary font-medium hover:underline">
            Ir para o login
          </Link>
        }
      >
        <p className="text-sm text-foreground text-center text-pretty">
          Abra o e-mail que enviamos e clique no link para ativar sua conta.
          Depois e so fazer login para comecar a usar o WOOWFLOW.
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={step === 1 ? UserPlus : Building2}
      title={step === 1 ? "Crie sua conta" : "Escolha seu plano"}
      subtitle={
        step === 1
          ? "Comece seu teste gratuito de 14 dias"
          : "Voce pode mudar de plano quando quiser"
      }
      footer={
        step === 1 ? (
          <>
            Ja tem uma conta?{" "}
            <Link to="/login" className="text-primary font-medium hover:underline">
              Entrar
            </Link>
          </>
        ) : null
      }
    >
      {/* Indicador de etapas */}
      <div className="flex items-center justify-center gap-2 mb-6" aria-hidden="true">
        <span className={`h-2 w-8 rounded-full ${step >= 1 ? "bg-primary" : "bg-muted"}`} />
        <span className={`h-2 w-8 rounded-full ${step >= 2 ? "bg-primary" : "bg-muted"}`} />
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm" role="alert">
          {error}
        </div>
      )}

      {step === 1 && (
        <form onSubmit={goToPlans} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Seu nome</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input id="fullName" autoFocus placeholder="Ex.: Maria Silva" value={fullName}
                onChange={(e) => setFullName(e.target.value)} className="pl-10 h-12" required />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="orgName">Empresa</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                <Input id="orgName" placeholder="Nome da empresa" value={orgName}
                  onChange={(e) => setOrgName(e.target.value)} className="pl-10 h-12" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                <Input id="phone" placeholder="(11) 90000-0000" value={phone}
                  onChange={(e) => setPhone(e.target.value)} className="pl-10 h-12" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-mail corporativo</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input id="email" type="email" autoComplete="email" placeholder="voce@empresa.com.br"
                value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 h-12" required />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                <Input id="password" type="password" autoComplete="new-password" placeholder="Min. 8 caracteres"
                  value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 h-12" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirmar senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                <Input id="confirm" type="password" autoComplete="new-password" placeholder="Repita a senha"
                  value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pl-10 h-12" required />
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full h-12 font-medium">
            Continuar
            <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
          </Button>
        </form>
      )}

      {step === 2 && (
        <div className="space-y-4">
          {loadingPlans ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-3">
              {plans.map((plan) => {
                const active = selectedPlan === plan.slug;
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setSelectedPlan(plan.slug)}
                    aria-pressed={active}
                    className={`w-full text-left rounded-xl border p-4 transition-colors ${
                      active ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{plan.name}</span>
                          {active && <Check className="w-4 h-4 text-primary" aria-hidden="true" />}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Ate {plan.max_users} usuarios | {plan.max_instances} inst. WhatsApp
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-foreground">
                          {plan.price_monthly > 0 ? currency(plan.price_monthly) : "Gratis"}
                        </div>
                        {plan.price_monthly > 0 && (
                          <div className="text-xs text-muted-foreground">/mes</div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center text-pretty">
            Todos os planos comecam com 14 dias de teste gratuito. Sem cobranca agora.
          </p>

          <div className="flex gap-3">
            <Button type="button" variant="outline" className="h-12" onClick={() => { setError(""); setStep(1); }}>
              <ArrowLeft className="w-4 h-4 mr-2" aria-hidden="true" />
              Voltar
            </Button>
            <Button type="button" className="flex-1 h-12 font-medium" onClick={handleSubmit} disabled={loading || !selectedPlan}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Criando conta...
                </>
              ) : (
                "Criar conta e comecar"
              )}
            </Button>
          </div>
        </div>
      )}
    </AuthLayout>
  );
}
