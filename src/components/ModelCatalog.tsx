import type { Plan } from "../types";

export default function ModelCatalog({ plan }: { plan: Plan }) {
  return (
    <div className="panel catalog-panel">
      <div className="heading">
        <div>
          <p>型号清单</p>
          <h2>口径 · 角度 · 安全距离 · 持续时间</h2>
        </div>
      </div>
      <div className="catalog-grid">
        {plan.models.map((m) => (
          <article key={m.id} className="model-card">
            <header>
              <b>{m.name}</b>
              <span className="cat">{m.category}</span>
            </header>
            <dl>
              <div>
                <dt>口径</dt>
                <dd>{m.caliber}mm</dd>
              </div>
              <div>
                <dt>标称角度</dt>
                <dd>{m.angleNominal}°</dd>
              </div>
              <div>
                <dt>安全距离</dt>
                <dd>{m.safetyDistance}m</dd>
              </div>
              <div>
                <dt>持续时间</dt>
                <dd>{m.duration}s</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </div>
  );
}
