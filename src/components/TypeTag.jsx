export default function TypeTag({ name, accent, bg }) {
  return (
    <span className="type-tag" style={{ color: accent, background: bg }}>
      {name}
    </span>
  );
}
