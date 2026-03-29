import { $, toggleElementVisibility } from "./uiHelpers.js";

export function toggleHomepageLoader(isLoading) {
  // Homepage Loader
  const homepageLoader = $("homepageLoader");
  const homepageOverlay = $("homepageOverlay");
  toggleElementVisibility(homepageLoader, isLoading);
  toggleElementVisibility(homepageOverlay, isLoading);
}