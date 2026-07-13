import {
  randomUUID,
} from 'node:crypto';

import {
  isIP,
} from 'node:net';

import type {
  CaseActivity,
  CaseActivityCreateInput,
  CaseActivityStatus,
  CaseCreateInput,
  CasePrimaryTargetInput,
  CaseStatus,
  CaseSummary,
  CaseTarget,
  CaseTargetCreateInput,
  CaseTargetInput,
  CaseTargetKind,
  CaseTargetRemoveInput,
  CaseUpdateInput,
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

const HASH_LENGTHS:
  readonly number[] = [
    32,
    40,
    64,
    96,
    128,
  ];

function normalizeDomain(
  rawValue: string,
): string {
  const value =
    rawValue
      .trim()
      .toLowerCase()
      .replace(/\.$/, '');

  if (
    !value ||
    value.length > 253
  ) {
    throw new Error(
      'O domínio informado é inválido.',
    );
  }

  const labels =
    value.split('.');

  const valid =
    labels.every(
      (label) =>
        label.length > 0 &&
        label.length <= 63 &&
        /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(
          label,
        ),
    );

  if (!valid) {
    throw new Error(
      'O domínio informado é inválido.',
    );
  }

  return value;
}

function normalizeEmail(
  rawValue: string,
): string {
  const value =
    rawValue.trim();

  const [
    localPart,
    domainPart,
    ...extraParts
  ] =
    value.split('@');

  if (
    !localPart ||
    !domainPart ||
    extraParts.length > 0 ||
    localPart.length > 64 ||
    value.length > 254 ||
    /\s/.test(value)
  ) {
    throw new Error(
      'O endereço de e-mail é inválido.',
    );
  }

  const domain =
    normalizeDomain(
      domainPart,
    );

  return `${localPart}@${domain}`;
}

function normalizeUrl(
  rawValue: string,
): string {
  const value =
    rawValue.trim();

  try {
    const parsed =
      new URL(value);

    if (
      parsed.protocol !== 'http:' &&
      parsed.protocol !== 'https:'
    ) {
      throw new Error();
    }

    return parsed.toString();
  } catch {
    throw new Error(
      'A URL precisa usar HTTP ou HTTPS e possuir formato válido.',
    );
  }
}

function normalizeHash(
  rawValue: string,
): string {
  const value =
    rawValue
      .trim()
      .toLowerCase();

  if (
    !/^[a-f0-9]+$/.test(value) ||
    !HASH_LENGTHS.includes(
      value.length,
    )
  ) {
    throw new Error(
      'O hash precisa ser hexadecimal e possuir um tamanho conhecido.',
    );
  }

  return value;
}

function normalizeTargetValue(
  kind: CaseTargetKind,
  rawValue: string,
): string {
  switch (kind) {
    case 'domain':
      return normalizeDomain(
        rawValue,
      );

    case 'ip': {
      const value =
        rawValue.trim();

      if (isIP(value) === 0) {
        throw new Error(
          'O endereço IP informado é inválido.',
        );
      }

      return value;
    }

    case 'email':
      return normalizeEmail(
        rawValue,
      );

    case 'url':
      return normalizeUrl(
        rawValue,
      );

    case 'hash':
      return normalizeHash(
        rawValue,
      );

    case 'file':
      return requiredText(
        rawValue,
        'Caminho do arquivo',
        4096,
      );

    case 'other':
      return requiredText(
        rawValue,
        'Valor do alvo',
        2048,
      );
  }
}

function targetIdentity(
  target: Pick<
    CaseTarget,
    'kind' | 'value'
  >,
): string {
  const normalizedValue =
    target.kind === 'domain' ||
    target.kind === 'email' ||
    target.kind === 'hash'
      ? target.value.toLowerCase()
      : target.value;

  return [
    target.kind,
    normalizedValue,
  ].join(':');
}

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
      'O alvo possui formato inválido.',
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
      'O tipo do alvo é inválido.',
    );
  }

  const targetInput =
    value as CaseTargetInput;

  const kind =
    targetInput.kind;

  const targetValue =
    normalizeTargetValue(
      kind,
      requiredText(
        targetInput.value,
        'Valor do alvo',
        4096,
      ),
    );

  const createdAt =
    new Date().toISOString();

  return {
    id: randomUUID(),
    kind,
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

function createAutomaticActivity({
  caseId,
  action,
  title,
  note,
  input,
  output,
}: {
  caseId: string;
  action: string;
  title: string;
  note: string;
  input?: unknown;
  output?: unknown;
}): CaseActivity {
  return {
    id: randomUUID(),
    caseId,
    moduleId: 'case-workspace',
    action,
    title,
    status: 'info',
    input:
      serializableValue(input),
    output:
      serializableValue(output),
    note,
    durationMs: null,
    createdAt:
      new Date().toISOString(),
  };
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
  await mutationQueue;

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

  await mutationQueue;

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
  await mutationQueue;

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

export async function updateCase(
  rawInput: unknown,
): Promise<InvestigationCase> {
  if (!isRecord(rawInput)) {
    throw new TypeError(
      'Os dados de edição do perfil são inválidos.',
    );
  }

  const input =
    rawInput as CaseUpdateInput;

  const caseId =
    normalizeCaseId(
      input.caseId,
    );

  const name =
    requiredText(
      input.name,
      'Nome do perfil',
      120,
    );

  const description =
    optionalText(
      input.description,
      'Descrição',
      2000,
    );

  const tags =
    normalizeTags(
      input.tags,
    );

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

      const current =
        document.cases[index];

      const changedFields:
        string[] = [];

      if (current.name !== name) {
        changedFields.push('nome');
      }

      if (
        current.description !==
        description
      ) {
        changedFields.push(
          'descrição',
        );
      }

      if (
        JSON.stringify(
          current.tags,
        ) !==
        JSON.stringify(tags)
      ) {
        changedFields.push('tags');
      }

      if (
        changedFields.length === 0
      ) {
        return current;
      }

      const activity =
        createAutomaticActivity({
          caseId,
          action: 'profile-updated',
          title: 'Perfil atualizado',
          note:
            `Campos alterados: ${changedFields.join(', ')}.`,
          input: {
            previous: {
              name:
                current.name,
              description:
                current.description,
              tags:
                current.tags,
            },
          },
          output: {
            name,
            description,
            tags,
          },
        });

      const updated:
        InvestigationCase = {
        ...current,
        name,
        description,
        tags,
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

      return updated;
    },
  );
}

export async function addCaseTarget(
  rawInput: unknown,
): Promise<InvestigationCase> {
  if (!isRecord(rawInput)) {
    throw new TypeError(
      'Os dados do novo alvo são inválidos.',
    );
  }

  const input =
    rawInput as CaseTargetCreateInput;

  const caseId =
    normalizeCaseId(
      input.caseId,
    );

  const target =
    normalizeTarget(
      input.target,
    );

  if (!target) {
    throw new Error(
      'O alvo é obrigatório.',
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

      const current =
        document.cases[index];

      const duplicate =
        current.targets.some(
          (candidate) =>
            targetIdentity(
              candidate,
            ) ===
            targetIdentity(
              target,
            ),
        );

      if (duplicate) {
        throw new Error(
          'Este alvo já está vinculado ao perfil.',
        );
      }

      const activity =
        createAutomaticActivity({
          caseId,
          action: 'target-added',
          title: 'Alvo adicionado',
          note:
            `${target.label} foi vinculado ao perfil.`,
          output: target,
        });

      const updated:
        InvestigationCase = {
        ...current,
        targets: [
          ...current.targets,
          target,
        ],
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

      return updated;
    },
  );
}

export async function removeCaseTarget(
  rawInput: unknown,
): Promise<InvestigationCase> {
  if (!isRecord(rawInput)) {
    throw new TypeError(
      'Os dados de remoção do alvo são inválidos.',
    );
  }

  const input =
    rawInput as CaseTargetRemoveInput;

  const caseId =
    normalizeCaseId(
      input.caseId,
    );

  const targetId =
    requiredText(
      input.targetId,
      'Identificador do alvo',
      128,
    );

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

      const current =
        document.cases[index];

      const target =
        current.targets.find(
          (candidate) =>
            candidate.id ===
            targetId,
        );

      if (!target) {
        throw new Error(
          'O alvo solicitado não foi encontrado.',
        );
      }

      const wasPrimary =
        current.targets[0]?.id ===
        target.id;

      const nextTargets =
        current.targets.filter(
          (candidate) =>
            candidate.id !==
            target.id,
        );

      const activity =
        createAutomaticActivity({
          caseId,
          action: 'target-removed',
          title: 'Alvo removido',
          note:
            wasPrimary &&
            nextTargets.length > 0
              ? `${target.label} foi removido. O próximo alvo tornou-se principal.`
              : `${target.label} foi removido do perfil.`,
          input: target,
        });

      const updated:
        InvestigationCase = {
        ...current,
        targets:
          nextTargets,
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

      return updated;
    },
  );
}

export async function setPrimaryCaseTarget(
  rawInput: unknown,
): Promise<InvestigationCase> {
  if (!isRecord(rawInput)) {
    throw new TypeError(
      'Os dados do alvo principal são inválidos.',
    );
  }

  const input =
    rawInput as CasePrimaryTargetInput;

  const caseId =
    normalizeCaseId(
      input.caseId,
    );

  const targetId =
    requiredText(
      input.targetId,
      'Identificador do alvo',
      128,
    );

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

      const current =
        document.cases[index];

      const target =
        current.targets.find(
          (candidate) =>
            candidate.id ===
            targetId,
        );

      if (!target) {
        throw new Error(
          'O alvo solicitado não foi encontrado.',
        );
      }

      if (
        current.targets[0]?.id ===
        target.id
      ) {
        return current;
      }

      const targets = [
        target,
        ...current.targets.filter(
          (candidate) =>
            candidate.id !==
            target.id,
        ),
      ];

      const activity =
        createAutomaticActivity({
          caseId,
          action:
            'primary-target-changed',
          title:
            'Alvo principal alterado',
          note:
            `${target.label} agora é o alvo principal do perfil.`,
          output: target,
        });

      const updated:
        InvestigationCase = {
        ...current,
        targets,
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

      return updated;
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

      const current =
        document.cases[index];

      const status =
        rawStatus as CaseStatus;

      if (current.status === status) {
        return current;
      }

      const activity =
        createAutomaticActivity({
          caseId,
          action: 'status-changed',
          title:
            'Status do perfil alterado',
          note:
            `Status alterado de ${current.status} para ${status}.`,
          input: {
            status:
              current.status,
          },
          output: {
            status,
          },
        });

      const updated:
        InvestigationCase = {
        ...current,
        status,
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

      return updated;
    },
  );
}
