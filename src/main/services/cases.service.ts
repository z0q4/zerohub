import {
  randomUUID,
} from 'node:crypto';

import type {
  CaseActivity,
  CaseActivityCreateInput,
  CaseActivityStatus,
  CaseCreateInput,
  CaseStatus,
  CaseSummary,
  CaseTarget,
  CaseTargetInput,
  CaseTargetKind,
  InvestigationCase,
} from '../../shared/cases/cases.types';

import {
  JsonCasesRepository,
} from '../repositories/json-cases.repository';

const repository =
  new JsonCasesRepository();

const TARGET_KINDS:
  readonly CaseTargetKind[] = [
    'domain',
    'ip',
    'email',
    'url',
    'hash',
    'file',
    'other',
  ];

const ACTIVITY_STATUSES:
  readonly CaseActivityStatus[] = [
    'success',
    'error',
    'cancelled',
    'info',
  ];

let mutationQueue:
  Promise<void> =
    Promise.resolve();

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function requiredText(
  value: unknown,
  field: string,
  maxLength: number,
): string {
  if (typeof value !== 'string') {
    throw new TypeError(
      `${field} precisa ser um texto.`,
    );
  }

  const normalized =
    value.trim();

  if (!normalized) {
    throw new Error(
      `${field} é obrigatório.`,
    );
  }

  if (
    normalized.length >
    maxLength
  ) {
    throw new Error(
      `${field} excede ${maxLength} caracteres.`,
    );
  }

  return normalized;
}

function optionalText(
  value: unknown,
  field: string,
  maxLength: number,
): string {
  if (
    value === undefined ||
    value === null
  ) {
    return '';
  }

  if (typeof value !== 'string') {
    throw new TypeError(
      `${field} precisa ser um texto.`,
    );
  }

  const normalized =
    value.trim();

  if (
    normalized.length >
    maxLength
  ) {
    throw new Error(
      `${field} excede ${maxLength} caracteres.`,
    );
  }

  return normalized;
}

function normalizeTags(
  value: unknown,
): string[] {
  if (
    value === undefined ||
    value === null
  ) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new TypeError(
      'As tags precisam ser uma lista.',
    );
  }

  const normalized =
    value.map((item) =>
      requiredText(
        item,
        'Tag',
        40,
      ).toLowerCase(),
    );

  return Array.from(
    new Set(normalized),
  ).slice(0, 20);
}

function normalizeTarget(
  value: unknown,
): CaseTarget | null {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  if (!isRecord(value)) {
    throw new TypeError(
      'O alvo principal possui formato inválido.',
    );
  }

  if (
    typeof value.kind !==
      'string' ||
    !TARGET_KINDS.includes(
      value.kind as CaseTargetKind,
    )
  ) {
    throw new Error(
      'O tipo do alvo principal é inválido.',
    );
  }

  const targetInput =
    value as CaseTargetInput;

  const targetValue =
    requiredText(
      targetInput.value,
      'Valor do alvo',
      2048,
    );

  const createdAt =
    new Date().toISOString();

  return {
    id: randomUUID(),
    kind: targetInput.kind,
    value: targetValue,
    label:
      optionalText(
        targetInput.label,
        'Nome do alvo',
        120,
      ) || targetValue,
    createdAt,
  };
}

function serializableValue(
  value: unknown,
): unknown {
  if (value === undefined) {
    return null;
  }

  try {
    return JSON.parse(
      JSON.stringify(value),
    ) as unknown;
  } catch {
    throw new Error(
      'O resultado não pode ser salvo no histórico.',
    );
  }
}

function serializeMutation<T>(
  operation: () => Promise<T>,
): Promise<T> {
  const result =
    mutationQueue.then(
      operation,
      operation,
    );

  mutationQueue =
    result.then(
      (): undefined => undefined,
      (): undefined => undefined,
    );

  return result;
}

function summarize(
  item: InvestigationCase,
): CaseSummary {
  return {
    id: item.id,
    name: item.name,
    description:
      item.description,
    status: item.status,
    tags: [...item.tags],
    targetCount:
      item.targets.length,
    activityCount:
      item.activities.length,
    createdAt:
      item.createdAt,
    updatedAt:
      item.updatedAt,
  };
}

function normalizeCaseId(
  value: unknown,
): string {
  return requiredText(
    value,
    'Identificador do perfil',
    128,
  );
}

export async function listCases():
  Promise<CaseSummary[]> {
  const document =
    await repository.load();

  return [...document.cases]
    .sort(
      (left, right) =>
        right.updatedAt.localeCompare(
          left.updatedAt,
        ),
    )
    .map(summarize);
}

export async function getCase(
  rawCaseId: unknown,
): Promise<InvestigationCase> {
  const caseId =
    normalizeCaseId(rawCaseId);

  const document =
    await repository.load();

  const item =
    document.cases.find(
      (candidate) =>
        candidate.id === caseId,
    );

  if (!item) {
    throw new Error(
      'O perfil solicitado não foi encontrado.',
    );
  }

  return item;
}

export async function getActiveCase():
  Promise<InvestigationCase | null> {
  const document =
    await repository.load();

  if (!document.activeCaseId) {
    return null;
  }

  return (
    document.cases.find(
      (item) =>
        item.id ===
        document.activeCaseId,
    ) ?? null
  );
}

export async function createCase(
  rawInput: unknown,
): Promise<InvestigationCase> {
  if (!isRecord(rawInput)) {
    throw new TypeError(
      'Os dados do perfil são inválidos.',
    );
  }

  const input =
    rawInput as CaseCreateInput;

  const now =
    new Date().toISOString();

  const target =
    normalizeTarget(
      input.primaryTarget,
    );

  const item:
    InvestigationCase = {
      id: randomUUID(),
      name:
        requiredText(
          input.name,
          'Nome do perfil',
          120,
        ),
      description:
        optionalText(
          input.description,
          'Descrição',
          2000,
        ),
      status: 'active',
      tags:
        normalizeTags(
          input.tags,
        ),
      targets:
        target ? [target] : [],
      activities: [],
      createdAt: now,
      updatedAt: now,
    };

  return serializeMutation(
    async (): Promise<InvestigationCase> => {
      const document =
        await repository.load();

      document.cases.unshift(
        item,
      );

      document.activeCaseId =
        item.id;

      await repository.save(
        document,
      );

      return item;
    },
  );
}

export async function setActiveCase(
  rawCaseId: unknown,
): Promise<InvestigationCase | null> {
  if (
    rawCaseId === null ||
    rawCaseId === undefined ||
    rawCaseId === ''
  ) {
    return serializeMutation(
      async (): Promise<null> => {
        const document =
          await repository.load();

        document.activeCaseId =
          null;

        await repository.save(
          document,
        );

        return null;
      },
    );
  }

  const caseId =
    normalizeCaseId(rawCaseId);

  return serializeMutation(
    async (): Promise<InvestigationCase> => {
      const document =
        await repository.load();

      const item =
        document.cases.find(
          (candidate) =>
            candidate.id === caseId,
        );

      if (!item) {
        throw new Error(
          'O perfil solicitado não foi encontrado.',
        );
      }

      document.activeCaseId =
        item.id;

      await repository.save(
        document,
      );

      return item;
    },
  );
}

export async function addCaseActivity(
  rawInput: unknown,
): Promise<CaseActivity> {
  if (!isRecord(rawInput)) {
    throw new TypeError(
      'Os dados do histórico são inválidos.',
    );
  }

  const input =
    rawInput as CaseActivityCreateInput;

  if (
    typeof input.status !==
      'string' ||
    !ACTIVITY_STATUSES.includes(
      input.status,
    )
  ) {
    throw new Error(
      'O status da atividade é inválido.',
    );
  }

  const caseId =
    normalizeCaseId(
      input.caseId,
    );

  const durationMs =
    input.durationMs ===
      undefined ||
    input.durationMs === null
      ? null
      : Number(
          input.durationMs,
        );

  if (
    durationMs !== null &&
    (
      !Number.isFinite(
        durationMs,
      ) ||
      durationMs < 0
    )
  ) {
    throw new Error(
      'A duração da atividade é inválida.',
    );
  }

  const activity:
    CaseActivity = {
      id: randomUUID(),
      caseId,
      moduleId:
        requiredText(
          input.moduleId,
          'Módulo',
          120,
        ),
      action:
        requiredText(
          input.action,
          'Ação',
          120,
        ),
      title:
        requiredText(
          input.title,
          'Título',
          180,
        ),
      status:
        input.status,
      input:
        serializableValue(
          input.input,
        ),
      output:
        serializableValue(
          input.output,
        ),
      note:
        optionalText(
          input.note,
          'Nota',
          4000,
        ),
      durationMs,
      createdAt:
        new Date().toISOString(),
    };

  return serializeMutation(
    async (): Promise<CaseActivity> => {
      const document =
        await repository.load();

      const index =
        document.cases.findIndex(
          (item) =>
            item.id === caseId,
        );

      if (index === -1) {
        throw new Error(
          'O perfil solicitado não foi encontrado.',
        );
      }

      const current =
        document.cases[index];

      const updated:
        InvestigationCase = {
          ...current,
          activities: [
            activity,
            ...current.activities,
          ],
          updatedAt:
            activity.createdAt,
        };

      document.cases[index] =
        updated;

      await repository.save(
        document,
      );

      return activity;
    },
  );
}

export async function updateCaseStatus(
  rawCaseId: unknown,
  rawStatus: unknown,
): Promise<InvestigationCase> {
  const caseId =
    normalizeCaseId(rawCaseId);

  const statuses:
    readonly CaseStatus[] = [
      'active',
      'paused',
      'archived',
    ];

  if (
    typeof rawStatus !==
      'string' ||
    !statuses.includes(
      rawStatus as CaseStatus,
    )
  ) {
    throw new Error(
      'O status do perfil é inválido.',
    );
  }

  return serializeMutation(
    async (): Promise<InvestigationCase> => {
      const document =
        await repository.load();

      const index =
        document.cases.findIndex(
          (item) =>
            item.id === caseId,
        );

      if (index === -1) {
        throw new Error(
          'O perfil solicitado não foi encontrado.',
        );
      }

      const updated:
        InvestigationCase = {
          ...document.cases[index],
          status:
            rawStatus as CaseStatus,
          updatedAt:
            new Date().toISOString(),
        };

      document.cases[index] =
        updated;

      await repository.save(
        document,
      );

      return updated;
    },
  );
}
