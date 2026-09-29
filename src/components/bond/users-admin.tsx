import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth/use-auth';
import { ROLE_LABELS, ROLE_ORDER, type AppRole } from '@/lib/auth/roles';
import { setUserActive } from '@/lib/admin-users.functions';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

type Row = { id: string; email: string | null; full_name: string | null; role: AppRole | null; created_at: string; last_sign_in_at: string | null; banned_until: string | null };
type Pending = { kind: 'role'; row: Row; role: AppRole } | { kind: 'active'; row: Row; active: boolean };
const FILTERS = [['todos', 'Todos'], ['admin', 'Administradores'], ['colaborador', 'Colaboradores'], ['funcionario', 'Funcionários'], ['cliente', 'Clientes'], ['ativos', 'Ativos'], ['inativos', 'Inativos']] as const;
const fmt = (d: string | null) => (d ? new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const isActive = (r: Row) => !r.banned_until || new Date(r.banned_until) < new Date();

export function UsersAdmin() {
  const { user, role } = useAuth();
  const qc = useQueryClient();
  const toggle = useServerFn(setUserActive);
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>('todos');
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const q = useQuery({ queryKey: ['admin-users'], enabled: role === 'admin', queryFn: async () => { const { data, error } = await supabase.rpc('admin_list_users'); if (error) throw error; return (data ?? []) as Row[]; } });
  const rows = useMemo(() => (q.data ?? []).filter(r => filter === 'todos' ? true : filter === 'ativos' ? isActive(r) : filter === 'inativos' ? !isActive(r) : r.role === filter), [q.data, filter]);

  if (role !== 'admin') return <div className="mt-9 rounded-md border border-border bg-card p-8 text-sm text-steel">Somente administradores podem gerenciar usuários.</div>;

  async function confirm() {
    if (!pending) return; setBusy(true);
    try {
      if (pending.kind === 'role') { const { error } = await supabase.rpc('admin_set_user_role', { _user_id: pending.row.id, _role: pending.role }); if (error) throw error; toast.success('Função atualizada.'); }
      else { await toggle({ data: { userId: pending.row.id, active: pending.active } }); toast.success(pending.active ? 'Usuário reativado.' : 'Usuário desativado.'); }
      await qc.invalidateQueries({ queryKey: ['admin-users'] });
    } catch { toast.error('Não foi possível concluir a alteração.'); } finally { setBusy(false); setPending(null); }
  }

  return (
    <div className="mt-9">
      <div className="flex flex-wrap gap-2">{FILTERS.map(([k, l]) => <Button key={k} size="sm" variant={filter === k ? 'default' : 'outline'} onClick={() => setFilter(k)}>{l}</Button>)}</div>
      <div className="mt-5 overflow-x-auto rounded-md border border-border bg-card">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="text-xs uppercase text-steel"><tr className="border-b border-border">{['Nome', 'E-mail', 'Função', 'Status', 'Cadastro', 'Último acesso', ''].map(h => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
          <tbody>
            {q.isLoading ? <tr><td colSpan={7} className="px-4 py-8 text-center text-steel">Carregando…</td></tr> : q.isError ? <tr><td colSpan={7} className="px-4 py-8 text-center text-destructive">Não foi possível carregar os usuários.</td></tr> : rows.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-steel">Nenhum usuário neste filtro.</td></tr> : rows.map(r => {
              const self = r.id === user?.id; const active = isActive(r);
              return <tr key={r.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-semibold">{r.full_name || '—'}{self ? <span className="ml-2 text-xs text-aqua">(você)</span> : null}</td>
                <td className="px-4 py-3 break-all text-steel">{r.email}</td>
                <td className="px-4 py-3"><select aria-label={`Função de ${r.email}`} disabled={self} value={r.role ?? 'cliente'} onChange={e => setPending({ kind: 'role', row: r, role: e.target.value as AppRole })} className="h-9 rounded-md border border-border bg-background px-2 disabled:opacity-60">{ROLE_ORDER.map(x => <option key={x} value={x}>{ROLE_LABELS[x]}</option>)}</select></td>
                <td className="px-4 py-3"><span className={active ? 'text-success' : 'text-destructive'}>{active ? 'Ativo' : 'Inativo'}</span></td>
                <td className="px-4 py-3 text-steel">{fmt(r.created_at)}</td>
                <td className="px-4 py-3 text-steel">{fmt(r.last_sign_in_at)}</td>
                <td className="px-4 py-3 text-right">{self ? null : <Button size="sm" variant="ghost" onClick={() => setPending({ kind: 'active', row: r, active: !active })}>{active ? 'Desativar' : 'Reativar'}</Button>}</td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-steel">Novos cadastros entram como Cliente. Sua própria função e acesso não podem ser alterados por aqui.</p>
      <AlertDialog open={!!pending} onOpenChange={o => { if (!o) setPending(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar alteração</AlertDialogTitle>
            <AlertDialogDescription>{pending?.kind === 'role' ? `Alterar a função de ${pending.row.full_name || pending.row.email} de ${ROLE_LABELS[pending.row.role ?? 'cliente']} para ${ROLE_LABELS[pending.role]}?` : pending ? `${pending.active ? 'Reativar' : 'Desativar'} o acesso de ${pending.row.full_name || pending.row.email}?` : ''}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={e => { e.preventDefault(); void confirm(); }}>{busy ? 'Salvando…' : 'Confirmar'}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
