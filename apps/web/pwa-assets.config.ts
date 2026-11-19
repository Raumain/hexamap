import {
  defaultAssetName,
  defineConfig,
  minimal2023Preset,
} from '@vite-pwa/assets-generator/config';

/**
 * Icônes de l'Installation, dérivées du favicon hexagonal de laiton.
 * Reproduction : `bunx pwa-assets-generator` depuis `apps/web`.
 * Les PNG produits sont versionnés : le build Docker n'a besoin d'aucun réseau.
 *
 * Le générateur écrit à côté de l'image source et n'accepte pas de dossier de
 * sortie : `assetName` préfixe donc les fichiers dans `public/icons/`.
 */
export default defineConfig({
  headLinkOptions: {
    preset: '2023',
  },
  preset: {
    ...minimal2023Preset,
    assetName: (type, size) => `icons/${defaultAssetName(type, size)}`,
  },
  images: ['public/favicon.svg'],
});
