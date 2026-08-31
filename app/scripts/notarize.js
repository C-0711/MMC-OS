/**
 * scripts/notarize.js — afterSign-Hook für electron-builder.
 *
 * Notarize über Apple notarytool. Credentials NIE im Repo — aus der
 * Keychain des Build-Rechners (security notarytool keychain-profile)
 * oder aus Env (MM_NOTARY_PROFILE). Ohne beides: Warnung, Build läuft
 * unnotarisiert weiter (lokale Nutzung) — der Release-Check in
 * RELEASE.md blockiert dann hart.
 */

const { notarize } = require('@electron/notarize');

module.exports = async function notarizeHook(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== 'darwin') return;

  const profile = process.env.MM_NOTARY_PROFILE;
  if (!profile) {
    console.warn('[notarize] MM_NOTARY_PROFILE fehlt — Build wird NICHT notarisiert. ' +
      'Für Release: security notarytool store-credentials MMC-OS oder MM_NOTARY_PROFILE setzen.');
    return;
  }

  console.log(`[notarize] Reiche ein: ${appOutDir}`);
  await notarize({
    appBundleId: 'io.gl0711.mmc-os',
    appPath: `${appOutDir}/${context.packager.appInfo.productFilename}.app`,
    // notarytool Keychain-Profil — Credentials liegen in der Keychain, nicht hier.
    notarize: {
      tool: 'notarytool',
      keychainProfile: profile,
    },
  });
  console.log('[notarize] Apple hat genickt.');
};
