/**
 * Board Digital Viewer - Main Logic
 * Reorganized and Cleaned
 */

// --- Global State ---
let pcbData = null

let startOffsetX = 0
let startOffsetY = 0

// Render Lists
let renderData = {
  boardLines: [],      // Board outlines and silkscreen
  signals: [],         // Signal traces
  componentOutlines: [], // Component body outlines
  pins: [],            // Pads/Pins locations and shapes
  componentCenters: [], // Component center points (red dots)
  virtualOutlines: []
}

// View State
let view = {
  scale: 1,
  offsetX: 0,
  offsetY: 0
}
let targetView = {
  scale: 1,
  offsetX: 0,
  offsetY: 0
}
let isAnimating = false
const LERP_FACTOR = 0.25
const FLIP_VERTICAL = true

let bounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 }
let isDragging = false
const DRAG_THRESHOLD = 4
const PAN_DAMPING = 0.5
const PAN_VISIBILITY_MARGIN = 20
const VIEW_MARGIN = 20
const PAN_ALPHA = 0.3
let dragStartX = 0
let dragStartY = 0
let hasDragged = false
let panVX = 0
let panVY = 0
let selectedPin = null
let selectedNet = null
let currentNetPins = []
let currentNetPinIndex = -1
let boardFilters = { circles: false, markerCircles: true, arcs: true, semiArcs: false, semiAsOutlines: false, rects: true, labels: true }
const MARKER_RADIUS_MAX = 3.5
const ARC_SEMI_TOL = 20 // grados de tolerancia alrededor de 180°
const RECT_VISUAL_SCALE = 1

// --- p5.js Lifecycle ---

function preload() {
  const params = new URLSearchParams(window.location.search)
  let fileUrl = params.get('file')

  // Handle unencoded URLs with query parameters (like Firebase tokens)
  if (fileUrl) {
     const search = window.location.search
     const fileParamIndex = search.indexOf('file=')
     if (fileParamIndex !== -1) {
         // Grab everything after 'file=' to ensure we get tokens/params of the target URL
         // This assumes 'file' is the primary/last parameter for the viewer
         const potentialUrl = search.substring(fileParamIndex + 5)
         if (potentialUrl.startsWith('http')) {
             fileUrl = potentialUrl
         }
     }
  }

  if (fileUrl) {
    // Load from URL parameter
    // Example: ?file=https://.../board.db
    pcbData = loadJSON(fileUrl)
    
    // Update footer if possible (will be overwritten by setup potentially, but let's try)
    // We can store the filename to update UI later
    // Handle decoded or raw URL for display
    try {
        const urlObj = new URL(fileUrl)
        window.loadedFileName = urlObj.pathname.split('/').pop()
    } catch(e) {
        window.loadedFileName = fileUrl.split('/').pop().split('?')[0]
    }
  } else {
     // Default Fallback
     //pcbData = loadJSON('../redmi-note-15pro+.json')
     //pcbData = loadJSON('../moto-g30.json')
     pcbData = loadJSON('iphone17promax.db')
     window.loadedFileName = 'iphone17promax.db'
  }
}

function setup() {
  p5.disableFriendlyErrors = true // Boost performance
  const canvas = createCanvas(windowWidth, windowHeight)
  canvas.parent('canvas-holder')
  pixelDensity(1)
  
  targetView = { ...view }
  noLoop()
  
  const elCircles = document.getElementById('toggle-circles')
  const elMarkerCircles = document.getElementById('toggle-marker-circles')
  const elArcs = document.getElementById('toggle-arcs')
  const elSemiArcs = document.getElementById('toggle-semi-arcs')
  const elSemiAsOutlines = document.getElementById('toggle-semi-as-outlines')
  const elRects = document.getElementById('toggle-rects')
  if (elCircles) {
    elCircles.checked = boardFilters.circles
    elCircles.addEventListener('change', () => {
      boardFilters.circles = elCircles.checked
      redraw()
    })
  }
  if (elMarkerCircles) {
    elMarkerCircles.checked = boardFilters.markerCircles
    elMarkerCircles.addEventListener('change', () => {
      boardFilters.markerCircles = elMarkerCircles.checked
      redraw()
    })
  }
  if (elArcs) {
    elArcs.checked = boardFilters.arcs
    elArcs.addEventListener('change', () => {
      boardFilters.arcs = elArcs.checked
      redraw()
    })
  }
  if (elSemiArcs) {
    elSemiArcs.checked = boardFilters.semiArcs
    elSemiArcs.addEventListener('change', () => {
      boardFilters.semiArcs = elSemiArcs.checked
      redraw()
    })
  }
  if (elSemiAsOutlines) {
    elSemiAsOutlines.checked = boardFilters.semiAsOutlines
    elSemiAsOutlines.addEventListener('change', () => {
      boardFilters.semiAsOutlines = elSemiAsOutlines.checked
      redraw()
    })
  }
  if (elRects) {
    elRects.checked = boardFilters.rects
    elRects.addEventListener('change', () => {
      boardFilters.rects = elRects.checked
      redraw()
    })
  }

  const elLabels = document.getElementById('toggle-labels')
  if (elLabels) {
    elLabels.checked = boardFilters.labels
    elLabels.addEventListener('change', () => {
      boardFilters.labels = elLabels.checked
      redraw()
    })
  }
  
  setupFloatingControls()
  
  // Update Footer with Filename
  const footer = document.querySelector('.footer')
  if (footer && window.loadedFileName) {
    footer.textContent = `Archivo: ${window.loadedFileName}`
  }

  processData()
  redraw()
}

function draw() {
  if (isAnimating) {
    const dx = targetView.offsetX - view.offsetX
    const dy = targetView.offsetY - view.offsetY
    view.offsetX += dx * LERP_FACTOR
    view.offsetY += dy * LERP_FACTOR
    
    if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) {
      view.offsetX = targetView.offsetX
      view.offsetY = targetView.offsetY
      isAnimating = false
      noLoop()
    }
  }

  background(40) // Dark background

  const { transform, scaleFactor } = getTransform()
  
  push()
  // Apply global transform (Pan & Zoom)
  translate(transform.tx, transform.ty)
  scale(transform.s, FLIP_VERTICAL ? -transform.s : transform.s)
  translate(-bounds.minX, FLIP_VERTICAL ? -bounds.maxY : -bounds.minY)

  // 1. Draw Board Lines / Silkscreen
  drawLayer_BoardLines(scaleFactor)

  // 2. Draw Signals (Traces) - Optional, drawn faintly
   //drawLayer_Signals(scaleFactor) // Hidden by user request

  // 3. Draw Component Outlines
  //drawLayer_ComponentOutlines(scaleFactor)
  
  // 3b. Draw Virtual Outlines
  drawLayer_VirtualOutlines(scaleFactor)

  // 4. Draw Pins (Pads)
  drawLayer_Pins(scaleFactor)

  // 4b. Draw Selected Net (Manhattan)
  drawLayer_SelectedNet(scaleFactor)

  // 5. Draw Component Centers
  //drawLayer_ComponentCenters(scaleFactor)
  
  // 6. Draw Component Labels
  if (boardFilters.labels && !isDragging && !isAnimating) {
    drawLayer_ComponentLabels(scaleFactor)
  }
  
  // 7. Draw Pin Labels (High Zoom Only)
  if (!isDragging && !isAnimating) {
      drawLayer_PinLabels(scaleFactor)
  }

  pop()
  
  updateZoomIndicator()
}

function updateZoomIndicator() {
  const zoomEl = document.getElementById('zoom-level')
  if (zoomEl) {
    zoomEl.textContent = `Zoom: ${view.scale.toFixed(1)}x`
  }
}


function windowResized() {
  resizeCanvas(windowWidth, windowHeight)
  redraw()
}

// --- Data Processing ---

function processData() {
  if (!pcbData) return

  // Reset Data
  renderData = {
    boardLines: [],
    signals: [],
    componentOutlines: [],
    pins: [],
    componentCenters: [],
    virtualOutlines: [],
    netList: {} // Map netId -> [pinObj, pinObj...]
  }
  
  bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }

  // 1. Process Lines (Board/Silk)
    const linesObj = pcbData.line || {}
    Object.values(linesObj).forEach(entry => {
      const parsed = parseLineEntry(entry)
      if (!parsed) return
      const items = Array.isArray(parsed) ? parsed : [parsed]
      items.forEach(lineObj => {
        renderData.boardLines.push(lineObj)
        if (lineObj.type === '0' && lineObj.params && lineObj.params.length >= 3) {
          const p = lineObj.params
          const x = p[0]
          const y = p[1]
          if (p.length >= 6) {
            const w = Math.abs(p[2])
            const h = Math.abs(p[3])
            updateBounds(lineObj.base_x + x - w / 2, lineObj.base_y + y - h / 2)
            updateBounds(lineObj.base_x + x + w / 2, lineObj.base_y + y + h / 2)
          } else {
            const r = Math.abs(p[2])
            updateBounds(lineObj.base_x + x - r, lineObj.base_y + y - r)
            updateBounds(lineObj.base_x + x + r, lineObj.base_y + y + r)
          }
        } else {
          (lineObj.points || []).forEach(pt => updateBounds(lineObj.base_x + pt.x, lineObj.base_y + pt.y))
        }
      })
    })

  // 2. Build Footprint Definitions (Decals)
    const footprints = buildFootprintLibrary(pcbData.partdecal || {})

    // 3. Process Parts (Instances)
    const partsObj = pcbData.part || {}
    const partPinMap = {} // For signal mapping

    Object.entries(partsObj).forEach(([id, entry]) => {
      const part = parsePartEntry(entry, id)
      if (!part) return

      const footprint = footprints[part.footprint]
      if (!footprint) return

      const pinCount = Object.keys(footprint.pins || {}).length

      // Store Center
      renderData.componentCenters.push({ x: part.x, y: part.y, id: id, pinCount: pinCount })
      updateBounds(part.x, part.y)

      // Transform Component Outline
      if (footprint.outlines && footprint.outlines.length > 0) {
        footprint.outlines.forEach(outlineDef => {
          // For rendering, we want to rotate the SYSTEM, not the geometry.
          // Store local definition + component transform context.
          
          if (outlineDef.type === '0') {
             // Circle/Arc Logic
             renderData.componentOutlines.push({
               type: '0',
               params: outlineDef.params, // Local params
               base_x: part.x,
               base_y: part.y,
               rotation: part.rot, // System rotation
               thickness: outlineDef.thickness
             })
             
             // Update Bounds (Approximate or Calculate rotated points just for bounds)
             // Rotating geometry for bounds is necessary if we want correct AABB.
             // Or assume max extent radius?
             // Let's calculate rotated points for bounds only.
             // For Arc/Circle, bounds is center + radius (approx).
             // Rotate center p[0], p[1]
             const p = outlineDef.params
             const rLoc = rotatePoint(p[0], p[1], part.rot)
             const absX = part.x + rLoc.x
             const absY = part.y + rLoc.y
             const r = Math.abs(p[2])
             updateBounds(absX - r, absY - r)
             updateBounds(absX + r, absY + r)

          } else {
             // Polyline Logic
             renderData.componentOutlines.push({
              type: outlineDef.type,
              points: outlineDef.points, // Local points
              base_x: part.x,
              base_y: part.y,
              rotation: part.rot, // System rotation
              thickness: outlineDef.thickness,
              closed: outlineDef.closed
            })
            
            // Update Bounds (Calculate rotated points for bounds only)
            outlineDef.points.forEach(pt => {
              const r = rotatePoint(pt.x, pt.y, part.rot)
              updateBounds(part.x + r.x, part.y + r.y)
            })
          }
        })
      }

    // Transform Pins
    // Now using normalized structure: { pin, center: [x,y], size: [w,h], shape, rotation }
    if (footprint.pins) {
      partPinMap[id] = {}
      let pb = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
      Object.entries(footprint.pins).forEach(([pinId, pinLoc]) => {
        // Resolve Pad Definition (Size/Shape)
        // Ensure we have a valid definition
        let padDef = footprint.padDefinitions[pinId] || footprint.defaultPad || { w: 1, h: 1, shape: 'CIRCLE', rotation: 0 }
        
        // Calculate Absolute Position for Signals & Bounds (still needed)
        const rLoc = rotatePoint(pinLoc.x, pinLoc.y, part.rot)
        const absX = part.x + rLoc.x
        const absY = part.y + rLoc.y
        
        // Store Render Data with Local Context
        // "Rotate the system" means we use part transform + local offset
        const pinData = {
          pin: `${id}.${pinId}`,
          // Context for System Rotation
          component: { x: part.x, y: part.y, rot: part.rot },
          local: { x: pinLoc.x, y: pinLoc.y },
          
          // Absolute Center (still useful for signals/picking, kept as 'center')
          center: [absX, absY],
          
          size: [padDef.w, padDef.h],
          shape: padDef.shape,
          rotation: padDef.rotation || 0, // Rotación específica del pin/pad si está definida
          absRotation: (part.rot || 0) + (padDef.rotation || 0),
          twoPin: Object.keys(footprint.pins || {}).length === 2,
          footprintBounds: footprint.bounds
        }
        
        renderData.pins.push(pinData)
        partPinMap[id][pinId] = pinData // Store for signals
        
        // Update Bounds using Real Size
        const hw = padDef.w / 2
        const hh = padDef.h / 2
        updateBounds(absX - hw, absY - hh)
        updateBounds(absX + hw, absY + hh)
        
        const twoPin = Object.keys(footprint.pins || {}).length === 2
        const isCircleVisual = twoPin || (padDef.shape === 'CIRCLE')
        const rHalf = Math.max(hw, hh)
        const halfX = isCircleVisual ? rHalf : hw
        const halfY = isCircleVisual ? rHalf : hh
        pb.minX = Math.min(pb.minX, pinLoc.x - halfX)
        pb.maxX = Math.max(pb.maxX, pinLoc.x + halfX)
        pb.minY = Math.min(pb.minY, pinLoc.y - halfY)
        pb.maxY = Math.max(pb.maxY, pinLoc.y + halfY)
      })
      
      if (isFinite(pb.minX) && isFinite(pb.minY) && isFinite(pb.maxX) && isFinite(pb.maxY)) {
        const cx = (pb.minX + pb.maxX) / 2
        const cy = (pb.minY + pb.maxY) / 2
        const w = (pb.maxX - pb.minX) * 1.01
        const h = (pb.maxY - pb.minY) * 1.01
        renderData.virtualOutlines.push({
          id: id,
          base_x: part.x,
          base_y: part.y,
          rotation: part.rot,
          center: { x: cx, y: cy },
          size: { w, h },
          pinCount: pinCount
        })
      }
    }
  })

  // 4. Process Signals (Traces)
  const signalObj = pcbData.signal || {}
  Object.entries(signalObj).forEach(([netId, entry]) => {
    const tokens = String(entry).split(';')
    const polyline = []
    const netPins = []
    
    tokens.forEach(token => {
      const ref = parsePinRef(token)
      if (ref && partPinMap[ref.partId] && partPinMap[ref.partId][ref.pinId]) {
        const pinObj = partPinMap[ref.partId][ref.pinId]
        pinObj.netId = netId // Assign Net ID to Pin
        polyline.push(pinObj)
        netPins.push(pinObj)
      }
    })
    
    if (netPins.length > 0) {
      renderData.netList[netId] = netPins
    }
    
    if (polyline.length >= 2) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      polyline.forEach(pt => {
        const x = pt.center ? pt.center[0] : pt.x
        const y = pt.center ? pt.center[1] : pt.y
        if (isFinite(x) && isFinite(y)) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      })
      polyline.bounds = { minX, minY, maxX, maxY }
      renderData.signals.push(polyline)
    }
  })

  // Validate Bounds
  if (!isFinite(bounds.minX)) {
    bounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 }
  }

  // Calculate Focused Bounds (Components + Pins + Signals + Board Lines)
  let fb = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  
  const addPoint = (x, y) => {
    if (isFinite(x) && isFinite(y)) {
        fb.minX = Math.min(fb.minX, x)
        fb.minY = Math.min(fb.minY, y)
        fb.maxX = Math.max(fb.maxX, x)
        fb.maxY = Math.max(fb.maxY, y)
    }
  }

  // 1. Components
  renderData.componentCenters.forEach(pt => addPoint(pt.x, pt.y))
  
  // 2. Pins
  renderData.pins.forEach(pin => addPoint(pin.x, pin.y))
  
  // 3. Signals
  renderData.signals.forEach(sig => {
      if (sig.bounds) {
          fb.minX = Math.min(fb.minX, sig.bounds.minX)
          fb.minY = Math.min(fb.minY, sig.bounds.minY)
          fb.maxX = Math.max(fb.maxX, sig.bounds.maxX)
          fb.maxY = Math.max(fb.maxY, sig.bounds.maxY)
      }
  })
  
  // 4. Intelligent Bounds Calculation (Outlier Rejection)
  // We have two potential sources of truth: Components and Board Lines.
  // usually they match. If one is massive compared to the other, the massive one likely has outliers (artifacts).
  
  // A. Calculate Component Bounds (cb)
  let cb = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  renderData.componentCenters.forEach(pt => {
      cb.minX = Math.min(cb.minX, pt.x); cb.maxX = Math.max(cb.maxX, pt.x)
      cb.minY = Math.min(cb.minY, pt.y); cb.maxY = Math.max(cb.maxY, pt.y)
  })
  const hasComp = renderData.componentCenters.length > 0
  
  // B. Calculate Line Bounds (lb)
  let lb = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  renderData.boardLines.forEach(line => {
      let b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
      if (line.type === '0' && line.params) {
           const p = line.params
           const bx = line.base_x || 0; const by = line.base_y || 0
           const cx = bx + p[0]; const cy = by + p[1]
           if (p.length >= 6) { 
               const w = p[2], h = p[3]
               b = { minX: cx - w/2, maxX: cx + w/2, minY: cy - h/2, maxY: cy + h/2 }
           } else {
               const r = Math.abs(p[2])
               b = { minX: cx - r, maxX: cx + r, minY: cy - r, maxY: cy + r }
           }
      } else if (line.points) {
           const bx = line.base_x || 0; const by = line.base_y || 0
           line.points.forEach(pt => {
               const x = bx + pt.x; const y = by + pt.y
               b.minX = Math.min(b.minX, x); b.maxX = Math.max(b.maxX, x)
               b.minY = Math.min(b.minY, y); b.maxY = Math.max(b.maxY, y)
           })
      }
      if (isFinite(b.minX)) {
          lb.minX = Math.min(lb.minX, b.minX); lb.maxX = Math.max(lb.maxX, b.maxX)
          lb.minY = Math.min(lb.minY, b.minY); lb.maxY = Math.max(lb.maxY, b.maxY)
      }
  })
  const hasLine = isFinite(lb.minX)
  
  // C. Determine Reference Area
  let refBounds = null
  
  if (hasComp && hasLine) {
      const cW = cb.maxX - cb.minX; const cH = cb.maxY - cb.minY
      const lW = lb.maxX - lb.minX; const lH = lb.maxY - lb.minY
      const cArea = cW * cH
      const lArea = lW * lH
      
      // Heuristic: If one area is > 50x the other, the smaller one is the "True Board"
      if (cArea > lArea * 50 && lArea > 100) { // Ensure lArea is not tiny noise
           refBounds = lb // Trust Lines, Components have outlier
           console.log("Detectado outlier en componentes (Area excesiva). Usando Líneas como referencia.")
      } else if (lArea > cArea * 50 && cArea > 100) {
           refBounds = cb // Trust Components, Lines have outlier
           console.log("Detectado outlier en líneas (Area excesiva). Usando Componentes como referencia.")
      } else {
           // Trust Both (Union)
           refBounds = {
               minX: Math.min(cb.minX, lb.minX), maxX: Math.max(cb.maxX, lb.maxX),
               minY: Math.min(cb.minY, lb.minY), maxY: Math.max(cb.maxY, lb.maxY)
           }
      }
  } else if (hasComp) {
      refBounds = cb
  } else if (hasLine) {
      refBounds = lb
  }
  
  // D. Filter and Merge into Focused Bounds (fb)
  // Expand refBounds slightly (margin)
  let safeArea = { minX: -Infinity, maxX: Infinity, minY: -Infinity, maxY: Infinity }
  if (refBounds) {
      const w = refBounds.maxX - refBounds.minX
      const h = refBounds.maxY - refBounds.minY
      const m = Math.max(w, h, 100) * 1.0 // 100% margin safe zone
      safeArea = {
          minX: refBounds.minX - m, maxX: refBounds.maxX + m,
          minY: refBounds.minY - m, maxY: refBounds.maxY + m
      }
  }
  
  // Reset fb to re-calculate clean bounds
  fb = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  
  // Add Filtered Components
  renderData.componentCenters.forEach(pt => {
      if (pt.x >= safeArea.minX && pt.x <= safeArea.maxX && pt.y >= safeArea.minY && pt.y <= safeArea.maxY) {
          fb.minX = Math.min(fb.minX, pt.x); fb.maxX = Math.max(fb.maxX, pt.x)
          fb.minY = Math.min(fb.minY, pt.y); fb.maxY = Math.max(fb.maxY, pt.y)
      }
  })
  
  // Add Filtered Lines
  renderData.boardLines.forEach(line => {
      let b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
      if (line.type === '0' && line.params) {
           const p = line.params
           const bx = line.base_x || 0; const by = line.base_y || 0
           const cx = bx + p[0]; const cy = by + p[1]
           if (p.length >= 6) { 
               const w = p[2], h = p[3]
               b = { minX: cx - w/2, maxX: cx + w/2, minY: cy - h/2, maxY: cy + h/2 }
           } else {
               const r = Math.abs(p[2])
               b = { minX: cx - r, maxX: cx + r, minY: cy - r, maxY: cy + r }
           }
      } else if (line.points) {
           const bx = line.base_x || 0; const by = line.base_y || 0
           line.points.forEach(pt => {
               const x = bx + pt.x; const y = by + pt.y
               b.minX = Math.min(b.minX, x); b.maxX = Math.max(b.maxX, x)
               b.minY = Math.min(b.minY, y); b.maxY = Math.max(b.maxY, y)
           })
      }
      
      if (isFinite(b.minX)) {
          if (b.maxX >= safeArea.minX && b.minX <= safeArea.maxX &&
              b.maxY >= safeArea.minY && b.minY <= safeArea.maxY) {
               fb.minX = Math.min(fb.minX, b.minX)
               fb.maxX = Math.max(fb.maxX, b.maxX)
               fb.minY = Math.min(fb.minY, b.minY)
               fb.maxY = Math.max(fb.maxY, b.maxY)
          }
      }
  })

  // Add Filtered Pins (assuming pins follow component logic mostly, but check safeArea)
  renderData.pins.forEach(pin => {
      if (pin.x >= safeArea.minX && pin.x <= safeArea.maxX && pin.y >= safeArea.minY && pin.y <= safeArea.maxY) {
          fb.minX = Math.min(fb.minX, pin.x); fb.maxX = Math.max(fb.maxX, pin.x)
          fb.minY = Math.min(fb.minY, pin.y); fb.maxY = Math.max(fb.maxY, pin.y)
      }
  })

  // Add Filtered Signals
  renderData.signals.forEach(sig => {
      if (sig.bounds) {
          if (sig.bounds.maxX >= safeArea.minX && sig.bounds.minX <= safeArea.maxX &&
              sig.bounds.maxY >= safeArea.minY && sig.bounds.minY <= safeArea.maxY) {
              fb.minX = Math.min(fb.minX, sig.bounds.minX)
              fb.maxX = Math.max(fb.maxX, sig.bounds.maxX)
              fb.minY = Math.min(fb.minY, sig.bounds.minY)
              fb.maxY = Math.max(fb.maxY, sig.bounds.maxY)
          }
      }
  })

  // Fallback
  if (!isFinite(fb.minX)) {
     // If everything filtered out (should be impossible unless empty), use bounds or default
     fb = bounds
  }

  // Update global bounds to match focused bounds so getBaseScale() is correct for 1.0x
  bounds = fb
  
  resetView(fb)
  updateStats()
  updateSearchLists()
}

// --- Library Parsers ---

function buildFootprintLibrary(partdecalObj) {
  const library = {}
  
  Object.entries(partdecalObj).forEach(([name, rawData]) => {
    const sections = String(rawData).split('|')
    
    // Basic Info
    const type = sections[0]
    const outlines = []
    const pins = {}
    const padDefinitions = {}
    const padList = []

    // 1. Parse Outline (Section 1)
    if (sections.length > 1 && sections[1]) {
       const outlineSection = sections[1]
       const outlineParts = outlineSection.split(',')
       // Format: Type, Thickness, x1, y1, x2, y2...
       // Or Type, Thickness, x1, y1, radius... (if circle)
       if (outlineParts.length >= 2) {
          const outlineType = outlineParts[0]
          const thickness = Number(outlineParts[1]) || 1
          
          if (outlineType === '1' || outlineType === '4') {
             // Polyline
             const points = []
             for (let i = 2; i < outlineParts.length - 1; i += 2) {
                const x = Number(outlineParts[i])
                const y = Number(outlineParts[i+1])
                if (isFinite(x) && isFinite(y)) points.push({x, y})
             }
             if (points.length > 0) {
                outlines.push({
                   type: outlineType,
                   points: points,
                   thickness: thickness,
                   closed: true // Outlines usually closed
                })
             }
          } else if (outlineType === '0') {
             // Circle/Arc params
             const params = outlineParts.slice(2).map(Number)
             if (params.every(n => isFinite(n))) {
                outlines.push({
                   type: '0',
                   params: params,
                   thickness: thickness
                })
             }
          }
       }
    }

    // 2. Parse Pins (Section 2)
    if (sections.length > 2 && sections[2]) {
       const pinSection = sections[2]
       const pinItems = pinSection.split(';')
       pinItems.forEach(item => {
          const parts = item.split(',')
          if (parts.length === 3) {
             const pinId = parts[0].trim()
             const x = Number(parts[1])
             const y = Number(parts[2])
             if (pinId && isFinite(x) && isFinite(y)) {
                pins[pinId] = { x, y }
             }
          }
       })
    }

    // 3. Parse Pads (Section 3)
    if (sections.length > 3 && sections[3]) {
       const padSection = sections[3]
       const padItems = padSection.split(';') // Assuming multiple pads separated by ;? 
       // Or is section 3 A SINGLE pad definition?
       // Looking at example: "0,18,5,0,90,60,0" -> This looks like ONE definition.
       // But what if there are different pad shapes?
       // Usually footprint has one pad definition referenced by index?
       // Or simply: Section 3 is "Pad Definition List"?
       
       // Let's assume comma separated values are properties of ONE pad definition
       // But if multiple definitions exist, how are they separated?
       // Based on previous JSON analysis (FPAD_1), pad defs were complex strings.
       // In the user example: "0201": "...|...|0,18,5,0,90,60,0|..."
       // Section 3 is "0,18,5,0,90,60,0". This looks like a single pad definition.
       
       // Let's parse it as the DEFAULT pad definition.
       const padParts = padSection.split(',')
       if (padParts.length >= 3) { // Need at least Shape, W, H
          // 3. Parse Pads (Section 3) - Normalized Logic
          // Format: Shape(Ignored), Width, Height, ...
          // User Rule: Geometry depends ONLY on dimensions.
          
          const w = Number(padParts[1])
          const h = Number(padParts[2]) 
          
          if (isFinite(w) && w > 0) {
             // 1. Normalize Dimensions
             // If height == 0 -> height = width
             const finalW = w
             const finalH = (h === 0) ? w : h
             
             // 2. Determine Shape ONLY by Dimensions
             // if abs(width - height) < 0.001 -> CIRCLE
             // if abs(width - height) >= 0.001 -> RECT
             let shape = 'RECT'
             if (Math.abs(finalW - finalH) < 0.001) {
                shape = 'CIRCLE'
             }
             
             // 3. Extract per-pad rotation if present
             // Many entries look like: 0, W, H, <ignored>, ROT, ...
             // We will read padParts[4] as rotation when available
             let rotation = 0
             if (padParts.length >= 5) {
               const rotCandidate = Number(padParts[4])
               if (isFinite(rotCandidate)) rotation = rotCandidate
             }
             
             const padDef = { 
                w: finalW, 
                h: finalH, 
                shape: shape,
                rotation: rotation
             }
             
             // Store as default and '0' (if indexed)
             padDefinitions['default'] = padDef
             padList.push(padDef)
          }
       }
    }

    const defaultPad = padList.length > 0 
      ? { ...padList[0] } 
      : { w: 3, h: 3, shape: 'CIRCLE' }
 
    // Compute footprint local bounds from outlines (approximate)
    let fb = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
    outlines.forEach(o => {
      if (o.type === '0' && o.params && o.params.length >= 3) {
        const cx = o.params[0]
        const cy = o.params[1]
        const r = Math.abs(o.params[2])
        fb.minX = Math.min(fb.minX, cx - r)
        fb.maxX = Math.max(fb.maxX, cx + r)
        fb.minY = Math.min(fb.minY, cy - r)
        fb.maxY = Math.max(fb.maxY, cy + r)
      } else if (o.points && o.points.length) {
        o.points.forEach(pt => {
          fb.minX = Math.min(fb.minX, pt.x)
          fb.maxX = Math.max(fb.maxX, pt.x)
          fb.minY = Math.min(fb.minY, pt.y)
          fb.maxY = Math.max(fb.maxY, pt.y)
        })
      }
    })
    if (!isFinite(fb.minX)) {
      fb = { minX: -5, minY: -5, maxX: 5, maxY: 5 }
    }
 
    library[name] = { outlines, pins, padDefinitions, defaultPad, bounds: fb }
  })
  
  return library
}

function parseOutlineSection(section) {
  const points = []
  const pieces = section.split(',')
  // Format: Type, Thickness, x1, y1, x2, y2...
  if (pieces.length >= 4 && pieces[0] === '1') {
    for (let i = 2; i < pieces.length - 1; i += 2) {
      const x = Number(pieces[i])
      const y = Number(pieces[i + 1])
      if (isFinite(x) && isFinite(y)) {
        points.push({ x, y })
      }
    }
  }
  return points
}

function resolvePinSize(pinId, footprint) {
  if (!footprint) return { w: 3, h: 3, shape: 'CIRCLE' }
  
  // 1. Direct Match
  if (footprint.padDefinitions[pinId]) {
    return footprint.padDefinitions[pinId]
  }
  
  // 2. Numeric Match
  const numericId = String(Math.trunc(Number(pinId)))
  if (footprint.padDefinitions[numericId]) {
    return footprint.padDefinitions[numericId]
  }
  
  // 3. Default
  return footprint.defaultPad
}

// --- Entry Parsers ---

function parseLineEntry(entry) {
  const parts = String(entry).split('|')
  if (parts.length < 8) return null
  
  const type = parts[0]
  const baseX = Number(parts[1])
  const baseY = Number(parts[2])
  const thickness = Number(parts[4])
  
  const pointsStr = parts.slice(7).join('|')
  const tokens = pointsStr.split(';')
  
  // If Type 0 (Circle/Arc)
  if (type === '0') {
     const out = []
     const polyPts = []
     tokens.forEach(t => {
       const nums = t.split(',').map(Number)
       if (nums.length >= 3 && nums.every(n => isFinite(n))) {
         out.push({
           type: '0',
           base_x: baseX,
           base_y: baseY,
           thickness: thickness,
           points: [],
           params: nums,
           closed: false
         })
       } else if (nums.length === 2 && isFinite(nums[0]) && isFinite(nums[1])) {
         polyPts.push({ x: nums[0], y: nums[1] })
       }
     })
     if (polyPts.length > 0) {
       out.push({
         type: '1',
         base_x: baseX,
         base_y: baseY,
         thickness: thickness,
         points: polyPts,
         params: [],
         closed: false
       })
     }
     if (out.length > 0) return out
  }

  // Type 1/4 (Polyline)
  const points = tokens.map(t => {
    const nums = t.split(',').map(Number)
    if (nums.length >= 2 && isFinite(nums[0]) && isFinite(nums[1])) {
      return { x: nums[0], y: nums[1] }
    }
    return null
  }).filter(p => p !== null)
  
  return {
    type: type,
    base_x: baseX,
    base_y: baseY,
    thickness: thickness,
    points: points,
    params: [],
    closed: false
  }
}

function parsePartEntry(entry, id) {
  const parts = String(entry).split('|')
  if (parts.length < 4) return null
  
  const rawFootprint = parts[0]
  const atIdx = rawFootprint.indexOf('@')
  const footprint = (atIdx >= 0 ? rawFootprint.slice(0, atIdx) : rawFootprint).trim()
  const x = Number(parts[1])
  const y = Number(parts[2])
  const rot = Number(parts[3])
  
  if (!isFinite(x) || !isFinite(y)) return null
  return { id, footprint, x, y, rot: isFinite(rot) ? rot : 0 }
}

function parsePinRef(token) {
  const trimmed = String(token).trim()
  if (!trimmed) return null
  const dotIndex = trimmed.indexOf('.')
  if (dotIndex <= 0) return null
  return {
    partId: trimmed.slice(0, dotIndex),
    pinId: trimmed.slice(dotIndex + 1)
  }
}

// --- Drawing Layers ---

function drawLayer_BoardLines(scaleFactor) {

  stroke(200, 200, 200)
fill(25, 25, 25)

  let currentWeight = 1 / scaleFactor
  strokeWeight(currentWeight)

  beginShape()

  renderData.boardLines.forEach(line => {
    
    const weight = line.thickness > 0 ? line.thickness : 1 / scaleFactor
    // Only change stroke weight if necessary
    if (Math.abs(weight - currentWeight) > 0.0001) {
       strokeWeight(weight)
       currentWeight = weight
    }
    
    const bx = line.base_x || 0
    const by = line.base_y || 0
    
    if (line.type === '0' && line.params && line.params.length >= 3) {
       // Primitives (Circle, Rect, Arc) - Use Matrix isolation for complex shapes
       push()
       translate(bx, by)
       
       const p = line.params
       let shapeKind = 'circle'
       if (p.length >= 6) shapeKind = 'rect'
       else if (p.length >= 5) shapeKind = 'arc'
       if (shapeKind === 'circle') {
         const r = Math.abs(p[2])
         if (r <= MARKER_RADIUS_MAX) shapeKind = 'markerCircle'
       }
       
       if ((shapeKind === 'circle' && !boardFilters.circles) ||
           (shapeKind === 'markerCircle' && !boardFilters.markerCircles) ||
           (shapeKind === 'arc' && !boardFilters.arcs) ||
           (shapeKind === 'rect' && !boardFilters.rects)) {
         pop()
         return
       }
       
       const x = p[0]
       const y = p[1]
       
      if (shapeKind === 'rect') {
         const w = p[2]
         const h = p[3]
         const rad = p[5]
         push()
         translate(x, y)
         rectMode(CENTER)
         rect(0, 0, w, h, rad)
         pop()
       } else if (shapeKind === 'arc') {
         const r = Math.abs(p[2])
         const startDeg = p[3]
         const endDeg = p[4]
         const spanRaw = endDeg - startDeg
         const spanDeg = ((spanRaw % 360) + 360) % 360
         const isSemi = Math.abs(spanDeg - 180) <= ARC_SEMI_TOL
         if (isSemi) {
           if (boardFilters.semiAsOutlines) {
             push()
             stroke(255, 0, 0)   //color outlines component
             // Force weight for outlines if needed, or use current
             const wOutline = line.thickness > 0 ? line.thickness : 1 / scaleFactor
             strokeWeight(wOutline)
             const start = radians(startDeg)
             const end = radians(endDeg)
             arc(x, y, r * 2, r * 2, start, end)
             pop()
           } else if (boardFilters.semiArcs) {
             const start = radians(startDeg)
             const end = radians(endDeg)
             arc(x, y, r * 2, r * 2, start, end)
           }
         } else {
           const start = radians(startDeg)
           const end = radians(endDeg)
           arc(x, y, r * 2, r * 2, start, end)
         }
       } else if (shapeKind === 'markerCircle') {
         const r = Math.abs(p[2])
         push()
         stroke(255, 0, 0)
         strokeWeight(1 / scaleFactor)
         fill(255, 180, 0)
         circle(x, y, r * 2)
         pop()
       } else {
         const r = Math.abs(p[2])
         circle(x, y, r * 2)
       }
       
       pop()
       
    } else {
       // Polyline Optimization: No push/pop, no translate
       // Direct vertex addition is much faster
       const pts = line.points || []
       beginShape()
       for(let i=0; i<pts.length; i++) {
          vertex(pts[i].x + bx, pts[i].y + by)
       }
       endShape(line.closed ? CLOSE : OPEN)
    }
  })
}

function drawLayer_Signals(scaleFactor) {
  if (renderData.signals.length === 0) return
  const vb = getVisibleBounds()
  stroke(255, 0, 0) // Greenish faint traces
  strokeWeight(0.5)
  noFill()
  renderData.signals.forEach(poly => {
    // Optimization: Culling
    if (poly.bounds) {
      if (poly.bounds.maxX < vb.minX || poly.bounds.minX > vb.maxX || 
          poly.bounds.maxY < vb.minY || poly.bounds.minY > vb.maxY) {
        return
      }
    }
    beginShape()
    poly.forEach(pt => {
      // Use center if available (normalized structure), else x/y
      const x = pt.center ? pt.center[0] : pt.x
      const y = pt.center ? pt.center[1] : pt.y
      if (isFinite(x) && isFinite(y)) {
         vertex(x, y)
      }
    })
    endShape()
  })
}

function drawLayer_ComponentOutlines(scaleFactor) {
  const vb = getVisibleBounds()
  stroke(255, 0, 0)
  noFill()
  renderData.componentOutlines.forEach(outline => {
    // Optimization: Culling (Approximate)
    // Assuming max component size is not huge. 
    // Ideally we should pre-calculate bounds.
    const MAX_COMP_SIZE = 50 
    if (outline.base_x < vb.minX - MAX_COMP_SIZE || outline.base_x > vb.maxX + MAX_COMP_SIZE ||
        outline.base_y < vb.minY - MAX_COMP_SIZE || outline.base_y > vb.maxY + MAX_COMP_SIZE) {
      return
    }

    const weight = outline.thickness > 0 ? outline.thickness : 1 / scaleFactor
    strokeWeight(weight)
    
    push()
    // Transform System: Translate to Base -> Rotate
    translate(outline.base_x, outline.base_y)
    rotate(radians(outline.rotation || 0))
    
    if (outline.type === '0' && outline.params && outline.params.length >= 3) {
       const p = outline.params
       const x = p[0]
       const y = p[1]
       const r = Math.abs(p[2])
       
       if (p.length >= 5) {
         const start = radians(p[3])
         const end = radians(p[4])
         arc(x, y, r * 2, r * 2, start, end)
       } else {
         circle(x, y, r * 2)
       }
       
    } else {
       beginShape()
       outline.points.forEach(pt => vertex(pt.x, pt.y))
       endShape(outline.closed ? CLOSE : OPEN)
    }
    
    pop()
  })
}
function drawLayer_VirtualOutlines(scaleFactor) {

  const vb = getVisibleBounds()

  stroke(150, 150, 150)
  noFill()

  const weight = 1.5 
  strokeWeight(weight)

  renderData.virtualOutlines.forEach(v => {

    const localDist = Math.hypot(v.center.x, v.center.y)
    const sizeDiag = Math.hypot(v.size.w, v.size.h) / 2
    const maxR = localDist + sizeDiag

    if (v.base_x < vb.minX - maxR || v.base_x > vb.maxX + maxR ||
        v.base_y < vb.minY - maxR || v.base_y > vb.maxY + maxR) return

    if (v.pinCount <= 1) return

    push()
    translate(v.base_x, v.base_y)
    rotate(radians(v.rotation || 0))
    rectMode(CENTER)

    const padding = 3 
    const cornerRadius = 2 

    rect(
      v.center.x,
      v.center.y,
      v.size.w + padding,
      v.size.h + padding,
      cornerRadius
    )

    pop()
  })
}

function drawLayer_Pins(scaleFactor) {
  const vb = getVisibleBounds()
  // Use a very thin stroke or no stroke to avoid overwhelming small pads
  noStroke() // Por defecto sin borde
  rectMode(CENTER)
  
  // Separate selected pin to draw last and avoid state changes
  let selectedToDraw = null
  
  renderData.pins.forEach(pin => {
    // Optimization: Culling
    const cx = pin.center ? pin.center[0] : pin.x
    const cy = pin.center ? pin.center[1] : pin.y
    if (cx < vb.minX || cx > vb.maxX || cy < vb.minY || cy > vb.maxY) return

    if (selectedPin && selectedPin.pin === pin.pin) {
      selectedToDraw = { pin, cx, cy }
      return
    }

    // 2-Pin Component Visibility Check:
    // Only show 2-pin components (resistors, caps, etc.) if zoom >= 2.0x
    
    

    const w = pin.size ? pin.size[0] : pin.w
    const h = pin.size ? pin.size[1] : pin.h
    const padScale = pin.shape === 'RECT' ? RECT_VISUAL_SCALE : 1
    const isCircleVisual = pin.shape === 'CIRCLE'
    const isTwoPinVisual = pin.twoPin // New flag to detect if it's a 2-pin component that was previously forced to circle
    
    const d = Math.max((w || 0) * padScale, (h || 0) * padScale)
    
    // Logic update: If it's a 2-pin component, we want a SQUARE (rect) with side = diameter 'd'
    // If it's explicitly a circle shape, we keep it a circle.
    
    let vw, vh
    if (isTwoPinVisual) {
        // Force square visual for 2-pin components
        vw = d
        vh = d
    } else if (isCircleVisual) {
        vw = d
        vh = d
    } else {
        vw = (w || 0) * padScale
        vh = (h || 0) * padScale
    }
    
    // Default Style
    fill(255, 200, 110, 200) // Gold
    
    // Check Net Colors
    if (pin.netId) {
      if (pin.netId === 'GND') {
        fill(150, 150, 150) // Dark Gray
      } else if (pin.netId === 'NC') {
        fill(120, 180, 255) // Light Gray
      }
    }

    let rot = (pin.absRotation || 0) % 360
    if (rot < 0) rot += 360
    
    const epsilon = 0.1
    let useTransform = true
    let swapDims = false
    
    if (Math.abs(rot) < epsilon || Math.abs(rot - 180) < epsilon || Math.abs(rot - 360) < epsilon) {
       useTransform = false
    } else if (Math.abs(rot - 90) < epsilon || Math.abs(rot - 270) < epsilon) {
       useTransform = false
       swapDims = true
    }

    if (!useTransform) {
       if (swapDims && !isCircleVisual && !isTwoPinVisual) {
          rect(cx, cy, vh, vw) // Swap w, h
       } else {
          // Now 2-pin components are squares, so we use rect() instead of circle()
          if (isCircleVisual) circle(cx, cy, d)
          else rect(cx, cy, vw, vh)
       }
    } else {
       push()
       translate(cx, cy)
       rotate(radians(rot))
       if (isCircleVisual) circle(0, 0, d)
       else rect(0, 0, vw, vh)
       pop()
    }
  })
  
  if (selectedToDraw) {
    const { pin, cx, cy } = selectedToDraw
    const w = pin.size ? pin.size[0] : pin.w
    const h = pin.size ? pin.size[1] : pin.h
    const padScale = pin.shape === 'RECT' ? RECT_VISUAL_SCALE : 1
    const isCircleVisual = pin.shape === 'CIRCLE'
    const isTwoPinVisual = pin.twoPin
    
    const d = Math.max((w || 0) * padScale, (h || 0) * padScale)
    
    let vw, vh
    if (isTwoPinVisual) {
        vw = d
        vh = d
    } else if (isCircleVisual) {
        vw = d
        vh = d
    } else {
        vw = (w || 0) * padScale
        vh = (h || 0) * padScale
    }
    
    fill(0, 255, 0)//pino selecionado
    const perceptualStroke = 1 / scaleFactor
    const maxStrokeWorld = Math.max(0.1, Math.min(vw || 0, vh || 0))
    stroke(0, 255, 0)
    strokeWeight(Math.min(perceptualStroke, maxStrokeWorld))
    
    let rot = (pin.absRotation || 0) % 360
    if (rot < 0) rot += 360
    
    const epsilon = 0.1
    let useTransform = true
    let swapDims = false
    
    if (Math.abs(rot) < epsilon || Math.abs(rot - 180) < epsilon || Math.abs(rot - 360) < epsilon) {
       useTransform = false
    } else if (Math.abs(rot - 90) < epsilon || Math.abs(rot - 270) < epsilon) {
       useTransform = false
       swapDims = true
    }

    if (!useTransform) {
       if (swapDims && !isCircleVisual && !isTwoPinVisual) {
          rect(cx, cy, vh, vw) // Swap w, h
       } else {
          if (isCircleVisual) circle(cx, cy, d)
          else rect(cx, cy, vw, vh)
       }
    } else {
       push()
       translate(cx, cy)
       rotate(radians(rot))
       if (isCircleVisual) circle(0, 0, d)
       else rect(0, 0, vw, vh)
       pop()
    }
  }
}

function drawLayer_ComponentCenters(scaleFactor) {
  noStroke()
  fill(255, 0, 0 ) // Red
  const r = 6 / scaleFactor // Scale invariant size? Or fixed? Let's make it zoomable but small
  // Actually fixed screen size is usually better for handles, but let's stick to world space for now
  // To keep it visible at zoom, maybe fixed size?
  // Previous code: const r = 6 (world units)
  const dotSize = 6
  renderData.componentCenters.forEach(pt => {
    circle(pt.x, pt.y, dotSize)
  })
}
function drawLayer_ComponentLabels(scaleFactor) {

  const vb = getVisibleBounds()

  // 🔎 Controle real de zoom baseado na área visível
  const visibleWidth = vb.maxX - vb.minX

  // Ajuste este valor para controlar quando aparece
  const ZOOM_THRESHOLD = 3000

  if (visibleWidth > ZOOM_THRESHOLD) return


  // ============================
  // Configuração do texto
  // ============================

  const SCREEN_TEXT_SIZE = 11
  const ts = SCREEN_TEXT_SIZE / scaleFactor
  
  textSize(ts)
  textFont('monospace')
  textAlign(CENTER, CENTER)
  noStroke()
  fill(255)

  const occupied = []
  const PADDING = 2 / scaleFactor 


  // ============================
  // Criar mapa de virtual outlines
  // ============================

  const virtualMap = {}
  renderData.virtualOutlines.forEach(v => {
    if (v.id) virtualMap[v.id] = v
  })


  // ============================
  // Loop dos componentes
  // ============================

  renderData.componentCenters.forEach(comp => {

    // 1️⃣ Culling
    if (comp.x < vb.minX || comp.x > vb.maxX ||
        comp.y < vb.minY || comp.y > vb.maxY) return

    if (!comp.id) return
    if (comp.pinCount <= 1) return

    const label = comp.id
    
    // 2️⃣ Determinar posição (preferir virtual outline)
    let posX = comp.x
    let posY = comp.y
    
    const v = virtualMap[comp.id]
    if (v) {
       const r = rotatePoint(v.center.x, v.center.y, v.rotation)
       posX = v.base_x + r.x
       posY = v.base_y + r.y
    }

    const w = textWidth(label)
    const h = ts
    
    const minX = posX - w/2 - PADDING
    const maxX = posX + w/2 + PADDING
    const minY = posY - h/2 - PADDING
    const maxY = posY + h/2 + PADDING
    
    // 3️⃣ Checagem de colisão
    let collision = false
    for (const box of occupied) {
      if (!(maxX < box.minX || minX > box.maxX ||
            maxY < box.minY || minY > box.maxY)) {
        collision = true
        break
      }
    }
    
    // 4️⃣ Desenhar se não houver colisão
    if (!collision) {

      if (FLIP_VERTICAL) {
         push()
         translate(posX, posY)
         scale(1, -1)
         text(label, 0, 0)
         pop()
      } else {
         text(label, posX, posY)
      }

      occupied.push({ minX, maxX, minY, maxY })
    }

  })
}

function drawLayer_PinLabels(scaleFactor) {
  // Only show if zoomed in
  if (view.scale <= 12.0) return

  const vb = getVisibleBounds()
  
  // Use smaller text for pins
  const SCREEN_TEXT_SIZE = 10
  const ts = SCREEN_TEXT_SIZE / scaleFactor
  
  textSize(ts)
   textFont('monospace')
   textAlign(CENTER, CENTER) // Center vertically and horizontally
   noStroke()
   
   renderData.pins.forEach(pin => {
     // 1. Culling
     const cx = pin.center ? pin.center[0] : pin.x
     const cy = pin.center ? pin.center[1] : pin.y
     if (cx < vb.minX || cx > vb.maxX || cy < vb.minY || cy > vb.maxY) return
 
     // 2. Extract Info
     const parts = (pin.pin || "").split('.')
     const pinId = parts.length > 1 ? parts[1] : pin.pin
     const signal = pin.netId || "NC"
     
     // 3. Draw Centered
     if (FLIP_VERTICAL) {
         push()
         translate(cx, cy)
         scale(1, -1)
         
         // Top line (Pin ID) slightly above center
         // Bottom line (Signal) slightly below center
         // Total height approx 2 * ts
         // We center the block around (0,0)
         
         fill(50, 50, 50, 255) // Dark Text for contrast on pads (usually Gold/Silver)
         // Or white with stroke? Let's try simple dark text first as pads are light.
         // Actually pads are: fill(255, 200, 110, 200) (Gold)
         // Dark text is better.
         
         text(pinId, 0, -ts * 0.6)
         
         // Signal
         fill(80, 80, 80, 200) 
         text(signal, 0, ts * 0.6)
         
         pop()
     } else {
         // Standard
         fill(50, 50, 50, 255)
         text(pinId, cx, cy - ts * 0.6)
         
         fill(80, 80, 80, 200)
         text(signal, cx, cy + ts * 0.6)
     }
   })
 }


// --- Utilities ---

function getTransform() {
  const margin = VIEW_MARGIN
  const w = width - margin * 2
  const h = height - margin * 2
  const bw = bounds.maxX - bounds.minX
  const bh = bounds.maxY - bounds.minY
  const baseScale = (bw > 0 && bh > 0) ? Math.min(w / bw, h / bh) : 1
  
  const totalScale = baseScale * view.scale
  
  return {
    transform: {
      tx: margin + view.offsetX,
      ty: margin + view.offsetY,
      s: totalScale
    },
    scaleFactor: totalScale
  }
}

function getVisibleBounds() {
  const { transform } = getTransform()
  // Add margin to avoid popping
  const m = 500 / transform.s 
  const sy = FLIP_VERTICAL ? -transform.s : transform.s
  
  const minX = (0 - transform.tx) / transform.s + bounds.minX - m
  const maxX = (width - transform.tx) / transform.s + bounds.minX + m
  
  // Inverse Transform for Y
  // If Flip: ScreenY = ty - s * (WorldY - maxY)
  // WorldY - maxY = (ScreenY - ty) / -s
  // WorldY = (ScreenY - ty) / -s + maxY
  const baseOffY = FLIP_VERTICAL ? bounds.maxY : bounds.minY
  
  const y1 = (0 - transform.ty) / sy + baseOffY
  const y2 = (height - transform.ty) / sy + baseOffY
  
  const minY = Math.min(y1, y2) - m
  const maxY = Math.max(y1, y2) + m
  
  return { minX, maxX, minY, maxY }
}

function rotatePoint(x, y, deg) {
  const rad = (deg * Math.PI) / 180
  const cosA = Math.cos(rad)
  const sinA = Math.sin(rad)
  return { 
    x: x * cosA - y * sinA, 
    y: x * sinA + y * cosA 
  }
}

function updateBounds(x, y) {
  bounds.minX = Math.min(bounds.minX, x)
  bounds.minY = Math.min(bounds.minY, y)
  bounds.maxX = Math.max(bounds.maxX, x)
  bounds.maxY = Math.max(bounds.maxY, y)
}

function updateStats() {
  const statsEl = document.getElementById('stats')
  if (statsEl) {
    statsEl.textContent = `Lines: ${renderData.boardLines.length} | Parts: ${renderData.componentCenters.length} | Pins: ${renderData.pins.length}`
  }
}

// --- Interaction ---

function mousePressed() {
  if (mouseButton === LEFT) {
    isDragging = true
    hasDragged = false

    dragStartX = mouseX
    dragStartY = mouseY

    startOffsetX = view.offsetX
    startOffsetY = view.offsetY
  }
}

function mouseReleased() {
  isDragging = false

  if (!hasDragged) {
    selectPinUnderCursor()
  }


  if (!hasDragged) {
    selectPinUnderCursor()
  }
}

function mouseDragged() {
  if (!isDragging) return

  const total = Math.hypot(mouseX - dragStartX, mouseY - dragStartY)
  if (total < DRAG_THRESHOLD) return

  hasDragged = true

  const dx = mouseX - dragStartX
  const dy = mouseY - dragStartY

  // 🔥 MOVE DIRETO
  view.offsetX = startOffsetX + dx
  view.offsetY = startOffsetY + dy

  redraw()
}

function mouseWheel(event) {
  if (!pcbData) return false

  const { transform } = getTransform()

  const factor = Math.pow(1.001, -event.delta)
  const nextScale = constrain(view.scale * factor, 0.1, 50)

  const sy = FLIP_VERTICAL ? -transform.s : transform.s
  const baseOffY = FLIP_VERTICAL ? bounds.maxY : bounds.minY

  const worldX = (mouseX - transform.tx) / transform.s + bounds.minX
  const worldY = (mouseY - transform.ty) / sy + baseOffY

  const { baseScale } = getBaseScale()
  const actualNewScale = baseScale * nextScale
  const newSy = FLIP_VERTICAL ? -actualNewScale : actualNewScale

  const screenX = (worldX - bounds.minX) * actualNewScale + 40 + view.offsetX
  const screenY = (worldY - baseOffY) * newSy + 40 + view.offsetY

  const dX = mouseX - screenX
  const dY = mouseY - screenY

  view.scale = nextScale
  view.offsetX += dX
  view.offsetY += dY

  // 🔥 sincroniza sempre
  targetView.scale = view.scale
  targetView.offsetX = view.offsetX
  targetView.offsetY = view.offsetY

  isAnimating = false
  noLoop()
  updateZoomIndicator()
  redraw()

  return false
}

function getBaseScale() {
   const margin = VIEW_MARGIN
   const w = width - margin * 2
   const h = height - margin * 2
   const bw = bounds.maxX - bounds.minX
   const bh = bounds.maxY - bounds.minY
   const baseScale = (bw > 0 && bh > 0) ? Math.min(w / bw, h / bh) : 1
   return { baseScale }
}

function selectPinUnderCursor() {
  const { transform } = getTransform()
  const sy = FLIP_VERTICAL ? -transform.s : transform.s
  const worldX = (mouseX - transform.tx) / transform.s + bounds.minX
  
  const baseOffY = FLIP_VERTICAL ? bounds.maxY : bounds.minY
  const worldY = (mouseY - transform.ty) / sy + baseOffY
  
  let best = null
  let bestDist = Infinity
  for (const pin of renderData.pins) {
    const cx = pin.center ? pin.center[0] : pin.x
    const cy = pin.center ? pin.center[1] : pin.y
    if (!isFinite(cx) || !isFinite(cy)) continue
    const dx = worldX - cx
    const dy = worldY - cy
    const dist = Math.hypot(dx, dy)
    const w = pin.size ? pin.size[0] : pin.w
    const h = pin.size ? pin.size[1] : pin.h
    const padScale = pin.shape === 'RECT' ? RECT_VISUAL_SCALE : 1
    const isCircleVisual = pin.twoPin || (pin.shape === 'CIRCLE')
    const diameter = Math.max((w || 0) * padScale, (h || 0) * padScale)
    const vw = isCircleVisual ? diameter : (w || 0) * padScale
    const vh = isCircleVisual ? diameter : (h || 0) * padScale
    const radius = isCircleVisual ? diameter / 2 : Math.max(vw, vh) / 2
    const threshold = Math.max(6, radius)
    if (dist <= threshold && dist < bestDist) {
      // Check if GND or NC
      if (pin.netId === 'GND' || pin.netId === 'NC') continue
      best = pin
      bestDist = dist
    }
  }
  if (best) {
    selectedPin = best
    selectedNet = best.netId ? renderData.netList[best.netId] : null
    
    // Update navigation state
    if (selectedNet) {
        currentNetPins = selectedNet
        currentNetPinIndex = currentNetPins.indexOf(best)
    } else {
        currentNetPins = []
        currentNetPinIndex = -1
    }
    
    updateDebugPanel(best)
    redraw()
  } else {
    selectedPin = null
    selectedNet = null
    currentNetPins = []
    currentNetPinIndex = -1
    const panel = document.getElementById('debug-panel')
    if (panel) panel.style.display = 'none'
    redraw()
  }
}

function updateDebugPanel(pin) {
  const panel = document.getElementById('debug-panel')
  const content = document.getElementById('debug-content')
  if (!panel || !content) return
  const comp = pin.component || { x: 0, y: 0, rot: 0 }
  const loc = pin.local || { x: pin.x || 0, y: pin.y || 0 }
  const size = pin.size || [pin.w || 0, pin.h || 0]
  const center = pin.center || [NaN, NaN]
  const { transform } = getTransform()
  const padScale = pin.shape === 'RECT' ? RECT_VISUAL_SCALE : 1
  const isCircleVisual = pin.twoPin || (pin.shape === 'CIRCLE')
  const d = Math.max(size[0] * padScale, size[1] * padScale)
  const wpx = (isCircleVisual ? d : size[0] * padScale) * transform.s
  const hpx = (isCircleVisual ? d : size[1] * padScale) * transform.s
  const effRot = (comp.rot || 0) + (pin.rotation || 0)
  const lines = [
    `Pin: ${pin.pin}`,
    `Shape: ${pin.shape}`,
    `Size: [${size[0]}, ${size[1]}]`,
    
    
    
    `VisualSize(px): [${wpx.toFixed(2)}, ${hpx.toFixed(2)}]`,
    `Component: [${comp.x}, ${comp.y}]`,
    
  ]
  content.textContent = lines.join('\n')
  panel.style.display = 'block'
}

function drawLayer_SelectedNet(scaleFactor) {
  if (!selectedNet || selectedNet.length < 2) return

  const vb = getVisibleBounds()
  stroke(0, 255, 0) // Cyan
  strokeWeight(2 / scaleFactor)
  noFill()

  // Algorithm: Nearest Neighbor Chain starting from selectedPin (or first pin)
  let current = selectedPin && selectedNet.includes(selectedPin) ? selectedPin : selectedNet[0]
  
  // Clone array to set of unvisited
  const unvisited = new Set(selectedNet)
  unvisited.delete(current)

  const path = [current]
  
  while (unvisited.size > 0) {
    let bestNext = null
    let minD = Infinity
    
    const cx1 = current.center ? current.center[0] : current.x
    const cy1 = current.center ? current.center[1] : current.y
    
    for (const p of unvisited) {
      const cx2 = p.center ? p.center[0] : p.x
      const cy2 = p.center ? p.center[1] : p.y
      
      // Manhattan Distance
      const d = Math.abs(cx1 - cx2) + Math.abs(cy1 - cy2)
      if (d < minD) {
        minD = d
        bestNext = p
      }
    }
    
    if (bestNext) {
      path.push(bestNext)
      unvisited.delete(bestNext)
      current = bestNext
    } else {
      break
    }
  }

  // Draw Lines (Manhattan L-Shapes)
  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i]
    const p2 = path[i+1]
    
    const x1 = p1.center ? p1.center[0] : p1.x
    const y1 = p1.center ? p1.center[1] : p1.y
    const x2 = p2.center ? p2.center[0] : p2.x
    const y2 = p2.center ? p2.center[1] : p2.y
    
    beginShape()
    vertex(x1, y1)
    // Horizontal first then Vertical
    vertex(x2, y1)
    vertex(x2, y2)
    endShape()
    
    // Highlight connected pin
if (p2 !== selectedPin) {
  const cx = x2
  const cy = y2
  const padScale = p2.shape === 'RECT' ? RECT_VISUAL_SCALE : 1
  const isCircleVisual = p2.twoPin || (p2.shape === 'CIRCLE')
  const w = p2.size ? p2.size[0] : p2.w
  const h = p2.size ? p2.size[1] : p2.h
  const d = Math.max((w||0)*padScale, (h||0)*padScale)
  const vw = isCircleVisual ? d : (w||0)*padScale
  const vh = isCircleVisual ? d : (h||0)*padScale
  
  push()
  translate(cx, cy)
  rotate(radians(p2.absRotation || 0))

  // 🔥 VERDE CONTORNO + PREENCHIMENTO
  fill(0, 255, 0)         // Verde com transparência
  stroke(0, 150, 0)      // Verde mais forte no contorno
  
  // Evita sumir com zoom alto
  strokeWeight(Math.max(1.5 / scaleFactor, 0.3))

  if (isCircleVisual) {
    circle(0, 0, d)
  } else {
    rect(0, 0, vw, vh)
  }

  pop()
}
  }
  
  // Also highlight the start pin if it's not selectedPin
  const p1 = path[0]
  if (p1 !== selectedPin) {
      const cx = p1.center ? p1.center[0] : p1.x
      const cy = p1.center ? p1.center[1] : p1.y
      const padScale = p1.shape === 'RECT' ? RECT_VISUAL_SCALE : 1
      const isCircleVisual = p1.twoPin || (p1.shape === 'CIRCLE')
      const w = p1.size ? p1.size[0] : p1.w
      const h = p1.size ? p1.size[1] : p1.h
      const d = Math.max((w||0)*padScale, (h||0)*padScale)
      const vw = isCircleVisual ? d : (w||0)*padScale
      const vh = isCircleVisual ? d : (h||0)*padScale
      
      push()
      translate(cx, cy)
      rotate(radians(p1.absRotation || 0))
      noFill()
      stroke(0, 255, 255, 150)
      strokeWeight(1.5/scaleFactor)
      if (isCircleVisual) circle(0, 0, d)
      else rect(0, 0, vw, vh)
      pop()
  }
}

function resetView(targetBounds) {
  const margin = VIEW_MARGIN
  const w = width - margin * 2
  const h = height - margin * 2
  
  // Use targetBounds if provided, else bounds
  const b = targetBounds || bounds
  
  let bw = b.maxX - b.minX
  let bh = b.maxY - b.minY
  
  if (bw <= 0 || bh <= 0) {
     bw = 100; bh = 100; // Fallback
  }
  
  const scaleW = w / bw
  const scaleH = h / bh
  const fitScale = Math.min(scaleW, scaleH)
  
  const { baseScale } = getBaseScale()
  
  if (baseScale > 0) {
      view.scale = fitScale / baseScale
  } else {
      view.scale = 1.0
  }
  
  // Center targetBounds
  const cx = (b.minX + b.maxX) / 2
  const cy = (b.minY + b.maxY) / 2
  
  view.offsetX = (width / 2) - margin - (cx - bounds.minX) * fitScale
  
  if (FLIP_VERTICAL) {
      view.offsetY = (height / 2) - margin - (bounds.maxY - cy) * fitScale
  } else {
      view.offsetY = (height / 2) - margin - (cy - bounds.minY) * fitScale
  }
  
  targetView.scale = view.scale
  targetView.offsetX = view.offsetX
  targetView.offsetY = view.offsetY
  
  isAnimating = false
  noLoop()
  updateZoomIndicator()
  redraw()
}

// --- Floating UI Logic ---

function setupFloatingControls() {
  // Zoom
  const btnZoomIn = document.getElementById('zoom-in')
  if (btnZoomIn) {
    btnZoomIn.addEventListener('click', () => {
      applyZoomCenter(view.scale * 1.2)
    })
  }

  const btnZoomOut = document.getElementById('zoom-out')
  if (btnZoomOut) {
    btnZoomOut.addEventListener('click', () => {
      applyZoomCenter(view.scale / 1.2)
    })
  }

  const btnFitView = document.getElementById('fit-view')
  if (btnFitView) {
    btnFitView.addEventListener('click', () => {
      resetView()
    })
  }

  // Component Search
  const inputComp = document.getElementById('comp-search')
  if (inputComp) {
    inputComp.addEventListener('change', (e) => {
      const val = e.target.value
      if (!val) return
      const comp = renderData.componentCenters.find(c => c.id === val)
      if (comp) {
        focusOnPoint(comp.x, comp.y, 5.0)
        inputComp.blur()
      }
    })
  }

  // Net Search
  const inputNet = document.getElementById('net-search')
  if (inputNet) {
    inputNet.addEventListener('change', (e) => {
      const val = e.target.value
      if (!val) return
      selectNet(val)
      inputNet.blur()
    })
  }

  // Next Pin
  const btnNextPin = document.getElementById('btn-next-pin')
  if (btnNextPin) {
    btnNextPin.addEventListener('click', () => {
      if (currentNetPins.length === 0) return
      currentNetPinIndex = (currentNetPinIndex + 1) % currentNetPins.length
      const pin = currentNetPins[currentNetPinIndex]
      if (pin) {
        focusOnPoint(pin.center ? pin.center[0] : pin.x, pin.center ? pin.center[1] : pin.y, 15.0)
        selectedPin = pin
        updateDebugPanel(pin)
        redraw()
      }
    })
  }

  // Clear Net
  const btnClearNet = document.getElementById('btn-clear-net')
  if (btnClearNet) {
    btnClearNet.addEventListener('click', () => {
      selectedNet = null
      selectedPin = null
      currentNetPins = []
      currentNetPinIndex = -1
      if (inputNet) inputNet.value = ''
      const panel = document.getElementById('debug-panel')
      if (panel) panel.style.display = 'none'
      redraw()
    })
  }
}

function updateSearchLists() {
  const dlComp = document.getElementById('components-list')
  if (dlComp) {
    dlComp.innerHTML = ''
    renderData.componentCenters.forEach(c => {
      if (c.id) {
        const opt = document.createElement('option')
        opt.value = c.id
        dlComp.appendChild(opt)
      }
    })
  }

  const dlNet = document.getElementById('nets-list')
  if (dlNet) {
    dlNet.innerHTML = ''
    const nets = Object.keys(renderData.netList).sort()
    nets.forEach(netId => {
      const opt = document.createElement('option')
      opt.value = netId
      dlNet.appendChild(opt)
    })
  }
}

function applyZoomCenter(newScale) {
  const nextScale = constrain(newScale, 0.1, 50)
  const cx = width / 2
  const cy = height / 2
  const ratio = nextScale / view.scale
  
  view.offsetX = cx - (cx - view.offsetX) * ratio
  view.offsetY = cy - (cy - view.offsetY) * ratio
  view.scale = nextScale
  
  targetView.scale = view.scale
  targetView.offsetX = view.offsetX
  targetView.offsetY = view.offsetY
  
  // updateZoomIndicator() // If it exists, otherwise ignore
  updateZoomIndicator()
  redraw()
}

function focusOnPoint(x, y, zoomLevel) {
  const { baseScale } = getBaseScale()
  const margin = VIEW_MARGIN
  
  view.scale = zoomLevel
  view.offsetX = (width / 2) - margin - (x - bounds.minX) * baseScale * zoomLevel
  
  if (FLIP_VERTICAL) {
     view.offsetY = (height / 2) - margin + (y - bounds.maxY) * baseScale * zoomLevel
  } else {
     view.offsetY = (height / 2) - margin - (y - bounds.minY) * baseScale * zoomLevel
  }
  
  targetView.scale = view.scale
  targetView.offsetX = view.offsetX
  targetView.offsetY = view.offsetY
  
  redraw()
}

function selectNet(netId) {
  if (!renderData.netList[netId]) return
  
  selectedNet = renderData.netList[netId]
  currentNetPins = selectedNet
  currentNetPinIndex = -1
  
  if (currentNetPins.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      currentNetPins.forEach(p => {
          const px = p.center ? p.center[0] : p.x
          const py = p.center ? p.center[1] : p.y
          minX = Math.min(minX, px)
          minY = Math.min(minY, py)
          maxX = Math.max(maxX, px)
          maxY = Math.max(maxY, py)
      })
      
      const cx = (minX + maxX) / 2
      const cy = (minY + maxY) / 2
      focusOnPoint(cx, cy, 3.0)
  }
  
  redraw()
}
