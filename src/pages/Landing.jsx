import React from "react";
import { Link } from "react-router-dom";
import {
  Zap, MessageCircle, Bot, Users, DollarSign, FileSignature,
  BarChart3, Database, Send, ShieldCheck, ArrowRight, CheckCircle, Star
} from "lucide-react";

const features = [
  { icon: Zap, title: "Lembrete PIX", desc: "Envie lembretes automáticos de cobrança com código PIX para pagamento na hora, reduzindo a inadimplência.", color: "from-green-500 to-emerald-600" },
  { icon: Bot, title: "Atendimento com IA", desc: "Chatbot com inteligência artificial respondendo áudio e texto dos clientes 24/7, integrado ao sistema.", color: "from-purple-500 to-violet-600" },
  { icon: MessageCircle, title: "Atendimento Omnichannel", desc: "Organize atendimentos por setor, status, atendente e protocolo, com histórico salvo na nuvem.", color: "from-blue-500 to-blue-600" },
  { icon: Users, title: "CRM Integrado", desc: "Organize oportunidades em um único lugar e converse via WhatsApp com seus leads direto no CRM.", color: "from-indigo-500 to-blue-600" },
  { icon: BarChart3, title: "Relatório Gerencial", desc: "Monitore seu atendimento em tempo real e acompanhe as principais métricas do provedor.", color: "from-amber-500 to-orange-600" },
  { icon: Database, title: "Integração com ERP", desc: "Integre com IXC Provedor e outros ERPs para boleto, PIX, desbloqueio, contrato e dados do cliente.", color: "from-teal-500 to-cyan-600" },
  { icon: FileSignature, title: "Assinatura Eletrônica", desc: "Envie contratos, termos e aceites eletrônicos direto pelo atendimento via ZapSign.", color: "from-rose-500 to-pink-600" },
  { icon: DollarSign, title: "Segunda via pelo WhatsApp", desc: "Permita que o cliente solicite boleto e PIX automaticamente pelo WhatsApp.", color: "from-green-600 to-teal-600" },
  { icon: ShieldCheck, title: "Desbloqueio pelo WhatsApp", desc: "Automatize o desbloqueio de confiança com validação financeira integrada.", color: "from-blue-600 to-indigo-600" },
  { icon: Send, title: "Disparos WhatsApp", desc: "Envie campanhas, avisos, promoções, cobranças e comunicados para a base de clientes.", color: "from-violet-500 to-purple-600" },
];

const plans = [
  { name: "Starter", price: "R$ 297", period: "/mês", features: ["1 atendente", "WhatsApp + 1 canal", "CRM básico", "Dashboard", "Suporte por e-mail"], highlight: false },
  { name: "Professional", price: "R$ 597", period: "/mês", features: ["5 atendentes", "Todos os canais", "IA 24/7 + Chatbot", "CRM completo", "Cobrança PIX automática", "Integração IXC", "Relatórios avançados"], highlight: true },
  { name: "Enterprise", price: "R$ 1.297", period: "/mês", features: ["Atendentes ilimitados", "Todos os recursos", "IA personalizada", "Multi-empresa", "API completa", "Gerente dedicado", "Suporte prioritário 24/7"], highlight: false },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <svg width="22" height="16" viewBox="0 0 24 18" fill="none">
                <path d="M2 9 C2 4.6 5.6 1 10 1" stroke="#FE6915" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
                <path d="M4.5 9 C4.5 6 6.9 3.5 10 3.5" stroke="#FE6915" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
                <path d="M7 9 C7 7.3 8.3 6 10 6" stroke="#FE6915" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
                <circle cx="10" cy="9" r="1.5" fill="#FE6915"/>
              </svg>
            </div>
            <div>
              <p className="font-black text-base leading-tight tracking-wide text-primary">WOOW</p>
              <p className="text-xs text-accent font-semibold tracking-widest leading-tight">CHAT</p>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <a href="#features" className="text-muted-foreground hover:text-foreground">Recursos</a>
            <a href="#plans" className="text-muted-foreground hover:text-foreground">Planos</a>
            <Link to="/login" className="text-muted-foreground hover:text-foreground">Entrar</Link>
            <Link to="/dashboard" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">Acessar Plataforma</Link>
          </nav>
          <Link to="/dashboard" className="md:hidden px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm">Acessar</Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-background to-green-50" />
        <div className="relative max-w-7xl mx-auto px-6 py-20 md:py-28 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-medium mb-6">
            <Star className="w-4 h-4" fill="currentColor" /> Plataforma oficial WOOW Chat
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold font-heading leading-tight mb-6 max-w-4xl mx-auto">
            Atendimento omnichannel completo para{" "}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">WOOW Chat</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-10">
            Centralize seus canais, automatize cobranças, responda com IA 24/7 e acompanhe todos os indicadores do seu provedor em tempo real.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/dashboard" className="flex items-center justify-center gap-2 px-8 py-3.5 bg-primary text-primary-foreground rounded-xl font-semibold text-lg hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
              Solicitar Demonstração <ArrowRight className="w-5 h-5" />
            </Link>
            <a href="#features" className="flex items-center justify-center gap-2 px-8 py-3.5 border-2 border-border rounded-xl font-semibold text-lg hover:bg-muted transition-colors">
              Conhecer Funcionalidades
            </a>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16 max-w-3xl mx-auto">
            {[
              { value: "+500", label: "Provedores" },
              { value: "+2M", label: "Atendimentos/mês" },
              { value: "87%", label: "SLA Cumprido" },
              { value: "78", label: "NPS Médio" },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-3xl md:text-4xl font-bold text-primary">{stat.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 max-w-7xl mx-auto px-6">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold font-heading mb-4">Tudo que seu provedor precisa</h2>
          <p className="text-lg text-muted-foreground">Uma plataforma completa para gestão de atendimento, vendas e cobrança</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="bg-card border border-border rounded-2xl p-6 hover:shadow-lg hover:-translate-y-1 transition-all">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-4`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-bold text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Plans */}
      <section id="plans" className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold font-heading mb-4">Planos para todo porte</h2>
            <p className="text-lg text-muted-foreground">Escolha o plano ideal para o seu provedor</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <div key={plan.name} className={`bg-card rounded-2xl border-2 p-8 ${plan.highlight ? "border-primary shadow-xl shadow-primary/10 scale-105" : "border-border"}`}>
                {plan.highlight && (
                  <span className="inline-block px-3 py-1 bg-primary text-primary-foreground rounded-full text-xs font-bold mb-4">MAIS POPULAR</span>
                )}
                <h3 className="font-bold text-xl mb-2">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/dashboard" className={`block text-center py-3 rounded-xl font-semibold transition-colors ${plan.highlight ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border border-border hover:bg-muted"}`}>
                  Começar Agora
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 max-w-4xl mx-auto px-6 text-center">
        <h2 className="text-3xl md:text-4xl font-bold font-heading mb-4">Pronto para transformar seu provedor?</h2>
        <p className="text-lg text-muted-foreground mb-8">Comece hoje mesmo e veja a diferença na gestão do seu atendimento</p>
        <Link to="/dashboard" className="inline-flex items-center gap-2 px-8 py-3.5 bg-primary text-primary-foreground rounded-xl font-semibold text-lg hover:bg-primary/90 shadow-lg shadow-primary/20">
          Acessar Plataforma <ArrowRight className="w-5 h-5" />
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <svg width="16" height="12" viewBox="0 0 24 18" fill="none">
                <path d="M2 9 C2 4.6 5.6 1 10 1" stroke="#FE6915" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
                <path d="M4.5 9 C4.5 6 6.9 3.5 10 3.5" stroke="#FE6915" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
                <circle cx="10" cy="9" r="1.5" fill="#FE6915"/>
              </svg>
            </div>
            <span className="font-black text-sm tracking-wide text-primary">WOOW <span className="text-accent font-semibold text-xs tracking-widest">CHAT</span></span>
          </div>
          <p className="text-sm text-muted-foreground">© 2026 WOOW Chat. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}