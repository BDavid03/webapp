import "./History.css";

export default function History({ items }) {
  if (!items?.length) return null;
  return (
    <div className="history">
      <div className="history-title">Recent</div>
      <ul className="history-list">
        {items.slice(0, 5).map((line, idx) => (
          <li key={idx} className="history-item">{line}</li>
        ))}
      </ul>
    </div>
  );
}

