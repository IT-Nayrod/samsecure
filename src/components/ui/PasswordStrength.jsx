// PasswordStrength - Section 8 Specs UX v0.5
function getStrength(pwd) {
  if (!pwd) return null;
  const hasUpper = /[A-Z]/.test(pwd);
  const hasLower = /[a-z]/.test(pwd);
  const hasDigit = /[0-9]/.test(pwd);
  const hasSpecial = /[^A-Za-z0-9]/.test(pwd);
  if (pwd.length < 8 || !hasUpper || !hasDigit) return 'faible';
  if (pwd.length >= 10 && hasUpper && hasLower && hasDigit && hasSpecial) return 'fort';
  return 'moyen';
}

const map = {
  faible: { label: 'Faible', bar: 'w-1/3 bg-red-500' },
  moyen: { label: 'Moyen', bar: 'w-2/3 bg-orange-400' },
  fort: { label: 'Fort', bar: 'w-full bg-green-500' },
};

export default function PasswordStrength({ password }) {
  const strength = getStrength(password);
  if (!strength) return null;
  const { label, bar } = map[strength];
  return (
    <div className="flex flex-col gap-1">
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
        <div className={`${bar} h-1.5 rounded-full transition-all duration-300`} />
      </div>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
