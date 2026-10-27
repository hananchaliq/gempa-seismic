'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  ChevronDown,
  ChevronUp,
  Compass,
  Layers,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react';
import { useSeismaTheme } from '@/components/theme/ThemeProvider';
import { formatCommaNumber } from '@/lib/earthquakes/parser';
import {
  DEPTH_SCALE_SPECS,
  MAGNITUDE_SCALE_SPECS,
  getDepthSpec,
  getMagnitudeSpec,
} from '@/lib/earthquakes/severity';
import { SeismicEvent } from '@/lib/earthquakes/types';
import {
  GLOBE_RADIUS,
  buildObservatoryGlobeGroup,
  buildSeismicMarkers,
  latLngToVector3,
} from '@/lib/globe/proceduralGlobe';

export type GlobeCameraPreset =
  | 'indonesia'
  | 'global'
  | 'banda_deep'
  | 'sumatra_trench'
  | 'selected_event';

interface SeismicGlobe3DProps {
  events: SeismicEvent[];
  selectedEvent: SeismicEvent | null;
  onSelectEvent: (event: SeismicEvent) => void;
  cameraPreset?: GlobeCameraPreset;
  onSwitchTo2DMap?: () => void;
}

const _scratchTargetPos = new THREE.Vector3();
const _scratchLookAt = new THREE.Vector3();
const _scratchMouse = new THREE.Vector2();

function detectSoftwareWebGL(): { supported: boolean; isSoftwareGl: boolean } {
  if (typeof document === 'undefined') {
    return { supported: true, isSoftwareGl: true };
  }
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return { supported: false, isSoftwareGl: true };
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    const isSoft = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    return { supported: true, isSoftwareGl: isSoft };
  } catch {
    return { supported: false, isSoftwareGl: true };
  }
}

export function SeismicGlobe3D({
  events,
  selectedEvent,
  onSelectEvent,
  cameraPreset = 'indonesia',
  onSwitchTo2DMap,
}: SeismicGlobe3DProps) {
  const { resolvedTheme, reducedMotion } = useSeismaTheme();
  const canvasMountRef = useRef<HTMLDivElement | null>(null);

  const [webglSupported, setWebglSupported] = useState<boolean>(true);
  const [fallback2DMode, setFallback2DMode] = useState<boolean>(false);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [showDepthStems, setShowDepthStems] = useState<boolean>(true);
  const [activePreset, setActivePreset] = useState<GlobeCameraPreset>(cameraPreset);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [hoveredEvent, setHoveredEvent] = useState<SeismicEvent | null>(null);

  const eventsRef = useRef<SeismicEvent[]>(events);
  const onSelectRef = useRef(onSelectEvent);
  const autoRotateRef = useRef<boolean>(autoRotate && !reducedMotion);
  const reducedMotionRef = useRef<boolean>(reducedMotion);

  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  useEffect(() => {
    onSelectRef.current = onSelectEvent;
  }, [onSelectEvent]);

  useEffect(() => {
    autoRotateRef.current = autoRotate && !reducedMotion;
    reducedMotionRef.current = reducedMotion;
  }, [autoRotate, reducedMotion]);

  useEffect(() => {
    setActivePreset(cameraPreset);
  }, [cameraPreset]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const sceneContextRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    globeData: ReturnType<typeof buildObservatoryGlobeGroup>;
    markersData: ReturnType<typeof buildSeismicMarkers> | null;
    desiredCamPos: THREE.Vector3;
    desiredLookAt: THREE.Vector3;
    transitionActive: boolean;
    requestRender: () => void;
    isSoftwareGl: boolean;
  } | null>(null);

  const computePresetCameraTargets = (
    preset: GlobeCameraPreset,
    focusedEvent: SeismicEvent | null
  ) => {
    if (preset === 'selected_event' && focusedEvent) {
      latLngToVector3(
        focusedEvent.latitude,
        focusedEvent.longitude,
        GLOBE_RADIUS * 2.25,
        _scratchTargetPos
      );
      latLngToVector3(
        focusedEvent.latitude,
        focusedEvent.longitude,
        GLOBE_RADIUS * 0.35,
        _scratchLookAt
      );
      return;
    }
    if (preset === 'banda_deep') {
      latLngToVector3(-6.5, 129.5, GLOBE_RADIUS * 2.15, _scratchTargetPos);
      latLngToVector3(-6.5, 129.5, GLOBE_RADIUS * 0.3, _scratchLookAt);
      return;
    }
    if (preset === 'sumatra_trench') {
      latLngToVector3(-1.5, 100.5, GLOBE_RADIUS * 2.25, _scratchTargetPos);
      latLngToVector3(-1.5, 100.5, GLOBE_RADIUS * 0.3, _scratchLookAt);
      return;
    }
    if (preset === 'global') {
      latLngToVector3(8.0, 118.0, GLOBE_RADIUS * 3.1, _scratchTargetPos);
      _scratchLookAt.set(0, 0, 0);
      return;
    }
    latLngToVector3(-4.0, 118.0, GLOBE_RADIUS * 2.45, _scratchTargetPos);
    latLngToVector3(-3.0, 118.0, GLOBE_RADIUS * 0.2, _scratchLookAt);
  };

  useEffect(() => {
    const mountEl = canvasMountRef.current;
    if (!mountEl || fallback2DMode) return;

    const { supported, isSoftwareGl } = detectSoftwareWebGL();
    if (!supported) {
      setWebglSupported(false);
      return;
    }

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglSupported(false);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = Math.max(320, mountEl.clientWidth);
    const height = Math.max(360, mountEl.clientHeight);
    renderer.setSize(width, height);
    mountEl.innerHTML = '';
    mountEl.appendChild(renderer.domElement);

    const isDark = document.documentElement.classList.contains('dark');
    // Match Seismic Clay well background (#1c1a17 dark, #ddd6cb light)
    const bgHex = isDark ? 0x1c1a17 : 0xddd6cb;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(bgHex);
    scene.fog = new THREE.FogExp2(bgHex, 0.042);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 50);

    const hemiLight = new THREE.HemisphereLight(
      isDark ? 0xf59a66 : 0xfff8ee,
      isDark ? 0x1c1a17 : 0x96846c,
      isDark ? 1.0 : 1.2
    );
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff4e0, isDark ? 2.1 : 1.85);
    keyLight.position.set(5, 6, 5);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.width = 1024;
      keyLight.shadow.mapSize.height = 1024;
      const d = 3.5;
      keyLight.shadow.camera.left = -d;
      keyLight.shadow.camera.right = d;
      keyLight.shadow.camera.top = d;
      keyLight.shadow.camera.bottom = -d;
      keyLight.shadow.camera.near = 1;
      keyLight.shadow.camera.far = 18;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xf07a3c, isDark ? 1.25 : 0.8);
    rimLight.position.set(-5, 3, -4);
    scene.add(rimLight);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const globeData = buildObservatoryGlobeGroup(isDark, maxAniso);
    scene.add(globeData.rootGroup);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.minDistance = GLOBE_RADIUS * 1.35;
    controls.maxDistance = GLOBE_RADIUS * 3.8;

    computePresetCameraTargets('indonesia', null);
    camera.position.copy(_scratchTargetPos);
    controls.target.copy(_scratchLookAt);
    controls.update();

    const desiredCamPos = _scratchTargetPos.clone();
    const desiredLookAt = _scratchLookAt.clone();

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let isCanvasVisible = true;
    let lastFrameTimeMs = performance.now();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (gl && typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = window.setTimeout(cb, 80);
      }
    }

    function requestRender() {
      if (!isCanvasVisible || document.hidden) return;
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame(() => {
        renderDirty = false;
        const nowMs = performance.now();
        const dt = Math.min(Math.max((nowMs - lastFrameTimeMs) / 1000, 0.001), 0.1);
        lastFrameTimeMs = nowMs;
        const ctx = sceneContextRef.current;

        if (ctx) {
          if (ctx.transitionActive) {
            const snapImmediate = isSoftwareGl || reducedMotionRef.current;
            const alpha = snapImmediate ? 1 : 1 - Math.exp(-5.5 * dt);
            camera.position.lerp(ctx.desiredCamPos, alpha);
            controls.target.lerp(ctx.desiredLookAt, alpha);
            if (
              snapImmediate ||
              (camera.position.distanceToSquared(ctx.desiredCamPos) < 0.0004 &&
                controls.target.distanceToSquared(ctx.desiredLookAt) < 0.0004)
            ) {
              camera.position.copy(ctx.desiredCamPos);
              controls.target.copy(ctx.desiredLookAt);
              ctx.transitionActive = false;
            } else {
              renderDirty = true;
            }
          }

          if (autoRotateRef.current && !ctx.transitionActive && !isSoftwareGl) {
            globeData.earthSpinGroup.rotation.y += dt * 0.12;
            renderDirty = true;
          }
        }

        controls.update();
        renderer.render(scene, camera);

        const done = () => {
          renderBusy = false;
          if (renderDirty || autoRotateRef.current) {
            requestRender();
          }
        };
        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    }

    const onControlStart = () => {
      if (sceneContextRef.current) {
        sceneContextRef.current.transitionActive = false;
      }
    };
    const onControlChange = () => {
      requestRender();
    };
    controls.addEventListener('start', onControlStart);
    controls.addEventListener('change', onControlChange);

    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    let pointerDownPos = { x: 0, y: 0 };
    let lastHoverTime = 0;

    const handlePointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (dist > 6) return;
      const ctx = sceneContextRef.current;
      if (!ctx || !ctx.markersData) return;

      const rect = renderer.domElement.getBoundingClientRect();
      _scratchMouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _scratchMouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(_scratchMouse, camera);
      const hits = raycaster.intersectObjects(ctx.markersData.hitMeshes, false);
      if (hits.length > 0) {
        const hitId = hits[0].object.userData?.eventId;
        const found = eventsRef.current.find((ev) => ev.id === hitId);
        if (found) {
          onSelectRef.current(found);
        }
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      const now = Date.now();
      if (now - lastHoverTime < 65) return;
      lastHoverTime = now;

      const ctx = sceneContextRef.current;
      if (!ctx || !ctx.markersData) return;

      const rect = renderer.domElement.getBoundingClientRect();
      _scratchMouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _scratchMouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(_scratchMouse, camera);
      const hits = raycaster.intersectObjects(ctx.markersData.hitMeshes, false);
      if (hits.length > 0) {
        const hitId = hits[0].object.userData?.eventId;
        const found = eventsRef.current.find((ev) => ev.id === hitId) || null;
        setHoveredEvent(found);
        renderer.domElement.style.cursor = 'pointer';
      } else {
        setHoveredEvent(null);
        renderer.domElement.style.cursor = 'grab';
      }
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);

    const handleResize = () => {
      if (!mountEl) return;
      const w = Math.max(320, mountEl.clientWidth);
      const h = Math.max(360, mountEl.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      requestRender();
    };
    window.addEventListener('resize', handleResize);

    const observer = new IntersectionObserver(
      (entries) => {
        isCanvasVisible = entries[0]?.isIntersecting ?? true;
        if (isCanvasVisible) requestRender();
      },
      { threshold: 0.05 }
    );
    observer.observe(mountEl);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setFallback2DMode(true);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);

    sceneContextRef.current = {
      scene,
      camera,
      renderer,
      controls,
      globeData,
      markersData: null,
      desiredCamPos,
      desiredLookAt,
      transitionActive: false,
      requestRender,
      isSoftwareGl,
    };

    requestRender();

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
      controls.removeEventListener('start', onControlStart);
      controls.removeEventListener('change', onControlChange);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      controls.dispose();
      if (sceneContextRef.current?.markersData) {
        sceneContextRef.current.markersData.dispose();
      }
      globeData.dispose();
      envTexture.dispose();
      renderer.dispose();
      sceneContextRef.current = null;
    };
  }, [fallback2DMode]);

  useEffect(() => {
    const ctx = sceneContextRef.current;
    if (!ctx) return;
    const isDark = resolvedTheme === 'dark';
    const bgHex = isDark ? 0x1c1a17 : 0xddd6cb;
    ctx.scene.background = new THREE.Color(bgHex);
    ctx.scene.fog = new THREE.FogExp2(bgHex, 0.042);

    ctx.scene.remove(ctx.globeData.rootGroup);
    ctx.globeData.dispose();
    const maxAniso = ctx.renderer.capabilities.getMaxAnisotropy();
    const newGlobe = buildObservatoryGlobeGroup(isDark, maxAniso);
    ctx.globeData = newGlobe;
    ctx.scene.add(newGlobe.rootGroup);

    const newMarkers = buildSeismicMarkers(
      events,
      selectedEvent?.id ?? null,
      showDepthStems,
      isDark
    );
    if (ctx.markersData) ctx.markersData.dispose();
    ctx.markersData = newMarkers;
    ctx.globeData.markersGroup.add(newMarkers.group);

    ctx.requestRender();
  }, [resolvedTheme]);

  useEffect(() => {
    const ctx = sceneContextRef.current;
    if (!ctx) return;
    const isDark = resolvedTheme === 'dark';

    if (ctx.markersData) {
      ctx.globeData.markersGroup.remove(ctx.markersData.group);
      ctx.markersData.dispose();
    }

    const newMarkers = buildSeismicMarkers(
      events,
      selectedEvent?.id ?? null,
      showDepthStems,
      isDark
    );
    ctx.markersData = newMarkers;
    ctx.globeData.markersGroup.add(newMarkers.group);
    ctx.requestRender();
  }, [events, selectedEvent, showDepthStems, resolvedTheme]);

  useEffect(() => {
    const ctx = sceneContextRef.current;
    if (!ctx) return;

    ctx.globeData.earthSpinGroup.rotation.y = 0;

    computePresetCameraTargets(activePreset, selectedEvent);
    ctx.desiredCamPos.copy(_scratchTargetPos);
    ctx.desiredLookAt.copy(_scratchLookAt);
    ctx.transitionActive = true;
    ctx.requestRender();
  }, [activePreset, selectedEvent]);

  const handleSelectPreset = (preset: GlobeCameraPreset) => {
    setActivePreset(preset);
    const ctx = sceneContextRef.current;
    if (!ctx) return;
    ctx.globeData.earthSpinGroup.rotation.y = 0;
    computePresetCameraTargets(preset, selectedEvent);
    ctx.desiredCamPos.copy(_scratchTargetPos);
    ctx.desiredLookAt.copy(_scratchLookAt);
    ctx.transitionActive = true;
    ctx.requestRender();
  };

  useEffect(() => {
    const ctx = sceneContextRef.current;
    if (ctx && autoRotate && !reducedMotion) {
      ctx.requestRender();
    }
  }, [autoRotate, reducedMotion]);

  if (!webglSupported || fallback2DMode) {
    return (
      <div
        data-testid="globe-2d-fallback"
        className="card relative w-full h-[520px] overflow-hidden flex flex-col justify-between"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--rule)] pb-3">
          <div>
            <h3 className="text-base font-bold text-[var(--ink)]">
              Proyeksi Geospasial 2D Indonesia (Mode Ringan Non-WebGL)
            </h3>
            <p className="text-xs text-[var(--ink-3)]">
              Menampilkan seluruh koordinat episenter dan kedalaman hiposenter secara proporsional.
            </p>
          </div>
          {webglSupported && (
            <button
              type="button"
              onClick={() => setFallback2DMode(false)}
              className="btn btn--accent btn--sm"
            >
              Aktifkan Kembali Globe 3D
            </button>
          )}
        </div>

        <div className="my-3 flex-1 relative well flex items-center justify-center overflow-hidden">
          <svg
            viewBox="0 0 800 360"
            className="w-full h-full max-h-[380px]"
            role="img"
            aria-label="Peta Proyeksi Episenter Gempa Indonesia"
          >
            {events.map((ev) => {
              const x = ((ev.longitude - 90) / 55) * 720 + 40;
              const y = ((8 - ev.latitude) / 22) * 300 + 30;
              const clampedX = Math.max(24, Math.min(776, x));
              const clampedY = Math.max(24, Math.min(336, y));
              const isSelected = selectedEvent?.id === ev.id;
              const spec = getMagnitudeSpec(ev.magnitudeClass);
              return (
                <g
                  key={ev.id}
                  onClick={() => onSelectEvent(ev)}
                  className="cursor-pointer"
                >
                  <circle
                    cx={clampedX}
                    cy={clampedY}
                    r={isSelected ? spec.markerRadiusPx + 5 : spec.markerRadiusPx}
                    fill={resolvedTheme === 'dark' ? spec.hexDark : spec.hexLight}
                    fillOpacity={isSelected ? 0.92 : 0.72}
                    stroke="#FFFFFF"
                    strokeWidth={isSelected ? 2.5 : 1}
                  />
                </g>
              );
            })}
          </svg>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--ink-3)]">
          <span>Klik titik kejadian untuk memilih gempa.</span>
          {onSwitchTo2DMap && (
            <button
              type="button"
              onClick={onSwitchTo2DMap}
              className="font-bold text-[var(--accent-ink)] underline cursor-pointer bg-transparent border-0"
            >
              Lompat ke Peta Utama
            </button>
          )}
        </div>
      </div>
    );
  }

  const activeInspectEvent = hoveredEvent || selectedEvent;

  return (
    <div
      data-testid="seismic-globe-viewport"
      className="card !p-3 relative w-full h-[580px] sm:h-[650px] overflow-hidden select-none"
    >
      <div
        ref={canvasMountRef}
        className="w-full h-full rounded-[16px] overflow-hidden shadow-[var(--inset-sm)] cursor-grab active:cursor-grabbing"
        aria-label="Kanvas Observatorium Globe Seismik 3D Interaktif"
      />

      {/* Top Overlay: Active Event Telemetry & Keyboard Selector */}
      <div className="pointer-events-none absolute top-6 left-6 right-6 flex flex-wrap items-start justify-between gap-4 z-10">
        <div className="pointer-events-auto max-w-md rounded-[16px] bg-[var(--clay)] shadow-[var(--raise-sm)] px-4 py-3">
          <div className="text-[11px] font-mono font-bold text-[var(--accent-ink)]">
            OBSERVATORIUM LITOSFER 3D · SKALA KEDALAMAN PROPORSIONAL
          </div>
          {activeInspectEvent ? (
            <div className="mt-1 space-y-0.5">
              <div className="flex items-baseline gap-2.5">
                <span className="num text-lg font-bold text-[var(--ink)]">
                  M {formatCommaNumber(activeInspectEvent.magnitude, 1)}
                </span>
                <span className="num text-xs font-semibold text-[var(--accent-ink)]">
                  Kedalaman {activeInspectEvent.depthKm} km (
                  {getDepthSpec(activeInspectEvent.depthCategory).labelId})
                </span>
              </div>
              <div className="text-xs font-semibold text-[var(--ink)] truncate">
                {activeInspectEvent.region}
              </div>
              <div className="text-[11px] num text-[var(--ink-3)]">
                {activeInspectEvent.coordinatesText} · {activeInspectEvent.formattedTimeWib}
              </div>
            </div>
          ) : (
            <p className="mt-1 text-xs text-[var(--ink-2)]">
              Klik penanda episenter pada bola bumi untuk memeriksa vektor kedalaman hiposenter.
            </p>
          )}
        </div>

        {/* Accessible Keyboard Event Selector */}
        <div className="pointer-events-auto rounded-[16px] bg-[var(--clay)] shadow-[var(--raise-sm)] px-3.5 py-2">
          <label
            htmlFor="globe-event-select"
            className="block text-[11px] font-mono font-semibold text-[var(--ink-3)] mb-1"
          >
            Pilih Kejadian (Keyboard):
          </label>
          <select
            id="globe-event-select"
            value={selectedEvent?.id || ''}
            onChange={(e) => {
              const found = events.find((ev) => ev.id === e.target.value);
              if (found) {
                onSelectEvent(found);
                setActivePreset('selected_event');
              }
            }}
            className="text-xs font-mono bg-[var(--well)] text-[var(--ink)] rounded-[10px] px-2.5 py-1.5 max-w-[240px] border-0 shadow-[var(--inset-sm)]"
          >
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                M {formatCommaNumber(ev.magnitude, 1)} — {ev.region.slice(0, 32)} ({ev.depthKm} km)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Collapsible Unified Bottom Control Dock */}
      <div
        className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 z-10 w-[94%] max-w-[920px] flex flex-col items-center"
        aria-label="Kontrol Kamera dan Lapisan Globe 3D"
      >
        <button
          type="button"
          onClick={() => setDockCollapsed((prev) => !prev)}
          aria-expanded={!dockCollapsed}
          className="pointer-events-auto mb-2 inline-flex items-center gap-1.5 px-3.5 py-1 text-xs font-semibold bg-[var(--clay)] text-[var(--ink-2)] rounded-full shadow-[var(--raise-xs)] border-0 cursor-pointer"
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" /> Tampilkan Kontrol (H)
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" /> Sembunyikan Kontrol (H)
            </>
          )}
        </button>

        {!dockCollapsed && (
          <div className="pointer-events-auto w-full rounded-[18px] bg-[var(--clay)] shadow-[var(--float)] px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Camera Orbit Presets */}
              <div
                className="segmented"
                role="group"
                aria-label="Preset Fokus Kamera"
              >
                {(
                  [
                    { id: 'indonesia', label: 'Fokus Indonesia' },
                    { id: 'selected_event', label: 'Fokus Episenter' },
                    { id: 'banda_deep', label: 'Busur Banda Dalam' },
                    { id: 'sumatra_trench', label: 'Subduksi Sumatra' },
                    { id: 'global', label: 'Bola Dunia Utuh' },
                  ] as { id: GlobeCameraPreset; label: string }[]
                ).map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset.id)}
                    aria-pressed={activePreset === preset.id}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Layer & Mode Toggles */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowDepthStems((prev) => !prev)}
                  aria-pressed={showDepthStems}
                  className="btn btn--sm"
                >
                  <Layers className="w-3.5 h-3.5" />
                  Kolom Hiposenter
                </button>

                <button
                  type="button"
                  onClick={() => setAutoRotate((prev) => !prev)}
                  aria-pressed={autoRotate}
                  disabled={reducedMotion}
                  className="btn btn--sm"
                >
                  {autoRotate ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  Rotasi Orbit
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectPreset('indonesia')}
                  aria-label="Reset Orientasi Kamera"
                  className="btn btn--sm"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset
                </button>

                <button
                  type="button"
                  onClick={() => setFallback2DMode(true)}
                  className="btn btn--sm"
                >
                  <Compass className="w-3.5 h-3.5" />
                  Mode 2D
                </button>
              </div>
            </div>

            {/* Magnitude & Depth Non-Color-Only Legend Bar */}
            <div className="mt-2.5 pt-2 border-t border-[var(--rule)] flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-[var(--ink-3)]">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-bold text-[var(--ink-2)]">Skala Magnitudo:</span>
                {Object.values(MAGNITUDE_SCALE_SPECS)
                  .slice(1, 5)
                  .map((s) => (
                    <span key={s.magnitudeClass} className="inline-flex items-center gap-1">
                      <span
                        style={{
                          color: resolvedTheme === 'dark' ? s.hexDark : s.hexLight,
                        }}
                      >
                        {s.glyph}
                      </span>
                      <span>
                        {s.labelId} ({s.rangeText})
                      </span>
                    </span>
                  ))}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-bold text-[var(--ink-2)]">Kedalaman:</span>
                {Object.values(DEPTH_SCALE_SPECS).map((d) => (
                  <span key={d.category} className="inline-flex items-center gap-1">
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: resolvedTheme === 'dark' ? d.hexDark : d.hexLight,
                      }}
                    />
                    <span>
                      [{d.shortCode}] {d.rangeText}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
