import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, MailCheck, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/bond/field';
import { useAuth } from '@/lib/auth/use-auth';
import { signInWithEmail, signUpWithEmail, signInWithGoogle, requestPasswordReset, updatePasswordFromRecovery, resendConfirmation } from '@/lib/auth/auth-service';
import { isStaffRole } from '@/lib/auth/roles';
import { supabase } from '@/integrations/supabase/client';
import { ThemeToggle } from '@/lib/theme';
import industrial from '@/assets/bondmann-industrial.jpg';

type Mode = 'login' | 'signup' | 'forgot' | 'reset' | 'confirm';

function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      <div className="flex flex-col px-5 py-6 sm:px-10 lg:px-16">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-display font-bold"><img src="/icons/icon-192.png" alt="" className="size-9 rounded-md" />Bondmann Commercial Hub</Link>
          <ThemeToggle />
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-14">{children}</div>
      </div>
      <div className="relative hidden lg:block">
        <img src={industrial} alt="Instalação industrial ilustrativa" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-linear-to-t from-slateink to-transparent" />
        <div className="absolute bottom-16 left-12 right-12 text-primary-foreground">
          <p className="text-xs font-bold uppercase">Bondmann Commercial Hub</p>
          <p className="mt-4 max-w-lg font-display text-3xl font-bold">Soluções, pessoas e oportunidades em conexão.</p>
        </div>
      </div>
    </div>
  );
}

function Heading({ title, text }: { title: string; text: string }) {
  return <><p className="text-xs font-bold uppercase text-aqua">Bondmann / Acesso</p><h1 className="mt-3 text-3xl font-bold sm:text-4xl">{title}</h1><p className="mt-3 text-steel">{text}</p></>;
}

function PasswordInput({ id, value, onChange, autoComplete, minLength }: { id: string; value: string; onChange: (v: string) => void; autoComplete: string; minLength?: number }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input id={id} type={show ? 'text' : 'password'} required minLength={minLength} autoComplete={autoComplete} value={value} onChange={e => onChange(e.target.value)} className="pr-12" />
      <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? 'Ocultar senha' : 'Mostrar senha'} className="absolute right-3 top-1/2 -translate-y-1/2 text-steel hover:text-foreground">{show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
    </div>
  );
}

function Requirements({ password }: { password: string }) {
  const rules = [[password.length >= 8, 'Pelo menos 8 caracteres'], [/[A-Za-z]/.test(password) && /\d/.test(password), 'Letras e números (recomendado)']] as const;
  return <ul className="space-y-1 text-xs">{rules.map(([ok, t]) => <li key={t} className={ok ? 'text-success' : 'text-steel'}>{ok ? '✓' : '•'} {t}</li>)}</ul>;
}

function Result({ icon, title, text, children }: { icon: ReactNode; title: string; text: ReactNode; children?: ReactNode }) {
  return <div className="text-center"><div className="mx-auto grid size-16 place-items-center rounded-full bg-secondary text-aqua">{icon}</div><h1 className="mt-6 text-3xl font-bold">{title}</h1><div className="mt-3 text-steel">{text}</div><div className="mt-8 space-y-3">{children}</div></div>;
}

export function AuthPage({ mode }: { mode: Mode }) {
  const navigate = useNavigate();
  const { session, role, loading: authLoading } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [recovery, setRecovery] = useState<'checking' | 'valid' | 'invalid'>('checking');
  const [confirmState, setConfirmState] = useState<'checking' | 'ok' | 'error'>('checking');

  // Recuperação: só com link válido (evento PASSWORD_RECOVERY ou token na URL).
  useEffect(() => {
    if (mode !== 'reset') return;
    const url = window.location.hash + window.location.search;
    if (/error/.test(url)) { setRecovery('invalid'); return; }
    const hasToken = url.includes('type=recovery');
    const { data } = supabase.auth.onAuthStateChange(ev => { if (ev === 'PASSWORD_RECOVERY') setRecovery('valid'); });
    const t = setTimeout(() => { void supabase.auth.getSession().then(({ data: s }) => setRecovery(r => r === 'valid' ? r : hasToken && s.session ? 'valid' : 'invalid')); }, 1200);
    return () => { clearTimeout(t); data.subscription.unsubscribe(); };
  }, [mode]);

  // Confirmação de e-mail: o link retorna com sessão ou com erro.
  useEffect(() => {
    if (mode !== 'confirm') return;
    const url = window.location.hash + window.location.search;
    if (/error/.test(url)) { setConfirmState('error'); return; }
    const t = setTimeout(() => { void supabase.auth.getSession().then(({ data }) => setConfirmState(data.session ? 'ok' : url.includes('access_token') || url.includes('code=') ? 'ok' : 'error')); }, 1000);
    return () => clearTimeout(t);
  }, [mode]);

  useEffect(() => {
    if (!authLoading && session && (mode === 'login' || mode === 'signup')) void navigate({ to: isStaffRole(role) ? '/painel' : '/cliente', replace: true });
  }, [authLoading, session, role, mode, navigate]);

  async function submit(e: FormEvent) {
    e.preventDefault(); setError(''); setNotice('');
    if ((mode === 'signup' || mode === 'reset') && password !== confirm) { setError('As senhas não coincidem.'); return; }
    if ((mode === 'signup' || mode === 'reset') && password.length < 8) { setError('Use pelo menos 8 caracteres na senha.'); return; }
    setBusy(true);
    try {
      if (mode === 'login') { const r = await signInWithEmail(email, password, remember); if (!r.ok) setError(r.error ?? 'Não foi possível concluir o login. Tente novamente.'); }
      if (mode === 'signup') { const r = await signUpWithEmail({ email, password, fullName: name }); if (!r.ok) setError(r.error ?? 'Não foi possível cadastrar.'); else if (r.needsConfirmation) setSentTo(email.trim()); }
      if (mode === 'forgot') { const r = await requestPasswordReset(email); if (!r.ok) setError(r.error ?? 'Não foi possível enviar.'); else setSentTo(email.trim()); }
      if (mode === 'reset') { const r = await updatePasswordFromRecovery(password); if (!r.ok) setError(r.error ?? 'Não foi possível redefinir.'); else { await supabase.auth.signOut(); setDone(true); } }
    } catch { setError('Não foi possível concluir a operação. Tente novamente.'); } finally { setBusy(false); }
  }

  async function resend() {
    if (!sentTo) return; setBusy(true); setError(''); setNotice('');
    const r = mode === 'forgot' ? await requestPasswordReset(sentTo) : await resendConfirmation(sentTo);
    setBusy(false); if (r.ok) setNotice('E-mail reenviado.'); else setError(r.error ?? 'Não foi possível reenviar.');
  }

  const toLogin = <Button asChild block><Link to="/login">Voltar para o login <ArrowRight /></Link></Button>;
  const msgs = <>{error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}{notice ? <p role="status" className="text-sm text-success">{notice}</p> : null}</>;

  if (mode === 'confirm') return <Layout>{confirmState === 'checking' ? <p className="text-center text-steel">Confirmando seu e-mail…</p> : confirmState === 'ok' ? <Result icon={<CheckCircle2 className="size-8" />} title="E-mail confirmado!" text="Seu cadastro foi confirmado com sucesso."><Button asChild block><Link to="/login">Entrar no Bondmann Commercial Hub <ArrowRight /></Link></Button></Result> : <Result icon={<AlertTriangle className="size-8" />} title="Link inválido ou expirado" text="Não foi possível confirmar seu e-mail com este link. Tente entrar ou solicite um novo cadastro.">{toLogin}</Result>}</Layout>;

  if (sentTo) return <Layout><Result icon={<MailCheck className="size-8" />} title={mode === 'forgot' ? 'Verifique seu e-mail' : 'Confirme seu e-mail'} text={<>{mode === 'forgot' ? 'Se houver uma conta com este endereço, enviamos um link para criar uma nova senha:' : 'Enviamos um link de confirmação para seu e-mail:'}<p className="mt-2 break-all font-bold text-foreground">{sentTo}</p>{mode === 'signup' ? <p className="mt-3 text-sm">É necessário confirmar o e-mail antes de entrar.</p> : null}</>}>{msgs}<Button variant="outline" block disabled={busy} onClick={() => void resend()}>{busy ? 'Enviando…' : 'Reenviar e-mail'}</Button>{toLogin}</Result></Layout>;

  if (mode === 'reset') {
    if (done) return <Layout><Result icon={<CheckCircle2 className="size-8" />} title="Senha alterada com sucesso." text="Use sua nova senha para entrar.">{toLogin}</Result></Layout>;
    if (recovery === 'checking') return <Layout><p className="text-center text-steel">Validando seu link…</p></Layout>;
    if (recovery === 'invalid') return <Layout><Result icon={<AlertTriangle className="size-8" />} title="Link inválido ou expirado" text="Para redefinir a senha, abra o link mais recente enviado ao seu e-mail ou solicite um novo."><Button asChild block><Link to="/recuperar-senha">Solicitar novo link</Link></Button><Button asChild variant="outline" block><Link to="/login">Voltar para o login</Link></Button></Result></Layout>;
  }

  const head = { login: ['Bem-vindo de volta.', 'Acesse o Bondmann Commercial Hub com segurança.'], signup: ['Crie sua conta.', 'Seu cadastro inicia como cliente.'], forgot: ['Esqueci minha senha', 'Informe seu e-mail e enviaremos um link para criar uma nova senha.'], reset: ['Redefinir senha', 'Escolha uma nova senha para sua conta.'] }[mode];

  return (
    <Layout>
      {mode !== 'login' ? <Link to="/login" className="mb-9 inline-flex items-center gap-2 text-sm text-steel"><ArrowLeft className="size-4" />Voltar para o login</Link> : <Link to="/" className="mb-9 inline-flex items-center gap-2 text-sm text-steel"><ArrowLeft className="size-4" />Voltar ao site</Link>}
      <Heading title={head[0]} text={head[1]} />
      <form onSubmit={e => void submit(e)} className="mt-9 space-y-4">
        {mode === 'signup' ? <Field label="Nome completo" htmlFor="name"><Input id="name" required autoComplete="name" value={name} onChange={e => setName(e.target.value)} /></Field> : null}
        {mode !== 'reset' ? <Field label="E-mail" htmlFor="email"><Input id="email" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></Field> : null}
        {mode !== 'forgot' ? <Field label={mode === 'reset' ? 'Nova senha' : 'Senha'} htmlFor="password"><PasswordInput id="password" value={password} onChange={setPassword} minLength={mode === 'login' ? 1 : 8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></Field> : null}
        {mode === 'signup' || mode === 'reset' ? <><Field label={mode === 'reset' ? 'Confirmar nova senha' : 'Confirme a senha'} htmlFor="confirm"><PasswordInput id="confirm" value={confirm} onChange={setConfirm} minLength={8} autoComplete="new-password" /></Field><Requirements password={password} /></> : null}
        {mode === 'login' ? <div className="flex items-center justify-between text-sm"><label className="flex items-center gap-2 text-steel"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} className="size-4 accent-[var(--aqua)]" />Lembrar sessão</label><Link to="/recuperar-senha" className="font-semibold text-aqua">Esqueci minha senha</Link></div> : null}
        {msgs}
        <Button type="submit" block disabled={busy}>{busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : mode === 'signup' ? 'Criar conta' : mode === 'forgot' ? 'Enviar link' : 'Salvar nova senha'}<ArrowRight /></Button>
      </form>
      {mode === 'login' || mode === 'signup' ? <><div className="my-6 flex items-center gap-4 text-xs text-steel"><span className="h-px flex-1 bg-border" />ou<span className="h-px flex-1 bg-border" /></div><Button variant="outline" block disabled={busy} onClick={async () => { setBusy(true); setError(''); try { const r = await signInWithGoogle(); if (!r.ok) setError(r.error ?? 'Não foi possível entrar com o Google.'); } catch { setError('Não foi possível entrar com o Google.'); } finally { setBusy(false); } }}>Entrar com Google</Button></> : null}
      {mode === 'login' || mode === 'signup' ? <p className="mt-8 text-center text-sm text-steel">{mode === 'login' ? <>Ainda não tem conta? <Link to="/cadastro" className="font-bold text-aqua">Criar conta</Link></> : <>Já tem uma conta? <Link to="/login" className="font-bold text-aqua">Entrar</Link></>}</p> : null}
    </Layout>
  );
}
