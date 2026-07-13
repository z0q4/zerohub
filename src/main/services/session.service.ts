import {
  setActiveCase,
} from './cases.service';

import {
  loadSettings,
} from './settings.service';

export async function clearSessionOnExitIfDisabled():
  Promise<void> {
  const settings =
    await loadSettings();

  if (
    settings.saveSessionOnClose
  ) {
    return;
  }

  await setActiveCase(null);
}
