import { lazy, Suspense, useEffect, type ComponentType } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { TodayPage } from '@/features/dashboard/TodayPage';
import { useFinanceStore } from '@/features/finance/store';
import { useApplyTheme } from '@/features/settings/themeStore';
import { useAuthStore } from '@/features/sync/authStore';
import { LoginScreen } from '@/features/sync/LoginScreen';
import { Logo } from '@/components/layout/Logo';

/** Carrega a página sob demanda, para o gráfico e o resto não pesarem na tela inicial. */
function page<K extends string>(loader: () => Promise<Record<K, ComponentType>>, name: K) {
  return lazy(() => loader().then((m) => ({ default: m[name] })));
}

const FinanceOverviewPage = page(() => import('@/features/finance/pages/FinanceOverviewPage'), 'FinanceOverviewPage');
const TransactionsPage = page(() => import('@/features/finance/pages/TransactionsPage'), 'TransactionsPage');
const AccountsPage = page(() => import('@/features/finance/pages/AccountsPage'), 'AccountsPage');
const TasksPage = page(() => import('@/features/personal/tasks/TasksPage'), 'TasksPage');
const WeekPlanPage = page(() => import('@/features/personal/tasks/WeekPlanPage'), 'WeekPlanPage');
const GoalsPage = page(() => import('@/features/personal/goals/GoalsPage'), 'GoalsPage');
const HabitsPage = page(() => import('@/features/personal/habits/HabitsPage'), 'HabitsPage');
const TrainingPage = page(() => import('@/features/personal/training/TrainingPage'), 'TrainingPage');
const WorkoutScreen = page(() => import('@/features/personal/training/WorkoutScreen'), 'WorkoutScreen');
const ReviewPage = page(() => import('@/features/review/ReviewPage'), 'ReviewPage');
const SettingsPage = page(() => import('@/features/settings/SettingsPage'), 'SettingsPage');

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg" aria-label="Carregando">
      <Logo />
    </div>
  );
}

/** O Modo Painel é outra entrada (painel.html, com manifest próprio): sai do app para ela. */
function ToPanel() {
  useEffect(() => {
    window.location.replace('/painel.html');
  }, []);
  return <Splash />;
}

export function App() {
  useApplyTheme();
  const phase = useAuthStore((s) => s.phase);
  const check = useAuthStore((s) => s.check);

  useEffect(() => {
    void check();
  }, [check]);

  // Gera os lançamentos recorrentes que venceram desde a última visita.
  const syncRecurring = useFinanceStore((s) => s.syncRecurring);
  useEffect(() => {
    syncRecurring();
  }, [syncRecurring]);

  if (phase === 'checking') return <Splash />;
  if (phase === 'locked') return <LoginScreen />;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="painel" element={<ToPanel />} />
        {/* Modo "no treino": tela cheia, fora do layout com menu. */}
        <Route
          path="treino"
          element={
            <Suspense fallback={<Splash />}>
              <WorkoutScreen />
            </Suspense>
          }
        />
        <Route element={<AppLayout />}>
          <Route index element={<TodayPage />} />
          <Route path="finance" element={<FinanceOverviewPage />} />
          <Route path="finance/transactions" element={<TransactionsPage />} />
          <Route path="finance/accounts" element={<AccountsPage />} />
          <Route path="personal/tasks" element={<TasksPage />} />
          <Route path="personal/week" element={<WeekPlanPage />} />
          <Route path="personal/goals" element={<GoalsPage />} />
          <Route path="personal/habits" element={<HabitsPage />} />
          <Route path="personal/training" element={<TrainingPage />} />
          <Route path="review" element={<ReviewPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
