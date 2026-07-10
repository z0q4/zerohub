import {
  resolve4,
  resolve6,
  resolveCname,
  resolveMx,
  resolveNs,
  resolveTxt,
} from 'node:dns/promises';

import {
  domainToASCII,
} from 'node:url';

import type {
  DnsLookupRequest,
  DnsLookupResult,
} from '../../shared/network/dns.types';

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
    input.includes('#')
  ) {
    throw new Error(
      'Informe somente o domínio, sem protocolo, caminho ou parâmetros.',
    );
  }

  const asciiDomain =
    domainToASCII(input);

  if (
    !asciiDomain ||
    asciiDomain.length > 253
  ) {
    throw new Error(
      'O domínio informado é inválido.',
    );
  }

  const labels =
    asciiDomain.split('.');

  const validLabel =
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

  if (
    labels.some(
      (label) =>
        label.length === 0 ||
        label.length > 63 ||
        !validLabel.test(label),
    )
  ) {
    throw new Error(
      'O domínio informado possui um formato inválido.',
    );
  }

  return asciiDomain;
}

function mapDnsError(
  unknownError: unknown,
): Error {
  if (
    typeof unknownError !== 'object' ||
    unknownError === null
  ) {
    return new Error(
      'Não foi possível concluir a consulta DNS.',
    );
  }

  const error =
    unknownError as NodeJS.ErrnoException;

  switch (error.code) {
    case 'ENOTFOUND':
    case 'ENODATA':
      return new Error(
        'Nenhum registro desse tipo foi encontrado para o domínio.',
      );

    case 'ETIMEOUT':
      return new Error(
        'A consulta DNS excedeu o tempo limite.',
      );

    case 'ESERVFAIL':
      return new Error(
        'O servidor DNS não conseguiu processar a consulta.',
      );

    case 'EREFUSED':
      return new Error(
        'A consulta foi recusada pelo servidor DNS.',
      );

    default:
      return new Error(
        error.message ||
          'Não foi possível concluir a consulta DNS.',
      );
  }
}

async function resolveRecords(
  domain: string,
  recordType: DnsLookupRequest['recordType'],
): Promise<string[]> {
  switch (recordType) {
    case 'A':
      return resolve4(domain);

    case 'AAAA':
      return resolve6(domain);

    case 'MX': {
      const records =
        await resolveMx(domain);

      return records
        .sort(
          (first, second) =>
            first.priority -
            second.priority,
        )
        .map(
          (record) =>
            `${record.priority} ${record.exchange}`,
        );
    }

    case 'TXT': {
      const records =
        await resolveTxt(domain);

      return records.map(
        (parts) => parts.join(''),
      );
    }

    case 'NS':
      return resolveNs(domain);

    case 'CNAME':
      return resolveCname(domain);
  }
}

export async function lookupDns(
  request: DnsLookupRequest,
): Promise<DnsLookupResult> {
  const domain =
    normalizeDomain(request.domain);

  const startedAt =
    performance.now();

  try {
    const records =
      await resolveRecords(
        domain,
        request.recordType,
      );

    return {
      domain,
      recordType:
        request.recordType,
      records,
      elapsedMs: Number(
        (
          performance.now() -
          startedAt
        ).toFixed(2),
      ),
    };
  } catch (unknownError) {
    throw mapDnsError(unknownError);
  }
}
