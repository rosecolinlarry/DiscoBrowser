import { $, toggleElementVisibility } from "./uiHelpers.js";

var loaderTextContainer = $("homepageLoaderTextContainer");
var loadingText = $("homepageLoaderText");
export function toggleHomepageLoader(isLoading) {
  // Homepage Loader
  const homepageLoader = $("homepageLoader");
  const homepageOverlay = $("homepageOverlay");
  toggleElementVisibility(loadingText, isLoading);
  toggleElementVisibility(loaderTextContainer, isLoading);
  toggleElementVisibility(homepageLoader, isLoading);
  toggleElementVisibility(homepageOverlay, isLoading);
}

const elem = $("progressBar");

var width = 0;
export function setProgressBarPercent(percentLoaded, text="Loading...") {
  loadingText.setAttribute('data-loading-text', text);
  width = Math.max(width, percentLoaded);
  elem.style.width = percentLoaded + "%";
  elem.innerHTML = percentLoaded + "%";
}

export function moveBetweenPercent(min, max, text="Loading...", delay = 250) {
  var id = setInterval(frame, delay);
  function frame() {
    if (width >= max) {
      clearInterval(id);
      return;
    } else {
      width++;
      setProgressBarPercent(width,text);
    }
  }
}