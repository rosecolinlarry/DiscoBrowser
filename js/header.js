import { goBackHomeWithBrowserHistory } from "./navigation.js";

export function setUpMainHeader() {
  const headerTitle = document.querySelector("h1");
  if (headerTitle) {
    headerTitle.style.cursor = "pointer";
    headerTitle.addEventListener("click", goBackHomeWithBrowserHistory);
  }
}
