import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import type {
  CaseActivityCreateInput,
} from '../../../shared/cases/cases.types';

import {
  useCaseWorkspace,
} from './CaseWorkspaceContext';

type ResultActivityInput =
  Omit<
    CaseActivityCreateInput,
    'caseId'
  >;

type RegisteredCase = {
  id: string;
  name: string;
};

type UseCaseResultRegistrationOptions = {
  errorMessage?: string;
  missingCaseMessage?: string;
};

export function useCaseResultRegistration({
  errorMessage =
    'Não foi possível registrar o resultado no perfil.',
  missingCaseMessage =
    'Selecione um perfil ativo antes de registrar o resultado.',
}: UseCaseResultRegistrationOptions = {}) {
  const {
    activeCase,
    addActivity,
    loading,
    mutating,
  } = useCaseWorkspace();

  const [
    registeredCaseIds,
    setRegisteredCaseIds,
  ] = useState<string[]>([]);

  const [
    lastRegisteredCase,
    setLastRegisteredCase,
  ] =
    useState<RegisteredCase | null>(
      null,
    );

  const [
    registrationError,
    setRegistrationError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    registering,
    setRegistering,
  ] = useState(false);

  const registrationInFlight =
    useRef(false);

  const registeredCaseIdsRef =
    useRef(new Set<string>());

  const resultGeneration =
    useRef(0);

  const mounted =
    useRef(false);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      resultGeneration.current += 1;
    };
  }, []);

  useEffect(() => {
    setRegistrationError(null);
  }, [activeCase?.id]);

  const resetResultRegistration =
    useCallback((): void => {
      resultGeneration.current += 1;
      registeredCaseIdsRef.current
        .clear();
      setRegisteredCaseIds([]);
      setLastRegisteredCase(null);
      setRegistrationError(null);
    }, []);

  const registerResult =
    useCallback(
      async (
        activity:
          ResultActivityInput,
      ): Promise<boolean> => {
        setRegistrationError(null);

        if (
          loading ||
          mutating
        ) {
          return false;
        }

        if (!activeCase) {
          setRegistrationError(
            missingCaseMessage,
          );
          return false;
        }

        if (
          registrationInFlight.current ||
          registeredCaseIdsRef.current
            .has(activeCase.id)
        ) {
          return false;
        }

        const targetCase:
          RegisteredCase = {
            id: activeCase.id,
            name: activeCase.name,
          };

        const generation =
          resultGeneration.current;

        registrationInFlight.current =
          true;
        setRegistering(true);

        try {
          await addActivity({
            ...activity,
            caseId:
              targetCase.id,
          });

          if (
            !mounted.current ||
            generation !==
            resultGeneration.current
          ) {
            return true;
          }

          registeredCaseIdsRef.current
            .add(targetCase.id);

          setRegisteredCaseIds(
            (current) => [
              ...current,
              targetCase.id,
            ],
          );

          setLastRegisteredCase(
            targetCase,
          );

          return true;
        } catch (unknownError) {
          if (
            mounted.current &&
            generation ===
            resultGeneration.current
          ) {
            setRegistrationError(
              unknownError
                instanceof Error
                ? unknownError.message
                : errorMessage,
            );
          }

          return false;
        } finally {
          registrationInFlight.current =
            false;

          if (mounted.current) {
            setRegistering(false);
          }
        }
      },
      [
        activeCase,
        addActivity,
        errorMessage,
        loading,
        missingCaseMessage,
        mutating,
      ],
    );

  const isRegisteredForActiveCase =
    activeCase !== null &&
    registeredCaseIds.includes(
      activeCase.id,
    );

  return {
    activeCase,
    caseLoading: loading,
    isRegisteredForActiveCase,
    lastRegisteredCase,
    registerResult,
    registering,
    registrationDisabled:
      loading ||
      activeCase === null ||
      mutating ||
      registering ||
      isRegisteredForActiveCase,
    registrationError,
    resetResultRegistration,
  };
}
