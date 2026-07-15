import { useState } from 'react';

export default function useLocalStorage(key, initialValue) {
  const [stored, setStored] = useState(() => {
    try {
      const item = localStorage.getItem(key);
      return item !== null ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      const v = value instanceof Function ? value(stored) : value;
      setStored(v);
      localStorage.setItem(key, JSON.stringify(v));
    } catch { /* ignore */ }
  };

  return [stored, setValue];
}
