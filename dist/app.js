import { initializeExperience } from "./experience.js?v=f2f46d3cdc7c";
import { scheduleVisualWork, waitForScrollIdle } from "./visual-work.js?v=f2f46d3cdc7c";

const menu = document.querySelector(".menu-button");
const navigation = document.querySelector("#navigation");
function closeMenu() {
  menu.setAttribute("aria-expanded", "false");
  menu.setAttribute("aria-label", "Open navigation");
  navigation.classList.remove("open");
}
menu.addEventListener("click", () => {
  const open = menu.getAttribute("aria-expanded") !== "true";
  menu.setAttribute("aria-expanded", String(open));
  menu.setAttribute(
    "aria-label",
    open ? "Close navigation" : "Open navigation",
  );
  navigation.classList.toggle("open", open);
});
navigation
  .querySelectorAll("a")
  .forEach((link) => link.addEventListener("click", closeMenu));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeMenu();
});
document.querySelector("#year").textContent = new Date().getFullYear();
// A parametric surface study: an abstract design object, not patient anatomy.
const surface = document.querySelector("#surface-lines");
for (let row = 0; row < 48; row++) {
  const t = row / 47;
  const y = 100 + t * 420;
  const width = 145 + 60 * Math.sin(t * Math.PI * 2 - 0.5);
  const center = 305 + 40 * Math.sin(t * Math.PI * 2);
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute(
    "d",
    `M ${center - width} ${y} C ${center - width * 0.7} ${y - 100 * Math.sin(t * Math.PI)} ${center + width * 0.1} ${y + 90} ${center + width} ${y - 15} C ${center + width * 0.55} ${y + 120 * Math.sin(t * Math.PI)} ${center - width * 0.4} ${y + 65} ${center - width} ${y}`,
  );
  path.setAttribute("opacity", String(0.3 + 0.7 * Math.sin(t * Math.PI)));
  surface.appendChild(path);
}

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
function applyMotion() {
  document.body.classList.toggle("motion-paused", reducedMotion.matches);
}
applyMotion();
reducedMotion.addEventListener("change", applyMotion);
const motionArt = document.querySelector(".motion-art");
motionArt.addEventListener("pointermove", (event) => {
  if (reducedMotion.matches || event.pointerType === "touch") return;
  const b = motionArt.getBoundingClientRect();
  motionArt.style.setProperty(
    "--art-x",
    ((event.clientX - b.left) / b.width - 0.5) * 14 + "deg",
  );
  motionArt.style.setProperty(
    "--art-y",
    ((event.clientY - b.top) / b.height - 0.5) * -10 + "deg",
  );
});
motionArt.addEventListener("pointerleave", () => {
  motionArt.style.setProperty("--art-x", "0deg");
  motionArt.style.setProperty("--art-y", "0deg");
});
initializeExperience(reducedMotion);

let scrollFrame = 0;
function updateProgress() {
  scrollFrame = 0;
  const distance = document.documentElement.scrollHeight - innerHeight;
  document.querySelector(".reading-progress").style.transform =
    `scaleX(${distance > 0 ? scrollY / distance : 0})`;
}
addEventListener(
  "scroll",
  () => {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(updateProgress);
  },
  { passive: true },
);
addEventListener("resize", updateProgress);
updateProgress();

// Full anatomy loads only near the viewport. Offscreen viewers retain their controls and camera state.
const studies = [...document.querySelectorAll("[data-case]")].map(
  (article) => ({
    article,
    key: article.dataset.case,
    host: article.querySelector(".model-host"),
    stage: article.querySelector(".model-stage"),
    loading: article.querySelector(".model-loading"),
    label: article.querySelector(".loading-label"),
    hint: article.querySelector(".model-loading small"),
    retry: article.querySelector("[data-action=retry]"),
    slider: article.querySelector(".separation-slider"),
    viewer: null,
    pending: null,
    near: false,
    touchedAt: 0,
    state: { separation: 0, view: "solid", mode: "rotate" },
    angle: null,
  }),
);
let viewerModule;
const getViewerModule = () =>
  (viewerModule ||= import("./viewer.js?v=f2f46d3cdc7c").catch((error) => {
    viewerModule = null;
    throw error;
  }));
function updateSlider(study, value) {
  const n = Number(value);
  study.state.separation = n / 100;
  study.slider.value = n;
  study.slider.style.setProperty("--fill", n + "%");
  study.slider.setAttribute(
    "aria-valuetext",
    n + " percent — " + (n === 0 ? "fitted to anatomy" : "implant separated"),
  );
  study.article.querySelector(".separation-value").innerHTML =
    n + "<span>%</span>";
  study.viewer?.setSeparation(n / 100);
}
function pressGroup(study, attribute, value) {
  study.article
    .querySelectorAll("[" + attribute + "]")
    .forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.getAttribute(attribute) === value),
      ),
    );
}
async function activate(study) {
  if (document.hidden) return;
  study.touchedAt = performance.now();
  if (study.viewer) {
    study.article.classList.remove("dormant");
    study.viewer.resume();
    return;
  }
  if (study.pending) return;
  const controller = new AbortController();
  study.pending = controller;
  let timeout = 0;
  const started = performance.now();
  try {
    await scheduleVisualWork(async () => {
      study.article.classList.remove("dormant", "failed");
      study.article.classList.add("is-loading");
      study.label.textContent = "PREPARING ANATOMY";
      study.hint.textContent = "Loading the complete 3D assembly";
      study.retry.hidden = true;
      study.loading.style.setProperty("--load", "0%");
      timeout = setTimeout(() => {
        if (study.pending !== controller || controller.signal.aborted) return;
        study.label.textContent = "TAKING A LITTLE LONGER";
        study.hint.textContent = "The page is ready. Your model will appear as soon as it downloads.";
        study.retry.hidden = false;
      }, 6000);
      trimViewerCache(study);
      await waitForScrollIdle(controller.signal);
      const { createProjectViewer } = await getViewerModule();
      controller.signal.throwIfAborted();
      const next = await createProjectViewer(study.host, study.key, {
        signal: controller.signal,
        state: study.state,
        beforeWork: () => waitForScrollIdle(controller.signal),
        onProgress: (p) =>
          study.loading.style.setProperty("--load", Math.round(p * 100) + "%"),
      });
      if (controller.signal.aborted || study.pending !== controller) {
        next.dispose();
        return;
      }
      study.viewer = next;
      next.setSeparation(study.state.separation);
      next.setView(study.state.view);
      next.setMode(study.state.mode);
      if (study.angle) {
        next.setAngle(study.angle);
        study.angle = null;
      }
      study.article.classList.add("ready");
      study.article.dataset.loadMs = Math.round(performance.now() - started);
      study.article.dispatchEvent(
        new CustomEvent("model-ready", {
          bubbles: true,
          detail: {
            key: study.key,
            milliseconds: Number(study.article.dataset.loadMs),
          },
        }),
      );
    }, {
      signal: controller.signal,
      priority: () => {
        const rect = study.stage.getBoundingClientRect();
        return Math.abs(rect.top + rect.height / 2 - innerHeight / 2);
      },
    });
  } catch (error) {
    if (controller.signal.aborted || study.pending !== controller) return;
    study.viewer?.dispose();
    study.viewer = null;
    study.host.replaceChildren();
    study.article.classList.remove("ready");
    study.article.classList.add("failed");
    study.label.textContent = "3D VIEW UNAVAILABLE";
    study.hint.textContent =
      "Check your connection and WebGL support, then retry.";
    study.retry.hidden = false;
    console.warn("Model unavailable: " + study.key, error.message);
  } finally {
    clearTimeout(timeout);
    if (study.pending === controller) {
      study.pending = null;
      study.article.classList.remove("is-loading");
    }
  }
}
function deactivate(study, { retain = false } = {}) {
  study.pending?.abort();
  study.pending = null;
  study.article.classList.remove("is-loading");
  if (study.viewer) {
    study.state = { ...study.state, ...study.viewer.getState() };
    if (retain) study.viewer.pause();
    else {
      study.viewer.dispose();
      study.viewer = null;
    }
  }
  if (!study.viewer) study.article.classList.remove("ready");
  study.article.classList.add("dormant");
}
function trimViewerCache(incoming) {
  const retained = studies.filter((study) => study !== incoming && study.viewer);
  // Three paused/visible viewers keep short reversals warm without accumulating
  // a WebGL context for every case. Eviction happens only in the idle work queue.
  retained.sort((a, b) => Number(a.near) - Number(b.near) || a.touchedAt - b.touchedAt);
  while (retained.length >= 3) deactivate(retained.shift());
}
for (const study of studies) {
  const poster = study.article.querySelector(".model-poster");
  const posterReady = () => {
    poster.classList.add("loaded");
    study.stage.classList.add("has-poster");
  };
  poster.addEventListener("load", posterReady);
  if (poster.complete && poster.naturalWidth) posterReady();
  study.slider.addEventListener("input", () =>
    updateSlider(study, study.slider.value),
  );
  study.host.addEventListener("viewer-context-lost", () => {
    deactivate(study);
    study.article.classList.remove("dormant");
    study.article.classList.add("failed");
    study.label.textContent = "3D VIEW PAUSED";
    study.hint.textContent = "Select retry to restore the model.";
    study.retry.hidden = false;
  });
  study.article.addEventListener("click", async (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.mode) {
      study.state.mode = button.dataset.mode;
      study.viewer?.setMode(study.state.mode);
      pressGroup(study, "data-mode", study.state.mode);
    }
    if (button.dataset.view) {
      study.state.view = button.dataset.view;
      study.viewer?.setView(study.state.view);
      pressGroup(study, "data-view", study.state.view);
    }
    if (button.dataset.angle) {
      if (study.viewer) study.viewer.setAngle(button.dataset.angle);
      else study.angle = button.dataset.angle;
      pressGroup(study, "data-angle", button.dataset.angle);
    }
    switch (button.dataset.action) {
      case "reset":
        study.viewer?.reset();
        study.state = { separation: 0, view: "solid", mode: "rotate" };
        study.angle = null;
        updateSlider(study, 0);
        study.viewer?.setView("solid");
        study.viewer?.setMode("rotate");
        pressGroup(study, "data-view", "solid");
        pressGroup(study, "data-mode", "rotate");
        pressGroup(study, "data-angle", "");
        break;
      case "zoom-in":
        study.viewer?.zoom(-0.65);
        break;
      case "zoom-out":
        study.viewer?.zoom(0.65);
        break;
      case "retry":
        deactivate(study);
        activate(study);
        break;
      case "touch": {
        const active = button.getAttribute("aria-pressed") !== "true";
        button.setAttribute("aria-pressed", String(active));
        button.textContent = active
          ? "Exit touch controls"
          : "Enable touch controls";
        study.stage.classList.toggle("touch-enabled", active);
        break;
      }
      case "fullscreen":
        try {
          if (document.fullscreenElement) await document.exitFullscreen();
          else if (study.article.requestFullscreen)
            await study.article.requestFullscreen();
          else toggleExpanded(study);
        } catch {
          toggleExpanded(study);
        }
        break;
    }
  });
}
document.addEventListener("fullscreenchange", () => {
  studies.forEach((study) => {
    const active = document.fullscreenElement === study.article;
    const button = study.article.querySelector("[data-action=fullscreen]");
    button.innerHTML =
      (active ? "Collapse" : "Expand") +
      ' <span aria-hidden="true">' +
      (active ? "↙" : "↗") +
      "</span>";
    button.setAttribute(
      "aria-label",
      (active ? "Collapse " : "Expand ") + study.key + " model",
    );
  });
});
const nearObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      const study = studies.find((s) => s.stage === entry.target);
      study.near = entry.isIntersecting;
      if (study.near) activate(study);
      else deactivate(study, { retain: true });
    });
  },
  { rootMargin: "300px 0px", threshold: 0 },
);
studies.forEach((s) => nearObserver.observe(s.stage));
document.addEventListener("visibilitychange", () =>
  studies.forEach((s) => {
    if (document.hidden) deactivate(s, { retain: true });
    else if (s.near) activate(s);
  }),
);
const indexLinks = [...document.querySelectorAll(".case-index a")];
const indexObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries)
      if (entry.isIntersecting) {
        indexLinks.forEach((a) => {
          const active = a.hash === "#" + entry.target.id;
          a.classList.toggle("active", active);
          if (active) {
            a.setAttribute("aria-current", "location");
            const nav = a.parentElement;
            if (nav.scrollWidth > nav.clientWidth)
              nav.scrollTo({
                left: a.offsetLeft - (nav.clientWidth - a.clientWidth) / 2,
                behavior: reducedMotion.matches ? "instant" : "smooth",
              });
          } else a.removeAttribute("aria-current");
        });
      }
  },
  { rootMargin: "-15% 0px -55% 0px", threshold: 0 },
);
studies.forEach((s) => indexObserver.observe(s.article));

function toggleExpanded(study) {
  const open = study.article.classList.toggle("expanded");
  document.body.classList.toggle("model-expanded", open);
  const button = study.article.querySelector("[data-action=fullscreen]");
  button.textContent = open ? "Collapse ↙" : "Expand ↗";
  button.setAttribute("aria-expanded", String(open));
}
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape")
    studies
      .filter((s) => s.article.classList.contains("expanded"))
      .forEach(toggleExpanded);
});
