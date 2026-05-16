import type { InstallPlan } from '../../../main/installer/plan'
import { getInstallerTaskLabel } from '../../../shared/task-labels'

interface PlanViewProps {
  plan: InstallPlan
  onStart?: () => void
}

export function PlanView({ plan, onStart }: PlanViewProps) {
  return (
    <section
      style={{
        minHeight: '100vh',
        padding: '36px',
        background: '#06101b',
        color: '#eff6ff'
      }}
    >
      <div style={{ maxWidth: '960px', margin: '0 auto', display: 'grid', gap: '20px' }}>
        <header style={{ display: 'grid', gap: '8px' }}>
          <p style={{ margin: 0, color: '#7dd3fc', textTransform: 'uppercase' }}>安装计划</p>
          <h1 style={{ margin: 0 }}>{plan.summary}</h1>
        </header>

        <div
          style={{
            borderRadius: '24px',
            border: '1px solid rgba(148, 163, 184, 0.18)',
            background: 'rgba(15, 23, 42, 0.8)',
            padding: '24px'
          }}
        >
          <ol style={{ margin: 0, paddingLeft: '20px', display: 'grid', gap: '12px' }}>
            {plan.tasks.map((task) => (
              <li key={task}>{getInstallerTaskLabel(task)}</li>
            ))}
          </ol>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onStart}
            style={{
              borderRadius: '999px',
              border: 'none',
              padding: '12px 18px',
              background: 'linear-gradient(135deg, #38bdf8, #2563eb)',
              color: '#eff6ff'
            }}
          >
            开始安装
          </button>
        </div>
      </div>
    </section>
  )
}
