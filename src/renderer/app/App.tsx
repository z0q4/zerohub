import {
  useEffect,
  useState,
} from 'react';

import {
  Sidebar,
} from '../components/layout/Sidebar';

import {
  EncodingPage,
} from '../features/encoding/pages/EncodingPage';

import {
  NetworkPage,
} from '../features/network/pages/NetworkPage';

import {
  OsintPage,
} from '../features/osint/pages/OsintPage';

import {
  SettingsPage,
} from '../features/settings/pages/SettingsPage';

import {
  UtilitiesPage,
} from '../features/utilities/pages/UtilitiesPage';

import {
  DashboardPage,
} from '../pages/DashboardPage';

import {
  DEFAULT_APP_SETTINGS,
} from '../../shared/settings/settings.defaults';

import type {
  AppSettings,
} from '../../shared/settings/settings.types';

import type {
  PageId,
} from './types';

export function App() {
  const [
    activePage,
    setActivePage,
  ] =
    useState<PageId>(
      'dashboard',
    );

  const [
    settings,
    setSettings,
  ] =
    useState<AppSettings>({
      ...DEFAULT_APP_SETTINGS,
    });

  useEffect(() => {
    let mounted = true;

    window.zeroHub.settings
      .get()
      .then(
        (
          loadedSettings,
        ) => {
          if (mounted) {
            setSettings(
              loadedSettings,
            );
          }
        },
      )
      .catch((error) => {
        console.error(
          'Não foi possível carregar as configurações.',
          error,
        );
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    document
      .documentElement
      .dataset
      .accent =
        settings.accentColor;

    document
      .documentElement
      .classList
      .toggle(
        'compact-ui',
        settings.compactMode,
      );
  }, [settings]);

  async function saveSettings(
    nextSettings:
      AppSettings,
  ): Promise<void> {
    const savedSettings =
      await window.zeroHub
        .settings
        .save(
          nextSettings,
        );

    setSettings(
      savedSettings,
    );
  }

  function renderPage() {
    switch (activePage) {
      case 'dashboard':
        return (
          <DashboardPage
            onNavigate={
              setActivePage
            }
          />
        );

      case 'network':
        return <NetworkPage />;

      case 'osint':
        return <OsintPage />;

      case 'encoding':
        return <EncodingPage />;

      case 'utilities':
        return <UtilitiesPage />;

      case 'settings':
        return (
          <SettingsPage
            settings={
              settings
            }
            onSave={
              saveSettings
            }
          />
        );
    }
  }

  return (
    <div className="application">
      <Sidebar
        activePage={
          activePage
        }
        showRuntimeInfo={
          settings
            .showRuntimeInfo
        }
        onNavigate={
          setActivePage
        }
      />

      <main className="mainContent">
        {renderPage()}
      </main>
    </div>
  );
}
