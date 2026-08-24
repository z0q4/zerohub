import {
  useCallback,
  useRef,
  useState,
} from 'react';

import type {
  Dispatch,
  SetStateAction,
} from 'react';

export function useScopedWorkspaceState<T>(
  scopeId: string,
  initialValue: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [values, setValues] = useState<
    Record<string, T>
  >({});
  const initialValueRef =
    useRef(initialValue);
  const hasValue = Object.prototype
    .hasOwnProperty.call(
      values,
      scopeId,
    );
  const value = hasValue
    ? values[scopeId]
    : initialValueRef.current;
  const setValue = useCallback<
    Dispatch<SetStateAction<T>>
  >(
    (update) => {
      setValues((current) => {
        const currentValue =
          Object.prototype
            .hasOwnProperty.call(
              current,
              scopeId,
            )
            ? current[scopeId]
            : initialValueRef.current;
        const nextValue =
          typeof update === 'function'
            ? (
              update as (
                previous: T,
              ) => T
            )(currentValue)
            : update;

        if (
          Object.is(
            currentValue,
            nextValue,
          )
        ) {
          return current;
        }

        return {
          ...current,
          [scopeId]: nextValue,
        };
      });
    },
    [scopeId],
  );

  return [value, setValue];
}
