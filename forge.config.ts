import type {
  ForgeConfig,
} from '@electron-forge/shared-types';

import {
  MakerDeb,
} from '@electron-forge/maker-deb';

import {
  MakerSquirrel,
} from '@electron-forge/maker-squirrel';

import {
  MakerZIP,
} from '@electron-forge/maker-zip';

import {
  VitePlugin,
} from '@electron-forge/plugin-vite';

import {
  FusesPlugin,
} from '@electron-forge/plugin-fuses';

import {
  FuseV1Options,
  FuseVersion,
} from '@electron/fuses';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    executableName: 'zerohub',
  },

  rebuildConfig: {},

  makers: [
    new MakerDeb(
      {
        options: {
          name: 'zerohub',
          productName: 'ZeroHub',
          genericName:
            'Technical Utility Platform',

          description:
            'Plataforma desktop modular para ferramentas técnicas.',

          productDescription:
            'ZeroHub reúne ferramentas locais de rede, OSINT, encoding, hashing e outras utilidades técnicas em uma interface desktop modular.',

          maintainer: 'devshawty',

          icon:
            './resources/icons/zerohub.png',

          categories: [
            'Utility',
            'Development',
            'Network',
          ],

          section: 'utils',
          priority: 'optional',
        },
      },
      ['linux'],
    ),

    new MakerSquirrel(
      {},
      ['win32'],
    ),

    new MakerZIP(
      {},
      ['darwin'],
    ),
  ],

  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'src/main.ts',
          config:
            'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config:
            'vite.preload.config.ts',
          target: 'preload',
        },
      ],

      renderer: [
        {
          name: 'main_window',
          config:
            'vite.renderer.config.ts',
        },
      ],
    }),

    new FusesPlugin({
      version:
        FuseVersion.V1,

      [FuseV1Options.RunAsNode]:
        false,

      [FuseV1Options.EnableCookieEncryption]:
        true,

      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]:
        false,

      [FuseV1Options.EnableNodeCliInspectArguments]:
        false,

      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]:
        true,

      [FuseV1Options.OnlyLoadAppFromAsar]:
        true,
    }),
  ],
};

export default config;
