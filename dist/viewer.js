import * as THREE from "./assets/three.module.min.js?v=b79b551e19c7";

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
  let renderer, observer;
  const events = new AbortController();
  let disposed = false;
  const cleanMeshes = () =>
    model.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
  function dispose() {
    if (disposed) return;
    disposed = true;
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
    function setView(value) {
      view = value;
      for (const mesh of model.children) {
        mesh.visible = value !== "implant" || mesh.userData.kind === "implant";
        mesh.material.wireframe = value === "wire";
        mesh.material.transparent =
          value === "xray" && mesh.userData.kind !== "implant";
        mesh.material.opacity = mesh.material.transparent ? 0.18 : 1;
        mesh.material.depthWrite = !mesh.material.transparent;
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
      distance = 9.2;
      pan.set(0, 0, 0);
      pivot.rotation.set(0, 0, -0.28);
      render();
    }
    setSeparation(separation);
    setView(view);
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
      setAngle(value) {
        pivot.rotation.set(
          value === "top" ? 1.2 : 0,
          0,
          value === "side" ? Math.PI / 2 : value === "front" ? 0 : -0.28,
        );
        render();
      },
      getState() {
        return {
          distance,
          pan: pan.toArray(),
          rotation: pivot.rotation.toArray().slice(0, 3),
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
