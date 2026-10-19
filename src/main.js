import './styles.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

const modules = [
  { id: 'points', label: '点的投影', children: [] },
  { id: 'lines', label: '线的投影', children: [] },
  { id: 'planes', label: '面的投影', children: [] },
  {
    id: 'solids',
    label: '基本体的投影',
    children: [
      { id: 'triPrism', label: '三棱柱' },
      { id: 'box', label: '四棱柱（长方体）' },
      { id: 'pentaPrism', label: '五棱柱' },
      { id: 'hexaPrism', label: '六棱柱' },
      { id: 'triPyramid', label: '三棱锥' },
      { id: 'quadPyramid', label: '四棱锥' },
      { id: 'cylinder', label: '圆柱' },
      { id: 'cone', label: '圆锥' },
      { id: 'torus', label: '圆环' },
      { id: 'sphere', label: '圆球' }
    ]
  }
];

const app = document.querySelector('#app');
app.innerHTML = `
  <main class="shell">
    <aside class="sidebar left-panel">
      <div class="brand">
        <div class="brand-mark">制</div>
        <div>
          <h1>机械制图可视化展示</h1>
          <p>基本体投影教学演示</p>
        </div>
      </div>
      <nav class="module-list" id="moduleList"></nav>
    </aside>

    <section class="stage">
      <header class="stage-toolbar">
        <div>
          <div class="eyebrow">当前模型</div>
          <h2 id="modelTitle">四棱柱（长方体）</h2>
        </div>
        <div class="point-controls hidden" id="pointControls"></div>
        <div class="toolbar-actions">
          <button class="tool-button" data-view="front" title="正投影视角">主视</button>
          <button class="tool-button" data-view="top" title="水平投影视角">俯视</button>
          <button class="tool-button" data-view="right" title="侧投影视角">侧视</button>
          <button class="tool-button" id="resetView" title="恢复轴测视角">复位</button>
        </div>
      </header>
      <div class="canvas-wrap" id="canvasWrap">
        <div class="selection-chip" id="selectionChip">未选中元素</div>
      </div>
    </section>

    <aside class="sidebar right-panel">
      <section class="panel-section">
        <div class="section-title">
          <h3>三视图显示</h3>
          <span id="edgeCount">0 条轮廓线</span>
        </div>
        <div class="views-grid">
          <div class="view-pane">
            <div class="view-title">主视图</div>
            <svg id="frontView" viewBox="-120 -120 240 240" data-view-name="front"></svg>
          </div>
          <div class="view-pane">
            <div class="view-title">俯视图</div>
            <svg id="topView" viewBox="-120 -120 240 240" data-view-name="top"></svg>
          </div>
          <div class="view-pane">
            <div class="view-title">左视图</div>
            <svg id="sideView" viewBox="-120 -120 240 240" data-view-name="side"></svg>
          </div>
        </div>
      </section>
      <section class="panel-section compact">
        <div class="section-title">
          <h3>选中信息</h3>
        </div>
        <dl class="info-list">
          <div><dt>类型</dt><dd id="selectedType">无</dd></div>
          <div><dt>编号</dt><dd id="selectedId">-</dd></div>
          <div><dt>说明</dt><dd id="selectedDesc">点击模型点、边、面或三视图线段进行联动高亮</dd></div>
        </dl>
      </section>
    </aside>
  </main>
`;

const moduleList = document.querySelector('#moduleList');
const modelTitle = document.querySelector('#modelTitle');
const canvasWrap = document.querySelector('#canvasWrap');
const selectionChip = document.querySelector('#selectionChip');
const selectedType = document.querySelector('#selectedType');
const selectedId = document.querySelector('#selectedId');
const selectedDesc = document.querySelector('#selectedDesc');
const edgeCount = document.querySelector('#edgeCount');
const pointControls = document.querySelector('#pointControls');

const availableModelIds = new Set(modules.flatMap((module) => module.children.map((item) => item.id)));
const urlParams = new URLSearchParams(window.location.search);
const initialModelId = urlParams.get('model');
const initialMode = urlParams.get('mode');
let currentModelId = availableModelIds.has(initialModelId) ? initialModelId : 'box';
let currentMode = initialMode === 'points' ? 'points' : 'solid';
let selected = null;
let hovered = null;
let currentDefinition = null;
const pointProjectionState = {
  A: { x: 1.1, y: 0.75, z: 1.05 },
  B: { x: 1.0, y: 0.85, z: 0.35 }
};
let currentLineProjectionType = 'general';
let currentPlaneProjectionType = 'general';
const lineProjectionPresets = {
  frontParallel: {
    label: '正平线',
    A: { x: 1.05, y: 0.35, z: 0.95 },
    B: { x: 0.25, y: 0.35, z: 0.25 }
  },
  horizontal: {
    label: '水平线',
    A: { x: 1.05, y: 0.25, z: 0.65 },
    B: { x: 0.3, y: 1.05, z: 0.65 }
  },
  sideParallel: {
    label: '侧平线',
    A: { x: 0.55, y: 0.25, z: 1.05 },
    B: { x: 0.55, y: 1.05, z: 0.25 }
  },
  frontPerpendicular: {
    label: '正垂线',
    A: { x: 0.7, y: 0.2, z: 0.65 },
    B: { x: 0.7, y: 1.05, z: 0.65 }
  },
  plumb: {
    label: '铅垂线',
    A: { x: 0.7, y: 0.65, z: 0.2 },
    B: { x: 0.7, y: 0.65, z: 1.05 }
  },
  sidePerpendicular: {
    label: '侧垂线',
    A: { x: 0.2, y: 0.65, z: 0.65 },
    B: { x: 1.05, y: 0.65, z: 0.65 }
  },
  general: {
    label: '一般位置直线',
    A: { x: 1.05, y: 0.25, z: 1.0 },
    B: { x: 0.25, y: 1.05, z: 0.25 }
  }
};
const planeProjectionState = {
  A: { x: 1.05, y: 0.25, z: 1.0 },
  B: { x: 0.25, y: 1.0, z: 0.85 },
  C: { x: 0.85, y: 0.7, z: 0.25 }
};
const planeProjectionPresets = {
  frontParallel: {
    label: '正平面',
    A: { x: 1.05, y: 0.55, z: 1.05 },
    B: { x: 0.25, y: 0.55, z: 0.95 },
    C: { x: 0.65, y: 0.55, z: 0.25 }
  },
  horizontal: {
    label: '水平面',
    A: { x: 1.05, y: 0.25, z: 0.65 },
    B: { x: 0.25, y: 0.95, z: 0.65 },
    C: { x: 0.95, y: 1.1, z: 0.65 }
  },
  sideParallel: {
    label: '侧平面',
    A: { x: 0.6, y: 0.25, z: 1.05 },
    B: { x: 0.6, y: 1.05, z: 0.95 },
    C: { x: 0.6, y: 0.65, z: 0.25 }
  },
  frontPerpendicular: {
    label: '正垂面',
    A: { x: 1.08, y: 0.2, z: 1.05 },
    B: { x: 0.25, y: 1.08, z: 0.22 },
    C: { x: 0.35, y: 0.3, z: 0.35 }
  },
  plumb: {
    label: '铅垂面',
    A: { x: 1.08, y: 0.22, z: 1.05 },
    B: { x: 0.25, y: 1.08, z: 0.25 },
    C: { x: 0.65, y: 0.665, z: 0.95 }
  },
  sidePerpendicular: {
    label: '侧垂面',
    A: { x: 0.22, y: 0.22, z: 1.05 },
    B: { x: 1.08, y: 1.08, z: 0.25 },
    C: { x: 0.9, y: 0.65, z: 0.65 }
  },
  general: {
    label: '一般位置平面',
    A: { x: 1.05, y: 0.25, z: 1.0 },
    B: { x: 0.25, y: 1.0, z: 0.85 },
    C: { x: 0.85, y: 0.7, z: 0.25 }
  }
};
const pointCoordMax = 1.2;
const defaultCameraOffset = new THREE.Vector3(-5.5, 4.2, 6);
const solidCameraTarget = new THREE.Vector3(0, 0, 0);
const pointCameraTarget = new THREE.Vector3(-0.05, 0.78, 0);
const pointCameraZoom = 1.45;
const solidCameraZoom = 0.72;
const pickables = [];
const bodyMeshes = [];
const edgeMeshes = new Map();
const pointMeshes = new Map();
const faceMeshes = [];
const edgeSvgElements = new Map();
const pointSvgElements = new Map();
const faceSvgElements = new Map();
const pointProjectionGroup = new THREE.Group();
const pointProjectionObjects = new Map();

const lineMaterials = {
  visible: new THREE.MeshBasicMaterial({ color: 0x26364f }),
  hidden: new THREE.MeshBasicMaterial({ color: 0x7a8799 }),
  hover: new THREE.MeshBasicMaterial({ color: 0x2f80ed }),
  hoverHidden: new THREE.MeshBasicMaterial({ color: 0x2f80ed }),
  selected: new THREE.MeshBasicMaterial({ color: 0xffb000 }),
  selectedHidden: new THREE.MeshBasicMaterial({ color: 0xffb000 })
};

function renderModuleList() {
  moduleList.innerHTML = modules.map((module) => `
    <details class="module ${currentMode === module.id ? 'active-module' : ''}" ${module.id === 'solids' ? 'open' : ''}>
      <summary data-module="${module.id}">${module.label}</summary>
      <div class="submodules">
        ${module.children.length
          ? module.children.map((item) => `
              <button class="submodule ${currentMode === 'solid' && item.id === currentModelId ? 'active' : ''}" data-model="${item.id}">
                ${item.label}
              </button>
            `).join('')
          : module.id === 'points' || module.id === 'lines' || module.id === 'planes' ? '' : '<div class="empty-note">子模块待扩展</div>'}
      </div>
    </details>
  `).join('');
}

renderModuleList();

moduleList.addEventListener('click', (event) => {
  const summary = event.target.closest('summary[data-module]');
  if (summary?.dataset.module === 'points') {
    event.preventDefault();
    currentMode = 'points';
    renderModuleList();
    loadPointProjection();
    return;
  }
  if (summary?.dataset.module === 'lines') {
    event.preventDefault();
    currentMode = 'lines';
    renderModuleList();
    loadLineProjection();
    return;
  }
  if (summary?.dataset.module === 'planes') {
    event.preventDefault();
    currentMode = 'planes';
    renderModuleList();
    loadPlaneProjection();
    return;
  }
  const button = event.target.closest('[data-model]');
  if (!button) return;
  currentMode = 'solid';
  currentModelId = button.dataset.model;
  renderModuleList();
  loadModel(currentModelId);
});

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf5f7fb);

const camera = new THREE.OrthographicCamera(-4, 4, 3, -3, 0.1, 100);
camera.position.copy(solidCameraTarget).add(defaultCameraOffset);
camera.zoom = solidCameraZoom;
camera.updateProjectionMatrix();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
canvasWrap.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.domElement.className = 'label-layer';
canvasWrap.appendChild(labelRenderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 0, 0);
controls.minZoom = 0.45;
controls.maxZoom = 2.7;

scene.add(new THREE.HemisphereLight(0xffffff, 0xaab3c2, 2.4));
const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
keyLight.position.set(4, 7, 5);
keyLight.castShadow = true;
scene.add(keyLight);

const root = new THREE.Group();
scene.add(root);
scene.add(pointProjectionGroup);

const projectionPlaneGroup = new THREE.Group();
scene.add(projectionPlaneGroup);
createProjectionPlanes();

const raycaster = new THREE.Raycaster();
raycaster.params.Line.threshold = 0.16;
const pointer = new THREE.Vector2();

function createProjectionPlanes() {
  const planes = [
    { id: 'front', label: 'V 面', color: 0x77a6ff, pos: [0, 0, -1.85], rot: [0, 0, 0], size: [4.8, 3.6] },
    { id: 'top', label: 'H 面', color: 0x6fd4aa, pos: [0, -1.85, 0], rot: [-Math.PI / 2, 0, 0], size: [4.8, 3.6] },
    { id: 'right', label: 'W 面', color: 0xf2b26b, pos: [2.4, 0, 0], rot: [0, Math.PI / 2, 0], size: [3.7, 3.6] }
  ];

  planes.forEach((item) => {
    const geometry = new THREE.PlaneGeometry(...item.size);
    const material = new THREE.MeshBasicMaterial({
      color: item.color,
      transparent: true,
      opacity: 0.17,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...item.pos);
    mesh.rotation.set(...item.rot);
    mesh.userData = { pickType: 'plane', id: item.id, label: item.label };
    projectionPlaneGroup.add(mesh);

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({ color: item.color, transparent: true, opacity: 0.85 })
    );
    mesh.add(edges);

    const label = document.createElement('div');
    label.className = 'plane-label';
    label.textContent = item.label;
    const labelObject = new CSS2DObject(label);
    labelObject.position.set(item.size[0] / 2 - 0.35, item.size[1] / 2 - 0.24, 0.02);
    mesh.add(labelObject);
  });
}

function setProjectionPlaneLayout(mode) {
  const layouts = mode === 'points'
    ? {
        front: { pos: [0, 0, 0], size: [1.55, 1.55], translate: [-0.775, 0.775, 0], label: [-1.28, 1.28, 0.02] },
        top: { pos: [0, 0, 0], size: [1.55, 1.55], translate: [-0.775, -0.775, 0], label: [-1.28, -1.28, 0.02] },
        right: { pos: [0, 0, 0], size: [1.55, 1.55], translate: [-0.775, 0.775, 0], label: [-1.28, 1.28, 0.02] }
      }
    : {
        front: { pos: [0, 0, -1.85], size: [4.8, 3.6], translate: [0, 0, 0], label: [-1.55, 1.35, 0.02] },
        top: { pos: [0, -1.85, 0], size: [4.8, 3.6], translate: [0, 0, 0], label: [-1.55, -1.35, 0.02] },
        right: { pos: [2.4, 0, 0], size: [3.7, 3.6], translate: [0, 0, 0], label: [-1.15, 1.35, 0.02] }
      };
  projectionPlaneGroup.children.forEach((mesh) => {
    const layout = layouts[mesh.userData.id];
    if (layout) {
      updateProjectionPlaneGeometry(mesh, layout);
      mesh.position.set(...layout.pos);
    }
  });
}

function updateProjectionPlaneGeometry(mesh, layout) {
  mesh.geometry.dispose();
  mesh.geometry = new THREE.PlaneGeometry(...layout.size);
  mesh.geometry.translate(...layout.translate);

  mesh.children.forEach((child) => {
    if (child.isLineSegments) {
      child.geometry.dispose();
      child.geometry = new THREE.EdgesGeometry(mesh.geometry);
    } else if (child.isCSS2DObject) {
      child.position.set(...layout.label);
    }
  });
}

function getModelDefinition(id) {
  const specs = {
    triPrism: () => prismDefinition(3, 1.25, 2.1, '三棱柱'),
    box: () => boxDefinition(),
    pentaPrism: () => prismDefinition(5, 1.2, 2.1, '五棱柱'),
    hexaPrism: () => prismDefinition(6, 1.18, 2.1, '六棱柱'),
    triPyramid: () => pyramidDefinition(3, 1.35, 2.2, '三棱锥'),
    quadPyramid: () => pyramidDefinition(4, 1.3, 2.2, '四棱锥'),
    cylinder: () => cylinderDefinition(),
    cone: () => coneDefinition(),
    torus: () => torusDefinition(),
    sphere: () => sphereDefinition()
  };
  return specs[id]();
}

function prismDefinition(sides, radius, depth, label) {
  const yA = -depth / 2;
  const yB = depth / 2;
  const vertices = [];
  for (let i = 0; i < sides; i += 1) {
    const a = Math.PI / 2 + (i / sides) * Math.PI * 2;
    vertices.push(new THREE.Vector3(Math.cos(a) * radius, yA, Math.sin(a) * radius));
  }
  for (let i = 0; i < sides; i += 1) {
    const a = Math.PI / 2 + (i / sides) * Math.PI * 2;
    vertices.push(new THREE.Vector3(Math.cos(a) * radius, yB, Math.sin(a) * radius));
  }

  const faces = [];
  faces.push([...Array(sides).keys()].reverse());
  faces.push([...Array(sides).keys()].map((i) => i + sides));
  for (let i = 0; i < sides; i += 1) {
    faces.push([i, (i + 1) % sides, ((i + 1) % sides) + sides, i + sides]);
  }
  return { ...buildDefinition(label, vertices, faces), solidKind: 'prism', sides };
}

function boxDefinition() {
  const x = 1.35;
  const y = 0.95;
  const z = 1.15;
  const vertices = [
    [-x, -y, -z], [x, -y, -z], [x, y, -z], [-x, y, -z],
    [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]
  ].map((point) => new THREE.Vector3(...point));
  const faces = [
    [0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1],
    [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]
  ];
  return { ...buildDefinition('四棱柱（长方体）', vertices, faces), solidKind: 'box', sides: 4 };
}

function pyramidDefinition(sides, radius, height, label) {
  const vertices = [];
  for (let i = 0; i < sides; i += 1) {
    const a = Math.PI / 2 + (i / sides) * Math.PI * 2;
    vertices.push(new THREE.Vector3(Math.cos(a) * radius, -height / 2, Math.sin(a) * radius));
  }
  vertices.push(new THREE.Vector3(0, height / 2, 0));
  const apex = sides;
  const faces = [[...Array(sides).keys()].reverse()];
  for (let i = 0; i < sides; i += 1) {
    faces.push([i, (i + 1) % sides, apex]);
  }
  return { ...buildDefinition(label, vertices, faces), solidKind: 'pyramid', sides };
}

function cylinderDefinition() {
  const radius = 1.05;
  const height = 2.1;
  const segments = 96;
  const geometry = new THREE.CylinderGeometry(radius, radius, height, segments, 1, false);
  const rings = ringEdges(radius, -height / 2, height / 2, segments);
  return {
    label: '圆柱',
    geometry,
    vertices: rings.vertices,
    edges: rings.edges,
    facePickers: [
      { id: 'f1', radius, y: -height / 2 },
      { id: 'f2', radius, y: height / 2 }
    ],
    pointLimit: 0,
    projectionMode: 'cylinder',
    projectionCount: 8
  };
}

function coneDefinition() {
  const radius = 1.12;
  const height = 2.25;
  const segments = 96;
  const geometry = new THREE.ConeGeometry(radius, height, segments, 1, false);
  const rings = ringEdges(radius, -height / 2, null, segments);
  return {
    label: '圆锥',
    geometry,
    vertices: rings.vertices,
    edges: rings.edges,
    facePickers: [
      { id: 'f1', radius, y: -height / 2 }
    ],
    pointLimit: 0,
    projectionMode: 'cone',
    projectionCount: 7,
    cone: { radius, height }
  };
}

function torusDefinition() {
  const major = 0.82;
  const tube = 0.32;
  const geometry = new THREE.TorusGeometry(major, tube, 32, 128);
  geometry.rotateX(Math.PI / 2);
  return {
    label: '圆环',
    geometry,
    vertices: [],
    edges: circularGuideEdges(major + tube, 0, 0, 96),
    pointLimit: 0,
    projectionMode: 'torus',
    projectionCount: 6,
    torus: { major, tube, outer: major + tube, inner: major - tube }
  };
}

function sphereDefinition() {
  const radius = 1.15;
  const geometry = new THREE.SphereGeometry(radius, 48, 28);
  return {
    label: '圆球',
    geometry,
    vertices: [],
    edges: circularGuideEdges(radius, 0, 0, 96),
    pointLimit: 0,
    projectionMode: 'sphere',
    projectionCount: 3,
    sphere: { radius }
  };
}

function buildDefinition(label, vertices, faces) {
  const edges = extractEdgesFromFaces(faces).map(([a, b], index) => ({
    id: `e${index + 1}`,
    start: vertices[a],
    end: vertices[b],
    vertexIndexes: [a, b]
  }));
  return {
    label,
    vertices,
    faces,
    edges,
    geometry: buildPolyhedronGeometry(vertices, faces),
    pointLimit: vertices.length,
    projectionMode: 'poly'
  };
}

function ringEdges(radius, yA, yB, segments) {
  const vertices = [];
  const edges = [];
  const addRing = (y) => {
    const startIndex = vertices.length;
    for (let i = 0; i < segments; i += 1) {
      const a = (i / segments) * Math.PI * 2;
      vertices.push(new THREE.Vector3(Math.cos(a) * radius, y, Math.sin(a) * radius));
    }
    for (let i = 0; i < segments; i += 1) {
      edges.push({
        id: `e${edges.length + 1}`,
        start: vertices[startIndex + i],
        end: vertices[startIndex + ((i + 1) % segments)]
      });
    }
  };
  addRing(yA);
  if (yB !== null) addRing(yB);
  return { vertices, edges };
}

function circularGuideEdges(radius, y, zOffset, segments) {
  const edges = [];
  for (let i = 0; i < segments; i += 1) {
    const a = (i / segments) * Math.PI * 2;
    const b = ((i + 1) / segments) * Math.PI * 2;
    edges.push({
      id: `e${i + 1}`,
      start: new THREE.Vector3(Math.cos(a) * radius, y, Math.sin(a) * radius + zOffset),
      end: new THREE.Vector3(Math.cos(b) * radius, y, Math.sin(b) * radius + zOffset)
    });
  }
  return edges;
}

function loadModel(id) {
  currentMode = 'solid';
  resetCameraView('solid');
  setProjectionPlaneLayout('solid');
  clearPointProjectionScene();
  pointControls.classList.add('hidden');
  document.querySelector('.toolbar-actions').classList.remove('hidden');
  restoreSolidPanel();
  root.clear();
  bodyMeshes.length = 0;
  edgeMeshes.clear();
  pointMeshes.clear();
  faceMeshes.length = 0;
  pickables.splice(0, pickables.length);
  edgeSvgElements.clear();
  pointSvgElements.clear();
  faceSvgElements.clear();
  selected = null;
  updateSelectionInfo();

  const definition = getModelDefinition(id);
  currentDefinition = definition;
  modelTitle.textContent = definition.label;

  const modelGroup = new THREE.Group();
  root.add(modelGroup);

  const mesh = new THREE.Mesh(definition.geometry, modelMaterial(definition.projectionMode !== 'poly'));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { pickType: 'body', label: definition.label };
  modelGroup.add(mesh);
  bodyMeshes.push(mesh);

  definition.edges.forEach((edge) => {
    const meshLine = createEdgeLine(edge);
    modelGroup.add(meshLine);
    edgeMeshes.set(edge.id, meshLine);
    pickables.push(meshLine);
  });

  definition.vertices.slice(0, definition.pointLimit ?? 0).forEach((vertex, index) => {
    const pointId = `p${index + 1}`;
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0x22314a })
    );
    sphere.position.copy(vertex);
    sphere.userData = { pickType: 'point', id: pointId, label: `点 ${pointId}` };
    modelGroup.add(sphere);
    pointMeshes.set(pointId, sphere);
    pickables.push(sphere);
  });

  if (definition.faces) {
    definition.faces.forEach((face, index) => {
      const faceMesh = createFacePickMesh(definition.vertices, face, `f${index + 1}`);
      modelGroup.add(faceMesh);
      faceMeshes.push(faceMesh);
      pickables.push(faceMesh);
    });
  }

  if (definition.facePickers) {
    definition.facePickers.forEach((face) => {
      const faceMesh = createCircularFacePickMesh(face.radius, face.y, face.id);
      modelGroup.add(faceMesh);
      faceMeshes.push(faceMesh);
      pickables.push(faceMesh);
    });
  }

  renderOrthographicViews(definition);
  edgeCount.textContent = `${definition.projectionCount ?? definition.edges.length} 条轮廓线`;
}

function restoreSolidPanel() {
  document.querySelector('.panel-section .section-title h3').textContent = '三视图显示';
  document.querySelector('.views-grid').innerHTML = `
    <div class="view-pane">
      <div class="view-title">主视图</div>
      <svg id="frontView" viewBox="-120 -120 240 240" data-view-name="front"></svg>
    </div>
    <div class="view-pane">
      <div class="view-title">俯视图</div>
      <svg id="topView" viewBox="-120 -120 240 240" data-view-name="top"></svg>
    </div>
    <div class="view-pane">
      <div class="view-title">左视图</div>
      <svg id="sideView" viewBox="-120 -120 240 240" data-view-name="side"></svg>
    </div>
  `;
  document.querySelector('.panel-section.compact .section-title h3').textContent = '选中信息';
  document.querySelector('.info-list').innerHTML = `
    <div><dt>类型</dt><dd id="selectedType">无</dd></div>
    <div><dt>编号</dt><dd id="selectedId">-</dd></div>
    <div><dt>说明</dt><dd id="selectedDesc">点击模型点、边、面或三视图线段进行联动高亮</dd></div>
  `;
}

function loadPointProjection() {
  currentMode = 'points';
  resetCameraView('points');
  setProjectionPlaneLayout('points');
  root.clear();
  clearPointProjectionScene();
  bodyMeshes.length = 0;
  edgeMeshes.clear();
  pointMeshes.clear();
  faceMeshes.length = 0;
  pickables.splice(0, pickables.length);
  edgeSvgElements.clear();
  pointSvgElements.clear();
  faceSvgElements.clear();
  selected = null;
  modelTitle.textContent = '点的投影';
  selectionChip.textContent = '拖动滑块调整 A、B 点坐标';
  document.querySelector('.toolbar-actions').classList.add('hidden');
  pointControls.classList.remove('hidden');
  renderPointControls();
  renderPointProjectionScene();
  renderPointProjectionPanel();
}

function loadLineProjection() {
  currentMode = 'lines';
  resetCameraView('lines');
  setProjectionPlaneLayout('points');
  root.clear();
  clearPointProjectionScene();
  bodyMeshes.length = 0;
  edgeMeshes.clear();
  pointMeshes.clear();
  faceMeshes.length = 0;
  pickables.splice(0, pickables.length);
  edgeSvgElements.clear();
  pointSvgElements.clear();
  faceSvgElements.clear();
  selected = null;
  modelTitle.textContent = '直线的投影';
  selectionChip.textContent = '选择直线类型查看 AB 及其投影';
  document.querySelector('.toolbar-actions').classList.add('hidden');
  pointControls.classList.remove('hidden');
  applyLineProjectionPreset(currentLineProjectionType);
  renderLineControls();
  renderPointProjectionScene();
  renderPointProjectionPanel();
}

function loadPlaneProjection() {
  currentMode = 'planes';
  resetCameraView('planes');
  setProjectionPlaneLayout('points');
  root.clear();
  clearPointProjectionScene();
  bodyMeshes.length = 0;
  edgeMeshes.clear();
  pointMeshes.clear();
  faceMeshes.length = 0;
  pickables.splice(0, pickables.length);
  edgeSvgElements.clear();
  pointSvgElements.clear();
  faceSvgElements.clear();
  selected = null;
  modelTitle.textContent = '平面的投影';
  selectionChip.textContent = '选择平面类型查看三角形平面及其投影';
  document.querySelector('.toolbar-actions').classList.add('hidden');
  pointControls.classList.remove('hidden');
  applyPlaneProjectionPreset(currentPlaneProjectionType);
  renderPlaneControls();
  renderPointProjectionScene();
  renderPointProjectionPanel();
}

function renderPointControls() {
  pointControls.innerHTML = ['A', 'B'].map((name) => `
    <div class="point-control-group">
      <strong>${name}点</strong>
      ${['x', 'y', 'z'].map((axis) => `
        <label>
          <span>${axis.toUpperCase()}</span>
          <input type="range" min="0" max="${pointCoordMax}" step="0.05" data-point="${name}" data-axis="${axis}" value="${pointProjectionState[name][axis]}">
          <input type="number" min="0" max="${pointCoordMax}" step="0.05" data-point="${name}" data-axis="${axis}" value="${pointProjectionState[name][axis].toFixed(2)}">
        </label>
      `).join('')}
    </div>
  `).join('');
}

function renderLineControls() {
  pointControls.innerHTML = `
    <div class="line-type-tabs">
      ${Object.entries(lineProjectionPresets).map(([id, item]) => `
        <button class="line-type-tab ${id === currentLineProjectionType ? 'active' : ''}" data-line-type="${id}">
          ${item.label}
        </button>
      `).join('')}
    </div>
  `;
}

function renderPlaneControls() {
  pointControls.innerHTML = `
    <div class="line-type-tabs">
      ${Object.entries(planeProjectionPresets).map(([id, item]) => `
        <button class="line-type-tab ${id === currentPlaneProjectionType ? 'active' : ''}" data-plane-type="${id}">
          ${item.label}
        </button>
      `).join('')}
    </div>
  `;
}

function applyLineProjectionPreset(type) {
  const preset = lineProjectionPresets[type] ?? lineProjectionPresets.general;
  currentLineProjectionType = type in lineProjectionPresets ? type : 'general';
  pointProjectionState.A = { ...preset.A };
  pointProjectionState.B = { ...preset.B };
}

function applyPlaneProjectionPreset(type) {
  const preset = planeProjectionPresets[type] ?? planeProjectionPresets.general;
  currentPlaneProjectionType = type in planeProjectionPresets ? type : 'general';
  planeProjectionState.A = { ...preset.A };
  planeProjectionState.B = { ...preset.B };
  planeProjectionState.C = { ...preset.C };
}

pointControls.addEventListener('click', (event) => {
  const button = event.target.closest('[data-line-type]');
  const planeButton = event.target.closest('[data-plane-type]');
  if (!button && !planeButton) return;
  if (button) {
    applyLineProjectionPreset(button.dataset.lineType);
    renderLineControls();
  } else {
    applyPlaneProjectionPreset(planeButton.dataset.planeType);
    renderPlaneControls();
  }
  renderPointProjectionScene();
  renderPointProjectionPanel();
});

pointControls.addEventListener('input', (event) => {
  const input = event.target.closest('input[data-point][data-axis]');
  if (!input) return;
  const { point, axis } = input.dataset;
  const value = Number(input.value);
  pointProjectionState[point][axis] = Number.isFinite(value) ? Math.min(pointCoordMax, Math.max(0, value)) : 0;
  input.value = input.type === 'range' ? pointProjectionState[point][axis] : pointProjectionState[point][axis].toFixed(2);
  pointControls.querySelectorAll(`input[data-point="${point}"][data-axis="${axis}"]`).forEach((peer) => {
    if (peer !== input) peer.value = input.type === 'range' ? pointProjectionState[point][axis] : pointProjectionState[point][axis].toFixed(2);
  });
  renderPointProjectionScene();
  renderPointProjectionPanel();
});

function renderPointProjectionScene() {
  removePointLabelElements();
  const colors = { A: 0xd84b3f, B: 0x1f7a5a, C: 0x2f80ed };
  const pointData = getProjectionPointData();
  Object.entries(pointData).forEach(([name, data]) => {
    const { p, projections } = data;
    upsertScenePoint(`${name}-space`, p, name, colors[name], 0.07);
    upsertScenePoint(`${name}-V`, projections.V, getPointProjectionLabel(name, 'V'), colors[name], 0.045);
    upsertScenePoint(`${name}-H`, projections.H, getPointProjectionLabel(name, 'H'), colors[name], 0.045);
    upsertScenePoint(`${name}-W`, projections.W, getPointProjectionLabel(name, 'W'), colors[name], 0.045);
    upsertProjectionLine(`${name}-to-V`, p, projections.V, colors[name]);
    upsertProjectionLine(`${name}-to-H`, p, projections.H, colors[name]);
    upsertProjectionLine(`${name}-to-W`, p, projections.W, colors[name]);
  });
  if (currentMode === 'lines') {
    upsertThickProjectionLine('line-space-AB', pointData.A.p, pointData.B.p, 0x26364f, 0.028, 0.92);
    upsertThickProjectionLine('line-V-ab', pointData.A.projections.V, pointData.B.projections.V, 0xd84b3f, 0.018, 0.78);
    upsertThickProjectionLine('line-H-ab', pointData.A.projections.H, pointData.B.projections.H, 0x1f7a5a, 0.018, 0.78);
    upsertThickProjectionLine('line-W-ab', pointData.A.projections.W, pointData.B.projections.W, 0xd98a35, 0.018, 0.78);
  }
  if (currentMode === 'planes') {
    upsertProjectionTriangle('plane-space-ABC', [pointData.A.p, pointData.B.p, pointData.C.p], 0x26364f, 0.2, 0.026);
    upsertProjectionTriangle('plane-V-abc', [pointData.A.projections.V, pointData.B.projections.V, pointData.C.projections.V], 0xd84b3f, 0.12, 0.016);
    upsertProjectionTriangle('plane-H-abc', [pointData.A.projections.H, pointData.B.projections.H, pointData.C.projections.H], 0x1f7a5a, 0.12, 0.016);
    upsertProjectionTriangle('plane-W-abc', [pointData.A.projections.W, pointData.B.projections.W, pointData.C.projections.W], 0xd98a35, 0.12, 0.016);
  }
}

function getProjectionPointData() {
  const state = currentMode === 'planes' ? planeProjectionState : pointProjectionState;
  return Object.fromEntries(Object.entries(state).map(([name, coords]) => {
    const sceneX = -coords.x;
    const p = new THREE.Vector3(sceneX, coords.z, coords.y);
    return [name, {
      coords,
      p,
      projections: {
        H: new THREE.Vector3(sceneX, 0, coords.y),
        V: new THREE.Vector3(sceneX, coords.z, 0),
        W: new THREE.Vector3(0, coords.z, coords.y)
      }
    }];
  }));
}

function getPointProjectionLabel(name, view) {
  const lower = name.toLowerCase();
  if (view === 'V') return `${lower}'`;
  if (view === 'W') return `${lower}''`;
  return lower;
}

function clearPointProjectionScene() {
  removePointLabelElements();
  pointProjectionObjects.forEach((object) => {
    object.traverse?.((child) => {
      if (child.isCSS2DObject) child.element.remove();
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
  });
  pointProjectionGroup.clear();
  pointProjectionObjects.clear();
}

function removePointLabelElements() {
  labelRenderer.domElement.querySelectorAll('.point-label').forEach((element) => element.remove());
}

function upsertScenePoint(key, position, labelText, color, radius) {
  let mesh = pointProjectionObjects.get(key);
  if (!mesh) {
    mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 20, 20),
      new THREE.MeshBasicMaterial({ color })
    );
    const label = document.createElement('div');
    label.className = 'point-label';
    label.textContent = labelText;
    const labelObject = new CSS2DObject(label);
    labelObject.position.set(0.08, 0.08, 0.08);
    mesh.add(labelObject);
    pointProjectionGroup.add(mesh);
    pointProjectionObjects.set(key, mesh);
  }
  mesh.position.copy(position);
}

function upsertProjectionLine(key, start, end, color) {
  let line = pointProjectionObjects.get(key);
  if (!line) {
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.42 }));
    pointProjectionGroup.add(line);
    pointProjectionObjects.set(key, line);
  }
  line.geometry.setFromPoints([start, end]);
  line.geometry.attributes.position.needsUpdate = true;
}

function upsertThickProjectionLine(key, start, end, color, radius, opacity = 1) {
  const old = pointProjectionObjects.get(key);
  if (old) {
    pointProjectionGroup.remove(old);
    old.geometry?.dispose();
    old.material?.dispose();
  }
  const distance = start.distanceTo(end);
  if (distance < 0.001) {
    pointProjectionObjects.delete(key);
    return;
  }
  const curve = new THREE.LineCurve3(start, end);
  const geometry = new THREE.TubeGeometry(curve, 1, radius, 10);
  const material = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity });
  const mesh = new THREE.Mesh(geometry, material);
  pointProjectionGroup.add(mesh);
  pointProjectionObjects.set(key, mesh);
}

function upsertProjectionTriangle(key, points, color, fillOpacity, edgeRadius) {
  removeProjectionObjectsByPrefix(key);
  const area = points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).length() / 2;
  if (area > 0.001) {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    geometry.setIndex([0, 1, 2]);
    geometry.computeVertexNormals();
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: fillOpacity,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(geometry, material);
    pointProjectionGroup.add(mesh);
    pointProjectionObjects.set(key, mesh);
  }
  const pairs = getTriangleProjectionSegments(points);
  pairs.forEach(([a, b], index) => {
    upsertThickProjectionLine(`${key}-edge-${index}`, a, b, color, edgeRadius, 0.82);
  });
}

function removeProjectionObjectByKey(key) {
  const object = pointProjectionObjects.get(key);
  if (!object) return;
  pointProjectionGroup.remove(object);
  object.geometry?.dispose();
  object.material?.dispose();
  pointProjectionObjects.delete(key);
}

function removeProjectionObjectsByPrefix(prefix) {
  [...pointProjectionObjects.keys()]
    .filter((key) => key === prefix || key.startsWith(`${prefix}-edge-`))
    .forEach((key) => removeProjectionObjectByKey(key));
}

function getTriangleProjectionSegments(points) {
  const area = points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).length() / 2;
  if (area > 0.001) return [[points[0], points[1]], [points[1], points[2]], [points[2], points[0]]];
  let best = [points[0], points[1]];
  let bestDistance = 0;
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const distance = points[i].distanceTo(points[j]);
      if (distance > bestDistance) {
        bestDistance = distance;
        best = [points[i], points[j]];
      }
    }
  }
  return bestDistance > 0.001 ? [best] : [];
}

function renderPointProjectionPanel() {
  edgeCount.textContent = '展开投影图';
  document.querySelector('.section-title h3').textContent = getProjectionPanelTitle();
  document.querySelector('.views-grid').innerHTML = `
    <div class="view-pane point-unfold-pane">
      <div class="view-title">展开后的${getProjectionPanelSubject()}的投影</div>
      <svg id="pointUnfoldView" viewBox="-130 -130 260 260"></svg>
    </div>
  `;
  const svg = document.querySelector('#pointUnfoldView');
  svg.innerHTML = `
    <rect x="-130" y="-130" width="260" height="260" fill="#ffffff"/>
    <line x1="-118" y1="0" x2="118" y2="0" class="axis-line"/>
    <line x1="0" y1="-118" x2="0" y2="118" class="axis-line"/>
    <line x1="0" y1="0" x2="112" y2="112" class="fold-line"/>
    <text x="-114" y="-108" class="unfold-axis">V面</text>
    <text x="-114" y="120" class="unfold-axis">H面</text>
    <text x="90" y="-108" class="unfold-axis">W面</text>
    <text x="-116" y="-6" class="unfold-axis">X轴</text>
    <text x="6" y="-104" class="unfold-axis">Z轴</text>
    <text x="104" y="-6" class="unfold-axis">Y轴</text>
    <text x="6" y="118" class="unfold-axis">Y轴</text>
    <text x="94" y="116" class="unfold-axis">45°</text>
  `;
  const scale = 82;
  const unfoldMarks = {};
  const pointColors = { A: '#d84b3f', B: '#1f7a5a', C: '#2f80ed' };
  Object.entries(getCurrentProjectionState()).forEach(([name, p]) => {
    const color = pointColors[name] ?? '#1e2d46';
    const x = -p.x * scale;
    const yV = -p.z * scale;
    const yH = p.y * scale;
    const wX = p.y * scale;
    const transfer = { x: wX, y: wX };
    const marks = [
      { label: getUnfoldProjectionLabel(name, 'V', getPointProjectionLabel(name, 'V')), x, y: yV, key: 'V' },
      { label: getUnfoldProjectionLabel(name, 'H', getPointProjectionLabel(name, 'H')), x, y: yH, key: 'H' },
      { label: getUnfoldProjectionLabel(name, 'W', getPointProjectionLabel(name, 'W')), x: wX, y: yV, key: 'W' }
    ];
    unfoldMarks[name] = { V: marks[0], H: marks[1], W: marks[2] };
    addSvgGuide(svg, marks[0], marks[1], color);
    addSvgGuide(svg, marks[0], marks[2], color);
    addSvgGuide(svg, marks[1], transfer, color);
    addSvgGuide(svg, marks[2], transfer, color);
    drawUnfoldMark(svg, transfer, '', color, 3);
    marks.forEach((mark) => {
      drawUnfoldMark(svg, mark, mark.label, color, 5);
    });
  });
  if (currentMode === 'lines') {
    drawUnfoldProjectionSegment(svg, unfoldMarks.A.V, unfoldMarks.B.V, '#d84b3f');
    drawUnfoldProjectionSegment(svg, unfoldMarks.A.H, unfoldMarks.B.H, '#1f7a5a');
    drawUnfoldProjectionSegment(svg, unfoldMarks.A.W, unfoldMarks.B.W, '#d98a35');
    Object.values(unfoldMarks).forEach((views) => {
      Object.values(views).forEach((mark) => drawUnfoldMark(svg, mark, '', '#1e2d46', 3.2));
    });
  }
  if (currentMode === 'planes') {
    drawUnfoldProjectionShape(svg, [unfoldMarks.A.V, unfoldMarks.B.V, unfoldMarks.C.V], '#d84b3f');
    drawUnfoldProjectionShape(svg, [unfoldMarks.A.H, unfoldMarks.B.H, unfoldMarks.C.H], '#1f7a5a');
    drawUnfoldProjectionShape(svg, [unfoldMarks.A.W, unfoldMarks.B.W, unfoldMarks.C.W], '#d98a35');
    Object.values(unfoldMarks).forEach((views) => {
      Object.values(views).forEach((mark) => drawUnfoldMark(svg, mark, '', '#1e2d46', 3.2));
    });
  }
  if (currentMode === 'lines') {
    renderLineInfo();
  } else if (currentMode === 'planes') {
    renderPlaneInfo();
  } else {
    renderPointRelation();
  }
}

function getCurrentProjectionState() {
  return currentMode === 'planes' ? planeProjectionState : pointProjectionState;
}

function getProjectionPanelTitle() {
  if (currentMode === 'lines') return '直线的投影图';
  if (currentMode === 'planes') return '平面的投影图';
  return '点的投影图';
}

function getProjectionPanelSubject() {
  if (currentMode === 'lines') return '直线';
  if (currentMode === 'planes') return '平面';
  return '点';
}

function getUnfoldProjectionLabel(pointName, viewKey, fallback) {
  if (currentMode !== 'lines') return fallback;
  const overlapLabels = {
    frontPerpendicular: { view: 'V', label: "b'(a')" },
    plumb: { view: 'H', label: 'b(a)' },
    sidePerpendicular: { view: 'W', label: "b''(a'')" }
  };
  const overlap = overlapLabels[currentLineProjectionType];
  if (!overlap || overlap.view !== viewKey) return fallback;
  return pointName === 'B' ? overlap.label : '';
}

function drawUnfoldProjectionSegment(svg, a, b, color) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  if (Math.hypot(dx, dy) < 0.1) {
    drawUnfoldMark(svg, a, '', color, 6);
    return;
  }
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', a.x);
  line.setAttribute('y1', a.y);
  line.setAttribute('x2', b.x);
  line.setAttribute('y2', b.y);
  line.setAttribute('stroke', color);
  line.setAttribute('stroke-width', '3.2');
  line.setAttribute('stroke-linecap', 'round');
  line.setAttribute('opacity', '0.92');
  svg.appendChild(line);
}

function drawUnfoldProjectionShape(svg, marks, color) {
  const area = Math.abs(
    (marks[1].x - marks[0].x) * (marks[2].y - marks[0].y)
    - (marks[2].x - marks[0].x) * (marks[1].y - marks[0].y)
  ) / 2;
  if (area > 0.1) {
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('points', marks.map((mark) => `${mark.x},${mark.y}`).join(' '));
    polygon.setAttribute('fill', color);
    polygon.setAttribute('fill-opacity', '0.14');
    polygon.setAttribute('stroke', color);
    polygon.setAttribute('stroke-width', '3');
    polygon.setAttribute('stroke-linejoin', 'round');
    polygon.setAttribute('opacity', '0.9');
    svg.appendChild(polygon);
    return;
  }
  const [a, b] = getFarthestUnfoldMarks(marks);
  drawUnfoldProjectionSegment(svg, a, b, color);
}

function getFarthestUnfoldMarks(marks) {
  let best = [marks[0], marks[1]];
  let bestDistance = 0;
  for (let i = 0; i < marks.length; i += 1) {
    for (let j = i + 1; j < marks.length; j += 1) {
      const distance = Math.hypot(marks[i].x - marks[j].x, marks[i].y - marks[j].y);
      if (distance > bestDistance) {
        bestDistance = distance;
        best = [marks[i], marks[j]];
      }
    }
  }
  return best;
}

function drawUnfoldMark(svg, mark, label, color, radius) {
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', mark.x);
  circle.setAttribute('cy', mark.y);
  circle.setAttribute('r', radius);
  circle.setAttribute('fill', color);
  svg.appendChild(circle);
  if (!label) return;
  const labelPosition = getUnfoldLabelPosition(svg, mark, label);
  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  text.setAttribute('x', labelPosition.x);
  text.setAttribute('y', labelPosition.y);
  text.setAttribute('class', 'unfold-label');
  text.textContent = label;
  svg.appendChild(text);
}

function getUnfoldLabelPosition(svg, mark, label) {
  if (!svg._labelBoxes) svg._labelBoxes = [];
  const width = Math.max(10, label.length * 7.2);
  const height = 14;
  const forced = getForcedUnfoldLabelPosition(mark, label, width);
  if (forced) {
    const box = makeUnfoldLabelBox(mark, forced, width, height);
    svg._labelBoxes.push(box);
    return { x: mark.x + forced.dx, y: mark.y + forced.dy };
  }
  const candidates = [
    { dx: 7, dy: -7, anchor: 'left' },
    { dx: 7, dy: 15, anchor: 'left' },
    { dx: -width - 7, dy: -7, anchor: 'left' },
    { dx: -width - 7, dy: 15, anchor: 'left' },
    { dx: 12, dy: 1, anchor: 'left' },
    { dx: -width - 12, dy: 1, anchor: 'left' },
    { dx: -width / 2, dy: -16, anchor: 'left' },
    { dx: -width / 2, dy: 24, anchor: 'left' }
  ];
  const position = candidates.find((candidate) => {
    const box = makeUnfoldLabelBox(mark, candidate, width, height);
    return !svg._labelBoxes.some((existing) => boxesOverlap(box, existing));
  }) ?? candidates[0];
  const box = makeUnfoldLabelBox(mark, position, width, height);
  svg._labelBoxes.push(box);
  return { x: mark.x + position.dx, y: mark.y + position.dy };
}

function getForcedUnfoldLabelPosition(mark, label, width) {
  if (currentMode !== 'planes') return null;
  const leftTop = { dx: -width - 7, dy: -7 };
  const leftBottom = { dx: -width - 7, dy: 15 };
  const rightBottom = { dx: 7, dy: 15 };
  const rules = {
    horizontal: {
      V: { A: leftTop },
      W: { B: leftTop }
    },
    frontPerpendicular: {
      V: { C: leftBottom }
    },
    sidePerpendicular: {
      V: { B: leftTop, C: leftTop },
      H: { B: leftTop, C: leftTop }
    },
    general: {
      V: { C: rightBottom },
      H: { C: rightBottom }
    }
  };
  return rules[currentPlaneProjectionType]?.[mark.key]?.[labelToPointName(label)] ?? null;
}

function labelToPointName(label) {
  return label?.[0]?.toUpperCase();
}

function makeUnfoldLabelBox(mark, position, width, height) {
  const x = mark.x + position.dx;
  const y = mark.y + position.dy;
  return { x1: x - 2, y1: y - height, x2: x + width + 2, y2: y + 3 };
}

function boxesOverlap(a, b) {
  return a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
}

function addSvgGuide(svg, a, b, color) {
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', a.x);
  line.setAttribute('y1', a.y);
  line.setAttribute('x2', b.x);
  line.setAttribute('y2', b.y);
  line.setAttribute('stroke', color);
  line.setAttribute('stroke-width', '0.9');
  line.setAttribute('opacity', '0.58');
  svg.appendChild(line);
}

function renderPointRelation() {
  const a = pointProjectionState.A;
  const b = pointProjectionState.B;
  document.querySelector('.panel-section.compact .section-title h3').textContent = 'A 与 B 的位置关系';
  document.querySelector('.info-list').innerHTML = `
    <div><dt>前后</dt><dd>A在B的${a.y > b.y ? '前方' : a.y < b.y ? '后方' : '同一前后位置'}</dd></div>
    <div><dt>左右</dt><dd>A在B的${a.x > b.x ? '左方' : a.x < b.x ? '右方' : '同一左右位置'}</dd></div>
    <div><dt>上下</dt><dd>A在B的${a.z > b.z ? '上方' : a.z < b.z ? '下方' : '同一高度'}</dd></div>
  `;
}

function renderLineInfo() {
  const preset = lineProjectionPresets[currentLineProjectionType] ?? lineProjectionPresets.general;
  document.querySelector('.panel-section.compact .section-title h3').textContent = '直线类型';
  document.querySelector('.info-list').innerHTML = `
    <div><dt>类型</dt><dd>${preset.label}</dd></div>
    <div><dt>说明</dt><dd>AB 及 a'b'、ab、a''b'' 已在三维视图和展开投影图中显示</dd></div>
  `;
}

function renderPlaneInfo() {
  const preset = planeProjectionPresets[currentPlaneProjectionType] ?? planeProjectionPresets.general;
  document.querySelector('.panel-section.compact .section-title h3').textContent = '平面类型';
  document.querySelector('.info-list').innerHTML = `
    <div><dt>类型</dt><dd>${preset.label}</dd></div>
    <div><dt>说明</dt><dd>三角形 ABC 及其三面投影已在三维视图和展开投影图中显示</dd></div>
  `;
}

function modelMaterial(curved) {
  return new THREE.MeshStandardMaterial({
    color: curved ? 0x9db7d8 : 0xa9bdd5,
    roughness: 0.58,
    metalness: 0.12,
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide
  });
}

function buildPolyhedronGeometry(vertices, faces) {
  const positions = [];
  faces.forEach((face) => {
    for (let i = 1; i < face.length - 1; i += 1) {
      [face[0], face[i], face[i + 1]].forEach((index) => {
        const vertex = vertices[index];
        positions.push(vertex.x, vertex.y, vertex.z);
      });
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function extractEdgesFromFaces(faces) {
  const keys = new Set();
  const edges = [];
  faces.forEach((face) => {
    for (let i = 0; i < face.length; i += 1) {
      const a = face[i];
      const b = face[(i + 1) % face.length];
      const key = [Math.min(a, b), Math.max(a, b)].join('-');
      if (!keys.has(key)) {
        keys.add(key);
        edges.push([a, b]);
      }
    }
  });
  return edges;
}

function createEdgeLine(edge) {
  const curve = new THREE.LineCurve3(edge.start, edge.end);
  const geometry = new THREE.TubeGeometry(curve, 1, 0.025, 8);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0x26364f }));
  mesh.userData = {
    pickType: 'edge',
    id: edge.id,
    label: `轮廓线 ${edge.id}`,
    start: edge.start,
    end: edge.end,
    hidden: false
  };
  return mesh;
}

function createFacePickMesh(vertices, face, faceId) {
  const geometry = buildPolyhedronGeometry(vertices, [face]);
  const material = new THREE.MeshBasicMaterial({
    color: 0xffd66e,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData = { pickType: 'face', id: faceId, label: `面 ${faceId}` };
  return mesh;
}

function createCircularFacePickMesh(radius, y, faceId) {
  const geometry = new THREE.CircleGeometry(radius, 96);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, y, 0);
  const material = new THREE.MeshBasicMaterial({
    color: 0xffd66e,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData = { pickType: 'face', id: faceId, label: `面 ${faceId}` };
  return mesh;
}

function renderOrthographicViews(definition) {
  const views = [
    { id: 'frontView', name: 'front', dir: new THREE.Vector3(0, 0, 1), project: (v) => [v.x, -v.y] },
    { id: 'topView', name: 'top', dir: new THREE.Vector3(0, 1, 0), project: (v) => [v.x, v.z] },
    { id: 'sideView', name: 'side', dir: new THREE.Vector3(-1, 0, 0), project: (v) => [v.z, -v.y] }
  ];
  const bounds = getDefinitionBounds(definition);
  const max = Math.max(bounds.maxAbs, 1);
  const scale = 78 / max;

  views.forEach((view) => {
    const svg = document.querySelector(`#${view.id}`);
    svg.innerHTML = viewGrid(view.id);
    const primitives = getViewPrimitives(definition, view, scale);
    primitives.filter((item) => item.type === 'face').forEach((item) => appendSvgPrimitive(svg, item));
    primitives.filter((item) => item.hidden).forEach((item) => appendSvgPrimitive(svg, item));
    primitives.filter((item) => !item.hidden && item.type !== 'face' && item.type !== 'point').forEach((item) => appendSvgPrimitive(svg, item));
    primitives.filter((item) => item.type === 'point' && item.pointId).forEach((item) => appendSvgPrimitive(svg, item));
    primitives.filter((item) => item.type === 'point' && !item.pointId).forEach((item) => appendSvgPrimitive(svg, item));
  });
}

function viewGrid(id) {
  return `
    <defs>
      <pattern id="grid-${id}" width="12" height="12" patternUnits="userSpaceOnUse">
        <path d="M 12 0 L 0 0 0 12" fill="none" stroke="#e5eaf3" stroke-width="0.7"/>
      </pattern>
    </defs>
    <rect x="-120" y="-120" width="240" height="240" fill="url(#grid-${id})"/>
    <line x1="-104" y1="0" x2="104" y2="0" class="axis-line"/>
    <line x1="0" y1="-104" x2="0" y2="104" class="axis-line"/>
  `;
}

function getViewPrimitives(definition, view, scale) {
  if (definition.projectionMode === 'cylinder') return cylinderViewPrimitives(view.name, scale);
  if (definition.projectionMode === 'cone') return coneViewPrimitives(definition.cone, view.name, scale);
  if (definition.projectionMode === 'torus') return torusViewPrimitives(definition.torus, view.name, scale);
  if (definition.projectionMode === 'sphere') return sphereViewPrimitives(definition.sphere, scale);

  const faceItems = definition.faces.flatMap((face, index) => {
    const points = face.map((vertexIndex) => {
      const [x, y] = view.project(definition.vertices[vertexIndex]);
      return [x * scale, y * scale];
    });
    return faceProjectionPrimitive(`f${index + 1}`, uniqueProjectedPoints(points));
  });

  const edgeItems = definition.edges.map((edge) => {
    const [x1, y1] = view.project(edge.start);
    const [x2, y2] = view.project(edge.end);
    if (Math.hypot((x2 - x1) * scale, (y2 - y1) * scale) < 0.8) {
      return {
        type: 'point',
        edgeId: edge.id,
        cx: x1 * scale,
        cy: y1 * scale
      };
    }
    return {
      type: 'line',
      edgeId: edge.id,
      hidden: isEdgeHiddenInView(definition, edge, view.dir),
      x1: x1 * scale,
      y1: y1 * scale,
      x2: x2 * scale,
      y2: y2 * scale
    };
  });

  const pointItems = definition.vertices.slice(0, definition.pointLimit ?? 0).map((vertex, index) => {
    const [x, y] = view.project(vertex);
    return {
      type: 'point',
      pointId: `p${index + 1}`,
      cx: x * scale,
      cy: y * scale
    };
  });

  return [...faceItems, ...edgeItems, ...pointItems];
}

function uniqueProjectedPoints(points) {
  const unique = [];
  points.forEach((point) => {
    if (!unique.some(([x, y]) => Math.abs(x - point[0]) < 0.01 && Math.abs(y - point[1]) < 0.01)) {
      unique.push(point);
    }
  });
  return unique;
}

function faceProjectionPrimitive(faceId, points) {
  if (points.length >= 3) {
    if (areCollinear(points)) {
      const [a, b] = farthestPointPair(points);
      return [{
        type: 'line',
        faceId,
        hidden: false,
        x1: a[0],
        y1: a[1],
        x2: b[0],
        y2: b[1]
      }];
    }
    return [{
      type: 'face',
      faceId,
      points: points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
    }];
  }
  if (points.length === 2) {
    return [{
      type: 'line',
      faceId,
      hidden: false,
      x1: points[0][0],
      y1: points[0][1],
      x2: points[1][0],
      y2: points[1][1]
    }];
  }
  if (points.length === 1) {
    return [{
      type: 'point',
      faceId,
      cx: points[0][0],
      cy: points[0][1]
    }];
  }
  return [];
}

function areCollinear(points) {
  if (points.length < 3) return false;
  const [a, b] = farthestPointPair(points);
  return points.every((p) => Math.abs((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) < 0.8);
}

function farthestPointPair(points) {
  let best = [points[0], points[1]];
  let bestDistance = -1;
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const distance = (points[i][0] - points[j][0]) ** 2 + (points[i][1] - points[j][1]) ** 2;
      if (distance > bestDistance) {
        bestDistance = distance;
        best = [points[i], points[j]];
      }
    }
  }
  return best;
}

function cylinderViewPrimitives(viewName, scale) {
  const r = 1.05 * scale;
  const h = 2.1 * scale;
  if (viewName === 'top') {
    return [
      { type: 'circle', edgeId: 'e1', faceId: 'f1', hidden: true, cx: 0, cy: 0, r },
      { type: 'circle', edgeId: 'e97', faceId: 'f2', hidden: false, cx: 0, cy: 0, r }
    ];
  }
  return [
    { type: 'line', hidden: false, x1: -r, y1: -h / 2, x2: -r, y2: h / 2 },
    { type: 'line', hidden: false, x1: r, y1: -h / 2, x2: r, y2: h / 2 },
    { type: 'line', edgeId: 'e97', faceId: 'f2', hidden: false, x1: -r, y1: -h / 2, x2: r, y2: -h / 2 },
    { type: 'line', edgeId: 'e1', faceId: 'f1', hidden: false, x1: -r, y1: h / 2, x2: r, y2: h / 2 }
  ];
}

function coneViewPrimitives(cone, viewName, scale) {
  const r = cone.radius * scale;
  const h = cone.height * scale;
  if (viewName === 'top') {
    return [
      { type: 'circle', edgeId: 'e1', faceId: 'f1', hidden: false, cx: 0, cy: 0, r },
      { type: 'line', hidden: true, x1: -r * 0.72, y1: 0, x2: r * 0.72, y2: 0 }
    ];
  }
  return [
    { type: 'line', edgeId: 'e1', faceId: 'f1', hidden: false, x1: -r, y1: h / 2, x2: r, y2: h / 2 },
    { type: 'line', hidden: false, x1: -r, y1: h / 2, x2: 0, y2: -h / 2 },
    { type: 'line', hidden: false, x1: r, y1: h / 2, x2: 0, y2: -h / 2 },
    { type: 'line', hidden: true, x1: -r * 0.7, y1: h / 2, x2: r * 0.7, y2: h / 2 }
  ];
}

function torusViewPrimitives(torus, viewName, scale) {
  const outer = torus.outer * scale;
  const inner = torus.inner * scale;
  const tube = torus.tube * scale;
  const centerRadius = torus.major * scale;
  if (viewName === 'top') {
    return [
      { type: 'circle', hidden: false, cx: 0, cy: 0, r: outer },
      { type: 'circle', hidden: false, cx: 0, cy: 0, r: inner }
    ];
  }
  return [
    { type: 'line', hidden: false, x1: -centerRadius, y1: -tube, x2: centerRadius, y2: -tube },
    { type: 'line', hidden: false, x1: -centerRadius, y1: tube, x2: centerRadius, y2: tube },
    { type: 'circleArc', hidden: false, cx: -centerRadius, cy: 0, r: tube, start: -Math.PI / 2, end: Math.PI / 2, sweep: 0 },
    { type: 'circleArc', hidden: false, cx: centerRadius, cy: 0, r: tube, start: -Math.PI / 2, end: Math.PI / 2, sweep: 1 },
    { type: 'circleArc', hidden: true, cx: -centerRadius, cy: 0, r: tube, start: -Math.PI / 2, end: Math.PI / 2, sweep: 1 },
    { type: 'circleArc', hidden: true, cx: centerRadius, cy: 0, r: tube, start: -Math.PI / 2, end: Math.PI / 2, sweep: 0 }
  ];
}

function sphereViewPrimitives(sphere, scale) {
  return [{ type: 'circle', hidden: false, cx: 0, cy: 0, r: sphere.radius * scale }];
}

function appendSvgPrimitive(svg, item) {
  let element;
  if (item.type === 'circle') {
    element = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    element.setAttribute('cx', item.cx);
    element.setAttribute('cy', item.cy);
    element.setAttribute('r', item.r);
    element.setAttribute('fill', 'none');
  } else if (item.type === 'ellipse') {
    element = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    element.setAttribute('cx', item.cx);
    element.setAttribute('cy', item.cy);
    element.setAttribute('rx', item.rx);
    element.setAttribute('ry', item.ry);
    element.setAttribute('fill', 'none');
  } else if (item.type === 'stadium') {
    element = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const x0 = item.cx - item.rx + item.ry;
    const x1 = item.cx + item.rx - item.ry;
    const top = item.cy - item.ry;
    const bottom = item.cy + item.ry;
    element.setAttribute(
      'd',
      `M ${x0} ${top} L ${x1} ${top} A ${item.ry} ${item.ry} 0 0 1 ${x1} ${bottom} L ${x0} ${bottom} A ${item.ry} ${item.ry} 0 0 1 ${x0} ${top}`
    );
    element.setAttribute('fill', 'none');
  } else if (item.type === 'arc') {
    element = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    element.setAttribute('d', `M ${item.x1} ${item.y1} A ${item.rx} ${item.ry} 0 0 ${item.sweep} ${item.x2} ${item.y2}`);
    element.setAttribute('fill', 'none');
  } else if (item.type === 'circleArc') {
    element = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const x1 = item.cx + Math.cos(item.start) * item.r;
    const y1 = item.cy + Math.sin(item.start) * item.r;
    const x2 = item.cx + Math.cos(item.end) * item.r;
    const y2 = item.cy + Math.sin(item.end) * item.r;
    element.setAttribute('d', `M ${x1} ${y1} A ${item.r} ${item.r} 0 0 ${item.sweep} ${x2} ${y2}`);
    element.setAttribute('fill', 'none');
  } else if (item.type === 'point') {
    element = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    element.setAttribute('cx', item.cx);
    element.setAttribute('cy', item.cy);
    const radius = item.edgeId || item.faceId ? 5.2 : 4;
    element.setAttribute('r', radius);
    element.dataset.baseRadius = radius;
  } else if (item.type === 'face') {
    element = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    element.setAttribute('points', item.points);
  } else {
    element = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    element.setAttribute('x1', item.x1);
    element.setAttribute('y1', item.y1);
    element.setAttribute('x2', item.x2);
    element.setAttribute('y2', item.y2);
  }

  const className = item.type === 'point'
    ? 'projection-point'
    : item.type === 'face'
      ? 'projection-face'
      : `projection-edge${item.hidden ? ' hidden-line' : ''}`;
  element.setAttribute('class', className);
  if (item.edgeId) {
    element.dataset.edgeId = item.edgeId;
    element.addEventListener('pointerenter', () => setHover({ type: 'edge', id: item.edgeId }));
    element.addEventListener('pointerleave', () => setHover(null));
    element.addEventListener('click', () => setSelected({ type: 'edge', id: item.edgeId, label: `轮廓线 ${item.edgeId}` }));
    if (!edgeSvgElements.has(item.edgeId)) edgeSvgElements.set(item.edgeId, []);
    edgeSvgElements.get(item.edgeId).push(element);
  }
  if (item.pointId) {
    element.dataset.pointId = item.pointId;
    element.addEventListener('pointerenter', () => setHover({ type: 'point', id: item.pointId }));
    element.addEventListener('pointerleave', () => setHover(null));
    element.addEventListener('click', () => setSelected({ type: 'point', id: item.pointId, label: `点 ${item.pointId}` }));
    if (!pointSvgElements.has(item.pointId)) pointSvgElements.set(item.pointId, []);
    pointSvgElements.get(item.pointId).push(element);
  }
  if (item.faceId) {
    element.dataset.faceId = item.faceId;
    element.addEventListener('pointerenter', () => setHover({ type: 'face', id: item.faceId }));
    element.addEventListener('pointerleave', () => setHover(null));
    element.addEventListener('click', () => setSelected({ type: 'face', id: item.faceId, label: `面 ${item.faceId}` }));
    if (!faceSvgElements.has(item.faceId)) faceSvgElements.set(item.faceId, []);
    faceSvgElements.get(item.faceId).push(element);
  }
  svg.appendChild(element);
}

function getDefinitionBounds(definition) {
  const box = new THREE.Box3();
  if (definition.geometry) {
    definition.geometry.computeBoundingBox();
    box.copy(definition.geometry.boundingBox);
  }
  definition.vertices.forEach((vertex) => box.expandByPoint(vertex));
  if (box.isEmpty()) box.setFromCenterAndSize(new THREE.Vector3(), new THREE.Vector3(2, 2, 2));
  const maxAbs = Math.max(
    Math.abs(box.min.x), Math.abs(box.max.x),
    Math.abs(box.min.y), Math.abs(box.max.y),
    Math.abs(box.min.z), Math.abs(box.max.z)
  );
  return { box, maxAbs };
}

function isEdgeHiddenInView(definition, edge, viewDir) {
  if (!definition.geometry || definition.projectionMode !== 'poly') return false;
  if (definition.solidKind === 'prism' && Math.abs(viewDir.z - 1) < 0.001 && isVerticalPrismEdge(edge)) {
    return isBehindFrontProfile(definition, edge.start);
  }
  const mesh = new THREE.Mesh(definition.geometry);
  const midpoint = edge.start.clone().add(edge.end).multiplyScalar(0.5);
  const origin = midpoint.clone().add(viewDir.clone().multiplyScalar(20));
  const caster = new THREE.Raycaster(origin, viewDir.clone().multiplyScalar(-1).normalize(), 0, 40);
  const hits = caster.intersectObject(mesh, false);
  if (!hits.length) return false;
  return hits[0].distance < 19.95;
}

function isVerticalPrismEdge(edge) {
  return Math.abs(edge.start.x - edge.end.x) < 0.001
    && Math.abs(edge.start.z - edge.end.z) < 0.001
    && Math.abs(edge.start.y - edge.end.y) > 0.001;
}

function isBehindFrontProfile(definition, point) {
  const base = definition.vertices.slice(0, definition.sides);
  const intersections = [];
  for (let i = 0; i < base.length; i += 1) {
    const a = base[i];
    const b = base[(i + 1) % base.length];
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    if (point.x < minX - 0.001 || point.x > maxX + 0.001 || Math.abs(a.x - b.x) < 0.001) continue;
    const t = (point.x - a.x) / (b.x - a.x);
    if (t < -0.001 || t > 1.001) continue;
    intersections.push(THREE.MathUtils.lerp(a.z, b.z, t));
  }
  if (!intersections.length) return false;
  return point.z < Math.max(...intersections) - 0.02;
}

function isEdgeHiddenFromCamera(edge) {
  if (!bodyMeshes.length || !currentDefinition || currentDefinition.projectionMode !== 'poly') return false;
  const midpoint = edge.userData.start.clone().add(edge.userData.end).multiplyScalar(0.5);
  const direction = midpoint.clone().sub(camera.position);
  const distance = direction.length();
  raycaster.set(camera.position, direction.normalize());
  const hits = raycaster.intersectObjects(bodyMeshes, false);
  return hits.some((hit) => hit.distance < distance - 0.045);
}

function setSelected(next) {
  selected = next;
  applyHighlights();
  updateSelectionInfo();
}

function setHover(next) {
  hovered = next;
  applyHighlights();
}

function applyHighlights() {
  edgeMeshes.forEach((mesh, id) => {
    const active = selected?.type === 'edge' && selected.id === id;
    const hover = hovered?.type === 'edge' && hovered.id === id;
    const hidden = mesh.userData.hidden;
    mesh.material = active
      ? (hidden ? lineMaterials.selectedHidden : lineMaterials.selected)
      : hover
        ? (hidden ? lineMaterials.hoverHidden : lineMaterials.hover)
        : (hidden ? lineMaterials.hidden : lineMaterials.visible);
    mesh.renderOrder = active ? 20 : hover ? 15 : 0;
  });

  pointMeshes.forEach((mesh, id) => {
    const active = selected?.type === 'point' && selected.id === id;
    const hover = hovered?.type === 'point' && hovered.id === id;
    mesh.material.color.set(active ? 0xffb000 : hover ? 0x2f80ed : 0x22314a);
  });

  faceMeshes.forEach((mesh) => {
    const active = selected?.type === 'face' && selected.id === mesh.userData.id;
    const hover = hovered?.type === 'face' && hovered.id === mesh.userData.id;
    mesh.material.opacity = active ? 0.42 : hover ? 0.22 : 0;
  });

  edgeSvgElements.forEach((elements, id) => {
    const active = selected?.type === 'edge' && selected.id === id;
    const hover = hovered?.type === 'edge' && hovered.id === id;
    elements.forEach((element) => {
      element.classList.toggle('active', active);
      element.classList.toggle('hovered', hover);
    });
  });

  pointSvgElements.forEach((elements, id) => {
    const active = selected?.type === 'point' && selected.id === id;
    const hover = hovered?.type === 'point' && hovered.id === id;
    elements.forEach((point) => {
      point.classList.toggle('active', active);
      point.classList.toggle('hovered', hover);
      point.setAttribute('r', active ? 6.5 : hover ? 5.5 : point.dataset.baseRadius ?? 4);
      point.setAttribute('fill', active ? '#ffb000' : hover ? '#2f80ed' : '#1e2d46');
      point.setAttribute('stroke', active ? '#ffb000' : '#ffffff');
      point.setAttribute('stroke-width', active ? 2.2 : 1.4);
      if ((active || hover) && point.parentNode) point.parentNode.appendChild(point);
    });
  });

  faceSvgElements.forEach((elements, id) => {
    const active = selected?.type === 'face' && selected.id === id;
    const hover = hovered?.type === 'face' && hovered.id === id;
    elements.forEach((element) => {
      element.classList.toggle('active', active);
      element.classList.toggle('hovered', hover);
    });
  });
}

function updateHiddenModelEdges() {
  edgeMeshes.forEach((mesh) => {
    const hidden = isEdgeHiddenFromCamera(mesh);
    if (mesh.userData.hidden !== hidden) {
      mesh.userData.hidden = hidden;
      applyHighlights();
    }
  });
}

function updateSelectionInfo() {
  const currentSelectedType = document.querySelector('#selectedType');
  const currentSelectedId = document.querySelector('#selectedId');
  const currentSelectedDesc = document.querySelector('#selectedDesc');
  if (!currentSelectedType || !currentSelectedId || !currentSelectedDesc) return;
  const typeLabel = {
    edge: '轮廓线',
    point: '点',
    face: '面',
    plane: '投影面',
    body: '实体'
  };
  if (!selected) {
    selectionChip.textContent = '未选中元素';
    currentSelectedType.textContent = '无';
    currentSelectedId.textContent = '-';
    currentSelectedDesc.textContent = '点击模型点、边、面或三视图线段进行联动高亮';
    return;
  }
  selectionChip.textContent = `${typeLabel[selected.type]}：${selected.id ?? selected.label}`;
  currentSelectedType.textContent = typeLabel[selected.type];
  currentSelectedId.textContent = selected.id ?? '-';
  currentSelectedDesc.textContent = selected.label ?? '已选中';
}

function setView(view) {
  const distance = camera.position.distanceTo(controls.target);
  const positions = {
    front: new THREE.Vector3(0, 0, distance),
    top: new THREE.Vector3(0, distance, 0.001),
    right: new THREE.Vector3(-distance, 0, 0),
    iso: new THREE.Vector3(5.5, 4.2, 6).setLength(distance)
  };
  const next = positions[view] ?? positions.iso;
  animateCamera(next, controls.target);
}

function resetCameraView(mode = currentMode) {
  const target = mode === 'points' || mode === 'lines' || mode === 'planes' ? pointCameraTarget : solidCameraTarget;
  controls.target.copy(target);
  camera.position.copy(target).add(defaultCameraOffset);
  camera.zoom = mode === 'points' || mode === 'lines' || mode === 'planes' ? pointCameraZoom : solidCameraZoom;
  camera.lookAt(controls.target);
  camera.updateProjectionMatrix();
  controls.update();
}

function animateCamera(nextPosition, target) {
  const start = camera.position.clone();
  const end = target.clone().add(nextPosition);
  const startTime = performance.now();
  const duration = 520;

  function tick(now) {
    const t = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    camera.position.lerpVectors(start, end, eased);
    camera.lookAt(target);
    controls.update();
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

document.querySelector('.toolbar-actions').addEventListener('click', (event) => {
  const button = event.target.closest('[data-view]');
  if (button) setView(button.dataset.view);
});
document.querySelector('#resetView').addEventListener('click', resetCameraView);

renderer.domElement.addEventListener('pointermove', (event) => {
  const hit = pick(event);
  if (hit?.object?.userData?.pickType) {
    const object = hit.object;
    setHover({
      type: object.userData.pickType,
      id: object.userData.id,
      label: object.userData.label
    });
  } else {
    setHover(null);
  }
});

renderer.domElement.addEventListener('pointerleave', () => setHover(null));
renderer.domElement.addEventListener('click', (event) => {
  const hit = pick(event);
  if (!hit?.object?.userData?.pickType) return;
  const object = hit.object;
  const type = object.userData.pickType;
  if (type === 'plane') return;
  setSelected({ type, id: object.userData.id, label: object.userData.label });
});

function pick(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObjects(pickables, true)[0];
}

function resize() {
  const rect = canvasWrap.getBoundingClientRect();
  renderer.setSize(rect.width, rect.height);
  labelRenderer.setSize(rect.width, rect.height);
  const aspect = rect.width / rect.height;
  const viewHeight = 6;
  camera.left = -viewHeight * aspect / 2;
  camera.right = viewHeight * aspect / 2;
  camera.top = viewHeight / 2;
  camera.bottom = -viewHeight / 2;
  camera.updateProjectionMatrix();
}

window.addEventListener('resize', resize);
resize();
if (currentMode === 'points') {
  renderModuleList();
  loadPointProjection();
} else {
  loadModel(currentModelId);
}

function animate() {
  controls.update();
  updateHiddenModelEdges();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
