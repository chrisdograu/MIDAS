import { useCallback, useRef, useState } from 'react';

/**
 * Previne cliques duplos/múltiplos em qualquer formulário.
 * Uso:
 *   const { submitting, guard } = useSubmitGuard();
 *   <Button disabled={submitting} onClick={guard(async () => { ... })}>
 */
export function useSubmitGuard() {
  const [submitting, setSubmitting] = useState(false);
  const lock = useRef(false);

  const guard = useCallback(<T extends any[]>(fn: (...args: T) => any | Promise<any>) => {
    return async (...args: T) => {
      if (lock.current) return;
      lock.current = true;
      setSubmitting(true);
      try {
        return await fn(...args);
      } finally {
        lock.current = false;
        setSubmitting(false);
      }
    };
  }, []);

  return { submitting, guard };
}
