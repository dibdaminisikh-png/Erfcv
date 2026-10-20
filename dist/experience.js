export function initializeExperience(reducedMotion) {
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
  initializeReveals(reducedMotion);
  initializePointerLight(reducedMotion, finePointer);
  initializeSmoothScroll(reducedMotion, finePointer);
  initializeCaseNavigation();
  initializeSurgicalStory(reducedMotion);
}

function initializeReveals(reducedMotion) {
  document
    .querySelectorAll(".case-study")
    .forEach((el) => (el.dataset.reveal = "case"));
  document
    .querySelectorAll(
      ".portfolio-intro,.journey .section-heading,.journey-controls,.studio-about > div:last-child,.contact-copy",
    )
    .forEach((el) => (el.dataset.reveal = "editorial"));
  document
    .querySelectorAll(".about-mark,.contact-study")
    .forEach((el) => (el.dataset.reveal = "sculpture"));
  document.querySelector(".journey-diagram").dataset.reveal = "technical";
  const targets = [
    ...document.querySelectorAll("[data-reveal],.practice-strip"),
  ];
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-revealed", "in-view");
          if (!entry.target.matches(".practice-strip"))
            observer.unobserve(entry.target);
        } else entry.target.classList.remove("in-view");
      }
    },
    { threshold: 0.06, rootMargin: "0px 0px -4% 0px" },
  );
  targets.forEach((el) => observer.observe(el));
  const apply = () =>
    document.body.classList.toggle("experience-motion", !reducedMotion.matches);
  apply();
  reducedMotion.addEventListener("change", apply);
}

function initializePointerLight(reducedMotion, finePointer) {
  const light = document.createElement("div");
  light.className = "halftone-light";
  light.setAttribute("aria-hidden", "true");
  document.body.append(light);
  let frame = 0,
    point = null,
    current = null,
    last = 0;
  const enabled = () =>
    finePointer.matches && !reducedMotion.matches && !document.hidden;
  function hide() {
    light.classList.remove("is-visible");
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    point = null;
    current = null;
    last = 0;
  }
  function draw(time) {
    frame = 0;
    if (!point || !enabled()) return;
    const dt = last ? Math.min(time - last, 40) : 16;
    last = time;
    const blend = 1 - Math.exp(-dt / 48);
    current.x += (point.x - current.x) * blend;
    current.y += (point.y - current.y) * blend;
    light.style.transform =
      "translate3d(" + (current.x - 210) + "px," + (current.y - 210) + "px,0)";
    if (Math.abs(point.x - current.x) + Math.abs(point.y - current.y) > 0.2)
      frame = requestAnimationFrame(draw);
    else last = 0;
  }
  document.addEventListener(
    "pointermove",
    (event) => {
      if (!enabled() || event.pointerType === "touch") return;
      point = { x: event.clientX, y: event.clientY };
      current ||= { ...point };
      light.classList.add("is-visible");
      if (!frame) frame = requestAnimationFrame(draw);
    },
    { passive: true },
  );
  document.documentElement.addEventListener("pointerleave", hide);
  window.addEventListener("blur", hide);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) hide();
  });
  reducedMotion.addEventListener("change", hide);
  finePointer.addEventListener("change", hide);
}

function initializeSmoothScroll(reducedMotion, finePointer) {
  let lenis = null,
    pending = 0;
  async function configure() {
    const revision = ++pending;
    if (reducedMotion.matches || !finePointer.matches) {
      lenis?.destroy();
      lenis = null;
      return;
    }
    if (lenis) return;
    try {
      const { default: Lenis } = await import("./assets/lenis.js?v=c98ea042cbb3");
      if (revision !== pending || reducedMotion.matches || !finePointer.matches)
        return;
      lenis = new Lenis({
        autoRaf: true,
        lerp: 0.115,
        wheelMultiplier: 0.9,
        smoothWheel: true,
        syncTouch: false,
        anchors: false,
        stopInertiaOnNavigate: true,
        prevent: (node) =>
          Boolean(
            document.fullscreenElement ||
              document.body.classList.contains("model-expanded") ||
              node.closest?.(
                ".case-index,input,textarea,select,[data-lenis-prevent]",
              ) ||
              (node.tagName === "CANVAS" && document.activeElement === node),
          ),
      });
    } catch {
      /* Native scrolling remains available when the optional module cannot load. */
    }
  }
  document.addEventListener("click", (event) => {
    if (
      !lenis ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const link = event.target.closest("a[href]");
    if (!link || link.target === "_blank" || link.hasAttribute("download"))
      return;
    const url = new URL(link.href, location.href);
    if (
      url.origin !== location.origin ||
      url.pathname !== location.pathname ||
      url.search !== location.search ||
      !url.hash
    )
      return;
    let target;
    try {
      target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
    } catch {
      return;
    }
    if (!target) return;
    event.preventDefault();
    const destination = Math.max(
      0,
      scrollY + target.getBoundingClientRect().top - 105,
    );
    if (location.hash !== url.hash) history.pushState(null, "", url.hash);
    lenis.scrollTo(destination, {
      duration: 0.95,
      easing: (t) => 1 - Math.pow(1 - t, 4),
    });
  });
  const syncLock = () => {
    if (!lenis) return;
    if (
      document.fullscreenElement ||
      document.body.classList.contains("model-expanded")
    )
      lenis.stop();
    else lenis.start();
  };
  document.addEventListener("fullscreenchange", syncLock);
  new MutationObserver(syncLock).observe(document.body, {
    attributes: true,
    attributeFilter: ["class"],
  });
  reducedMotion.addEventListener("change", configure);
  finePointer.addEventListener("change", configure);
  configure();
}

function initializeCaseNavigation() {
  const nav = document.querySelector(".case-index");
  const update = () => {
    const active = nav.querySelector("a.active") || nav.querySelector("a");
    nav.style.setProperty("--active-left", active.offsetLeft + "px");
    nav.style.setProperty("--active-width", active.offsetWidth + "px");
  };
  new MutationObserver(update).observe(nav, {
    subtree: true,
    attributes: true,
    attributeFilter: ["class"],
  });
  new ResizeObserver(update).observe(nav);
  update();
}

function initializeSurgicalStory(reducedMotion) {
  const section = document.querySelector("#approach"),
    diagram = section.querySelector(".journey-diagram"),
    buttons = [...section.querySelectorAll("button[data-stage]")];
  const play = section.querySelector(".sequence-play"),
    next = section.querySelector(".sequence-next");
  const stages = [
    {
      title: "See the anatomy.<br/>Define the challenge.",
      copy: "CT-based segmentation brings the mandible and lesion region into a shared 3D plan. The anatomy, extent of the lesion and surgeon-defined resection margins inform every design decision.",
      category: "CT-BASED SEGMENTATION",
      label: "ANALYZE THE ANATOMY",
      code: "SCAN",
      tags: ["ANATOMICAL CONTEXT", "LESION MAPPING"],
    },
    {
      title: "A considered plan.<br/>A precise surgical reference.",
      copy: "Patient-specific cutting guides conform to the mandibular surface, translating planned osteotomies and fixation positions into a tangible reference. Digital intent takes on a form the surgical team can work with.",
      category: "PATIENT-SPECIFIC CUTTING GUIDES",
      label: "GUIDE THE RESECTION",
      code: "PLAN",
      tags: ["BONE-ADAPTED FIT", "PLANNED OSTEOTOMIES"],
    },
    {
      title: "Define the removal.<br/>Understand what remains.",
      copy: "The planned segment is separated along the guide-defined osteotomies. Reviewing the resulting defect in its anatomical context helps align the reconstruction geometry with the remaining mandible.",
      category: "VIRTUAL SEGMENTAL RESECTION",
      label: "REVIEW THE PLANNED DEFECT",
      code: "RESECT",
      tags: ["PLANNED MARGINS", "REMAINING ANATOMY"],
    },
    {
      title: "Reconnect the form.<br/>Design for the individual.",
      copy: "A patient-specific prosthesis bridges the planned defect and aligns with the remaining mandible. Contour and fixation features are refined together, connecting surgical intent with manufacturable design.",
      category: "PATIENT-SPECIFIC RECONSTRUCTION",
      label: "POSITION THE PROSTHESIS",
      code: "RESTORE",
      tags: ["ANATOMICAL CONTOUR", "CONSIDERED FIXATION"],
    },
  ];
  let stage = 0,
    viewer = null,
    loading = null,
    playing = false,
    timer = 0;
  function stop() {
    clearTimeout(timer);
    playing = false;
    play.setAttribute("aria-pressed", "false");
    play.innerHTML =
      '<span aria-hidden="true">▷</span> ' +
      (stage === 3 ? "Replay the sequence" : "Play the sequence");
  }
  function select(index, automatic = false) {
    if (!automatic) stop();
    stage = index;
    const info = stages[index];
    buttons.forEach((button, i) => {
      button.classList.toggle("active", i === index);
      button.classList.toggle("completed", i < index);
      button.setAttribute("aria-pressed", String(i === index));
    });
    diagram.dataset.stage = index;
    section.style.setProperty(
      "--process-progress",
      ((index + 1) / 4) * 100 + "%",
    );
    section.querySelector("#stage-title").innerHTML = info.title;
    section.querySelector("#stage-copy").textContent = info.copy;
    section.querySelector(".stage-category").textContent = info.category;
    section.querySelector(".stage-tags").innerHTML = info.tags
      .map((tag) => "<span>" + tag + "</span>")
      .join("");
    section.querySelector("#diagram-label").textContent =
      String(index + 1).padStart(2, "0") + " / " + info.label;
    section.querySelector(".process-stage-code").textContent =
      info.code + " — " + String(index + 1).padStart(2, "0");
    next.innerHTML =
      (index === 3 ? "Back to scan" : "Next stage") +
      ' <span aria-hidden="true">' +
      (index === 3 ? "↺" : "→") +
      "</span>";
    next.setAttribute(
      "aria-label",
      index === 3
        ? "Return to anatomy analysis"
        : "Next stage: " +
            ["", "surgical guide", "planned resection", "prosthesis placement"][
              index + 1
            ],
    );
    if (!reducedMotion.matches)
      section.querySelector(".stage-description").animate?.(
        [
          { opacity: 0.15, transform: "translateY(10px)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
        { duration: 500, easing: "cubic-bezier(.16,1,.3,1)" },
      );
    viewer?.setStage(index);
  }
  buttons.forEach((button, i) =>
    button.addEventListener("click", () => select(i)),
  );
  next.addEventListener("click", () => select((stage + 1) % 4));
  function playStage(index) {
    select(index, true);
    timer = setTimeout(() => {
      if (index < 3) playStage(index + 1);
      else stop();
    }, [5200, 3700, 3000, 4000][index]);
  }
  play.setAttribute("aria-pressed", "false");
  play.addEventListener("click", () => {
    if (playing) {
      stop();
      return;
    }
    playing = true;
    play.setAttribute("aria-pressed", "true");
    play.innerHTML = '<span aria-hidden="true">Ⅱ</span> Stop sequence';
    playStage(0);
  });
  const retry = document.createElement("button");
  retry.className = "journey-retry";
  retry.textContent = "Retry 3D sequence ↗";
  retry.hidden = true;
  diagram.append(retry);
  function unavailable(error) {
    stop();
    viewer?.dispose();
    viewer = null;
    diagram.classList.remove("journey-ready");
    diagram.classList.add("journey-unavailable");
    retry.hidden = false;
    console.warn("Surgical illustration unavailable:", error.message);
  }
  retry.addEventListener("click", () => load());
  async function load() {
    if (viewer || loading) return;
    diagram.classList.add("journey-loading");
    diagram.classList.remove("journey-unavailable");
    retry.hidden = true;
    loading = import("./surgical-journey.js?v=c98ea042cbb3")
      .then(async ({ createSurgicalJourney }) => {
        viewer = await createSurgicalJourney(
          section.querySelector(".journey-canvas"),
          { reducedMotion: reducedMotion.matches, onError: unavailable },
        );
        viewer.setReducedMotion(reducedMotion.matches);
        viewer.setStage(stage);
      })
      .catch(unavailable)
      .finally(() => {
        diagram.classList.remove("journey-loading");
        loading = null;
      });
  }
  new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) load();
      else if (playing) stop();
    },
    { rootMargin: "250px 0px" },
  ).observe(section);
  reducedMotion.addEventListener("change", () => {
    stop();
    viewer?.setReducedMotion(reducedMotion.matches);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
  });
}
