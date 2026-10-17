const projects = {
  mandibular: {
    code: "EM—001 / AESTHETIC",
    title: "Mandibular angle",
    summary:
      "Bilateral angle implant components presented alongside mandibular and maxillary anatomy. Rotate the model to examine the relationship between the implant geometry and the surrounding bone.",
  },
  orbital: {
    code: "EM—002 / RECONSTRUCTION",
    title: "Orbital floor & cheek",
    summary:
      "Three implant components presented with the upper skull and mandible. Explore the geometry in its anatomical context, or isolate the implant components for a closer look.",
  },
  subperiosteal: {
    code: "EM—003 / IMPLANT DESIGN",
    title: "Subperiosteal framework",
    summary:
      "A patient-specific framework developed around the underlying anatomy. Explore its structure and use the implant-only view to examine the design independently.",
  },
  cranial: {
    code: "EM—004 / RECONSTRUCTION",
    title: "Cranial reconstruction",
    summary:
      "Cranial implant geometry presented with the supplied anatomical models. Rotate and zoom to inspect its shape, or switch to wireframe to explore the surface structure.",
  },
};
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
const dialog = document.querySelector("#project-dialog");
const container = document.querySelector("#project-viewer");
const status = document.querySelector("#viewer-status");
const controls = [...document.querySelectorAll("[data-view]")];
let viewer, pending, trigger;
async function openProject(key, source) {
  const project = projects[key];
  if (!project) return;
  trigger = source;
  pending?.abort();
  viewer?.dispose();
  viewer = null;
  const controller = new AbortController();
  pending = controller;
  document.querySelector("#project-title").textContent = project.title;
  document.querySelector("#project-code").textContent = project.code;
  document.querySelector("#project-summary").textContent = project.summary;
  controls.forEach((button) => {
    const active = button.dataset.view === "solid";
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
    button.disabled = true;
  });
  status.hidden = false;
  status.textContent = "Loading project geometry…";
  if (!dialog.open) dialog.showModal();
  document.body.classList.add("modal-open");
  try {
    const { createProjectViewer } = await import("./viewer.js");
    controller.signal.throwIfAborted();
    const next = await createProjectViewer(container, key, {
      signal: controller.signal,
    });
    if (controller.signal.aborted) {
      next.dispose();
      return;
    }
    viewer = next;
    status.hidden = true;
    controls.forEach((button) => (button.disabled = false));
  } catch (error) {
    if (controller.signal.aborted) return;
    status.textContent =
      "The 3D view could not load. Check your connection and WebGL support, then close and reopen this project.";
    console.warn("Project viewer unavailable:", error);
  }
}
document
  .querySelectorAll("[data-project]")
  .forEach((button) =>
    button.addEventListener("click", () =>
      openProject(button.dataset.project, button),
    ),
  );
document
  .querySelector("#close-dialog")
  .addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) {
    const r = dialog.getBoundingClientRect();
    if (
      event.clientX < r.left ||
      event.clientX > r.right ||
      event.clientY < r.top ||
      event.clientY > r.bottom
    )
      dialog.close();
  }
});
dialog.addEventListener("close", () => {
  pending?.abort();
  viewer?.dispose();
  viewer = null;
  document.body.classList.remove("modal-open");
  trigger?.focus();
});
controls.forEach((button) =>
  button.addEventListener("click", () => {
    if (!viewer) return;
    viewer.setView(button.dataset.view);
    controls.forEach((item) => {
      const active = item === button;
      item.classList.toggle("active", active);
      item.setAttribute("aria-pressed", String(active));
    });
  }),
);
document
  .querySelector("#reset-view")
  .addEventListener("click", () => viewer?.reset());

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
const motionButton = document.querySelector("#motion-toggle");
let motionPaused = reducedMotion.matches;
function applyMotionPreference() {
  document.body.classList.toggle("motion-paused", motionPaused);
  motionButton.setAttribute("aria-pressed", String(motionPaused));
  motionButton.textContent = motionPaused ? "Resume motion" : "Pause motion";
}
applyMotionPreference();
motionButton.addEventListener("click", () => {
  motionPaused = !motionPaused;
  applyMotionPreference();
});
reducedMotion.addEventListener("change", (event) => {
  motionPaused = event.matches;
  applyMotionPreference();
});
const motionArt = document.querySelector(".motion-art");
motionArt.addEventListener("pointermove", (event) => {
  if (motionPaused || reducedMotion.matches || event.pointerType === "touch")
    return;
  const bounds = motionArt.getBoundingClientRect();
  motionArt.style.setProperty(
    "--art-x",
    `${((event.clientX - bounds.left) / bounds.width - 0.5) * 14}deg`,
  );
  motionArt.style.setProperty(
    "--art-y",
    `${((event.clientY - bounds.top) / bounds.height - 0.5) * -10}deg`,
  );
});
motionArt.addEventListener("pointerleave", () => {
  motionArt.style.setProperty("--art-x", "0deg");
  motionArt.style.setProperty("--art-y", "0deg");
});
if ("IntersectionObserver" in window) {
  document.body.classList.add("js-motion");
  const revealObserver = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          revealObserver.unobserve(entry.target);
        }
      }),
    { threshold: 0.08 },
  );
  document
    .querySelectorAll(".reveal")
    .forEach((element) => revealObserver.observe(element));
}
const stages = [
  [
    "Understand the individual.",
    "Start with the anatomical context. Review imaging and the clinical objective to identify the relationships that will shape the design.",
    "UNDERSTAND THE ANATOMY",
  ],
  [
    "Make the plan visible.",
    "Explore surgical movements and anatomical relationships in ProPlan. Bring the intended treatment pathway into a digital planning environment.",
    "EXPLORE THE RELATIONSHIPS",
  ],
  [
    "Give precision a form.",
    "Develop patient-specific geometry in FreeForm. Refine the implant, framework or guide in relation to the anatomy and the surgical objective.",
    "REFINE THE GEOMETRY",
  ],
  [
    "Connect design and making.",
    "Consider manufacturability and prepare the design for its production workflow, informed by experience with DLP, filament and PEEK printing.",
    "PREPARE FOR PRODUCTION",
  ],
];
document.querySelectorAll("button[data-stage]").forEach((button) =>
  button.addEventListener("click", () => {
    const index = Number(button.dataset.stage);
    document.querySelectorAll("button[data-stage]").forEach((other) => {
      const active = other === button;
      other.classList.toggle("active", active);
      other.setAttribute("aria-pressed", String(active));
    });
    document.querySelector("#stage-title").textContent = stages[index][0];
    document.querySelector("#stage-copy").textContent = stages[index][1];
    document.querySelector("#diagram-label").textContent =
      `0${index + 1} / ${stages[index][2]}`;
    document.querySelector(".journey-diagram").dataset.stage = String(index);
  }),
);

// Lightweight, on-demand implant previews. Anatomy stays inside the dialog.
const inlinePreviews = [];
for (const panel of document.querySelectorAll(".case-visual, .detail-art")) {
  const image = panel.querySelector("img");
  const key = image
    .getAttribute("src")
    .split("/")
    .pop()
    .replace("-detail.webp", "");
  const host = document.createElement("div");
  host.className = "inline-model";
  host.setAttribute("aria-label", `${projects[key].title} interactive preview`);
  panel.appendChild(host);
  const tools = document.createElement("div");
  tools.className = "inline-tools";
  const hint = document.createElement("span");
  hint.textContent = "3D PREVIEW / LOADING";
  hint.setAttribute("role", "status");
  const reset = document.createElement("button");
  reset.type = "button";
  reset.textContent = "Reset";
  reset.setAttribute("aria-label", `Reset ${projects[key].title} preview`);
  reset.hidden = true;
  tools.append(hint, reset);
  panel.appendChild(tools);
  const state = {
    panel,
    host,
    key,
    hint,
    reset,
    viewer: null,
    pending: null,
    visible: false,
  };
  inlinePreviews.push(state);
  reset.addEventListener("click", () => state.viewer?.reset());
}
async function activatePreview(state) {
  if (state.viewer || state.pending) return;
  const controller = new AbortController();
  state.pending = controller;
  state.hint.textContent = "LOADING INTERACTIVE PREVIEW";
  try {
    const { createProjectViewer } = await import("./viewer.js");
    controller.signal.throwIfAborted();
    const model = await createProjectViewer(state.host, state.key, {
      signal: controller.signal,
      implantOnly: true,
      preview: true,
    });
    if (controller.signal.aborted) {
      model.dispose();
      return;
    }
    state.viewer = model;
    state.panel.classList.add("preview-ready");
    state.reset.hidden = false;
    state.hint.textContent = "DRAG TO ROTATE · ARROW KEYS TO EXPLORE";
  } catch (error) {
    if (!controller.signal.aborted)
      state.hint.textContent = "IMAGE PREVIEW · OPEN PROJECT FOR DETAILS";
  } finally {
    if (state.pending === controller) state.pending = null;
  }
}
function deactivatePreview(state) {
  state.pending?.abort();
  state.pending = null;
  state.viewer?.dispose();
  state.viewer = null;
  state.panel.classList.remove("preview-ready");
  state.reset.hidden = true;
}
if ("IntersectionObserver" in window) {
  const previewObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const state = inlinePreviews.find(
          (item) => item.panel === entry.target,
        );
        state.visible = entry.isIntersecting;
        if (state.visible && !document.hidden) activatePreview(state);
        else deactivatePreview(state);
      }
    },
    { rootMargin: "150px 0px", threshold: 0 },
  );
  inlinePreviews.forEach((state) => previewObserver.observe(state.panel));
  document.addEventListener("visibilitychange", () =>
    inlinePreviews.forEach((state) => {
      if (document.hidden) deactivatePreview(state);
      else if (state.visible) activatePreview(state);
    }),
  );
} else {
  inlinePreviews.forEach((state) => {
    state.hint.textContent = "SELECT TO ACTIVATE 3D";
    state.panel.addEventListener("pointerenter", () => activatePreview(state), {
      once: true,
    });
  });
}
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
