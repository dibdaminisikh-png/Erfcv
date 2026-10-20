import * as THREE from "./assets/three.module.min.js?v=334208fa7029";
import { loadProjectGeometry } from "./viewer.js?v=334208fa7029";

// An illustrative reconstruction sequence built on the portfolio's mandibular anatomy.
export async function createSurgicalJourney(
  host,
  { reducedMotion = false, onError = () => {} } = {},
) {
  const geometry = await loadProjectGeometry(
    "assets/projects/mandibular-1.mesh",
  );
  geometry.computeBoundingBox();
  const center = geometry.boundingBox.getCenter(new THREE.Vector3());
  const scale = 3.35 / geometry.boundingBox.getSize(new THREE.Vector3()).x;
  geometry.translate(-center.x, -center.y, -center.z);
  geometry.scale(scale, scale, scale);
  geometry.computeBoundingBox();
  const xLeft = (12 - center.x) * scale,
    xRight = (40 - center.x) * scale;
  const vertices = geometry.getAttribute("position");
  function bodyAt(x) {
    const nearby = [];
    for (let i = 0; i < vertices.count; i++)
      if (
        Math.abs(vertices.getX(i) - x) < 0.09 &&
        vertices.getZ(i) < -0.13 &&
        vertices.getY(i) < 0.25
      )
        nearby.push(
          new THREE.Vector3(
            vertices.getX(i),
            vertices.getY(i),
            vertices.getZ(i),
          ),
        );
    const bottom = Math.min(...nearby.map((v) => v.z));
    const lower = nearby.filter((v) => v.z < bottom + 0.4);
    const y = Math.min(...lower.map((v) => v.y));
    return new THREE.Vector3(x, y - 0.035, bottom + 0.4);
  }
  const leftAnchor = bodyAt(xLeft),
    rightAnchor = bodyAt(xRight),
    lesionPoint = bodyAt((xLeft + xRight) / 2);
  lesionPoint.y -= 0.08;
  lesionPoint.z += 0.06;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 50);
  camera.up.set(0, 0, 1);
  camera.position.set(2.8, -6, 2.55);
  camera.lookAt(0, -0.08, -0.12);
  let renderer, observer, visibility, onVisibility;
  const events = new AbortController();
  const diagram = host.closest(".journey-diagram");
  let disposed = false, frame = 0;
  function dispose() {
    if (disposed) return;
    disposed = true;
    if (frame) cancelAnimationFrame(frame);
    events.abort();
    observer?.disconnect();
    visibility?.disconnect();
    if (onVisibility) document.removeEventListener("visibilitychange", onVisibility);
    const geometries = new Set([geometry]), mats = new Set();
    scene.traverse((o) => {
      if (o.geometry) geometries.add(o.geometry);
      if (o.material) mats.add(o.material);
    });
    geometries.forEach((g) => g.dispose());
    mats.forEach((m) => m.dispose());
    diagram.classList.remove("journey-ready");
    try {
      renderer?.dispose();
      renderer?.forceContextLoss();
    } finally {
      renderer?.domElement.remove();
    }
  }
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "low-power",
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
    renderer.localClippingEnabled = true;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.domElement.setAttribute("aria-hidden", "true");
    scene.add(new THREE.HemisphereLight(0xe3f5e9, 0x18362c, 1.6));
    for (const [x, y, z, power] of [
      [-3, -5, 6, 2.6],
      [5, -2, 2, 1.1],
      [1, 3, 4, 2],
    ]) {
      const light = new THREE.DirectionalLight(0xe3f4e7, power);
      light.position.set(x, y, z);
      scene.add(light);
    }
    const uniforms = { scanZ: { value: 1.5 }, scanOn: { value: 1 } };
    const materials = [];
    function boneMaterial(planes) {
      const material = new THREE.MeshStandardMaterial({
        color: 0xb9c5b6,
        roughness: 0.78,
        metalness: 0.03,
        side: THREE.DoubleSide,
        clippingPlanes: planes,
        transparent: true,
        opacity: 0.92,
      });
      material.onBeforeCompile = (shader) => {
        shader.uniforms.studyScanZ = uniforms.scanZ;
        shader.uniforms.studyScanOn = uniforms.scanOn;
        shader.vertexShader =
          "varying vec3 studyPosition;\n" + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nstudyPosition=(modelMatrix*vec4(position,1.0)).xyz;",
        );
        shader.fragmentShader =
          "uniform float studyScanZ; uniform float studyScanOn; varying vec3 studyPosition;\n" +
          shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <dithering_fragment>",
          "#include <dithering_fragment>\nfloat studyBand=exp(-pow((studyPosition.z-studyScanZ)*22.0,2.0)); gl_FragColor.rgb += vec3(0.16,0.56,0.34)*studyBand*studyScanOn;",
        );
      };
      material.customProgramCacheKey = () => "mandible-study-scan";
      materials.push(material);
      return material;
    }
    const leftPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), xLeft);
    const rightPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), -xRight);
    const cutPlanes = [
      new THREE.Plane(new THREE.Vector3(1, 0, 0), -xLeft),
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), xRight),
    ];
    const boneLeft = new THREE.Mesh(geometry, boneMaterial([leftPlane]));
    const boneRight = new THREE.Mesh(geometry, boneMaterial([rightPlane]));
    const segment = new THREE.Mesh(geometry, boneMaterial(cutPlanes));
    scene.add(boneLeft, boneRight, segment);
    const wireMaterial = new THREE.MeshBasicMaterial({
      color: 0xb2d6bd,
      wireframe: true,
      transparent: true,
      opacity: 0.07,
      depthWrite: false,
    });
    const boneWire = new THREE.Mesh(geometry, wireMaterial);
    scene.add(boneWire);
    const lesionGeometry = new THREE.IcosahedronGeometry(0.285, 3);
    const pos = lesionGeometry.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i),
        y = pos.getY(i),
        z = pos.getZ(i);
      const f = 1 + 0.07 * Math.sin(x * 24 + z * 13) * Math.cos(y * 19);
      pos.setXYZ(i, x * f, y * f, z * f);
    }
    lesionGeometry.computeVertexNormals();
    const lesion = new THREE.Group();
    lesion.position.copy(lesionPoint);
    lesion.scale.set(1, 0.65, 0.88);
    const lesionFill = new THREE.Mesh(
      lesionGeometry,
      new THREE.MeshBasicMaterial({
        color: 0xe7a386,
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
      }),
    );
    const lesionWire = new THREE.Mesh(
      lesionGeometry,
      new THREE.MeshBasicMaterial({
        color: 0xf0af91,
        wireframe: true,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
      }),
    );
    const lesionGlow = new THREE.Mesh(
      lesionGeometry,
      new THREE.MeshBasicMaterial({
        color: 0xf6bd9d,
        transparent: true,
        opacity: 0.04,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    );
    lesionGlow.scale.setScalar(1.2);
    lesion.add(lesionFill, lesionWire, lesionGlow);
    scene.add(lesion);
    const guideMaterials = [];
    function makeGuide(anchor) {
      const shape = new THREE.Shape();
      const w = 0.27,
        h = 0.76;
      shape.moveTo(-w / 2, -h / 2);
      shape.lineTo(w / 2, -h / 2);
      shape.lineTo(w / 2, h / 2);
      shape.lineTo(-w / 2, h / 2);
      shape.closePath();
      const slot = new THREE.Path();
      slot.moveTo(-0.018, -0.22);
      slot.lineTo(-0.018, 0.22);
      slot.lineTo(0.018, 0.22);
      slot.lineTo(0.018, -0.22);
      slot.closePath();
      shape.holes.push(slot);
      for (const y of [-0.3, 0.3]) {
        const hole = new THREE.Path();
        hole.absarc(0, y, 0.036, 0, Math.PI * 2, true);
        shape.holes.push(hole);
      }
      const material = new THREE.MeshStandardMaterial({
        color: 0xadd9cd,
        metalness: 0.26,
        roughness: 0.4,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
      });
      guideMaterials.push(material);
      const plate = new THREE.Mesh(
        new THREE.ExtrudeGeometry(shape, {
          depth: 0.095,
          bevelEnabled: true,
          bevelSegments: 2,
          steps: 1,
          bevelSize: 0.015,
          bevelThickness: 0.012,
        }),
        material,
      );
      plate.rotation.x = Math.PI / 2;
      const group = new THREE.Group();
      group.add(plate);
      group.userData.anchor = anchor.clone();
      scene.add(group);
      return group;
    }
    const guides = [makeGuide(leftAnchor), makeGuide(rightAnchor)];
    const marginGroup = new THREE.Group();
    const marginMaterial = new THREE.LineDashedMaterial({
      color: 0xdba184,
      dashSize: 0.055,
      gapSize: 0.035,
      transparent: true,
      opacity: 0,
      depthTest: false,
    });
    for (const anchor of [leftAnchor, rightAnchor]) {
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(anchor.x, anchor.y - 0.055, anchor.z - 0.46),
          new THREE.Vector3(anchor.x, anchor.y - 0.055, anchor.z + 0.51),
        ]),
        marginMaterial,
      );
      line.computeLineDistances();
      marginGroup.add(line);
    }
    scene.add(marginGroup);
    const prosthesis = new THREE.Group();
    scene.add(prosthesis);
    const capZ = Math.min(leftAnchor.z, rightAnchor.z) + 0.56;
    const prosthesisPlanes = [
      new THREE.Plane(new THREE.Vector3(1, 0, 0), -xLeft),
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), xRight),
      new THREE.Plane(new THREE.Vector3(0, 0, -1), capZ),
    ];
    const metal = new THREE.MeshStandardMaterial({
      color: 0x98d9bb,
      metalness: 0.58,
      roughness: 0.29,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      clippingPlanes: prosthesisPlanes,
    });
    const implantBody = new THREE.Mesh(geometry, metal);
    prosthesis.add(implantBody);
    const implantMaterials = [metal];
    const platePoints = [];
    for (let i = 0; i < 10; i++) {
      const x = xLeft - 0.16 + ((xRight - xLeft + 0.32) * i) / 9;
      const point = bodyAt(x);
      point.y -= 0.07;
      point.z -= 0.1;
      platePoints.push(point);
    }
    const bridgeMaterial = new THREE.MeshStandardMaterial({
      color: 0xb2ead0,
      roughness: 0.29,
      metalness: 0.6,
      transparent: true,
      opacity: 0,
    });
    implantMaterials.push(bridgeMaterial);
    prosthesis.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3(platePoints),
          48,
          0.065,
          8,
          false,
        ),
        bridgeMaterial,
      ),
    );
    for (const endpoint of [platePoints[0], platePoints.at(-1)]) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.075, 0.025, 10, 28),
        bridgeMaterial,
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.copy(endpoint);
      ring.position.z += 0.045;
      prosthesis.add(ring);
      const screwMaterial = new THREE.MeshStandardMaterial({
        color: 0xc9e7d3,
        roughness: 0.25,
        metalness: 0.7,
        transparent: true,
        opacity: 0,
      });
      implantMaterials.push(screwMaterial);
      const screw = new THREE.Mesh(
        new THREE.CylinderGeometry(0.037, 0.037, 0.045, 18),
        screwMaterial,
      );
      screw.position.copy(ring.position);
      screw.position.y -= 0.035;
      prosthesis.add(screw);
    }
    const perforationMaterial = new THREE.MeshBasicMaterial({
      color: 0x183e30,
      transparent: true,
      opacity: 0,
    });
    implantMaterials.push(perforationMaterial);
    for (let i = 1; i <= 3; i++) {
      const point = bodyAt(xLeft + ((xRight - xLeft) * i) / 4);
      point.y -= 0.045;
      point.z += 0.025;
      const hole = new THREE.Mesh(
        new THREE.CircleGeometry(0.042, 20),
        perforationMaterial,
      );
      hole.rotation.x = Math.PI / 2;
      hole.position.copy(point);
      prosthesis.add(hole);
    }
    host.append(renderer.domElement);
    const scanner = diagram.querySelector(".operative-scanner"),
      reticle = diagram.querySelector(".lesion-reticle"),
      readout = diagram.querySelector(".scan-readout");
    let stage = 0,
      motionReduced = reducedMotion,
      visible = false,
      start = 0,
      lastTime = 0,
      pulse = 0;
    let viewportWidth = 1,
      viewportHeight = 1,
      lastRendered = 0;
    let current = { piece: 0, guide: 0, implant: 0, lesion: 1, margins: 0 },
      from = { ...current },
      target = { ...current };
    const states = [
      { piece: 0, guide: 0, implant: 0, lesion: 1, margins: 0 },
      { piece: 0, guide: 1, implant: 0, lesion: 0.7, margins: 1 },
      { piece: 1, guide: 0, implant: 0, lesion: 0, margins: 1 },
      { piece: 1, guide: 0, implant: 1, lesion: 0, margins: 0 },
    ];
    const request = () => {
      if (!frame && !disposed && visible && !document.hidden)
        frame = requestAnimationFrame(tick);
    };
    function positionOverlay(point, element) {
      const p = point.clone().project(camera);
      element.style.setProperty(
        "--point-x",
        (p.x + 1) * 0.5 * viewportWidth + "px",
      );
      element.style.setProperty(
        "--point-y",
        (1 - p.y) * 0.5 * viewportHeight + "px",
      );
    }
    function resize() {
      const w = host.clientWidth,
        h = host.clientHeight;
      if (!w || !h || disposed) return;
      viewportWidth = w;
      viewportHeight = h;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      const direction = new THREE.Vector3(2.8, -6, 2.55).normalize();
      const distance = Math.max(
        6.05,
        5.0 / (2 * Math.tan(THREE.MathUtils.degToRad(33) / 2) * camera.aspect),
      );
      camera.position.copy(direction.multiplyScalar(distance));
      camera.lookAt(0, -0.08, -0.12);
      camera.updateProjectionMatrix();
      positionOverlay(lesionPoint, reticle);
      request();
    }
    function tick(time) {
      frame = 0;
      if (disposed || !visible || document.hidden) return;
      const elapsed = start
        ? THREE.MathUtils.clamp((time - start) / 1150, 0, 1)
        : 1;
      if (
        !motionReduced &&
        stage === 0 &&
        elapsed >= 1 &&
        time - lastRendered < 31
      ) {
        request();
        return;
      }
      lastRendered = time;
      const ease = motionReduced ? 1 : 1 - Math.pow(1 - elapsed, 4);
      for (const key of Object.keys(target))
        current[key] = THREE.MathUtils.lerp(from[key], target[key], ease);
      segment.position.set(
        0.2 * current.piece,
        -0.12 * current.piece,
        -0.72 * current.piece,
      );
      cutPlanes[0].constant = -xLeft - segment.position.x;
      cutPlanes[1].constant = xRight + segment.position.x;
      segment.visible = current.piece < 0.999;
      segment.material.opacity = 0.92 * (1 - current.piece);
      segment.material.color.setHex(stage === 2 ? 0xc6a38c : 0xb9c5b6);
      boneWire.visible = current.piece < 0.05; // The removed region must not remain as a wireframe ghost.
      let guideAmount = current.guide;
      if (stage === 2 && !motionReduced)
        guideAmount = Math.max(guideAmount, Math.sin(Math.PI * elapsed) * 0.9);
      guides.forEach((guide, i) => {
        guide.visible = guideAmount > 0.002;
        guide.position.copy(guide.userData.anchor);
        guide.position.y -= 0.55 * (1 - guideAmount);
        guide.position.z += 0.12 * (1 - guideAmount);
        guideMaterials[i].opacity = guideAmount * 0.9;
      });
      marginMaterial.opacity = current.margins * 0.65;
      prosthesis.visible = current.implant > 0.002;
      prosthesis.position.set(
        0,
        -0.95 * (1 - current.implant),
        0.25 * (1 - current.implant),
      );
      implantMaterials.forEach(
        (m) =>
          (m.opacity = current.implant * (m === perforationMaterial ? 0.85 : 1)),
      );
      prosthesisPlanes[2].constant = capZ + prosthesis.position.z;
      const zTop = geometry.boundingBox.max.z + 0.15,
        zBottom = geometry.boundingBox.min.z - 0.1;
      const phase = (time % 5200) / 5200;
      const wave = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);
      const scanZ = motionReduced
        ? lesionPoint.z
        : THREE.MathUtils.lerp(zTop, zBottom, wave);
      uniforms.scanZ.value = scanZ;
      uniforms.scanOn.value = stage === 0 ? 1 : 0;
      const delta = lastTime ? Math.min(time - lastTime, 50) : 16;
      lastTime = time;
      const hit =
        stage === 0 ? Math.exp(-Math.pow((scanZ - lesionPoint.z) / 0.12, 2)) : 0;
      pulse = motionReduced ? 1 : Math.max(hit, pulse * Math.exp(-delta / 370));
      lesion.visible = current.lesion > 0.002;
      lesion.position.copy(lesionPoint).add(segment.position);
      lesionFill.material.opacity = (0.1 + pulse * 0.34) * current.lesion;
      lesionWire.material.opacity = (0.2 + pulse * 0.46) * current.lesion;
      lesionGlow.material.opacity = (0.025 + pulse * 0.11) * current.lesion;
      lesionGlow.scale.setScalar(1.18 + pulse * 0.12);
      reticle.style.setProperty("--detection", pulse.toFixed(3));
      const projected = new THREE.Vector3(
        lesionPoint.x,
        lesionPoint.y,
        scanZ,
      ).project(camera);
      scanner.style.transform =
        "translateY(" + (1 - projected.y) * 0.5 * viewportHeight + "px)";
      const statusText =
        stage === 0
          ? pulse > 0.3
            ? "LESION REGION / LOCALIZED"
            : "VOLUME SCAN / IN PROGRESS"
          : [
              "",
              "OSTEOTOMIES / GUIDE-DEFINED",
              "SEGMENT / SEPARATED",
              "PROSTHESIS / IN POSITION",
            ][stage];
      if (readout.textContent !== statusText) readout.textContent = statusText;
      try {
        renderer.render(scene, camera);
      } catch (error) {
        dispose();
        onError(error);
        return;
      }
      if (!motionReduced && (stage === 0 || elapsed < 1)) request();
    }
    observer = new ResizeObserver(resize);
    observer.observe(host);
    visibility = new IntersectionObserver(
      (entries) => {
        visible = entries[0].isIntersecting;
        if (visible) request();
        else if (frame) {
          cancelAnimationFrame(frame);
          frame = 0;
        }
      },
      { threshold: 0.05 },
    );
    visibility.observe(diagram);
    onVisibility = () => {
      if (document.hidden && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else request();
    };
    document.addEventListener("visibilitychange", onVisibility);
    renderer.domElement.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      dispose();
      onError(new Error("WebGL context lost"));
    }, { signal: events.signal });
    resize();
    renderer.render(scene, camera);
    diagram.classList.add("journey-ready");
    return {
      setStage(index) {
        stage = index;
        from = { ...current };
        target = { ...states[index] };
        start = performance.now();
        pulse = 0;
        request();
      },
      setReducedMotion(value) {
        motionReduced = value;
        from = { ...states[stage] };
        target = { ...from };
        current = { ...from };
        start = 0;
        request();
      },
      getState() {
        return {
          stage,
          ...current,
          visible,
          scanActive: stage === 0 && !motionReduced && visible,
          guideCount: guides.length,
        };
      },
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
