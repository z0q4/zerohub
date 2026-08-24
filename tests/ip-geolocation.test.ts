import assert from 'node:assert/strict';
import {
  test,
} from 'node:test';

import {
  parseRequest,
  parseRequestId,
} from '../src/main/ipc/ip-geolocation.ipc';
import {
  parseClipboardText,
} from '../src/main/ipc/clipboard.ipc';
import {
  IpGeolocationService,
} from '../src/main/services/ip-geolocation.service';
import {
  PublicIpDiscoveryService,
} from '../src/main/services/public-ip-discovery.service';
import {
  validatePublicIpAddress,
} from '../src/shared/ip-geolocation/ip-address.validation';
import {
  parseLookupResponse,
  parsePublicLookupResponse,
} from '../src/renderer/components/workspace/useIpGeolocationIntelligence';

import type {
  IpGeolocationProvider,
  PublicIpDiscoveryProvider,
} from '../src/main/services/ip-geolocation.service';
import type {
  PublicIpDiscoveryResponse,
  PublicIpDiscoveryTransport,
} from '../src/main/services/public-ip-discovery.service';
import type {
  IpAddressVersion,
  IpGeolocationProviderResult,
} from '../src/shared/ip-geolocation/ip-geolocation.types';

const ipv4 = '8.8.8.8';
const ipv6 =
  '2606:4700:4700:0:0:0:0:1111';

function result(
  ip: string,
  version: IpAddressVersion,
): IpGeolocationProviderResult {
  return {
    ip,
    version,
    city: null,
    region: null,
    country: null,
    countryCode: null,
    latitude: 1,
    longitude: 2,
    postalCode: null,
    timezone: null,
    asn: null,
    organization: null,
    currency: null,
    provider: 'ipapi.co',
    consultedAt:
      '2026-08-16T00:00:00.000Z',
  };
}

function discovery(
  responses: Partial<
    Record<
      IpAddressVersion,
      PublicIpDiscoveryResponse
    >
  >,
): PublicIpDiscoveryProvider {
  return {
    async discover(version) {
      return responses[version] ?? {
        ok: false,
        error: {
          code: 'unavailable',
          message: 'indisponível',
        },
      };
    },
  };
}

function provider(
  lookup: IpGeolocationProvider['lookup'] =
    async (ip) => result(
      ip ?? ipv4,
      ip?.includes(':')
        ? 'IPv6'
        : 'IPv4',
    ),
): IpGeolocationProvider {
  return {
    id: 'ipapi.co',
    lookup,
  };
}

function discoveryService(
  response: Response | Error,
  online = true,
): PublicIpDiscoveryService {
  const fetch = async () => {
    if (response instanceof Error) {
      throw response;
    }

    return response;
  };

  return new PublicIpDiscoveryService({
    fetch:
      fetch as PublicIpDiscoveryTransport['fetch'],
    isOnline: () => online,
  });
}

test(
  'valida IPs públicos e bloqueia faixas não públicas',
  () => {
    assert.deepEqual(
      validatePublicIpAddress(ipv4),
      {
        valid: true,
        ip: ipv4,
        version: 'IPv4',
      },
    );
    assert.equal(
      validatePublicIpAddress(
        '2606:4700:4700::1111',
      ).valid,
      true,
    );

    for (const blocked of [
      'not-an-ip',
      '10.0.0.1',
      '127.0.0.1',
      '169.254.1.1',
      '192.0.2.1',
      '::1',
      'fe80::1',
      'fc00::1',
      '2001:db8::1',
    ]) {
      assert.equal(
        validatePublicIpAddress(blocked)
          .valid,
        false,
        blocked,
      );
    }
  },
);

test(
  'valida contratos IPC hostis sem chamar o serviço',
  () => {
    for (const invalid of [
      undefined,
      null,
      [],
      'request',
      {},
      { requestId: '', ip: ipv4 },
      {
        requestId: 'x'.repeat(129),
        ip: ipv4,
      },
      { requestId: 'ok', ip: null },
    ]) {
      if (
        typeof invalid === 'object' &&
        invalid !== null &&
        !Array.isArray(invalid) &&
        'ip' in invalid &&
        invalid.ip === null &&
        invalid.requestId === 'ok'
      ) {
        assert.equal(
          parseRequest(invalid).ok,
          true,
        );
      } else {
        assert.equal(
          parseRequest(invalid).ok,
          false,
        );
      }
    }

    for (const ip of [
      NaN,
      Infinity,
      undefined,
      '10.0.0.1',
    ]) {
      assert.equal(
        parseRequest({
          requestId: 'ok',
          ip,
        }).ok,
        false,
      );
    }

    assert.equal(parseRequestId('ok'), 'ok');
    assert.equal(parseRequestId(''), null);
    assert.equal(parseRequestId(null), null);
    assert.equal(
      parseRequestId('x'.repeat(129)),
      null,
    );
  },
);

test(
  'limita o payload IPC do clipboard',
  () => {
    assert.equal(
      parseClipboardText('texto'),
      'texto',
    );
    assert.throws(
      () => parseClipboardText(null),
      TypeError,
    );
    assert.throws(
      () => parseClipboardText(
        'x'.repeat(1024 * 1024 + 1),
      ),
      TypeError,
    );
  },
);

test(
  'renderer rejeita respostas IPC incompatíveis',
  () => {
    const ipv4Result = result(
      ipv4,
      'IPv4',
    );
    const ipv6Result = result(
      ipv6,
      'IPv6',
    );

    assert.equal(
      parseLookupResponse({
        ok: true,
        cached: false,
        result: ipv4Result,
      })?.ok,
      true,
    );

    for (const invalid of [
      null,
      undefined,
      { ok: 'true' },
      {
        ok: true,
        cached: false,
        result: {
          ...ipv4Result,
          latitude: NaN,
        },
      },
      {
        ok: true,
        cached: false,
        result: {
          ...ipv4Result,
          longitude: Infinity,
        },
      },
      {
        ok: true,
        cached: false,
        result: {
          ...ipv4Result,
          consultedAt: 'invalid-date',
        },
      },
    ]) {
      assert.equal(
        parseLookupResponse(invalid),
        null,
      );
    }

    const family = (
      version: IpAddressVersion,
      familyResult:
        IpGeolocationProviderResult,
    ) => ({
      ok: true,
      version,
      cached: false,
      result: familyResult,
    });

    assert.equal(
      parsePublicLookupResponse({
        ok: true,
        families: [
          family('IPv4', ipv4Result),
          family('IPv6', ipv6Result),
        ],
      })?.ok,
      true,
    );
    assert.equal(
      parsePublicLookupResponse({
        ok: true,
        families: [
          family('IPv4', ipv4Result),
          family('IPv4', ipv4Result),
        ],
      }),
      null,
    );
    assert.equal(
      parsePublicLookupResponse({
        ok: true,
        families: [
          family('IPv4', ipv6Result),
          family('IPv6', ipv6Result),
        ],
      }),
      null,
    );
  },
);

test(
  'descoberta aceita a família esperada',
  async () => {
    const service = discoveryService(
      new Response(
        JSON.stringify({ ip: ipv4 }),
      ),
    );

    assert.deepEqual(
      await service.discover(
        'IPv4',
        new AbortController().signal,
      ),
      { ok: true, ip: ipv4 },
    );
  },
);

test(
  'descoberta trata 429, offline e respostas inválidas',
  async () => {
    const cases: Array<{
      service: PublicIpDiscoveryService;
      code: string;
    }> = [
      {
        service: discoveryService(
          new Response('{}', {
            status: 429,
          }),
        ),
        code: 'rate-limited',
      },
      {
        service: discoveryService(
          new Error('offline'),
          false,
        ),
        code: 'offline',
      },
      {
        service: discoveryService(
          new Response('{'),
        ),
        code: 'invalid-response',
      },
      {
        service: discoveryService(
          new Response(
            JSON.stringify({ ip: ipv6 }),
          ),
        ),
        code: 'invalid-response',
      },
      {
        service: discoveryService(
          new Response(
            JSON.stringify({
              ip: ipv4,
              padding: 'x'.repeat(1024),
            }),
          ),
        ),
        code: 'invalid-response',
      },
    ];

    for (const item of cases) {
      const response = await item.service
        .discover(
          'IPv4',
          new AbortController().signal,
        );

      assert.equal(response.ok, false);
      if (response.ok === false) {
        assert.equal(
          response.error.code,
          item.code,
        );
      }
    }
  },
);

test(
  'lookup público preserva sucessos dual-stack e parciais',
  async () => {
    const both = new IpGeolocationService(
      provider(),
      discovery({
        IPv4: { ok: true, ip: ipv4 },
        IPv6: { ok: true, ip: ipv6 },
      }),
      () => true,
    );
    const bothResponse =
      await both.lookupPublic({
        requestId: 'both',
      });

    assert.equal(bothResponse.ok, true);
    if (bothResponse.ok) {
      assert.equal(
        bothResponse.families.filter(
          (family) => family.ok,
        ).length,
        2,
      );
    }

    for (const available of [
      'IPv4',
      'IPv6',
    ] as const) {
      const partial =
        new IpGeolocationService(
          provider(),
          discovery({
            [available]: {
              ok: true,
              ip:
                available === 'IPv4'
                  ? ipv4
                  : ipv6,
            },
          }),
          () => true,
        );
      const response =
        await partial.lookupPublic({
          requestId: available,
        });

      assert.equal(response.ok, true);
      if (response.ok) {
        assert.equal(
          response.families.filter(
            (family) => family.ok,
          ).length,
          1,
        );
      }
    }
  },
);

test(
  'falha de geolocalização de uma família não apaga a outra',
  async () => {
    const service = new IpGeolocationService(
      provider(async (ip) => {
        if (ip?.includes(':')) {
          throw {
            code: 'rate-limited',
            message: 'limite',
          };
        }

        return result(ip ?? ipv4, 'IPv4');
      }),
      discovery({
        IPv4: { ok: true, ip: ipv4 },
        IPv6: { ok: true, ip: ipv6 },
      }),
      () => true,
    );
    const response =
      await service.lookupPublic({
        requestId: 'partial-provider',
      });

    assert.equal(response.ok, true);
    if (response.ok) {
      assert.equal(response.families[0].ok, true);
      assert.equal(response.families[1].ok, false);
    }
  },
);

test(
  'timeout e cancelamento encerram consultas pendentes',
  async () => {
    const pendingDiscovery:
      PublicIpDiscoveryProvider = {
        discover(_version, signal) {
          return new Promise((_, reject) => {
            signal.addEventListener(
              'abort',
              () => reject(
                new Error('aborted'),
              ),
              { once: true },
            );
          });
        },
      };
    const timed = new IpGeolocationService(
      provider(),
      pendingDiscovery,
      () => true,
      5,
    );
    const timedResponse =
      await timed.lookupPublic({
        requestId: 'timeout',
      });

    assert.equal(timedResponse.ok, true);
    if (timedResponse.ok) {
      assert.equal(
        timedResponse.families.every(
          (family) =>
            family.ok === false &&
            family.error.code ===
              'timeout',
        ),
        true,
      );
    }

    const cancelled =
      new IpGeolocationService(
        provider(),
        pendingDiscovery,
        () => true,
        1000,
      );
    const pending =
      cancelled.lookupPublic({
        requestId: 'cancel',
      });

    assert.equal(
      cancelled.cancel('missing'),
      false,
    );
    assert.equal(
      cancelled.cancel('cancel'),
      true,
    );
    const cancelledResponse =
      await pending;

    assert.equal(cancelledResponse.ok, false);
    if (cancelledResponse.ok === false) {
      assert.equal(
        cancelledResponse.error.code,
        'cancelled',
      );
    }
  },
);
