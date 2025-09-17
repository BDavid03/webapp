import "./Expression.css";

export default function Expression({ value }) {
  return <div className="expression" title={value}>{value}</div>;
}

