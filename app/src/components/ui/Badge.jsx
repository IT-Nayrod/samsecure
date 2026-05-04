export default function Badge({ children, color = '#52C97A', bg, style = {} }) {
  const bgColor = bg || color + '20';
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '3px 8px',
      borderRadius: '20px',
      backgroundColor: bgColor,
      color: color,
      fontSize: '11px',
      fontWeight: '600',
      ...style,
    }}>
      {children}
    </span>
  );
}
