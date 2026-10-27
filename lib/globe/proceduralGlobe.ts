import * as THREE from 'three';
import { getDepthSpec, getMagnitudeSpec } from '@/lib/earthquakes/severity';
import { SeismicEvent } from '@/lib/earthquakes/types';

export const GLOBE_RADIUS = 1.85;

export function latLngToVector3(
  latDeg: number,
  lngDeg: number,
  radius: number = GLOBE_RADIUS,
  out: THREE.Vector3 = new THREE.Vector3()
): THREE.Vector3 {
  const phi = THREE.MathUtils.degToRad(90 - latDeg);
  const theta = THREE.MathUtils.degToRad(lngDeg + 180);

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return out.set(x, y, z);
}

const LANDMASS_POLYGONS: Array<{ name: string; highlight?: boolean; coords: Array<[number, number]> }> = [
  {
    name: 'Sumatra',
    highlight: true,
    coords: [
      [95.3, 5.6],
      [97.5, 5.1],
      [99.8, 3.2],
      [102.2, 1.2],
      [104.8, -1.8],
      [105.9, -5.8],
      [104.4, -5.9],
      [102.1, -3.8],
      [100.2, -1.2],
      [98.4, 1.5],
      [96.0, 4.2],
    ],
  },
  {
    name: 'Java',
    highlight: true,
    coords: [
      [105.2, -6.1],
      [108.5, -6.4],
      [111.2, -6.7],
      [114.4, -7.8],
      [114.3, -8.6],
      [111.0, -8.2],
      [107.8, -7.7],
      [105.3, -6.9],
    ],
  },
  {
    name: 'NusaTenggara',
    highlight: true,
    coords: [
      [114.5, -8.1],
      [116.7, -8.3],
      [119.2, -8.4],
      [122.9, -8.2],
      [125.2, -8.9],
      [124.0, -10.2],
      [120.0, -9.9],
      [116.2, -9.0],
    ],
  },
  {
    name: 'Kalimantan',
    highlight: true,
    coords: [
      [108.9, 1.2],
      [111.8, 2.8],
      [115.5, 5.2],
      [118.8, 4.5],
      [117.8, 0.8],
      [116.2, -3.5],
      [113.2, -3.4],
      [110.1, -2.8],
    ],
  },
  {
    name: 'Sulawesi',
    highlight: true,
    coords: [
      [119.5, 1.1],
      [124.9, 1.5],
      [125.2, 0.8],
      [121.2, 0.3],
      [123.3, -1.2],
      [122.9, -4.5],
      [121.5, -4.8],
      [120.4, -2.5],
      [120.3, -5.5],
      [119.3, -5.4],
      [118.9, -2.6],
    ],
  },
  {
    name: 'Maluku',
    highlight: true,
    coords: [
      [127.4, 2.1],
      [128.7, 1.5],
      [128.2, -0.8],
      [130.6, -3.1],
      [128.0, -3.6],
      [127.1, -0.4],
    ],
  },
  {
    name: 'Papua',
    highlight: true,
    coords: [
      [130.8, -0.9],
      [134.2, -0.8],
      [138.5, -2.1],
      [141.5, -2.7],
      [147.8, -6.2],
      [150.2, -10.1],
      [146.5, -8.5],
      [141.0, -8.9],
      [138.1, -8.2],
      [135.2, -4.5],
      [131.8, -2.6],
    ],
  },
  {
    name: 'Eurasia',
    coords: [
      [-9.0, 38.0],
      [10.0, 58.0],
      [40.0, 66.0],
      [90.0, 70.0],
      [140.0, 64.0],
      [165.0, 60.0],
      [142.0, 46.0],
      [129.0, 35.0],
      [121.0, 24.0],
      [109.0, 20.0],
      [103.5, 1.5],
      [98.0, 8.0],
      [90.0, 22.0],
      [78.0, 8.5],
      [68.0, 24.0],
      [50.0, 26.0],
      [35.0, 32.0],
      [15.0, 38.0],
    ],
  },
  {
    name: 'Japan',
    coords: [
      [130.5, 31.5],
      [136.0, 34.5],
      [140.5, 36.0],
      [141.5, 41.0],
      [144.5, 43.5],
      [140.0, 43.0],
      [138.0, 37.5],
      [131.0, 34.0],
    ],
  },
  {
    name: 'Philippines',
    coords: [
      [120.5, 18.2],
      [122.4, 16.0],
      [125.6, 11.5],
      [126.4, 6.5],
      [124.0, 6.2],
      [121.8, 11.0],
      [120.0, 15.0],
    ],
  },
  {
    name: 'Australia',
    coords: [
      [114.0, -22.0],
      [122.0, -17.0],
      [131.0, -12.0],
      [136.5, -12.5],
      [142.5, -11.0],
      [149.0, -20.0],
      [153.5, -28.0],
      [149.5, -37.5],
      [139.0, -36.0],
      [131.0, -32.0],
      [115.5, -34.0],
    ],
  },
  {
    name: 'Africa',
    coords: [
      [-17.0, 15.0],
      [-5.5, 35.5],
      [11.0, 37.0],
      [32.5, 31.5],
      [43.0, 12.0],
      [51.0, 11.5],
      [40.0, -10.0],
      [35.0, -24.0],
      [18.5, -34.5],
      [12.0, -17.0],
      [9.0, 4.0],
      [-8.0, 5.0],
    ],
  },
  {
    name: 'NorthAmerica',
    coords: [
      [-165.0, 62.0],
      [-130.0, 70.0],
      [-75.0, 66.0],
      [-55.0, 48.0],
      [-75.0, 35.0],
      [-81.0, 25.5],
      [-97.0, 26.0],
      [-90.0, 16.0],
      [-79.0, 9.0],
      [-105.0, 20.0],
      [-124.0, 38.0],
      [-135.0, 56.0],
    ],
  },
  {
    name: 'SouthAmerica',
    coords: [
      [-78.0, 9.0],
      [-62.0, 10.5],
      [-50.0, 1.5],
      [-35.0, -6.0],
      [-39.0, -18.0],
      [-48.0, -28.0],
      [-62.0, -40.0],
      [-69.0, -54.5],
      [-74.5, -48.0],
      [-71.5, -30.0],
      [-70.5, -18.0],
      [-81.0, -5.0],
    ],
  },
];

export const INDONESIAN_FAULT_PATHS: Array<{
  name: string;
  coords: Array<[number, number]>;
}> = [
  {
    name: 'Sunda-Banda Megathrust',
    coords: [
      [92.5, 8.0],
      [94.8, 4.2],
      [97.2, 0.8],
      [99.8, -2.5],
      [102.8, -5.8],
      [105.5, -7.8],
      [109.2, -9.4],
      [114.0, -10.5],
      [118.8, -11.0],
      [123.5, -10.6],
      [128.2, -8.6],
      [131.2, -6.2],
      [130.4, -3.8],
      [127.8, -3.2],
    ],
  },
  {
    name: 'Sesar Semangko & Palu-Koro',
    coords: [
      [95.5, 5.4],
      [99.0, 1.6],
      [102.0, -2.4],
      [104.8, -5.5],
    ],
  },
  {
    name: 'Sesar Palu-Koro & Matano',
    coords: [
      [119.5, 0.8],
      [119.9, -0.9],
      [120.6, -2.2],
      [121.8, -3.0],
      [123.2, -3.5],
    ],
  },
  {
    name: 'Sabuk Subduksi Filipina-Halmahera-Papua',
    coords: [
      [125.5, 9.5],
      [126.8, 4.5],
      [127.4, 1.2],
      [131.0, -0.6],
      [136.0, -1.4],
      [141.0, -2.4],
      [146.5, -4.5],
    ],
  },
];

export function createProceduralEarthTextures(
  isDark: boolean,
  maxAnisotropy: number
): {
  albedoMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const width = 1024;
  const height = 512;

  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = width;
  albedoCanvas.height = height;
  const ctx = albedoCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = width;
  bumpCanvas.height = height;
  const bCtx = bumpCanvas.getContext('2d')!;

  // 1. Warm Seismic Clay ocean gradient
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, height);
  if (isDark) {
    oceanGrad.addColorStop(0, '#161412');
    oceanGrad.addColorStop(0.25, '#1c1a17');
    oceanGrad.addColorStop(0.5, '#23201c');
    oceanGrad.addColorStop(0.75, '#1c1a17');
    oceanGrad.addColorStop(1, '#161412');
  } else {
    oceanGrad.addColorStop(0, '#c8c2b8');
    oceanGrad.addColorStop(0.25, '#d2cdc3');
    oceanGrad.addColorStop(0.5, '#dad5cb');
    oceanGrad.addColorStop(0.75, '#d2cdc3');
    oceanGrad.addColorStop(1, '#c8c2b8');
  }
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, width, height);

  bCtx.fillStyle = '#303030';
  bCtx.fillRect(0, 0, width, height);

  const lngLatToXY = (lng: number, lat: number): [number, number] => {
    const x = ((lng + 180) / 360) * width;
    const y = ((90 - lat) / 180) * height;
    return [x, y];
  };

  // 2. Subtle graticule lines
  ctx.strokeStyle = isDark ? 'rgba(239, 232, 220, 0.06)' : 'rgba(98, 88, 73, 0.1)';
  ctx.lineWidth = 1;
  for (let lat = -75; lat <= 75; lat += 15) {
    const [, y] = lngLatToXY(0, lat);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  for (let lng = -165; lng <= 180; lng += 15) {
    const [x] = lngLatToXY(lng, 0);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  // 3. Draw Landmass Polygons
  for (const poly of LANDMASS_POLYGONS) {
    ctx.beginPath();
    bCtx.beginPath();
    poly.coords.forEach(([lng, lat], idx) => {
      const [x, y] = lngLatToXY(lng, lat);
      if (idx === 0) {
        ctx.moveTo(x, y);
        bCtx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
        bCtx.lineTo(x, y);
      }
    });
    ctx.closePath();
    bCtx.closePath();

    if (poly.highlight) {
      ctx.fillStyle = isDark ? '#38322b' : '#eeeae2';
      ctx.strokeStyle = isDark ? '#f07a3c' : '#c2410c';
      ctx.lineWidth = 1.8;
    } else {
      ctx.fillStyle = isDark ? '#2b2722' : '#e5dfd6';
      ctx.strokeStyle = isDark ? 'rgba(196, 186, 170, 0.35)' : 'rgba(98, 88, 73, 0.35)';
      ctx.lineWidth = 1.0;
    }
    ctx.fill();
    ctx.stroke();

    bCtx.fillStyle = poly.highlight ? '#C8C8C8' : '#969696';
    bCtx.strokeStyle = '#FFFFFF';
    bCtx.lineWidth = 1.5;
    bCtx.fill();
    bCtx.stroke();
  }

  // 4. Highlight Indonesian Subduction Trenches
  for (const fault of INDONESIAN_FAULT_PATHS) {
    ctx.beginPath();
    fault.coords.forEach(([lng, lat], idx) => {
      const [x, y] = lngLatToXY(lng, lat);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = isDark ? 'rgba(240, 122, 60, 0.65)' : 'rgba(194, 65, 12, 0.65)';
    ctx.lineWidth = 2.0;
    ctx.stroke();
  }

  const albedoMap = new THREE.CanvasTexture(albedoCanvas);
  albedoMap.colorSpace = THREE.SRGBColorSpace;
  albedoMap.anisotropy = maxAnisotropy;
  albedoMap.wrapS = THREE.RepeatWrapping;
  albedoMap.wrapT = THREE.ClampToEdgeWrapping;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.anisotropy = maxAnisotropy;
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.ClampToEdgeWrapping;

  return { albedoMap, bumpMap };
}

export function createRadialContactShadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.06,
    size / 2,
    size / 2,
    size * 0.48
  );
  grad.addColorStop(0, 'rgba(42, 36, 29, 0.68)');
  grad.addColorStop(0.55, 'rgba(42, 36, 29, 0.25)');
  grad.addColorStop(1, 'rgba(42, 36, 29, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildObservatoryGlobeGroup(
  isDark: boolean,
  maxAnisotropy: number
): {
  rootGroup: THREE.Group;
  earthSpinGroup: THREE.Group;
  markersGroup: THREE.Group;
  gimbalRing: THREE.Mesh;
  dispose: () => void;
} {
  const disposables: Array<{ dispose: () => void }> = [];
  const rootGroup = new THREE.Group();
  const earthSpinGroup = new THREE.Group();
  const markersGroup = new THREE.Group();

  const { albedoMap, bumpMap } = createProceduralEarthTextures(isDark, maxAnisotropy);
  disposables.push(albedoMap, bumpMap);

  // Part 1: Primary Silhouette — Core Lithosphere Globe
  const sphereGeo = new THREE.SphereGeometry(GLOBE_RADIUS, 48, 36);
  const sphereMat = new THREE.MeshStandardMaterial({
    map: albedoMap,
    bumpMap,
    bumpScale: 0.025,
    roughnessMap: bumpMap,
    roughness: 0.72,
    metalness: 0.14,
    color: 0xffffff,
  });
  const earthMesh = new THREE.Mesh(sphereGeo, sphereMat);
  earthMesh.receiveShadow = true;
  earthSpinGroup.add(earthMesh);
  disposables.push(sphereGeo, sphereMat);

  // Part 2: Secondary Detail — Geodesic Crustal Wireframe Shell
  const crustGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.003, 24, 18);
  const crustMat = new THREE.MeshStandardMaterial({
    color: isDark ? 0xf07a3c : 0xc2410c,
    wireframe: true,
    transparent: true,
    opacity: isDark ? 0.07 : 0.06,
    roughness: 0.35,
    metalness: 0.7,
    depthWrite: false,
  });
  const crustMesh = new THREE.Mesh(crustGeo, crustMat);
  earthSpinGroup.add(crustMesh);
  disposables.push(crustGeo, crustMat);

  // Part 3: Secondary Detail — 3D Tectonic Subduction Fault Tubes
  const faultMat = new THREE.MeshStandardMaterial({
    color: isDark ? 0xf07a3c : 0xc2410c,
    emissive: isDark ? 0x7c2d12 : 0x000000,
    emissiveIntensity: 0.35,
    roughness: 0.28,
    metalness: 0.75,
  });
  disposables.push(faultMat);

  for (const fault of INDONESIAN_FAULT_PATHS) {
    const pts = fault.coords.map(([lng, lat]) =>
      latLngToVector3(lat, lng, GLOBE_RADIUS * 1.006)
    );
    const curve = new THREE.CatmullRomCurve3(pts);
    const tubeGeo = new THREE.TubeGeometry(curve, 32, 0.0085, 6, false);
    const tubeMesh = new THREE.Mesh(tubeGeo, faultMat);
    earthSpinGroup.add(tubeMesh);
    disposables.push(tubeGeo);
  }

  // Part 4: Equatorial Bounding Ring
  const eqRingGeo = new THREE.TorusGeometry(GLOBE_RADIUS * 1.008, 0.0045, 8, 96);
  eqRingGeo.rotateX(Math.PI / 2);
  const eqRingMat = new THREE.MeshStandardMaterial({
    color: isDark ? 0xc4baaa : 0x625849,
    roughness: 0.2,
    metalness: 0.85,
  });
  const eqRingMesh = new THREE.Mesh(eqRingGeo, eqRingMat);
  earthSpinGroup.add(eqRingMesh);
  disposables.push(eqRingGeo, eqRingMat);

  // Part 5: Outer Atmospheric Limb Shell
  const atmoGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.035, 32, 24);
  const atmoMat = new THREE.MeshStandardMaterial({
    color: isDark ? 0xf07a3c : 0xc2410c,
    transparent: true,
    opacity: isDark ? 0.07 : 0.05,
    roughness: 0.15,
    metalness: 0.1,
    depthWrite: false,
    side: THREE.BackSide,
  });
  const atmoMesh = new THREE.Mesh(atmoGeo, atmoMat);
  atmoMesh.renderOrder = 2;
  earthSpinGroup.add(atmoMesh);
  disposables.push(atmoGeo, atmoMat);

  earthSpinGroup.add(markersGroup);
  rootGroup.add(earthSpinGroup);

  // Part 6: Calibrated Outer Gimbal Ring (Warm Bronze/Clay PBR)
  const gimbalGeo = new THREE.TorusGeometry(GLOBE_RADIUS * 1.16, 0.016, 12, 96);
  gimbalGeo.rotateX(Math.PI * 0.42);
  gimbalGeo.rotateY(Math.PI * 0.08);
  const gimbalMat = new THREE.MeshStandardMaterial({
    color: isDark ? 0x8a8174 : 0x625849,
    roughness: 0.22,
    metalness: 0.85,
  });
  const gimbalRing = new THREE.Mesh(gimbalGeo, gimbalMat);
  rootGroup.add(gimbalRing);
  disposables.push(gimbalGeo, gimbalMat);

  // Part 7: Accent Detail — Beveled Azimuth Degree Markers
  const tickShape = new THREE.Shape();
  tickShape.moveTo(-0.012, -0.006);
  tickShape.lineTo(0.012, -0.006);
  tickShape.lineTo(0.012, 0.006);
  tickShape.lineTo(-0.012, 0.006);
  tickShape.closePath();

  const tickGeo = new THREE.ExtrudeGeometry(tickShape, {
    depth: 0.04,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 2,
  });
  const tickMat = new THREE.MeshStandardMaterial({
    color: isDark ? 0xf07a3c : 0xc2410c,
    roughness: 0.5,
    metalness: 0.4,
  });
  const tickInstanced = new THREE.InstancedMesh(tickGeo, tickMat, 24);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 24; i++) {
    const angle = (i / 24) * Math.PI * 2;
    const r = GLOBE_RADIUS * 1.16;
    dummy.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
    dummy.lookAt(0, 0, 0);
    dummy.updateMatrix();
    tickInstanced.setMatrixAt(i, dummy.matrix);
  }
  tickInstanced.instanceMatrix.needsUpdate = true;
  tickInstanced.computeBoundingSphere();
  tickInstanced.rotation.x = Math.PI * 0.42;
  tickInstanced.rotation.y = Math.PI * 0.08;
  rootGroup.add(tickInstanced);
  disposables.push(tickGeo, tickMat);

  // Part 8: Grounded Sub-Stage Observatory Pedestal
  const lathePoints = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(1.25, 0.0),
    new THREE.Vector2(1.18, 0.08),
    new THREE.Vector2(0.85, 0.14),
    new THREE.Vector2(0.65, 0.22),
    new THREE.Vector2(0.0, 0.22),
  ];
  const pedestalGeo = new THREE.LatheGeometry(lathePoints, 48);
  const pedestalMat = new THREE.MeshStandardMaterial({
    color: isDark ? 0x2b2722 : 0xd5cdc0,
    roughness: 0.6,
    metalness: 0.4,
  });
  const pedestalMesh = new THREE.Mesh(pedestalGeo, pedestalMat);
  pedestalMesh.position.y = -2.42;
  pedestalMesh.receiveShadow = true;
  rootGroup.add(pedestalMesh);
  disposables.push(pedestalGeo, pedestalMat);

  const shadowTex = createRadialContactShadowTexture();
  const shadowGeo = new THREE.CircleGeometry(2.35, 36);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: isDark ? 0.5 : 0.35,
    depthWrite: false,
  });
  const shadowDisc = new THREE.Mesh(shadowGeo, shadowMat);
  shadowDisc.position.y = -2.435;
  rootGroup.add(shadowDisc);
  disposables.push(shadowTex, shadowGeo, shadowMat);

  return {
    rootGroup,
    earthSpinGroup,
    markersGroup,
    gimbalRing,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}

export function buildSeismicMarkers(
  events: SeismicEvent[],
  selectedEventId: string | null,
  showDepthStems: boolean,
  isDark: boolean
): {
  group: THREE.Group;
  hitMeshes: THREE.Object3D[];
  selectedRingMesh: THREE.Mesh | null;
  dispose: () => void;
} {
  const disposables: Array<{ dispose: () => void }> = [];
  const group = new THREE.Group();
  const hitMeshes: THREE.Object3D[] = [];
  let selectedRingMesh: THREE.Mesh | null = null;

  const ringGeo = new THREE.TorusGeometry(1, 0.16, 8, 24);
  const beaconGeo = new THREE.OctahedronGeometry(1, 0);
  const stemGeo = new THREE.CylinderGeometry(0.0045, 0.003, 1, 6);
  const hitGeo = new THREE.SphereGeometry(0.085, 10, 10);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  disposables.push(ringGeo, beaconGeo, stemGeo, hitGeo, hitMat);

  const surfaceUp = new THREE.Vector3(0, 1, 0);
  const normalVec = new THREE.Vector3();
  const surfacePos = new THREE.Vector3();

  for (const ev of events) {
    const isSelected = ev.id === selectedEventId;
    const magSpec = getMagnitudeSpec(ev.magnitudeClass);
    const depthSpec = getDepthSpec(ev.depthCategory);

    const colorHex = isDark ? magSpec.hexDark : magSpec.hexLight;
    const depthHex = isDark ? depthSpec.hexDark : depthSpec.hexLight;

    latLngToVector3(ev.latitude, ev.longitude, GLOBE_RADIUS * 1.008, surfacePos);
    normalVec.copy(surfacePos).normalize();

    const eventNode = new THREE.Group();
    eventNode.position.copy(surfacePos);
    eventNode.quaternion.setFromUnitVectors(surfaceUp, normalVec);

    const baseScale = THREE.MathUtils.clamp((ev.magnitude - 3.2) * 0.015 + 0.022, 0.022, 0.085);
    const finalScale = isSelected ? baseScale * 1.45 : baseScale;

    const ringMat = new THREE.MeshStandardMaterial({
      color: isSelected ? 0xc2410c : colorHex,
      emissive: isSelected ? 0xc2410c : colorHex,
      emissiveIntensity: isSelected ? 0.85 : 0.35,
      roughness: 0.2,
      metalness: 0.8,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    disposables.push(ringMat);

    const collarMesh = new THREE.Mesh(ringGeo, ringMat);
    collarMesh.rotation.x = Math.PI / 2;
    collarMesh.scale.setScalar(finalScale);
    eventNode.add(collarMesh);

    if (isSelected) {
      const pulseRingMat = new THREE.MeshStandardMaterial({
        color: 0xc2410c,
        emissive: 0xc2410c,
        emissiveIntensity: 0.9,
        transparent: true,
        opacity: 0.75,
        roughness: 0.2,
        metalness: 0.8,
        depthWrite: false,
      });
      disposables.push(pulseRingMat);
      selectedRingMesh = new THREE.Mesh(ringGeo, pulseRingMat);
      selectedRingMesh.rotation.x = Math.PI / 2;
      selectedRingMesh.scale.setScalar(finalScale * 1.65);
      eventNode.add(selectedRingMesh);
    }

    const beaconMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      emissive: colorHex,
      emissiveIntensity: isSelected ? 0.65 : 0.25,
      roughness: 0.5,
      metalness: 0.35,
    });
    disposables.push(beaconMat);

    const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
    beaconMesh.position.y = finalScale * 0.7;
    beaconMesh.scale.setScalar(finalScale * 0.62);
    eventNode.add(beaconMesh);

    if (showDepthStems) {
      const stemLength = THREE.MathUtils.clamp((ev.depthKm / 650) * 0.48, 0.04, 0.52);
      const stemMat = new THREE.MeshStandardMaterial({
        color: depthHex,
        roughness: 0.68,
        metalness: 0.2,
      });
      disposables.push(stemMat);

      const stemMesh = new THREE.Mesh(stemGeo, stemMat);
      stemMesh.scale.set(1, stemLength, 1);
      stemMesh.position.y = -stemLength / 2;
      eventNode.add(stemMesh);

      const hypoCoreMesh = new THREE.Mesh(beaconGeo, stemMat);
      hypoCoreMesh.position.y = -stemLength;
      hypoCoreMesh.scale.setScalar(finalScale * 0.45);
      eventNode.add(hypoCoreMesh);
    }

    const hitProxy = new THREE.Mesh(hitGeo, hitMat);
    hitProxy.userData = { eventId: ev.id };
    hitProxy.layers.enable(1);
    eventNode.add(hitProxy);
    hitMeshes.push(hitProxy);

    group.add(eventNode);
  }

  return {
    group,
    hitMeshes,
    selectedRingMesh,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
