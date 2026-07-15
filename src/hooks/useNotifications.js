import { useContext } from 'react';
import { NotifContext } from '../context/NotifContext';

export default function useNotifications() {
  return useContext(NotifContext);
}
