import React from 'react';
import { CheckIcon } from './Icons.jsx';

export function Toast({ message, isVisible }) {
  if (!isVisible) return null;

  return (
    <div className="toast-notification-pill">
      <CheckIcon size={16} className="toast-check-icon" />
      <span>{message}</span>
    </div>
  );
}
