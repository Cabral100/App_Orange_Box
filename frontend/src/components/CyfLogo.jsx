export default function CyfLogo({ compact = false, inverse = false }) {
  return (
    <div className={`cyf-logo ${compact ? "compact" : ""} ${inverse ? "inverse" : ""}`} aria-label="CYF — Clean Your Farm">
      <div>
        <strong>CYF</strong>
        <span>Clean Your Farm</span>
      </div>
    </div>
  );
}
