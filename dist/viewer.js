import * as THREE from "./assets/three.module.min.js";

function parseSTL(buffer) {
  const view = new DataView(buffer);
  const count = view.getUint32(80, true);
  if (84 + count * 50 !== buffer.byteLength)
    throw new Error("Invalid project geometry");
  const vertices = [];
  const indices = [];
  const lookup = new Map();
  for (let triangle = 0; triangle < count; triangle++) {
    const offset = 84 + triangle * 50 + 12;
    for (let vertex = 0; vertex < 3; vertex++) {
      const point = [0, 1, 2].map((axis) =>
        view.getFloat32(offset + (vertex * 3 + axis) * 4, true),
      );
      const key = point.join(",");
      let index = lookup.get(key);
      if (index === undefined) {
        index = vertices.length / 3;
        lookup.set(key, index);
        vertices.push(...point);
      }
      indices.push(index);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export async function createProjectViewer(
  container,
  category,
  { signal, implantOnly = false, preview = false } = {},
) {
  const response = await fetch("assets/projects/manifest.json", { signal });
  if (!response.ok) throw new Error("Project manifest unavailable");
  const manifest = await response.json();
  if (!manifest[category]?.length)
    throw new Error("Project geometry unavailable");
  const sources = await Promise.all(
    manifest[category]
      .filter((part) => !implantOnly || part.kind === "implant")
      .map(async (part) => {
        const response = await fetch(
          preview && part.preview ? part.preview : part.file,
          { signal },
        );
        if (!response.ok)
          throw new Error("Project geometry could not be loaded");
        return { ...part, buffer: await response.arrayBuffer() };
      }),
  );
  signal?.throwIfAborted();
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, preview ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0xffffff, 0);
  renderer.domElement.setAttribute(
    "aria-label",
    "Interactive project model. Use arrow keys to rotate and plus or minus to zoom.",
  );
  renderer.domElement.tabIndex = 0;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x687967, 2.4));
  for (const [x, y, z, intensity] of [
    [-4, -6, 8, 3],
    [6, 2, 4, 2],
  ]) {
    const light = new THREE.DirectionalLight(0xffffff, intensity);
    light.position.set(x, y, z);
    scene.add(light);
  }
  const pivot = new THREE.Group();
  const model = new THREE.Group();
  try {
    for (const source of sources) {
      const mesh = new THREE.Mesh(
        parseSTL(source.buffer),
        new THREE.MeshStandardMaterial({
          color: source.kind === "implant" ? 0x397e70 : 0xc9c9bd,
          metalness: source.kind === "implant" ? 0.28 : 0,
          roughness: source.kind === "implant" ? 0.38 : 0.8,
          side: THREE.DoubleSide,
        }),
      );
      mesh.userData.kind = source.kind;
      model.add(mesh);
    }
  } catch (error) {
    model.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
    renderer.dispose();
    throw error;
  }
  const bounds = new THREE.Box3().setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());
  const scale = 4 / Math.max(...bounds.getSize(new THREE.Vector3()).toArray());
  model.position.copy(center).multiplyScalar(-scale);
  model.scale.setScalar(scale);
  pivot.add(model);
  scene.add(pivot);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.up.set(0, 0, 1);
  const render = () => renderer.render(scene, camera);
  let distance = 9.5;
  const positionCamera = () => {
    camera.position.set(0, -distance, distance * 0.14);
    camera.lookAt(0, 0, 0);
  };
  const reset = () => {
    pivot.rotation.set(0, 0, -0.35);
    distance = 9.5;
    positionCamera();
    render();
  };
  const resize = () => {
    const width = container.clientWidth,
      height = container.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    render();
  };
  container.appendChild(renderer.domElement);
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  const events = new AbortController();
  const on = (name, listener, options = {}) =>
    renderer.domElement.addEventListener(name, listener, {
      ...options,
      signal: events.signal,
    });
  let drag;
  on("pointerdown", (e) => {
    drag = { x: e.clientX, y: e.clientY };
    renderer.domElement.setPointerCapture(e.pointerId);
  });
  on("pointermove", (e) => {
    if (!drag) return;
    pivot.rotation.z += (e.clientX - drag.x) * 0.008;
    pivot.rotation.x += (e.clientY - drag.y) * 0.008;
    drag = { x: e.clientX, y: e.clientY };
    render();
  });
  on("pointerup", () => (drag = null));
  on("pointercancel", () => (drag = null));
  const zoom = (value) => {
    distance = THREE.MathUtils.clamp(distance + value, 4.5, 16);
    positionCamera();
    render();
  };
  on(
    "wheel",
    (e) => {
      if (preview) return;
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
      ].includes(e.key)
    )
      return;
    e.preventDefault();
    if (e.key === "ArrowLeft") pivot.rotation.z -= 0.15;
    if (e.key === "ArrowRight") pivot.rotation.z += 0.15;
    if (e.key === "ArrowUp") pivot.rotation.x -= 0.15;
    if (e.key === "ArrowDown") pivot.rotation.x += 0.15;
    if (["+", "="].includes(e.key)) zoom(-0.5);
    if (e.key === "-") zoom(0.5);
    render();
  });
  resize();
  reset();
  return {
    reset,
    setView(view) {
      model.traverse((mesh) => {
        if (!mesh.isMesh) return;
        mesh.visible = view !== "implant" || mesh.userData.kind === "implant";
        mesh.material.wireframe = view === "wire";
      });
      render();
    },
    dispose() {
      events.abort();
      observer.disconnect();
      model.traverse((mesh) => {
        mesh.geometry?.dispose();
        mesh.material?.dispose();
      });
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
