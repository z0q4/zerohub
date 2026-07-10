import {
  domainToASCII,
} from 'node:url';

import type {
  RdapDomainResult,
  RdapEntity,
  RdapEvent,
} from '../../shared/osint/rdap.types';

type JsonObject =
  Record<string, unknown>;

type BootstrapEntry = {
  suffixes: string[];
  baseUrls: string[];
};

const IANA_DNS_BOOTSTRAP_URL =
  'https://data.iana.org/rdap/dns.json';

const REQUEST_TIMEOUT_MS =
  12_000;

const MAX_RESPONSE_SIZE =
  2 * 1024 * 1024;

const BOOTSTRAP_CACHE_DURATION_MS =
  6 * 60 * 60 * 1000;

let bootstrapCache:
  BootstrapEntry[] | null = null;

let bootstrapCacheCreatedAt = 0;

function isObject(
  value: unknown,
): value is JsonObject {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function getString(
  value: unknown,
): string | null {
  return typeof value === 'string'
    ? value
    : null;
}

function getStringArray(
  value: unknown,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is string =>
      typeof item === 'string',
  );
}

function normalizeDomain(
  rawDomain: string,
): string {
  const input = rawDomain
    .trim()
    .toLowerCase()
    .replace(/\.$/, '');

  if (!input) {
    throw new Error(
      'Informe um domínio para consultar.',
    );
  }

  if (
    input.includes('://') ||
    input.includes('/') ||
    input.includes('?') ||
    input.includes('#') ||
    /\s/.test(input)
  ) {
    throw new Error(
      'Informe somente o domínio, sem protocolo, caminho ou espaços.',
    );
  }

  const domain =
    domainToASCII(input);

  if (
    !domain ||
    domain.length > 253
  ) {
    throw new Error(
      'O domínio informado é inválido.',
    );
  }

  const labels =
    domain.split('.');

  if (labels.length < 2) {
    throw new Error(
      'Informe um domínio completo, como example.com.',
    );
  }

  const validLabel =
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

  if (
    labels.some(
      (label) =>
        !label ||
        label.length > 63 ||
        !validLabel.test(label),
    )
  ) {
    throw new Error(
      'O domínio possui um formato inválido.',
    );
  }

  return domain;
}

async function fetchJson(
  url: string,
): Promise<{
  data: unknown;
  finalUrl: string;
}> {
  const controller =
    new AbortController();

  const timer =
    setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

  try {
    const response =
      await fetch(url, {
        method: 'GET',

        headers: {
          Accept:
            'application/rdap+json, application/json',
        },

        redirect: 'follow',
        signal: controller.signal,
      });

    const content =
      await response.text();

    if (
      content.length >
      MAX_RESPONSE_SIZE
    ) {
      throw new Error(
        'A resposta recebida excede o limite permitido pelo ZeroHub.',
      );
    }

    if (!response.ok) {
      switch (response.status) {
        case 400:
          throw new Error(
            'O servidor RDAP rejeitou a consulta.',
          );

        case 404:
          throw new Error(
            'O domínio não foi encontrado no servidor RDAP.',
          );

        case 429:
          throw new Error(
            'O servidor RDAP limitou temporariamente as consultas. Tente novamente depois.',
          );

        default:
          throw new Error(
            `O servidor RDAP respondeu com HTTP ${response.status}.`,
          );
      }
    }

    try {
      return {
        data: JSON.parse(content),
        finalUrl:
          response.url || url,
      };
    } catch {
      throw new Error(
        'O servidor RDAP retornou um JSON inválido.',
      );
    }
  } catch (unknownError) {
    if (
      unknownError instanceof Error &&
      unknownError.name ===
        'AbortError'
    ) {
      throw new Error(
        'A consulta RDAP excedeu o tempo limite.',
      );
    }

    if (
      unknownError instanceof TypeError
    ) {
      throw new Error(
        'Não foi possível conectar ao servidor RDAP.',
      );
    }

    throw unknownError;
  } finally {
    clearTimeout(timer);
  }
}

function parseBootstrap(
  value: unknown,
): BootstrapEntry[] {
  if (
    !isObject(value) ||
    !Array.isArray(value.services)
  ) {
    throw new Error(
      'O bootstrap RDAP da IANA possui um formato inesperado.',
    );
  }

  const entries:
    BootstrapEntry[] = [];

  for (
    const service of
    value.services
  ) {
    if (
      !Array.isArray(service) ||
      service.length < 2
    ) {
      continue;
    }

    const suffixes =
      getStringArray(
        service[0],
      ).map((suffix) =>
        suffix.toLowerCase(),
      );

    const baseUrls =
      getStringArray(
        service[1],
      );

    if (
      suffixes.length > 0 &&
      baseUrls.length > 0
    ) {
      entries.push({
        suffixes,
        baseUrls,
      });
    }
  }

  if (entries.length === 0) {
    throw new Error(
      'Nenhum servidor RDAP foi encontrado no bootstrap da IANA.',
    );
  }

  return entries;
}

async function getBootstrapEntries():
  Promise<BootstrapEntry[]> {
  const cacheIsValid =
    bootstrapCache !== null &&
    Date.now() -
      bootstrapCacheCreatedAt <
      BOOTSTRAP_CACHE_DURATION_MS;

  if (cacheIsValid) {
    return bootstrapCache!;
  }

  const response =
    await fetchJson(
      IANA_DNS_BOOTSTRAP_URL,
    );

  const entries =
    parseBootstrap(
      response.data,
    );

  bootstrapCache = entries;
  bootstrapCacheCreatedAt =
    Date.now();

  return entries;
}

async function resolveRdapBaseUrl(
  domain: string,
): Promise<string> {
  const entries =
    await getBootstrapEntries();

  const matches =
    entries
      .flatMap((entry) =>
        entry.suffixes.map(
          (suffix) => ({
            suffix,
            baseUrls:
              entry.baseUrls,
          }),
        ),
      )
      .filter(
        (entry) =>
          domain ===
            entry.suffix ||
          domain.endsWith(
            `.${entry.suffix}`,
          ),
      )
      .sort(
        (first, second) =>
          second.suffix.length -
          first.suffix.length,
      );

  const match =
    matches[0];

  if (!match) {
    throw new Error(
      'A IANA não possui um servidor RDAP registrado para esse domínio.',
    );
  }

  const secureBaseUrl =
    match.baseUrls.find(
      (url) =>
        url.startsWith(
          'https://',
        ),
    );

  if (!secureBaseUrl) {
    throw new Error(
      'O registro responsável não oferece um endpoint RDAP HTTPS.',
    );
  }

  return secureBaseUrl.endsWith(
    '/',
  )
    ? secureBaseUrl
    : `${secureBaseUrl}/`;
}

function parseEvents(
  value: unknown,
): RdapEvent[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap(
    (item) => {
      if (!isObject(item)) {
        return [];
      }

      const action =
        getString(
          item.eventAction,
        );

      const date =
        getString(
          item.eventDate,
        );

      if (!action || !date) {
        return [];
      }

      return [{
        action,
        date,
      }];
    },
  );
}

function extractEntityName(
  entity: JsonObject,
): string | null {
  const vcard =
    entity.vcardArray;

  if (
    !Array.isArray(vcard) ||
    !Array.isArray(vcard[1])
  ) {
    return null;
  }

  for (
    const property of
    vcard[1]
  ) {
    if (
      Array.isArray(property) &&
      property[0] === 'fn' &&
      typeof property[3] ===
        'string'
    ) {
      return property[3];
    }
  }

  return null;
}

function parseEntities(
  value: unknown,
): RdapEntity[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap(
    (item) => {
      if (!isObject(item)) {
        return [];
      }

      return [{
        handle:
          getString(item.handle),

        name:
          extractEntityName(item),

        roles:
          getStringArray(
            item.roles,
          ),
      }];
    },
  );
}

function parseNameservers(
  value: unknown,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap(
    (item) => {
      if (!isObject(item)) {
        return [];
      }

      const name =
        getString(
          item.ldhName,
        ) ??
        getString(
          item.unicodeName,
        );

      return name
        ? [name]
        : [];
    },
  );
}

function parseNotices(
  value: unknown,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap(
    (item) => {
      if (!isObject(item)) {
        return [];
      }

      const title =
        getString(item.title);

      const descriptions =
        getStringArray(
          item.description,
        );

      const text = [
        title,
        ...descriptions,
      ]
        .filter(Boolean)
        .join(' — ');

      return text
        ? [text]
        : [];
    },
  );
}

function parseSecureDns(
  value: unknown,
): boolean | null {
  if (!isObject(value)) {
    return null;
  }

  return typeof
    value.delegationSigned ===
    'boolean'
    ? value.delegationSigned
    : null;
}

export async function lookupRdapDomain(
  rawDomain: string,
): Promise<RdapDomainResult> {
  const domain =
    normalizeDomain(
      rawDomain,
    );

  const startedAt =
    performance.now();

  const baseUrl =
    await resolveRdapBaseUrl(
      domain,
    );

  const queryUrl =
    new URL(
      `domain/${encodeURIComponent(
        domain,
      )}`,
      baseUrl,
    ).toString();

  const response =
    await fetchJson(
      queryUrl,
    );

  if (!isObject(response.data)) {
    throw new Error(
      'O servidor RDAP retornou uma resposta inesperada.',
    );
  }

  const secureDns =
    parseSecureDns(
      response.data.secureDNS,
    );

  return {
    domain:
      getString(
        response.data.ldhName,
      ) ?? domain,

    unicodeName:
      getString(
        response.data.unicodeName,
      ),

    handle:
      getString(
        response.data.handle,
      ),

    status:
      getStringArray(
        response.data.status,
      ),

    nameservers:
      parseNameservers(
        response.data.nameservers,
      ),

    events:
      parseEvents(
        response.data.events,
      ),

    entities:
      parseEntities(
        response.data.entities,
      ),

    notices:
      parseNotices(
        response.data.notices,
      ),

    port43:
      getString(
        response.data.port43,
      ),

    secureDns,

    sourceUrl:
      response.finalUrl,

    elapsedMs:
      Number(
        (
          performance.now() -
          startedAt
        ).toFixed(2),
      ),

    rawJson:
      JSON.stringify(
        response.data,
        null,
        2,
      ),
  };
}
