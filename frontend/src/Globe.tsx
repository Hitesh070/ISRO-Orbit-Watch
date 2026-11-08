import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { SatellitePosition } from './types';
import { altitudeToEarthRadii, EARTH_RADIUS_KM } from './orbit';

interface Props {
  positions: SatellitePosition[];
  selectedId: number | null;
  orbitTrack: [number, number, number][];
  onSelect: (noradId: number) => void;
}

function spherePoint(longitude: number, latitude: number, altitudeKm: number): THREE.Vector3 {
  const lon = THREE.MathUtils.degToRad(longitude);
  const lat = THREE.MathUtils.degToRad(latitude);
  // One Earth radius is one scene unit. Satellite altitude is never compressed or clamped.
  const radius = altitudeToEarthRadii(altitudeKm);
  return new THREE.Vector3(radius * Math.cos(lat) * Math.cos(lon), radius * Math.sin(lat), -radius * Math.cos(lat) * Math.sin(lon));
}

function makeStars(): THREE.Points {
  const count = 1800;
  const coordinates = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    const theta = index * Math.PI * (3 - Math.sqrt(5));
    const z = 1 - 2 * ((index + 0.5) / count);
    const radius = 84;
    const radial = Math.sqrt(1 - z * z);
    coordinates.set([radius * radial * Math.cos(theta), radius * z, radius * radial * Math.sin(theta)], index * 3);
    const tint = new THREE.Color(0xb6d7e4);
    colors.set([tint.r, tint.g, tint.b], index * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(coordinates, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return new THREE.Points(geometry, new THREE.PointsMaterial({ size: 0.34, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.9 }));
}

export default function Globe({ positions, selectedId, orbitTrack, onSelect }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  const pickMapRef = useRef(new Map<number, THREE.Object3D>());
  const graphRef = useRef<any>(null);
  const focusedIdRef = useRef<number | null | undefined>(undefined);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }); }
    catch { host.dataset.webglUnavailable = 'true'; return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.domElement.className = 'globe-canvas';
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x01050b);
    const camera = new THREE.PerspectiveCamera(38, host.clientWidth / host.clientHeight, 0.1, 150);
    camera.position.set(0, 0, 4.5);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 2.5;
    controls.maxDistance = 14;
    controls.rotateSpeed = 0.55;

    scene.add(new THREE.AmbientLight(0x91aeca, 0.5));
    const sunLight = new THREE.DirectionalLight(0xfff0d4, 2.6);
    sunLight.position.set(-4, 2, 5);
    scene.add(sunLight);

    const earthGroup = new THREE.Group();
    earthGroup.rotation.y = -1.2;
    scene.add(earthGroup);
    const loader = new THREE.TextureLoader();
    const day = loader.load('/textures/earth_day_4096.jpg');
    day.colorSpace = THREE.SRGBColorSpace;
    const night = loader.load('/textures/earth_night_4096.jpg');
    night.colorSpace = THREE.SRGBColorSpace;
    const specular = loader.load('/textures/earth_specular_2048.jpg');
    const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), new THREE.MeshPhongMaterial({ map: day, emissiveMap: night, emissive: 0x202020, specularMap: specular, specular: 0x52717b, shininess: 18 }));
    earthGroup.add(earth);

    const cloudTexture = loader.load('/textures/earth_clouds_hd.png');
    const cloudMaterial = new THREE.MeshLambertMaterial({ map: cloudTexture, transparent: true, opacity: 0.13, depthWrite: false, color: 0xe5f4ff });
    const clouds = new THREE.Mesh(new THREE.SphereGeometry(1.008, 96, 64), cloudMaterial);
    earthGroup.add(clouds);
    const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(1.035, 96, 64), new THREE.MeshBasicMaterial({ color: 0x2b9be8, transparent: true, opacity: 0.08, side: THREE.BackSide }));
    earthGroup.add(atmosphere);
    scene.add(makeStars());

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const handleClick = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects([...pickMapRef.current.values()], false);
      if (hits.length) {
        const match = [...pickMapRef.current.entries()].find(([, object]) => object === hits[0].object);
        if (match) onSelectRef.current(match[0]);
      }
    };
    renderer.domElement.addEventListener('click', handleClick);

    let animationFrame = 0;
    const render = () => { controls.update(); renderer.render(scene, camera); animationFrame = window.requestAnimationFrame(render); };
    render();
    const resizeObserver = new ResizeObserver(() => {
      const width = host.clientWidth, height = host.clientHeight;
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    });
    resizeObserver.observe(host);
    graphRef.current = { scene, earthGroup, renderer, camera, controls };
    return () => {
      graphRef.current = null;
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('click', handleClick);
      controls.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Line) {
          object.geometry.dispose();
          const material = object.material;
          if (Array.isArray(material)) material.forEach((item) => item.dispose()); else material.dispose();
        }
      });
      [day, night, specular, cloudTexture].forEach((texture) => texture.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    const { earthGroup } = graph;
    const previous = earthGroup.children.filter((child: THREE.Object3D) => child.userData.dynamicLayer);
    previous.forEach((object: THREE.Object3D) => {
      earthGroup.remove(object);
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose();
      const material = (object as any).material;
      if (Array.isArray(material)) material.forEach((item: THREE.Material) => item.dispose()); else material?.dispose();
    });

    pickMapRef.current.clear();
    const visible = positions.filter((position) => Number.isFinite(position.latitude) && Number.isFinite(position.longitude) && Number.isFinite(position.altitudeKm) && position.altitudeKm > -100);
    for (const position of visible) {
      const selected = position.record.NORAD_CAT_ID === selectedId;
      const point = spherePoint(position.longitude, position.latitude, position.altitudeKm);
      const marker = new THREE.Mesh(new THREE.SphereGeometry(selected ? 0.045 : 0.027, 12, 10), new THREE.MeshBasicMaterial({ color: position.staleElements ? 0xf2a65a : selected ? 0xffffff : 0x52d9f2 }));
      marker.position.copy(point);
      marker.userData.dynamicLayer = true;
      earthGroup.add(marker);
      pickMapRef.current.set(position.record.NORAD_CAT_ID, marker);
    }
    if (orbitTrack.length > 1) {
      const path = orbitTrack.map(([lon, lat, altitude]) => spherePoint(lon, lat, altitude));
      const track = new THREE.Line(new THREE.BufferGeometry().setFromPoints(path), new THREE.LineBasicMaterial({ color: 0xffb454, transparent: true, opacity: 0.88 }));
      track.userData.dynamicLayer = true;
      earthGroup.add(track);
    }
  }, [positions, selectedId, orbitTrack]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || focusedIdRef.current === selectedId) return;
    focusedIdRef.current = selectedId;
    const selected = positions.find((position) => position.record.NORAD_CAT_ID === selectedId);
    // Keep GEO spacecraft in frame at their real 6.6 Earth radii. The camera
    // distance expands with the selected orbit instead of shrinking its altitude.
    const distance = selected ? Math.max(4.5, 1 + selected.altitudeKm / EARTH_RADIUS_KM + 2.7) : 4.5;
    graph.camera.position.setLength(distance);
    graph.controls.minDistance = Math.max(2.5, distance * 0.55);
    graph.controls.maxDistance = Math.max(14, distance * 2.2);
  }, [selectedId, positions]);

  return <div className="globe-host" ref={hostRef} aria-label="Interactive 3D Earth globe">
    <div className="globe-webgl-warning">This device could not start the 3D globe. Satellite data remains available in the list.</div>
  </div>;
}
