export default function Card({ children, style = {}, className = '' }) {
  return (
    <div
      className={className}
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #EAECF0',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        padding: '16px',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
