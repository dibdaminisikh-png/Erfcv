import * as THREE from "./assets/three.module.min.js?v=334208fa7029";

let manifestPromise;
const buffers = new Map();
function assetURL(file) {
  const url = new URL(file, import.meta.url);
  url.search = new URL(import.meta.url).search;
  return url;
}
async function getBuffer(file, signal) {
  if (buffers.has(file)) return buffers.get(file);
  const response = await fetch(assetURL(file), { signal });
  if (!response.ok) throw new Error("Geometry download failed");
  const buffer = await response.arrayBuffer();
  signal?.throwIfAborted();
  buffers.set(file, buffer);
  return buffer;
}
function parseMesh(buffer) {
  const data = new DataView(buffer);
  if (data.getUint32(0, false) !== 0x454d4331)
    throw new Error("Invalid mesh header");
  const vertices = data.getUint32(4, true),
    count = data.getUint32(8, true),
    width = data.getUint32(12, true);
  if (
    ![2, 4].includes(width) ||
    count % 3 ||
    buffer.byteLength !== 40 + vertices * 6 + count * width
  )
    throw new Error("Invalid mesh data");
  const positions = new Float32Array(vertices * 3);
  for (let i = 0; i < positions.length; i++) {
    const axis = i % 3,
      min = data.getFloat32(16 + axis * 4, true),
      max = data.getFloat32(28 + axis * 4, true);
    positions[i] =
      min + (data.getUint16(40 + i * 2, true) / 65535) * (max - min);
  }
  const offset = 40 + vertices * 6;
  const indices = width === 2 ? new Uint16Array(count) : new Uint32Array(count);
  for (let i = 0; i < count; i++)
    indices[i] =
      width === 2
        ? data.getUint16(offset + i * 2, true)
        : data.getUint32(offset + i * 4, true);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  return geometry;
}
export async function createProjectViewer(
  container,
  category,
  { signal, onProgress, state = {} } = {},
) {
  const started = performance.now();
  manifestPromise ||= fetch(assetURL("assets/projects/manifest.json"))
    .then((r) => {
      if (!r.ok) throw new Error("Manifest unavailable");
      return r.json();
    })
    .catch((e) => {
      manifestPromise = null;
      throw e;
    });
  const manifest = await manifestPromise;
  signal?.throwIfAborted();
  const parts = manifest[category];
  if (!parts?.length) throw new Error("Model unavailable");
  let completed = 0;
  const sources = await Promise.all(
    parts.map(async (part) => {
      const buffer = await getBuffer(part.file, signal);
      onProgress?.(++completed / parts.length);
      return { ...part, buffer };
    }),
  );
  signal?.throwIfAborted();
  const scene = new THREE.Scene();
  const model = new THREE.Group(),
    pivot = new THREE.Group();
  let renderer,
    observer;
  const events = new AbortController();
  let disposed = false,
    frame = 0;
  const cleanMeshes = () => {
    const geometries = new Set(),
      materials = new Set();
    model.traverse((o) => {
      if (o.geometry) geometries.add(o.geometry);
      if (o.material) materials.add(o.material);
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
  };
  function dispose() {
    if (disposed) return;
    disposed = true;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    events.abort();
    observer?.disconnect();
    cleanMeshes();
    // Always detach the canvas, including failures after the first render.
    try {
      renderer?.dispose();
      renderer?.forceContextLoss();
    } finally {
      renderer?.domElement.remove();
    }
  }
  try {
    for (const source of sources) {
      const implant = source.kind === "implant",
        graft = source.kind === "graft";
      const mesh = new THREE.Mesh(
        parseMesh(source.buffer),
        new THREE.MeshStandardMaterial({
          color: implant ? 0x8adbc0 : graft ? 0xc4ad85 : 0xcac4b4,
          metalness: implant ? 0.36 : 0,
          roughness: implant ? 0.32 : 0.83,
          side: THREE.DoubleSide,
        }),
      );
      mesh.userData.kind = source.kind;
      model.add(mesh);
    }
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: "low-power",
    });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    const canvas = renderer.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute(
      "aria-label",
      "Interactive anatomical model. Drag to rotate. Shift-drag or right-drag to move. Arrow keys rotate, plus and minus zoom.",
    );
    scene.add(new THREE.HemisphereLight(0xe8fff8, 0x253c35, 1.35));
    for (const [x, y, z, intensity] of [
      [-4, -6, 8, 2.8],
      [5, -2, 1, 0.8],
      [1, 5, 5, 2],
    ]) {
      const light = new THREE.DirectionalLight(0xffffff, intensity);
      light.position.set(x, y, z);
      scene.add(light);
    }
    const bounds = new THREE.Box3().setFromObject(model),
      center = bounds.getCenter(new THREE.Vector3());
    const scale = 4 / Math.max(...bounds.getSize(new THREE.Vector3()).toArray());
    for (const mesh of model.children) {
      const c =
        mesh.geometry.boundingBox ||
        (mesh.geometry.computeBoundingBox(), mesh.geometry.boundingBox);
      const dir = c.getCenter(new THREE.Vector3()).sub(center);
      // Move each implant outwards from its fitted anatomical position, in source coordinates.
      if (dir.lengthSq() < 0.001) dir.set(0, -1, 0);
      dir.normalize().multiplyScalar(1.25 / scale);
      mesh.userData.explode = dir;
    }
    model.position.copy(center).multiplyScalar(-scale);
    model.scale.setScalar(scale);
    pivot.add(model);
    scene.add(pivot);
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.up.set(0, 0, 1);
    let distance = state.distance ?? 9.2,
      mode = state.mode || "rotate",
      separation = state.separation || 0,
      view = state.view || "solid";
    const pan = new THREE.Vector3(...(state.pan || [0, 0, 0]));
    pivot.rotation.set(...(state.rotation || [0, 0, -0.28]));
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    const displayStates = {
      solid: { anatomy: 1, implant: 1, wire: 0 },
      xray: { anatomy: 0.18, implant: 1, wire: 0 },
      wire: { anatomy: 0, implant: 0, wire: 1 },
      implant: { anatomy: 0, implant: 1, wire: 0 },
    };
    if (!displayStates[view]) view = "solid";
    const display = { ...displayStates[view] };
    let angleTween = null,
      displayTween = null;

    function wireLayer(mesh) {
      if (!mesh.userData.wireLayer) {
        // Share the original vertex buffers; only the material is added.
        const material = mesh.material.clone();
        material.wireframe = true;
        material.visible = true;
        material.polygonOffset = false;
        material.transparent = true;
        material.opacity = 0;
        material.depthWrite = false;
        // Wire lines have no front/back faces to blend twice.
        material.forceSinglePass = true;
        const wire = new THREE.Mesh(mesh.geometry, material);
        wire.visible = false;
        wire.renderOrder = 1;
        mesh.add(wire);
        mesh.userData.wireLayer = wire;
      }
      return mesh.userData.wireLayer;
    }
    function setOpacity(material, opacity) {
      const transparent = opacity < 0.9999;
      if (material.transparent !== transparent) {
        material.transparent = transparent;
        material.needsUpdate = true;
      }
      material.opacity = opacity;
      material.depthWrite = !transparent;
    }
    function applyDisplay() {
      for (const mesh of model.children) {
        const opacity = mesh.userData.kind === "implant"
          ? display.implant
          : display.anatomy;
        const surfaceVisible = opacity > 0.0001;
        const wireVisible = display.wire > 0.0001;
        mesh.visible = surfaceVisible || wireVisible;
        mesh.material.visible = surfaceVisible;
        setOpacity(mesh.material, opacity);
        // Offset the filled surface during the crossfade to avoid flickering lines.
        mesh.material.polygonOffset = surfaceVisible && wireVisible;
        mesh.material.polygonOffsetFactor = 1;
        mesh.material.polygonOffsetUnits = 1;
        const wire = wireVisible ? wireLayer(mesh) : mesh.userData.wireLayer;
        if (wire) {
          wire.visible = wireVisible;
          setOpacity(wire.material, display.wire);
        }
      }
    }
    function advance(time) {
      if (angleTween) {
        const t = THREE.MathUtils.clamp((time - angleTween.start) / 500, 0, 1);
        pivot.quaternion.slerpQuaternions(
          angleTween.from,
          angleTween.to,
          THREE.MathUtils.smootherstep(t, 0, 1),
        );
        if (t === 1) angleTween = null;
      }
      if (displayTween) {
        const t = THREE.MathUtils.clamp((time - displayTween.start) / 300, 0, 1);
        const ease = THREE.MathUtils.smootherstep(t, 0, 1);
        for (const key of Object.keys(display))
          display[key] = THREE.MathUtils.lerp(
            displayTween.from[key], displayTween.to[key], ease,
          );
        if (t === 1) displayTween = null;
        applyDisplay();
      }
    }
    function request() {
      if (!frame && !disposed && (angleTween || displayTween))
        frame = requestAnimationFrame(tick);
    }
    function tick(time) {
      frame = 0;
      if (disposed) return;
      advance(time);
      render();
      request();
    }
    function stopIdleFrame() {
      if (!angleTween && !displayTween && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    }
    function interruptAngle() {
      advance(performance.now());
      angleTween = null;
      stopIdleFrame();
    }
    function settle() {
      if (angleTween) pivot.quaternion.copy(angleTween.to);
      if (displayTween) Object.assign(display, displayTween.to);
      angleTween = displayTween = null;
      stopIdleFrame();
      applyDisplay();
      render();
    }
    reducedMotion.addEventListener(
      "change",
      () => { if (reducedMotion.matches) settle(); },
      { signal: events.signal },
    );
    function render() {
      if (disposed) return;
      pivot.position.copy(pan);
      camera.position.set(0, -distance, distance * 0.11);
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    }
    function resize() {
      const w = container.clientWidth,
        h = container.clientHeight;
      if (!w || !h || disposed) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      render();
    }
    function setSeparation(value) {
      separation = THREE.MathUtils.clamp(Number(value), 0, 1);
      for (const mesh of model.children)
        mesh.position
          .copy(mesh.userData.explode)
          .multiplyScalar(mesh.userData.kind === "implant" ? separation : 0);
      render();
    }
    function setView(value, { animate = true } = {}) {
      if (disposed || !displayStates[value]) return;
      advance(performance.now());
      view = value;
      const target = displayStates[value];
      if (
        !animate || reducedMotion.matches ||
        Object.keys(display).every((key) => display[key] === target[key])
      ) {
        Object.assign(display, target);
        displayTween = null;
        applyDisplay();
        stopIdleFrame();
      } else {
        displayTween = {
          from: { ...display }, to: { ...target }, start: performance.now(),
        };
        request();
      }
      render();
    }
    function setAngle(value) {
      if (disposed || !["front", "side"].includes(value)) return;
      advance(performance.now());
      const target = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0, 0, value === "side" ? Math.PI / 2 : 0),
      );
      if (reducedMotion.matches || pivot.quaternion.angleTo(target) < 0.000001) {
        pivot.quaternion.copy(target);
        angleTween = null;
        stopIdleFrame();
      } else {
        angleTween = {
          from: pivot.quaternion.clone(), to: target, start: performance.now(),
        };
        request();
      }
      render();
    }
    function zoom(delta) {
      distance = THREE.MathUtils.clamp(distance + delta, 5, 18);
      render();
    }
    const on = (name, fn, options = {}) =>
      canvas.addEventListener(name, fn, { ...options, signal: events.signal });
    const pointers = new Map();
    let pinch;
    on("contextmenu", (e) => e.preventDefault());
    on("pointerdown", (e) => {
      interruptAngle();
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      canvas.setPointerCapture(e.pointerId);
      if (pointers.size === 2) {
        const a = [...pointers.values()];
        pinch = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
      }
    });
    on("pointermove", (e) => {
      const previous = pointers.get(e.pointerId);
      if (!previous) return;
      const dx = e.clientX - previous.x,
        dy = e.clientY - previous.y;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const a = [...pointers.values()],
          next = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
        if (pinch) zoom((pinch - next) * 0.025);
        pinch = next;
        pan.x += dx * 0.002;
        pan.z -= dy * 0.002;
      } else if (mode === "pan" || e.shiftKey || e.buttons === 2) {
        pan.x += dx * 0.006;
        pan.z -= dy * 0.006;
      } else {
        pivot.rotation.z += dx * 0.008;
        pivot.rotation.x = THREE.MathUtils.clamp(
          pivot.rotation.x + dy * 0.008,
          -Math.PI,
          Math.PI,
        );
      }
      render();
    });
    for (const name of ["pointerup", "pointercancel", "lostpointercapture"])
      on(name, (e) => {
        pointers.delete(e.pointerId);
        pinch = null;
      });
    on(
      "wheel",
      (e) => {
        if (document.activeElement !== canvas) return;
        e.preventDefault();
        zoom(e.deltaY * 0.008);
      },
      { passive: false },
    );
    on("keydown", (e) => {
      if (
        ![
          "ArrowLeft",
          "ArrowRight",
          "ArrowUp",
          "ArrowDown",
          "+",
          "=",
          "-",
          "Home",
        ].includes(e.key)
      )
        return;
      e.preventDefault();
      if (e.key.startsWith("Arrow")) interruptAngle();
      if (e.key === "ArrowLeft") pivot.rotation.z -= 0.14;
      if (e.key === "ArrowRight") pivot.rotation.z += 0.14;
      if (e.key === "ArrowUp") pivot.rotation.x -= 0.14;
      if (e.key === "ArrowDown") pivot.rotation.x += 0.14;
      if (["+", "="].includes(e.key)) zoom(-0.5);
      if (e.key === "-") zoom(0.5);
      if (e.key === "Home") reset();
      render();
    });
    canvas.addEventListener(
      "webglcontextlost",
      (e) => {
        e.preventDefault();
        container.dispatchEvent(new CustomEvent("viewer-context-lost"));
      },
      { signal: events.signal },
    );
    container.append(canvas);
    observer = new ResizeObserver(resize);
    observer.observe(container);
    function reset() {
      interruptAngle();
      distance = 9.2;
      pan.set(0, 0, 0);
      pivot.rotation.set(0, 0, -0.28);
      render();
    }
    setSeparation(separation);
    if (!reducedMotion.matches) {
      // Prepare the blend shaders and shared wire indices behind the poster,
      // so the first Display selection animates without a compilation hitch.
      Object.assign(display, { anatomy: 0.5, implant: 0.5, wire: 0.5 });
      applyDisplay();
      render();
    }
    setView(view, { animate: false });
    resize();
    signal?.throwIfAborted();
    try {
      performance.measure("model:" + category, {
        start: started,
        end: performance.now(),
      });
    } catch { /* Optional timing must never break a rendered model. */ }
    return {
      reset,
      zoom,
      setSeparation,
      setView,
      setMode(value) {
        mode = value;
        canvas.style.cursor = mode === "pan" ? "move" : "grab";
      },
      setAngle,
      getState() {
        return {
          distance,
          pan: pan.toArray(),
          rotation: (angleTween
            ? new THREE.Euler().setFromQuaternion(angleTween.to)
            : pivot.rotation).toArray().slice(0, 3),
          mode,
          separation,
          view,
        };
      },
      getDebug() {
        return {
          meshes: model.children.length,
          anatomy: model.children.filter((x) => x.userData.kind === "anatomy")
            .length,
          implants: model.children.filter((x) => x.userData.kind === "implant")
            .length,
          separation,
          view,
          display: { ...display },
          transitions: {
            perspective: Boolean(angleTween), display: Boolean(displayTween),
          },
          frames: renderer.info.render.frame,
          drawCalls: renderer.info.render.calls,
          geometries: renderer.info.memory.geometries,
          wireLayers: model.children.filter((mesh) => mesh.userData.wireLayer).length,
          positions: model.children.map((x) => ({
            kind: x.userData.kind,
            position: x.position.toArray(),
            visible: x.visible,
          })),
          distance,
          pan: pan.toArray(),
          rotation: pivot.rotation.toArray().slice(0, 3),
        };
      },
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}

// Share downloaded anatomy without starting another project viewer.
export async function loadProjectGeometry(file, { signal } = {}) {
  return parseMesh(await getBuffer(file, signal));
}
